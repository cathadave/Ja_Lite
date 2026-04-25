"""
services/email_service.py - Minimal email sender for Ja Lite.
"""

import httpx

from config import settings


def send_email(email_address: str, message: str) -> dict:
    if not isinstance(email_address, str) or not email_address.strip():
        return {
            "success": False,
            "message_id": None,
            "error": "Missing email address.",
        }

    if not settings.email_api_key or not settings.email_from_address:
        return {
            "success": False,
            "message_id": None,
            "error": "Email is not configured. Set EMAIL_API_KEY and EMAIL_FROM_ADDRESS.",
        }

    try:
        response = httpx.post(
            settings.email_api_url,
            headers={
                "Authorization": f"Bearer {settings.email_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.email_from_address,
                "to": [email_address.strip()],
                "subject": "Ja Lite Notification",
                "text": message,
            },
            timeout=settings.email_timeout_seconds,
        )
    except Exception as exc:
        return {
            "success": False,
            "message_id": None,
            "error": f"Email request failed: {exc}",
        }

    if response.status_code not in (200, 201):
        error_text = response.text.strip() or f"HTTP {response.status_code}"
        return {
            "success": False,
            "message_id": None,
            "error": f"Email provider error: {error_text}",
        }

    try:
        body = response.json()
    except ValueError:
        body = {}

    return {
        "success": True,
        "message_id": body.get("id"),
        "error": None,
    }
