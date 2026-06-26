from __future__ import annotations

import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.school import School
from app.models.student import Student
from app.models.academic import SchoolClass
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.services import attendance_service


def test_attendance_warnings_logic_and_api(client: TestClient, db_session: Session):
    # 1. Register and login admin to perform setup operations
    resp = client.post("/api/v1/auth/register", json={
        "email": "admin@warnings.local",
        "password": "admin123",
        "full_name": "Warnings Admin",
        "role": "ADMIN"
    })
    assert resp.status_code == 200

    resp = client.post("/api/v1/auth/login", data={
        "username": "admin@warnings.local",
        "password": "admin123"
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create School and Class
    school = School(name="Warnings School", code="WS01")
    db_session.add(school)
    db_session.flush()

    klass = SchoolClass(name="Class 3 Cempaka", school_id=school.id, grade_level=3)
    db_session.add(klass)
    db_session.flush()

    # 3. Create Students
    # Student A: Fatimah (Consecutive Absences)
    student_a = Student(
        student_id_number="S001",
        full_name="Fatimah Binti Mahmud",
        class_id=klass.id,
        school_id=school.id,
        parent_email="parent_fatimah@test.local",
        is_active=True
    )
    # Student B: Ramu (Low Attendance Rate but not consecutive)
    student_b = Student(
        student_id_number="S002",
        full_name="Ramu A/L Ganesan",
        class_id=klass.id,
        school_id=school.id,
        parent_email="parent_ramu@test.local",
        is_active=True
    )
    # Student C: Normal student (Good Attendance)
    student_c = Student(
        student_id_number="S003",
        full_name="Normal Student",
        class_id=klass.id,
        school_id=school.id,
        parent_email="parent_normal@test.local",
        is_active=True
    )

    db_session.add_all([student_a, student_b, student_c])
    db_session.flush()

    # 4. Create Attendance Sessions and Records
    # We want 4 sessions to model the different scenarios:
    # Day 1: Fatimah (PRESENT), Ramu (ABSENT), Normal (PRESENT)
    # Day 2: Fatimah (PRESENT), Ramu (PRESENT), Normal (PRESENT)
    # Day 3: Fatimah (ABSENT), Ramu (ABSENT), Normal (PRESENT)
    # Day 4: Fatimah (ABSENT), Ramu (PRESENT), Normal (PRESENT)
    #
    # Resulting states:
    # - Fatimah: PRESENT, PRESENT, ABSENT, ABSENT (Ordered by date desc: ABSENT, ABSENT, PRESENT, PRESENT).
    #            Consecutive absences = 2 (critical alert).
    #            Total records = 4. Absent = 2. Rate = 50.0%.
    # - Ramu: ABSENT, PRESENT, ABSENT, PRESENT (Ordered by date desc: PRESENT, ABSENT, PRESENT, ABSENT).
    #         Consecutive absences = 0 (since most recent is PRESENT).
    #         Total records = 4. Absent = 2. Rate = 50.0% (< 85.0%, warning alert).
    # - Normal: PRESENT, PRESENT, PRESENT, PRESENT (Rate = 100.0%, no alert).

    days = [
        (date(2026, 6, 21), "PRESENT", "ABSENT", "PRESENT"),
        (date(2026, 6, 22), "PRESENT", "PRESENT", "PRESENT"),
        (date(2026, 6, 23), "ABSENT", "ABSENT", "PRESENT"),
        (date(2026, 6, 24), "ABSENT", "PRESENT", "PRESENT")
    ]

    for d, status_a, status_b, status_c in days:
        session = AttendanceSession(class_id=klass.id, date=d, method="MANUAL")
        db_session.add(session)
        db_session.flush()

        rec_a = AttendanceRecord(session_id=session.id, student_id=student_a.id, status=status_a)
        rec_b = AttendanceRecord(session_id=session.id, student_id=student_b.id, status=status_b)
        rec_c = AttendanceRecord(session_id=session.id, student_id=student_c.id, status=status_c)
        db_session.add_all([rec_a, rec_b, rec_c])

    db_session.commit()

    # 5. Direct Service Verification
    warnings = attendance_service.get_attendance_warnings(db_session, school_id=school.id)
    assert len(warnings) == 2

    # Find Fatimah warning
    warn_a = next((w for w in warnings if w["student_id"] == student_a.id), None)
    assert warn_a is not None
    assert warn_a["warning_type"] == "consecutive_absence"
    assert warn_a["severity"] == "critical"
    assert "2 consecutive" in warn_a["message"]

    # Find Ramu warning
    warn_b = next((w for w in warnings if w["student_id"] == student_b.id), None)
    assert warn_b is not None
    assert warn_b["warning_type"] == "low_rate"
    assert warn_b["severity"] == "warning"
    assert "Low attendance rate: 50.0%" in warn_b["message"]

    # 6. HTTP API Verification
    api_resp = client.get(f"/api/v1/attendance/warnings?school_id={school.id}", headers=headers)
    assert api_resp.status_code == 200
    res_data = api_resp.json()
    assert res_data["total"] == 2
    items = res_data["items"]

    api_warn_a = next((w for w in items if w["student_id"] == student_a.id), None)
    assert api_warn_a is not None
    assert api_warn_a["warning_type"] == "consecutive_absence"
    assert api_warn_a["severity"] == "critical"

    api_warn_b = next((w for w in items if w["student_id"] == student_b.id), None)
    assert api_warn_b is not None
    assert api_warn_b["warning_type"] == "low_rate"
    assert api_warn_b["severity"] == "warning"
