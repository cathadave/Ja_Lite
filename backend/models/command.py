"""
models/command.py — Pydantic models for command parsing and action planning.

These models represent the structured output of parsing a free-text command
from Jeff into one or more discrete actions that can be confirmed and executed.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class IntentCategory(str, Enum):
    reschedule_task = "reschedule_task"
    notify_contacts = "notify_contacts"
    reassign_task   = "reassign_task"
    create_project  = "create_project"
    query_schedule  = "query_schedule"
    complete_task   = "complete_task"
    compound        = "compound"
    unknown         = "unknown"


class ConfidenceLevel(str, Enum):
    high = "high"   # all required fields resolved — safe to confirm and execute
    low  = "low"    # one or more required fields missing or ambiguous — block execution


class NotificationChannel(str, Enum):
    sms      = "sms"
    email    = "email"
    phone    = "phone"
    whatsapp = "whatsapp"


# ---------------------------------------------------------------------------
# Core action model
# ---------------------------------------------------------------------------

class ParsedAction(BaseModel):
    """
    A single structured action resolved from a free-text command.

    A compound command ("move X and notify everyone") produces two ParsedAction
    objects — one reschedule_task and one notify_contacts.
    """

    intent: IntentCategory

    # Resolved entity references (None = not mentioned or unresolvable)
    project_id:   Optional[str] = None   # UUID of matched project
    project_name: Optional[str] = None   # display name for UI
    task_id:      Optional[str] = None   # UUID of matched task
    task_name:    Optional[str] = None   # display name for UI
    contact_id:   Optional[str] = None   # UUID of matched contact (None = "everyone affected")
    contact_name: Optional[str] = None   # display name for UI

    # Scheduling
    new_date:    Optional[str] = None   # ISO date string (YYYY-MM-DD) if resolved
    date_shift:  Optional[int] = None   # relative shift in days (e.g. +1, -2) if no absolute date

    # Notification
    notify_affected: bool = False               # true if command implies notifying all assignees
    channel: Optional[NotificationChannel] = None  # explicit channel ("text" → sms, "email" → email)
    message: Optional[str] = None               # freeform message body if specified in command

    # Create-project specifics
    template_name: Optional[str] = None  # template referenced in create_project intents

    # Ambiguous task candidates — populated when >1 tasks match the fragment
    task_candidates: list[dict] = []  # [{id, name}] for UI task picker

    # Contact candidates — populated when contact fragment is present but no match found
    contact_candidates: list[dict] = []  # [{id, name}] for UI contact picker

    # Quality / confirmation
    confidence:           ConfidenceLevel = ConfidenceLevel.high
    ambiguities:          list[str] = []   # human-readable gaps, e.g. ["project not specified"]
    requires_confirmation: bool = True     # always True except for query_schedule

    # Cascade choice set by UI before execution
    cascade: Optional[bool] = None  # True = shift downstream tasks; False = anchor only; None = not chosen

    # Display
    summary: str = ""  # one-sentence plain-English summary shown to Jeff before he confirms


# ---------------------------------------------------------------------------
# Request / Response wrappers
# ---------------------------------------------------------------------------

class CommandParseRequest(BaseModel):
    """Payload sent from the frontend when Jeff submits a typed command."""
    raw_input: str
    project_id: Optional[str] = None  # current project context from the frontend, if any


class CommandParseResponse(BaseModel):
    """
    Response returned by POST /commands/parse.

    Contains one or more ParsedAction objects.  If confidence is low on any
    action, the frontend should block execution and surface the clarifying
    question to Jeff rather than showing a confirm button.
    """
    raw_input:          str
    actions:            list[ParsedAction]
    has_low_confidence: bool          # true if any action has confidence == "low"
    clarifying_question: Optional[str] = None  # set when has_low_confidence is True
