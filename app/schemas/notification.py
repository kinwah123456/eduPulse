from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class NotificationConnectorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    config: str  # JSON string
    is_enabled: bool
    created_at: datetime
    updated_at: datetime


class NotificationConnectorUpdate(BaseModel):
    config: str | None = None
    is_enabled: bool | None = None


class NotificationConnectorTest(BaseModel):
    recipient: str
    message: str


class NotificationRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_type: str
    connector_type: str
    template: str
    is_enabled: bool
    passing_threshold: float | None = None
    created_at: datetime
    updated_at: datetime


class NotificationRuleUpdate(BaseModel):
    connector_type: str | None = None
    template: str | None = None
    is_enabled: bool | None = None
    passing_threshold: float | None = None


class StudentNameResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    student_id_number: str


class NotificationLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    student_name: str
    parent_contact: str
    channel: str
    event_type: str
    message_body: str
    status: str
    error_message: str | None = None
    reference_id: int | None = None
    smtp_message_id: str | None = None
    created_at: datetime

    student: StudentNameResponse | None = None


class NotificationConnectorListResponse(BaseModel):
    items: list[NotificationConnectorResponse]


class NotificationRuleListResponse(BaseModel):
    items: list[NotificationRuleResponse]


class NotificationLogListResponse(BaseModel):
    total: int
    items: list[NotificationLogResponse]
