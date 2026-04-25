"""
tests/test_projects.py — Endpoint tests for /projects.

Service functions are mocked so no Supabase connection is required.
"""

import uuid
from unittest.mock import patch

SAMPLE_PROJECT = {
    "id": str(uuid.uuid4()),
    "name": "Smith Residence",
    "description": None,
    "address": "12 Oak Street",
    "status": "planning",
    "start_date": "2026-05-01",
    "end_date": None,
    "template_id": None,
    "created_at": "2026-04-16T00:00:00+00:00",
    "updated_at": "2026-04-16T00:00:00+00:00",
}


def test_list_projects_returns_list(client):
    with patch("routers.projects.project_service.list_projects", return_value=[SAMPLE_PROJECT]):
        response = client.get("/projects/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 1


def test_get_project_found(client):
    with patch("routers.projects.project_service.get_project", return_value=SAMPLE_PROJECT):
        response = client.get(f"/projects/{SAMPLE_PROJECT['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "Smith Residence"


def test_get_project_not_found(client):
    with patch("routers.projects.project_service.get_project", return_value=None):
        response = client.get(f"/projects/{uuid.uuid4()}")
    assert response.status_code == 404


def test_create_project_success(client):
    with patch("routers.projects.project_service.create_project", return_value=SAMPLE_PROJECT):
        response = client.post("/projects/", json={"name": "Smith Residence"})
    assert response.status_code == 201
    assert response.json()["name"] == "Smith Residence"


def test_create_project_missing_name(client):
    response = client.post("/projects/", json={})
    assert response.status_code == 422  # Pydantic validation error
