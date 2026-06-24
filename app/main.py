from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.core.database import init_db
from app.core.exceptions import (
    EduPulseException, NotFoundException, UnauthorizedException,
    ForbiddenException, ConflictException, ValidationException,
)
from app.api.v1.router import api_v1_router


async def temp_cleanup_loop():
    """Background task to periodically clean up expired temporary submissions."""
    from app.services.grading_service import cleanup_expired_temp_submissions
    # Wait 60 seconds before first run to let startup finish
    await asyncio.sleep(60)
    while True:
        try:
            cleanup_expired_temp_submissions()
        except Exception as e:
            print(f"Error during expired OMR temp cleanup: {e}")
        # Run every hour (3600 seconds)
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables and register engines. Shutdown: cleanup."""
    init_db()
    
    # Pre-initialize platform OCR
    from app.services.ocr_service import ocr_manager
    ocr_manager.initialize()
    
    # Run automatic cleanup on startup (remove assessments not used/updated in 3 months)
    from app.core.database import SessionLocal
    from app.services.grading_service import cleanup_inactive_assessments
    from app.services.merit_service import cleanup_expired_feedback_submissions
    db = SessionLocal()
    try:
        deleted = cleanup_inactive_assessments(db)
        print(f"Cleanup: removed {deleted} inactive assessments.")
        deleted_feedback = cleanup_expired_feedback_submissions(db)
        print(f"Cleanup: removed {deleted_feedback} expired feedback submissions.")
    except Exception as e:
        print(f"Cleanup failed: {e}")
        
    # Seed notifications
    from app.services.notification_service import seed_notifications
    try:
        seed_notifications(db)
        print("Notifications seeded successfully.")
    except Exception as e:
        print(f"Notifications seeding failed: {e}")
    finally:
        db.close()
    
    # Register grading engines
    from app.core.plugin_registry import EngineRegistry
    from app.engines.omr_engine import OMREngine
    from app.engines.math_engine import MathEngine
    
    EngineRegistry.register(OMREngine())
    EngineRegistry.register(MathEngine())
    
    # Start background cleanup task
    cleanup_task = asyncio.create_task(temp_cleanup_loop())
    
    yield
    
    # Cancel background cleanup task on shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass



app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="Automated School Resource, Attendance & Performance Optimization Ecosystem",
    lifespan=lifespan,
)


# ── Exception handlers ──────────────────────────────────────────────────────

@app.exception_handler(NotFoundException)
async def not_found_handler(request: Request, exc: NotFoundException):
    return JSONResponse(status_code=404, content={"detail": exc.detail})


@app.exception_handler(UnauthorizedException)
async def unauthorized_handler(request: Request, exc: UnauthorizedException):
    return JSONResponse(status_code=401, content={"detail": exc.detail})


@app.exception_handler(ForbiddenException)
async def forbidden_handler(request: Request, exc: ForbiddenException):
    return JSONResponse(status_code=403, content={"detail": exc.detail})


@app.exception_handler(ConflictException)
async def conflict_handler(request: Request, exc: ConflictException):
    return JSONResponse(status_code=409, content={"detail": exc.detail})


@app.exception_handler(ValidationException)
async def validation_handler(request: Request, exc: ValidationException):
    return JSONResponse(status_code=422, content={"detail": exc.detail})


# ── Routes ───────────────────────────────────────────────────────────────────

app.include_router(api_v1_router)

# Mount static files directory
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/", response_class=HTMLResponse, tags=["UI"])
def read_root():
    """Serve the Teacher Access Portal."""
    import os
    index_path = os.path.join("app", "static", "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/login", response_class=HTMLResponse, tags=["UI"])
def read_login():
    """Alias for Teacher Access Portal."""
    return read_root()


@app.get("/dashboard", response_class=HTMLResponse, tags=["UI"])
def read_dashboard():
    """Serve the Teacher Dashboard."""
    import os
    dashboard_path = os.path.join("app", "static", "dashboard.html")
    with open(dashboard_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/feedback", response_class=HTMLResponse, tags=["UI"])
def read_feedback():
    """Serve the Public Feedback Form."""
    import os
    feedback_path = os.path.join("app", "static", "feedback.html")
    with open(feedback_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "version": "0.1.0"}
