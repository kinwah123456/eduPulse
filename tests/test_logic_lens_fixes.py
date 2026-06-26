import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.teacher import Teacher
from app.models.student import Student
from app.models.academic import SchoolClass, Subject
from app.models.grading import Assessment, StudentGrade
from app.models.user import User
from app.models.notification import NotificationRule, NotificationConnector
from app.services.auth_service import register_user

def test_sequential_employee_id_generation(db_session: Session):
    # 1. Create a school
    from app.models.school import School
    school = School(name="Test School 5", code="TS05")
    db_session.add(school)
    db_session.flush()

    # 2. Register first teacher without employee ID (should be T1001 since max ID + 1 = 1)
    user1 = register_user(
        db=db_session,
        email="teacher5_1@school.com",
        password="password",
        full_name="Teacher 5.1",
        role="TEACHER",
        school_id=school.id
    )
    t1 = db_session.query(Teacher).filter(Teacher.user_id == user1.id).first()
    assert t1.employee_id == "T1001"

    # 3. Register second teacher without employee ID (should be T1002)
    user2 = register_user(
        db=db_session,
        email="teacher5_2@school.com",
        password="password",
        full_name="Teacher 5.2",
        role="TEACHER",
        school_id=school.id
    )
    t2 = db_session.query(Teacher).filter(Teacher.user_id == user2.id).first()
    assert t2.employee_id == "T1002"


def test_bulk_attendance_warnings_for_missing_contacts(client: TestClient, db_session: Session):
    # Enable rule and connector
    from app.services import notification_service
    notification_service.seed_notifications(db_session)
    notification_service.update_connector(db_session, "email", {"is_enabled": True})
    notification_service.update_rule(db_session, "student_absent", "email", {"is_enabled": True})

    # Setup auth and data
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
    token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {token}"}

    from app.models.school import School
    school = School(name="Test School 6", code="TS06")
    db_session.add(school)
    db_session.flush()

    klass = SchoolClass(name="Class 6A", school_id=school.id, grade_level=6)
    db_session.add(klass)
    db_session.flush()

    # Create student with missing contacts
    student = Student(
        student_id_number="S6001",
        full_name="Lee Jia Wen",
        class_id=klass.id,
        school_id=school.id,
        father_contact=None,
        mother_contact=None,
        guardian_contact=""
    )
    db_session.add(student)
    db_session.commit()

    # Bulk create attendance marking student ABSENT
    resp = client.post("/api/v1/attendance/bulk", headers=admin_headers, json={
        "class_id": klass.id,
        "date": "2026-06-23",
        "time_slot_id": None,
        "method": "MANUAL",
        "records": [
            {"student_id": student.id, "status": "ABSENT", "notes": "Sick"}
        ]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "warnings" in data
    assert len(data["warnings"]) > 0
    assert "Parent/guardian contact details missing" in data["warnings"][0]
    assert "Lee Jia Wen" in data["warnings"][0]


def test_grade_submission_warnings_for_missing_contacts(client: TestClient, db_session: Session):
    # Enable rule and connector
    from app.services import notification_service
    notification_service.seed_notifications(db_session)
    notification_service.update_connector(db_session, "email", {"is_enabled": True})
    notification_service.update_rule(
        db_session, "assignment_failed", "email",
        {"is_enabled": True, "passing_threshold": 50.0}
    )

    # Setup auth
    resp = client.post("/api/v1/auth/register", json={
        "email": "admin2@warnings.local",
        "password": "admin123",
        "full_name": "Warnings Admin 2",
        "role": "ADMIN"
    })
    resp = client.post("/api/v1/auth/login", data={
        "username": "admin2@warnings.local",
        "password": "admin123"
    })
    token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {token}"}

    from app.models.school import School
    school = School(name="Test School 7", code="TS07")
    db_session.add(school)
    db_session.flush()

    user = User(email="teacher7@school.com", hashed_password="hash", full_name="Teacher 7", role="TEACHER")
    db_session.add(user)
    db_session.flush()

    teacher = Teacher(user_id=user.id, employee_id="T007", full_name="Teacher 7", school_id=school.id)
    db_session.add(teacher)
    db_session.flush()

    subject = Subject(name="Math 7", code="M707", school_id=school.id)
    db_session.add(subject)
    db_session.flush()

    # Create student with missing contacts
    student = Student(
        student_id_number="S7001",
        full_name="John Doe",
        class_id=None,
        school_id=school.id,
        father_contact="",
        mother_contact=None,
        guardian_contact=""
    )
    db_session.add(student)
    db_session.flush()

    # Create assessment
    assessment = Assessment(
        title="Midterm",
        subject_id=subject.id,
        teacher_id=teacher.id,
        grading_type="MATH",
        config="10",
        max_points=100
    )
    db_session.add(assessment)
    db_session.commit()

    # Send grade submission that fails
    resp = client.post("/api/v1/grading/grade", headers=admin_headers, json={
        "student_id": student.id,
        "assessment_id": assessment.id,
        "student_response": "4" # wrong answer
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "warnings" in data
    assert len(data["warnings"]) > 0
    assert "Parent/guardian contact details missing" in data["warnings"][0]
    assert "John Doe" in data["warnings"][0]


def test_feedback_deletion_path_traversal_protection(db_session: Session):
    from app.models.merit import MeritSubmission
    from app.services.merit_service import delete_feedback_submission
    import os
    import json

    # Create a dummy file outside the uploads directory (e.g. in app/static/test_traversal.txt)
    base_dir = os.path.abspath(os.path.join("app", "static"))
    os.makedirs(base_dir, exist_ok=True)
    secret_file_path = os.path.join(base_dir, "test_traversal.txt")
    with open(secret_file_path, "w") as f:
        f.write("sensitive data")

    assert os.path.exists(secret_file_path)

    # Create submission with path traversal image list
    submission = MeritSubmission(
        is_anonymous=True,
        description="Test Traversal",
        images=json.dumps(["/static/../test_traversal.txt"])
    )
    db_session.add(submission)
    db_session.commit()

    # Call delete
    delete_feedback_submission(db_session, submission.id)

    # Assert that the file was NOT deleted (path traversal was blocked)
    assert os.path.exists(secret_file_path), "File outside the uploads folder was deleted (path traversal vulnerability!)"

    # Cleanup the secret file
    try:
        os.remove(secret_file_path)
    except Exception:
        pass


def test_batch_transaction_safety_savepoint(db_session: Session):
    from app.models.student import Student
    from app.models.merit import MeritOption, MeritLog
    from app.services.automation_service import process_batch_merit

    # 1. Setup a school and student
    from app.models.school import School
    school = School(name="Test School 8", code="TS08")
    db_session.add(school)
    db_session.flush()

    student = Student(
        student_id_number="S8001",
        full_name="Valid Student",
        school_id=school.id,
        merit_points=50
    )
    db_session.add(student)

    # Register admin/teacher user
    user = User(email="admin8@school.com", hashed_password="hash", full_name="Admin 8", role="ADMIN")
    db_session.add(user)
    db_session.commit()

    # Create merit option
    option = MeritOption(name="Good Deed", points=10, is_active=True)
    db_session.add(option)
    db_session.commit()

    # 2. Prepare batch rows: Row 1 is valid, Row 2 is invalid (student doesn't exist), Row 3 is valid
    rows = [
        {"_row_num": 1, "student_id_number": "S8001", "merit_option_name": "Good Deed", "points": "10", "justification": "Helper"},
        {"_row_num": 2, "student_id_number": "INVALID999", "merit_option_name": "Good Deed", "points": "10", "justification": "None"},
        {"_row_num": 3, "student_id_number": "S8001", "merit_option_name": "Good Deed", "points": "5", "justification": "Helper 2"}
    ]

    # Run batch import
    results = process_batch_merit(db_session, rows, school_id=school.id, user_id=user.id)

    # Verify results
    assert len(results) == 3
    assert results[0]["status"] == "success"
    assert results[1]["status"] == "failed"
    assert results[2]["status"] == "success" # With savepoints, the third row should still succeed!

    # Refresh student from DB
    db_session.refresh(student)
    # The valid rows should have succeeded and accumulated points (50 + 10 + 5 = 65)
    assert student.merit_points == 65, f"Expected 65 merit points, got {student.merit_points}"

