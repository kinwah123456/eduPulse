import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
import pytest

from app.models.grading import BatchOMRRecord, Assessment, StudentGrade
from app.models.student import Student
from app.models.academic import SchoolClass, Subject
from app.services.grading_service import cleanup_expired_batch_omr_records


def test_batch_omr_history_endpoints_and_editing(client: TestClient, db_session: Session):
    # 1. Setup Admin Account and Headers
    resp = client.post("/api/v1/auth/register", json={
        "email": "teacher@history.local",
        "password": "teacher123",
        "full_name": "History Teacher",
        "role": "TEACHER"
    })
    assert resp.status_code == 200
    
    resp = client.post("/api/v1/auth/login", data={
        "username": "teacher@history.local",
        "password": "teacher123"
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Setup mock Classroom, Subject, Student, Assessment
    classroom = SchoolClass(name="Class 5 Delta", grade_level=5, school_id=1)
    db_session.add(classroom)
    db_session.commit()
    db_session.refresh(classroom)

    subject = Subject(name="Chemistry", code="CHEM101", school_id=1)
    db_session.add(subject)
    db_session.commit()
    db_session.refresh(subject)

    student = Student(
        student_id_number="S001",
        full_name="Muhammad Ali",
        identity_card_number="060101-14-1234",
        gender="Male",
        class_id=classroom.id,
        school_id=1,
        is_active=True
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)

    # config answer key with 3 questions
    assessment = Assessment(
        title="Chemistry Quiz 1",
        subject_id=subject.id,
        teacher_id=1,
        grading_type="OMR",
        config=json.dumps({"1": "A", "2": "B", "3": "C"}),
        max_points=3
    )
    db_session.add(assessment)
    db_session.commit()
    db_session.refresh(assessment)

    # 3. Test batch-confirm creates a BatchOMRRecord
    payload = {
        "assessment_id": assessment.id,
        "filename": "chem_quiz_run1.zip",
        "grades": [
            {
                "student_id": student.id,
                "student_response": json.dumps({"1": "A", "2": "A", "3": "A"})  # Score should be 1/3 (33.33%)
            }
        ]
    }
    resp = client.post("/api/v1/grading/batch-confirm", headers=headers, json=payload)
    assert resp.status_code == 200
    
    # Check that a BatchOMRRecord is created in database
    record = db_session.query(BatchOMRRecord).filter(BatchOMRRecord.assessment_id == assessment.id).first()
    assert record is not None
    assert record.filename == "chem_quiz_run1.zip"
    
    sheets_data = json.loads(record.data)
    assert len(sheets_data) == 1
    assert sheets_data[0]["student_name"] == "Muhammad Ali"
    # Live score: 1 correct out of 3 = 1.0 (since max_points is 3)
    assert sheets_data[0]["score"] == 1.0

    # 4. Test GET /grading/batch-records (List)
    resp = client.get("/api/v1/grading/batch-records", headers=headers)
    assert resp.status_code == 200
    records_list = resp.json()
    assert len(records_list) >= 1
    assert records_list[0]["assessment_title"] == "Chemistry Quiz 1"
    assert records_list[0]["subject_name"] == "Chemistry"
    assert records_list[0]["sheets_count"] == 1

    # 5. Test GET /grading/batch-records/{record_id} (Detail)
    resp = client.get(f"/api/v1/grading/batch-records/{record.id}", headers=headers)
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["filename"] == "chem_quiz_run1.zip"
    assert "answer_key" in detail
    assert detail["answer_key"]["1"] == "A"
    assert len(detail["sheets"]) == 1

    # 6. Test PUT /grading/batch-records/{record_id} (Edit/Correction)
    # We update the student's answer sheet to get a perfect score (A, B, C)
    update_payload = {
        "filename": "chem_quiz_corrected.zip",
        "grades": [
            {
                "student_id": student.id,
                "student_response": json.dumps({"1": "A", "2": "B", "3": "C"})
            }
        ]
    }
    resp = client.put(f"/api/v1/grading/batch-records/{record.id}", headers=headers, json=update_payload)
    assert resp.status_code == 200
    
    # Verify updates in the database record
    db_session.refresh(record)
    assert record.filename == "chem_quiz_corrected.zip"
    updated_sheets = json.loads(record.data)
    assert updated_sheets[0]["score"] == 3.0  # Perfect score (3/3)
    assert updated_sheets[0]["correct_count"] == 3

    # Verify the live student grade table was synchronized
    live_grade = db_session.query(StudentGrade).filter(
        StudentGrade.student_id == student.id,
        StudentGrade.assessment_id == assessment.id
    ).first()
    assert live_grade is not None
    assert live_grade.score == 3.0

    # 7. Test GET /grading/batch-records/{record_id}/download-csv (Formatted Filename)
    resp = client.get(f"/api/v1/grading/batch-records/{record.id}/download-csv", headers=headers)
    assert resp.status_code == 200
    
    content_disposition = resp.headers.get("Content-Disposition", "")
    # Should look like: attachment; filename="Class 5 Delta-Chemistry-2026-06-25_23-58-32.csv"
    assert "attachment; filename=" in content_disposition
    assert "Class 5 Delta-Chemistry-" in content_disposition
    assert ".csv" in content_disposition

    # 8. Test DELETE /grading/batch-temp/{session_id} (Manual temp delete)
    resp = client.delete("/api/v1/grading/batch-temp/nonexistent-session-id", headers=headers)
    # Should work (checks delete_temp_submission silently runs if not exists)
    assert resp.status_code == 200


def test_cleanup_expired_batch_omr_records(db_session: Session):
    # 1. Create a recent record and an expired record (> 1 year old)
    recent_record = BatchOMRRecord(
        assessment_id=1,
        filename="recent.zip",
        data="[]",
        created_at=datetime.utcnow()
    )
    
    expired_record = BatchOMRRecord(
        assessment_id=1,
        filename="expired.zip",
        data="[]",
        created_at=datetime.utcnow() - timedelta(days=366)  # Older than 1 year
    )
    
    db_session.add(recent_record)
    db_session.add(expired_record)
    db_session.commit()
    
    # 2. Run cleanup
    deleted = cleanup_expired_batch_omr_records(db_session)
    assert deleted >= 1
    
    # 3. Verify in database
    assert db_session.query(BatchOMRRecord).filter(BatchOMRRecord.filename == "recent.zip").first() is not None
    assert db_session.query(BatchOMRRecord).filter(BatchOMRRecord.filename == "expired.zip").first() is None
