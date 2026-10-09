"""
SmartStudent AI — JWT Authentication Serializers

Covers: custom token claims, registration, logout, password change.
"""

import logging

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import PasswordResetOTP, User
from apps.accounts.serializers import UserProfileSerializer
from apps.accounts.services import generate_otp, mask_email, send_password_reset_email_async
from django.db.models import F
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

logger = logging.getLogger("apps.accounts")

# Generic, enumeration-safe error message — never reveals whether an
# email/account exists.
INVALID_OTP_MESSAGE = "Invalid or expired code."
_DUMMY_OTP_HASH = make_password("000000")


class SafeTokenRefreshSerializer(TokenRefreshSerializer):
    """
    simplejwt looks the user up with .get() and lets DoesNotExist escape as a
    500 when the account was deleted. Treat that (and deactivated accounts)
    as an invalid token instead.
    """

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except User.DoesNotExist:
            raise InvalidToken("Token is invalid or expired.")


# ---------------------------------------------------------------------------
# Custom Token — embeds role, email, full_name into JWT payload
# ---------------------------------------------------------------------------


class SmartStudentTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default token serializer to:
    1. Embed user context (role, email, full_name, is_staff) in the JWT payload
       so the frontend can read claims without a separate /me/ call.
    2. Include the full user profile object in the login response body.
    """

    @classmethod
    def get_token(cls, user: User) -> RefreshToken:
        token = super().get_token(user)
        # Custom payload claims
        token["email"] = user.email
        token["role"] = user.role
        token["full_name"] = user.get_full_name()
        token["is_staff"] = user.is_staff
        return token

    def validate(self, attrs: dict) -> dict:
        data = super().validate(attrs)
        # Attach full user profile to the response body
        data["user"] = UserProfileSerializer(
            self.user, context={"request": self.context.get("request")}
        ).data
        return data


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


class RegisterSerializer(serializers.ModelSerializer):
    """
    Public self-registration. Role is always STUDENT.
    Teachers and Admins are created by the admin through /api/v1/accounts/users/.
    """

    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
        help_text="Minimum 8 characters.",
    )
    confirm_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "password",
            "confirm_password",
        )
        extra_kwargs = {
            "email": {"help_text": "Must be a valid, unique email address."},
            "first_name": {"required": True},
            "last_name": {"required": True},
        }

    def validate_email(self, value: str) -> str:
        normalised = value.strip().lower()
        if User.objects.filter(email__iexact=normalised).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalised

    def validate_first_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("First name is required.")
        return value

    def validate_last_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Last name is required.")
        return value

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data: dict) -> User:
        password = validated_data.pop("password")
        user = User(role="student", **validated_data)
        user.set_password(password)
        user.save()
        logger.info(f"New student account created: {mask_email(user.email)}")
        return user


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


class LogoutSerializer(serializers.Serializer):
    """Accepts a refresh token and blacklists it on logout."""

    refresh = serializers.CharField(
        help_text="The refresh token received at login. Will be blacklisted."
    )

    def validate_refresh(self, value: str) -> str:
        try:
            self._token = RefreshToken(value)
        except Exception:
            raise serializers.ValidationError(
                "Invalid or expired refresh token."
            )
        request = self.context.get("request")
        if request and str(self._token.get("user_id")) != str(request.user.id):
            raise serializers.ValidationError("This refresh token belongs to a different user.")
        return value

    def save(self, **kwargs) -> None:
        """Blacklist the validated refresh token."""
        self._token.blacklist()


# ---------------------------------------------------------------------------
# Password Change
# ---------------------------------------------------------------------------


class PasswordChangeSerializer(serializers.Serializer):
    """
    Changes the authenticated user's password.
    Requires the current password for verification.

    Field names match the frontend API call:
        { old_password, new_password, confirm_password }
    """

    old_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
        help_text="Minimum 8 characters.",
    )
    confirm_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )

    def validate_old_password(self, value: str) -> str:
        user: User = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs: dict) -> dict:
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        validate_password(attrs["new_password"], user=self.context["request"].user)
        return attrs

    def save(self, **kwargs) -> User:
        user: User = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])
        return user


# ---------------------------------------------------------------------------
# Password Reset (forgot password) — request / verify / confirm
# ---------------------------------------------------------------------------


OTP_LIFETIME = timedelta(minutes=10)


class ForgotPasswordSerializer(serializers.Serializer):
    """
    Issues a password-reset OTP by email.

    Always "succeeds" from the caller's perspective, whether or not the
    account exists, to avoid leaking which emails are registered.
    """

    email = serializers.EmailField()

    def save(self, **kwargs) -> None:
        email = self.validated_data["email"].strip().lower()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Do the same hashing work as the real path so response time
            # doesn't reveal whether the address has an account.
            make_password(generate_otp())
            logger.info("[password_reset] Forgot-password requested for an unknown email")
            return

        # Invalidate any prior unused codes for this user.
        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)

        otp = generate_otp()
        PasswordResetOTP.objects.create(
            user=user,
            otp_hash=make_password(otp),
            expires_at=timezone.now() + OTP_LIFETIME,
        )
        send_password_reset_email_async(user, otp)
        logger.info(f"[password_reset] OTP issued for: {mask_email(user.email)}")


def _get_valid_otp_or_raise(email: str, otp: str) -> PasswordResetOTP:
    """
    Shared lookup used by both verify-otp and reset-confirm. Always raises
    the same generic error on any failure (unknown email, expired code,
    wrong code, locked-out code) so a caller can't distinguish them.
    """
    try:
        user = User.objects.get(email__iexact=email.strip().lower())
    except User.DoesNotExist:
        check_password(otp, _DUMMY_OTP_HASH)  # equal work for unknown emails
        raise serializers.ValidationError(INVALID_OTP_MESSAGE)

    otp_row = (
        PasswordResetOTP.objects.filter(user=user, is_used=False)
        .order_by("-created_at")
        .first()
    )
    if not otp_row or not otp_row.is_valid():
        raise serializers.ValidationError(INVALID_OTP_MESSAGE)

    # Reserve an attempt atomically *before* checking the code, so parallel
    # guesses can't run past MAX_ATTEMPTS (a read-then-increment would race).
    reserved = PasswordResetOTP.objects.filter(
        pk=otp_row.pk, is_used=False, attempts__lt=PasswordResetOTP.MAX_ATTEMPTS
    ).update(attempts=F("attempts") + 1, updated_at=timezone.now())
    if not reserved:
        raise serializers.ValidationError(INVALID_OTP_MESSAGE)
    if not check_password(otp, otp_row.otp_hash):
        raise serializers.ValidationError(INVALID_OTP_MESSAGE)

    return otp_row


class VerifyResetOtpSerializer(serializers.Serializer):
    """
    UX-only check used by the OTP screen before letting the user proceed
    to set a new password. Does NOT consume the code — reset-confirm
    re-validates it independently as the real security boundary.
    """

    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)

    def validate(self, attrs: dict) -> dict:
        _get_valid_otp_or_raise(attrs["email"], attrs["otp"])
        return attrs


class ResetPasswordConfirmSerializer(serializers.Serializer):
    """
    Consumes a valid OTP and sets a new password. On success, blacklists
    every outstanding JWT for the user — a reset implies the account may
    have been compromised, so all existing sessions are forced to re-login.
    """

    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={"input_type": "password"},
        help_text="Minimum 8 characters.",
    )
    confirm_password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
    )

    def validate(self, attrs: dict) -> dict:
        otp_row = _get_valid_otp_or_raise(attrs["email"], attrs["otp"])
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(attrs["new_password"], user=otp_row.user)
        self._otp_row = otp_row
        return attrs

    def save(self, **kwargs) -> User:
        user = self._otp_row.user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])

        self._otp_row.is_used = True
        self._otp_row.save(update_fields=["is_used", "updated_at"])

        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)

        logger.info(f"[password_reset] Password reset completed for: {mask_email(user.email)}")
        return user

