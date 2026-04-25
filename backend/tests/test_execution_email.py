"""
tests/test_execution_email.py - Endpoint tests for /execute email behavior.

Execution-path tests mock Supabase and email sending so no external services are used.
"""

from unittest.mock import patch


class FakeResponse:
    def __init__(self, data=None):
        self.data = data if data is not None else []


class FakeTable:
    def __init__(self, supabase_client, name: str):
        self.supabase_client = supabase_client
        self.name = name
        self.operation = None
        self.payload = None
        self.filters = {}

    def select(self, _fields: str):
        self.operation = "select"
        return self

    def eq(self, field: str, value):
        self.filters[field] = value
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def execute(self):
        if self.name == "contacts" and self.operation == "select":
            rows = [
                row for row in self.supabase_client.contacts
                if all(row.get(field) == value for field, value in self.filters.items())
            ]
            return FakeResponse(rows)

        if self.operation == "insert":
            self.supabase_client.inserts.append({
                "table": self.name,
                "payload": self.payload,
            })
            return FakeResponse(self.payload if isinstance(self.payload, list) else [self.payload])

        raise AssertionError(f"Unsupported fake operation {self.operation!r} on table {self.name!r}")


class FakeSupabase:
    def __init__(self, contacts):
        self.contacts = contacts
        self.inserts = []

    def table(self, name: str):
        return FakeTable(self, name)


def test_execute_email_notify_with_valid_email(client):
    fake_supabase = FakeSupabase([
        {"id": "contact-1", "email": "crew@example.com"},
    ])

    payload = {
        "actions": [
            {
                "intent": "notify_contacts",
                "project_id": "project-1",
                "contact_id": "contact-1",
                "task_id": None,
                "channel": "email",
                "message": "Crew update",
                "notify_affected": False,
            }
        ]
    }

    with patch("services.execution_service.supabase", fake_supabase):
        with patch("services.execution_service.send_email", return_value={
            "success": True,
            "message_id": "email-1",
            "error": None,
        }) as mock_send_email:
            response = client.post("/execute", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["results"][0]["success"] is True
    assert body["results"][0]["message"] == "Email sent to 1 contact."
    mock_send_email.assert_called_once_with("crew@example.com", "Crew update")

    notifications_inserts = [entry for entry in fake_supabase.inserts if entry["table"] == "notifications"]
    execution_log_inserts = [entry for entry in fake_supabase.inserts if entry["table"] == "execution_logs"]

    assert len(notifications_inserts) == 1
    assert notifications_inserts[0]["payload"] == [
        {
            "project_id": "project-1",
            "contact_id": "contact-1",
            "type": "general",
            "message": "Crew update",
            "status": "pending",
        }
    ]
    assert len(execution_log_inserts) == 1
    assert execution_log_inserts[0]["payload"]["success"] is True


def test_execute_email_notify_with_missing_email(client):
    fake_supabase = FakeSupabase([
        {"id": "contact-2", "email": None},
    ])

    payload = {
        "actions": [
            {
                "intent": "notify_contacts",
                "project_id": "project-2",
                "contact_id": "contact-2",
                "task_id": None,
                "channel": "email",
                "message": "Schedule changed",
                "notify_affected": False,
            }
        ]
    }

    with patch("services.execution_service.supabase", fake_supabase):
        with patch("services.execution_service.send_email") as mock_send_email:
            response = client.post("/execute", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["results"][0]["success"] is False
    assert body["results"][0]["message"] == "No valid email addresses found for email delivery."
    mock_send_email.assert_not_called()

    notifications_inserts = [entry for entry in fake_supabase.inserts if entry["table"] == "notifications"]
    execution_log_inserts = [entry for entry in fake_supabase.inserts if entry["table"] == "execution_logs"]

    assert len(notifications_inserts) == 1
    assert len(execution_log_inserts) == 1
    assert execution_log_inserts[0]["payload"]["success"] is False


def test_execute_non_email_non_sms_notify_unchanged(client):
    fake_supabase = FakeSupabase([
        {"id": "contact-3", "email": "client@example.com"},
    ])

    payload = {
        "actions": [
            {
                "intent": "notify_contacts",
                "project_id": "project-3",
                "contact_id": "contact-3",
                "task_id": None,
                "channel": "phone",
                "message": "Call update",
                "notify_affected": False,
            }
        ]
    }

    with patch("services.execution_service.supabase", fake_supabase):
        with patch("services.execution_service.send_email") as mock_send_email:
            response = client.post("/execute", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["results"][0]["success"] is True
    assert body["results"][0]["message"] == "Notification queued for 1 contact."
    mock_send_email.assert_not_called()

    notifications_inserts = [entry for entry in fake_supabase.inserts if entry["table"] == "notifications"]
    execution_log_inserts = [entry for entry in fake_supabase.inserts if entry["table"] == "execution_logs"]

    assert len(notifications_inserts) == 1
    assert notifications_inserts[0]["payload"] == [
        {
            "project_id": "project-3",
            "contact_id": "contact-3",
            "type": "general",
            "message": "Call update",
            "status": "pending",
        }
    ]
    assert len(execution_log_inserts) == 1
    assert execution_log_inserts[0]["payload"]["message"] == "Notification queued for 1 contact."
