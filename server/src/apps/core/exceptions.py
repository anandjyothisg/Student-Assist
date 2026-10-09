"""
SmartStudent AI — Custom Exception Classes & DRF Exception Handler

Usage in views.py:
    from apps.core.exceptions import PermissionDeniedError, ValidationError

Register in settings:
    REST_FRAMEWORK = {
        "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
    }
"""

import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("apps")


# ---------------------------------------------------------------------------
# Custom Exception Classes
# ---------------------------------------------------------------------------


class SmartStudentBaseException(Exception):
    """Base exception for all SmartStudent AI domain exceptions."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None):
        self.message = message or self.default_message
        super().__init__(self.message)


class DocumentProcessingError(SmartStudentBaseException):
    """Raised when document ingestion or chunking fails."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_message = "Document processing failed."


class UnsupportedFileTypeError(SmartStudentBaseException):
    """Raised when an unsupported file type is uploaded."""

    status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    default_message = "Unsupported file type."


class EmbeddingGenerationError(SmartStudentBaseException):
    """Raised when the embedding model fails to produce vectors."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_message = "Embedding generation failed. Please try again later."


class VectorStoreError(SmartStudentBaseException):
    """Raised when ChromaDB operations fail."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_message = "Vector store operation failed."


class LLMUnavailableError(SmartStudentBaseException):
    """Raised when the Ollama LLM is unreachable or returns an error."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_message = "AI model is currently unavailable. Please try again later."


class EnrollmentError(SmartStudentBaseException):
    """Raised when a student attempts to access a course they're not enrolled in."""

    status_code = status.HTTP_403_FORBIDDEN
    default_message = "You are not enrolled in this course."


class FileSizeExceededError(SmartStudentBaseException):
    """Raised when an uploaded file exceeds the maximum allowed size."""

    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_message = "File size exceeds the maximum allowed limit."


# ---------------------------------------------------------------------------
# DRF Custom Exception Handler
# ---------------------------------------------------------------------------


def custom_exception_handler(exc, context) -> Response | None:
    """
    Wraps all API errors in a consistent JSON shape:

        {
            "success": false,
            "error": {
                "code": "DOCUMENT_PROCESSING_ERROR",
                "message": "Document processing failed.",
                "details": null
            }
        }
    """
    # Let DRF handle standard exceptions first
    response = drf_exception_handler(exc, context)

    if isinstance(exc, SmartStudentBaseException):
        error_code = type(exc).__name__.upper().replace("ERROR", "_ERROR")
        logger.warning(
            f"Domain exception: {error_code} — {exc.message}",
            exc_info=True,
        )
        return Response(
            {
                "success": False,
                "error": {
                    "code": error_code,
                    "message": exc.message,
                    "details": None,
                },
            },
            status=exc.status_code,
        )

    if response is not None:
        error_data = response.data
        message = _extract_message(error_data)

        response.data = {
            "success": False,
            "error": {
                "code": _status_to_code(response.status_code),
                "message": message,
                "details": error_data if isinstance(error_data, dict) else None,
            },
        }

    return response


# ---------------------------------------------------------------------------
# Private Helpers
# ---------------------------------------------------------------------------


def _extract_message(data) -> str:
    if isinstance(data, dict):
        # "detail" / "non_field_errors" carry the primary message. DRF
        # represents both plain-string details (e.g. NotAuthenticated) and
        # list-wrapped serializer validation errors (e.g. ValidationError)
        # under these keys, so both shapes need unwrapping here.
        for key in ("detail", "non_field_errors"):
            if key in data:
                value = data[key]
                if isinstance(value, (list, tuple)) and value:
                    return str(value[0])
                return str(value)

        # Field-level validation errors, e.g. {"email": ["already exists"]}.
        parts = []
        for field, value in data.items():
            message = str(value[0]) if isinstance(value, (list, tuple)) and value else str(value)
            parts.append(f"{field.replace('_', ' ')}: {message}")
        if parts:
            return " | ".join(parts)

        return str(data)
    if isinstance(data, list) and data:
        return str(data[0])
    return str(data)


def _status_to_code(status_code: int) -> str:
    mapping = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        413: "PAYLOAD_TOO_LARGE",
        415: "UNSUPPORTED_MEDIA_TYPE",
        422: "UNPROCESSABLE_ENTITY",
        429: "TOO_MANY_REQUESTS",
        500: "INTERNAL_SERVER_ERROR",
        503: "SERVICE_UNAVAILABLE",
    }
    return mapping.get(status_code, "ERROR")
