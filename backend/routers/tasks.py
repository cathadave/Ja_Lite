"""
routers/tasks.py — HTTP endpoints for tasks.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from models.task import TaskCreate, TaskResponse, TaskUpdate
from services import project_service, task_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[TaskResponse])
def list_tasks(
    project_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    return task_service.list_tasks(project_id=project_id, status=status)


@router.post("/", response_model=TaskResponse, status_code=201)
def create_task(data: TaskCreate):
    return task_service.create_task(data)


class StageInitRequest(BaseModel):
    project_id: str
    stage_name: str


@router.post("/complete-before-stage", response_model=list[TaskResponse])
def complete_tasks_before_stage(data: StageInitRequest):
    try:
        return task_service.complete_tasks_before_stage(data.project_id, data.stage_name)
    except ValueError as exc:
        msg = str(exc)
        if "has no tasks" in msg:
            logger.error("Stage init 404: %s", msg)
            raise HTTPException(status_code=404, detail=msg)
        logger.error("Stage init 400: %s", msg)
        raise HTTPException(status_code=400, detail=msg)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: str):
    task = task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: str, data: TaskUpdate):
    return task_service.update_task(task_id, data)


class RescheduleRequest(BaseModel):
    new_start: Optional[str] = None  # YYYY-MM-DD
    new_end:   Optional[str] = None  # YYYY-MM-DD
    cascade: bool = False


@router.post("/{task_id}/reschedule")
def reschedule_task(task_id: str, data: RescheduleRequest):
    """Reschedule a task, optionally shifting all downstream tasks by the same end-date delta."""
    try:
        return project_service.cascade_task_reschedule(
            task_id, data.new_start, data.new_end, data.cascade
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
