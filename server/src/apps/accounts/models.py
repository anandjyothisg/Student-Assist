"""
SmartStudent AI — Custom User Model

Replaces Django's default User with an email-based auth model that carries
an explicit role field (admin | teacher | student).
"""

import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.accounts.managers import CustomUserManager


def avatar_upload_path(instance: "User", filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1]
    return f"avatars/{instance.id}.{ext}"


class UserRole(models.TextChoices):
    ADMIN = "admin", _("Administrator")
    TEACHER = "teacher", _("Teacher")
    STUDENT = "student", _("Student")


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model.

    - Primary key: UUID (non-guessable, globally unique)
    - Username field: email (unique)
    - Role: admin | teacher | student
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    email = models.EmailField(
        _("email address"),
        unique=True,
        db_index=True,
    )
    first_name = models.CharField(_("first name"), max_length=150)
    last_name = models.CharField(_("last name"), max_length=150)
    role = models.CharField(
        _("role"),
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.STUDENT,
        db_index=True,
    )
    avatar = models.ImageField(
        _("avatar"),
        upload_to=avatar_upload_path,
        null=True,
        blank=True,
    )
    bio = models.TextField(_("biography"), blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(_("active"), default=True)
    is_staff = models.BooleanField(_("staff status"), default=False)
    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)

    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = CustomUserManager()

    class Meta:
        db_table = "accounts_user"
        verbose_name = _("User")
        verbose_name_plural = _("Users")
        ordering = ["-date_joined"]

    def __str__(self) -> str:
        return f"{self.get_full_name()} <{self.email}>"

    # ------------------------------------------------------------------
    # Name helpers
    # ------------------------------------------------------------------

    def get_full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def get_short_name(self) -> str:
        return self.first_name

    # ------------------------------------------------------------------
    # Role helpers (convenience properties)
    # ------------------------------------------------------------------

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    @property
    def is_teacher(self) -> bool:
        return self.role == UserRole.TEACHER

    @property
    def is_student(self) -> bool:
        return self.role == UserRole.STUDENT
