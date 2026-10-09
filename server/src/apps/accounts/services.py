"""
SmartStudent AI — Accounts Services

Helpers for the password-reset OTP flow (kept out of serializers/views so
the crypto/email concerns are unit-testable in isolation).
"""

import logging
import secrets
import threading

from django.conf import settings
from django.core.mail import send_mail

from apps.accounts.models import User

logger = logging.getLogger("apps.accounts")

OTP_LENGTH = 6


def generate_otp() -> str:
    """Cryptographically random numeric OTP, zero-padded to OTP_LENGTH digits."""
    return "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))


def mask_email(email: str) -> str:
    """j***@example.com — enough to correlate log lines without storing addresses."""
    local, _, domain = (email or "").partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


def send_password_reset_email_async(user: User, otp: str) -> None:
    """
    Send the reset email off the request path. Doing it inline made the
    response for a registered email measurably slower than for an unknown one,
    which let callers discover which addresses have accounts.
    """
    if not getattr(settings, "PASSWORD_RESET_EMAIL_ASYNC", True):
        send_password_reset_email(user, otp)
        return
    threading.Thread(target=send_password_reset_email, args=(user, otp), daemon=True).start()


def send_password_reset_email(user: User, otp: str) -> None:
    subject = "SmartStudent AI — Password Reset Code"
    message = (
        f"Hi {user.get_short_name() or user.email},\n\n"
        f"Your password reset code is: {otp}\n\n"
        "This code expires in 10 minutes. If you didn't request a password "
        "reset, you can safely ignore this email.\n"
    )
    try:
        send_mail(subject, message, None, [user.email], fail_silently=False)
    except Exception:
        # Never let email transport failures leak to the caller — the
        # forgot-password endpoint must always respond generically.
        logger.exception(f"[password_reset] Failed to send reset email to {mask_email(user.email)}")
