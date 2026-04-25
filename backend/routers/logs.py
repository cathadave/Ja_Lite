"""
routers/logs.py — HTTP endpoints for audit log and execution log access.

Read-only. Writes happen via audit_service.log_action() and execution_service in other services.
"""

from typing import Optional

from fastapi import APIRouter, Query

from database import supabase
from models.log import AuditLogResponse
from services import audit_service

router = APIRouter()


@router.get("/audit", response_model=list[AuditLogResponse])
def get_audit_log(
    entity_type: Optional[str] = Query(None, description="Filter by entity type, e.g. 'project', 'task'"),
    entity_id: Optional[str] = Query(None, description="Filter by entity UUID"),
    limit: int = Query(50, le=200, description="Max rows to return"),
):
    return audit_service.list_audit_log(
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
    )


@router.get("/execution")
def get_execution_logs(limit: int = Query(5, le=50, description="Max rows to return")):
    """Fetch recent execution logs."""
    try:
        response = supabase.table("execution_logs").select("*").order("created_at", desc=True).limit(limit).execute()
        return response.data or []
    except Exception as e:
        print(f"[logs] error fetching execution logs: {e}")
        return []
