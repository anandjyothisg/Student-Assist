"""
SmartStudent AI — document processing dispatch.

Celery + Redis is the production path. For local development and demos the
processing task also runs in a background thread, so an upload is indexed
even when no broker/worker is running.
"""

import logging
import socket
import threading
import time
from urllib.parse import urlparse

from django.conf import settings
from django.db import close_old_connections

logger = logging.getLogger("apps.documents")

_broker_cache = {"at": 0.0, "ok": False}


def broker_available() -> bool:
    now = time.monotonic()
    if _broker_cache["at"] and now - _broker_cache["at"] < 30:
        return _broker_cache["ok"]
    ok = False
    try:
        url = urlparse(settings.CELERY_BROKER_URL)
        with socket.create_connection((url.hostname or "localhost", url.port or 6379), timeout=0.5):
            ok = True
    except OSError:
        ok = False
    _broker_cache.update(at=now, ok=ok)
    return ok


def _run_inline(document_id: str) -> None:
    from apps.documents.tasks import process_document

    try:
        process_document.apply(args=[document_id])
    except Exception:
        logger.exception(f"Inline processing failed for document {document_id}")
    finally:
        close_old_connections()


def dispatch_processing(document_id, *, wait: bool = False) -> str:
    """
    Start processing a document. Returns the mode used: "celery", "thread" or "sync".
    `wait=True` runs synchronously in the caller (used by management commands).
    """
    document_id = str(document_id)
    mode = settings.DOCUMENT_PROCESSING_MODE

    if wait or mode == "sync":
        _run_inline(document_id)
        return "sync"

    if mode == "celery" or (mode == "auto" and broker_available()):
        try:
            from apps.documents.tasks import process_document

            process_document.apply_async(args=[document_id], retry=False, ignore_result=True)
            return "celery"
        except Exception:
            logger.warning(f"Celery dispatch failed for {document_id}; indexing in-process instead.")

    threading.Thread(target=_run_inline, args=(document_id,), daemon=True, name=f"index-{document_id[:8]}").start()
    return "thread"
