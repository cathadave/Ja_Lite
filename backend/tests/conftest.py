"""
tests/conftest.py — Shared pytest fixtures.

Sets dummy env vars so the app loads without a real Supabase connection.
Individual tests mock service functions directly — no real DB calls.
"""

import os

import pytest

# Must be set before importing the app, so config.py doesn't fail
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key-placeholder")

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
