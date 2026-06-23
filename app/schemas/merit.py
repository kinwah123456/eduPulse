from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class MeritOptionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    points: int = Field(...)


class MeritOptionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    points: int | None = Field(None)
    is_active: bool | None = Field(None)


class MeritOptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    points: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MeritAwardRequest(BaseModel):
    student_id: int
    option_id: int
    justification: str = Field(..., min_length=1, max_length=1000)


class StudentNameResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    student_id_number: str


class UserNameResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    role: str


class MeritLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    user_id: int
    merit_option_id: int | None
    points_changed: int
    justification: str
    created_at: datetime

    # Nested relationships
    student: StudentNameResponse | None = None
    user: UserNameResponse | None = None
    merit_option: MeritOptionResponse | None = None
