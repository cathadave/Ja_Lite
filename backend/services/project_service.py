"""
services/project_service.py — Database operations for projects.

No business logic yet. Each function maps to one Supabase query.
Business logic (e.g. cascade rescheduling) will be added in later modules.
"""

from datetime import datetime, timedelta
from typing import Optional

from database import supabase
from models.project import ProjectCreate, ProjectUpdate
from services.template_service import get_template_tasks

TABLE = "projects"


def project_onboard_exists(name: str, address: Optional[str]) -> bool:
    """Return True if a project with the same trimmed name (and address, if given) already exists."""
    _name = (name or "").strip()
    _address = (address or "").strip() or None
    query = supabase.table(TABLE).select("id").eq("name", _name)
    if _address:
        query = query.eq("address", _address)
    return bool(query.limit(1).execute().data)


def list_projects(status: Optional[str] = None) -> list:
    query = supabase.table(TABLE).select("*").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    return query.execute().data


def get_project(project_id: str) -> Optional[dict]:
    response = supabase.table(TABLE).select("*").eq("id", project_id).execute()
    if not response.data:
        return None
    return response.data[0]


def create_project(data: ProjectCreate) -> dict:
    payload = data.model_dump(mode="json", exclude_none=True)
    return supabase.table(TABLE).insert(payload).execute().data[0]


def update_project(project_id: str, data: ProjectUpdate) -> dict:
    payload = data.model_dump(mode="json", exclude_unset=True)
    return supabase.table(TABLE).update(payload).eq("id", project_id).execute().data[0]


def delete_project(project_id: str) -> list:
    return supabase.table(TABLE).delete().eq("id", project_id).execute().data


def bulk_create_tasks(project_id: str, tasks: list[dict]) -> list:
    """Insert multiple tasks for a project in one DB call. Returns all created rows."""
    for task in tasks:
        task["project_id"] = project_id
    return supabase.table("tasks").insert(tasks).execute().data


def cascade_task_reschedule(
    task_id: str,
    new_start: Optional[str],
    new_end: Optional[str],
    cascade: bool,
) -> dict:
    """
    Reschedule task_id, anchoring shift_days on the end-date delta.

    Three-case resolver:
      - start only  → actual_end  = new_start + original_duration
      - end only    → actual_start = new_end  - original_duration
      - both        → use both as given

    shift_days = actual_end - old_end (end-date anchored).

    If cascade=True, every non-completed/cancelled task in the same project
    whose scheduled_end is after the original end is shifted by shift_days,
    preserving each task's own duration.

    Returns {"task": updated_row, "shift_days": int, "cascaded_count": int}.
    """
    if new_start is None and new_end is None:
        raise ValueError("At least one of new_start or new_end must be provided.")

    resp = supabase.table("tasks").select(
        "id, project_id, scheduled_start, scheduled_end, status"
    ).eq("id", task_id).execute()

    if not resp.data:
        raise ValueError(f"Task {task_id} not found.")

    task = resp.data[0]
    project_id = str(task["project_id"])
    old_start_str = task.get("scheduled_start") or ""
    old_end_str   = task.get("scheduled_end") or ""

    old_start_date = datetime.fromisoformat(old_start_str[:10]).date() if old_start_str else None
    old_end_date   = datetime.fromisoformat(old_end_str[:10]).date()   if old_end_str   else None

    # Original duration in days (fallback 0 if either bound is missing)
    duration_days = (old_end_date - old_start_date).days if (old_start_date and old_end_date) else 0

    # Three-case resolver
    if new_start and new_end:
        actual_start = datetime.fromisoformat(new_start[:10]).date()
        actual_end   = datetime.fromisoformat(new_end[:10]).date()
    elif new_start:
        actual_start = datetime.fromisoformat(new_start[:10]).date()
        actual_end   = actual_start + timedelta(days=duration_days)
    else:  # new_end only
        actual_end   = datetime.fromisoformat(new_end[:10]).date()
        actual_start = actual_end - timedelta(days=duration_days)

    # shift_days anchored on end-date
    shift_days = (actual_end - old_end_date).days if old_end_date else 0

    anchor_patch: dict = {
        "scheduled_start": f"{actual_start.isoformat()}T07:00:00",
        "scheduled_end":   f"{actual_end.isoformat()}T17:00:00",
    }
    updated_resp = supabase.table("tasks").update(anchor_patch).eq("id", task_id).execute()
    updated_task = updated_resp.data[0] if updated_resp.data else task

    cascaded_count = 0

    if cascade and shift_days != 0 and old_end_str:
        downstream = (
            supabase.table("tasks")
            .select("id, scheduled_start, scheduled_end")
            .eq("project_id", project_id)
            .gt("scheduled_start", old_start_str[:10])
            .neq("status", "completed")
            .neq("status", "cancelled")
            .neq("id", task_id)
            .execute()
        ).data or []

        for t in downstream:
            t_start = t.get("scheduled_start") or ""
            t_end   = t.get("scheduled_end") or ""
            if not t_end:
                continue
            try:
                new_t_end = datetime.fromisoformat(t_end[:10]).date() + timedelta(days=shift_days)
                patch: dict = {"scheduled_end": f"{new_t_end.isoformat()}T17:00:00"}
                if t_start:
                    new_t_start = datetime.fromisoformat(t_start[:10]).date() + timedelta(days=shift_days)
                    patch["scheduled_start"] = f"{new_t_start.isoformat()}T07:00:00"
                supabase.table("tasks").update(patch).eq("id", t["id"]).execute()
                cascaded_count += 1
            except Exception as exc:
                print(f"[project_service] cascade_task_reschedule: skipped task {t.get('id')}: {exc}")

    return {
        "task": updated_task,
        "shift_days": shift_days,
        "cascaded_count": cascaded_count,
    }


def _insert_task_dependencies(pairs: list[tuple[str, str]]) -> None:
    """Insert (task_id, depends_on_task_id) rows into task_dependencies."""
    if not pairs:
        return
    rows = [{"task_id": t, "depends_on_task_id": d} for t, d in pairs]
    supabase.table("task_dependencies").insert(rows).execute()


def expand_project_template(
    project_id: str,
    template_id: str,
    start_date: str,
) -> dict:
    """
    Instantiate a template into live tasks for a project.

    Computes sequential scheduled dates from start_date using each template
    task's default_duration_days (supports 0.5 increments). Creates a linear
    dependency chain (each task depends on the previous one in sequence order).

    Returns {"notify_all": True} on success so the caller can trigger a
    one-time broadcast to all assigned contacts.
    """
    existing = (
        supabase.table("tasks")
        .select("id")
        .eq("project_id", project_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return {"notify_all": False, "skipped": True, "reason": "project already has tasks"}

    template_tasks = get_template_tasks(template_id)
    if not template_tasks:
        return {"notify_all": False, "skipped": True, "reason": "template has no tasks"}

    anchor = datetime.fromisoformat(start_date)
    task_rows: list[dict] = []
    for tt in template_tasks:
        duration = float(tt.get("default_duration_days") or 1.0)
        sched_start = anchor
        sched_end = anchor + timedelta(days=duration)
        task_rows.append(
            {
                "name": tt["name"],
                "description": tt.get("description"),
                "category": tt.get("category"),
                "template_task_id": str(tt["id"]),
                "scheduled_start": sched_start.isoformat(),
                "scheduled_end": sched_end.isoformat(),
                "status": "pending",
            }
        )
        anchor = sched_end

    created = bulk_create_tasks(project_id, task_rows)

    # Map template task id → live task id (order-independent)
    tmpl_id_to_live_id = {row["template_task_id"]: row["id"] for row in created}
    # Map template task name → template task id
    name_to_tmpl_id = {tt["name"]: str(tt["id"]) for tt in template_tasks}

    dep_pairs: list[tuple[str, str]] = []
    for tt in template_tasks:
        raw = (tt.get("depends_on_names") or "").strip()
        if not raw:
            continue
        live_id = tmpl_id_to_live_id.get(str(tt["id"]))
        if not live_id:
            continue
        for dep_name in (n.strip() for n in raw.split(",") if n.strip()):
            dep_tmpl_id = name_to_tmpl_id.get(dep_name)
            dep_live_id = tmpl_id_to_live_id.get(dep_tmpl_id) if dep_tmpl_id else None
            if dep_live_id:
                dep_pairs.append((live_id, dep_live_id))
    _insert_task_dependencies(dep_pairs)

    return {"notify_all": True}
