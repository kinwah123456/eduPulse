from __future__ import annotations

import json
from sqlalchemy.orm import Session
from app.models.grading import Assessment, StudentGrade
from app.models.academic import Subject
from app.models.student import Student
from app.core.exceptions import NotFoundException, ConflictException
from app.core.plugin_registry import EngineRegistry


def create_assessment(db: Session, data: dict, teacher_id: int) -> Assessment:
    # Verify subject exists
    subject = db.query(Subject).filter(Subject.id == data["subject_id"]).first()
    if not subject:
        raise NotFoundException(f"Subject with id {data['subject_id']} not found")

    assessment = Assessment(
        title=data["title"],
        subject_id=data["subject_id"],
        teacher_id=teacher_id,
        grading_type=data["grading_type"],
        config=data["config"],
        max_points=data.get("max_points", 100)
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


def get_assessment(db: Session, assessment_id: int) -> Assessment:
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise NotFoundException(f"Assessment with id {assessment_id} not found")
    return assessment


def get_assessments(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    subject_id: int | None = None,
    teacher_id: int | None = None
) -> tuple[list[Assessment], int]:
    query = db.query(Assessment)
    if subject_id is not None:
        query = query.filter(Assessment.subject_id == subject_id)
    if teacher_id is not None:
        query = query.filter(Assessment.teacher_id == teacher_id)

    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return items, total


def delete_assessment(db: Session, assessment_id: int) -> None:
    assessment = get_assessment(db, assessment_id)
    db.delete(assessment)
    db.commit()


async def grade_submission(db: Session, data: dict, background_tasks: any = None) -> StudentGrade:
    # Verify student exists
    student = db.query(Student).filter(Student.id == data["student_id"]).first()
    if not student:
        raise NotFoundException(f"Student with id {data['student_id']} not found")

    # Fetch assessment
    assessment = get_assessment(db, data["assessment_id"])

    # Determine grading engine
    engine_name = "OMREngine" if assessment.grading_type.upper() == "OMR" else "MathEngine"
    engine = EngineRegistry.get(engine_name)
    if not engine:
        raise NotFoundException(f"Grading engine '{engine_name}' is not registered/available")

    # Parse student response
    student_response_raw = data["student_response"]
    try:
        student_resp_dict = json.loads(student_response_raw)
    except Exception:
        # Fallback to direct raw string if not JSON format
        student_resp_dict = student_response_raw

    # Build payload
    if assessment.grading_type.upper() == "OMR":
        try:
            answer_key_dict = json.loads(assessment.config)
        except Exception:
            answer_key_dict = {}
        payload = {
            "student_response": student_resp_dict,
            "answer_key": answer_key_dict
        }
    else:
        # Math engine stub expectation
        payload = {
            "student_response": student_resp_dict,
            "expected_answer": assessment.config
        }

    # Process via engine
    try:
        result = await engine.process(payload)
        status = "COMPLETED"
        engine_score = result.get("score", 0.0)
        # Scale score to assessment max_points (engines return score in range 0-100)
        score = round((engine_score / 100.0) * assessment.max_points, 2)
        feedback_data = {
            "message": result.get("message"),
            "breakdown": result.get("breakdown"),
            "correct_count": result.get("correct_count"),
            "incorrect_count": result.get("incorrect_count"),
            "total_questions": result.get("total_questions")
        }
        feedback = json.dumps(feedback_data)
    except Exception as e:
        status = "FAILED"
        score = 0.0
        feedback = json.dumps({
            "message": f"Grading failed: {str(e)}",
            "breakdown": {},
            "correct_count": 0,
            "incorrect_count": 0,
            "total_questions": 0
        })

    # Check for existing grade
    existing_grade = db.query(StudentGrade).filter(
        StudentGrade.student_id == data["student_id"],
        StudentGrade.assessment_id == data["assessment_id"]
    ).first()

    if existing_grade:
        existing_grade.student_response = student_response_raw
        existing_grade.score = score
        existing_grade.status = status
        existing_grade.feedback = feedback
        db.commit()
        db.refresh(existing_grade)
        
        # Trigger grade notifications (safely)
        try:
            if background_tasks:
                from app.services.notification_service import trigger_grade_notifications_background
                background_tasks.add_task(trigger_grade_notifications_background, existing_grade.id)
            else:
                from app.services.notification_service import trigger_grade_notifications
                trigger_grade_notifications(db, existing_grade)
        except Exception as e:
            print(f"Failed to trigger grade notifications: {e}")
            
        return existing_grade
    else:
        new_grade = StudentGrade(
            student_id=data["student_id"],
            assessment_id=data["assessment_id"],
            student_response=student_response_raw,
            score=score,
            status=status,
            feedback=feedback
        )
        db.add(new_grade)
        db.commit()
        db.refresh(new_grade)
        
        # Trigger grade notifications (safely)
        try:
            if background_tasks:
                from app.services.notification_service import trigger_grade_notifications_background
                background_tasks.add_task(trigger_grade_notifications_background, new_grade.id)
            else:
                from app.services.notification_service import trigger_grade_notifications
                trigger_grade_notifications(db, new_grade)
        except Exception as e:
            print(f"Failed to trigger grade notifications: {e}")
            
        return new_grade



def get_student_grade(db: Session, grade_id: int) -> StudentGrade:
    grade = db.query(StudentGrade).filter(StudentGrade.id == grade_id).first()
    if not grade:
        raise NotFoundException(f"Grade with id {grade_id} not found")
    return grade


def get_student_grades(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    assessment_id: int | None = None,
    student_id: int | None = None
) -> tuple[list[StudentGrade], int]:
    query = db.query(StudentGrade)
    if assessment_id is not None:
        query = query.filter(StudentGrade.assessment_id == assessment_id)
    if student_id is not None:
        query = query.filter(StudentGrade.student_id == student_id)

    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return items, total


def update_assessment(db: Session, assessment_id: int, data: dict) -> Assessment:
    assessment = get_assessment(db, assessment_id)
    for key, value in data.items():
        if value is not None:
            setattr(assessment, key, value)
    db.commit()
    db.refresh(assessment)
    return assessment


def cleanup_inactive_assessments(db: Session) -> int:
    from datetime import datetime, timedelta
    
    # 90 days threshold for 3 months
    threshold = datetime.utcnow() - timedelta(days=90)
    
    assessments = db.query(Assessment).all()
    deleted_count = 0
    
    for a in assessments:
        # Check if assessment itself has been updated recently
        if a.updated_at > threshold:
            continue
            
        # Check if there are any grades recently computed
        recent_grade = db.query(StudentGrade).filter(
            StudentGrade.assessment_id == a.id,
            StudentGrade.updated_at > threshold
        ).first()
        
        if recent_grade:
            # Has recent grading activity, keep it
            continue
            
        # No activity for > 3 months, delete it
        db.delete(a)
        deleted_count += 1
        
    if deleted_count > 0:
        db.commit()
        
    return deleted_count


def process_batch_zip(db: Session, zip_bytes: bytes, class_id: int, assessment_id: int) -> list[dict]:
    import os
    import io
    import uuid
    import zipfile
    import hashlib
    from PIL import Image
    from app.models.student import Student
    from app.models.grading import Assessment
    
    # Verify assessment exists
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise NotFoundException(f"Assessment with id {assessment_id} not found")
        
    # Generate unique session ID for static files
    session_id = str(uuid.uuid4())
    temp_dir = os.path.join("app", "static", "temp_submissions", session_id)
    os.makedirs(temp_dir, exist_ok=True)
    
    # Fetch all students in the class
    class_students = db.query(Student).filter(Student.class_id == class_id, Student.is_active == True).all()
    if not class_students:
        raise NotFoundException(f"No active students found in class with id {class_id}")
        
    student_map = {s.full_name: s for s in class_students}
    
    results = []
    used_student_ids = set()
    
    # Sample mappings removed for dynamic answer detection
    
    with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
        for name in zf.namelist():
            if name.endswith('/') or "__MACOSX" in name or "Thumbs.db" in name:
                continue
                
            file_data = zf.read(name)
            sha256 = hashlib.sha256(file_data).hexdigest()
            base_name = os.path.basename(name)
            
            # Save original image
            dest_path = os.path.join(temp_dir, base_name)
            with open(dest_path, 'wb') as f:
                f.write(file_data)
                
            # Crop top 22% for name display
            crop_filename = f"crop_{base_name}"
            crop_path = os.path.join(temp_dir, crop_filename)
            try:
                with Image.open(dest_path) as img:
                    w, h = img.size
                    cropped = img.crop((0, 0, w, int(h * 0.22)))
                    cropped.save(crop_path, "JPEG")
            except Exception as e:
                # Fallback: copy original or create dummy if PIL fails
                with open(crop_path, 'wb') as f:
                    f.write(file_data)
            
            # URLs for frontend
            image_url = f"/static/temp_submissions/{session_id}/{base_name}"
            crop_url = f"/static/temp_submissions/{session_id}/{crop_filename}"
            
            # Determine dynamic OMR answers and student ID
            try:
                config_obj = json.loads(assessment.config)
                num_questions = len(config_obj)
            except Exception:
                num_questions = 10
                
            from app.services.omr_processor import extract_student_from_header, detect_answers_from_image
            
            # 1. OCR Name/ID matching
            student_id, student_name, confidence, status = extract_student_from_header(dest_path, db, class_id)
            
            # 2. Dynamic OMR bubble answer detection
            answers = detect_answers_from_image(dest_path, num_questions)
            

                    
            # Fill missing/undetected questions with blank string
            for i in range(1, num_questions + 1):
                q_key = str(i)
                if q_key not in answers:
                    answers[q_key] = ""
            
            # Add student ID to used set if matched
            if student_id:
                used_student_ids.add(student_id)
                
            results.append({
                "filename": base_name,
                "image_url": image_url,
                "crop_url": crop_url,
                "student_id": student_id,
                "student_name": student_name,
                "confidence": confidence,
                "answers": answers,
                "status": status,
                "sha256": sha256
            })
            
    # For any unmatched sheets, try to assign remaining unused students in the class
    unused_students = [s for s in class_students if s.id not in used_student_ids]
    for res in results:
        if not res["student_id"] and unused_students:
            fallback_student = unused_students.pop(0)
            res["student_id"] = fallback_student.id
            res["student_name"] = fallback_student.full_name
            res["status"] = "Verification Required"
            
    return results


def delete_temp_submission(session_id: str) -> None:
    """Safely delete a temporary submission directory by session ID."""
    import os
    import shutil
    import re
    
    if not session_id or not session_id.strip():
        return
        
    # Prevent path traversal by strictly validating UUID/alphanumeric format
    if not re.match(r"^[a-zA-Z0-9\-]+$", session_id):
        raise ValueError("Invalid session ID format")
        
    path = os.path.join("app", "static", "temp_submissions", session_id)
    if os.path.exists(path) and os.path.isdir(path):
        try:
            shutil.rmtree(path)
        except Exception as e:
            print(f"[Storage Cleanup] Error deleting directory {path}: {e}")


def cleanup_expired_temp_submissions(max_age_seconds: int = 86400) -> None:
    """Delete any temporary submission directories older than max_age_seconds (default 24h)."""
    import os
    import shutil
    import time
    
    temp_dir = os.path.join("app", "static", "temp_submissions")
    if not os.path.exists(temp_dir):
        return
        
    now = time.time()
    for entry in os.scandir(temp_dir):
        if entry.is_dir():
            # Check the directory's last modified time
            if now - entry.stat().st_mtime > max_age_seconds:
                try:
                    shutil.rmtree(entry.path)
                    print(f"[Storage Cleanup] Cleaned up expired OMR directory: {entry.name}")
                except Exception as e:
                    print(f"[Storage Cleanup] Failed to delete {entry.path}: {e}")



