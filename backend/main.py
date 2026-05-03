"""
main.py — FastAPI application entry point for Ja Lite.

Registers all routers and middleware.
Run with: uvicorn main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routers import assignments, commands, contacts, dashboard, execution, logs, projects, tasks, templates

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CORS allowed origins: %s", settings.allowed_origins)
    logger.info("API key protection: %s", "ENABLED" if settings.demo_api_key else "disabled (DEMO_API_KEY not set)")
    logger.info("Demo mode: %s", "ENABLED" if settings.demo_mode else "disabled")
    yield


app = FastAPI(
    title="Ja Lite API",
    description="Scheduling assistant backend for Jeff.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def api_key_gate(request: Request, call_next):
    if not settings.demo_api_key:
        return await call_next(request)
    if request.url.path == "/health" or request.method == "OPTIONS":
        return await call_next(request)
    if request.headers.get("X-API-Key", "") != settings.demo_api_key:
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing API key."})
    return await call_next(request)

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
