"""
models/template.py — Pydantic models for project templates and template tasks.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProjectTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProjectTemplateTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_template_id: UUID
    name: str
    description: Optional[str] = None
    default_duration_days: int
    sequence_order: int
    category: Optional[str] = None
    created_at: datetime
    updated_at: datetime
