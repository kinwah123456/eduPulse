from __future__ import annotations

from datetime import date
from sqlalchemy.orm import Session, joinedload

from app.models.attendance import AttendanceSession, AttendanceRecord
from app.core.exceptions import NotFoundException


def create_attendance_session(db: Session, data: dict, recorded_by_id: int | None = None) -> AttendanceSession:
    session = AttendanceSession(**data, recorded_by_id=recorded_by_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_attendance_session(db: Session, session_id: int) -> AttendanceSession:
    session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session:
        raise NotFoundException(f"Attendance session {session_id} not found")
    return session


def get_attendance_sessions(
    db: Session, skip: int = 0, limit: int = 100,
    class_id: int | None = None, date_from: date | None = None, date_to: date | None = None,
) -> tuple[list[AttendanceSession], int]:
    query = db.query(AttendanceSession)
    if class_id is not None:
        query = query.filter(AttendanceSession.class_id == class_id)
    if date_from is not None:
        query = query.filter(AttendanceSession.date >= date_from)
    if date_to is not None:
        query = query.filter(AttendanceSession.date <= date_to)
    total = query.count()
    items = query.order_by(AttendanceSession.date.desc()).offset(skip).limit(limit).all()
    return items, total


def add_attendance_record(db: Session, session_id: int, data: dict) -> AttendanceRecord:
    # Verify session exists
    get_attendance_session(db, session_id)
    record = AttendanceRecord(session_id=session_id, **data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_attendance_record(db: Session, record_id: int, data: dict) -> AttendanceRecord:
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise NotFoundException(f"Attendance record {record_id} not found")
    for key, value in data.items():
        if value is not None:
            setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


def create_bulk_attendance(
    db: Session, session_data: dict, records_data: list[dict],
    recorded_by_id: int | None = None,
    background_tasks: any = None,
) -> AttendanceSession:
    """Create or update an attendance session with all records in one transaction."""
    # Check if a session already exists for this class, date, and timeslot
    session = (
        db.query(AttendanceSession)
        .filter(
            AttendanceSession.class_id == session_data["class_id"],
            AttendanceSession.date == session_data["date"],
            AttendanceSession.time_slot_id == session_data["time_slot_id"],
        )
        .first()
    )

    if session:
        # Update existing session
        session.method = session_data.get("method", session.method)
        if recorded_by_id is not None:
            session.recorded_by_id = recorded_by_id
        # Delete existing records associated with this session
        db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).delete()
    else:
        # Create new session
        session = AttendanceSession(**session_data, recorded_by_id=recorded_by_id)
        db.add(session)
        db.flush()  # Get session.id without committing

    # Add new records
    for rec_data in records_data:
        record = AttendanceRecord(session_id=session.id, **rec_data)
        db.add(record)

    db.commit()
    db.refresh(session)

    # Trigger attendance notifications (safely)
    try:
        if background_tasks:
            from app.services.notification_service import trigger_attendance_notifications_background
            background_tasks.add_task(trigger_attendance_notifications_background, session.id)
        else:
            from app.services.notification_service import trigger_attendance_notifications
            trigger_attendance_notifications(db, session)
    except Exception as e:
        print(f"Failed to trigger attendance notifications: {e}")

    return session



def get_session_with_records(db: Session, session_id: int) -> AttendanceSession:
    """Get session with eagerly-loaded records."""
    session = (
        db.query(AttendanceSession)
        .options(joinedload(AttendanceSession.records))
        .filter(AttendanceSession.id == session_id)
        .first()
    )
    if not session:
        raise NotFoundException(f"Attendance session {session_id} not found")
    return session
