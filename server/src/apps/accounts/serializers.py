"""
SmartStudent AI — Accounts Serializers

Foundation serializers. Full JWT auth serializers (login, register,
token refresh, password change) will be added in the Auth API phase.
"""

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.accounts.models import User, UserRole


class UserPublicSerializer(serializers.ModelSerializer):
    """
    Minimal read-only representation.
    Safe to expose in nested serializers (e.g., course.teacher).
    """

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "full_name", "role", "avatar")
        read_only_fields = fields

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name()


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Full profile for the authenticated user (GET /api/v1/auth/me/).
    """

    full_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "avatar",
            "avatar_url",
            "bio",
            "phone_number",
            "department",
            "designation",
            "program",
            "year_of_study",
            "student_number",
            "is_active",
            "date_joined",
            "last_login",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id", "email", "role", "is_active", "date_joined", "last_login", "created_at", "updated_at",
            "department", "designation", "program", "year_of_study", "student_number",
        )

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name()

    def get_avatar_url(self, obj: User) -> str | None:
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
        return None


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Allows the user to update their own profile details."""

    class Meta:
        model = User
        fields = ("first_name", "last_name", "bio", "phone_number", "avatar")

    def validate_first_name(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("First name cannot be blank.")
        return value.strip()

    def validate_last_name(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Last name cannot be blank.")
        return value.strip()


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Admin-only user creation serializer.
    Full public registration will be in the Auth API phase.
    """

    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "role",
            "department",
            "designation",
            "program",
            "year_of_study",
            "student_number",
            "password",
            "confirm_password",
        )

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs.pop("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data: dict) -> User:
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views (admin user management)."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "department",
            "designation",
            "program",
            "year_of_study",
            "student_number",
            "is_active",
            "date_joined",
            "last_login",
        )
        read_only_fields = fields

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name()


class UserAdminUpdateSerializer(serializers.ModelSerializer):
    """Admin-only edits: role, activation and academic profile."""

    class Meta:
        model = User
        fields = (
            "first_name",
            "last_name",
            "role",
            "is_active",
            "department",
            "designation",
            "program",
            "year_of_study",
            "student_number",
        )

    def validate(self, attrs: dict) -> dict:
        request = self.context.get("request")
        if request and self.instance == request.user:
            if attrs.get("role", self.instance.role) != self.instance.role:
                raise serializers.ValidationError({"role": "You can't change your own role."})
            if attrs.get("is_active") is False:
                raise serializers.ValidationError({"is_active": "You can't deactivate your own account."})
        return attrs
