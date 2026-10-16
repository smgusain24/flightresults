import logging
import math
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings
from app.db import create_pool, init_schema
from app.logging_config import configure_logging, request_context_middleware
from app.routes import api, health

logger = logging.getLogger("app")


async def database_unavailable(request: Request, exc: psycopg.OperationalError) -> JSONResponse:
    logger.error(
        "database unavailable",
        extra={"context": {"error_type": type(exc).__name__, "error": str(exc)}},
    )
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})


def _json_safe_float(value: float) -> float | str:
    return value if math.isfinite(value) else str(value)


async def invalid_request(request: Request, exc: RequestValidationError) -> JSONResponse:
    # The JSON parser accepts NaN/Infinity and validation errors echo the rejected
    # input, which strict JSON rendering refuses; send those values as strings.
    errors = jsonable_encoder(exc.errors(), custom_encoder={float: _json_safe_float})
    return JSONResponse(status_code=422, content={"detail": errors})


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        pool = create_pool(settings.database_url, settings.db_pool_timeout)
        # Fail fast: refuse to start if the database is unreachable.
        pool.open(wait=True, timeout=settings.db_pool_timeout)
        init_schema(pool)
        app.state.pool = pool
        logger.info("startup complete")
        try:
            yield
        finally:
            pool.close()

    app = FastAPI(title="Fullstack Template API", lifespan=lifespan)

    # Middleware added last runs first: request logging wraps CORS so that
    # preflight requests are logged too.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    app.middleware("http")(request_context_middleware)

    app.add_exception_handler(psycopg.OperationalError, database_unavailable)
    app.add_exception_handler(RequestValidationError, invalid_request)

    app.include_router(health.router)
    app.include_router(api.router)
    return app


app = create_app()
