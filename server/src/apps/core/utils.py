"""
SmartStudent AI — Core Utilities

Shared helper functions used across all apps.
"""

import hashlib
import mimetypes
import os
from pathlib import Path
from typing import Any

from django.conf import settings


# ---------------------------------------------------------------------------
# File Helpers
# ---------------------------------------------------------------------------


def get_file_extension(filename: str) -> str:
    """Return the lowercased file extension including the dot. e.g. '.pdf'"""
    return Path(filename).suffix.lower()


def is_allowed_document(filename: str) -> bool:
    """Return True if the file extension is in ALLOWED_DOCUMENT_EXTENSIONS."""
    ext = get_file_extension(filename)
    return ext in getattr(settings, "ALLOWED_DOCUMENT_EXTENSIONS", [".pdf", ".docx", ".pptx", ".txt"])


def get_file_size_mb(file_obj) -> float:
    """Return the size of an in-memory file object in megabytes."""
    file_obj.seek(0, os.SEEK_END)
    size_bytes = file_obj.tell()
    file_obj.seek(0)
    return round(size_bytes / (1024 * 1024), 2)


def validate_file_size(file_obj, max_mb: int | None = None) -> None:
    """
    Raise ValueError if the file exceeds the maximum size.
    Defaults to MAX_DOCUMENT_SIZE_MB from settings.
    """
    from apps.core.exceptions import FileSizeExceededError

    limit = max_mb or getattr(settings, "MAX_DOCUMENT_SIZE_MB", 50)
    size_mb = get_file_size_mb(file_obj)
    if size_mb > limit:
        raise FileSizeExceededError(
            f"File size {size_mb:.1f} MB exceeds the {limit} MB limit."
        )


# ---------------------------------------------------------------------------
# Hashing / Identification
# ---------------------------------------------------------------------------


def compute_file_hash(file_obj, algorithm: str = "sha256") -> str:
    """
    Compute the hash of a file-like object.
    Used to detect duplicate uploads without reading the whole file into memory.
    """
    h = hashlib.new(algorithm)
    file_obj.seek(0)
    for chunk in iter(lambda: file_obj.read(8192), b""):
        h.update(chunk)
    file_obj.seek(0)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# String Helpers
# ---------------------------------------------------------------------------


def truncate(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """Truncate a string to max_length characters."""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix


def slugify_course_code(text: str) -> str:
    """
    Produce a clean uppercase course code from arbitrary text.
    e.g. "Machine Learning 101" → "ML101"
    """
    import re

    words = re.findall(r"[A-Za-z0-9]+", text)
    if not words:
        return "COURSE"
    initials = "".join(w[0].upper() for w in words if w[0].isalpha())
    numbers = "".join(w for w in words if w.isdigit())
    return (initials + numbers)[:10] or "COURSE"


# ---------------------------------------------------------------------------
# API Response Helpers
# ---------------------------------------------------------------------------


def success_response(data: Any = None, message: str = "Success") -> dict:
    """Standard success response envelope."""
    return {"success": True, "message": message, "data": data}


def error_response(message: str, code: str = "ERROR", details: Any = None) -> dict:
    """Standard error response envelope."""
    return {
        "success": False,
        "error": {"code": code, "message": message, "details": details},
    }
