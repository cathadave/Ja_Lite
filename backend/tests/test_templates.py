"""
tests/test_templates.py — Endpoint tests for /templates.
"""

import uuid
from unittest.mock import patch

TEMPLATE_ID = str(uuid.uuid4())
TEMPLATE_TASK_ID = str(uuid.uuid4())

SAMPLE_TEMPLATE = {
    "id": TEMPLATE_ID,
    "name": "Residential Build",
    "description": "Standard new home construction",
    "created_at": "2026-04-16T00:00:00+00:00",
    "updated_at": "2026-04-16T00:00:00+00:00",
}

SAMPLE_TEMPLATE_TASK = {
    "id": TEMPLATE_TASK_ID,
    "project_template_id": TEMPLATE_ID,
    "name": "Pour Foundation",
    "description": None,
    "default_duration_days": 3,
    "sequence_order": 1,
    "category": "concrete",
    "created_at": "2026-04-16T00:00:00+00:00",
    "updated_at": "2026-04-16T00:00:00+00:00",
}


def test_list_templates_returns_list(client):
    with patch("routers.templates.template_service.list_templates", return_value=[SAMPLE_TEMPLATE]):
        response = client.get("/templates/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Residential Build"


def test_list_templates_returns_empty(client):
    with patch("routers.templates.template_service.list_templates", return_value=[]):
        response = client.get("/templates/")
    assert response.status_code == 200
    assert response.json() == []


def test_get_template_found(client):
    with patch("routers.templates.template_service.get_template", return_value=SAMPLE_TEMPLATE):
        response = client.get(f"/templates/{TEMPLATE_ID}")
    assert response.status_code == 200
    assert response.json()["name"] == "Residential Build"


def test_get_template_not_found(client):
    with patch("routers.templates.template_service.get_template", return_value=None):
        response = client.get(f"/templates/{uuid.uuid4()}")
    assert response.status_code == 404


def test_get_template_tasks_returns_list(client):
    with patch("routers.templates.template_service.get_template_tasks", return_value=[SAMPLE_TEMPLATE_TASK]):
        response = client.get(f"/templates/{TEMPLATE_ID}/tasks")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Pour Foundation"
    assert response.json()[0]["default_duration_days"] == 3


def test_get_template_tasks_empty(client):
    with patch("routers.templates.template_service.get_template_tasks", return_value=[]):
        response = client.get(f"/templates/{TEMPLATE_ID}/tasks")
    assert response.status_code == 200
    assert response.json() == []
