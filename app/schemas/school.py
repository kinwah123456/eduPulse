from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class SchoolCreate(BaseModel):
    name: str
    code: str
    address: str | None = None
    state: str | None = None
    district: str | None = None


class SchoolUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    address: str | None = None
    state: str | None = None
    district: str | None = None


class SchoolResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    code: str
    address: str | None
    state: str | None
    district: str | None
    created_at: datetime
    updated_at: datetime


class SchoolListResponse(BaseModel):
    total: int
    items: list[SchoolResponse]
