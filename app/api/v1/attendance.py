from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_teacher_or_admin
from app.models.user import User
from app.schemas.attendance import (
    AttendanceSessionCreate, AttendanceSessionResponse, AttendanceSessionListResponse,
    AttendanceRecordCreate, AttendanceRecordUpdate, AttendanceRecordResponse,
    BulkAttendanceCreate, AttendanceSessionDetailResponse, EdgeAttendanceIngest,
)
from app.services import attendance_service

router = APIRouter()


@router.post("/sessions", response_model=AttendanceSessionResponse)
def create_session(
    body: AttendanceSessionCreate, db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
):
    return attendance_service.create_attendance_session(db, body.model_dump(), current_user.id)


@router.get("/sessions", response_model=AttendanceSessionListResponse)
def list_sessions(
    skip: int = 0, limit: int = 100,
    class_id: int | None = None,
    date_from: date | None = None, date_to: date | None = None,
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    items, total = attendance_service.get_attendance_sessions(db, skip, limit, class_id, date_from, date_to)
    return AttendanceSessionListResponse(total=total, items=items)


@router.get("/sessions/{session_id}", response_model=AttendanceSessionDetailResponse)
def get_session(session_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return attendance_service.get_session_with_records(db, session_id)


@router.post("/sessions/{session_id}/records", response_model=AttendanceRecordResponse)
def add_record(
    session_id: int, body: AttendanceRecordCreate, db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin),
):
    return attendance_service.add_attendance_record(db, session_id, body.model_dump())


@router.put("/records/{record_id}", response_model=AttendanceRecordResponse)
def update_record(record_id: int, body: AttendanceRecordUpdate, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    return attendance_service.update_attendance_record(db, record_id, body.model_dump(exclude_unset=True))


@router.post("/bulk", response_model=AttendanceSessionDetailResponse)
def bulk_create(
    body: BulkAttendanceCreate, db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
):
    """Create attendance session with all records in one request."""
    session_data = {"class_id": body.class_id, "date": body.date, "time_slot_id": body.time_slot_id, "method": body.method}
    records_data = [r.model_dump() for r in body.records]
    session = attendance_service.create_bulk_attendance(db, session_data, records_data, current_user.id)
    return attendance_service.get_session_with_records(db, session.id)


@router.post("/ingest", response_model=AttendanceSessionDetailResponse)
def ingest_attendance(
    body: EdgeAttendanceIngest, db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
):
    """Ingest attendance from edge devices using student ID numbers."""
    session_data = {"class_id": body.class_id, "date": body.date, "time_slot_id": body.time_slot_id, "method": body.method}
    records_data = []
    
    # Translate student_id_number to student_id
    from app.models.student import Student
    for rec in body.records:
        student = db.query(Student).filter(Student.student_id_number == rec.student_id_number).first()
        if student:
            records_data.append({
                "student_id": student.id,
                "status": rec.status,
                "notes": rec.notes
            })
            
    session = attendance_service.create_bulk_attendance(db, session_data, records_data, current_user.id)
    return attendance_service.get_session_with_records(db, session.id)
