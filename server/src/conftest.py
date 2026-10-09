import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import pytest


@pytest.fixture(autouse=True)
def _sync_email(settings):
    """Send reset emails inline in tests so mail.outbox can be asserted."""
    settings.PASSWORD_RESET_EMAIL_ASYNC = False


@pytest.fixture(autouse=True)
def _clear_cache():
    """
    DRF's ScopedRateThrottle stores request history in the Django cache.
    Without clearing it between tests, throttle-scoped endpoints (login,
    register, password-reset) accumulate hits across the whole test run
    and start returning 429s for unrelated tests.
    """
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()
