"""
routers/dashboard.py — Dashboard KPI endpoint.
"""

import logging

from fastapi import APIRouter, HTTPException

from services import dashboard_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/kpis")
def get_kpis():
    """Return all operational KPIs in a single response."""
    try:
        return dashboard_service.get_all_kpis()
    except Exception as exc:
        logger.exception("KPI query failed")
        raise HTTPException(status_code=500, detail=str(exc))
