"""
routers/templates.py — HTTP endpoints for project templates.

Templates are read-only from the API perspective.
They are seeded directly in Supabase and used to generate tasks when a project is created.
"""

import logging

from fastapi import APIRouter, HTTPException

from models.template import ProjectTemplateResponse, ProjectTemplateTaskResponse
from services import template_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[ProjectTemplateResponse])
def list_templates():
    return template_service.list_templates()


@router.get("/{template_id}", response_model=ProjectTemplateResponse)
def get_template(template_id: str):
    template = template_service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("/{template_id}/tasks", response_model=list[ProjectTemplateTaskResponse])
def get_template_tasks(template_id: str):
    """Returns template tasks in sequence_order — used to auto-generate project tasks."""
    return template_service.get_template_tasks(template_id)
