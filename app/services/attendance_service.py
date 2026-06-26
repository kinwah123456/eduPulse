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


def get_attendance_rate(db: Session, school_id: int | None = None) -> float:
    """Calculate actual attendance percentage based on historical records.
    
    Formula: (PRESENT + LATE + EXCUSED) / TOTAL * 100
    If no records exist, return a default healthy rate (95.0%).
    """
    from app.models.attendance import AttendanceRecord, AttendanceSession
    from app.models.student import Student
    
    query = db.query(AttendanceRecord)
    if school_id is not None:
        query = query.join(AttendanceSession).join(Student, Student.id == AttendanceRecord.student_id).filter(Student.school_id == school_id)
        
    total_records = query.count()
    if total_records == 0:
        return 95.0
        
    # Count ABSENT vs other statuses
    absent_count = query.filter(AttendanceRecord.status == "ABSENT").count()
    present_count = total_records - absent_count
    
    rate = (present_count / total_records) * 100.0
    return round(rate, 1)


def get_attendance_warnings(db: Session, school_id: int | None = None) -> list[dict]:
    """Analyze student attendance records for warnings.
    
    1. Consecutive Absences: 2 or more consecutive absences (status == 'ABSENT').
    2. Low Attendance Rate: < 85% attendance rate (minimum 3 records).
    """
    from app.models.attendance import AttendanceRecord, AttendanceSession
    from app.models.student import Student
    from app.models.academic import SchoolClass

    # Fetch active students for this school
    students_query = db.query(Student)
    if school_id is not None:
        students_query = students_query.filter(Student.school_id == school_id)
    students = students_query.filter(Student.is_active == True).all()

    warnings = []

    for student in students:
        # Get classroom name
        classroom = db.query(SchoolClass).filter(SchoolClass.id == student.class_id).first()
        class_name = classroom.name if classroom else "Unknown Class"

        # Fetch attendance records for this student ordered by session date desc
        records = (
            db.query(AttendanceRecord)
            .join(AttendanceSession)
            .filter(AttendanceRecord.student_id == student.id)
            .order_by(AttendanceSession.date.desc(), AttendanceRecord.id.desc())
            .all()
        )

        total_count = len(records)
        if total_count == 0:
            continue

        absent_count = sum(1 for r in records if r.status == "ABSENT")
        present_count = total_count - absent_count
        rate = (present_count / total_count) * 100.0

        # Check consecutive absences
        consecutive_absent = 0
        for r in records:
            if r.status == "ABSENT":
                consecutive_absent += 1
            else:
                break

        if consecutive_absent >= 2:
            warnings.append({
                "student_id": student.id,
                "student_name": student.full_name,
                "class_name": class_name,
                "warning_type": "consecutive_absence",
                "message": f"Absent for {consecutive_absent} consecutive classes. Attendance is {rate:.1f}%.",
                "severity": "critical"
            })
        elif total_count >= 3 and rate < 85.0:
            warnings.append({
                "student_id": student.id,
                "student_name": student.full_name,
                "class_name": class_name,
                "warning_type": "low_rate",
                "message": f"Low attendance rate: {rate:.1f}% ({present_count}/{total_count} sessions).",
                "severity": "warning"
            })

    return warnings

