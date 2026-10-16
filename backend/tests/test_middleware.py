import json
import logging
import sys

import pytest

from app.logging_config import JsonFormatter, request_id_var

ALLOWED_ORIGIN = "http://localhost:5173"


# --- request ID -------------------------------------------------------------


def test_response_carries_generated_request_id(client):
    response = client.get("/api/health")

    assert len(response.headers["X-Request-ID"]) == 32


def test_valid_incoming_request_id_is_echoed(client):
    response = client.get("/api/health", headers={"X-Request-ID": "trace-abc.123"})

    assert response.headers["X-Request-ID"] == "trace-abc.123"


@pytest.mark.parametrize("bad_id", ["", "has space", "a" * 129, "inject\"}{"])
def test_invalid_incoming_request_id_is_replaced(client, bad_id):
    response = client.get("/api/health", headers={"X-Request-ID": bad_id})

    assert response.headers["X-Request-ID"] != bad_id
    assert len(response.headers["X-Request-ID"]) == 32


def test_error_responses_also_carry_request_id(client):
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    assert "X-Request-ID" in response.headers


# --- CORS -------------------------------------------------------------------


def test_preflight_from_allowed_origin_is_accepted(client):
    response = client.options(
        "/api/flight-listings",
        headers={"Origin": ALLOWED_ORIGIN, "Access-Control-Request-Method": "POST"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_preflight_from_unknown_origin_is_rejected(client):
    response = client.options(
        "/api/flight-listings",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"},
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_request_id_header_is_exposed_to_browser(client):
    response = client.get("/api/health", headers={"Origin": ALLOWED_ORIGIN})

    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "x-request-id" in response.headers["access-control-expose-headers"].lower()


# --- JSON logging -----------------------------------------------------------


def _record(**extra) -> logging.LogRecord:
    record = logging.LogRecord("app.test", logging.INFO, __file__, 1, "hello %s", ("world",), None)
    for key, value in extra.items():
        setattr(record, key, value)
    return record


def test_formatter_emits_required_fields_with_correlation_id():
    line = JsonFormatter().format(_record(correlation_id="req-1", context={"path": "/api/health"}))

    payload = json.loads(line)
    assert payload["message"] == "hello world"
    assert payload["level"] == "INFO"
    assert payload["logger"] == "app.test"
    assert payload["correlation_id"] == "req-1"
    assert payload["path"] == "/api/health"
    assert payload["timestamp"].endswith("+00:00")


def test_record_created_inside_request_context_captures_correlation_id(client):
    token = request_id_var.set("req-2")
    try:
        record = logging.getLogger("app.test").makeRecord(
            "app.test", logging.INFO, __file__, 1, "msg", (), None
        )
    finally:
        request_id_var.reset(token)

    assert json.loads(JsonFormatter().format(record))["correlation_id"] == "req-2"


def test_record_created_outside_request_has_null_correlation_id(client):
    record = logging.getLogger("app.test").makeRecord(
        "app.test", logging.INFO, __file__, 1, "msg", (), None
    )

    assert json.loads(JsonFormatter().format(record))["correlation_id"] is None


def test_formatter_includes_exception_text():
    try:
        raise ValueError("boom")
    except ValueError:
        record = logging.LogRecord(
            "app.test", logging.ERROR, __file__, 1, "failed", (), sys.exc_info()
        )

    payload = json.loads(JsonFormatter().format(record))

    assert "ValueError: boom" in payload["exc_info"]


def test_request_log_line_carries_request_id_and_outcome(client, caplog):
    with caplog.at_level(logging.INFO, logger="app.request"):
        response = client.get("/api/health", headers={"X-Request-ID": "trace-xyz"})

    record = next(r for r in caplog.records if r.name == "app.request")
    assert response.status_code == 200
    assert record.context["status_code"] == 200
    assert record.context["path"] == "/api/health"
    assert record.context["method"] == "GET"
    assert record.correlation_id == "trace-xyz"
