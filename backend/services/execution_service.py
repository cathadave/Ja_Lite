"""
services/execution_service.py - Execute parsed actions.
"""

from datetime import date, datetime, timedelta

from config import settings
from database import supabase
from services.email_service import send_email
from services.project_service import cascade_task_reschedule
from services.sms_service import send_sms


def _safe_get(action: dict, key: str, default=None):
    if isinstance(action, dict):
        return action.get(key, default)
    return getattr(action, key, default)


def _parse_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value

    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())

    if isinstance(value, str):
        normalized = value.strip().replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            try:
                return datetime.fromisoformat(f"{normalized}T00:00:00")
            except ValueError:
                return None

    return None


def _format_date_for_message(value: str) -> str:
    dt = _parse_datetime(value)
    if not dt:
        return value
    return dt.date().isoformat()


def _nth_weekday_of_month(year: int, month: int, weekday: int, nth: int) -> date:
    first = date(year, month, 1)
    days_until = (weekday - first.weekday()) % 7
    first_match = first + timedelta(days=days_until)
    return first_match + timedelta(weeks=nth - 1)


def _last_weekday_of_month(year: int, month: int, weekday: int) -> date:
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)

    current = next_month - timedelta(days=1)
    while current.weekday() != weekday:
        current -= timedelta(days=1)
    return current


def _observed_holiday(actual: date) -> date:
    if actual.weekday() == 5:  # Saturday
        return actual - timedelta(days=1)
    if actual.weekday() == 6:  # Sunday
        return actual + timedelta(days=1)
    return actual


def _us_federal_holidays(year: int) -> dict[date, str]:
    holidays = {}

    fixed_holidays = [
        (date(year, 1, 1), "New Year's Day"),
        (date(year, 6, 19), "Juneteenth National Independence Day"),
        (date(year, 7, 4), "Independence Day"),
        (date(year, 11, 11), "Veterans Day"),
        (date(year, 12, 25), "Christmas Day"),
    ]

    for actual, name in fixed_holidays:
        holidays[_observed_holiday(actual)] = name

    holidays[_nth_weekday_of_month(year, 1, 0, 3)] = "Martin Luther King Jr. Day"
    holidays[_nth_weekday_of_month(year, 2, 0, 3)] = "Washington's Birthday"
    holidays[_last_weekday_of_month(year, 5, 0)] = "Memorial Day"
    holidays[_nth_weekday_of_month(year, 9, 0, 1)] = "Labor Day"
    holidays[_nth_weekday_of_month(year, 10, 0, 2)] = "Columbus Day"
    holidays[_nth_weekday_of_month(year, 11, 3, 4)] = "Thanksgiving Day"

    return holidays


def get_federal_holidays(year: int) -> dict[str, str]:
    """Return US federal holidays as ISO date strings for use by the frontend."""
    return {d.isoformat(): name for d, name in _us_federal_holidays(year).items()}


def _check_date_constraints(target_date_str: str) -> str | None:
    dt = _parse_datetime(target_date_str)
    if not dt:
        return "Selected date could not be parsed."

    target_day = dt.date()

    if target_day.weekday() == 5:
        return "Selected start date falls on Saturday."
    if target_day.weekday() == 6:
        return "Selected start date falls on Sunday."

    holidays = _us_federal_holidays(target_day.year)
    holiday_name = holidays.get(target_day)
    if holiday_name:
        return f"Selected start date falls on {holiday_name}."

    return None


def _check_sequence_constraints(task_id: str) -> tuple[str, list[dict]] | None:
    """Return (message, unmet_prereq_list) if any prerequisite is not yet completed, or None."""
    try:
        dep_response = (
            supabase.table("task_dependencies")
            .select("depends_on_task_id")
            .eq("task_id", task_id)
            .execute()
        )
        dep_rows = dep_response.data or []
    except Exception as e:
        print(f"[execution] _check_sequence_constraints dependency query failed: {e}")
        return None

    if not dep_rows:
        return None

    prerequisite_ids = [row["depends_on_task_id"] for row in dep_rows if row.get("depends_on_task_id")]
    if not prerequisite_ids:
        return None

    try:
        prereq_response = (
            supabase.table("tasks")
            .select("id, name, status")
            .in_("id", prerequisite_ids)
            .execute()
        )
        prereq_rows = prereq_response.data or []
    except Exception as e:
        print(f"[execution] _check_sequence_constraints prerequisite load failed: {e}")
        return None

    unmet_rows = [r for r in prereq_rows if r.get("status") != "completed"]

    if not unmet_rows:
        return None

    unmet_names = [r.get("name") or str(r.get("id")) for r in unmet_rows]
    unmet_data  = [{"id": str(r.get("id") or ""), "name": r.get("name") or str(r.get("id"))} for r in unmet_rows]

    if len(unmet_names) == 1:
        return (f"Cannot complete: prerequisite task '{unmet_names[0]}' is not yet completed.", unmet_data)

    names = ", ".join(f"'{n}'" for n in unmet_names[:-1]) + f" and '{unmet_names[-1]}'"
    return (f"Cannot complete: prerequisite tasks not yet completed: {names}.", unmet_data)


def _load_task_row(task_id: str) -> dict | None:
    response = (
        supabase.table("tasks")
        .select("id, name, scheduled_start, scheduled_end, project_id, status")
        .eq("id", task_id)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def _load_project_name(project_id: str | None) -> str | None:
    if not project_id:
        return None

    response = (
        supabase.table("projects")
        .select("id, name")
        .eq("id", project_id)
        .execute()
    )
    rows = response.data or []
    return rows[0].get("name") if rows else None


def _format_date_human(value: str | None) -> str:
    """Return a date as 'May 15, 2026'. Falls back to the raw string on parse failure."""
    if not value:
        return "TBD"
    dt = _parse_datetime(value)
    if not dt:
        return str(value)
    return f"{dt.strftime('%B')} {dt.day}, {dt.year}"


def _load_project_row(project_id: str) -> dict | None:
    """Load a project row including address and description."""
    try:
        response = (
            supabase.table("projects")
            .select("id, name, address, description")
            .eq("id", project_id)
            .execute()
        )
        rows = response.data or []
        return rows[0] if rows else None
    except Exception as e:
        print(f"[execution] _load_project_row failed: {e}")
        return None


def _load_upcoming_tasks(project_id: str, anchor_date: str | None, days: int = 21) -> list[dict]:
    """Return non-completed tasks scheduled within `days` days of anchor_date."""
    try:
        anchor = (anchor_date or date.today().isoformat())[:10]
        window_end = (date.fromisoformat(anchor) + timedelta(days=days)).isoformat()
        response = (
            supabase.table("tasks")
            .select("id, name, scheduled_start, category")
            .eq("project_id", project_id)
            .gte("scheduled_start", anchor)
            .lte("scheduled_start", window_end)
            .not_.in_("status", ["completed", "cancelled"])
            .order("scheduled_start")
            .execute()
        )
        return response.data or []
    except Exception as e:
        print(f"[execution] _load_upcoming_tasks failed: {e}")
        return []


def _is_contact_assigned_to_task(task_id: str | None, contact_id: str) -> bool:
    """Return True if the contact has a task_assignments row for this task."""
    if not task_id or not contact_id:
        return False
    try:
        response = (
            supabase.table("task_assignments")
            .select("id")
            .eq("task_id", task_id)
            .eq("contact_id", contact_id)
            .execute()
        )
        return bool(response.data)
    except Exception as e:
        print(f"[execution] _is_contact_assigned_to_task failed: {e}")
        return False


def _compose_outbound_message(
    contact_row: dict,
    project_row: dict | None,
    task_name: str | None,
    new_date: str | None,
    original_date: str | None,
    lookahead_tasks: list[dict],
    is_task_owner: bool,
    notify_affected: bool,
    reason: str | None = None,
) -> str:
    """Build a structured, human-readable notification message based on recipient type.

    Recipient types:
      TASK OWNER    — contact is assigned to the rescheduled task
      IMPACTED TRADES — contact is notified via notify_affected (downstream)
      GENERAL       — all other explicit single-contact notifications
    """
    first_name = (contact_row.get("name") or "Team").split()[0]
    project_name = (project_row.get("name") if project_row else None) or "this project"

    # Context block
    context_lines = [f"Project: {project_name}"]
    if project_row:
        address = (project_row.get("address") or "").strip()
        if address:
            context_lines.append(f"Address: {address}")
        description = (project_row.get("description") or "").strip()
        if description:
            context_lines.append(f"Job Details: {description}")
    context_block = "\n".join(context_lines)

    # Date lines
    new_date_human = _format_date_human(new_date)
    old_date_human = _format_date_human(original_date) if original_date else None

    # Impact calculation
    impact_line = ""
    if original_date and new_date:
        orig_dt = _parse_datetime(original_date)
        new_dt = _parse_datetime(new_date)
        if orig_dt and new_dt:
            delta = (new_dt.date() - orig_dt.date()).days
            direction = "forward" if delta >= 0 else "back"
            impact_line = f"Days Shifted: {abs(delta)} day{'s' if abs(delta) != 1 else ''} {direction}"

    # 3-week lookahead block (cap at 10 items)
    if lookahead_tasks:
        lookahead_lines = []
        for t in lookahead_tasks[:10]:
            t_name = t.get("name") or "Unnamed task"
            t_date = _format_date_human(t.get("scheduled_start"))
            lookahead_lines.append(f"  • {t_name} — {t_date}")
        lookahead_block = "Here's what's coming up next:\n" + "\n".join(lookahead_lines)
    else:
        lookahead_block = "No upcoming tasks scheduled in the next 3 weeks."

    parts: list[str] = []

    if is_task_owner:
        parts.append(f"Hi {first_name},")
        parts.append(f"The schedule for {project_name} has been updated.")
        parts.append(context_block)
        task_block_lines = []
        if task_name:
            task_block_lines.append(f"Task: {task_name}")
        if old_date_human:
            task_block_lines.append(f"Previous Date: {old_date_human}")
        task_block_lines.append(f"New Date: {new_date_human}")
        if impact_line:
            task_block_lines.append(impact_line)
        parts.append("\n".join(task_block_lines))
        if reason:
            parts.append(f"Reason: {reason}")
        parts.append(lookahead_block)
        parts.append("Please confirm your availability for this date.")

    elif notify_affected:
        parts.append(f"Hi {first_name},")
        parts.append("A schedule change may affect your upcoming work.")
        parts.append(context_block)
        changed_lines = []
        if task_name:
            changed_lines.append(f"Task: {task_name}")
        changed_lines.append(f"New Date: {new_date_human}")
        if impact_line:
            changed_lines.append(impact_line)
        parts.append("\n".join(changed_lines))
        if reason:
            parts.append(f"Reason: {reason}")
        parts.append(lookahead_block)
        parts.append("Please confirm your availability.")

    else:
        parts.append(f"Hi {first_name},")
        parts.append(f"Here is a schedule update for {project_name}.")
        parts.append(context_block)
        if task_name and new_date:
            parts.append(f"{task_name} has been moved to {new_date_human}.")
        elif task_name:
            parts.append(f"There has been an update to {task_name} on {project_name}.")
        if reason:
            parts.append(f"Reason: {reason}")
        parts.append(lookahead_block)
        parts.append("Please confirm receipt of this update.")

    return "\n\n".join(parts)


def _resolve_target_date(action: dict, task_row: dict | None) -> tuple[str | None, str | None]:
    new_date = _safe_get(action, "new_date")
    if new_date:
        dt = _parse_datetime(new_date)
        if not dt:
            return None, "New date is invalid."
        return dt.date().isoformat(), None

    date_shift = _safe_get(action, "date_shift")
    if date_shift in (None, "", 0):
        return None, "New date is required for rescheduling."

    if not task_row:
        return None, "Task could not be loaded for rescheduling."

    base_start = task_row.get("scheduled_start")
    base_dt = _parse_datetime(base_start)
    if not base_dt:
        return None, "Task has no scheduled start date to shift from."

    try:
        shift_days = int(date_shift)
    except (TypeError, ValueError):
        return None, "Date shift is invalid."

    target_dt = base_dt + timedelta(days=shift_days)
    return target_dt.date().isoformat(), None


def _log_execution_result(action: dict, result_entry: dict, task_id_override=None):
    try:
        supabase.table("execution_logs").insert({
            "intent": result_entry["intent"],
            "success": result_entry["success"],
            "message": result_entry["message"],
            "project_id": _safe_get(action, "project_id"),
            "task_id": task_id_override if task_id_override is not None else _safe_get(action, "task_id"),
            "contact_id": _safe_get(action, "contact_id"),
        }).execute()
    except Exception as log_err:
        print(f"[execution] failed to log result: {log_err}")


def _load_contact_rows(contact_ids: list) -> list:
    if not contact_ids:
        return []

    response = (
        supabase.table("contacts")
        .select("id, name, phone, email")
        .in_("id", contact_ids)
        .execute()
    )
    return response.data or []


def _display_name(contact_row: dict) -> str:
    return contact_row.get("name") or str(contact_row.get("id"))


def _build_notify_result_message(contact_ids: list, intended_names: list[str]) -> str:
    if intended_names:
        preview_names = intended_names[:8]
        suffix = ""
        if len(intended_names) > 8:
            suffix = f", and {len(intended_names) - 8} more"
        return (
            f"Notification queued for {len(contact_ids)} contact"
            f"{'s' if len(contact_ids) != 1 else ''}: "
            f"{', '.join(preview_names)}{suffix}."
        )

    return f"Notification queued for {len(contact_ids)} contact{'s' if len(contact_ids) != 1 else ''}."


def _resolve_affected_contact_ids(action: dict, sibling: dict | None = None) -> list[str]:
    """Return owner-role contact IDs within the 3-week window for a notify_affected action."""
    project_id = _safe_get(action, "project_id")
    if not project_id:
        return []

    _anchor = (
        sibling["resolved_date"]
        if sibling and sibling.get("resolved_date")
        else date.today().isoformat()
    )
    _window_end = (date.fromisoformat(_anchor) + timedelta(days=21)).isoformat()

    try:
        tasks_resp = (
            supabase.table("tasks")
            .select("id, status")
            .eq("project_id", project_id)
            .gte("scheduled_start", _anchor)
            .lte("scheduled_start", _window_end)
            .execute()
        )
        task_rows = tasks_resp.data or []
    except Exception as e:
        print(f"[execution] _resolve_affected_contact_ids task query failed: {e}")
        return []

    task_ids = [
        t["id"] for t in task_rows
        if t.get("status") not in ("completed", "cancelled")
    ]
    if not task_ids:
        return []

    try:
        assignments_resp = (
            supabase.table("task_assignments")
            .select("contact_id, role")
            .in_("task_id", task_ids)
            .in_("role", ["lead", "support", "supplier"])
            .execute()
        )
        assignments_data = assignments_resp.data or []
    except Exception as e:
        print(f"[execution] _resolve_affected_contact_ids assignment query failed: {e}")
        return []

    return list({
        a["contact_id"]
        for a in assignments_data
        if a.get("contact_id")
    })


def preview_affected_contacts(actions: list) -> list[dict]:
    """Return {id, name} for contacts that would be notified by notify_affected actions.

    Uses the sibling reschedule's new_date as anchor when present in the same
    action list, mirroring execution behaviour as closely as possible.
    """
    reschedule_dates: dict[str, str] = {}
    for action in actions:
        if _safe_get(action, "intent") == "reschedule_task":
            proj = _safe_get(action, "project_id") or ""
            new_date = _safe_get(action, "new_date")
            if proj and new_date:
                reschedule_dates[proj] = new_date

    seen_ids: set[str] = set()
    result: list[dict] = []

    for action in actions:
        if not (_safe_get(action, "notify_affected") and _safe_get(action, "project_id")):
            continue

        proj_id = _safe_get(action, "project_id") or ""
        sibling_date = reschedule_dates.get(proj_id)
        sibling = {"resolved_date": sibling_date} if sibling_date else None

        contact_ids = _resolve_affected_contact_ids(action, sibling)
        if not contact_ids:
            continue

        rows = _load_contact_rows(contact_ids)
        for row in rows:
            cid = str(row.get("id") or "")
            if cid and cid not in seen_ids:
                seen_ids.add(cid)
                result.append({"id": cid, "name": _display_name(row)})

    return result


def execute_actions(actions: list) -> dict:
    results = []
    # Tracks reschedule outcomes keyed by project_id.
    # Sibling notify actions use this to avoid firing after a failed reschedule
    # and to cross-link their execution log entries to the affected task.
    reschedule_outcomes: dict = {}

    for action in actions:
        intent = _safe_get(action, "intent")

        if intent == "reschedule_task":
            task_id = _safe_get(action, "task_id")
            _rsk_proj = _safe_get(action, "project_id") or ""

            if not task_id:
                result_entry = {
                    "intent": "reschedule_task",
                    "success": False,
                    "message": "Task ID is required for rescheduling.",
                }
                results.append(result_entry)
                _log_execution_result(action, result_entry)
                if _rsk_proj:
                    reschedule_outcomes[_rsk_proj] = {"success": False, "task_id": None, "resolved_date": None}
                continue

            try:
                task_row = _load_task_row(task_id)
                target_date, date_error = _resolve_target_date(action, task_row)

                if date_error:
                    result_entry = {
                        "intent": "reschedule_task",
                        "success": False,
                        "message": date_error,
                    }
                    results.append(result_entry)
                    _log_execution_result(action, result_entry, task_id_override=task_id)
                    if _rsk_proj:
                        reschedule_outcomes[_rsk_proj] = {"success": False, "task_id": task_id, "resolved_date": None}
                    continue

                violation = _check_date_constraints(target_date)
                allow_non_business_day = bool(_safe_get(action, "allow_non_business_day", False))
                override_reason = (_safe_get(action, "override_reason") or "").strip()

                if violation and not allow_non_business_day:
                    result_entry = {
                        "intent": "reschedule_task",
                        "success": False,
                        "message": f"{violation} Override required to continue.",
                    }
                    results.append(result_entry)
                    _log_execution_result(action, result_entry, task_id_override=task_id)
                    if _rsk_proj:
                        reschedule_outcomes[_rsk_proj] = {"success": False, "task_id": task_id, "resolved_date": None}
                    continue

                if violation and allow_non_business_day and not override_reason:
                    result_entry = {
                        "intent": "reschedule_task",
                        "success": False,
                        "message": f"{violation} Please provide an override reason to continue.",
                    }
                    results.append(result_entry)
                    _log_execution_result(action, result_entry, task_id_override=task_id)
                    if _rsk_proj:
                        reschedule_outcomes[_rsk_proj] = {"success": False, "task_id": task_id, "resolved_date": None}
                    continue

                reschedule_result = cascade_task_reschedule(
                    task_id=task_id,
                    new_start=target_date,
                    new_end=None,
                    cascade=bool(_safe_get(action, "cascade") or False),
                )
                updated_task = reschedule_result.get("task") or {}

                if updated_task:
                    project_name = _safe_get(action, "project_name") or _load_project_name(
                        _safe_get(action, "project_id") or (task_row.get("project_id") if task_row else None)
                    )
                    task_name = _safe_get(action, "task_name") or (task_row.get("name") if task_row else None)

                    cascaded_count = reschedule_result.get("cascaded_count", 0)
                    cascade_line = (
                        f"This change shifted {cascaded_count} downstream task{'s' if cascaded_count != 1 else ''}."
                        if cascaded_count
                        else "No downstream schedule changes were applied."
                    )
                    detail_lines = []
                    if project_name:
                        detail_lines.append(f"Project: {project_name}")
                    detail_lines.append(f"Task: {task_name or task_id}")
                    detail_lines.append(f"New Date: {_format_date_human(target_date)}")
                    base_message = "Schedule Updated\n\n" + "\n".join(detail_lines) + "\n\n" + cascade_line

                    if violation and allow_non_business_day:
                        base_message += f"\n\nOverride approved: {override_reason}"

                    result_entry = {
                        "intent": "reschedule_task",
                        "success": True,
                        "message": base_message,
                    }
                    results.append(result_entry)
                    _log_execution_result(action, result_entry, task_id_override=task_id)
                    if _rsk_proj:
                        reschedule_outcomes[_rsk_proj] = {
                            "success": True,
                            "task_id": task_id,
                            "resolved_date": target_date,
                            "original_date": task_row.get("scheduled_start") if task_row else None,
                        }
                else:
                    result_entry = {
                        "intent": "reschedule_task",
                        "success": False,
                        "message": "Task not found or update failed.",
                    }
                    results.append(result_entry)
                    _log_execution_result(action, result_entry, task_id_override=task_id)
                    if _rsk_proj:
                        reschedule_outcomes[_rsk_proj] = {"success": False, "task_id": task_id, "resolved_date": None}
            except Exception as e:
                print(f"[execution] reschedule_task error: {e}")
                result_entry = {
                    "intent": "reschedule_task",
                    "success": False,
                    "message": "Failed to reschedule task.",
                }
                results.append(result_entry)
                _log_execution_result(action, result_entry, task_id_override=task_id)
                if _rsk_proj:
                    reschedule_outcomes[_rsk_proj] = {"success": False, "task_id": task_id, "resolved_date": None}

        elif intent == "notify_contacts":
            # Resolve sibling reschedule outcome: match by project_id, fall back to
            # the lone reschedule when only one exists (common in compound commands).
            _ntf_proj = _safe_get(action, "project_id") or ""
            _sibling = reschedule_outcomes.get(_ntf_proj)
            if _sibling is None and len(reschedule_outcomes) == 1:
                _sibling = next(iter(reschedule_outcomes.values()))

            # Block the notification when the linked reschedule failed — sending a
            # "task has been moved" message after a failed reschedule is misleading.
            if _sibling is not None and not _sibling["success"]:
                result_entry = {
                    "intent": "notify_contacts",
                    "success": False,
                    "message": "Notification skipped — the linked reschedule did not complete.",
                }
                results.append(result_entry)
                _log_execution_result(action, result_entry)
                continue

            try:
                contact_ids = []

                if _safe_get(action, "contact_id"):
                    contact_ids = [_safe_get(action, "contact_id")]
                elif _safe_get(action, "notify_affected") and _safe_get(action, "project_id"):
                    contact_ids = _resolve_affected_contact_ids(action, _sibling)
                else:
                    contact_ids = []

                if not contact_ids:
                    result_entry = {
                        "intent": "notify_contacts",
                        "success": False,
                        "message": "No contacts found to notify.",
                    }
                    results.append(result_entry)
                    _log_execution_result(action, result_entry)
                    continue

                notifications_data = []
                for contact_id in contact_ids:
                    notifications_data.append({
                        "project_id": _safe_get(action, "project_id"),
                        "contact_id": contact_id,
                        "type": "general",
                        "message": _safe_get(action, "message") or "Queued notification.",
                        "status": "pending",
                    })

                supabase.table("notifications").insert(notifications_data).execute()

                channel = (_safe_get(action, "channel") or "").lower()
                outbound_message = _safe_get(action, "message") or "Queued notification."
                contact_rows = _load_contact_rows(contact_ids)
                contacts_by_id = {row["id"]: row for row in contact_rows}
                intended_names = [
                    _display_name(contacts_by_id[cid])
                    for cid in contact_ids
                    if cid in contacts_by_id
                ]

                # --- per-contact message composition context ---
                # Loaded once here; used inside each send loop.
                # message_is_user_modified = True means the user edited the message
                # in the ActionPlanSheet — in that case, outbound_message is sent
                # verbatim and template composition is skipped entirely.
                _user_modified = bool(_safe_get(action, "message_is_user_modified"))
                _msg_task_id = _sibling["task_id"] if _sibling else None
                _msg_task_name = _safe_get(action, "task_name")
                _msg_new_date = (
                    (_sibling["resolved_date"] if _sibling else None)
                    or _safe_get(action, "new_date")
                )
                _msg_original_date = _sibling.get("original_date") if _sibling else None
                _msg_notify_affected = bool(_safe_get(action, "notify_affected"))
                _msg_proj_id = _safe_get(action, "project_id") or ""
                _msg_proj_row = None
                _msg_lookahead: list[dict] = []
                if not _user_modified and _msg_proj_id:
                    _msg_proj_row = _load_project_row(_msg_proj_id)
                    _msg_lookahead = _load_upcoming_tasks(_msg_proj_id, _msg_new_date)

                if channel == "sms":
                    if settings.demo_mode:
                        if not settings.demo_phone_number:
                            result_entry = {
                                "intent": "notify_contacts",
                                "success": False,
                                "message": "Demo mode is enabled, but DEMO_PHONE_NUMBER is not configured.",
                            }
                        else:
                            _demo_sms_msg = outbound_message
                            if not _user_modified and contact_rows:
                                _demo_first = contact_rows[0]
                                _demo_is_owner = _is_contact_assigned_to_task(
                                    _msg_task_id, str(_demo_first.get("id") or "")
                                )
                                _demo_sms_msg = _compose_outbound_message(
                                    contact_row=_demo_first,
                                    project_row=_msg_proj_row,
                                    task_name=_msg_task_name,
                                    new_date=_msg_new_date,
                                    original_date=_msg_original_date,
                                    lookahead_tasks=_msg_lookahead,
                                    is_task_owner=_demo_is_owner,
                                    notify_affected=_msg_notify_affected,
                                )
                            sms_result = send_sms(settings.demo_phone_number.strip(), _demo_sms_msg)
                            if sms_result.get("success"):
                                result_entry = {
                                    "intent": "notify_contacts",
                                    "success": True,
                                    "message": (
                                        f"Demo SMS sent to {settings.demo_phone_number.strip()} for "
                                        f"{len(contact_ids)} intended contact"
                                        f"{'s' if len(contact_ids) != 1 else ''}"
                                        + (
                                            f": {', '.join(intended_names)}."
                                            if intended_names
                                            else "."
                                        )
                                    ),
                                }
                            else:
                                result_entry = {
                                    "intent": "notify_contacts",
                                    "success": False,
                                    "message": (
                                        "Demo SMS delivery failed for intended contacts"
                                        + (
                                            f" {', '.join(intended_names)}"
                                            if intended_names
                                            else ""
                                        )
                                        + f": {sms_result.get('error') or 'Unknown SMS error.'}"
                                    ),
                                }
                    else:
                        missing_phone_contact_ids = []
                        sms_send_failures = []
                        sent_count = 0

                        for contact_id in contact_ids:
                            contact_row = contacts_by_id.get(contact_id)
                            phone = contact_row.get("phone") if contact_row else None

                            if not isinstance(phone, str) or not phone.strip():
                                missing_phone_contact_ids.append(str(contact_id))
                                continue

                            if _user_modified or not contact_row:
                                _sms_msg = outbound_message
                            else:
                                _is_owner = _is_contact_assigned_to_task(
                                    _msg_task_id, str(contact_id)
                                )
                                _sms_msg = _compose_outbound_message(
                                    contact_row=contact_row,
                                    project_row=_msg_proj_row,
                                    task_name=_msg_task_name,
                                    new_date=_msg_new_date,
                                    original_date=_msg_original_date,
                                    lookahead_tasks=_msg_lookahead,
                                    is_task_owner=_is_owner,
                                    notify_affected=_msg_notify_affected,
                                )
                            sms_result = send_sms(phone.strip(), _sms_msg)
                            if sms_result.get("success"):
                                sent_count += 1
                            else:
                                sms_send_failures.append({
                                    "contact_id": str(contact_id),
                                    "error": sms_result.get("error") or "Unknown SMS error.",
                                })

                        if sent_count == 0 and not sms_send_failures and missing_phone_contact_ids:
                            result_entry = {
                                "intent": "notify_contacts",
                                "success": False,
                                "message": "No valid phone numbers found for SMS delivery.",
                            }
                        elif sms_send_failures or missing_phone_contact_ids:
                            failure_parts = []
                            if missing_phone_contact_ids:
                                failure_parts.append(
                                    "missing phone numbers for contact IDs: "
                                    + ", ".join(missing_phone_contact_ids)
                                )
                            if sms_send_failures:
                                failure_parts.append(
                                    "SMS failed for contact IDs: "
                                    + ", ".join(failure["contact_id"] for failure in sms_send_failures)
                                )

                            if sent_count > 0:
                                message = (
                                    f"SMS sent to {sent_count} contact"
                                    f"{'s' if sent_count != 1 else ''}, but "
                                    + "; ".join(failure_parts)
                                    + "."
                                )
                            else:
                                message = "SMS delivery failed: " + "; ".join(failure_parts) + "."

                            result_entry = {
                                "intent": "notify_contacts",
                                "success": False,
                                "message": message,
                            }
                        else:
                            result_entry = {
                                "intent": "notify_contacts",
                                "success": True,
                                "message": f"SMS sent to {sent_count} contact{'s' if sent_count != 1 else ''}.",
                            }

                elif channel == "email":
                    if settings.demo_mode:
                        if not settings.demo_email_address:
                            result_entry = {
                                "intent": "notify_contacts",
                                "success": False,
                                "message": "Demo mode is enabled, but DEMO_EMAIL_ADDRESS is not configured.",
                            }
                        else:
                            _demo_email_msg = outbound_message
                            if not _user_modified and contact_rows:
                                _demo_first_e = contact_rows[0]
                                _demo_is_owner_e = _is_contact_assigned_to_task(
                                    _msg_task_id, str(_demo_first_e.get("id") or "")
                                )
                                _demo_email_msg = _compose_outbound_message(
                                    contact_row=_demo_first_e,
                                    project_row=_msg_proj_row,
                                    task_name=_msg_task_name,
                                    new_date=_msg_new_date,
                                    original_date=_msg_original_date,
                                    lookahead_tasks=_msg_lookahead,
                                    is_task_owner=_demo_is_owner_e,
                                    notify_affected=_msg_notify_affected,
                                )
                            email_result = send_email(settings.demo_email_address.strip(), _demo_email_msg)
                            if email_result.get("success"):
                                result_entry = {
                                    "intent": "notify_contacts",
                                    "success": True,
                                    "message": (
                                        f"Demo email sent to {settings.demo_email_address.strip()} for "
                                        f"{len(contact_ids)} intended contact"
                                        f"{'s' if len(contact_ids) != 1 else ''}"
                                        + (
                                            f": {', '.join(intended_names)}."
                                            if intended_names
                                            else "."
                                        )
                                    ),
                                }
                            else:
                                result_entry = {
                                    "intent": "notify_contacts",
                                    "success": False,
                                    "message": (
                                        "Demo email delivery failed for intended contacts"
                                        + (
                                            f" {', '.join(intended_names)}"
                                            if intended_names
                                            else ""
                                        )
                                        + f": {email_result.get('error') or 'Unknown email error.'}"
                                    ),
                                }
                    else:
                        missing_email_contact_ids = []
                        email_send_failures = []
                        sent_count = 0

                        for contact_id in contact_ids:
                            contact_row = contacts_by_id.get(contact_id)
                            email_address = contact_row.get("email") if contact_row else None

                            if not isinstance(email_address, str) or not email_address.strip():
                                missing_email_contact_ids.append(str(contact_id))
                                continue

                            if _user_modified or not contact_row:
                                _email_msg = outbound_message
                            else:
                                _is_owner_e = _is_contact_assigned_to_task(
                                    _msg_task_id, str(contact_id)
                                )
                                _email_msg = _compose_outbound_message(
                                    contact_row=contact_row,
                                    project_row=_msg_proj_row,
                                    task_name=_msg_task_name,
                                    new_date=_msg_new_date,
                                    original_date=_msg_original_date,
                                    lookahead_tasks=_msg_lookahead,
                                    is_task_owner=_is_owner_e,
                                    notify_affected=_msg_notify_affected,
                                )
                            email_result = send_email(email_address.strip(), _email_msg)
                            if email_result.get("success"):
                                sent_count += 1
                            else:
                                email_send_failures.append({
                                    "contact_id": str(contact_id),
                                    "error": email_result.get("error") or "Unknown email error.",
                                })

                        if sent_count == 0 and not email_send_failures and missing_email_contact_ids:
                            result_entry = {
                                "intent": "notify_contacts",
                                "success": False,
                                "message": "No valid email addresses found for email delivery.",
                            }
                        elif email_send_failures or missing_email_contact_ids:
                            failure_parts = []
                            if missing_email_contact_ids:
                                failure_parts.append(
                                    "missing email addresses for contact IDs: "
                                    + ", ".join(missing_email_contact_ids)
                                )
                            if email_send_failures:
                                failure_parts.append(
                                    "email failed for contact IDs: "
                                    + ", ".join(failure["contact_id"] for failure in email_send_failures)
                                )

                            if sent_count > 0:
                                message = (
                                    f"Email sent to {sent_count} contact"
                                    f"{'s' if sent_count != 1 else ''}, but "
                                    + "; ".join(failure_parts)
                                    + "."
                                )
                            else:
                                message = "Email delivery failed: " + "; ".join(failure_parts) + "."

                            result_entry = {
                                "intent": "notify_contacts",
                                "success": False,
                                "message": message,
                            }
                        else:
                            result_entry = {
                                "intent": "notify_contacts",
                                "success": True,
                                "message": f"Email sent to {sent_count} contact{'s' if sent_count != 1 else ''}.",
                            }

                else:
                    result_entry = {
                        "intent": "notify_contacts",
                        "success": True,
                        "message": _build_notify_result_message(contact_ids, intended_names),
                    }

            except Exception as e:
                print(f"[execution] notify_contacts error: {e}")
                result_entry = {
                    "intent": "notify_contacts",
                    "success": False,
                    "message": "Failed to queue notifications.",
                }

            results.append(result_entry)
            # Cross-link the log entry to the sibling task when one exists, creating
            # an explicit audit trail between the notification and the rescheduled task.
            _sibling_task_id = _sibling["task_id"] if _sibling else None
            _log_execution_result(action, result_entry, task_id_override=_sibling_task_id)

        elif intent == "complete_task":
            task_id = _safe_get(action, "task_id")

            if not task_id:
                result_entry = {
                    "intent": "complete_task",
                    "success": False,
                    "message": "Task ID is required to mark complete.",
                }
                results.append(result_entry)
                _log_execution_result(action, result_entry)
                continue

            try:
                project_name = _safe_get(action, "project_name")
                check_result = _check_sequence_constraints(task_id)
                if check_result:
                    sequence_violation, unmet_prereqs = check_result
                    if project_name:
                        sequence_violation = f"[{project_name}] {sequence_violation}"
                    result_entry = {
                        "intent": "complete_task",
                        "success": False,
                        "message": sequence_violation,
                        "blocked_by": unmet_prereqs,
                    }
                    results.append(result_entry)
                    _log_execution_result(action, result_entry, task_id_override=task_id)
                    continue

                response = (
                    supabase.table("tasks")
                    .update({"status": "completed"})
                    .eq("id", task_id)
                    .execute()
                )

                if response.data:
                    task_row = response.data[0]
                    task_name = _safe_get(action, "task_name") or task_row.get("name") or task_id
                    project_name = _safe_get(action, "project_name") or _load_project_name(
                        _safe_get(action, "project_id") or task_row.get("project_id")
                    )
                    result_entry = {
                        "intent": "complete_task",
                        "success": True,
                        "message": (
                            f"Task '{task_name}'"
                            + (f" on {project_name}" if project_name else "")
                            + " marked as completed."
                        ),
                    }
                else:
                    result_entry = {
                        "intent": "complete_task",
                        "success": False,
                        "message": "Task not found or update failed.",
                    }

                results.append(result_entry)
                _log_execution_result(action, result_entry, task_id_override=task_id)

            except Exception as e:
                print(f"[execution] complete_task error: {e}")
                result_entry = {
                    "intent": "complete_task",
                    "success": False,
                    "message": "Failed to mark task as completed.",
                }
                results.append(result_entry)
                _log_execution_result(action, result_entry, task_id_override=task_id)

        elif intent == "reassign_task":
            result_entry = {
                "intent": "reassign_task",
                "success": False,
                "message": (
                    "Task reassignment is not yet available from voice commands. "
                    "Please reassign from the task detail view inside the project."
                ),
            }
            results.append(result_entry)
            _log_execution_result(action, result_entry)

        elif intent == "create_project":
            result_entry = {
                "intent": "create_project",
                "success": False,
                "message": (
                    "Creating a new project from voice commands is not yet available. "
                    "Please use the New Project button in the Projects tab."
                ),
            }
            results.append(result_entry)
            _log_execution_result(action, result_entry)

        elif intent == "query_schedule":
            result_entry = {
                "intent": "query_schedule",
                "success": False,
                "message": (
                    "Schedule queries from voice commands are not yet available. "
                    "Please open the project directly to view its schedule."
                ),
            }
            results.append(result_entry)
            _log_execution_result(action, result_entry)

        else:
            print(f"[execution] unsupported intent: {intent}")
            result_entry = {
                "intent": str(intent),
                "success": False,
                "message": f"Intent '{intent}' is not supported yet.",
            }
            results.append(result_entry)
            _log_execution_result(action, result_entry)

    return {"results": results}
