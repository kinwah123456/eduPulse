from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


class StudentCreate(BaseModel):
    student_id_number: str
    full_name: str
    class_id: int | None = None
    school_id: int
    is_active: bool = True
    father_contact: str | None = None
    mother_contact: str | None = None
    guardian_contact: str | None = None
    parent_email: str | None = None
    residential_address: str | None = None
    gender: str | None = None
    identity_card_number: str | None = None
    birth_date: date | None = None
    enroll_date: date | None = None


class StudentUpdate(BaseModel):
    student_id_number: str | None = None
    full_name: str | None = None
    class_id: int | None = None
    is_active: bool | None = None
    father_contact: str | None = None
    mother_contact: str | None = None
    guardian_contact: str | None = None
    parent_email: str | None = None
    residential_address: str | None = None
    gender: str | None = None
    identity_card_number: str | None = None
    birth_date: date | None = None
    enroll_date: date | None = None


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id_number: str
    full_name: str
    class_id: int | None
    school_id: int
    is_active: bool
    father_contact: str | None
    mother_contact: str | None
    guardian_contact: str | None
    parent_email: str | None
    residential_address: str | None
    gender: str | None
    identity_card_number: str | None
    birth_date: date | None
    enroll_date: date | None
    merit_points: int
    created_at: datetime
    updated_at: datetime


class StudentListResponse(BaseModel):
    total: int
    items: list[StudentResponse]
