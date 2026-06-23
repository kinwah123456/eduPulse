from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TeacherCreate(BaseModel):
    employee_id: str
    full_name: str
    email: str | None = None
    contact_number: str | None = None
    emergency_contact: str | None = None
    school_id: int
    user_id: int | None = None


class TeacherUpdate(BaseModel):
    employee_id: str | None = None
    full_name: str | None = None
    email: str | None = None
    contact_number: str | None = None
    emergency_contact: str | None = None
    is_active: bool | None = None


class TeacherResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_id: str
    full_name: str
    email: str | None
    contact_number: str | None
    emergency_contact: str | None
    school_id: int
    user_id: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TeacherListResponse(BaseModel):
    total: int
    items: list[TeacherResponse]
