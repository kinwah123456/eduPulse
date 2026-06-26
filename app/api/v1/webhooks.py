from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.config import settings
from app.services.notification_service import process_webhook_event

router = APIRouter()


@router.post("/{provider}")
async def handle_provider_webhook(
    provider: str,
    request: Request,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    # Verify secure token
    if token != settings.WEBHOOK_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid webhook token")

    provider_lower = provider.lower()
    if provider_lower not in ("sendgrid", "mailgun", "smtp2go", "generic"):
        raise HTTPException(status_code=400, detail=f"Unsupported webhook provider: {provider}")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    updated_count = process_webhook_event(db, provider_lower, payload)
    return {
        "status": "success",
        "provider": provider_lower,
        "processed_events": updated_count
    }
