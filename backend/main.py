"""
main.py — FastAPI application entry point for Ja Lite.

Registers all routers and middleware.
Run with: uvicorn main:app --reload
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import assignments, commands, contacts, dashboard, execution, logs, projects, tasks, templates

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ja Lite API",
    description="Scheduling assistant backend for Jeff.",
    version="0.1.0",
)

# CORS — tighten origins before production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(dashboard.router,   prefix="/dashboard",   tags=["dashboard"])
app.include_router(projects.router,    prefix="/projects",    tags=["projects"])
app.include_router(tasks.router,       prefix="/tasks",       tags=["tasks"])
app.include_router(contacts.router,    prefix="/contacts",    tags=["contacts"])
app.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
app.include_router(logs.router,        prefix="/logs",        tags=["logs"])
app.include_router(templates.router,   prefix="/templates",   tags=["templates"])
app.include_router(commands.router,    prefix="/commands",    tags=["commands"])
app.include_router(execution.router,   prefix="",             tags=["execution"])


@app.get("/health", tags=["system"])
def health_check():
    """Simple liveness check. Returns 200 if the API is running."""
    return {"status": "ok", "env": settings.app_env}
