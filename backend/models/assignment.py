"""
models/assignment.py — Pydantic models for task assignments (contact <-> task links).
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AssignmentRole(str, Enum):
    lead      = "lead"
    support   = "support"
    supplier  = "supplier"
    consulted = "consulted"
    inspector = "inspector"


class AssignmentCreate(BaseModel):
    task_id: UUID
    contact_id: UUID
    role: AssignmentRole = AssignmentRole.lead
    notes: Optional[str] = None


class AssignmentResponse(AssignmentCreate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
