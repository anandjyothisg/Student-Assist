"""
SmartStudent AI — Base Django Settings
Shared across all environments.
"""

import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# Base directory: server/src/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Repository root: server/
SERVER_DIR = BASE_DIR.parent

# Load .env from server/.env
load_dotenv(SERVER_DIR / ".env")

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

ALLOWED_HOSTS: list[str] = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h.strip()]


def env_flag(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


# The older conversation-based assistant API and its generators have no UI and
# duplicate /api/chat/; they stay unmounted unless explicitly enabled.
ENABLE_LEGACY_ASSISTANT_API = env_flag("ENABLE_LEGACY_ASSISTANT_API", False)

# OpenAPI schema / Swagger / ReDoc. Development turns this on; production keeps it off.
ENABLE_API_DOCS = env_flag("ENABLE_API_DOCS", False)

# ---------------------------------------------------------------------------
# Installed Applications
# ---------------------------------------------------------------------------

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "drf_spectacular.plumbing",
]

LOCAL_APPS: list[str] = [
    "apps.core",
    "apps.accounts",
    "apps.academic",
    "apps.documents",
    "apps.assistant",
    "apps.chat",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # Must be before CommonMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ---------------------------------------------------------------------------
# URL Configuration
# ---------------------------------------------------------------------------

ROOT_URLCONF = "config.urls"

# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# WSGI / ASGI
# ---------------------------------------------------------------------------

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Custom user model
AUTH_USER_MODEL = "accounts.User"

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & Media Files
# ---------------------------------------------------------------------------

STATIC_URL = "/static/"
STATIC_ROOT = SERVER_DIR / "static"

MEDIA_URL = "/media/"
MEDIA_ROOT = SERVER_DIR / "media"

# ---------------------------------------------------------------------------
# Default Primary Key
# ---------------------------------------------------------------------------

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "login": "10/min",
        "register": "5/hour",
        "password_reset": "5/hour",
        # Separate from "password_reset" (which gates the email-sending
        # endpoint) so a single legitimate reset — which calls verify-otp
        # and reset-confirm at least once each, often with a retry — never
        # gets rate-limited into locking a user out of their own flow. The
        # OTP model's own per-code attempt-lockout is the real brute-force
        # defense; this is just a secondary safety net.
        "password_reset_verify": "20/hour",
        # Asking the assistant runs an LLM — generous for real use, but bounded.
        "ai": os.environ.get("AI_THROTTLE_RATE", "40/min"),
        # Re-indexing and extraction run the embedder / parsers on the server.
        "indexing": os.environ.get("INDEXING_THROTTLE_RATE", "30/hour"),
        "auth_refresh": "60/min",
    },
}

# ---------------------------------------------------------------------------
# Simple JWT
# ---------------------------------------------------------------------------

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.environ.get("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", "60"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("JWT_REFRESH_TOKEN_LIFETIME_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "TOKEN_OBTAIN_SERIALIZER": "apps.accounts.auth_serializers.SmartStudentTokenObtainPairSerializer",
    "TOKEN_REFRESH_SERIALIZER": "apps.accounts.auth_serializers.SafeTokenRefreshSerializer",
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

CORS_ALLOWED_ORIGINS: list[str] = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

# ---------------------------------------------------------------------------
# drf-spectacular (OpenAPI / Swagger)
# ---------------------------------------------------------------------------

SPECTACULAR_SETTINGS = {
    "TITLE": "SmartStudent AI API",
    "DESCRIPTION": (
        "Production-grade AI Learning Management System API. "
        "Provides endpoints for user management, course delivery, "
        "document ingestion, RAG-powered Q&A, and AI tutoring."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "CONTACT": {"name": "SmartStudent AI Team"},
    "SCHEMA_PATH_PREFIX": r"/api/v[0-9]",
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": False,
}

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------

CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25 minutes soft limit
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # Fair task distribution
CELERY_TASK_ACKS_LATE = True  # Acknowledge only after task completes

# Short socket timeouts on both the broker and result-backend Redis
# connections so a broker/backend outage fails in seconds, not the
# redis-py default of 120s — otherwise a single request that dispatches
# a task can block its thread for minutes when Redis is unreachable.
CELERY_BROKER_TRANSPORT_OPTIONS = {
    "socket_connect_timeout": 3,
    "socket_timeout": 3,
}
CELERY_RESULT_BACKEND_TRANSPORT_OPTIONS = {
    "socket_connect_timeout": 3,
    "socket_timeout": 3,
}

# ---------------------------------------------------------------------------
# Caching (Redis)
# ---------------------------------------------------------------------------

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.environ.get("REDIS_URL", "redis://localhost:6379/2"),
        "TIMEOUT": 300,  # 5 minutes default
    }
}

# ---------------------------------------------------------------------------
# AI / RAG Configuration
# ---------------------------------------------------------------------------

# Ollama
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_LLM_MODEL = os.environ.get("OLLAMA_LLM_MODEL", "llama3.2")
OLLAMA_EMBEDDING_MODEL = os.environ.get("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")
OLLAMA_CONNECT_TIMEOUT = float(os.environ.get("OLLAMA_CONNECT_TIMEOUT", "5"))
OLLAMA_READ_TIMEOUT = float(os.environ.get("OLLAMA_READ_TIMEOUT", "180"))
OLLAMA_KEEP_ALIVE = os.environ.get("OLLAMA_KEEP_ALIVE", "2h")
OLLAMA_NUM_CTX = int(os.environ.get("OLLAMA_NUM_CTX", "8192"))

# ChromaDB — a blank value in .env means "use the default", not "current directory".
CHROMA_DB_PATH = os.environ.get("CHROMA_DB_PATH", "").strip() or str(SERVER_DIR / "chroma_db")
CHROMA_COLLECTION_PREFIX = os.environ.get("CHROMA_COLLECTION_PREFIX", "smartstudent")

# RAG Parameters
RAG_CHUNK_SIZE = int(os.environ.get("RAG_CHUNK_SIZE", "1000"))
RAG_CHUNK_OVERLAP = int(os.environ.get("RAG_CHUNK_OVERLAP", "200"))
RAG_TOP_K_RESULTS = int(os.environ.get("RAG_TOP_K_RESULTS", "6"))
# Cosine distance above which a chunk is considered unrelated to the question.
RAG_MAX_DISTANCE = float(os.environ.get("RAG_MAX_DISTANCE", "0.45"))

# Document processing: "auto" uses Celery when Redis is reachable and otherwise
# indexes in a background thread, "celery" always dispatches, "sync" never does.
DOCUMENT_PROCESSING_MODE = os.environ.get("DOCUMENT_PROCESSING_MODE", "auto").strip().lower() or "auto"

# Authored demo course library (see `manage.py seed_demo`).
DEMO_CONTENT_DIR = SERVER_DIR / "demo_content"

# SentenceTransformer embedding model (used by embedder service)
EMBEDDING_MODEL_NAME = os.environ.get("EMBEDDING_MODEL_NAME", "BAAI/bge-small-en-v1.5")

# ---------------------------------------------------------------------------
# File Upload Limits
# ---------------------------------------------------------------------------

# Non-file request bodies (JSON, form fields) are capped at 5 MB. Uploaded files
# larger than 2.5 MB are spooled to a temporary file instead of held in memory;
# the 50 MB document limit is enforced by MAX_DOCUMENT_SIZE_MB.
DATA_UPLOAD_MAX_MEMORY_SIZE = 5_242_880
FILE_UPLOAD_MAX_MEMORY_SIZE = 2_621_440

ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt"]
MAX_DOCUMENT_SIZE_MB = int(os.environ.get("MAX_DOCUMENT_SIZE_MB", "50"))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] [{levelname}] [{name}] {message}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "simple": {
            "format": "[{levelname}] {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
        "file_general": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": LOG_DIR / "general.log",
            "when": "midnight",
            "backupCount": 5,
            "formatter": "verbose",
            "delay": True,
        },
        "file_errors": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": LOG_DIR / "errors.log",
            "when": "midnight",
            "backupCount": 5,
            "formatter": "verbose",
            "delay": True,
            "level": "ERROR",
        },
        "file_celery": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": LOG_DIR / "celery.log",
            "when": "midnight",
            "backupCount": 3,
            "formatter": "verbose",
            "delay": True,
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file_general"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console", "file_errors"],
            "level": "WARNING",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console", "file_celery"],
            "level": "INFO",
            "propagate": False,
        },
        # App-level loggers — used by all local apps
        "apps": {
            "handlers": ["console", "file_general", "file_errors"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
    "root": {
        "handlers": ["console", "file_general"],
        "level": "WARNING",
    },
}
