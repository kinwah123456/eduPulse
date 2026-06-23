from __future__ import annotations

import json
from unittest.mock import patch
import pytest
from sqlalchemy.orm import Session

from app.models.notification import NotificationConnector, NotificationRule, NotificationLog
from app.models.student import Student
from app.models.academic import SchoolClass, Subject
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.grading import Assessment, StudentGrade
from app.models.teacher import Teacher
from app.models.user import User
from app.services import notification_service, attendance_service, grading_service


from datetime import date
from app.core.plugin_registry import EngineRegistry
from app.engines.math_engine import MathEngine

@pytest.fixture(autouse=True)
def setup_notifications(db_session: Session):
    notification_service.seed_notifications(db_session)
    EngineRegistry.register(MathEngine())


def test_seed_notifications(db_session: Session):
    connectors = db_session.query(NotificationConnector).all()
    assert len(connectors) == 2
    assert any(c.name == "email" for c in connectors)
    assert any(c.name == "whatsapp" for c in connectors)

    rules = db_session.query(NotificationRule).all()
    assert len(rules) == 4
    assert any(r.event_type == "student_absent" and r.connector_type == "email" for r in rules)
    assert any(r.event_type == "assignment_failed" and r.connector_type == "whatsapp" for r in rules)


def test_update_connector(db_session: Session):
    # Enable email connector
    connector = notification_service.update_connector(db_session, "email", {"is_enabled": True})
    assert connector.is_enabled is True

    # Update config with valid JSON
    new_config = {"smtp_server": "smtp.test.com", "smtp_port": 587}
    connector = notification_service.update_connector(db_session, "email", {"config": json.dumps(new_config)})
    assert json.loads(connector.config)["smtp_server"] == "smtp.test.com"

    # Invalid JSON should raise ValidationException
    from app.core.exceptions import ValidationException
    with pytest.raises(ValidationException):
        notification_service.update_connector(db_session, "email", {"config": "{invalid_json}"})


def test_update_rule(db_session: Session):
    rule = notification_service.update_rule(
        db_session, "student_absent", "email",
        {"is_enabled": True, "template": "Absent alert: {student_name}"}
    )
    assert rule.is_enabled is True
    assert rule.template == "Absent alert: {student_name}"


@patch("app.services.notification_service.send_email")
def test_trigger_attendance_notifications(mock_send_email, db_session: Session):
    # 1. Enable email connector and rule
    notification_service.update_connector(db_session, "email", {"is_enabled": True})
    notification_service.update_rule(
        db_session, "student_absent", "email",
        {"is_enabled": True, "template": "Child {student_name} absent on {date}"}
    )

    # 2. Setup mock data
    # Create school, class, and students
    from app.models.school import School
    school = School(name="Test School", code="TS01")
    db_session.add(school)
    db_session.flush()

    klass = SchoolClass(name="Class 1A", school_id=school.id, grade_level=1)
    db_session.add(klass)
    db_session.flush()

    student = Student(
        student_id_number="S123",
        full_name="John Doe",
        class_id=klass.id,
        school_id=school.id,
        father_contact="father@test.com",  # Email format
        mother_contact="+60123456789"
    )
    db_session.add(student)
    db_session.flush()

    # Create attendance session with an ABSENT record
    session_data = {
        "class_id": klass.id,
        "date": date(2026, 6, 22),
        "time_slot_id": None,
        "method": "MANUAL"
    }
    records_data = [
        {"student_id": student.id, "status": "ABSENT", "notes": "Fever"}
    ]

    # Save attendance (triggers notification service inside)
    session = attendance_service.create_bulk_attendance(db_session, session_data, records_data)
    
    # Verify mock send was called with the correct details
    mock_send_email.assert_called_once()
    args, kwargs = mock_send_email.call_args
    assert args[1] == "father@test.com"
    assert "John Doe" in args[3]
    assert "2026-06-22" in args[3]

    # Verify notification log was created
    logs = db_session.query(NotificationLog).filter(NotificationLog.student_id == student.id).all()
    assert len(logs) == 1
    assert logs[0].status == "SENT"
    assert logs[0].event_type == "student_absent"
    assert logs[0].channel == "EMAIL"
    assert logs[0].reference_id == session.id


@patch("app.services.notification_service.send_email")
@pytest.mark.anyio
async def test_trigger_grade_notifications(mock_send_email, db_session: Session):
    # 1. Enable email connector and rule
    notification_service.update_connector(db_session, "email", {"is_enabled": True})
    notification_service.update_rule(
        db_session, "assignment_failed", "email",
        {"is_enabled": True, "template": "Failed: {student_name} got {score}/{max_points}", "passing_threshold": 50.0}
    )

    # 2. Setup mock data
    from app.models.school import School
    school = School(name="Test School", code="TS02")
    db_session.add(school)
    db_session.flush()

    # Create teacher & subject
    user = User(email="teacher1@school.com", hashed_password="hash", full_name="Cikgu Test", role="TEACHER")
    db_session.add(user)
    db_session.flush()

    teacher = Teacher(user_id=user.id, employee_id="T001", full_name="Cikgu Test", school_id=school.id)
    db_session.add(teacher)
    db_session.flush()

    subject = Subject(name="Math", code="M101", school_id=school.id)
    db_session.add(subject)
    db_session.flush()

    student = Student(
        student_id_number="S999",
        full_name="Jane Doe",
        school_id=school.id,
        father_contact="jane.parent@test.com"
    )
    db_session.add(student)
    db_session.flush()

    # Create assessment
    assessment = Assessment(
        title="Math Midterm",
        subject_id=subject.id,
        teacher_id=teacher.id,
        grading_type="MATH",
        config="10",  # expected answer
        max_points=100
    )
    db_session.add(assessment)
    db_session.flush()

    # Grade submission below threshold (e.g. 40 points)
    grade_data = {
        "student_id": student.id,
        "assessment_id": assessment.id,
        "student_response": "4"  # wrong response -> score = 0
    }
    
    # Grade submission (triggers notification service inside)
    grade = await grading_service.grade_submission(db_session, grade_data)
    
    # Verify mock send was called
    mock_send_email.assert_called_once()
    args, kwargs = mock_send_email.call_args
    assert args[1] == "jane.parent@test.com"
    assert "Jane Doe" in args[3]
    
    # Verify log in DB
    logs = db_session.query(NotificationLog).filter(NotificationLog.student_id == student.id).all()
    assert len(logs) == 1
    assert logs[0].status == "SENT"
    assert logs[0].event_type == "assignment_failed"
    assert logs[0].reference_id == grade.id
