"""
services/dashboard_service.py — KPI aggregation queries for the dashboard.

Each function runs its own Supabase queries and returns a self-contained dict.
get_all_kpis() calls all five and shares one project lookup to reduce round-trips.
"""

from datetime import date, timedelta
from typing import Any

from database import supabase


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _load_project_lookup() -> dict[str, str]:
    """Return {project_id_str: project_name} for all projects."""
    rows = supabase.table("projects").select("id, name").execute().data
    return {str(r["id"]): r["name"] for r in rows}


def _date_prefix(value: str | None) -> str:
    """Trim a timestamp string to YYYY-MM-DD, or return empty string."""
    return (value or "")[:10]


# ---------------------------------------------------------------------------
# Individual KPI functions
# Each accepts an optional pre-loaded project lookup to avoid redundant queries.
# ---------------------------------------------------------------------------

def get_active_projects_today(projects_lookup: dict[str, str] | None = None) -> dict:
    """
    Count distinct projects that have at least one incomplete task
    where scheduled_start <= today <= scheduled_end.
    """
    today = date.today().isoformat()
    tasks = (
        supabase.table("tasks")
        .select("project_id")
        .lte("scheduled_start", today)
        .gte("scheduled_end", today)
        .neq("status", "completed")
        .neq("status", "cancelled")
        .execute()
        .data
    )
    lookup = projects_lookup if projects_lookup is not None else _load_project_lookup()
    seen: set[str] = set()
    projects = []
    for t in tasks:
        pid = str(t["project_id"])
        if pid not in seen:
            seen.add(pid)
            projects.append({"project_id": pid, "project_name": lookup.get(pid, "")})
    return {"count": len(projects), "projects": projects}


def get_projects_past_framing(projects_lookup: dict[str, str] | None = None) -> dict:
    """
    Count distinct projects where any task with 'framing' in its name is completed.
    """
    tasks = (
        supabase.table("tasks")
        .select("project_id")
        .ilike("name", "%framing%")
        .eq("status", "completed")
        .execute()
        .data
    )
    lookup = projects_lookup if projects_lookup is not None else _load_project_lookup()
    seen: set[str] = set()
    projects = []
    for t in tasks:
        pid = str(t["project_id"])
        if pid not in seen:
            seen.add(pid)
            projects.append({"project_id": pid, "project_name": lookup.get(pid, "")})
    return {"count": len(projects), "projects": projects}


def get_closings_this_week(projects_lookup: dict[str, str] | None = None) -> dict:
    """
    Tasks whose name contains 'final', 'co', 'certificate', or 'closing'
    with scheduled_start between today and today + 5 days.

    Assumption: 'co' is case-insensitive via ilike — may match partial words
    (e.g. 'concrete'). Refine to word-boundary matching if false positives occur.
    """
    today = date.today()
    today_str = today.isoformat()
    week_end = (today + timedelta(days=5)).isoformat()
    tasks = (
        supabase.table("tasks")
        .select("id, name, project_id, scheduled_start")
        .or_("name.ilike.%final%,name.ilike.%co%,name.ilike.%certificate%,name.ilike.%closing%")
        .gte("scheduled_start", today_str)
        .lte("scheduled_start", week_end)
        .execute()
        .data
    )
    lookup = projects_lookup if projects_lookup is not None else _load_project_lookup()
    items = [
        {
            "project_id": str(t["project_id"]),
            "project_name": lookup.get(str(t["project_id"]), ""),
            "task_name": t["name"],
            "scheduled_start": _date_prefix(t.get("scheduled_start")),
        }
        for t in tasks
    ]
    return {"count": len(items), "items": items}


def get_tasks_late(projects_lookup: dict[str, str] | None = None) -> dict:
    """
    Tasks where scheduled_end < today and status is not completed or cancelled.
    """
    today = date.today().isoformat()
    tasks = (
        supabase.table("tasks")
        .select("id, name, project_id, scheduled_end")
        .lt("scheduled_end", today)
        .neq("status", "completed")
        .neq("status", "cancelled")
        .execute()
        .data
    )
    lookup = projects_lookup if projects_lookup is not None else _load_project_lookup()
    items = [
        {
            "task_id": str(t["id"]),
            "task_name": t["name"],
            "project_id": str(t["project_id"]),
            "project_name": lookup.get(str(t["project_id"]), ""),
            "scheduled_end": _date_prefix(t.get("scheduled_end")),
        }
        for t in tasks
    ]
    return {"count": len(items), "items": items}


def get_on_time_completion(projects_lookup: dict[str, str] | None = None) -> dict:
    """
    For all completed tasks:
    - A task is 'late' if actual_end is set and actual_end > scheduled_end.
    - Tasks with no actual_end are treated as on-time.
    Returns overall percentage and per-project breakdown ranked best to worst.
    """
    tasks = (
        supabase.table("tasks")
        .select("project_id, scheduled_end, actual_end")
        .eq("status", "completed")
        .execute()
        .data
    )
    lookup = projects_lookup if projects_lookup is not None else _load_project_lookup()

    by_project: dict[str, dict[str, Any]] = {}
    for t in tasks:
        pid = str(t["project_id"])
        if pid not in by_project:
            by_project[pid] = {
                "project_id": pid,
                "project_name": lookup.get(pid, ""),
                "completed_count": 0,
                "late_count": 0,
            }
        by_project[pid]["completed_count"] += 1
        actual = t.get("actual_end")
        scheduled = t.get("scheduled_end")
        if actual and scheduled and actual > scheduled:
            by_project[pid]["late_count"] += 1

    total_completed = 0
    total_late = 0
    project_rows = []
    for p in by_project.values():
        on_time = p["completed_count"] - p["late_count"]
        p["percentage"] = round(on_time / p["completed_count"] * 100) if p["completed_count"] else 100
        project_rows.append(p)
        total_completed += p["completed_count"]
        total_late += p["late_count"]

    project_rows.sort(key=lambda x: x["percentage"], reverse=True)

    overall_on_time = total_completed - total_late
    overall_pct = round(overall_on_time / total_completed * 100) if total_completed else 100

    return {"percentage": overall_pct, "projects": project_rows}


# ---------------------------------------------------------------------------
# Combined entrypoint — loads project lookup once, shares across all KPIs
# ---------------------------------------------------------------------------

def get_all_kpis() -> dict:
    lookup = _load_project_lookup()
    return {
        "on_time_completion":    get_on_time_completion(lookup),
        "active_projects_today": get_active_projects_today(lookup),
        "projects_past_framing": get_projects_past_framing(lookup),
        "closings_this_week":    get_closings_this_week(lookup),
        "tasks_late":            get_tasks_late(lookup),
    }
