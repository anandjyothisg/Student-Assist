"""
SmartStudent AI — request correlation.

Every request gets an id (the caller's X-Request-ID when it is a sane token,
otherwise a fresh one). It is returned in the response header and stamped on
every log line written while the request is handled, so a user-reported
problem can be traced through the logs.
"""

import contextvars
import logging
import re
import time
import uuid

_request_id = contextvars.ContextVar("request_id", default="-")
_SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")

logger = logging.getLogger("apps.requests")


def current_request_id() -> str:
    return _request_id.get()


class RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = _request_id.get()
        return True


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.headers.get("X-Request-ID", "")
        rid = incoming if _SAFE_ID.match(incoming) else uuid.uuid4().hex[:16]
        token = _request_id.set(rid)
        request.request_id = rid
        started = time.perf_counter()
        try:
            response = self.get_response(request)
            response["X-Request-ID"] = rid
            ms = round((time.perf_counter() - started) * 1000)
            # Method, path (no query string: it can carry search terms), status and timing only.
            if not request.path.startswith(("/healthz", "/readyz")):
                logger.info(f"{request.method} {request.path} {response.status_code} {ms}ms")
            return response
        finally:
            _request_id.reset(token)
