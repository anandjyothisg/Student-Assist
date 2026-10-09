"""
SmartStudent AI — Production Settings
Extends base settings with PostgreSQL, full security hardening, and static files.
"""

import os

from .base import *  # noqa: F401, F403

# ---------------------------------------------------------------------------
# Debug — Always False in production
# ---------------------------------------------------------------------------

DEBUG = False

# ---------------------------------------------------------------------------
# Security hardening
# ---------------------------------------------------------------------------

if not ALLOWED_HOSTS:  # noqa: F405
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must list the public host name(s) in production.")

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31_536_000          # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "True") == "True"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# Behind a TLS-terminating reverse proxy (nginx, a load balancer) Django sees
# plain HTTP; trust the proxy's header so SECURE_SSL_REDIRECT doesn't loop.
# Only enable when the proxy always sets (and strips client-sent) X-Forwarded-Proto.
if env_flag("TRUST_X_FORWARDED_PROTO", False):  # noqa: F405
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]

# Browsers may only call the API from the configured web origin(s).
CORS_ALLOW_ALL_ORIGINS = False

# ---------------------------------------------------------------------------
# Database — PostgreSQL
# ---------------------------------------------------------------------------

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["DB_NAME"],
        "USER": os.environ["DB_USER"],
        "PASSWORD": os.environ["DB_PASSWORD"],
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", "60")),
        "OPTIONS": {
            "connect_timeout": 10,
            "options": "-c statement_timeout=30000",  # 30-second query timeout
        },
    }
}

# ---------------------------------------------------------------------------
# Static files — WhiteNoise serves compressed assets without a CDN
# ---------------------------------------------------------------------------

MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# ---------------------------------------------------------------------------
# Email — SMTP (e.g. SendGrid, Mailgun, AWS SES)
# ---------------------------------------------------------------------------

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.sendgrid.net")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "apikey")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "noreply@smartstudentai.com")

# ---------------------------------------------------------------------------
# Logging — Reduce verbosity in production
# ---------------------------------------------------------------------------

LOGGING["loggers"]["apps"]["level"] = "INFO"   # noqa: F405
LOGGING["loggers"]["django"]["level"] = "WARNING"  # noqa: F405