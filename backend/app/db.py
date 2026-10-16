from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def create_pool(database_url: str, timeout: float) -> ConnectionPool:
    return ConnectionPool(
        database_url,
        kwargs={"row_factory": dict_row},
        min_size=1,
        max_size=10,
        timeout=timeout,
        check=ConnectionPool.check_connection,
        open=False,
    )


def init_schema(pool: ConnectionPool) -> None:
    with pool.connection() as conn:
        conn.execute(SCHEMA_PATH.read_text())


def get_conn(request: Request) -> Iterator[Connection]:
    # Commits on clean exit, rolls back if the endpoint raises.
    with request.app.state.pool.connection() as conn:
        yield conn


# scope="function" closes the transaction before the response is sent, so a
# client never sees a 2xx for a write that later fails to commit.
Conn = Annotated[Connection, Depends(get_conn, scope="function")]
