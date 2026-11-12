from __future__ import annotations

import hashlib
import io
import json
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from . import ai, features
from . import dataops as D
from .db import Database

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SESSION_DAYS = 7
LANGS = {"en": "English", "te": "Telugu", "hi": "Hindi"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Register(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(min_length=8, max_length=200)
    name: str = Field(min_length=1, max_length=80)


class Login(BaseModel):
    email: str
    password: str


class Profile(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    language: str | None = None


class CleanBody(BaseModel):
    operation: str
    params: dict[str, Any] = {}
    apply: bool = False


class ChartBody(BaseModel):
    spec: dict[str, Any]


class AskBody(BaseModel):
    question: str = Field(max_length=500)


class AnalysisBody(BaseModel):
    dataset_id: str | None = None
    title: str = Field(min_length=1, max_length=120)
    config: dict[str, Any]


class LessonBody(BaseModel):
    lesson_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9\-]+$")


class QuizBody(BaseModel):
    lesson_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9\-]+$")
    score: int = Field(ge=0, le=100)
    total: int = Field(ge=1, le=100)
    answers: list[int] = Field(max_length=100)


def create_app() -> FastAPI:
    load_dotenv()
    db = Database(os.getenv("DATAVERSE_DB_PATH", "backend/dataverse.db"))
    store = D.DatasetStore(os.getenv("DATAVERSE_STORAGE", "backend/storage"))
    hasher = PasswordHasher()
    fails: dict[str, list[float]] = {}

    app = FastAPI(title="DataVerse API", version="2.0")
    app.state.db, app.state.store = db, store
    origins = [o.strip() for o in os.getenv("DATAVERSE_CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",") if o.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"],
                       expose_headers=["Content-Disposition"])

    @app.exception_handler(D.DataError)
    async def data_error(_: Request, e: D.DataError):
        return JSONResponse({"detail": str(e)}, status_code=400)

    # ------------------------------------------------------------------ auth
    def digest(t: str) -> str:
        return hashlib.sha256(t.encode()).hexdigest()

    def new_session(uid: int) -> str:
        tok = secrets.token_urlsafe(32)
        db.run("INSERT INTO sessions VALUES(?,?,?)", (digest(tok), uid, (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat()))
        return tok

    def public(u: dict) -> dict:
        return {"id": u["id"], "email": u["email"], "name": u["name"], "language": u["language"]}

    def user_dep(authorization: str | None = Header(default=None)) -> dict:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "Sign in required.")
        row = db.one("SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?",
                     (digest(authorization[7:].strip()),))
        if not row or row["expires_at"] < now():
            raise HTTPException(401, "Session expired. Please sign in again.")
        return row

    @app.get("/api/health")
    def health():
        return {"status": "ok", "ai_configured": bool(os.getenv("GEMINI_API_KEY", "").strip()), "time": now()}

    @app.post("/api/auth/register", status_code=201)
    def register(b: Register):
        email = b.email.strip().lower()
        if not EMAIL_RE.match(email):
            raise HTTPException(422, "Enter a valid email address.")
        if db.one("SELECT id FROM users WHERE email=?", (email,)):
            raise HTTPException(409, "An account with this email already exists.")
        uid = db.run("INSERT INTO users(email,name,password_hash,created_at) VALUES(?,?,?,?)",
                     (email, b.name.strip(), hasher.hash(b.password), now()))
        return {"token": new_session(uid), "user": public(db.one("SELECT * FROM users WHERE id=?", (uid,)))}

    @app.post("/api/auth/login")
    def login(b: Login):
        email = b.email.strip().lower()
        recent = [t for t in fails.get(email, []) if time.time() - t < 300]
        if len(recent) >= 8:
            raise HTTPException(429, "Too many failed attempts. Try again in a few minutes.")
        u = db.one("SELECT * FROM users WHERE email=?", (email,))
        try:
            if not u:
                raise VerifyMismatchError()
            hasher.verify(u["password_hash"], b.password)
        except (VerifyMismatchError, InvalidHashError):
            fails[email] = recent + [time.time()]
            raise HTTPException(401, "Incorrect email or password.")
        fails.pop(email, None)
        return {"token": new_session(u["id"]), "user": public(u)}

    @app.post("/api/auth/logout")
    def logout(authorization: str | None = Header(default=None), user=Depends(user_dep)):
        db.run("DELETE FROM sessions WHERE token_hash=?", (digest(authorization[7:].strip()),))
        return {"ok": True}

    @app.get("/api/auth/me")
    def me(user=Depends(user_dep)):
        return public(user)

    @app.patch("/api/auth/me")
    def update_me(b: Profile, user=Depends(user_dep)):
        if b.language is not None and b.language not in LANGS:
            raise HTTPException(422, "Unsupported language.")
        db.run("UPDATE users SET name=?, language=? WHERE id=?", (b.name or user["name"], b.language or user["language"], user["id"]))
        return public(db.one("SELECT * FROM users WHERE id=?", (user["id"],)))

    # -------------------------------------------------------------- datasets
    def owned(did: str, user: dict) -> dict:
        if not D.ID_RE.fullmatch(did):
            raise HTTPException(404, "Dataset not found.")
        row = db.one("SELECT * FROM datasets WHERE id=? AND user_id=?", (did, user["id"]))
        if not row:
            raise HTTPException(404, "Dataset not found.")
        return row

    def meta(row: dict) -> dict:
        ops = db.all("SELECT id, operation, summary, created_at FROM dataset_ops WHERE dataset_id=? ORDER BY id", (row["id"],))
        return {**{k: row[k] for k in ("id", "name", "size_bytes", "rows", "cols", "created_at", "updated_at")}, "operations": ops}

    def touch(did: str, df):
        db.run("UPDATE datasets SET rows=?, cols=?, updated_at=? WHERE id=?", (len(df), len(df.columns), now(), did))

    @app.post("/api/datasets", status_code=201)
    async def upload(file: UploadFile = File(...), user=Depends(user_dep)):
        content = await file.read(D.MAX_BYTES + 1)
        df = D.parse_upload(file.filename, content)
        did = store.create(user["id"], df)
        name = Path(file.filename or "dataset").name[:120]
        db.run("INSERT INTO datasets VALUES(?,?,?,?,?,?,?,?)", (did, user["id"], name, len(content), len(df), len(df.columns), now(), now()))
        return {**meta(db.one("SELECT * FROM datasets WHERE id=?", (did,))), "kinds": {c: D.kind_of(df[c]) for c in df.columns}}

    @app.get("/api/datasets")
    def list_datasets(user=Depends(user_dep)):
        return [meta(r) for r in db.all("SELECT * FROM datasets WHERE user_id=? ORDER BY updated_at DESC", (user["id"],))]

    @app.get("/api/datasets/{did}")
    def dataset(did: str, user=Depends(user_dep)):
        return meta(owned(did, user))

    @app.delete("/api/datasets/{did}")
    def delete_dataset(did: str, user=Depends(user_dep)):
        owned(did, user)
        store.delete(user["id"], did)
        db.run("DELETE FROM datasets WHERE id=?", (did,))
        return {"ok": True}

    @app.get("/api/datasets/{did}/preview")
    def preview(did: str, page: int = 1, size: int = 25, version: str = Query("current", pattern="^(current|original)$"), user=Depends(user_dep)):
        owned(did, user)
        return D.preview(store.load(user["id"], did, version), page, size)

    @app.get("/api/datasets/{did}/profile")
    def profile(did: str, user=Depends(user_dep)):
        owned(did, user)
        return D.profile(store.load(user["id"], did))

    @app.get("/api/datasets/{did}/eda")
    def eda(did: str, user=Depends(user_dep)):
        owned(did, user)
        return D.eda(store.load(user["id"], did))

    @app.post("/api/datasets/{did}/clean")
    def clean(did: str, b: CleanBody, user=Depends(user_dep)):
        owned(did, user)
        before = store.load(user["id"], did)
        after, summary = D.apply_op(before, b.operation, b.params)
        result = {"summary": summary, "before": D.snapshot(before), "after": D.snapshot(after),
                  "columns": D.affected_columns(before, after, b.params), "sample": D.records(after.head(8)),
                  "sample_columns": list(after.columns), "applied": False}
        if b.apply:
            store.commit(user["id"], did, after)
            db.run("INSERT INTO dataset_ops(dataset_id,operation,params,summary,created_at) VALUES(?,?,?,?,?)",
                   (did, b.operation, json.dumps(b.params), summary, now()))
            touch(did, after)
            result["applied"] = True
        return result

    @app.post("/api/datasets/{did}/undo")
    def undo(did: str, user=Depends(user_dep)):
        owned(did, user)
        if not store.undo(user["id"], did):
            raise HTTPException(400, "Nothing to undo.")
        last = db.one("SELECT id FROM dataset_ops WHERE dataset_id=? ORDER BY id DESC LIMIT 1", (did,))
        if last:
            db.run("DELETE FROM dataset_ops WHERE id=?", (last["id"],))
        touch(did, store.load(user["id"], did))
        return meta(owned(did, user))

    @app.post("/api/datasets/{did}/reset")
    def reset(did: str, user=Depends(user_dep)):
        owned(did, user)
        store.reset(user["id"], did)
        db.run("DELETE FROM dataset_ops WHERE dataset_id=?", (did,))
        touch(did, store.load(user["id"], did))
        return meta(owned(did, user))

    @app.post("/api/datasets/{did}/chart")
    def chart(did: str, b: ChartBody, user=Depends(user_dep)):
        owned(did, user)
        return D.chart_data(store.load(user["id"], did), b.spec)

    @app.post("/api/datasets/{did}/ask")
    def ask(did: str, b: AskBody, user=Depends(user_dep)):
        owned(did, user)
        return ai.ask(store.load(user["id"], did), b.question)

    @app.get("/api/datasets/{did}/export")
    def export(did: str, format: str = Query("csv", pattern="^(csv|xlsx)$"), version: str = Query("cleaned", pattern="^(cleaned|original)$"),
               user=Depends(user_dep)):
        row = owned(did, user)
        df = store.load(user["id"], did, "original" if version == "original" else "current")
        stem = re.sub(r"[^A-Za-z0-9_.-]+", "_", Path(row["name"]).stem) or "dataset"
        fname = f"{stem}_{version}.{format}"
        if format == "csv":
            body, mime = df.to_csv(index=False).encode("utf-8"), "text/csv"
        else:
            buf = io.BytesIO()
            df.to_excel(buf, index=False, engine="openpyxl")
            body, mime = buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        return Response(body, media_type=mime, headers={"Content-Disposition": f'attachment; filename="{fname}"'})

    @app.get("/api/datasets/{did}/report")
    def report(did: str, user=Depends(user_dep)):
        row = owned(did, user)
        ops = db.all("SELECT summary FROM dataset_ops WHERE dataset_id=? ORDER BY id", (did,))
        html = D.report_html(row["name"], store.load(user["id"], did), ops)
        return Response(html, media_type="text/html", headers={"Content-Disposition": 'attachment; filename="dataverse_report.html"'})

    # -------------------------------------------------------------- analyses
    @app.post("/api/analyses", status_code=201)
    def save_analysis(b: AnalysisBody, user=Depends(user_dep)):
        if b.dataset_id:
            owned(b.dataset_id, user)
        if len(json.dumps(b.config)) > 20000:
            raise HTTPException(422, "Analysis configuration is too large.")
        aid = db.run("INSERT INTO analyses(user_id,dataset_id,title,config,created_at) VALUES(?,?,?,?,?)",
                     (user["id"], b.dataset_id, b.title.strip(), json.dumps(b.config), now()))
        return {"id": aid}

    def analysis_out(r: dict) -> dict:
        return {**r, "config": json.loads(r["config"])}

    @app.get("/api/analyses")
    def list_analyses(user=Depends(user_dep)):
        return [analysis_out(r) for r in db.all(
            "SELECT a.*, d.name AS dataset_name FROM analyses a LEFT JOIN datasets d ON d.id=a.dataset_id WHERE a.user_id=? ORDER BY a.id DESC", (user["id"],))]

    @app.get("/api/analyses/{aid}")
    def get_analysis(aid: int, user=Depends(user_dep)):
        r = db.one("SELECT * FROM analyses WHERE id=? AND user_id=?", (aid, user["id"]))
        if not r:
            raise HTTPException(404, "Analysis not found.")
        return analysis_out(r)

    @app.delete("/api/analyses/{aid}")
    def delete_analysis(aid: int, user=Depends(user_dep)):
        db.run("DELETE FROM analyses WHERE id=? AND user_id=?", (aid, user["id"]))
        return {"ok": True}

    # -------------------------------------------------------------- learning
    @app.get("/api/progress")
    def progress(user=Depends(user_dep)):
        return {"completed": db.all("SELECT lesson_id, completed_at FROM lesson_progress WHERE user_id=?", (user["id"],)),
                "quiz_attempts": [{**r, "answers": json.loads(r["answers"])} for r in db.all(
                    "SELECT * FROM quiz_attempts WHERE user_id=? ORDER BY id DESC LIMIT 200", (user["id"],))]}

    @app.post("/api/progress/lessons")
    def complete_lesson(b: LessonBody, user=Depends(user_dep)):
        db.run("INSERT OR IGNORE INTO lesson_progress VALUES(?,?,?)", (user["id"], b.lesson_id, now()))
        return {"ok": True}

    @app.delete("/api/progress/lessons/{lesson_id}")
    def uncomplete_lesson(lesson_id: str, user=Depends(user_dep)):
        db.run("DELETE FROM lesson_progress WHERE user_id=? AND lesson_id=?", (user["id"], lesson_id))
        return {"ok": True}

    @app.post("/api/quiz-attempts", status_code=201)
    def quiz_attempt(b: QuizBody, user=Depends(user_dep)):
        if b.score > b.total:
            raise HTTPException(422, "Score cannot exceed total.")
        aid = db.run("INSERT INTO quiz_attempts(user_id,lesson_id,score,total,answers,created_at) VALUES(?,?,?,?,?,?)",
                     (user["id"], b.lesson_id, b.score, b.total, json.dumps(b.answers), now()))
        return {"id": aid}

    @app.get("/api/summary")
    def summary(user=Depends(user_dep)):
        uid = user["id"]
        one = lambda sql: db.one(sql, (uid,))["n"]  # noqa: E731
        return {"datasets": one("SELECT COUNT(*) n FROM datasets WHERE user_id=?"),
                "analyses": one("SELECT COUNT(*) n FROM analyses WHERE user_id=?"),
                "lessons_completed": one("SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND lesson_id NOT LIKE 'sql-%'"),
                "quiz_attempts": one("SELECT COUNT(*) n FROM quiz_attempts WHERE user_id=?"),
                "perfect_quizzes": one("SELECT COUNT(*) n FROM quiz_attempts WHERE user_id=? AND score=total"),
                "sql_solved": one("SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND lesson_id LIKE 'sql-%'"),
                "projects_completed": one("SELECT COUNT(*) n FROM project_progress WHERE user_id=? AND completed=1"),
                "cleaning_steps": one("SELECT COUNT(*) n FROM dataset_ops o JOIN datasets d ON d.id=o.dataset_id WHERE d.user_id=?")}

    features.register(app, db, store, user_dep)
    return app


app = create_app()
