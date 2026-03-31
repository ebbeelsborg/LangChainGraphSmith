"""HTTP tests for FastAPI routes (DB and heavy work mocked)."""

from __future__ import annotations

import os
import sys
import types
from unittest.mock import MagicMock, patch

import pytest
from starlette.testclient import TestClient

_MISSING = object()


@pytest.fixture
def client() -> TestClient:
    os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
    # Import after env so app startup sees DATABASE_URL if anything reads it early
    import app as app_module

    return TestClient(app_module.app)


def _mock_db_cm(*, fetchone=_MISSING, fetchall=_MISSING):
    """Context manager returned by patched get_db_conn()."""
    cur = MagicMock()
    if fetchone is not _MISSING:
        cur.fetchone.return_value = fetchone
    if fetchall is not _MISSING:
        cur.fetchall.return_value = fetchall
    cur_cm = MagicMock()
    cur_cm.__enter__.return_value = cur
    cur_cm.__exit__.return_value = False
    conn = MagicMock()
    conn.cursor.return_value = cur_cm
    conn_cm = MagicMock()
    conn_cm.__enter__.return_value = conn
    conn_cm.__exit__.return_value = False
    return conn_cm


def test_healthz(client: TestClient):
    r = client.get("/api/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["backend"] == "FastAPI/Python"


def test_chat_requires_non_empty_query(client: TestClient):
    r = client.post("/api/chat", json={"query": "   "})
    assert r.status_code == 400


def test_chat_success(client: TestClient):
    """Stub `rag` in sys.modules so we never import the real rag stack (fastembed, etc.)."""

    def run_rag(q: str):
        return {
            "answer": "hello",
            "citations": [],
            "retrieval_steps": [],
        }

    rag_mod = types.ModuleType("rag")
    rag_mod.run_rag = run_rag
    with patch.dict(sys.modules, {"rag": rag_mod}):
        r = client.post("/api/chat", json={"query": "reset password"})
    assert r.status_code == 200
    assert r.json()["answer"] == "hello"


@patch("seed.get_db_conn")
def test_seed_status_seeded(mock_get_db, client: TestClient):
    cur = MagicMock()
    cur.fetchone.side_effect = [(3,), (1,)]
    cur_cm = MagicMock()
    cur_cm.__enter__.return_value = cur
    cur_cm.__exit__.return_value = False
    conn = MagicMock()
    conn.cursor.return_value = cur_cm
    conn_cm = MagicMock()
    conn_cm.__enter__.return_value = conn
    conn_cm.__exit__.return_value = False
    mock_get_db.return_value = conn_cm

    r = client.get("/api/seed/status")
    assert r.status_code == 200
    assert r.json() == {
        "seeded": True,
        "document_count": 3,
        "ticket_count": 1,
    }


@patch("seed.run_seed")
def test_seed_post(mock_run_seed, client: TestClient):
    mock_run_seed.return_value = {"ok": True, "inserted": 5}
    r = client.post("/api/seed")
    assert r.status_code == 200
    assert r.json()["ok"] is True


@patch("app.get_db_conn")
def test_get_document_found(mock_get_db, client: TestClient):
    row = {"id": 1, "title": "T", "url": "/u", "content": "c"}
    mock_get_db.return_value = _mock_db_cm(fetchone=row)
    r = client.get("/api/documents/1")
    assert r.status_code == 200
    assert r.json() == row


@patch("app.get_db_conn")
def test_get_document_not_found(mock_get_db, client: TestClient):
    mock_get_db.return_value = _mock_db_cm(fetchone=None)
    r = client.get("/api/documents/99")
    assert r.status_code == 404


@patch("app.get_db_conn")
def test_get_ticket_found(mock_get_db, client: TestClient):
    row = {
        "id": 2,
        "ticket_id": "ZD-1",
        "subject": "S",
        "tags": None,
        "conversation": "[]",
    }
    mock_get_db.return_value = _mock_db_cm(fetchone=row)
    r = client.get("/api/tickets/2")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == 2
    assert body["tags"] == []


@patch("app.get_db_conn")
def test_get_ticket_not_found(mock_get_db, client: TestClient):
    mock_get_db.return_value = _mock_db_cm(fetchone=None)
    r = client.get("/api/tickets/99")
    assert r.status_code == 404


def test_connect_zendesk(client: TestClient):
    r = client.post(
        "/api/integrations/zendesk",
        json={
            "subdomain": "acme",
            "email": "a@b.com",
            "apiToken": "tok",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["demo"] is True


def test_connect_confluence(client: TestClient):
    r = client.post(
        "/api/integrations/confluence",
        json={
            "domain": "acme.atlassian.net",
            "email": "a@b.com",
            "apiToken": "tok",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["demo"] is True


@patch("app.get_db_conn")
def test_list_documents(mock_get_db, client: TestClient):
    rows = [{"id": 1, "title": "A", "url": "/a"}]
    mock_get_db.return_value = _mock_db_cm(fetchall=rows)
    r = client.get("/api/documents")
    assert r.status_code == 200
    assert r.json() == rows


@patch("app.get_db_conn")
def test_list_tickets(mock_get_db, client: TestClient):
    rows = [{"id": 1, "ticket_id": "t1", "subject": "S", "tags": None}]
    mock_get_db.return_value = _mock_db_cm(fetchall=rows)
    r = client.get("/api/tickets")
    assert r.status_code == 200
    assert r.json()[0]["tags"] == []
