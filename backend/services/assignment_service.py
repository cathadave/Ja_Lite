"""
services/assignment_service.py — Database operations for task assignments.
"""

from typing import Optional

from database import supabase
from models.assignment import AssignmentCreate

TABLE = "task_assignments"


def list_assignments(task_id: Optional[str] = None, contact_id: Optional[str] = None) -> list:
    query = supabase.table(TABLE).select("*")
    if task_id:
        query = query.eq("task_id", task_id)
    if contact_id:
        query = query.eq("contact_id", contact_id)
    return query.execute().data


def create_assignment(data: AssignmentCreate) -> dict:
    task_rows = supabase.table("tasks").select("category").eq("id", str(data.task_id)).limit(1).execute().data
    contact_rows = supabase.table("contacts").select("trade").eq("id", str(data.contact_id)).limit(1).execute().data

    task_category = (task_rows[0].get("category") or "").strip() or None if task_rows else None
    contact_trade = (contact_rows[0].get("trade") or "").strip() or None if contact_rows else None

    if task_category and contact_trade and task_category != contact_trade:
        raise ValueError(
            f"Trade mismatch: task requires '{task_category}', contact trade is '{contact_trade}'"
        )

    payload = data.model_dump(mode="json")
    return supabase.table(TABLE).insert(payload).execute().data[0]


def delete_assignment(assignment_id: str) -> list:
    return supabase.table(TABLE).delete().eq("id", assignment_id).execute().data
