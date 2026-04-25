"""
routers/commands.py — HTTP endpoints for command parsing.

Accepts free-text commands from Jeff and returns structured action plans.
No actions are executed here — execution is handled in later modules.
"""

import logging

from fastapi import APIRouter, HTTPException

from models.command import CommandParseRequest, CommandParseResponse
from services import command_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/parse", response_model=CommandParseResponse)
def parse_command(request: CommandParseRequest):
    """
    Parse a free-text command into a structured action plan.

    Returns one or more ParsedAction objects with resolved entities,
    confidence level, ambiguity warnings, and a user-facing summary.
    No DB writes occur. No notifications are sent.
    """
    if not request.raw_input.strip():
        raise HTTPException(status_code=400, detail="Command text cannot be empty.")

    logger.info("Parsing command: %r", request.raw_input)
    result = command_service.parse_command(request.raw_input, project_id=request.project_id)
    logger.info(
        "Parsed %d action(s), low_confidence=%s",
        len(result.actions),
        result.has_low_confidence,
    )
    return result
