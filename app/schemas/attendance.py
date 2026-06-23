from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict


# --- AttendanceSession ---

class AttendanceSessionCreate(BaseModel):
    class_id: int
    date: date
    time_slot_id: int | None = None
    method: str = "MANUAL"


class AttendanceSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    class_id: int
    date: date
    time_slot_id: int | None
    recorded_by_id: int | None
    method: str
    created_at: datetime


class AttendanceSessionListResponse(BaseModel):
    total: int
    items: list[AttendanceSessionResponse]


# --- AttendanceRecord ---

class AttendanceRecordCreate(BaseModel):
    student_id: int
    status: str = "PRESENT"
    notes: str | None = None


class AttendanceRecordUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None


class AttendanceRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    session_id: int
    student_id: int
    status: str
    recorded_at: datetime
    notes: str | None


# --- Bulk ---

class BulkAttendanceCreate(BaseModel):
    """Create a session with all records at once."""
    class_id: int
    date: date
    time_slot_id: int | None = None
    method: str = "MANUAL"
    records: list[AttendanceRecordCreate]


class AttendanceSessionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    class_id: int
    date: date
    time_slot_id: int | None
    recorded_by_id: int | None
    method: str
    created_at: datetime
    records: list[AttendanceRecordResponse] = []


# --- Edge Ingest ---

class EdgeAttendanceRecord(BaseModel):
    student_id_number: str
    status: str = "PRESENT"
    notes: str | None = None


class EdgeAttendanceIngest(BaseModel):
    class_id: int
    date: date
    time_slot_id: int | None = None
    method: str = "CV_FACE"
    records: list[EdgeAttendanceRecord]
