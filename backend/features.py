"""Samples, SQL lab, guided projects, portfolio and Tableau/Power BI embeds."""
from __future__ import annotations

import json
import re
import secrets
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator

from . import dataops as D
from . import samples, sqllab

ID = r"^[a-z0-9\-]{1,60}$"


def _now():
    return datetime.now(timezone.utc).isoformat()


def clean_url(u: str, allow_empty=True) -> str:
    u = (u or "").strip()
    if not u:
        if allow_empty:
            return ""
        raise ValueError("A URL is required.")
    p = urlparse(u)
    if p.scheme not in ("http", "https") or not p.netloc or len(u) > 500:
        raise ValueError("Links must start with http:// or https:// (max 500 characters).")
    return u


class SqlBody(BaseModel):
    query: str = Field(max_length=4000)


class SqlCheck(SqlBody):
    challenge_id: str = Field(pattern=ID)


class ProjectBody(BaseModel):
    checklist: list[str] = Field(default=[], max_length=60)
    findings: str = Field(default="", max_length=4000)
    completed: bool = False


class PProject(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    summary: str = Field(default="", max_length=600)
    tools: list[str] = Field(default=[], max_length=15)
    dataset: str = Field(default="", max_length=200)
    methodology: str = Field(default="", max_length=1500)
    findings: str = Field(default="", max_length=1500)
    links: dict[str, str] = {}
    public: bool = False

    @field_validator("links")
    @classmethod
    def _links(cls, v):
        if len(v) > 6:
            raise ValueError("Too many links.")
        return {k[:20]: clean_url(u) for k, u in v.items() if u.strip()}


class PortfolioBody(BaseModel):
    headline: str = Field(default="", max_length=140)
    bio: str = Field(default="", max_length=2000)
    education: str = Field(default="", max_length=500)
    goals: str = Field(default="", max_length=800)
    skills: list[str] = Field(default=[], max_length=40)
    links: dict[str, str] = {}
    resume_url: str = Field(default="", max_length=500)
    is_public: bool = False
    show_progress: bool = False
    projects: list[PProject] = Field(default=[], max_length=20)

    @field_validator("links")
    @classmethod
    def _links(cls, v):
        if len(v) > 6:
            raise ValueError("Too many links.")
        return {k[:20]: clean_url(u) for k, u in v.items() if u.strip()}

    @field_validator("resume_url")
    @classmethod
    def _resume(cls, v):
        return clean_url(v)

    @field_validator("skills")
    @classmethod
    def _skills(cls, v):
        return [s.strip()[:40] for s in v if s.strip()]


class EmbedBody(BaseModel):
    kind: str = Field(pattern="^(tableau|powerbi)$")
    title: str = Field(min_length=1, max_length=100)
    url: str = Field(max_length=500)


def embed_url(kind: str, url: str) -> str:
    """Validate a Tableau/Power BI URL against the supported embed hosts and return the iframe URL."""
    try:
        clean_url(url, allow_empty=False)
    except ValueError as e:
        raise D.DataError(str(e))
    p = urlparse(url.strip())
    host, path = (p.hostname or "").lower(), p.path
    if p.scheme != "https":
        raise D.DataError("Embeds must use https.")
    if kind == "tableau":
        if not (host == "public.tableau.com" or host.endswith(".online.tableau.com")):
            raise D.DataError("Use a Tableau Public (public.tableau.com) or Tableau Cloud (*.online.tableau.com) dashboard URL.")
        if not re.match(r"^/(views|shared|t/[^/]+/views)/", path):
            raise D.DataError("Copy the dashboard's share link: it should contain /views/<workbook>/<sheet> or /shared/<id>.")
        return f"https://{host}{path}?:showVizHome=no&:embed=true"
    if host != "app.powerbi.com":
        raise D.DataError("Use a Power BI report URL on app.powerbi.com.")
    if not (path.startswith("/view") or path.startswith("/reportEmbed")):
        raise D.DataError("Use a 'Publish to web' link (app.powerbi.com/view?r=…) or an organisation embed link (app.powerbi.com/reportEmbed?reportId=…).")
    if not p.query:
        raise D.DataError("The Power BI link is missing its report identifier (the part after '?').")
    return url.strip()


def register(app, db, store, user_dep):
    # ----------------------------------------------------------- samples
    @app.get("/api/samples")
    def sample_list():
        return samples.info()

    @app.get("/api/samples/{key}")
    def sample_get(key: str):
        if key not in samples.SAMPLES:
            raise HTTPException(404, "Unknown sample dataset.")
        df = samples.get(key)
        return {"key": key, "title": samples.SAMPLES[key][0], "synthetic": True, "columns": list(df.columns), "rows": D.records(df)}

    @app.get("/api/samples/{key}/download")
    def sample_download(key: str):
        if key not in samples.SAMPLES:
            raise HTTPException(404, "Unknown sample dataset.")
        return Response(samples.get(key).to_csv(index=False), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="dataverse_{key}_sample.csv"'})

    @app.post("/api/samples/{key}/import", status_code=201)
    def sample_import(key: str, user=Depends(user_dep)):
        if key not in samples.SAMPLES:
            raise HTTPException(404, "Unknown sample dataset.")
        df = samples.get(key)
        did = store.create(user["id"], df)
        db.run("INSERT INTO datasets VALUES(?,?,?,?,?,?,?,?)", (did, user["id"], f"{key}_sample.csv", len(df.to_csv(index=False)), len(df), len(df.columns), _now(), _now()))
        return {"id": did}

    # ----------------------------------------------------------- SQL lab
    @app.get("/api/sql/schema")
    def sql_schema(user=Depends(user_dep)):
        return sqllab.schema()

    @app.get("/api/sql/challenges")
    def sql_challenges(user=Depends(user_dep)):
        solved = {r["lesson_id"] for r in db.all("SELECT lesson_id FROM lesson_progress WHERE user_id=? AND lesson_id LIKE 'sql-%'", (user["id"],))}
        return [{**c, "solved": f"sql-{c['id']}" in solved} for c in sqllab.public_challenges()]

    def sqlerr(fn):
        try:
            return fn()
        except sqllab.SqlError as e:
            raise HTTPException(400, str(e))

    @app.post("/api/sql/run")
    def sql_run(b: SqlBody, user=Depends(user_dep)):
        return sqlerr(lambda: sqllab.run_query(b.query))

    @app.post("/api/sql/check")
    def sql_check(b: SqlCheck, user=Depends(user_dep)):
        r = sqlerr(lambda: sqllab.check(b.challenge_id, b.query))
        if r["correct"]:
            db.run("INSERT OR IGNORE INTO lesson_progress VALUES(?,?,?)", (user["id"], f"sql-{b.challenge_id}", _now()))
        return r

    # ---------------------------------------------------------- projects
    @app.get("/api/projects/progress")
    def project_progress(user=Depends(user_dep)):
        return {r["project_id"]: {"checklist": json.loads(r["checklist"]), "findings": r["findings"], "completed": bool(r["completed"]), "updated_at": r["updated_at"]}
                for r in db.all("SELECT * FROM project_progress WHERE user_id=?", (user["id"],))}

    @app.put("/api/projects/{pid}")
    def project_save(pid: str, b: ProjectBody, user=Depends(user_dep)):
        if not re.match(ID, pid):
            raise HTTPException(404, "Unknown project.")
        db.run("INSERT INTO project_progress VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,project_id) DO UPDATE SET checklist=excluded.checklist, findings=excluded.findings, completed=excluded.completed, updated_at=excluded.updated_at",
               (user["id"], pid, json.dumps(sorted(set(x[:40] for x in b.checklist))), b.findings, int(b.completed), _now()))
        return {"ok": True}

    # --------------------------------------------------------- portfolio
    def slug_for(user) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", user["name"].lower()).strip("-")[:30] or "analyst"
        while True:
            s = f"{base}-{secrets.token_hex(2)}"
            if not db.one("SELECT 1 FROM portfolios WHERE slug=?", (s,)):
                return s

    def empty_portfolio():
        return PortfolioBody().model_dump()

    @app.get("/api/portfolio")
    def portfolio_get(user=Depends(user_dep)):
        r = db.one("SELECT * FROM portfolios WHERE user_id=?", (user["id"],))
        if not r:
            return {**empty_portfolio(), "slug": None, "updated_at": None}
        return {**json.loads(r["data"]), "slug": r["slug"], "updated_at": r["updated_at"]}

    @app.put("/api/portfolio")
    def portfolio_put(b: PortfolioBody, user=Depends(user_dep)):
        r = db.one("SELECT slug FROM portfolios WHERE user_id=?", (user["id"],))
        slug = r["slug"] if r else slug_for(user)
        db.run("INSERT INTO portfolios VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, is_public=excluded.is_public, updated_at=excluded.updated_at",
               (user["id"], slug, json.dumps(b.model_dump()), int(b.is_public), _now()))
        return {**b.model_dump(), "slug": slug}

    @app.post("/api/portfolio/regenerate-slug")
    def portfolio_slug(user=Depends(user_dep)):
        if not db.one("SELECT 1 FROM portfolios WHERE user_id=?", (user["id"],)):
            raise HTTPException(400, "Save your portfolio first.")
        s = slug_for(user)
        db.run("UPDATE portfolios SET slug=? WHERE user_id=?", (s, user["id"]))
        return {"slug": s}

    @app.get("/api/public/portfolio/{slug}")
    def portfolio_public(slug: str):
        r = db.one("SELECT p.*, u.name, u.id uid FROM portfolios p JOIN users u ON u.id=p.user_id WHERE p.slug=? AND p.is_public=1", (slug,))
        if not r:
            raise HTTPException(404, "This portfolio does not exist or is not public.")
        d = json.loads(r["data"])
        out = {"name": r["name"], "headline": d["headline"], "bio": d["bio"], "education": d["education"], "goals": d["goals"], "skills": d["skills"],
               "links": d["links"], "resume_url": d["resume_url"], "projects": [{k: v for k, v in p.items() if k != "public"} for p in d["projects"] if p.get("public")]}
        if d.get("show_progress"):
            n = lambda sql: db.one(sql, (r["uid"],))["n"]  # noqa: E731
            out["progress"] = {"lessons_completed": n("SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND lesson_id NOT LIKE 'sql-%'"),
                               "sql_challenges_solved": n("SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND lesson_id LIKE 'sql-%'"),
                               "projects_completed": n("SELECT COUNT(*) n FROM project_progress WHERE user_id=? AND completed=1")}
        return out

    # ------------------------------------------------------------ embeds
    @app.get("/api/embeds")
    def embeds_list(user=Depends(user_dep)):
        return [{**r, "embed_url": embed_url(r["kind"], r["url"])} for r in db.all("SELECT * FROM embeds WHERE user_id=? ORDER BY id DESC", (user["id"],))]

    @app.post("/api/embeds", status_code=201)
    def embeds_add(b: EmbedBody, user=Depends(user_dep)):
        eu = embed_url(b.kind, b.url)
        if db.one("SELECT COUNT(*) n FROM embeds WHERE user_id=?", (user["id"],))["n"] >= 20:
            raise HTTPException(400, "You can save up to 20 embeds. Delete one first.")
        eid = db.run("INSERT INTO embeds(user_id,kind,title,url,created_at) VALUES(?,?,?,?,?)", (user["id"], b.kind, b.title.strip(), b.url.strip(), _now()))
        return {"id": eid, "embed_url": eu}

    @app.delete("/api/embeds/{eid}")
    def embeds_delete(eid: int, user=Depends(user_dep)):
        db.run("DELETE FROM embeds WHERE id=? AND user_id=?", (eid, user["id"]))
        return {"ok": True}
