"""
SmartStudent AI — Authentication URL Patterns

Base path: /api/v1/auth/

Endpoints:
    POST   register/                → RegisterView
    POST   login/                   → LoginView
    POST   logout/                  → LogoutView
    POST   token/refresh/           → SmartStudentTokenRefreshView
    GET    me/                      → MeView (profile read)
    PATCH  me/                      → MeView (profile update)
    POST   password/change/         → PasswordChangeView
    POST   password/forgot/         → ForgotPasswordView
    POST   password/verify-otp/     → VerifyResetOtpView
    POST   password/reset-confirm/  → ResetPasswordConfirmView
"""

from django.urls import path

from apps.accounts.auth_views import (
    ForgotPasswordView,
    LoginView,
    LogoutView,
    MeView,
    PasswordChangeView,
    RegisterView,
    ResetPasswordConfirmView,
    SmartStudentTokenRefreshView,
    VerifyResetOtpView,
)

app_name = "auth"

urlpatterns = [
    # Public endpoints (no auth required)
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),

    # Token management
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token/refresh/", SmartStudentTokenRefreshView.as_view(), name="token-refresh"),

    # Current user
    path("me/", MeView.as_view(), name="me"),
    path("password/change/", PasswordChangeView.as_view(), name="password-change"),

    # Password reset (forgot password)
    path("password/forgot/", ForgotPasswordView.as_view(), name="password-forgot"),
    path("password/verify-otp/", VerifyResetOtpView.as_view(), name="password-verify-otp"),
    path("password/reset-confirm/", ResetPasswordConfirmView.as_view(), name="password-reset-confirm"),
]
