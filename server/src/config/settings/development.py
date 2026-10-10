"""
SmartStudent AI — Development Settings
Extends base settings with SQLite, debug tools, and relaxed security.
"""

import os

from .base import *  # noqa: F401, F403

# ---------------------------------------------------------------------------
# Debug
# ---------------------------------------------------------------------------

DEBUG = True

# Development settings must never serve a public host: DEBUG leaks tracebacks and
# settings, and CORS below accepts every origin. Fail loudly instead.
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]", "::1", "testserver", "0.0.0.0"}
_public = [h for h in ALLOWED_HOSTS if h not in _LOCAL_HOSTS]  # noqa: F405
if _public:
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured(
        f"Development settings are running with public ALLOWED_HOSTS {_public}. "
        "Set DJANGO_ENV=production for any non-local deployment."
    )

ENABLE_API_DOCS = env_flag("ENABLE_API_DOCS", True)  # noqa: F405

# ---------------------------------------------------------------------------
# Database — SQLite for local development
# ---------------------------------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        # SQLITE_PATH lets a restored backup be opened without touching the live file.
        "NAME": os.environ.get("SQLITE_PATH") or BASE_DIR / "db.sqlite3",  # noqa: F405
    }
}

# ---------------------------------------------------------------------------
# CORS — Allow all origins in dev
# ---------------------------------------------------------------------------

CORS_ALLOW_ALL_ORIGINS = True

# ---------------------------------------------------------------------------
# Email — Print to console in dev
# ---------------------------------------------------------------------------

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# ---------------------------------------------------------------------------
# Cache — In-memory in dev/test, so login/register/password-reset (which
# use DRF throttling) don't hard-depend on a running Redis server locally.
# Production keeps the Redis-backed cache from base.py.
# ---------------------------------------------------------------------------

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# ---------------------------------------------------------------------------
# DRF — Allow browsable API in dev
# ---------------------------------------------------------------------------

REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]

# ---------------------------------------------------------------------------
# Logging — More verbose in dev
# ---------------------------------------------------------------------------

LOGGING["loggers"]["apps"]["level"] = "DEBUG"  # noqa: F405
LOGGING["loggers"]["django"]["level"] = "DEBUG"  # noqa: F405
# SQL statements are very noisy at DEBUG; opt in with SQL_LOG=1.
LOGGING["loggers"]["django.db.backends"] = {  # noqa: F405
    "handlers": ["console"],
    "level": "DEBUG" if os.environ.get("SQL_LOG") == "1" else "INFO",
    "propagate": False,
}
# Third-party chatter that drowns out application logs.
for _name in ("chromadb", "httpx", "httpcore", "urllib3", "sentence_transformers"):
    LOGGING["loggers"][_name] = {"handlers": ["console"], "level": "WARNING", "propagate": False}  # noqa: F405

# Windows consoles default to cp1252; never let a log line with "→" or "≤" crash a request.
import sys as _sys  # noqa: E402

for _stream in (_sys.stdout, _sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(errors="backslashreplace")
        except Exception:  # pragma: no cover
            pass
