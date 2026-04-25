"""
services/task_service.py — Database operations for tasks.

Rescheduling logic and dependency cascade will be added in Module 6.
"""

from typing import Optional

from database import supabase
from models.task import TaskCreate, TaskUpdate

TABLE = "tasks"


def _write_execution_log(
    *,
    intent: str,
    success: bool,
    message: str,
    project_id: Optional[str] = None,
    task_id: Optional[str] = None,
    contact_id: Optional[str] = None,
) -> None:
    try:
        supabase.table("execution_logs").insert(
            {
                "intent": intent,
                "success": success,
                "message": message,
                "project_id": project_id,
                "task_id": task_id,
                "contact_id": contact_id,
            }
        ).execute()
    except Exception as log_err:
        print(f"[task_service] failed to write execution log: {log_err}")


def list_tasks(project_id: Optional[str] = None, status: Optional[str] = None) -> list:
    query = supabase.table(TABLE).select("*").order("scheduled_start")
    if project_id:
        query = query.eq("project_id", project_id)
    if status:
        query = query.eq("status", status)
    return query.execute().data


def get_task(task_id: str) -> Optional[dict]:
    response = supabase.table(TABLE).select("*").eq("id", task_id).execute()
    if not response.data:
        return None
    return response.data[0]


def create_task(data: TaskCreate) -> dict:
    payload = data.model_dump(mode="json", exclude_none=True)
    created = supabase.table(TABLE).insert(payload).execute().data[0]

    _write_execution_log(
        intent="create_task",
        success=True,
        message=f"Task created: {created.get('name', 'Untitled task')}.",
        project_id=created.get("project_id"),
        task_id=created.get("id"),
        contact_id=None,
    )

    return created


def update_task(task_id: str, data: TaskUpdate) -> dict:
    existing = get_task(task_id)
    if not existing:
        raise IndexError("Task not found")

    payload = data.model_dump(mode="json", exclude_unset=True)
    updated = supabase.table(TABLE).update(payload).eq("id", task_id).execute().data[0]

    if "scheduled_start" in payload:
        scheduled_start = updated.get("scheduled_start") or payload.get("scheduled_start")
        _write_execution_log(
            intent="reschedule_task",
            success=True,
            message=f"Task rescheduled to {scheduled_start}.",
            project_id=updated.get("project_id"),
            task_id=updated.get("id"),
            contact_id=None,
        )
    else:
        _write_execution_log(
            intent="update_task",
            success=True,
            message=f"Task updated: {updated.get('name', 'Untitled task')}.",
            project_id=updated.get("project_id"),
            task_id=updated.get("id"),
            contact_id=None,
        )

    return updated