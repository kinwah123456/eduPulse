from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict


# --- Subject ---

class SubjectCreate(BaseModel):
    name: str
    code: str
    school_id: int


class SubjectUpdate(BaseModel):
    name: str | None = None
    code: str | None = None


class SubjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    code: str
    school_id: int
    created_at: datetime
    updated_at: datetime


class SubjectListResponse(BaseModel):
    total: int
    items: list[SubjectResponse]


# --- SchoolClass ---

class SchoolClassCreate(BaseModel):
    name: str
    grade_level: int
    school_id: int
    form_teacher_id: int | None = None
    capacity: int = 40


class SchoolClassUpdate(BaseModel):
    name: str | None = None
    grade_level: int | None = None
    form_teacher_id: int | None = None
    capacity: int | None = None


class SchoolClassResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    grade_level: int
    school_id: int
    form_teacher_id: int | None
    capacity: int
    created_at: datetime
    updated_at: datetime


class SchoolClassListResponse(BaseModel):
    total: int
    items: list[SchoolClassResponse]
