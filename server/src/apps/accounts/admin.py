"""
SmartStudent AI — Accounts Admin Configuration
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from apps.accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Custom admin for the email-based User model."""

    list_display = (
        "email",
        "get_full_name",
        "role",
        "is_active",
        "is_staff",
        "date_joined",
    )
    list_display_links = ("email", "get_full_name")
    list_filter = ("role", "is_active", "is_staff", "date_joined")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("-date_joined",)
    readonly_fields = ("id", "date_joined", "created_at", "updated_at", "last_login")

    # Override default fieldsets to replace username with email
    fieldsets = (
        (None, {"fields": ("id", "email", "password")}),
        (
            _("Personal Info"),
            {"fields": ("first_name", "last_name", "role", "avatar", "bio", "phone_number")},
        ),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            _("Timestamps"),
            {
                "fields": ("date_joined", "last_login", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "role",
                    "password1",
                    "password2",
                ),
            },
        ),
    )

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name()

    get_full_name.short_description = "Full Name"
    get_full_name.admin_order_field = "first_name"
