"""
SmartStudent AI — Core Abstract Models

All domain models should inherit from BaseModel.
"""

import uuid

from django.db import models


class UUIDModel(models.Model):
    """Abstract model providing a UUID primary key."""

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        db_index=True,
    )

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """Abstract model providing automatic created_at / updated_at timestamps."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel):
    """
    Canonical abstract base model for all SmartStudent AI domain models.
    Provides: UUID primary key, created_at, updated_at.
    """

    class Meta:
        abstract = True
        ordering = ["-created_at"]
