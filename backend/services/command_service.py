"""
services/command_service.py — Rule-based command parser for Ja Lite.

Parses Jeff's free-text commands into structured ParsedAction objects.
Does NOT execute any actions — execution is handled in later modules.

Parsing strategy:
  1. Normalise input to lowercase for keyword matching
  2. Classify primary intent from trigger words
  3. Detect secondary intent (compound commands)
  4. Extract entity fragments (project, task, contact, date)
  5. Resolve fragments against live DB records (fuzzy name match)
  6. Set confidence level and collect ambiguity warnings
  7. Build user-facing summary text
"""

import os
import re
from datetime import date, timedelta
from typing import Optional

from database import supabase
from models.command import (
    CommandParseResponse,
    ConfidenceLevel,
    IntentCategory,
    NotificationChannel,
    ParsedAction,
)

# ---------------------------------------------------------------------------
# Intent keyword maps
# ---------------------------------------------------------------------------

_RESCHEDULE_TRIGGERS = {
    "move", "push", "shift", "delay", "reschedule", "change date",
    "change the date", "put back", "bring forward", "bump",
}

_NOTIFY_TRIGGERS = {
    "notify", "let them know", "let everyone know", "send update",
    "update everyone", "alert",
}

_TEXT_TRIGGERS = {"text", "sms", "message", "whatsapp"}

_EMAIL_TRIGGERS = {"email", "send an email", "shoot an email"}

_REASSIGN_TRIGGERS = {
    "reassign", "swap", "replace", "swap out", "change sub",
    "assign instead", "give to", "hand to",
}

_CREATE_TRIGGERS = {
    "new start", "create project", "new project", "onboard",
    "set up a project", "start a project", "add a project",
}

_QUERY_TRIGGERS = {
    "what's on", "what is on", "show me", "list", "check",
    "who is", "who's on", "what tasks", "schedule for",
}

_COMPLETE_TRIGGERS = {
    "passed", "completed", "complete", "done", "signed off",
    "passed inspection", "inspection passed", "mark as complete",
    "mark complete", "mark done",
}

# ---------------------------------------------------------------------------
# Date resolution
# ---------------------------------------------------------------------------

_WEEKDAY_NAMES = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}

_SHIFT_PATTERNS = [
    (re.compile(r"\bone day\b"), 1),
    (re.compile(r"\btwo days\b"), 2),
    (re.compile(r"\bthree days\b"), 3),
    (re.compile(r"\ba week\b"), 7),
    (re.compile(r"\bone week\b"), 7),
    (re.compile(r"\btwo weeks\b"), 14),
    (re.compile(r"\bout\s+(\d+)\s+days?\b", re.IGNORECASE), None),
    (re.compile(r"(\d+)\s+days?\b", re.IGNORECASE), None),
]

_ISO_DATE_RE = re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")

_SLASH_DATE_RE = re.compile(r"\b(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))\b")

_SHORT_MD_RE = re.compile(r"\b(\d{1,2})[/\-](\d{1,2})\b")

_DAY_MONTH_RE = re.compile(
    r"\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|"
    r"may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|"
    r"nov(?:ember)?|dec(?:ember)?)\b",
    re.IGNORECASE,
)

# Matches "May 25 2026", "May 25th 2026", "May 25th, 2026" (month-first with optional ordinal and year)
_MONTH_DAY_RE = re.compile(
    r"\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|"
    r"may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|"
    r"nov(?:ember)?|dec(?:ember)?)\s+"
    r"(\d{1,2})(?:st|nd|rd|th)?"
    r"(?:\s*,?\s*(\d{4}))?\b",
    re.IGNORECASE,
)

_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

_PUNCT_RE = re.compile(r"[^a-z0-9\s]")
_WS_RE = re.compile(r"\s+")


def _normalize_text(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    text = _PUNCT_RE.sub(" ", text.lower())
    return _WS_RE.sub(" ", text).strip()


def _stem_tokens(text: str) -> set[str]:
    """Normalize and return tokens with a basic plural 's' stripped (min length 4)."""
    tokens = _normalize_text(text).split()
    return {t[:-1] if t.endswith("s") and len(t) > 3 else t for t in tokens}


def _token_prefix_score(fragment_stems: set[str], value_stems: set[str], min_len: int = 5) -> int:
    """Count long fragment tokens that prefix-match any long token in the task's stems."""
    if not fragment_stems or not value_stems:
        return 0
    return sum(
        1 for tok in fragment_stems
        if len(tok) >= min_len and any(
            len(t) >= min_len and len(os.path.commonprefix([tok, t])) >= 4
            for t in value_stems
        )
    )


def _next_weekday(weekday: int, today: date) -> date:
    days_ahead = weekday - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return today + timedelta(days=days_ahead)


def _resolve_date(text: str) -> tuple[Optional[str], Optional[int]]:
    """
    Return (iso_date_string, day_shift) from natural language.
    Exactly one of the two will be set; both None means no date found.
    """
    lower = text.lower()
    today = date.today()

    if "tomorrow" in lower:
        return (today + timedelta(days=1)).isoformat(), None

    if "today" in lower:
        return today.isoformat(), None

    for name, idx in _WEEKDAY_NAMES.items():
        if re.search(rf"\b{name}\b", lower):
            return _next_weekday(idx, today).isoformat(), None

    if "next week" in lower:
        return (today + timedelta(days=(7 - today.weekday()))).isoformat(), None

    iso_match = _ISO_DATE_RE.search(text)
    if iso_match:
        try:
            year = int(iso_match.group(1))
            month = int(iso_match.group(2))
            day = int(iso_match.group(3))
            return date(year, month, day).isoformat(), None
        except ValueError:
            pass

    slash_match = _SLASH_DATE_RE.search(text)
    if slash_match:
        try:
            month = int(slash_match.group(1))
            day = int(slash_match.group(2))
            year = int(slash_match.group(3))
            if year < 100:
                year += 2000
            return date(year, month, day).isoformat(), None
        except ValueError:
            pass

    short_md_match = _SHORT_MD_RE.search(text)
    if short_md_match:
        try:
            month = int(short_md_match.group(1))
            day = int(short_md_match.group(2))
            resolved = date(today.year, month, day)
            if resolved < today:
                resolved = date(today.year + 1, month, day)
            return resolved.isoformat(), None
        except ValueError:
            pass

    month_day_match = _MONTH_DAY_RE.search(text)
    if month_day_match:
        try:
            month_abbr = month_day_match.group(1)[:3].lower()
            month = _MONTH_MAP.get(month_abbr, today.month)
            day = int(month_day_match.group(2))
            explicit_year = month_day_match.group(3)
            year = int(explicit_year) if explicit_year else today.year
            resolved = date(year, month, day)
            if not explicit_year and resolved < today:
                resolved = date(year + 1, month, day)
            return resolved.isoformat(), None
        except ValueError:
            pass

    day_month_match = _DAY_MONTH_RE.search(text)
    if day_month_match:
        try:
            day = int(day_month_match.group(1))
            month_abbr = day_month_match.group(2)[:3].lower()
            month = _MONTH_MAP.get(month_abbr, today.month)
            resolved = date(today.year, month, day)
            if resolved < today:
                resolved = date(today.year + 1, month, day)
            return resolved.isoformat(), None
        except ValueError:
            pass

    for pattern, shift in _SHIFT_PATTERNS:
        if shift is not None:
            if pattern.search(lower):
                return None, shift
        else:
            hit = pattern.search(lower)
            if hit:
                return None, int(hit.group(1))

    return None, None


# ---------------------------------------------------------------------------
# DB resolution helpers
# ---------------------------------------------------------------------------

def _fuzzy_match_all(
    fragment: str, records: list[dict], key: str
) -> tuple[list[dict], list[dict]]:
    """
    Return (exact_matches, partial_matches) for fragment against records[key].

    exact_matches  — key equals fragment (case/punct-insensitive); order preserved
    partial_matches — key contains or token-overlaps fragment, sorted by key length ascending

    Match tiers applied (in order):
      1. Exact string match (case-insensitive)
      2. Normalized exact match (punctuation stripped)
      3. Substring match (case-insensitive)
      4. Normalized substring match
      5. Token prefix score: count long fragment tokens that prefix-match task stems.
         Requires score >= 2 for multi-token fragments, >= 1 for single-token.
         If exactly one candidate has the best score >= 2, it is auto-confirmed.
    """
    fragment_lower = fragment.lower().strip()
    if not fragment_lower:
        return [], []

    fragment_norm = _normalize_text(fragment)
    fragment_stems = _stem_tokens(fragment)
    long_count = sum(1 for t in fragment_stems if len(t) >= 5)
    min_score = 2 if long_count >= 2 else 1 if long_count >= 1 else 0

    exact: list[dict] = []
    partial: list[tuple[int, int, dict]] = []  # (value_len, score, rec)

    for rec in records:
        value = str(rec.get(key, "")).strip()
        value_lower = value.lower()
        if not value_lower:
            continue

        value_norm = _normalize_text(value)
        value_stems = _stem_tokens(value)

        if value_lower == fragment_lower or value_norm == fragment_norm:
            exact.append(rec)
        elif fragment_lower in value_lower or fragment_norm in value_norm:
            partial.append((len(value_lower), 0, rec))
        elif fragment_stems and value_stems and min_score > 0:
            score = _token_prefix_score(fragment_stems, value_stems)
            if score >= min_score:
                partial.append((len(value_lower), score, rec))

    # Auto-confirm: if exactly one partial has the best score >= 2, treat as exact
    if not exact and partial and min_score >= 2:
        best_score = max(s for _, s, _ in partial)
        if best_score >= 2:
            top = [rec for _, s, rec in partial if s == best_score]
            if len(top) == 1:
                exact.append(top[0])
                partial = [(ln, s, rec) for ln, s, rec in partial if rec is not top[0]]

    partial.sort(key=lambda item: item[0])
    return exact, [item[2] for item in partial]


def _fuzzy_match(fragment: str, records: list[dict], key: str) -> Optional[dict]:
    """Return the single best match. Callers needing ambiguity detection use _fuzzy_match_all."""
    exact, partial = _fuzzy_match_all(fragment, records, key)
    if exact:
        return exact[0]
    if partial:
        return partial[0]
    return None


def _load_projects() -> list[dict]:
    return supabase.table("projects").select("id, name, address").execute().data


def _load_tasks(project_id: Optional[str] = None) -> list[dict]:
    q = supabase.table("tasks").select("id, name, project_id, scheduled_start, scheduled_end")
    if project_id:
        q = q.eq("project_id", project_id)
    return q.execute().data


def _load_contacts() -> list[dict]:
    return supabase.table("contacts").select("id, name, contact_type").execute().data


def _load_templates() -> list[dict]:
    return supabase.table("project_templates").select("id, name").execute().data


# ---------------------------------------------------------------------------
# Intent classification
# ---------------------------------------------------------------------------

def _contains_any(text: str, keywords: set[str]) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in keywords)


def _classify_channel(text: str) -> Optional[NotificationChannel]:
    lower = text.lower()
    if any(kw in lower for kw in _EMAIL_TRIGGERS):
        return NotificationChannel.email
    if any(kw in lower for kw in _TEXT_TRIGGERS):
        return NotificationChannel.sms
    return None


def _classify_primary_intent(text: str) -> IntentCategory:
    if _contains_any(text, _CREATE_TRIGGERS):
        return IntentCategory.create_project

    first_word = text.lower().split()[0] if text.split() else ""
    starts_with_notify = (
        first_word in _NOTIFY_TRIGGERS
        or first_word in _TEXT_TRIGGERS
        or first_word in _EMAIL_TRIGGERS
    )

    if starts_with_notify:
        return IntentCategory.notify_contacts

    if _contains_any(text, _RESCHEDULE_TRIGGERS):
        return IntentCategory.reschedule_task
    if _contains_any(text, _REASSIGN_TRIGGERS):
        return IntentCategory.reassign_task

    channel = _classify_channel(text)
    if channel == NotificationChannel.email:
        return IntentCategory.notify_contacts
    if channel == NotificationChannel.sms:
        return IntentCategory.notify_contacts
    if _contains_any(text, _NOTIFY_TRIGGERS):
        return IntentCategory.notify_contacts

    if _contains_any(text, _QUERY_TRIGGERS):
        return IntentCategory.query_schedule

    if _contains_any(text, _COMPLETE_TRIGGERS):
        return IntentCategory.complete_task

    return IntentCategory.unknown


def _has_notify_component(text: str) -> bool:
    return _contains_any(text, _NOTIFY_TRIGGERS | _TEXT_TRIGGERS | _EMAIL_TRIGGERS)


def _notify_everyone(text: str) -> bool:
    lower = text.lower()
    return any(phrase in lower for phrase in (
        "everyone", "all affected", "everyone affected",
        "all parties", "notify all", "let everyone",
    ))


# ---------------------------------------------------------------------------
# Entity extraction
# ---------------------------------------------------------------------------

_PROJECT_STOPWORDS = {
    "to", "for", "next", "tomorrow", "today", "notify", "text", "email",
    "message", "whatsapp", "and", "with", "by", "on", "at",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
}

_CONTACT_STOPWORDS = {
    "everyone", "everybody", "all", "team", "crew", "them", "all affected",
}

_TASK_KEYWORDS = re.compile(
    r"\b(drywall|framing|plumbing|electrical|foundation|roofing|tiling|painting|"
    r"concrete|rendering|flooring|insulation|rough[- ]in|fit[- ]out|lock[- ]up|"
    r"handover|inspection|slab|brickwork|carpentry|cabinetry|landscaping)\b",
    re.IGNORECASE,
)

# Matches "send [name] a|an text|email|message|call|whatsapp ..."
_SEND_CONTACT_RE = re.compile(
    r"\bsend\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(?:a|an)\s+"
    r"(?:text|email|message|call|whatsapp)\b",
    re.IGNORECASE,
)


def _clean_entity_fragment(fragment: str) -> str:
    if not fragment:
        return ""

    text = fragment.strip(" ,.-")
    tokens = text.split()
    cleaned: list[str] = []

    for token in tokens:
        stripped = re.sub(r"[^\w\-\/]", "", token).lower()
        if stripped in _PROJECT_STOPWORDS:
            break
        cleaned.append(token)

    return " ".join(cleaned).strip(" ,.-")


def _extract_project_fragment(text: str) -> Optional[str]:
    patterns = [
        re.compile(r"\bon\s+(.+)", re.IGNORECASE),
        re.compile(r"\bat\s+(.+)", re.IGNORECASE),
        re.compile(r"\bfor\s+(.+)", re.IGNORECASE),
    ]

    for pattern in patterns:
        m = pattern.search(text)
        if m:
            candidate = _clean_entity_fragment(m.group(1))
            if candidate and candidate.lower() not in _PROJECT_STOPWORDS:
                return candidate

    return None


def _extract_task_fragment(text: str) -> Optional[str]:
    """
    Prefer the explicit task phrase following a reschedule trigger.
    Falls back to keyword detection if no phrase is found.
    """
    explicit_patterns = [
        re.compile(
            r"\b(?:move|push|shift|delay|reschedule|bump|put back|bring forward)\s+(.+?)"
            r"(?=\s+(?:on|to|out|by|and\s+notify|and\s+text|and\s+email|and)\b|$)",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b(?:change\s+the\s+date|change\s+date)\s+of\s+(.+?)"
            r"(?=\s+(?:on|to|out|by|and)\b|$)",
            re.IGNORECASE,
        ),
        re.compile(
            r"^(.+?)(?=\s+(?:\d+\s+(?:days?|weeks?)|next\s+week|tomorrow|today|"
            r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2})\b)",
            re.IGNORECASE,
        ),
    ]

    for pattern in explicit_patterns:
        m = pattern.search(text)
        if m:
            candidate = m.group(1).strip(" .,-")
            candidate = re.sub(r"\s+\d+\s+days?\b", "", candidate, flags=re.IGNORECASE).strip(" ,-")
            candidate = re.sub(r"\s+\d+\s+weeks?\b", "", candidate, flags=re.IGNORECASE).strip(" ,-")
            if candidate:
                return candidate

    m = _TASK_KEYWORDS.search(text)
    return m.group(0) if m else None


def _extract_contact_fragment(text: str) -> Optional[str]:
    # Primary pattern: keyword-first form — "text Dave Peterson about ..."
    pattern = re.compile(
        r"\b(?:text|email|notify|ask|call|message|whatsapp)\s+"
        r"([a-zA-Z]+(?:\s+[a-zA-Z]+)?)"
        r"(?=\s+(?:about|regarding|re|on|for|at|to|that|with|tomorrow|today|next)\b|$)",
        re.IGNORECASE,
    )

    m = pattern.search(text)

    # Fallback pattern: "send [name] a|an [keyword]" natural phrasing
    if not m:
        m = _SEND_CONTACT_RE.search(text)

    if not m:
        return None

    candidate = m.group(1).strip()
    if not candidate:
        return None

    candidate_words = candidate.split()
    if len(candidate_words) == 1 and candidate_words[0].lower() in _CONTACT_STOPWORDS:
        return None

    candidate = " ".join(word.capitalize() for word in candidate_words)

    if candidate.lower() in _CONTACT_STOPWORDS:
        return None

    return candidate


def _extract_message_fragment(text: str) -> Optional[str]:
    patterns = [
        re.compile(r"\babout\s+(.+)$", re.IGNORECASE),
        re.compile(r"\bregarding\s+(.+)$", re.IGNORECASE),
        re.compile(r"\bre\s+(.+)$", re.IGNORECASE),
        re.compile(r"\bthat\s+(.+)$", re.IGNORECASE),
    ]

    for pattern in patterns:
        m = pattern.search(text)
        if m:
            message = m.group(1).strip(" .,-")
            if message:
                return message

    return None


def _extract_template_fragment(text: str) -> Optional[str]:
    pattern = re.compile(r"\b(?:using|with)\s+(?:the\s+)?(.+?)(?:\s+template|$)", re.IGNORECASE)
    m = pattern.search(text)
    return m.group(1).strip() if m else None


def _extract_complete_fragment(text: str) -> Optional[str]:
    """Extract the task name from a completion command."""
    trigger_prefix_pattern = re.compile(
        r"^(?:complete|done|mark\s+complete)\s+(.+?)$",
        re.IGNORECASE,
    )
    m = trigger_prefix_pattern.search(text)
    if m:
        return m.group(1).strip(" ,.-")

    mark_pattern = re.compile(
        r"\bmark\s+(.+?)\s+(?:as\s+)?(?:complete|done|completed|finished)\b",
        re.IGNORECASE,
    )
    m = mark_pattern.search(text)
    if m:
        return m.group(1).strip(" ,.-")

    subject_pattern = re.compile(
        r"^(?:the\s+)?(.+?)\s+(?:has\s+|is\s+)?(?:passed|done|complete|completed|signed\s+off)\b",
        re.IGNORECASE,
    )
    m = subject_pattern.search(text)
    if m:
        fragment = m.group(1).strip(" ,.-")
        if fragment:
            return fragment

    m = _TASK_KEYWORDS.search(text)
    return m.group(0) if m else None


def _split_complete_fragments(fragment: str) -> list[str]:
    parts = re.split(r",|\band\b", fragment, flags=re.IGNORECASE)
    return [p.strip(" ,.-") for p in parts if p.strip(" ,.-")]


# ---------------------------------------------------------------------------
# Summary builders
# ---------------------------------------------------------------------------

def _build_summary(intent: IntentCategory, action: ParsedAction) -> str:
    proj = action.project_name or "unknown project"
    task = action.task_name or "unknown task"
    who = action.contact_name or "all affected contacts"
    when = action.new_date or (f"+{action.date_shift} day(s)" if action.date_shift else "unspecified date")

    if intent == IntentCategory.reschedule_task:
        return f"You are about to reschedule '{task}' on {proj} to {when}."
    if intent == IntentCategory.notify_contacts:
        ch = f" via {action.channel.value}" if action.channel else ""
        if action.notify_affected:
            target = "all affected contacts"
        elif action.contact_name:
            target = action.contact_name
        else:
            target = "selected contact"
        return f"Notify {target}{ch} about changes to {proj}."
    if intent == IntentCategory.reassign_task:
        return f"Reassign '{task}' on {proj} to {who} on {when}."
    if intent == IntentCategory.create_project:
        tpl = f" using {action.template_name}" if action.template_name else ""
        return f"Create new project '{proj}'{tpl}."
    if intent == IntentCategory.query_schedule:
        return f"Show schedule for {proj}."
    if intent == IntentCategory.complete_task:
        return f"Mark '{task}' on {proj} as completed."
    return "Command not recognised — please rephrase."


# ---------------------------------------------------------------------------
# Action builders
# ---------------------------------------------------------------------------

def _build_reschedule_action(
    text: str,
    projects: list[dict],
    tasks: list[dict],
) -> ParsedAction:
    ambiguities: list[str] = []
    new_date, date_shift = _resolve_date(text)

    proj_fragment = _extract_project_fragment(text)
    task_fragment = _extract_task_fragment(text)

    project_id = project_name = None
    if proj_fragment:
        rec = _fuzzy_match(proj_fragment, projects, "name") or _fuzzy_match(proj_fragment, projects, "address")
        if rec:
            project_id, project_name = str(rec["id"]), rec["name"]
        else:
            ambiguities.append(f"Project '{proj_fragment}' not found.")
    else:
        ambiguities.append("Project not specified.")

    task_id = task_name = None
    task_candidates: list[dict] = []
    if task_fragment:
        scoped = [t for t in tasks if t.get("project_id") == project_id] if project_id else tasks
        exact_tasks, partial_tasks = _fuzzy_match_all(task_fragment, scoped, "name")
        candidates = exact_tasks or partial_tasks
        if len(candidates) == 1:
            task_id, task_name = str(candidates[0]["id"]), candidates[0]["name"]
        elif len(candidates) > 1:
            task_candidates = [{"id": str(c["id"]), "name": c["name"], "project_id": str(c.get("project_id") or ""), "scheduled_start": c.get("scheduled_start") or "", "scheduled_end": c.get("scheduled_end") or ""} for c in candidates]
            names = ", ".join(c["name"] for c in candidates[:3])
            ambiguities.append(f"Multiple tasks match '{task_fragment}': {names}. Please be more specific.")
        else:
            frag_stems_fb = _stem_tokens(task_fragment)
            def _score(t: dict) -> int:
                t_stems = _stem_tokens(t.get("name", ""))
                return sum(
                    1 for tok in frag_stems_fb
                    if len(tok) >= 5 and any(len(ts) >= 5 and (ts.startswith(tok) or tok.startswith(ts)) for ts in t_stems)
                )
            scored = [(t, _score(t)) for t in scoped]
            best = max((s for _, s in scored), default=0)
            if best > 0:
                scored.sort(key=lambda x: (-x[1], x[0].get("scheduled_start") or ""))
            else:
                scored.sort(key=lambda x: x[0].get("scheduled_start") or "")
            task_candidates = [
                {"id": str(t["id"]), "name": t["name"], "project_id": str(t.get("project_id") or ""), "scheduled_start": t.get("scheduled_start") or "", "scheduled_end": t.get("scheduled_end") or ""}
                for t, _ in scored[:10]
            ]
            ambiguities.append(f"Task '{task_fragment}' not found.")
    else:
        ambiguities.append("Task not specified.")

    if not new_date and not date_shift:
        ambiguities.append("Target date not specified.")

    notify = _notify_everyone(text)
    confidence = ConfidenceLevel.high if not ambiguities else ConfidenceLevel.low

    action = ParsedAction(
        intent=IntentCategory.reschedule_task,
        project_id=project_id,
        project_name=project_name,
        task_id=task_id,
        task_name=task_name,
        task_candidates=task_candidates,
        new_date=new_date,
        date_shift=date_shift,
        notify_affected=notify,
        confidence=confidence,
        ambiguities=ambiguities,
        requires_confirmation=True,
    )
    action.summary = _build_summary(IntentCategory.reschedule_task, action)
    return action


def _build_notify_action(
    text: str,
    projects: list[dict],
    contacts: list[dict],
    channel: Optional[NotificationChannel],
) -> ParsedAction:
    ambiguities: list[str] = []

    proj_fragment = _extract_project_fragment(text)
    contact_fragment = _extract_contact_fragment(text)
    message_fragment = _extract_message_fragment(text)
    everyone = _notify_everyone(text)

    project_id = project_name = None
    if proj_fragment:
        rec = _fuzzy_match(proj_fragment, projects, "name") or _fuzzy_match(proj_fragment, projects, "address")
        if rec:
            project_id, project_name = str(rec["id"]), rec["name"]
        else:
            ambiguities.append(f"Project '{proj_fragment}' not found.")

    if not project_id and message_fragment:
        _msg_proj = re.sub(r"^(?:the|a|an)\s+", "", message_fragment, flags=re.IGNORECASE).strip()
        rec = (
            _fuzzy_match(_msg_proj, projects, "name")
            or _fuzzy_match(_msg_proj, projects, "address")
            or _fuzzy_match(message_fragment, projects, "name")
            or _fuzzy_match(message_fragment, projects, "address")
        )
        if rec:
            project_id, project_name = str(rec["id"]), rec["name"]
            message_fragment = None

    contact_id = contact_name = None
    contact_candidates: list[dict] = []
    if contact_fragment and not everyone:
        rec = _fuzzy_match(contact_fragment, contacts, "name")
        if rec:
            contact_id, contact_name = str(rec["id"]), rec["name"]
        else:
            contact_candidates = [
                {"id": str(c["id"]), "name": c["name"]}
                for c in sorted(contacts, key=lambda c: c.get("name") or "")
            ]
            ambiguities.append(f"Contact '{contact_fragment}' not found.")

    if not project_id and not everyone and not contact_id:
        ambiguities.append("Neither project nor contact could be identified.")

    confidence = ConfidenceLevel.high if not ambiguities else ConfidenceLevel.low

    action = ParsedAction(
        intent=IntentCategory.notify_contacts,
        project_id=project_id,
        project_name=project_name,
        contact_id=contact_id,
        contact_name=contact_name,
        contact_candidates=contact_candidates,
        notify_affected=everyone,
        channel=channel,
        message=message_fragment,
        confidence=confidence,
        ambiguities=ambiguities,
        requires_confirmation=True,
    )
    action.summary = _build_summary(IntentCategory.notify_contacts, action)
    return action


def _build_reassign_action(
    text: str,
    projects: list[dict],
    tasks: list[dict],
    contacts: list[dict],
) -> ParsedAction:
    ambiguities: list[str] = []
    new_date, date_shift = _resolve_date(text)

    proj_fragment = _extract_project_fragment(text)
    task_fragment = _extract_task_fragment(text)
    contact_fragment = _extract_contact_fragment(text)

    project_id = project_name = None
    if proj_fragment:
        rec = _fuzzy_match(proj_fragment, projects, "name") or _fuzzy_match(proj_fragment, projects, "address")
        if rec:
            project_id, project_name = str(rec["id"]), rec["name"]
        else:
            ambiguities.append(f"Project '{proj_fragment}' not found.")
    else:
        ambiguities.append("Project not specified.")

    task_id = task_name = None
    task_candidates: list[dict] = []
    if task_fragment:
        scoped = [t for t in tasks if t.get("project_id") == project_id] if project_id else tasks
        exact_tasks, partial_tasks = _fuzzy_match_all(task_fragment, scoped, "name")
        candidates = exact_tasks or partial_tasks
        if len(candidates) == 1:
            task_id, task_name = str(candidates[0]["id"]), candidates[0]["name"]
        elif len(candidates) > 1:
            task_candidates = [{"id": str(c["id"]), "name": c["name"], "project_id": str(c.get("project_id") or ""), "scheduled_start": c.get("scheduled_start") or "", "scheduled_end": c.get("scheduled_end") or ""} for c in candidates]
            names = ", ".join(c["name"] for c in candidates[:3])
            ambiguities.append(f"Multiple tasks match '{task_fragment}': {names}. Please be more specific.")
        else:
            frag_stems_fb = _stem_tokens(task_fragment)
            def _score(t: dict) -> int:
                t_stems = _stem_tokens(t.get("name", ""))
                return sum(
                    1 for tok in frag_stems_fb
                    if len(tok) >= 5 and any(len(ts) >= 5 and (ts.startswith(tok) or tok.startswith(ts)) for ts in t_stems)
                )
            scored = [(t, _score(t)) for t in scoped]
            best = max((s for _, s in scored), default=0)
            if best > 0:
                scored.sort(key=lambda x: (-x[1], x[0].get("scheduled_start") or ""))
            else:
                scored.sort(key=lambda x: x[0].get("scheduled_start") or "")
            task_candidates = [
                {"id": str(t["id"]), "name": t["name"], "project_id": str(t.get("project_id") or ""), "scheduled_start": t.get("scheduled_start") or "", "scheduled_end": t.get("scheduled_end") or ""}
                for t, _ in scored[:10]
            ]
            ambiguities.append(f"Task '{task_fragment}' not found.")
    else:
        ambiguities.append("Task not specified.")

    contact_id = contact_name = None
    contact_candidates: list[dict] = []
    if contact_fragment:
        rec = _fuzzy_match(contact_fragment, contacts, "name")
        if rec:
            contact_id, contact_name = str(rec["id"]), rec["name"]
        else:
            contact_candidates = [
                {"id": str(c["id"]), "name": c["name"]}
                for c in sorted(contacts, key=lambda c: c.get("name") or "")
            ]
            ambiguities.append(f"Contact '{contact_fragment}' not found.")
    else:
        ambiguities.append("Contact not specified.")

    confidence = ConfidenceLevel.high if not ambiguities else ConfidenceLevel.low

    action = ParsedAction(
        intent=IntentCategory.reassign_task,
        project_id=project_id,
        project_name=project_name,
        task_id=task_id,
        task_name=task_name,
        task_candidates=task_candidates,
        contact_id=contact_id,
        contact_name=contact_name,
        contact_candidates=contact_candidates,
        new_date=new_date,
        date_shift=date_shift,
        confidence=confidence,
        ambiguities=ambiguities,
        requires_confirmation=True,
    )
    action.summary = _build_summary(IntentCategory.reassign_task, action)
    return action


def _build_create_project_action(
    text: str,
    projects: list[dict],
    templates: list[dict],
) -> ParsedAction:
    ambiguities: list[str] = []

    proj_fragment = _extract_project_fragment(text)
    tpl_fragment = _extract_template_fragment(text)

    project_name = proj_fragment or None
    if not project_name:
        ambiguities.append("Project name or address not specified.")

    template_id = template_name = None
    if tpl_fragment:
        rec = _fuzzy_match(tpl_fragment, templates, "name")
        if rec:
            template_id, template_name = str(rec["id"]), rec["name"]
        else:
            ambiguities.append(f"Template '{tpl_fragment}' not found.")

    confidence = ConfidenceLevel.high if not ambiguities else ConfidenceLevel.low

    action = ParsedAction(
        intent=IntentCategory.create_project,
        project_name=project_name,
        template_name=template_name,
        confidence=confidence,
        ambiguities=ambiguities,
        requires_confirmation=True,
    )
    action.summary = _build_summary(IntentCategory.create_project, action)
    return action


def _build_query_action(text: str, projects: list[dict]) -> ParsedAction:
    proj_fragment = _extract_project_fragment(text)
    project_id = project_name = None

    if proj_fragment:
        rec = _fuzzy_match(proj_fragment, projects, "name") or _fuzzy_match(proj_fragment, projects, "address")
        if rec:
            project_id, project_name = str(rec["id"]), rec["name"]

    action = ParsedAction(
        intent=IntentCategory.query_schedule,
        project_id=project_id,
        project_name=project_name,
        confidence=ConfidenceLevel.high,
        ambiguities=[],
        requires_confirmation=False,
    )
    action.summary = _build_summary(IntentCategory.query_schedule, action)
    return action


def _build_complete_task_action(
    text: str,
    projects: list[dict],
    tasks: list[dict],
    task_fragment: Optional[str] = None,
    context_project_id: Optional[str] = None,
) -> ParsedAction:
    ambiguities: list[str] = []

    proj_fragment = _extract_project_fragment(text)
    task_fragment = task_fragment or _extract_complete_fragment(text)

    project_id = project_name = None
    if proj_fragment:
        rec = _fuzzy_match(proj_fragment, projects, "name") or _fuzzy_match(proj_fragment, projects, "address")
        if rec:
            project_id, project_name = str(rec["id"]), rec["name"]
        else:
            ambiguities.append(f"Project '{proj_fragment}' not found.")
    else:
        ambiguities.append("Project not specified.")

    task_id = task_name = None
    task_candidates: list[dict] = []
    if task_fragment:
        effective_project_id = project_id or context_project_id
        scoped = [t for t in tasks if t.get("project_id") == effective_project_id] if effective_project_id else tasks
        exact_tasks, partial_tasks = _fuzzy_match_all(task_fragment, scoped, "name")
        candidates = exact_tasks or partial_tasks
        if len(candidates) == 1:
            task_id, task_name = str(candidates[0]["id"]), candidates[0]["name"]
        elif len(candidates) > 1:
            task_candidates = [{"id": str(c["id"]), "name": c["name"], "project_id": str(c.get("project_id") or ""), "scheduled_start": c.get("scheduled_start") or "", "scheduled_end": c.get("scheduled_end") or ""} for c in candidates]
            names = ", ".join(c["name"] for c in candidates[:3])
            ambiguities.append(f"Multiple tasks match '{task_fragment}': {names}. Please be more specific.")
        else:
            frag_stems_fb = _stem_tokens(task_fragment)
            def _score(t: dict) -> int:
                t_stems = _stem_tokens(t.get("name", ""))
                return sum(
                    1 for tok in frag_stems_fb
                    if len(tok) >= 5 and any(len(ts) >= 5 and (ts.startswith(tok) or tok.startswith(ts)) for ts in t_stems)
                )
            scored = [(t, _score(t)) for t in scoped]
            best = max((s for _, s in scored), default=0)
            if best > 0:
                scored.sort(key=lambda x: (-x[1], x[0].get("scheduled_start") or ""))
            else:
                scored.sort(key=lambda x: x[0].get("scheduled_start") or "")
            task_candidates = [
                {"id": str(t["id"]), "name": t["name"], "project_id": str(t.get("project_id") or ""), "scheduled_start": t.get("scheduled_start") or "", "scheduled_end": t.get("scheduled_end") or ""}
                for t, _ in scored[:10]
            ]
            ambiguities.append(f"Task '{task_fragment}' not found.")
    else:
        ambiguities.append("Task not specified.")

    confidence = ConfidenceLevel.high if not ambiguities else ConfidenceLevel.low

    action = ParsedAction(
        intent=IntentCategory.complete_task,
        project_id=project_id,
        project_name=project_name,
        task_id=task_id,
        task_name=task_name,
        task_candidates=task_candidates,
        confidence=confidence,
        ambiguities=ambiguities,
        requires_confirmation=True,
    )
    action.summary = _build_summary(IntentCategory.complete_task, action)
    return action


def _build_unknown_action(text: str) -> ParsedAction:
    action = ParsedAction(
        intent=IntentCategory.unknown,
        confidence=ConfidenceLevel.low,
        ambiguities=["Command not recognised."],
        requires_confirmation=False,
    )
    action.summary = "Command not recognised — please rephrase."
    return action


# ---------------------------------------------------------------------------
# Clarifying question generator
# ---------------------------------------------------------------------------

def _clarifying_question(actions: list[ParsedAction]) -> Optional[str]:
    for a in actions:
        for gap in a.ambiguities:
            lower_gap = gap.lower()
            if "project" in lower_gap and "not specified" in lower_gap:
                return "Which project does this apply to?"
            if "project" in lower_gap and "not found" in lower_gap:
                return "I couldn't find that project. Can you check the name?"
            if "task" in lower_gap and "not specified" in lower_gap:
                return "Which task should I reschedule?"
            if "multiple tasks match" in lower_gap:
                return "Multiple tasks match that description. Can you use the full task name?"
            if "task" in lower_gap and "not found" in lower_gap:
                return "I couldn't find that task. Can you check the task name?"
            if "contact" in lower_gap and "not found" in lower_gap:
                return "I couldn't find that contact. Can you check the name?"
            if "contact" in lower_gap and "not specified" in lower_gap:
                return "Who should I assign it to?"
            if "date" in lower_gap:
                return "What date should I use?"
            if "not recognised" in lower_gap:
                return "I didn't understand that. Try: 'Move [task] on [project] to [day]'."
    return None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def parse_command(raw_input: str, project_id: Optional[str] = None) -> CommandParseResponse:
    text = raw_input.strip()
    if not text:
        unknown = _build_unknown_action(text)
        return CommandParseResponse(
            raw_input=raw_input,
            actions=[unknown],
            has_low_confidence=True,
            clarifying_question="Please type a command.",
        )

    projects = _load_projects()
    contacts = _load_contacts()
    tasks = _load_tasks(project_id=project_id)
    templates = _load_templates()

    primary = _classify_primary_intent(text)
    channel = _classify_channel(text)
    actions: list[ParsedAction] = []

    if primary == IntentCategory.reschedule_task:
        actions.append(_build_reschedule_action(text, projects, tasks))
        if _has_notify_component(text):
            actions.append(_build_notify_action(text, projects, contacts, channel))

    elif primary == IntentCategory.notify_contacts:
        actions.append(_build_notify_action(text, projects, contacts, channel))

    elif primary == IntentCategory.reassign_task:
        actions.append(_build_reassign_action(text, projects, tasks, contacts))
        if _has_notify_component(text):
            actions.append(_build_notify_action(text, projects, contacts, channel))

    elif primary == IntentCategory.create_project:
        actions.append(_build_create_project_action(text, projects, templates))

    elif primary == IntentCategory.query_schedule:
        actions.append(_build_query_action(text, projects))

    elif primary == IntentCategory.complete_task:
        raw = _extract_complete_fragment(text)
        fragments = _split_complete_fragments(raw) if raw else [None]
        for frag in fragments:
            actions.append(_build_complete_task_action(text, projects, tasks, task_fragment=frag, context_project_id=project_id))

    elif primary == IntentCategory.unknown and project_id:
        new_date, date_shift = _resolve_date(text)
        if new_date or date_shift:
            actions.append(_build_reschedule_action(text, projects, tasks))
        else:
            actions.append(_build_unknown_action(text))

    else:
        actions.append(_build_unknown_action(text))

    has_low = any(a.confidence == ConfidenceLevel.low for a in actions)
    clarifying = _clarifying_question(actions) if has_low else None

    return CommandParseResponse(
        raw_input=raw_input,
        actions=actions,
        has_low_confidence=has_low,
        clarifying_question=clarifying,
    )
