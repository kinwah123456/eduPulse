from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PaginationParams(BaseModel):
    skip: int = 0
    limit: int = 100


class MessageResponse(BaseModel):
    message: str
    detail: str | None = None
