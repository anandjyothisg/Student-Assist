"""
Tests for the password-reset OTP flow and the AiAskView auth-gap regression.

First real pytest-django suite in this repo — kept scoped to the security-
sensitive endpoints touched in this pass.
"""

from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import PasswordResetOTP, User

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def student() -> User:
    return User.objects.create_user(
        email="student@example.com",
        password="OldPassword123!",
        first_name="Stu",
        last_name="Dent",
        role="student",
    )


def _forgot(client: APIClient, email: str):
    return client.post("/api/v1/auth/password/forgot/", {"email": email}, format="json")


def _verify(client: APIClient, email: str, otp: str):
    return client.post(
        "/api/v1/auth/password/verify-otp/", {"email": email, "otp": otp}, format="json"
    )


def _confirm(client: APIClient, email: str, otp: str, new_password: str):
    return client.post(
        "/api/v1/auth/password/reset-confirm/",
        {
            "email": email,
            "otp": otp,
            "new_password": new_password,
            "confirm_password": new_password,
        },
        format="json",
    )


def test_forgot_password_unknown_email_returns_generic_200(api_client):
    res = _forgot(api_client, "nobody@example.com")
    assert res.status_code == 200
    assert "reset code has been sent" in res.data["detail"]


def test_forgot_password_known_email_creates_otp_and_sends_email(api_client, student):
    res = _forgot(api_client, student.email)
    assert res.status_code == 200
    assert PasswordResetOTP.objects.filter(user=student, is_used=False).exists()
    assert len(mail.outbox) == 1
    assert student.email in mail.outbox[0].to


def _issue_otp(student: User) -> str:
    """Bypass email delivery — create the OTP row directly and return the raw code."""
    from django.contrib.auth.hashers import make_password

    from apps.accounts.services import generate_otp

    otp = generate_otp()
    PasswordResetOTP.objects.create(
        user=student,
        otp_hash=make_password(otp),
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    return otp


def test_verify_otp_correct_code_succeeds(api_client, student):
    otp = _issue_otp(student)
    res = _verify(api_client, student.email, otp)
    assert res.status_code == 200


def test_verify_otp_wrong_code_fails_generically(api_client, student):
    _issue_otp(student)
    res = _verify(api_client, student.email, "000000")
    assert res.status_code == 400
    assert res.data["error"]["message"] == "Invalid or expired code."


def test_verify_otp_unknown_email_matches_wrong_code_message(api_client):
    """Same generic message for an unknown email as for a wrong code — no enumeration."""
    res = _verify(api_client, "nobody@example.com", "000000")
    assert res.status_code == 400
    assert res.data["error"]["message"] == "Invalid or expired code."


def test_reset_confirm_sets_new_password_and_login_works(api_client, student):
    otp = _issue_otp(student)
    res = _confirm(api_client, student.email, otp, "NewPassword456!")
    assert res.status_code == 200

    login = api_client.post(
        "/api/v1/auth/login/",
        {"email": student.email, "password": "NewPassword456!"},
        format="json",
    )
    assert login.status_code == 200
    assert "access" in login.data


def test_reset_confirm_rejects_reused_otp(api_client, student):
    otp = _issue_otp(student)
    first = _confirm(api_client, student.email, otp, "NewPassword456!")
    assert first.status_code == 200

    second = _confirm(api_client, student.email, otp, "AnotherPassword789!")
    assert second.status_code == 400


def test_reset_confirm_rejects_expired_otp(api_client, student):
    from django.contrib.auth.hashers import make_password

    from apps.accounts.services import generate_otp

    otp = generate_otp()
    PasswordResetOTP.objects.create(
        user=student,
        otp_hash=make_password(otp),
        expires_at=timezone.now() - timedelta(minutes=1),
    )
    res = _confirm(api_client, student.email, otp, "NewPassword456!")
    assert res.status_code == 400


def test_otp_lockout_after_max_attempts(api_client, student):
    _issue_otp(student)
    for _ in range(PasswordResetOTP.MAX_ATTEMPTS):
        res = _verify(api_client, student.email, "000000")
        assert res.status_code == 400

    # The row is now locked out even with the correct code re-issued fresh
    # attempts wouldn't reset — issuing a new OTP via forgot/ is required.
    otp_row = PasswordResetOTP.objects.filter(user=student).order_by("-created_at").first()
    assert otp_row.attempts >= PasswordResetOTP.MAX_ATTEMPTS
    assert otp_row.is_valid() is False


def test_ai_ask_requires_authentication(api_client):
    """Regression test: the assistant endpoints must not be reachable without a valid JWT."""
    for url in ("/api/chat/ask/", "/api/chat/ask/stream/"):
        res = api_client.post(url, {"question": "test"}, format="json")
        assert res.status_code == 401, url
    # The legacy universal ask endpoint is not mounted unless explicitly enabled.
    assert api_client.post("/api/v1/ai/ask/", {"query": "test"}, format="json").status_code == 404
