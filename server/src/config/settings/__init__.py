"""
SmartStudent AI — Settings Package Entry Point

Selects the active settings module based on the DJANGO_ENV environment variable.

Values:
  production   → config.settings.production
  development  → config.settings.development  (default)
"""

import os

_env = os.environ.get("DJANGO_ENV", "development").lower()

if _env == "production":
    from .production import *  # noqa: F401, F403
else:
    from .development import *  # noqa: F401, F403
