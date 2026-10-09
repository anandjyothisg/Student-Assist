"""
SmartStudent AI — JWT Authentication Views

Endpoints:
    POST   /api/v1/auth/register/                Register a new student account
    POST   /api/v1/auth/login/                   Obtain access + refresh tokens
    POST   /api/v1/auth/logout/                  Blacklist refresh token
    POST   /api/v1/auth/token/refresh/            Rotate refresh token → new access token
    GET    /api/v1/auth/me/                      Get current user profile
    PATCH  /api/v1/auth/me/                      Update current user profile
    POST   /api/v1/auth/password/change/          Change current user password
    POST   /api/v1/auth/password/forgot/          Request a password-reset code
    POST   /api/v1/auth/password/verify-otp/      Verify a password-reset code
    POST   /api/v1/auth/password/reset-confirm/   Reset password using a valid code
"""

import logging

from apps.accounts.services import mask_email

from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.auth_serializers import (
    ForgotPasswordSerializer,
    LogoutSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    ResetPasswordConfirmSerializer,
    SmartStudentTokenObtainPairSerializer,
    VerifyResetOtpSerializer,
)
from apps.accounts.serializers import UserProfileSerializer, UserProfileUpdateSerializer

logger = logging.getLogger("apps.accounts")


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


@extend_schema(
    summary="Register",
    description=(
        "Create a new student account. "
        "Returns the user profile alongside fresh access and refresh JWT tokens. "
        "Teachers and administrators can only be created by an admin via /api/v1/accounts/users/."
    ),
    tags=["Authentication"],
    responses={201: UserProfileSerializer},
)
class RegisterView(APIView):
    """POST /api/v1/auth/register/ — Self-registration (students only)."""

    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer  # for drf-spectacular
    throttle_scope = "register"

    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Issue tokens with custom claims
        refresh = RefreshToken.for_user(user)
        refresh["email"] = user.email
        refresh["role"] = user.role
        refresh["full_name"] = user.get_full_name()
        refresh["is_staff"] = user.is_staff

        logger.info(f"[register] New student registered: user {user.pk}")

        return Response(
            {
                "user": UserProfileSerializer(user, context={"request": request}).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@extend_schema(
    summary="Login",
    description=(
        "Authenticate with email and password. "
        "Returns access token (short-lived), refresh token (long-lived), and the full user profile. "
        "The JWT payload contains: user_id, email, role, full_name, is_staff."
    ),
    tags=["Authentication"],
)
class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login/ — Returns access + refresh tokens + user profile."""

    permission_classes = [AllowAny]
    serializer_class = SmartStudentTokenObtainPairSerializer
    throttle_scope = "login"

    def post(self, request: Request, *args, **kwargs) -> Response:
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            # Log email from serializer (after validation)
            email = request.data.get("email", "unknown")
            logger.info(f"[login] User authenticated: {mask_email(email)}")
        return response


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


@extend_schema(
    summary="Logout",
    description=(
        "Blacklist the provided refresh token so it cannot be used to obtain new access tokens. "
        "The client should discard both the access and refresh tokens after calling this endpoint."
    ),
    tags=["Authentication"],
)
class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — Blacklists the refresh token."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        serializer = LogoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info(f"[logout] User logged out: user {request.user.pk}")
        return Response(
            {"detail": "Successfully logged out."},
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Token Refresh (re-exported with Spectacular tags)
# ---------------------------------------------------------------------------


@extend_schema(
    summary="Refresh Token",
    description=(
        "Exchange a valid refresh token for a new access token. "
        "If ROTATE_REFRESH_TOKENS=True (default), a new refresh token is also returned "
        "and the old one is blacklisted."
    ),
    tags=["Authentication"],
)
class SmartStudentTokenRefreshView(TokenRefreshView):
    """POST /api/v1/auth/token/refresh/ — Rotate refresh token → new access token."""

    throttle_scope = "auth_refresh"


# ---------------------------------------------------------------------------
# Me — Current User Profile
# ---------------------------------------------------------------------------


@extend_schema(
    summary="Get My Profile",
    description="Returns the full profile of the currently authenticated user.",
    tags=["Authentication"],
    responses={200: UserProfileSerializer},
)
class MeView(APIView):
    """
    GET  /api/v1/auth/me/ — Returns current user's full profile.
    PATCH /api/v1/auth/me/ — Partially updates current user's profile.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        serializer = UserProfileSerializer(
            request.user, context={"request": request}
        )
        return Response(serializer.data)

    @extend_schema(
        summary="Update My Profile",
        description=(
            "Partially update the authenticated user's own profile. "
            "Email and role cannot be changed through this endpoint."
        ),
        tags=["Authentication"],
        request=UserProfileUpdateSerializer,
        responses={200: UserProfileSerializer},
    )
    def patch(self, request: Request) -> Response:
        serializer = UserProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info(f"[me] Profile updated: user {request.user.pk}")
        return Response(
            UserProfileSerializer(request.user, context={"request": request}).data
        )


# ---------------------------------------------------------------------------
# Password Change
# ---------------------------------------------------------------------------


@extend_schema(
    summary="Change Password",
    description=(
        "Change the authenticated user's password. "
        "Requires the current password for verification. "
        "After a successful change, existing refresh tokens remain valid — "
        "call /auth/logout/ to invalidate them if needed."
    ),
    tags=["Authentication"],
)
class PasswordChangeView(APIView):
    """POST /api/v1/auth/password/change/ — Change authenticated user's password."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info(f"[password_change] Password changed: user {request.user.pk}")
        return Response({"detail": "Password changed successfully."})


# ---------------------------------------------------------------------------
# Password Reset (forgot password) — request / verify / confirm
# ---------------------------------------------------------------------------

# Generic response returned regardless of whether the email is registered.
_FORGOT_PASSWORD_DETAIL = "If an account with that email exists, a reset code has been sent."


@extend_schema(
    summary="Forgot Password",
    description=(
        "Request a password-reset code by email. Always returns a generic "
        "success message, whether or not the email is registered, to avoid "
        "leaking account existence."
    ),
    tags=["Authentication"],
)
class ForgotPasswordView(APIView):
    """POST /api/v1/auth/password/forgot/ — Issue a password-reset OTP."""

    permission_classes = [AllowAny]
    throttle_scope = "password_reset"

    def post(self, request: Request) -> Response:
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": _FORGOT_PASSWORD_DETAIL}, status=status.HTTP_200_OK)


@extend_schema(
    summary="Verify Password Reset Code",
    description=(
        "Check a password-reset code before letting the user proceed to set "
        "a new password. This is a UX-only check — the code is not consumed "
        "here; /password/reset-confirm/ re-validates it as the real check."
    ),
    tags=["Authentication"],
)
class VerifyResetOtpView(APIView):
    """POST /api/v1/auth/password/verify-otp/ — Check a reset code without consuming it."""

    permission_classes = [AllowAny]
    throttle_scope = "password_reset_verify"

    def post(self, request: Request) -> Response:
        serializer = VerifyResetOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"detail": "Code verified."}, status=status.HTTP_200_OK)


@extend_schema(
    summary="Confirm Password Reset",
    description=(
        "Consume a valid password-reset code and set a new password. "
        "Blacklists all outstanding refresh tokens for the account, forcing "
        "re-login on every device."
    ),
    tags=["Authentication"],
)
class ResetPasswordConfirmView(APIView):
    """POST /api/v1/auth/password/reset-confirm/ — Reset the password using a valid code."""

    permission_classes = [AllowAny]
    throttle_scope = "password_reset_verify"

    def post(self, request: Request) -> Response:
        serializer = ResetPasswordConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        logger.info(f"[password_reset] Password reset via OTP: user {user.pk}")
        return Response(
            {"detail": "Password has been reset. Please log in with your new password."},
            status=status.HTTP_200_OK,
        )
