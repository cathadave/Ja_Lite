"""
services/sms_service.py - Minimal SMS sender for Ja Lite.
"""

import httpx

from config import settings


def send_sms(phone: str, message: str) -> dict:
    if not isinstance(phone, str) or not phone.strip():
        return {
            "success": False,
            "message_id": None,
            "error": "Missing phone number.",
        }

    if settings.demo_mode and (
        not settings.sms_account_sid
        or not settings.sms_auth_token
        or not settings.sms_from_number
    ):
        return {
            "success": True,
            "message_id": "demo-skipped",
            "error": None,
        }

    if not settings.sms_account_sid or not settings.sms_auth_token or not settings.sms_from_number:
        return {
            "success": False,
            "message_id": None,
            "error": "SMS is not configured. Set SMS_ACCOUNT_SID, SMS_AUTH_TOKEN, and SMS_FROM_NUMBER.",
        }

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.sms_account_sid}/Messages.json"

    try:
        response = httpx.post(
            url,
            data={
                "To": phone.strip(),
                "From": settings.sms_from_number,
                "Body": message,
            },
            auth=(settings.sms_account_sid, settings.sms_auth_token),
            timeout=settings.sms_timeout_seconds,
        )
    except Exception as exc:
        return {
            "success": False,
            "message_id": None,
            "error": f"SMS request failed: {exc}",
        }

    if response.status_code not in (200, 201):
        error_text = response.text.strip() or f"HTTP {response.status_code}"
        return {
            "success": False,
            "message_id": None,
            "error": f"SMS provider error: {error_text}",
        }

    try:
        body = response.json()
    except ValueError:
        body = {}

    return {
        "success": True,
        "message_id": body.get("sid"),
        "error": None,
    }
