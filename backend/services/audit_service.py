"""
services/audit_service.py — Writes and reads the audit log.

log_action() should be called after any state-changing operation.
The audit log is append-only — never delete rows from audit_log.
"""

import logging
from typing import Any, Optional

from database import supabase

logger = logging.getLogger(__name__)
TABLE = "audit_log"


def log_action(
    entity_type: str,
    entity_id: str,
    action: str,
    changed_by: str = "jeff",
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    notes: Optional[str] = None,
) -> None:
    """Write one audit entry. Failures are logged but not raised — never block the main action."""
    entry = {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action": action,
        "changed_by": changed_by,
    }
    if old_value is not None:
        entry["old_value"] = old_value
    if new_value is not None:
        entry["new_value"] = new_value
    if notes is not None:
        entry["notes"] = notes

    try:
        supabase.table(TABLE).insert(entry).execute()
    except Exception as exc:
        logger.error("Audit log write failed: %s", exc)


def list_audit_log(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = 50,
) -> list:
    query = (
        supabase.table(TABLE)
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if entity_type:
        query = query.eq("entity_type", entity_type)
    if entity_id:
        query = query.eq("entity_id", entity_id)
    return query.execute().data
