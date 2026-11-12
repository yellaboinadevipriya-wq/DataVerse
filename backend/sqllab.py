"""Safe SQL practice: read-only, single-statement, time-limited queries on an in-memory copy of the sample tables."""
from __future__ import annotations

import re
import sqlite3
import time
from functools import lru_cache

from . import dataops as D
from . import samples

ALLOWED_ACTIONS = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, getattr(sqlite3, "SQLITE_RECURSIVE", 33)}


class SqlError(ValueError):
    pass


@lru_cache(maxsize=1)
def _master() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:", check_same_thread=False)
    samples.customers_raw().to_sql("customers", c, index=False)
    samples.orders_raw().to_sql("orders", c, index=False)
    samples.hr().to_sql("employees", c, index=False)
    return c


def schema() -> list[dict]:
    m = _master()
    out = []
    for (t,) in m.execute("select name from sqlite_master where type='table' order by name"):
        cols = [{"name": r[1], "type": r[2]} for r in m.execute(f"pragma table_info({t})")]
        out.append({"table": t, "rows": m.execute(f"select count(*) from {t}").fetchone()[0], "columns": cols})
    return out


def run_query(sql: str, max_rows: int = 200, timeout: float = 2.0) -> dict:
    q = (sql or "").strip()
    if q.endswith(";"):
        q = q[:-1].strip()
    if not q:
        raise SqlError("Enter a query first.")
    if len(q) > 4000:
        raise SqlError("Query is too long (4,000 characters max).")
    if ";" in q:
        raise SqlError("Only one statement at a time. Remove the extra semicolon.")
    if not re.match(r"^(select|with)\b", q, re.I):
        raise SqlError("Only SELECT queries (optionally starting with WITH) are allowed in the practice database.")
    conn = sqlite3.connect(":memory:")
    try:
        _master().backup(conn)
        conn.execute("PRAGMA query_only=ON")
        conn.set_authorizer(lambda action, *a: sqlite3.SQLITE_OK if action in ALLOWED_ACTIONS else sqlite3.SQLITE_DENY)
        deadline = time.monotonic() + timeout
        conn.set_progress_handler(lambda: 1 if time.monotonic() > deadline else 0, 10000)
        cur = conn.execute(q)
        cols = [d[0] for d in cur.description or []]
        rows = cur.fetchmany(max_rows + 1)
    except sqlite3.Error as e:
        msg = str(e)
        if "interrupted" in msg:
            raise SqlError("The query took too long and was stopped. Try filtering or simplifying it.")
        if "not authorized" in msg:
            raise SqlError("That operation is not allowed in the read-only practice database.")
        raise SqlError(f"SQL error: {msg}")
    finally:
        conn.close()
    return {"columns": cols, "rows": [D.jsonable(list(r)) for r in rows[:max_rows]], "row_count": min(len(rows), max_rows), "truncated": len(rows) > max_rows}


CHALLENGES = [
    {"id": "regions", "title": "List the regions", "level": "Beginner", "prompt": "Return each distinct region from `orders`, sorted A–Z. One column.",
     "hint": "SELECT DISTINCT … ORDER BY.", "sql": "SELECT DISTINCT region FROM orders ORDER BY region", "ordered": True},
    {"id": "sales-by-category", "title": "Sales by category", "level": "Beginner", "prompt": "Total sales per product category (`category`, then the total), highest first. Round the total to 2 decimals.",
     "hint": "GROUP BY category, ROUND(SUM(sales), 2), ORDER BY the total DESC.", "sql": "SELECT category, ROUND(SUM(sales),2) FROM orders GROUP BY category ORDER BY 2 DESC", "ordered": True},
    {"id": "big-orders", "title": "Count large orders", "level": "Beginner", "prompt": "How many orders have sales above 1,000? Return a single number.",
     "hint": "SELECT COUNT(*) … WHERE sales > 1000.", "sql": "SELECT COUNT(*) FROM orders WHERE sales > 1000", "ordered": False},
    {"id": "monthly-2024", "title": "Monthly sales in 2024", "level": "Intermediate", "prompt": "For 2024 only, return `month` (YYYY-MM) and total sales rounded to 2 decimals, in month order.",
     "hint": "strftime('%Y-%m', order_date), WHERE order_date >= '2024-01-01'.", "sql": "SELECT strftime('%Y-%m', order_date) m, ROUND(SUM(sales),2) FROM orders WHERE order_date >= '2024-01-01' GROUP BY m ORDER BY m", "ordered": True},
    {"id": "sales-by-segment", "title": "Sales by customer segment", "level": "Intermediate", "prompt": "Join `orders` to `customers` and return each `segment` with total sales (2 decimals), highest first.",
     "hint": "JOIN customers c ON c.customer_id = o.customer_id.", "sql": "SELECT c.segment, ROUND(SUM(o.sales),2) FROM orders o JOIN customers c ON c.customer_id=o.customer_id GROUP BY c.segment ORDER BY 2 DESC", "ordered": True},
    {"id": "profitable-categories", "title": "Categories with high profit", "level": "Intermediate", "prompt": "Categories whose total profit exceeds 30,000. Return `category` and total profit (2 decimals).",
     "hint": "HAVING filters after GROUP BY.", "sql": "SELECT category, ROUND(SUM(profit),2) FROM orders GROUP BY category HAVING SUM(profit) > 30000", "ordered": False},
    {"id": "top-product-per-category", "title": "Top product in each category", "level": "Advanced", "prompt": "For each category return the product with the highest total sales: `category`, `product`, total sales (2 decimals).",
     "hint": "Aggregate in a CTE, then RANK() OVER (PARTITION BY category ORDER BY total DESC) and keep rank 1.",
     "sql": "WITH t AS (SELECT category, product, SUM(sales) s FROM orders GROUP BY category, product), r AS (SELECT category, product, ROUND(s,2) s, RANK() OVER (PARTITION BY category ORDER BY s DESC) k FROM t) SELECT category, product, s FROM r WHERE k=1", "ordered": False},
    {"id": "attrition-by-dept", "title": "Attrition rate by department", "level": "Advanced", "prompt": "From `employees`: each `department` with the percentage of employees where attrition = 'Yes', rounded to 1 decimal, highest first.",
     "hint": "100.0 * SUM(CASE WHEN attrition='Yes' THEN 1 ELSE 0 END) / COUNT(*).", "sql": "SELECT department, ROUND(100.0*SUM(CASE WHEN attrition='Yes' THEN 1 ELSE 0 END)/COUNT(*),1) FROM employees GROUP BY department ORDER BY 2 DESC", "ordered": True},
]


def public_challenges() -> list[dict]:
    return [{k: c[k] for k in ("id", "title", "level", "prompt", "hint")} for c in CHALLENGES]


def _norm(v):
    return round(float(v), 2) if isinstance(v, (int, float)) and not isinstance(v, bool) else v


def check(cid: str, query: str) -> dict:
    ch = next((c for c in CHALLENGES if c["id"] == cid), None)
    if not ch:
        raise SqlError("Unknown challenge.")
    got, exp = run_query(query, 5000), run_query(ch["sql"], 5000)
    out = {"correct": False, "result": {k: got[k] for k in ("columns", "rows", "row_count", "truncated")}}
    if len(got["columns"]) != len(exp["columns"]):
        out["message"] = f"Your query returns {len(got['columns'])} column(s); this challenge expects {len(exp['columns'])}."
    elif got["row_count"] != exp["row_count"]:
        out["message"] = f"Your query returns {got['row_count']} row(s); {exp['row_count']} expected. Check your filters and grouping."
    else:
        g = [tuple(_norm(v) for v in r) for r in got["rows"]]
        e = [tuple(_norm(v) for v in r) for r in exp["rows"]]
        same = g == e if ch["ordered"] else sorted(g, key=repr) == sorted(e, key=repr)
        if same:
            out.update(correct=True, message="Correct! Your result matches the expected output.")
        else:
            out["message"] = "The right shape, but some values differ" + ("" if not ch["ordered"] else " (or the order is different)") + ". Re-check your aggregation, rounding and sort order."
    return out
