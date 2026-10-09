"""
SmartStudent AI — Settings Package Entry Point

Selects the active settings module from the DJANGO_ENV environment variable.
wsgi.py, asgi.py, manage.py and celery.py all load this package, so web,
worker and management commands always agree on the environment.

Values:
  production   → config.settings.production
  development  → config.settings.development  (default for local work;
                 refuses to start with a public ALLOWED_HOSTS)
"""

import os

_env = os.environ.get("DJANGO_ENV", "development").strip().lower()

if _env == "production":
    from .production import *  # noqa: F401, F403
elif _env in ("development", "dev", "demo", "test"):
    from .development import *  # noqa: F401, F403
else:
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured(f"Unknown DJANGO_ENV {_env!r}; use 'production' or 'development'.")
