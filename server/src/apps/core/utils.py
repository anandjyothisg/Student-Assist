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


def parse_uuid_param(value, name: str = "id"):
    """Validate a UUID query parameter; a malformed value is a 400, not a 500."""
    import uuid

    from rest_framework.exceptions import ValidationError

    if value in (None, ""):
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        raise ValidationError({name: "Must be a valid id."})


def parse_int_param(value, name: str, default: int, lo: int, hi: int) -> int:
    """Clamp an integer query parameter; a malformed value is a 400, not a 500."""
    from rest_framework.exceptions import ValidationError

    if value in (None, ""):
        return default
    try:
        return max(lo, min(hi, int(value)))
    except (ValueError, TypeError):
        raise ValidationError({name: "Must be a whole number."})


# Uploaded OOXML files are zip archives; reject archives that would expand to
# something absurd when the parser opens them (zip bombs).
MAX_ARCHIVE_ENTRIES = 5000
MAX_ARCHIVE_UNCOMPRESSED_MB = 300


def sniff_document(file_obj, ext: str) -> str | None:
    """
    Check that the file's content matches its extension. Returns an error
    message for the user, or None when the content looks right. The extension
    alone is not trusted: a renamed executable or HTML file is rejected here.
    """
    import zipfile

    pos = file_obj.tell() if hasattr(file_obj, "tell") else 0
    try:
        file_obj.seek(0)
        head = file_obj.read(8192)
        if not head:
            return "The file is empty."
        if ext == ".pdf":
            if b"%PDF-" not in head[:1024]:
                return "This file isn't a valid PDF."
            return None
        if ext in (".docx", ".pptx"):
            file_obj.seek(0)
            if not zipfile.is_zipfile(file_obj):
                return f"This file isn't a valid {ext[1:].upper()} document."
            file_obj.seek(0)
            with zipfile.ZipFile(file_obj) as zf:
                infos = zf.infolist()
                names = {i.filename for i in infos}
                if len(infos) > MAX_ARCHIVE_ENTRIES or sum(i.file_size for i in infos) > MAX_ARCHIVE_UNCOMPRESSED_MB * 1024 * 1024:
                    return "This document is too large to process once unpacked."
                marker = "word/document.xml" if ext == ".docx" else "ppt/presentation.xml"
                if "[Content_Types].xml" not in names or marker not in names:
                    return f"This file isn't a valid {ext[1:].upper()} document."
            return None
        if ext in (".txt", ".md"):
            if b"\x00" in head and not head.startswith((b"\xff\xfe", b"\xfe\xff")):
                return "This file doesn't look like plain text."
            return None
        return None
    except zipfile.BadZipFile:
        return f"This file isn't a valid {ext[1:].upper()} document."
    finally:
        try:
            file_obj.seek(pos)
        except Exception:
            pass
