"""
routers/projects.py — HTTP endpoints for projects.

Handles request/response only. All DB logic lives in project_service.
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from models.project import ProjectCreate, ProjectResponse, ProjectUpdate
from models.task import TaskResponse
from services import project_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[ProjectResponse])
def list_projects(status: Optional[str] = Query(None)):
    return project_service.list_projects(status=status)


@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(data: ProjectCreate):
    return project_service.create_project(data)


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, data: ProjectUpdate):
    return project_service.update_project(project_id, data)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str):
    # High-impact: confirmation is enforced at the frontend layer (Module 3+).
    project_service.delete_project(project_id)


class OnboardRequest(BaseModel):
    name: str
    address: Optional[str] = None
    start_date: str
    template_id: str


@router.post("/onboard", status_code=201)
def onboard_project(data: OnboardRequest):
    """Create a project and immediately expand its template into live tasks."""
    if project_service.project_onboard_exists(data.name, data.address):
        raise HTTPException(
            status_code=409,
            detail=f"Duplicate blocked: project '{data.name}'"
                   + (f" at '{data.address}'" if data.address else "")
                   + " already exists.",
        )
    project = project_service.create_project(
        ProjectCreate(
            name=data.name,
            address=data.address,
            start_date=data.start_date,
            template_id=data.template_id,
            status="planning",
        )
    )
    expansion_result = project_service.expand_project_template(
        project_id=str(project["id"]),
        template_id=data.template_id,
        start_date=data.start_date,
    )
    return {"project": project, "expansion_result": expansion_result}


class BulkTaskItem(BaseModel):
    name: str
    description: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    template_task_id: Optional[UUID] = None
    status: Optional[str] = "pending"


@router.post("/{project_id}/tasks/bulk", response_model=list[TaskResponse], status_code=201)
def bulk_create_tasks(project_id: str, tasks: list[BulkTaskItem]):
    """Create multiple tasks for a project in one request. Used by the onboarding wizard."""
    if not tasks:
        raise HTTPException(status_code=400, detail="Task list cannot be empty")
    payload = [t.model_dump(mode="json", exclude_none=True) for t in tasks]
    return project_service.bulk_create_tasks(project_id, payload)
