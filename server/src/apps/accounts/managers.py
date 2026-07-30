"""
SmartStudent AI — Custom User Manager

Handles creation of regular users and superusers using email as the
primary identifier instead of Django's default username field.
"""

from django.contrib.auth.base_user import BaseUserManager


class CustomUserManager(BaseUserManager):
    """Manager for the custom User model that uses email as the USERNAME_FIELD."""

    def create_user(self, email: str, password: str | None = None, **extra_fields) -> "User":  # type: ignore[name-defined]  # noqa: F821
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra_fields) -> "User":  # type: ignore[name-defined]  # noqa: F821
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)

    def get_by_natural_key(self, email: str):
        return self.get(**{self.model.USERNAME_FIELD: self.normalize_email(email)})
