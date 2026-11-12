"""All real data processing for DataVerse: parse, profile, clean, chart, EDA, store."""
from __future__ import annotations

import io
import math
import re
import shutil
import uuid
import warnings
from datetime import date, datetime
from pathlib import Path

import numpy as np
import pandas as pd

MAX_BYTES = 20 * 1024 * 1024
MAX_ROWS = 500_000
MAX_COLS = 300
ALLOWED_EXT = {".csv", ".xlsx", ".xls"}
ID_RE = re.compile(r"^[0-9a-f]{32}$")
AGGS = {"count", "sum", "mean", "median", "min", "max"}
DATE_RE = re.compile(r"^\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{4}-\d{2}-\d{2}[T ].*)")


class DataError(ValueError):
    """A user-facing problem with the data or the request."""


# ---------------------------------------------------------------- JSON helpers
def jsonable(o):
    if o is None or o is pd.NaT:
        return None
    if isinstance(o, (bool, np.bool_)):
        return bool(o)
    if isinstance(o, (int, np.integer)):
        return int(o)
    if isinstance(o, (float, np.floating)):
        return float(o) if math.isfinite(float(o)) else None
    if isinstance(o, (pd.Timestamp, datetime, date)):
        return o.isoformat()
    if isinstance(o, dict):
        return {str(k): jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple, set)):
        return [jsonable(v) for v in o]
    if isinstance(o, np.ndarray):
        return [jsonable(v) for v in o.tolist()]
    try:
        if pd.isna(o):
            return None
    except (TypeError, ValueError):
        pass
    return str(o) if not isinstance(o, str) else o


def records(df: pd.DataFrame) -> list[dict]:
    out = df.astype(object).where(df.notna(), None)
    return [jsonable(r) for r in out.to_dict("records")]


# --------------------------------------------------------------------- parsing
def _read_csv(content: bytes) -> pd.DataFrame:
    last: Exception | None = None
    for enc in ("utf-8-sig", "latin-1"):
        try:
            df = pd.read_csv(io.BytesIO(content), encoding=enc, low_memory=False)
            if df.shape[1] == 1:  # maybe a ; or tab delimited file
                try:
                    alt = pd.read_csv(io.BytesIO(content), encoding=enc, sep=None, engine="python")
                    if alt.shape[1] > 1:
                        df = alt
                except Exception:
                    pass
            return df
        except pd.errors.EmptyDataError:
            raise DataError("The file is empty.")
        except UnicodeDecodeError as e:
            last = e
        except pd.errors.ParserError:
            raise DataError("The CSV is malformed: rows have inconsistent columns or quoting.")
    raise DataError(f"Could not decode the file text ({last}).")


def parse_upload(filename: str | None, content: bytes) -> pd.DataFrame:
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise DataError("Unsupported file type. Upload a .csv, .xlsx or .xls file.")
    if not content:
        raise DataError("The file is empty.")
    if len(content) > MAX_BYTES:
        raise DataError(f"File is too large. The limit is {MAX_BYTES // (1024 * 1024)} MB.")
    try:
        df = _read_csv(content) if ext == ".csv" else pd.read_excel(io.BytesIO(content), sheet_name=0)
    except DataError:
        raise
    except Exception:
        raise DataError("Could not read this file. It may be corrupted or not a real spreadsheet.")
    df = df.dropna(how="all")
    if df.shape[1] == 0 or df.shape[0] == 0:
        raise DataError("The file has no data rows.")
    if df.shape[0] > MAX_ROWS or df.shape[1] > MAX_COLS:
        raise DataError(f"Dataset too large (limit {MAX_ROWS:,} rows and {MAX_COLS} columns).")
    names, seen = [], {}
    for i, c in enumerate(df.columns):
        n = str(c).strip()
        m = re.fullmatch(r"Unnamed: (\d+)", n)
        n = f"column_{int(m.group(1)) + 1}" if m else (n or f"column_{i + 1}")
        seen[n] = seen.get(n, 0) + 1
        names.append(n if seen[n] == 1 else f"{n}_{seen[n]}")
    df.columns = names
    return df.reset_index(drop=True)


# ------------------------------------------------------------------ type logic
def to_dt(s: pd.Series) -> pd.Series:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return pd.to_datetime(s, errors="coerce", format="mixed")


def kind_of(s: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(s):
        return "boolean"
    if pd.api.types.is_numeric_dtype(s):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(s):
        return "datetime"
    nn = s.dropna().astype(str)
    if nn.empty:
        return "text"
    sample = nn.head(200)
    if sample.str.match(DATE_RE).mean() >= 0.9 and to_dt(sample).notna().mean() >= 0.9:
        return "datetime"
    if nn.nunique() <= max(20, 0.05 * len(nn)):
        return "categorical"
    return "text"


def numeric_cols(df):
    return [c for c in df.columns if kind_of(df[c]) == "numeric"]


def _need(df: pd.DataFrame, col, label="Column") -> str:
    if col not in df.columns:
        raise DataError(f"{label} '{col}' does not exist in this dataset.")
    return col


def _need_numeric(df, col):
    _need(df, col)
    if kind_of(df[col]) != "numeric":
        raise DataError(f"'{col}' is {kind_of(df[col])}, but a numeric column is required.")
    return col


# --------------------------------------------------------------------- profile
def outlier_mask(s: pd.Series, method="iqr", k=1.5) -> pd.Series:
    x = pd.to_numeric(s, errors="coerce")
    if method == "zscore":
        sd = x.std()
        if not sd or math.isnan(sd):
            return pd.Series(False, index=s.index)
        return ((x - x.mean()) / sd).abs() > k
    q1, q3 = x.quantile(0.25), x.quantile(0.75)
    iqr = q3 - q1
    return (x < q1 - k * iqr) | (x > q3 + k * iqr)


def profile(df: pd.DataFrame) -> dict:
    n = len(df)
    cols, issues = [], []
    for c in df.columns:
        s = df[c]
        kind = kind_of(s)
        miss = int(s.isna().sum())
        info = {"name": c, "kind": kind, "dtype": str(s.dtype), "missing": miss,
                "missing_pct": round(100 * miss / n, 2) if n else 0.0, "unique": int(s.nunique())}
        if kind == "numeric":
            x = s.dropna()
            if len(x):
                info.update(min=x.min(), max=x.max(), mean=x.mean(), median=x.median(),
                            std=x.std() if len(x) > 1 else None, q1=x.quantile(.25), q3=x.quantile(.75),
                            outliers_iqr=int(outlier_mask(s).sum()))
        elif kind == "datetime":
            d = to_dt(s).dropna()
            if len(d):
                info.update(min=d.min(), max=d.max())
        else:
            info["top_values"] = [{"value": str(k), "count": int(v)} for k, v in s.value_counts().head(10).items()]
            nn = s.dropna()
            if len(nn) and pd.to_numeric(nn, errors="coerce").notna().mean() >= 0.9:
                issues.append({"column": c, "type": "numeric_as_text",
                               "message": f"'{c}' looks numeric but is stored as text. Convert its type."})
        if miss:
            issues.append({"column": c, "type": "missing", "message": f"'{c}' has {miss} missing values ({info['missing_pct']}%)."})
        if n > 1 and s.nunique() <= 1 and miss < n:
            issues.append({"column": c, "type": "constant", "message": f"'{c}' has a single value and carries no information."})
        cols.append(info)
    dups = int(df.duplicated().sum())
    if dups:
        issues.append({"column": None, "type": "duplicates", "message": f"{dups} duplicate rows found."})
    kinds = pd.Series([c["kind"] for c in cols]).value_counts().to_dict()
    return jsonable({"rows": n, "columns": len(df.columns), "duplicates": dups,
                     "missing_cells": int(df.isna().sum().sum()), "kinds": kinds,
                     "column_info": cols, "issues": issues})


def snapshot(df: pd.DataFrame) -> dict:
    return {"rows": len(df), "columns": len(df.columns), "missing_cells": int(df.isna().sum().sum()),
            "duplicates": int(df.duplicated().sum())}


def preview(df: pd.DataFrame, page: int, size: int) -> dict:
    size = max(1, min(size, 200))
    pages = max(1, math.ceil(len(df) / size))
    page = max(1, min(page, pages))
    chunk = df.iloc[(page - 1) * size: page * size]
    return {"page": page, "page_size": size, "pages": pages, "total_rows": len(df),
            "columns": [{"name": c, "kind": kind_of(df[c])} for c in df.columns], "rows": records(chunk)}


# -------------------------------------------------------------------- cleaning
def _filter(df: pd.DataFrame, col, op, value) -> pd.DataFrame:
    _need(df, col)
    s = df[col]
    if op == "is_null":
        return df[s.isna()]
    if op == "not_null":
        return df[s.notna()]
    kind = kind_of(s)
    if op in ("contains", "not_contains"):
        m = s.astype(str).str.contains(str(value), case=False, regex=False, na=False)
        return df[m] if op == "contains" else df[~m]
    if op not in ("==", "!=", ">", ">=", "<", "<="):
        raise DataError(f"Unknown filter operator '{op}'.")
    if kind == "numeric":
        try:
            v, left = float(value), s
        except (TypeError, ValueError):
            raise DataError(f"'{value}' is not a number, but '{col}' is numeric.")
    elif kind == "datetime":
        v, left = pd.to_datetime(value, errors="coerce"), to_dt(s)
        if pd.isna(v):
            raise DataError(f"'{value}' is not a valid date.")
    else:
        if op not in ("==", "!="):
            raise DataError(f"Operator '{op}' needs a numeric or date column.")
        v, left = str(value), s.astype(str)
    m = {"==": left == v, "!=": left != v, ">": left > v, ">=": left >= v, "<": left < v, "<=": left <= v}[op]
    return df[m.fillna(False)]


def apply_op(df: pd.DataFrame, op: str, p: dict) -> tuple[pd.DataFrame, str]:
    df = df.copy()
    if op == "drop_duplicates":
        subset = p.get("columns") or None
        for c in subset or []:
            _need(df, c)
        out = df.drop_duplicates(subset=subset)
        return out.reset_index(drop=True), f"Removed {len(df) - len(out)} duplicate rows."
    if op == "drop_columns":
        cols = p.get("columns") or []
        if not cols:
            raise DataError("Select at least one column to drop.")
        for c in cols:
            _need(df, c)
        if len(cols) >= len(df.columns):
            raise DataError("You cannot drop every column.")
        return df.drop(columns=cols), f"Dropped {len(cols)} column(s): {', '.join(cols)}."
    if op == "rename_columns":
        mapping = {k: str(v).strip() for k, v in (p.get("mapping") or {}).items() if str(v).strip() and k != v}
        if not mapping:
            raise DataError("Provide at least one new column name.")
        for k in mapping:
            _need(df, k)
        new = [mapping.get(c, c) for c in df.columns]
        if len(set(new)) != len(new):
            raise DataError("Renaming would create duplicate column names.")
        df.columns = new
        return df, f"Renamed {len(mapping)} column(s)."
    if op == "drop_missing":
        subset = p.get("columns") or None
        for c in subset or []:
            _need(df, c)
        out = df.dropna(subset=subset, how=p.get("how", "any"))
        return out.reset_index(drop=True), f"Dropped {len(df) - len(out)} rows with missing values."
    if op == "fill_missing":
        strat = p.get("strategy")
        cols = p.get("columns") or [c for c in df.columns if df[c].isna().any()]
        if not cols:
            raise DataError("There are no missing values to fill.")
        filled = 0
        for c in cols:
            _need(df, c)
            before = int(df[c].isna().sum())
            if strat in ("mean", "median"):
                _need_numeric(df, c)
                df[c] = df[c].fillna(df[c].mean() if strat == "mean" else df[c].median())
            elif strat == "mode":
                m = df[c].mode(dropna=True)
                if len(m):
                    df[c] = df[c].fillna(m.iloc[0])
            elif strat == "constant":
                v = p.get("value")
                if v in (None, ""):
                    raise DataError("Enter a value to fill with.")
                if kind_of(df[c]) == "numeric":
                    try:
                        v = float(v)
                    except ValueError:
                        raise DataError(f"'{c}' is numeric; '{v}' is not a number.")
                df[c] = df[c].fillna(v)
            elif strat in ("ffill", "bfill"):
                df[c] = df[c].ffill() if strat == "ffill" else df[c].bfill()
            else:
                raise DataError("Unknown fill strategy.")
            filled += before - int(df[c].isna().sum())
        return df, f"Filled {filled} missing cells using {strat}."
    if op == "convert_type":
        c, to = _need(df, p.get("column")), p.get("to")
        before = int(df[c].isna().sum())
        if to == "numeric":
            conv = pd.to_numeric(df[c], errors="coerce")
        elif to == "datetime":
            conv = to_dt(df[c])
        elif to in ("text", "category"):
            conv = df[c].astype("string").astype(object).where(df[c].notna(), None)
        else:
            raise DataError("Target type must be numeric, datetime or text.")
        lost = int(conv.isna().sum()) - before
        if to in ("numeric", "datetime") and conv.notna().sum() == 0 and df[c].notna().sum() > 0:
            raise DataError(f"None of the values in '{c}' could be converted to {to}.")
        df[c] = conv
        return df, f"Converted '{c}' to {to}." + (f" {lost} value(s) could not be converted and became missing." if lost > 0 else "")
    if op == "filter_rows":
        out = _filter(df, p.get("column"), p.get("operator"), p.get("value"))
        return out.reset_index(drop=True), f"Kept {len(out)} of {len(df)} rows where {p.get('column')} {p.get('operator')} {p.get('value', '')}."
    if op == "sort":
        c = _need(df, p.get("column"))
        return df.sort_values(c, ascending=bool(p.get("ascending", True)), kind="stable").reset_index(drop=True), f"Sorted by '{c}'."
    if op == "outliers":
        c = _need_numeric(df, p.get("column"))
        method = p.get("method", "iqr")
        if method not in ("iqr", "zscore"):
            raise DataError("Method must be iqr or zscore.")
        k = float(p.get("threshold") or (1.5 if method == "iqr" else 3))
        mask = outlier_mask(df[c], method, k)
        if p.get("action", "flag") == "remove":
            return df[~mask].reset_index(drop=True), f"Removed {int(mask.sum())} outlier rows in '{c}' ({method}, k={k})."
        df[f"{c}_is_outlier"] = mask
        return df, f"Flagged {int(mask.sum())} outliers in '{c}' ({method}, k={k}) in column '{c}_is_outlier'."
    raise DataError(f"Unknown operation '{op}'.")


def affected_columns(df_before, df_after, params) -> list[dict]:
    cols = []
    names = list(params.get("columns") or []) + ([params["column"]] if params.get("column") else [])
    for c in names:
        if c in df_before.columns and c in df_after.columns:
            row = {"column": c}
            for tag, d in (("before", df_before), ("after", df_after)):
                row[tag] = {"missing": int(d[c].isna().sum())}
                if kind_of(d[c]) == "numeric" and d[c].notna().any():
                    row[tag]["mean"] = d[c].mean()
                    row[tag]["median"] = d[c].median()
            cols.append(jsonable(row))
    return cols[:8]


# ---------------------------------------------------------------------- charts
def _num_series_agg(g, ycol, agg):
    return g.size() if (ycol is None or agg == "count") else g[ycol].agg(agg)


def chart_data(df: pd.DataFrame, spec: dict) -> dict:
    for f in spec.get("filters") or []:
        df = _filter(df, f.get("column"), f.get("operator"), f.get("value"))
    if df.empty:
        raise DataError("No rows remain after applying the filters.")
    t, x, y = spec.get("type"), spec.get("x") or None, spec.get("y") or None
    agg = spec.get("agg") or ("count" if not y else "sum")
    if agg not in AGGS:
        raise DataError(f"Unknown aggregation '{agg}'.")
    limit = max(1, min(int(spec.get("limit") or 20), 100))
    if t in ("bar", "pie"):
        _need(df, x, "X column")
        if y and agg != "count":
            _need_numeric(df, y)
        s = _num_series_agg(df.groupby(x, dropna=True), y, agg).sort_values(ascending=False)
        if s.empty:
            raise DataError(f"'{x}' has no non-missing values.")
        if t == "pie":
            top = s.head(8)
            if len(s) > 8 and agg in ("count", "sum"):
                top = pd.concat([top, pd.Series({"Other": s.iloc[8:].sum()})])
            s = top
        else:
            s = s.head(limit)
        return jsonable({"type": t, "x": x, "y": y, "agg": agg, "total_groups": int(df[x].nunique()),
                         "data": [{"label": str(k), "value": v} for k, v in s.items()]})
    if t == "line":
        _need(df, x, "X column")
        if y and agg != "count":
            _need_numeric(df, y)
        if kind_of(df[x]) == "datetime":
            d = df.assign(**{x: to_dt(df[x])}).dropna(subset=[x]).set_index(x).sort_index()
            span = (d.index.max() - d.index.min()).days
            freq = spec.get("freq") or ("D" if span <= 60 else "W" if span <= 400 else "MS" if span <= 1500 else "YS")
            if freq not in ("D", "W", "MS", "QS", "YS"):
                raise DataError("freq must be D, W, MS, QS or YS.")
            rs = d.resample(freq)
            s = rs.size() if (not y or agg == "count") else rs[y].agg(agg)
            if agg in ("mean", "median", "min", "max"):
                s = s.dropna()
            data = [{"label": k.strftime("%Y-%m-%d"), "value": v} for k, v in s.items()]
        else:
            s = _num_series_agg(df.groupby(x, dropna=True), y, agg).sort_index().head(300)
            freq = None
            data = [{"label": str(k), "value": v} for k, v in s.items()]
        return jsonable({"type": t, "x": x, "y": y, "agg": agg, "freq": freq, "data": data})
    if t == "scatter":
        _need_numeric(df, x)
        _need_numeric(df, y)
        d = df[[x, y]].dropna()
        if len(d) > 2000:
            d = d.sample(2000, random_state=0)
        return jsonable({"type": t, "x": x, "y": y, "points": len(d), "data": [{"x": a, "y": b} for a, b in zip(d[x], d[y])]})
    if t == "histogram":
        _need_numeric(df, x)
        v = df[x].dropna()
        if v.empty:
            raise DataError(f"'{x}' has no values.")
        counts, edges = np.histogram(v, bins=max(3, min(int(spec.get("bins") or 12), 100)))
        return jsonable({"type": t, "x": x, "data": [{"label": f"{edges[i]:.4g} – {edges[i + 1]:.4g}", "start": edges[i],
                                                     "end": edges[i + 1], "value": int(counts[i])} for i in range(len(counts))]})
    if t == "box":
        _need_numeric(df, x)
        groups = [(x, df[x].dropna())]
        if y:
            _need(df, y)
            top = df[y].value_counts().head(10).index
            groups = [(str(g), df.loc[df[y] == g, x].dropna()) for g in top]
        out = []
        for name, v in groups:
            if len(v):
                q1, q3 = v.quantile(.25), v.quantile(.75)
                out.append({"label": name, "min": v.min(), "q1": q1, "median": v.median(), "q3": q3, "max": v.max(),
                            "outliers": int(outlier_mask(v).sum())})
        return jsonable({"type": t, "x": x, "group": y, "data": out})
    if t in ("heatmap", "correlation"):
        return correlation(df, spec.get("columns"))
    raise DataError("Unknown chart type. Use bar, line, scatter, histogram, pie, box or heatmap.")


def correlation(df: pd.DataFrame, columns=None) -> dict:
    cols = [c for c in (columns or numeric_cols(df)) if c in df.columns and kind_of(df[c]) == "numeric"][:15]
    if len(cols) < 2:
        raise DataError("A correlation matrix needs at least two numeric columns.")
    m = df[cols].corr(numeric_only=True)
    pairs = [{"a": a, "b": b, "r": m.loc[a, b]} for i, a in enumerate(cols) for b in cols[i + 1:] if pd.notna(m.loc[a, b])]
    pairs.sort(key=lambda p: -abs(p["r"]))
    return jsonable({"type": "heatmap", "columns": cols, "matrix": m.values.tolist(), "pairs": pairs[:10]})


# ------------------------------------------------------------------------- EDA
def eda(df: pd.DataFrame) -> dict:
    prof, insights = profile(df), []
    n = len(df)
    for c in prof["column_info"]:
        if c["missing_pct"] >= 20:
            insights.append(f"'{c['name']}' is missing in {c['missing_pct']}% of rows — consider whether to fill or drop it.")
        if c["kind"] == "numeric" and c.get("outliers_iqr"):
            insights.append(f"'{c['name']}' has {c['outliers_iqr']} IQR outliers (min {c['min']:.4g}, max {c['max']:.4g}).")
        if c["kind"] == "numeric" and df[c["name"]].dropna().size > 8:
            sk = df[c["name"]].skew()
            if pd.notna(sk) and abs(sk) > 1:
                insights.append(f"'{c['name']}' is {'right' if sk > 0 else 'left'}-skewed (skewness {sk:.2f}); the median may describe it better than the mean.")
        if c["kind"] in ("categorical", "text") and c.get("top_values") and n:
            t = c["top_values"][0]
            if c["unique"] > 1 and t["count"] / n >= 0.5:
                insights.append(f"'{t['value']}' makes up {100 * t['count'] / n:.0f}% of '{c['name']}'.")
    corr = None
    try:
        corr = correlation(df)
        for p in corr["pairs"]:
            if abs(p["r"]) >= 0.5:
                insights.append(f"'{p['a']}' and '{p['b']}' are {'positively' if p['r'] > 0 else 'negatively'} correlated (r = {p['r']:.2f}). Correlation does not prove causation.")
    except DataError:
        pass
    if prof["duplicates"]:
        insights.append(f"{prof['duplicates']} duplicate rows could inflate counts and sums.")
    return jsonable({"profile_summary": {k: prof[k] for k in ("rows", "columns", "duplicates", "missing_cells", "kinds")},
                     "correlation": corr, "insights": insights[:15]})


# ---------------------------------------------------------------------- report
def report_html(name: str, df: pd.DataFrame, ops: list[dict]) -> str:
    from html import escape as e
    prof, ins = profile(df), eda(df)["insights"]
    def num(v):
        return "" if v is None else f"{v:.4g}"

    rows = "".join(
        "<tr><td>%s</td><td>%s</td><td>%s (%s%%)</td><td>%s</td><td>%s</td><td>%s</td></tr>"
        % (e(c["name"]), c["kind"], c["missing"], c["missing_pct"], c["unique"], num(c.get("mean")), num(c.get("median")))
        for c in prof["column_info"])
    log = "".join(f"<li>{e(o['summary'])}</li>" for o in ops) or "<li>No cleaning steps applied.</li>"
    fnd = "".join(f"<li>{e(i)}</li>" for i in ins) or "<li>No notable issues detected.</li>"
    return (f"<!doctype html><meta charset='utf-8'><title>{e(name)} report</title>"
            "<style>body{font:15px system-ui;max-width:860px;margin:2rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}"
            "td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#eef}</style>"
            f"<h1>Analysis report: {e(name)}</h1><p>{prof['rows']:,} rows × {prof['columns']} columns · "
            f"{prof['missing_cells']:,} missing cells · {prof['duplicates']} duplicate rows (cleaned version)</p>"
            f"<h2>Cleaning steps</h2><ul>{log}</ul><h2>Findings (computed)</h2><ul>{fnd}</ul>"
            f"<h2>Columns</h2><table><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Mean</th><th>Median</th></tr>{rows}</table>")


# ----------------------------------------------------------------------- store
class DatasetStore:
    """Files live at <root>/<user_id>/<uuid>/{original.csv,current.csv,history/}."""

    MAX_HISTORY = 20

    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, uid: int, did: str) -> Path:
        if not ID_RE.fullmatch(did or ""):
            raise DataError("Invalid dataset id.")
        p = (self.root / str(int(uid)) / did).resolve()
        if self.root not in p.parents:
            raise DataError("Invalid dataset path.")
        return p

    def create(self, uid: int, df: pd.DataFrame) -> str:
        did = uuid.uuid4().hex
        p = self.path(uid, did)
        (p / "history").mkdir(parents=True)
        df.to_csv(p / "original.csv", index=False)
        shutil.copyfile(p / "original.csv", p / "current.csv")
        return did

    def load(self, uid, did, version="current") -> pd.DataFrame:
        f = self.path(uid, did) / ("original.csv" if version == "original" else "current.csv")
        if not f.exists():
            raise DataError("Dataset file not found.")
        return pd.read_csv(f, low_memory=False)

    def commit(self, uid, did, df):
        p = self.path(uid, did)
        h = p / "history"
        n = len(list(h.glob("*.csv")))
        shutil.copyfile(p / "current.csv", h / f"{n:04d}.csv")
        for old in sorted(h.glob("*.csv"))[:-self.MAX_HISTORY]:
            old.unlink()
        df.to_csv(p / "current.csv", index=False)

    def undo(self, uid, did) -> bool:
        p = self.path(uid, did)
        files = sorted((p / "history").glob("*.csv"))
        if not files:
            return False
        shutil.copyfile(files[-1], p / "current.csv")
        files[-1].unlink()
        return True

    def reset(self, uid, did):
        p = self.path(uid, did)
        shutil.copyfile(p / "original.csv", p / "current.csv")
        for f in (p / "history").glob("*.csv"):
            f.unlink()

    def delete(self, uid, did):
        shutil.rmtree(self.path(uid, did), ignore_errors=True)
