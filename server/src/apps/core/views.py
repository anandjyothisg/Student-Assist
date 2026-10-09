"""
SmartStudent AI — infrastructure views (public media, health probes).
"""

import posixpath
from pathlib import Path

from django.conf import settings
from django.http import Http404, JsonResponse
from django.views.decorators.cache import never_cache
from django.views.static import serve

# Only these MEDIA_ROOT sub-folders are public. Course documents are private and
# are served exclusively through the permission-checked download endpoint.
PUBLIC_MEDIA_DIRS = ("avatars", "course_thumbnails")


def public_media(request, path):
    """
    Serve a file from a public media folder.

    The raw path is rejected if it contains any traversal or separator tricks,
    and the resolved file must still live inside one of the public folders, so
    `avatars/../documents/...` (which static.serve would normalise into a private
    file) can never be reached.
    """
    if "\\" in path or "\x00" in path or path.startswith("/"):
        raise Http404
    parts = path.split("/")
    if any(p in ("", ".", "..") for p in parts) or parts[0] not in PUBLIC_MEDIA_DIRS:
        raise Http404
    normalised = posixpath.normpath(path)
    if normalised != path:
        raise Http404
    root = Path(settings.MEDIA_ROOT).resolve()
    target = (root / normalised).resolve()
    allowed = [(root / d).resolve() for d in PUBLIC_MEDIA_DIRS]
    if not any(target.is_relative_to(a) for a in allowed) or not target.is_file():
        raise Http404
    response = serve(request, normalised, document_root=str(root))
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"
    return response


@never_cache
def healthz(request):
    """Liveness: the process is up and can answer HTTP. No dependencies checked."""
    return JsonResponse({"status": "ok"})


@never_cache
def readyz(request):
    """
    Readiness: the database answers. The vector store and language model are
    reported but are not fatal: without the model the assistant still returns
    matching passages, and without vectors it falls back to keyword search.
    """
    from django.db import connection

    checks = {}
    ok = True
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        ok = False

    try:
        from apps.documents.services.vector_store import get_chroma_client

        get_chroma_client().heartbeat()
        checks["vector_store"] = "ok"
    except Exception:
        checks["vector_store"] = "degraded"

    try:
        from apps.core.ai import ollama_status

        st = ollama_status()
        checks["language_model"] = "ok" if st.get("reachable") and st.get("model_available") else "degraded"
    except Exception:
        checks["language_model"] = "degraded"

    return JsonResponse({"status": "ok" if ok else "error", "checks": checks}, status=200 if ok else 503)
