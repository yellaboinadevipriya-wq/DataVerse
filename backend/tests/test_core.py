import io
import json

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend import ai, dataops as D
from backend.main import create_app
from .conftest import SALES, signup


def sales_df():
    return pd.read_csv(io.StringIO(SALES))


# ------------------------------------------------------------- parsing
def test_parse_csv_and_excel():
    df = D.parse_upload("a.csv", SALES.encode())
    assert df.shape == (7, 6)
    buf = io.BytesIO()
    sales_df().to_excel(buf, index=False)
    assert D.parse_upload("a.xlsx", buf.getvalue()).shape == (7, 6)


@pytest.mark.parametrize("name,content,msg", [
    ("a.csv", b"", "empty"),
    ("a.txt", b"x", "Unsupported"),
    ("a.csv", b"a,b\n", "no data rows"),
    ("a.xlsx", b"not an excel file", "Could not read"),
    ("a.csv", b"x" * (D.MAX_BYTES + 1), "too large"),
])
def test_invalid_files(name, content, msg):
    with pytest.raises(D.DataError, match=msg):
        D.parse_upload(name, content)


def test_duplicate_and_blank_headers():
    df = D.parse_upload("a.csv", b"a,a,\n1,2,3\n")
    assert list(df.columns) == ["a", "a.1", "column_3"]


# ------------------------------------------------------------ profiling
def test_profile_known_values():
    p = D.profile(sales_df())
    assert (p["rows"], p["columns"], p["duplicates"], p["missing_cells"]) == (7, 6, 1, 2)
    units = next(c for c in p["column_info"] if c["name"] == "units")
    assert units["missing"] == 1 and units["kind"] == "numeric"
    assert units["min"] == 5 and units["max"] == 1000 and units["median"] == 8
    assert units["mean"] == pytest.approx((10 + 5 + 7 + 8 + 8 + 1000) / 6)
    assert next(c for c in p["column_info"] if c["name"] == "date")["kind"] == "datetime"
    assert next(c for c in p["column_info"] if c["name"] == "region")["kind"] == "categorical"
    assert any(i["type"] == "duplicates" for i in p["issues"])


# -------------------------------------------------------------- cleaning
def test_cleaning_ops():
    df = sales_df()
    out, msg = D.apply_op(df, "drop_duplicates", {})
    assert len(out) == 6 and "1 duplicate" in msg
    out, _ = D.apply_op(df, "fill_missing", {"columns": ["units"], "strategy": "median"})
    assert out["units"].isna().sum() == 0 and out.loc[3, "units"] == 8
    out, _ = D.apply_op(df, "drop_missing", {"columns": ["units"]})
    assert len(out) == 6
    out, _ = D.apply_op(df, "rename_columns", {"mapping": {"units": "qty"}})
    assert "qty" in out.columns and "units" not in out.columns
    out, _ = D.apply_op(df, "filter_rows", {"column": "units", "operator": ">", "value": 7})
    assert sorted(out["units"]) == [8, 8, 10, 1000]
    out, _ = D.apply_op(df, "sort", {"column": "units", "ascending": False})
    assert out["units"].iloc[0] == 1000
    out, _ = D.apply_op(df, "outliers", {"column": "units", "action": "remove"})
    assert 1000 not in out["units"].values
    out, _ = D.apply_op(df, "outliers", {"column": "units", "action": "flag"})
    assert out["units_is_outlier"].sum() == 1
    with pytest.raises(D.DataError, match="None of the values"):
        D.apply_op(df, "convert_type", {"column": "region", "to": "numeric"})
    with pytest.raises(D.DataError, match="does not exist"):
        D.apply_op(df, "drop_columns", {"columns": ["nope"]})
    with pytest.raises(D.DataError, match="Unknown operation"):
        D.apply_op(df, "rm -rf", {})


# ---------------------------------------------------------------- charts
def test_chart_data():
    df = sales_df()
    bar = D.chart_data(df, {"type": "bar", "x": "region", "y": "units", "agg": "sum"})
    assert {r["label"]: r["value"] for r in bar["data"]} == {"North": 1017, "South": 21, "East": 0}
    line = D.chart_data(df, {"type": "line", "x": "date", "y": "units", "agg": "sum", "freq": "MS"})
    assert [r["value"] for r in line["data"]] == [15, 7, 1016]
    h = D.chart_data(df, {"type": "histogram", "x": "price", "bins": 3})
    assert sum(r["value"] for r in h["data"]) == 7
    assert len(D.chart_data(df, {"type": "scatter", "x": "units", "y": "price"})["data"]) == 6
    assert D.chart_data(df, {"type": "heatmap"})["columns"] == ["units", "price"]
    assert D.chart_data(df, {"type": "box", "x": "units"})["data"][0]["max"] == 1000
    with pytest.raises(D.DataError, match="numeric column is required"):
        D.chart_data(df, {"type": "scatter", "x": "region", "y": "units"})
    with pytest.raises(D.DataError, match="No rows remain"):
        D.chart_data(df, {"type": "bar", "x": "region", "filters": [{"column": "region", "operator": "==", "value": "Mars"}]})


# ------------------------------------------------------------------- API
def test_auth_required_and_login(client):
    assert client.get("/api/datasets").status_code == 401
    h = signup(client)
    assert client.get("/api/auth/me", headers=h).json()["email"] == "a@example.com"
    assert client.post("/api/auth/register", json={"email": "a@example.com", "password": "password123", "name": "x"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "wrongpass1"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "A@example.com", "password": "password123"})
    assert r.status_code == 200
    client.post("/api/auth/logout", headers=h)
    assert client.get("/api/auth/me", headers=h).status_code == 401
    assert client.post("/api/auth/register", json={"email": "bad", "password": "password123", "name": "x"}).status_code == 422
    assert client.post("/api/auth/register", json={"email": "b@example.com", "password": "short", "name": "x"}).status_code == 422


def test_upload_errors_via_api(client, auth):
    for name, data in [("e.csv", b""), ("x.txt", b"hi"), ("bad.xlsx", b"junk")]:
        r = client.post("/api/datasets", headers=auth, files={"file": (name, data)})
        assert r.status_code == 400 and r.json()["detail"]


def test_dataset_flow_clean_undo_reset_export(client, auth, ds):
    pv = client.get(f"/api/datasets/{ds}/preview?page=1&size=3", headers=auth).json()
    assert pv["total_rows"] == 7 and pv["pages"] == 3 and len(pv["rows"]) == 3
    prev = client.post(f"/api/datasets/{ds}/clean", headers=auth, json={"operation": "drop_duplicates"}).json()
    assert prev["before"]["rows"] == 7 and prev["after"]["rows"] == 6 and prev["applied"] is False
    assert client.get(f"/api/datasets/{ds}", headers=auth).json()["rows"] == 7  # preview did not modify
    client.post(f"/api/datasets/{ds}/clean", headers=auth, json={"operation": "drop_duplicates", "apply": True})
    client.post(f"/api/datasets/{ds}/clean", headers=auth, json={"operation": "fill_missing", "params": {"columns": ["units"], "strategy": "median"}, "apply": True})
    prof = client.get(f"/api/datasets/{ds}/profile", headers=auth).json()
    assert prof["rows"] == 6 and prof["duplicates"] == 0 and prof["missing_cells"] == 1  # only notes left
    assert len(client.get(f"/api/datasets/{ds}", headers=auth).json()["operations"]) == 2
    # original is preserved
    assert client.get(f"/api/datasets/{ds}/preview?version=original", headers=auth).json()["total_rows"] == 7
    # undo restores the median fill step only
    m = client.post(f"/api/datasets/{ds}/undo", headers=auth).json()
    assert len(m["operations"]) == 1
    assert client.get(f"/api/datasets/{ds}/profile", headers=auth).json()["missing_cells"] == 2
    # export of cleaned data opens correctly
    csv = client.get(f"/api/datasets/{ds}/export?format=csv", headers=auth)
    assert len(pd.read_csv(io.StringIO(csv.text))) == 6
    xl = client.get(f"/api/datasets/{ds}/export?format=xlsx&version=original", headers=auth)
    assert len(pd.read_excel(io.BytesIO(xl.content))) == 7
    assert "Analysis report" in client.get(f"/api/datasets/{ds}/report", headers=auth).text
    m = client.post(f"/api/datasets/{ds}/reset", headers=auth).json()
    assert m["rows"] == 7 and m["operations"] == []
    assert client.post(f"/api/datasets/{ds}/undo", headers=auth).status_code == 400


def test_bad_operation_returns_400(client, auth, ds):
    r = client.post(f"/api/datasets/{ds}/clean", headers=auth, json={"operation": "drop_columns", "params": {"columns": ["zzz"]}})
    assert r.status_code == 400 and "does not exist" in r.json()["detail"]
    assert client.post(f"/api/datasets/{ds}/chart", headers=auth, json={"spec": {"type": "pie3d"}}).status_code == 400


def test_data_isolation(client, auth, ds):
    other = signup(client, "b@example.com", "Bob")
    for url in (f"/api/datasets/{ds}", f"/api/datasets/{ds}/preview", f"/api/datasets/{ds}/profile", f"/api/datasets/{ds}/export"):
        assert client.get(url, headers=other).status_code == 404
    assert client.delete(f"/api/datasets/{ds}", headers=other).status_code == 404
    assert client.get("/api/datasets", headers=other).json() == []
    assert client.post("/api/analyses", headers=other, json={"dataset_id": ds, "title": "x", "config": {}}).status_code == 404
    assert client.get("/api/datasets/../../etc/passwd", headers=auth).status_code == 404


def test_save_and_reopen_analysis_after_restart(env):
    c1 = TestClient(create_app())
    h = signup(c1)
    d = c1.post("/api/datasets", headers=h, files={"file": ("s.csv", SALES)}).json()["id"]
    cfg = {"chart": {"type": "bar", "x": "region", "y": "units", "agg": "sum"}}
    aid = c1.post("/api/analyses", headers=h, json={"dataset_id": d, "title": "Units by region", "config": cfg}).json()["id"]
    c1.app.state.db.close()
    c2 = TestClient(create_app())  # simulated restart: same DB + storage on disk
    lst = c2.get("/api/analyses", headers=h).json()
    assert lst[0]["title"] == "Units by region" and lst[0]["config"] == cfg and lst[0]["dataset_name"] == "s.csv"
    assert c2.get(f"/api/analyses/{aid}", headers=h).json()["config"] == cfg
    assert c2.post(f"/api/datasets/{d}/chart", headers=h, json={"spec": cfg["chart"]}).status_code == 200


def test_progress_quiz_and_summary(client, auth):
    client.post("/api/progress/lessons", headers=auth, json={"lesson_id": "intro-analytics"})
    client.post("/api/progress/lessons", headers=auth, json={"lesson_id": "intro-analytics"})
    assert client.post("/api/progress/lessons", headers=auth, json={"lesson_id": "Bad ID!"}).status_code == 422
    client.post("/api/quiz-attempts", headers=auth, json={"lesson_id": "intro-analytics", "score": 3, "total": 3, "answers": [0, 1, 2]})
    assert client.post("/api/quiz-attempts", headers=auth, json={"lesson_id": "x", "score": 5, "total": 3, "answers": []}).status_code == 422
    p = client.get("/api/progress", headers=auth).json()
    assert [x["lesson_id"] for x in p["completed"]] == ["intro-analytics"] and p["quiz_attempts"][0]["score"] == 3
    s = client.get("/api/summary", headers=auth).json()
    assert s["lessons_completed"] == 1 and s["perfect_quizzes"] == 1 and s["datasets"] == 0


# -------------------------------------------------------------------- AI
def test_ai_offline_without_key(client, auth, ds):
    r = client.post(f"/api/datasets/{ds}/ask", headers=auth, json={"question": "Which region has the most units?"}).json()
    assert r["ai_available"] is False and "offline" in r["message"] and r["answer"] is None
    # non-AI features keep working
    assert client.get(f"/api/datasets/{ds}/profile", headers=auth).status_code == 200


def test_plan_validation_rejects_unsafe_or_wrong_plans():
    df = sales_df()
    for bad in [{"operation": "exec", "params": {"code": "import os"}},
                {"operation": "group_agg", "params": {"group_by": "nope", "value": "units"}},
                {"operation": "group_agg", "params": {"group_by": "region", "value": "region", "agg": "sum"}},
                {"operation": "correlation", "params": {"x": "units", "y": "region"}},
                {"operation": "trend", "params": {"date": "region", "value": "units"}},
                "not a dict"]:
        with pytest.raises(ai.PlanError):
            ai.validate_plan(bad, df)


def test_ai_answer_is_grounded_in_computed_results(monkeypatch):
    df = sales_df()
    prompts = []

    def fake(prompt, json_mode=False, timeout=0):
        prompts.append(prompt)
        if json_mode:
            return json.dumps({"operation": "group_agg", "params": {"group_by": "region", "value": "units", "agg": "sum"}})
        return "North has the highest total units."

    monkeypatch.setattr(ai, "call_gemini", fake)
    r = ai.ask(df, "Which region has the highest units?")
    assert r["answer"] == "North has the highest total units."
    assert r["evidence"]["table"][0] == {"region": "North", "sum_units": 1017.0}
    assert r["chart"]["result"]["data"][0]["label"] == "North"
    assert "1017" in prompts[1] and "2024-01-05" not in prompts[0] + prompts[1]  # only aggregates/schema are sent


def test_ai_unanswerable_and_invalid_plans_do_not_invent(monkeypatch):
    df = sales_df()
    monkeypatch.setattr(ai, "call_gemini", lambda *a, **k: json.dumps({"operation": "unanswerable", "params": {"reason": "No profit column."}}))
    r = ai.ask(df, "What was the profit margin?")
    assert r["answer"] is None and "can't be answered" in r["message"]
    monkeypatch.setattr(ai, "call_gemini", lambda *a, **k: json.dumps({"operation": "correlation", "params": {"x": "units", "y": "ghost"}}))
    r = ai.ask(df, "Correlate units and ghost")
    assert r["answer"] is None and r["evidence"] is None and "safe analysis" in r["message"]


def test_ai_rate_limit_keeps_computed_results(monkeypatch):
    df = sales_df()
    calls = {"n": 0}

    def fake(prompt, json_mode=False, timeout=0):
        calls["n"] += 1
        if json_mode:
            return json.dumps({"operation": "missing", "params": {}})
        raise ai.AIUnavailable("Gemini rate limit reached.")

    monkeypatch.setattr(ai, "call_gemini", fake)
    r = ai.ask(df, "Which columns have missing values?")
    assert r["answer"] is None and "rate limit" in r["message"]
    assert {x["column"]: x["missing"] for x in r["evidence"]["table"]} == {"units": 1, "notes": 1}
