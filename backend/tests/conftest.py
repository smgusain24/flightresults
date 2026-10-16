import os

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app.config import Settings
from app.main import create_app

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://app:app@localhost:5433/app_test"
)


@pytest.fixture(scope="session")
def test_database_url() -> str:
    """Create the test database on first use; tests never touch the dev database."""
    dbname = conninfo_to_dict(TEST_DATABASE_URL)["dbname"]
    admin_url = make_conninfo(TEST_DATABASE_URL, dbname="postgres")
    with psycopg.connect(admin_url, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (dbname,)
        ).fetchone()
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(dbname)))
    return TEST_DATABASE_URL


@pytest.fixture
def settings(test_database_url: str) -> Settings:
    return Settings(
        database_url=test_database_url,
        cors_origins="http://localhost:5173",
        db_pool_timeout=2,
    )


@pytest.fixture
def client(settings: Settings):
    app = create_app(settings)
    with TestClient(app) as test_client:
        with app.state.pool.connection() as conn:
            conn.execute("TRUNCATE flights, users RESTART IDENTITY")
        yield test_client
