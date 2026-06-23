from __future__ import annotations

import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import AsyncMock, patch

from app.models.teacher import Teacher
from app.models.academic import SchoolClass, Subject
from app.models.student import Student
from app.models.schedule import ScheduleEntry, Timetable
from app.models.attendance import AttendanceRecord
from app.models.merit import MeritLog, MeritOption


def test_automation_workflow(client: TestClient, db_session: Session):
    # ── Setup Authentication ──
    # 1. Register Admin
    resp = client.post("/api/v1/auth/register", json={
        "email": "admin@automation.local",
        "password": "admin123",
        "full_name": "Automation Admin",
        "role": "ADMIN"
    })
    assert resp.status_code == 200
    
    # Login Admin
    resp = client.post("/api/v1/auth/login", data={
        "username": "admin@automation.local",
        "password": "admin123"
    })
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create School
    resp = client.post("/api/v1/schools/", headers=admin_headers, json={
        "name": "SMK Automation",
        "code": "SMKA",
        "state": "Kuala Lumpur",
        "district": "Bangsar"
    })
    assert resp.status_code == 200
    school_id = resp.json()["id"]

    # Register Teacher
    resp = client.post("/api/v1/auth/register", headers=admin_headers, json={
        "email": "teacher@automation.local",
        "password": "teacher123",
        "full_name": "Cikgu Automation",
        "role": "TEACHER",
        "school_id": school_id,
        "employee_id": "TA001"
    })
    assert resp.status_code == 200
    
    # Login Teacher
    resp = client.post("/api/v1/auth/login", data={
        "username": "teacher@automation.local",
        "password": "teacher123"
    })
    assert resp.status_code == 200
    teacher_token = resp.json()["access_token"]
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    # ── Test 1: Template Downloads ──
    for task in ["teachers", "classrooms", "students", "schedules", "attendance", "merit"]:
        resp = client.get(f"/api/v1/automation/templates/{task}", headers=teacher_headers)
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "text/csv; charset=utf-8"
        assert task in resp.headers["content-disposition"]

    # ── Test 2: Batch Import Teachers (Admin Only) ──
    # Teachers import by teacher should fail (403)
    teacher_csv = (
        "employee_id,full_name,email,contact_number,emergency_contact,is_active\n"
        "TA002,Lim Wei Sheng,lim@school.edu.my,+6012-3456789,,true\n"
        "TA003,Noraini Binti Abdullah,noraini@school.edu.my,+6019-8765432,,true\n"
    )
    files = {"file": ("teachers.csv", io.BytesIO(teacher_csv.encode("utf-8")), "text/csv")}
    resp = client.post("/api/v1/automation/upload", headers=teacher_headers, data={"task": "teachers"}, files=files)
    assert resp.status_code == 403

    # Teachers import by admin should succeed
    files = {"file": ("teachers.csv", io.BytesIO(teacher_csv.encode("utf-8")), "text/csv")}
    resp = client.post("/api/v1/automation/upload", headers=admin_headers, data={"task": "teachers"}, files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success_count"] == 2
    assert data["failed_count"] == 0
    
    # Verify in DB
    t2 = db_session.query(Teacher).filter(Teacher.employee_id == "TA002").first()
    assert t2 is not None
    assert t2.full_name == "Lim Wei Sheng"
    
    # ── Test 3: Batch Import Classrooms ──
    class_csv = (
        "name,grade_level,capacity,form_teacher_employee_id\n"
        "3 Cempaka,3,35,TA002\n"
        "5 Dahlia,5,40,TA003\n"
    )
    files = {"file": ("classrooms.csv", io.BytesIO(class_csv.encode("utf-8")), "text/csv")}
    resp = client.post("/api/v1/automation/upload", headers=teacher_headers, data={"task": "classrooms"}, files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success_count"] == 2
    
    # Verify in DB
    c1 = db_session.query(SchoolClass).filter(SchoolClass.name == "3 Cempaka").first()
    assert c1 is not None
    assert c1.grade_level == 3
    assert c1.capacity == 35
    assert c1.form_teacher_id == t2.id

    # ── Test 4: Batch Import Students ──
    student_csv = (
        "student_id_number,full_name,class_name,gender,merit_points,residential_address,is_active\n"
        "SA2001,Muhammad Ali,3 Cempaka,MALE,50,\"No. 5, Jalan Melawati 1, Kuala Lumpur\",true\n"
        "SA2002,Fatimah Mahmud,3 Cempaka,FEMALE,60,No. 22 Gombak, Selangor,true\n"
    )
    files = {"file": ("students.csv", io.BytesIO(student_csv.encode("utf-8")), "text/csv")}
    resp = client.post("/api/v1/automation/upload", headers=teacher_headers, data={"task": "students"}, files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success_count"] == 2
    
    # Verify in DB
    s1 = db_session.query(Student).filter(Student.student_id_number == "SA2001").first()
    assert s1 is not None
    assert s1.full_name == "Muhammad Ali"
    assert s1.class_id == c1.id
    assert s1.merit_points == 50
    assert s1.residential_address == "No. 5, Jalan Melawati 1, Kuala Lumpur"

    s2 = db_session.query(Student).filter(Student.student_id_number == "SA2002").first()
    assert s2 is not None
    assert s2.residential_address == "No. 22 Gombak, Selangor"

    # ── Test 5: Batch Import Schedules ──
    schedule_csv = (
        "timetable_name,class_name,subject_code,teacher_employee_id,day_of_week,period_number\n"
        "Term 1 Timetable,3 Cempaka,MAT101,TA002,Monday,1\n"
        "Term 1 Timetable,3 Cempaka,SCI101,TA003,Monday,2\n"
    )
    files = {"file": ("schedules.csv", io.BytesIO(schedule_csv.encode("utf-8")), "text/csv")}
    resp = client.post("/api/v1/automation/upload", headers=teacher_headers, data={"task": "schedules"}, files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success_count"] == 2
    
    # Verify in DB
    timetable = db_session.query(Timetable).filter(Timetable.name == "Term 1 Timetable").first()
    assert timetable is not None
    entries = db_session.query(ScheduleEntry).filter(ScheduleEntry.timetable_id == timetable.id).all()
    assert len(entries) == 2

    # ── Test 6: Batch Import Attendance ──
    attendance_csv = (
        "student_id_number,date,status,period_number,notes\n"
        "SA2001,2026-06-22,PRESENT,,On time\n"
        "SA2002,2026-06-22,LATE,1,Bus breakdown\n"
    )
    files = {"file": ("attendance.csv", io.BytesIO(attendance_csv.encode("utf-8")), "text/csv")}
    resp = client.post("/api/v1/automation/upload", headers=teacher_headers, data={"task": "attendance"}, files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success_count"] == 2
    
    # Verify in DB
    records = db_session.query(AttendanceRecord).all()
    assert len(records) == 2
    assert records[0].status in ["PRESENT", "LATE"]

    # ── Test 7: Batch Import Merit ──
    merit_csv = (
        "student_id_number,merit_option_name,points,justification\n"
        "SA2001,Excellent Homework,10,Submitted ahead of time\n"
        "SA2002,Tardy,-5,Late to class 3 times\n"
    )
    files = {"file": ("merit.csv", io.BytesIO(merit_csv.encode("utf-8")), "text/csv")}
    resp = client.post("/api/v1/automation/upload", headers=teacher_headers, data={"task": "merit"}, files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success_count"] == 2
    
    # Verify points updated in DB
    db_session.refresh(s1)
    assert s1.merit_points == 60 # 50 + 10 = 60
    
    s2 = db_session.query(Student).filter(Student.student_id_number == "SA2002").first()
    assert s2.merit_points == 55 # 60 - 5 = 55
    
    # Verify MeritLogs created
    logs = db_session.query(MeritLog).all()
    assert len(logs) == 2

    # ── Test 8: OCR File Upload (Mocked winocr) ──
    # Mocking winocr.recognize_pil
    ocr_response = AsyncMock()
    ocr_response.text = (
        "student_id_number,merit_option_name,points,justification\n"
        "SA2001,Helping Teacher,10,Carried books\n"
    )
    
    with patch("winocr.recognize_pil", new_callable=AsyncMock) as mock_rec:
        mock_rec.return_value = ocr_response
        
        # Open mock image bytes (create a valid 1x1 image using PIL)
        from PIL import Image as PILImage
        img = PILImage.new('RGB', (1, 1), color='red')
        mock_image = io.BytesIO()
        img.save(mock_image, format='PNG')
        mock_image.seek(0)
        
        # Send post request with image
        files = {"file": ("mock_doc.png", mock_image, "image/png")}
        resp = client.post("/api/v1/automation/upload", headers=teacher_headers, data={"task": "merit"}, files=files)
        
        assert resp.status_code == 200
        data = resp.json()
        assert data["success_count"] == 1
        assert data["ocr_extracted_text"] is not None
        assert "Helping Teacher" in data["ocr_extracted_text"]
        
        # Verify points updated
        db_session.refresh(s1)
        assert s1.merit_points == 70 # 60 + 10 = 70
