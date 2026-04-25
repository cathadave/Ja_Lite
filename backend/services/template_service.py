"""
services/template_service.py — Database operations for project templates.
"""

from typing import Optional

from database import supabase

TEMPLATES_TABLE = "project_templates"
TEMPLATE_TASKS_TABLE = "project_template_tasks"


def list_templates() -> list:
    return supabase.table(TEMPLATES_TABLE).select("*").order("name").execute().data


def get_template(template_id: str) -> Optional[dict]:
    response = supabase.table(TEMPLATES_TABLE).select("*").eq("id", template_id).execute()
    if not response.data:
        return None
    return response.data[0]


def get_template_tasks(template_id: str) -> list:
    """Return template tasks ordered by sequence_order (the intended execution order)."""
    return (
        supabase.table(TEMPLATE_TASKS_TABLE)
        .select("*")
        .eq("project_template_id", template_id)
        .order("sequence_order")
        .execute()
        .data
    )
