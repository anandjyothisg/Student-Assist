"""
SmartStudent AI — Accounts Views

Foundation ViewSets. Full JWT auth views (login, register, logout,
token refresh, password change) will be added in the Auth API phase.
"""

import logging

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, GenericViewSet
from rest_framework import mixins

from apps.accounts.models import User
from apps.accounts.serializers import (
    UserCreateSerializer,
    UserListSerializer,
    UserProfileSerializer,
    UserProfileUpdateSerializer,
    UserPublicSerializer,
)
from apps.core.exceptions import custom_exception_handler
from apps.core.pagination import StandardPagination
from apps.core.permissions import IsAdmin

logger = logging.getLogger("apps.accounts")


class UserViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    """
    Admin-only endpoint for user management.

    list:    GET  /api/v1/accounts/users/
    create:  POST /api/v1/accounts/users/
    retrieve: GET /api/v1/accounts/users/{id}/
    update:  PUT  /api/v1/accounts/users/{id}/
    partial_update: PATCH /api/v1/accounts/users/{id}/
    destroy: DELETE /api/v1/accounts/users/{id}/
    """

    queryset = User.objects.all().order_by("-date_joined")
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return UserListSerializer
        if self.action == "create":
            return UserCreateSerializer
        return UserProfileSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get("role")
        is_active = self.request.query_params.get("is_active")
        search = self.request.query_params.get("search")

        if role:
            qs = qs.filter(role=role)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")
        if search:
            qs = qs.filter(
                models_Q(email__icontains=search)
                | models_Q(first_name__icontains=search)
                | models_Q(last_name__icontains=search)
            )
        return qs

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        instance = self.get_object()
        if instance == request.user:
            return Response(
                {"detail": "You cannot delete your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeViewSet(GenericViewSet):
    """
    Authenticated user's own profile endpoint.

    retrieve: GET   /api/v1/accounts/me/
    update:   PATCH /api/v1/accounts/me/
    """

    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self) -> User:
        return self.request.user

    @action(detail=False, methods=["get"])
    def profile(self, request: Request) -> Response:
        """GET /api/v1/accounts/me/profile/"""
        serializer = UserProfileSerializer(request.user, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["patch"])
    def update_profile(self, request: Request) -> Response:
        """PATCH /api/v1/accounts/me/update_profile/"""
        serializer = UserProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        logger.info(f"User {request.user.email} updated their profile.")
        return Response(
            UserProfileSerializer(request.user, context={"request": request}).data
        )
