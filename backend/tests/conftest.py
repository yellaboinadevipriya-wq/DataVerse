import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="dv-import-")
os.environ.setdefault("DATAVERSE_DB_PATH", os.path.join(_tmp, "import.db"))
os.environ.setdefault("DATAVERSE_STORAGE", os.path.join(_tmp, "storage"))
os.environ.pop("GEMINI_API_KEY", None)

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app

SALES = (
    "date,region,product,units,price,notes\n"
    "2024-01-05,North,Widget,10,2.5,ok\n"
    "2024-01-20,South,Widget,5,2.5,\n"
    "2024-02-03,North,Gadget,7,10,ok\n"
    "2024-02-14,East,Gadget,,10,ok\n"
    "2024-03-01,South,Widget,8,2.5,ok\n"
    "2024-03-01,South,Widget,8,2.5,ok\n"
    "2024-03-15,North,Gizmo,1000,5,big\n"
)


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("DATAVERSE_DB_PATH", str(tmp_path / "t.db"))
    monkeypatch.setenv("DATAVERSE_STORAGE", str(tmp_path / "storage"))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    return tmp_path


@pytest.fixture
def client(env):
    return TestClient(create_app())


def signup(c, email="a@example.com", name="Ada"):
    r = c.post("/api/auth/register", json={"email": email, "password": "password123", "name": name})
    assert r.status_code == 201, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


@pytest.fixture
def auth(client):
    return signup(client)


@pytest.fixture
def ds(client, auth):
    r = client.post("/api/datasets", headers=auth, files={"file": ("sales.csv", SALES, "text/csv")})
    assert r.status_code == 201, r.text
    return r.json()["id"]
