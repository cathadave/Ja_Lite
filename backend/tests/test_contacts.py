"""
tests/test_contacts.py — Endpoint tests for /contacts.

Service functions are mocked so no Supabase connection is required.
"""

import uuid
from unittest.mock import patch

SAMPLE_CONTACT = {
    "id": str(uuid.uuid4()),
    "name": "Bob Crane",
    "company": "Crane Electrical Pty Ltd",
    "contact_type": "subcontractor",
    "phone": "0400000000",
    "email": "bob@craneelectrical.com.au",
    "preferred_contact_method": "sms",
    "notes": None,
    "is_active": True,
    "created_at": "2026-04-16T00:00:00+00:00",
    "updated_at": "2026-04-16T00:00:00+00:00",
}


def test_list_contacts_returns_list(client):
    with patch("routers.contacts.contact_service.list_contacts", return_value=[SAMPLE_CONTACT]):
        response = client.get("/contacts/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_contact_found(client):
    with patch("routers.contacts.contact_service.get_contact", return_value=SAMPLE_CONTACT):
        response = client.get(f"/contacts/{SAMPLE_CONTACT['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "Bob Crane"


def test_get_contact_not_found(client):
    with patch("routers.contacts.contact_service.get_contact", return_value=None):
        response = client.get(f"/contacts/{uuid.uuid4()}")
    assert response.status_code == 404


def test_create_contact_success(client):
    with patch("routers.contacts.contact_service.create_contact", return_value=SAMPLE_CONTACT):
        response = client.post("/contacts/", json={
            "name": "Bob Crane",
            "contact_type": "subcontractor",
            "preferred_contact_method": "sms",
        })
    assert response.status_code == 201
    assert response.json()["preferred_contact_method"] == "sms"


def test_create_contact_missing_name(client):
    response = client.post("/contacts/", json={"contact_type": "subcontractor"})
    assert response.status_code == 422  # Pydantic validation error
