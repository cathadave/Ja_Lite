"""
models/log.py — Pydantic models for audit log entries.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditAction(str, Enum):
    created = "created"
    updated = "updated"
    deleted = "deleted"
    rescheduled = "rescheduled"
    assigned = "assigned"
    unassigned = "unassigned"
    notified = "notified"
    completed = "completed"
    cancelled = "cancelled"


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    entity_type: str
    entity_id: UUID
    action: AuditAction
    changed_by: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    notes: Optional[str] = None
    created_at: datetime
