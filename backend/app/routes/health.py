from fastapi import APIRouter

from app.db import Conn

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health(conn: Conn) -> dict[str, str]:
    conn.execute("SELECT 1")
    return {"status": "ok", "database": "ok"}
