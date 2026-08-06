"""
SmartStudent AI — JWT Authentication Serializers

Covers: custom token claims, registration, logout, password change.
"""

import logging

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.accounts.serializers import UserProfileSerializer

logger = logging.getLogger("apps.accounts")


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
        logger.info(f"New student account created: {user.email}")
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

