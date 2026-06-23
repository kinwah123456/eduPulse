import os
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.academic import Subject

def test_edupulse_full_qa_workflow(client: TestClient, db_session: Session):
    """
    Comprehensive QA end-to-end workflow test for eduPulse Ops.
    Covers Admin and Teacher operations, entity creation, schedules, attendance tracking, OMR batch grading, and dashboard metrics.
    """
    
    # ==========================================
    # PHASE 1: REGISTRATION & AUTHENTICATION
    # ==========================================
    
    # 1. Register first user - should be auto-promoted to ADMIN
    resp = client.post("/api/v1/auth/register", json={
        "email": "admin@edupulse.local",
        "password": "admin123",
        "full_name": "System Administrator",
        "role": "TEACHER"  # database is empty, so it will become ADMIN
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "admin@edupulse.local"
    assert data["role"] == "ADMIN"
    
    # 2. Login as admin
    resp = client.post("/api/v1/auth/login", data={
        "username": "admin@edupulse.local",
        "password": "admin123"
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Check profile
    resp = client.get("/api/v1/auth/me", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "ADMIN"
    
    # 4. Create school as Admin
    resp = client.post("/api/v1/schools/", headers=admin_headers, json={
        "name": "SMK Taman Melawati",
        "code": "SMK001",
        "state": "Selangor",
        "district": "Gombak"
    })
    assert resp.status_code == 200
    school_id = resp.json()["id"]
    assert school_id == 1
    
    # 5. Register teacher associated with school 1
    # Verify unauthenticated registration is now forbidden (401) since users exist
    resp = client.post("/api/v1/auth/register", json={
        "email": "teacher@edupulse.local",
        "password": "teacher123",
        "full_name": "Cikgu Ahmad bin Ismail",
        "role": "TEACHER",
        "school_id": school_id,
        "employee_id": "T0001"
    })
    assert resp.status_code == 401

    # Register with admin headers - should succeed
    resp = client.post("/api/v1/auth/register", headers=admin_headers, json={
        "email": "teacher@edupulse.local",
        "password": "teacher123",
        "full_name": "Cikgu Ahmad bin Ismail",
        "role": "TEACHER",
        "school_id": school_id,
        "employee_id": "T0001"
    })
    assert resp.status_code == 200
    assert resp.json()["role"] == "TEACHER"
    
    # 6. Login as teacher
    resp = client.post("/api/v1/auth/login", data={
        "username": "teacher@edupulse.local",
        "password": "teacher123"
    })
    assert resp.status_code == 200
    teacher_token = resp.json()["access_token"]
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
    
    # 7. Check teacher profile
    resp = client.get("/api/v1/auth/me", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "TEACHER"
    
    # 8. Verify Authorization Boundaries (Forbidden Operations)
    # Teacher tries to list users
    resp = client.get("/api/v1/users/", headers=teacher_headers)
    assert resp.status_code == 403
    
    # Teacher tries to create school
    resp = client.post("/api/v1/schools/", headers=teacher_headers, json={
        "name": "Forbidden School",
        "code": "BAD001"
    })
    assert resp.status_code == 403

    # ==========================================
    # PHASE 2: SCHOOL & USER MANAGEMENT
    # ==========================================
    
    # 1. List users as Admin
    resp = client.get("/api/v1/users/", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 2
    
    # 2. Get specific user
    resp = client.get("/api/v1/users/2", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "teacher@edupulse.local"
    
    # 3. Update teacher name as Admin
    resp = client.put("/api/v1/users/2", headers=admin_headers, json={
        "full_name": "Cikgu Ahmad bin Ismail (Senior)"
    })
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Cikgu Ahmad bin Ismail (Senior)"

    # Test Teacher Registry API endpoints (Creation, Retrieval, Update) with Contact Details
    # Create teacher
    resp = client.post("/api/v1/teachers/", headers=admin_headers, json={
        "employee_id": "T0002",
        "full_name": "Cikgu Fatimah",
        "email": "fatimah@edupulse.local",
        "contact_number": "+6012-3456789",
        "emergency_contact": "Husband: +6012-9876543",
        "school_id": 1
    })
    assert resp.status_code == 200
    new_t_id = resp.json()["id"]
    assert resp.json()["contact_number"] == "+6012-3456789"
    assert resp.json()["emergency_contact"] == "Husband: +6012-9876543"

    # Get teacher details
    resp = client.get(f"/api/v1/teachers/{new_t_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["contact_number"] == "+6012-3456789"
    assert resp.json()["emergency_contact"] == "Husband: +6012-9876543"

    # Update teacher contact details
    resp = client.put(f"/api/v1/teachers/{new_t_id}", headers=admin_headers, json={
        "contact_number": "+6012-1111111",
        "emergency_contact": "Wife: +6012-2222222"
    })
    assert resp.status_code == 200
    assert resp.json()["contact_number"] == "+6012-1111111"
    assert resp.json()["emergency_contact"] == "Wife: +6012-2222222"
    
    # 4. List schools
    resp = client.get("/api/v1/schools/", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
    
    # 5. Update school details as Admin
    resp = client.put("/api/v1/schools/1", headers=admin_headers, json={
        "district": "Gombak Utara"
    })
    assert resp.status_code == 200
    assert resp.json()["district"] == "Gombak Utara"

    # ==========================================
    # PHASE 3: CLASSROOM & STUDENT PROFILING
    # ==========================================
    
    # 1. Create classroom as Teacher
    resp = client.post("/api/v1/classes/", headers=teacher_headers, json={
        "name": "5 Amanah",
        "grade_level": 5,
        "school_id": 1,
        "capacity": 30
    })
    assert resp.status_code == 200
    class_id = resp.json()["id"]
    assert class_id == 1
    
    # 2. Update classroom capacity
    resp = client.put("/api/v1/classes/1", headers=teacher_headers, json={
        "capacity": 35
    })
    assert resp.status_code == 200
    assert resp.json()["capacity"] == 35
    
    # 3. Create student 1 (Lee Jia Wen)
    resp = client.post("/api/v1/students/", headers=teacher_headers, json={
        "student_id_number": "STU0001",
        "full_name": "Lee Jia Wen",
        "class_id": 1,
        "school_id": 1,
        "father_contact": "+6012-3456789",
        "mother_contact": "+6019-8765432",
        "guardian_contact": "+6017-1122334",
        "residential_address": "No. 15, Lorong Melawati, Kuala Lumpur",
        "gender": "FEMALE",
        "identity_card_number": "120303-14-5555",
        "birth_date": "2012-03-03",
        "enroll_date": "2024-01-10"
    })
    assert resp.status_code == 200
    assert resp.json()["student_id_number"] == "STU0001"
    assert resp.json()["father_contact"] == "+6012-3456789"
    assert resp.json()["mother_contact"] == "+6019-8765432"
    assert resp.json()["guardian_contact"] == "+6017-1122334"
    assert resp.json()["residential_address"] == "No. 15, Lorong Melawati, Kuala Lumpur"
    assert resp.json()["gender"] == "FEMALE"
    assert resp.json()["identity_card_number"] == "120303-14-5555"
    assert resp.json()["birth_date"] == "2012-03-03"
    assert resp.json()["enroll_date"] == "2024-01-10"

    # Update student 1 profile details
    resp = client.put("/api/v1/students/1", headers=teacher_headers, json={
        "father_contact": "+6012-0000000",
        "mother_contact": "+6019-0000000",
        "guardian_contact": "+6017-0000000",
        "residential_address": "Updated Address",
        "gender": "MALE",
        "identity_card_number": "120303-14-0000",
        "birth_date": "2012-03-04",
        "enroll_date": "2024-01-11"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["father_contact"] == "+6012-0000000"
    assert data["mother_contact"] == "+6019-0000000"
    assert data["guardian_contact"] == "+6017-0000000"
    assert data["residential_address"] == "Updated Address"
    assert data["gender"] == "MALE"
    assert data["identity_card_number"] == "120303-14-0000"
    assert data["birth_date"] == "2012-03-04"
    assert data["enroll_date"] == "2024-01-11"
    
    # 4. Create student 2 (Temporary Test Student)
    resp = client.post("/api/v1/students/", headers=teacher_headers, json={
        "student_id_number": "STU0002",
        "full_name": "Muhammad Ali",
        "class_id": 1,
        "school_id": 1
    })
    assert resp.status_code == 200
    student2_id = resp.json()["id"]
    
    # 5. List students in class 1
    resp = client.get("/api/v1/students/?class_id=1", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2
    
    # 6. Deactivate (delete) student 2
    resp = client.delete(f"/api/v1/students/{student2_id}", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["message"] == "Student deactivated"
    
    # 7. Check active student listing
    resp = client.get("/api/v1/students/?class_id=1", headers=teacher_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    active_students = [s for s in items if s["is_active"]]
    assert len(active_students) == 1
    assert active_students[0]["student_id_number"] == "STU0001"

    # ==========================================
    # PHASE 4: SCHEDULE CONFIGURATION
    # ==========================================
    
    # 1. Create a Subject using the new POST endpoint (Teacher role is allowed)
    resp = client.post("/api/v1/grading/subjects", headers=teacher_headers, json={
        "name": "Mathematics",
        "code": "MATH",
        "school_id": 1
    })
    assert resp.status_code == 200
    subject_id = resp.json()["id"]
    assert subject_id == 1
    
    # Try to create a duplicate subject code - should return 409 Conflict
    resp = client.post("/api/v1/grading/subjects", headers=teacher_headers, json={
        "name": "Maths Duplicate",
        "code": "MATH",
        "school_id": 1
    })
    assert resp.status_code == 409

    # 2. Update Subject details
    resp = client.put(f"/api/v1/grading/subjects/{subject_id}", headers=teacher_headers, json={
        "name": "Mathematics (Advanced Edition)"
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "Mathematics (Advanced Edition)"
    
    # 3. Create another subject for deletion testing
    resp = client.post("/api/v1/grading/subjects", headers=teacher_headers, json={
        "name": "Temporary Subject",
        "code": "TEMP",
        "school_id": 1
    })
    assert resp.status_code == 200
    temp_id = resp.json()["id"]
    
    # Delete the temporary subject - should succeed
    resp = client.delete(f"/api/v1/grading/subjects/{temp_id}", headers=teacher_headers)
    assert resp.status_code == 200
    
    # 4. Create a Time Slot as Admin
    resp = client.post("/api/v1/schedules/time-slots", headers=admin_headers, json={
        "day_of_week": 0,  # Monday
        "period_number": 1,
        "start_time": "07:30",
        "end_time": "08:10",
        "school_id": 1
    })
    assert resp.status_code == 200
    slot_id = resp.json()["id"]
    assert slot_id == 1
    
    # 5. List Time Slots
    resp = client.get("/api/v1/schedules/time-slots?school_id=1", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    
    # 6. Create a Timetable as Admin
    resp = client.post("/api/v1/schedules/timetables", headers=admin_headers, json={
        "name": "Main Timetable Term 1",
        "school_id": 1,
        "term": "Term 1 2026",
        "is_active": True
    })
    assert resp.status_code == 200
    timetable_id = resp.json()["id"]
    assert timetable_id == 1
    
    # 7. Add Schedule Entry as Teacher
    # Class ID = 1, Teacher Profile ID = 1, Subject ID = 1, Time Slot ID = 1
    # Verify timetable_id is now OPTIONAL in body since it's in the path parameters
    resp = client.post(f"/api/v1/schedules/timetables/{timetable_id}/entries", headers=teacher_headers, json={
        "class_id": 1,
        "teacher_id": 1,
        "subject_id": subject_id,
        "time_slot_id": slot_id
    })
    assert resp.status_code == 200
    assert resp.json()["timetable_id"] == 1
    
    # 8. List entries
    resp = client.get(f"/api/v1/schedules/timetables/{timetable_id}/entries?class_id=1", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    # 9. Verify Delete Constraint: Try to delete Mathematics subject when assigned to schedule entries
    # Should fail with 400 Bad Request
    resp = client.delete(f"/api/v1/grading/subjects/{subject_id}", headers=teacher_headers)
    assert resp.status_code == 400
    assert "Cannot delete subject" in resp.json()["detail"]

    # ==========================================
    # PHASE 5: ATTENDANCE TRACKING
    # ==========================================
    
    # 1. Create a regular attendance session
    resp = client.post("/api/v1/attendance/sessions", headers=teacher_headers, json={
        "class_id": 1,
        "date": "2026-06-22",
        "time_slot_id": 1,
        "method": "MANUAL"
    })
    assert resp.status_code == 200
    session_id = resp.json()["id"]
    assert session_id == 1
    
    # 2. Add individual record
    resp = client.post(f"/api/v1/attendance/sessions/{session_id}/records", headers=teacher_headers, json={
        "student_id": 1,
        "status": "PRESENT",
        "notes": "On time"
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "PRESENT"
    record_id = resp.json()["id"]
    
    # 3. Update record status
    resp = client.put(f"/api/v1/attendance/records/{record_id}", headers=teacher_headers, json={
        "status": "LATE",
        "notes": "Bus broke down"
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "LATE"
    
    # 4. Bulk Attendance Creation (creates session + records in one call)
    resp = client.post("/api/v1/attendance/bulk", headers=teacher_headers, json={
        "class_id": 1,
        "date": "2026-06-23",
        "time_slot_id": 1,
        "method": "MANUAL",
        "records": [
            {
                "student_id": 1,
                "status": "PRESENT",
                "notes": "Bulk checked"
            }
        ]
    })
    assert resp.status_code == 200
    assert len(resp.json()["records"]) == 1
    assert resp.json()["records"][0]["status"] == "PRESENT"
    
    # 5. Edge Ingestion (translates student_id_number -> student_id)
    resp = client.post("/api/v1/attendance/ingest", headers=teacher_headers, json={
        "class_id": 1,
        "date": "2026-06-24",
        "time_slot_id": 1,
        "method": "CV_FACE",
        "records": [
            {
                "student_id_number": "STU0001",
                "status": "PRESENT",
                "notes": "Edge device face scan"
            }
        ]
    })
    assert resp.status_code == 200
    assert len(resp.json()["records"]) == 1
    assert resp.json()["records"][0]["student_id"] == 1

    # ==========================================
    # PHASE 6: GRADING & ACADEMIC ENGINE
    # ==========================================
    
    # 1. Create an OMR assessment
    resp = client.post("/api/v1/grading/assessments", headers=teacher_headers, json={
        "title": "Science Chapter 1 Quiz",
        "subject_id": 1,
        "grading_type": "OMR",
        "config": '{"5": "B", "6": "A", "7": "A", "8": "C", "9": "D", "10": "B"}',
        "max_points": 60
    })
    assert resp.status_code == 200
    assessment_id = resp.json()["id"]
    
    # 2. Grade manual submission
    resp = client.post("/api/v1/grading/grade", headers=teacher_headers, json={
        "student_id": 1,
        "assessment_id": assessment_id,
        "student_response": '{"5": "B", "6": "A", "7": "A", "8": "C", "9": "D", "10": "B"}'
    })
    assert resp.status_code == 200
    assert resp.json()["score"] == 60.0
    assert resp.json()["status"] == "COMPLETED"
    
    # 3. Batch Upload ZIP containing OMR files
    zip_path = r"c:\Users\tse\Desktop\eduPulse\Sample Submissions.zip"
    assert os.path.exists(zip_path), "Sample Submissions.zip not found in workspace"
    
    with open(zip_path, "rb") as zf:
        resp = client.post("/api/v1/grading/batch-upload", headers=teacher_headers, data={
            "class_id": 1,
            "assessment_id": assessment_id
        }, files={
            "file": ("Sample Submissions.zip", zf, "application/zip")
        })
        
    assert resp.status_code == 200
    data = resp.json()
    assert "sheets" in data
    assert len(data["sheets"]) > 0
    sheet = data["sheets"][0]
    assert "answers" in sheet
    
    # 4. Batch Confirm Grades
    resp = client.post("/api/v1/grading/batch-confirm", headers=teacher_headers, json={
        "assessment_id": assessment_id,
        "grades": [
            {
                "student_id": 1,
                "student_response": json.dumps(sheet["answers"])
            }
        ]
    })
    assert resp.status_code == 200
    results = resp.json()["results"]
    assert len(results) == 1
    assert results[0]["status"] == "success"

    # ==========================================
    # PHASE 7: DASHBOARD METRICS & ALERTS
    # ==========================================
    
    # List active assessments
    resp = client.get("/api/v1/grading/assessments", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
    
    # List subject logs
    resp = client.get("/api/v1/grading/subjects", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
    
    # List grades
    resp = client.get("/api/v1/grading/grades", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1
