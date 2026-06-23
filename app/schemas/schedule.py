from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict


# --- TimeSlot ---

class TimeSlotCreate(BaseModel):
    day_of_week: int
    period_number: int
    start_time: str
    end_time: str
    school_id: int


class TimeSlotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    day_of_week: int
    period_number: int
    start_time: str
    end_time: str
    school_id: int


class TimeSlotListResponse(BaseModel):
    total: int
    items: list[TimeSlotResponse]


# --- Timetable ---

class TimetableCreate(BaseModel):
    name: str
    school_id: int
    term: str


class TimetableUpdate(BaseModel):
    name: str | None = None
    term: str | None = None
    is_active: bool | None = None


class TimetableResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    school_id: int
    term: str
    is_active: bool
    generated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TimetableListResponse(BaseModel):
    total: int
    items: list[TimetableResponse]


# --- ScheduleEntry ---

class ScheduleEntryCreate(BaseModel):
    timetable_id: int | None = None
    class_id: int
    subject_id: int
    teacher_id: int
    time_slot_id: int


class ScheduleEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timetable_id: int
    class_id: int
    subject_id: int
    teacher_id: int
    time_slot_id: int
    created_at: datetime


class ScheduleEntryListResponse(BaseModel):
    total: int
    items: list[ScheduleEntryResponse]


class ScheduleEntryUpdate(BaseModel):
    subject_id: int
    teacher_id: int


class TimeSlotUpdate(BaseModel):
    start_time: str
    end_time: str
    day_of_week: int | None = None
    period_number: int | None = None


