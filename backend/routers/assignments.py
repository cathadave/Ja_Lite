"""
routers/assignments.py — HTTP endpoints for task assignments.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from models.assignment import AssignmentCreate, AssignmentResponse
from services import assignment_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[AssignmentResponse])
def list_assignments(
    task_id: Optional[str] = Query(None),
    contact_id: Optional[str] = Query(None),
):
    return assignment_service.list_assignments(task_id=task_id, contact_id=contact_id)


@router.post("/", response_model=AssignmentResponse, status_code=201)
def create_assignment(data: AssignmentCreate):
    try:
        return assignment_service.create_assignment(data)
    except Exception as exc:
        logger.error("Create assignment failed: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: str):
    assignment_service.delete_assignment(assignment_id)
