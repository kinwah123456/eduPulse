from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class MeritSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_anonymous: bool
    identity_card_number: str | None = None
    description: str
    location: str | None = None
    images: list[str] = []
    status: str
    acknowledged_by_id: int | None = None
    acknowledged_at: datetime | None = None
    student_id: int | None = None
    created_at: datetime
    updated_at: datetime

    # Nested relationships
    student: StudentNameResponse | None = None
    acknowledged_by: UserNameResponse | None = None

    @field_validator("images", mode="before")
    @classmethod
    def parse_images(cls, value):
        import json
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return [value] if value else []
        return value or []
