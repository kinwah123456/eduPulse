from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_teacher_or_admin
from app.models.user import User
from app.schemas.notification import (
    NotificationConnectorResponse, NotificationConnectorUpdate, NotificationConnectorTest, NotificationConnectorListResponse,
    NotificationRuleResponse, NotificationRuleUpdate, NotificationRuleListResponse,
    NotificationLogResponse, NotificationLogListResponse
)
from app.services import notification_service

router = APIRouter()


@router.get("/connectors", response_model=NotificationConnectorListResponse)
def list_connectors(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    items = notification_service.get_connectors(db)
    return NotificationConnectorListResponse(items=items)


@router.put("/connectors/{name}", response_model=NotificationConnectorResponse)
def update_connector(
    name: str, body: NotificationConnectorUpdate, db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    return notification_service.update_connector(db, name, body.model_dump(exclude_unset=True))


@router.post("/connectors/{name}/test")
def test_connector(
    name: str, body: NotificationConnectorTest, db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    notification_service.test_connector(db, name, body.recipient, body.message)
    return {"status": "success", "message": f"Test message successfully routed to {name} gateway."}


@router.get("/rules", response_model=NotificationRuleListResponse)
def list_rules(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    items = notification_service.get_rules(db)
    return NotificationRuleListResponse(items=items)


@router.put("/rules/{event_type}/{connector_type}", response_model=NotificationRuleResponse)
def update_rule(
    event_type: str, connector_type: str, body: NotificationRuleUpdate,
    db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)
):
    return notification_service.update_rule(db, event_type, connector_type, body.model_dump(exclude_unset=True))


@router.get("/logs", response_model=NotificationLogListResponse)
def list_logs(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    items, total = notification_service.get_logs(db, skip, limit)
    return NotificationLogListResponse(total=total, items=items)


@router.post("/logs/{log_id}/retry", response_model=NotificationLogResponse)
def retry_notification(
    log_id: int, db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    return notification_service.retry_notification(db, log_id)
