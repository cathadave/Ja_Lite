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


def complete_tasks_before_stage(project_id: str, stage_name: str) -> list[dict]:
    # 1. Fetch all tasks for the project
    all_tasks = supabase.table(TABLE).select("*").eq("project_id", project_id).execute().data
    if not all_tasks:
        raise ValueError(f"Project {project_id} has no tasks")

    # 2. Require every task to have a template_task_id before any write
    missing_link = [t["name"] for t in all_tasks if not t.get("template_task_id")]
    if missing_link:
        raise ValueError(
            f"Cannot determine task order: task '{missing_link[0]}' has no template link"
        )

    # 3. Fetch sequence_order for all referenced template tasks in one query
    template_task_ids = list({str(t["template_task_id"]) for t in all_tasks})
    tmpl_rows = (
        supabase.table("project_template_tasks")
        .select("id,sequence_order")
        .in_("id", template_task_ids)
        .execute()
        .data
    )
    tmpl_id_to_seq = {str(r["id"]): r["sequence_order"] for r in tmpl_rows}

    # 4. Confirm every template task was returned (guards against deleted template rows)
    missing_tmpl = [
        str(t["template_task_id"])
        for t in all_tasks
        if str(t["template_task_id"]) not in tmpl_id_to_seq
    ]
    if missing_tmpl:
        raise ValueError(
            "Cannot determine task order: template data missing for one or more tasks"
        )

    # 5. Locate the stage task by case-insensitive name match
    stage_lower = stage_name.strip().lower()
    stage_task = next(
        (t for t in all_tasks if t["name"].strip().lower() == stage_lower),
        None,
    )
    if stage_task is None:
        raise ValueError(f"Stage '{stage_name}' not found in project tasks")

    stage_seq = tmpl_id_to_seq[str(stage_task["template_task_id"])]

    # 6. Collect IDs of tasks that precede the stage and are not already completed
    ids_to_complete = [
        str(t["id"])
        for t in all_tasks
        if tmpl_id_to_seq[str(t["template_task_id"])] < stage_seq
        and t.get("status") != "completed"
    ]

    # 7. Nothing to do — return early without writing
    if not ids_to_complete:
        return []

    # 8. Single bulk write — only reached after all validation passes
    updated = (
        supabase.table(TABLE)
        .update({"status": "completed"})
        .in_("id", ids_to_complete)
        .execute()
        .data
    )

    _write_execution_log(
        intent="stage_init",
        success=True,
        message=(
            f"Stage init: marked {len(updated)} task(s) complete "
            f"before stage '{stage_name}'."
        ),
        project_id=project_id,
    )

    return updated
