"""
SmartStudent AI — Development Settings
Extends base settings with SQLite, debug tools, and relaxed security.
"""

from .base import *  # noqa: F401, F403

# ---------------------------------------------------------------------------
# Debug
# ---------------------------------------------------------------------------

DEBUG = True

# ---------------------------------------------------------------------------
# Database — SQLite for local development
# ---------------------------------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
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
