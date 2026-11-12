import pytest

from backend import samples, sqllab
from backend.features import embed_url
from backend.dataops import DataError
from .conftest import signup


# --------------------------------------------------------------- samples
def test_samples_are_deterministic_and_consistent():
    a, b = samples.retail(), samples.retail()
    assert a.equals(b) and len(a) == 1500
    assert list(a.columns) == ["order_id", "order_date", "region", "product_category", "product", "sales", "profit", "quantity", "customer_segment"]
    assert set(a.region) == {"North", "South", "East", "West"} and a.order_id.is_unique and a.sales.gt(0).all()
    c = samples.customers()
    assert c.total_sales.sum() == pytest.approx(samples.orders_raw().sales.sum(), rel=1e-6)
    for k in samples.SAMPLES:
        assert len(samples.get(k)) > 50


def test_sample_api(client, auth):
    assert {s["key"] for s in client.get("/api/samples").json()} == set(samples.SAMPLES)
    r = client.get("/api/samples/retail").json()
    assert len(r["rows"]) == 1500 and r["synthetic"] is True
    assert client.get("/api/samples/nope").status_code == 404
    assert client.get("/api/samples/hr/download").text.startswith("employee_id,")
    d = client.post("/api/samples/finance/import", headers=auth).json()["id"]
    assert client.get(f"/api/datasets/{d}/profile", headers=auth).json()["rows"] == 96  # imported sample works in the Workspace


# ------------------------------------------------------------------ SQL
@pytest.mark.parametrize("q", ["DROP TABLE orders", "DELETE FROM orders", "select 1; select 2", "ATTACH DATABASE 'x.db' AS x",
                               "PRAGMA table_info(orders)", "update orders set sales=0", "   ", "insert into orders select * from orders"])
def test_sql_rejects_unsafe_statements(q):
    with pytest.raises(sqllab.SqlError):
        sqllab.run_query(q)


def test_sql_timeout_and_readonly():
    with pytest.raises(sqllab.SqlError, match="too long"):
        sqllab.run_query("with recursive r(n) as (select 1 union all select n+1 from r) select count(*) from r", timeout=0.3)
    assert sqllab.run_query("select count(*) from orders")["rows"] == [[1500]]
    sqllab.run_query("select * from orders limit 1")
    assert sqllab.run_query("select count(*) from orders")["rows"] == [[1500]]  # nothing mutated across requests


def test_sql_results_match_pandas():
    r = sqllab.run_query("select region, round(sum(sales),2) from orders group by region order by region")
    exp = samples.orders_raw().groupby("region").sales.sum().round(2)
    assert [row[0] for row in r["rows"]] == list(exp.index) and [row[1] for row in r["rows"]] == pytest.approx(list(exp.values))


def test_sql_challenge_checking(client, auth):
    cs = client.get("/api/sql/challenges", headers=auth).json()
    assert len(cs) == 8 and "sql" not in cs[0] and not cs[0]["solved"]
    bad = client.post("/api/sql/check", headers=auth, json={"challenge_id": "regions", "query": "select region from orders order by region"}).json()
    assert bad["correct"] is False and "row" in bad["message"]
    ok = client.post("/api/sql/check", headers=auth, json={"challenge_id": "regions", "query": "select distinct region from orders order by region"}).json()
    assert ok["correct"] is True
    assert client.get("/api/sql/challenges", headers=auth).json()[0]["solved"] is True
    assert client.get("/api/summary", headers=auth).json()["sql_solved"] == 1
    assert client.post("/api/sql/run", headers=auth, json={"query": "drop table orders"}).status_code == 400
    assert client.post("/api/sql/run", json={"query": "select 1"}).status_code == 401
    for c in sqllab.CHALLENGES:  # every reference solution passes its own check
        assert sqllab.check(c["id"], c["sql"])["correct"]


# ---------------------------------------------------------------- projects
def test_project_progress_persists_and_is_private(client, auth):
    body = {"checklist": ["a", "b", "a"], "findings": "North leads.", "completed": False}
    assert client.put("/api/projects/excel-sales", headers=auth, json=body).status_code == 200
    client.put("/api/projects/excel-sales", headers=auth, json={**body, "checklist": ["a", "b", "c"], "completed": True})
    p = client.get("/api/projects/progress", headers=auth).json()
    assert p["excel-sales"]["checklist"] == ["a", "b", "c"] and p["excel-sales"]["completed"] is True and p["excel-sales"]["findings"] == "North leads."
    assert client.get("/api/summary", headers=auth).json()["projects_completed"] == 1
    other = signup(client, "b@example.com", "Bob")
    assert client.get("/api/projects/progress", headers=other).json() == {}
    assert client.put("/api/projects/Bad ID", headers=auth, json=body).status_code in (404, 422)


# --------------------------------------------------------------- portfolio
def test_portfolio_privacy_and_validation(client, auth):
    assert client.get("/api/portfolio", headers=auth).json()["slug"] is None
    pf = {"headline": "Aspiring analyst", "skills": ["SQL", " ", "Tableau"], "is_public": False, "links": {"github": "https://github.com/x"},
          "projects": [{"title": "Public one", "findings": "Found X", "public": True, "links": {"tableau": "https://public.tableau.com/views/a/b"}},
                       {"title": "Private one", "public": False}]}
    saved = client.put("/api/portfolio", headers=auth, json=pf).json()
    slug = saved["slug"]
    assert saved["skills"] == ["SQL", "Tableau"]
    assert client.get(f"/api/public/portfolio/{slug}").status_code == 404  # private by default
    client.put("/api/portfolio", headers=auth, json={**pf, "is_public": True})
    pub = client.get(f"/api/public/portfolio/{slug}").json()
    assert pub["name"] == "Ada" and [p["title"] for p in pub["projects"]] == ["Public one"] and "progress" not in pub and "email" not in str(pub)
    client.put("/api/portfolio", headers=auth, json={**pf, "is_public": True, "show_progress": True})
    assert "lessons_completed" in client.get(f"/api/public/portfolio/{slug}").json()["progress"]
    assert client.put("/api/portfolio", headers=auth, json={**pf, "links": {"x": "javascript:alert(1)"}}).status_code == 422
    assert client.put("/api/portfolio", headers=auth, json={**pf, "resume_url": "ftp://x"}).status_code == 422
    assert client.get("/api/portfolio", headers=auth).json()["slug"] == slug  # slug is stable across saves
    client.put("/api/portfolio", headers=auth, json={**pf, "is_public": False})
    assert client.get(f"/api/public/portfolio/{slug}").status_code == 404  # unpublishing works
    assert client.get("/api/public/portfolio/does-not-exist").status_code == 404


# ------------------------------------------------------------------ embeds
@pytest.mark.parametrize("kind,url", [
    ("tableau", "https://public.tableau.com/views/Book1/Sheet1"), ("tableau", "https://public.tableau.com/shared/ABC123?:display_count=n"),
    ("tableau", "https://10ax.online.tableau.com/t/site/views/Wb/Sheet"), ("powerbi", "https://app.powerbi.com/view?r=abc123"),
    ("powerbi", "https://app.powerbi.com/reportEmbed?reportId=1234"),
])
def test_embed_urls_valid(kind, url):
    assert embed_url(kind, url).startswith("https://")


@pytest.mark.parametrize("kind,url", [
    ("tableau", "http://public.tableau.com/views/a/b"), ("tableau", "https://evil.example.com/views/a/b"), ("tableau", "https://public.tableau.com/"),
    ("tableau", "https://public.tableau.com.evil.com/views/a/b"), ("powerbi", "https://evil.com/view?r=1"), ("powerbi", "https://app.powerbi.com/groups/me"),
    ("powerbi", "https://app.powerbi.com/view"), ("tableau", "javascript:alert(1)"), ("tableau", ""),
])
def test_embed_urls_rejected(kind, url):
    with pytest.raises(DataError):
        embed_url(kind, url)


def test_embed_api_crud_and_isolation(client, auth):
    r = client.post("/api/embeds", headers=auth, json={"kind": "tableau", "title": "My viz", "url": "https://public.tableau.com/views/a/b"})
    assert r.status_code == 201 and ":embed=true" in r.json()["embed_url"]
    assert client.post("/api/embeds", headers=auth, json={"kind": "tableau", "title": "x", "url": "https://evil.com/views/a/b"}).status_code == 400
    assert len(client.get("/api/embeds", headers=auth).json()) == 1
    other = signup(client, "b@example.com", "Bob")
    assert client.get("/api/embeds", headers=other).json() == []
    client.delete(f"/api/embeds/{r.json()['id']}", headers=other)
    assert len(client.get("/api/embeds", headers=auth).json()) == 1
    client.delete(f"/api/embeds/{r.json()['id']}", headers=auth)
    assert client.get("/api/embeds", headers=auth).json() == []
