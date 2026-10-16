import json
import logging
import re
import sys
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone

from fastapi import Request

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")

logger = logging.getLogger("app.request")

_base_record_factory = logging.getLogRecordFactory()


def _record_factory(*args, **kwargs) -> logging.LogRecord:
    # Stamp the correlation ID when the record is created, so it survives
    # handlers that format later or on another thread.
    record = _base_record_factory(*args, **kwargs)
    record.correlation_id = request_id_var.get()
    return record


class JsonFormatter(logging.Formatter):
    """One JSON object per line. Pass structured fields via extra={"context": {...}}."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", None),
        }
        payload.update(getattr(record, "context", {}))
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str) -> None:
    logging.setLogRecordFactory(_record_factory)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)

    # Route uvicorn's server logs through the JSON handler. Its access log is
    # silenced because request_context_middleware logs each request with its
    # correlation ID.
    for name in ("uvicorn", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True
    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers = []
    access_logger.propagate = False


async def request_context_middleware(request: Request, call_next):
    incoming = request.headers.get("x-request-id", "")
    request_id = incoming if _VALID_REQUEST_ID.match(incoming) else uuid.uuid4().hex
    request_id_var.set(request_id)

    context = {"method": request.method, "path": request.url.path}
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        context["duration_ms"] = round((time.perf_counter() - start) * 1000, 2)
        logger.exception("request failed", extra={"context": context})
        raise

    context["status_code"] = response.status_code
    context["duration_ms"] = round((time.perf_counter() - start) * 1000, 2)
    logger.info("request completed", extra={"context": context})
    response.headers["X-Request-ID"] = request_id
    return response
