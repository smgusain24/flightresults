import pytest
from fastapi.testclient import TestClient
from psycopg_pool import PoolTimeout

from app.config import Settings
from app.db import get_conn
from app.main import create_app


def test_health_reports_database_ok(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_returns_503_when_pool_is_closed(client):
    client.app.state.pool.close()

    response = client.get("/api/health")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_health_returns_503_when_pool_times_out(client):
    def timed_out():
        raise PoolTimeout("couldn't get a connection after 2.00 sec")
        yield  # pragma: no cover

    client.app.dependency_overrides[get_conn] = timed_out

    response = client.get("/api/health")

    assert response.status_code == 503


def test_startup_fails_fast_when_database_is_unreachable():
    app = create_app(
        Settings(database_url="postgresql://app:app@localhost:1/app", db_pool_timeout=1)
    )

    with pytest.raises(PoolTimeout):
        with TestClient(app):
            pass
