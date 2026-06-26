from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_teacher_or_admin
from app.models.user import User
from app.models.teacher import Teacher
from app.models.academic import Subject
from app.schemas.academic import SubjectResponse, SubjectListResponse, SubjectCreate, SubjectUpdate
from app.schemas.grading import (
    AssessmentCreate, AssessmentUpdate, AssessmentResponse, AssessmentListResponse,
    StudentGradeCreate, StudentGradeResponse, StudentGradeListResponse,
    BatchGradeConfirmRequest, BatchOMRRecordUpdateItem, BatchOMRRecordUpdateRequest
)
from app.services import grading_service

router = APIRouter()


@router.get("/subjects", response_model=SubjectListResponse)
def list_subjects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    query = db.query(Subject)
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return SubjectListResponse(total=total, items=items)


@router.post("/subjects", response_model=SubjectResponse)
def create_subject(
    body: SubjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    # Verify unique code
    existing = db.query(Subject).filter(Subject.code == body.code).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Subject with code '{body.code}' already exists")
    
    subject = Subject(
        name=body.name,
        code=body.code,
        school_id=body.school_id
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.put("/subjects/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    body: SubjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    if body.name is not None:
        subject.name = body.name
    if body.code is not None:
        # Check unique code
        existing = db.query(Subject).filter(Subject.code == body.code, Subject.id != subject_id).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Subject with code '{body.code}' already exists")
        subject.code = body.code
        
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/subjects/{subject_id}")
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Check if subject is used in schedule entries or assessments to prevent FK deletion errors
    from app.models.schedule import ScheduleEntry
    from app.models.grading import Assessment
    if db.query(ScheduleEntry).filter(ScheduleEntry.subject_id == subject_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete subject assigned to schedule entries")
    if db.query(Assessment).filter(Assessment.subject_id == subject_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete subject assigned to assessments")
        
    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted successfully"}


@router.post("/assessments", response_model=AssessmentResponse)
def create_assessment(
    body: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin)
):
    # Find teacher_id associated with current user
    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    if not teacher:
        if current_user.role == "ADMIN":
            teacher = db.query(Teacher).first()
            if not teacher:
                raise HTTPException(status_code=400, detail="No teachers available to assign this assessment to")
        else:
            raise HTTPException(status_code=400, detail="Current user is not associated with any teacher profile")
    
    return grading_service.create_assessment(db, body.model_dump(), teacher.id)


@router.get("/assessments", response_model=AssessmentListResponse)
def list_assessments(
    skip: int = 0,
    limit: int = 100,
    subject_id: int | None = None,
    teacher_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    items, total = grading_service.get_assessments(db, skip, limit, subject_id, teacher_id)
    return AssessmentListResponse(total=total, items=items)


@router.get("/assessments/{assessment_id}", response_model=AssessmentResponse)
def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    return grading_service.get_assessment(db, assessment_id)


@router.delete("/assessments/{assessment_id}")
def delete_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    grading_service.delete_assessment(db, assessment_id)
    return {"message": f"Assessment {assessment_id} deleted successfully"}


@router.put("/assessments/{assessment_id}", response_model=AssessmentResponse)
def update_assessment(
    assessment_id: int,
    body: AssessmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    return grading_service.update_assessment(db, assessment_id, body.model_dump(exclude_unset=True))


@router.post("/grade", response_model=StudentGradeResponse)
async def grade_submission(
    body: StudentGradeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    grade = await grading_service.grade_submission(db, body.model_dump(), background_tasks)
    
    warnings = []
    from app.models.notification import NotificationRule
    from app.models.student import Student
    from app.models.grading import Assessment
    from app.services.notification_service import resolve_parent_contact
    
    active_rules = db.query(NotificationRule).filter(
        NotificationRule.event_type == "assignment_failed",
        NotificationRule.is_enabled == True
    ).all()
    
    if active_rules:
        assessment = db.query(Assessment).filter(Assessment.id == grade.assessment_id).first()
        student = db.query(Student).filter(Student.id == grade.student_id).first()
        if assessment and student:
            score_pct = (grade.score / assessment.max_points) * 100.0 if assessment.max_points > 0 else 0.0
            for rule in active_rules:
                passing_threshold = rule.passing_threshold if rule.passing_threshold is not None else 50.0
                if score_pct < passing_threshold:
                    conn_type = rule.connector_type
                    if not resolve_parent_contact(student, conn_type):
                        warnings.append(
                            f"Parent/guardian contact details missing for {student.full_name} ({conn_type.upper()} academic alert failed)"
                        )
                        
    resp = StudentGradeResponse.model_validate(grade)
    resp.warnings = warnings
    return resp


@router.get("/grades", response_model=StudentGradeListResponse)
def list_grades(
    skip: int = 0,
    limit: int = 100,
    assessment_id: int | None = None,
    student_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    items, total = grading_service.get_student_grades(db, skip, limit, assessment_id, student_id)
    return StudentGradeListResponse(total=total, items=items)


@router.get("/grades/{grade_id}", response_model=StudentGradeResponse)
def get_grade(
    grade_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    return grading_service.get_student_grade(db, grade_id)


@router.post("/batch-upload")
async def batch_upload(
    class_id: int = Form(...),
    assessment_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files are supported")
        
    try:
        results = grading_service.process_batch_zip(db, file.file, class_id, assessment_id)
        return {"session_id": results[0]["image_url"].split("/")[3] if results else None, "sheets": results}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch-confirm")
async def batch_confirm(
    body: BatchGradeConfirmRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    results = []
    batch_records_data = []
    for item in body.grades:
        grade_payload = {
            "student_id": item.student_id,
            "assessment_id": body.assessment_id,
            "student_response": item.student_response
        }
        try:
            grade = await grading_service.grade_submission(db, grade_payload, background_tasks)
            
            # Check for warnings
            warnings = []
            from app.models.notification import NotificationRule
            from app.models.student import Student
            from app.models.grading import Assessment
            from app.services.notification_service import resolve_parent_contact
            
            active_rules = db.query(NotificationRule).filter(
                NotificationRule.event_type == "assignment_failed",
                NotificationRule.is_enabled == True
            ).all()
            
            if active_rules:
                assessment = db.query(Assessment).filter(Assessment.id == grade.assessment_id).first()
                student = db.query(Student).filter(Student.id == grade.student_id).first()
                if assessment and student:
                    score_pct = (grade.score / assessment.max_points) * 100.0 if assessment.max_points > 0 else 0.0
                    for rule in active_rules:
                        passing_threshold = rule.passing_threshold if rule.passing_threshold is not None else 50.0
                        if score_pct < passing_threshold:
                            conn_type = rule.connector_type
                            if not resolve_parent_contact(student, conn_type):
                                warnings.append(
                                    f"Parent/guardian contact details missing for {student.full_name} ({conn_type.upper()} academic alert failed)"
                                )
            
            student = db.query(Student).filter(Student.id == item.student_id).first()
            student_name = student.full_name if student else f"Student {item.student_id}"
            
            import json
            try:
                feedback_data = json.loads(grade.feedback)
            except Exception:
                feedback_data = {}
                
            batch_records_data.append({
                "student_id": item.student_id,
                "student_name": student_name,
                "score": grade.score,
                "student_response": item.student_response,
                "correct_count": feedback_data.get("correct_count", 0),
                "total_questions": feedback_data.get("total_questions", 0)
            })
            
            results.append({
                "student_id": item.student_id,
                "status": "success",
                "score": grade.score,
                "grade_id": grade.id,
                "warnings": warnings
            })
        except Exception as e:
            results.append({
                "student_id": item.student_id,
                "status": "failed",
                "detail": str(e)
            })
            
    # Save the batch OMR record in database history
    if batch_records_data:
        from app.models.grading import BatchOMRRecord
        import json
        batch_rec = BatchOMRRecord(
            assessment_id=body.assessment_id,
            filename=body.filename or "Batch OMR Results",
            data=json.dumps(batch_records_data)
        )
        db.add(batch_rec)
        db.commit()
            
    # Clean up temporary upload files if session_id is provided
    if body.session_id:
        try:
            grading_service.delete_temp_submission(body.session_id)
        except Exception as e:
            print(f"Failed to clean up temp submissions for session {body.session_id}: {e}")
            
    return {"message": "Batch grading completed", "results": results}


@router.delete("/batch-temp/{session_id}")
def delete_batch_temp(
    session_id: str,
    _: User = Depends(require_teacher_or_admin)
):
    try:
        grading_service.delete_temp_submission(session_id)
        return {"message": f"Temporary submission session {session_id} cleaned up successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/batch-records")
def list_batch_records(
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    from app.models.grading import BatchOMRRecord, Assessment
    from app.models.academic import Subject
    import json
    
    records = db.query(BatchOMRRecord).order_by(BatchOMRRecord.created_at.desc()).all()
    results = []
    
    for r in records:
        assessment = db.query(Assessment).filter(Assessment.id == r.assessment_id).first()
        assessment_title = assessment.title if assessment else "Unknown Assessment"
        subject_name = ""
        if assessment:
            subject = db.query(Subject).filter(Subject.id == assessment.subject_id).first()
            if subject:
                subject_name = subject.name
                
        try:
            sheets_data = json.loads(r.data)
            sheets_count = len(sheets_data)
        except Exception:
            sheets_count = 0
            
        results.append({
            "id": r.id,
            "assessment_id": r.assessment_id,
            "assessment_title": assessment_title,
            "subject_name": subject_name,
            "filename": r.filename,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "sheets_count": sheets_count
        })
        
    return results


@router.get("/batch-records/{record_id}")
def get_batch_record(
    record_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    from app.models.grading import BatchOMRRecord, Assessment
    import json
    
    record = db.query(BatchOMRRecord).filter(BatchOMRRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Batch record not found")
        
    assessment = db.query(Assessment).filter(Assessment.id == record.assessment_id).first()
    answer_key = {}
    if assessment:
        try:
            answer_key = json.loads(assessment.config)
        except Exception:
            pass
            
    try:
        sheets_data = json.loads(record.data)
    except Exception:
        sheets_data = []
        
    return {
        "id": record.id,
        "assessment_id": record.assessment_id,
        "assessment_title": assessment.title if assessment else "Unknown Assessment",
        "answer_key": answer_key,
        "filename": record.filename,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "sheets": sheets_data
    }


@router.put("/batch-records/{record_id}")
async def update_batch_record(
    record_id: int,
    body: BatchOMRRecordUpdateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    from app.models.grading import BatchOMRRecord, Assessment
    import json
    
    record = db.query(BatchOMRRecord).filter(BatchOMRRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Batch record not found")
        
    if body.filename is not None:
        record.filename = body.filename
        
    if body.grades is not None:
        assessment = db.query(Assessment).filter(Assessment.id == record.assessment_id).first()
        if not assessment:
            raise HTTPException(status_code=400, detail="Assessment not found for this batch record")
            
        try:
            current_sheets = json.loads(record.data)
        except Exception:
            current_sheets = []
            
        sheets_map = {s["student_id"]: s for s in current_sheets}
        
        for item in body.grades:
            grade_payload = {
                "student_id": item.student_id,
                "assessment_id": record.assessment_id,
                "student_response": item.student_response
            }
            grade = await grading_service.grade_submission(db, grade_payload, background_tasks)
            
            try:
                feedback_data = json.loads(grade.feedback)
            except Exception:
                feedback_data = {}
                
            if item.student_id in sheets_map:
                sheets_map[item.student_id]["student_response"] = item.student_response
                sheets_map[item.student_id]["score"] = grade.score
                sheets_map[item.student_id]["correct_count"] = feedback_data.get("correct_count", 0)
                sheets_map[item.student_id]["total_questions"] = feedback_data.get("total_questions", 0)
                
        record.data = json.dumps(list(sheets_map.values()))
        
    db.commit()
    db.refresh(record)
    return {"message": "Batch record updated successfully", "record_id": record.id}


@router.get("/batch-records/{record_id}/download-csv")
def download_batch_csv(
    record_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    from app.models.grading import BatchOMRRecord, Assessment
    from app.models.student import Student
    from app.models.academic import SchoolClass, Subject
    from datetime import datetime
    import csv
    import io
    import json
    from fastapi.responses import StreamingResponse
    
    record = db.query(BatchOMRRecord).filter(BatchOMRRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Batch record not found")
        
    assessment = db.query(Assessment).filter(Assessment.id == record.assessment_id).first()
    subject_name = "Unknown Subject"
    if assessment:
        subject = db.query(Subject).filter(Subject.id == assessment.subject_id).first()
        if subject:
            subject_name = subject.name
            
    try:
        sheets_data = json.loads(record.data)
    except Exception:
        sheets_data = []
        
    classroom_name = "Unknown Class"
    if sheets_data:
        first_student_id = sheets_data[0].get("student_id")
        if first_student_id:
            student = db.query(Student).filter(Student.id == first_student_id).first()
            if student and student.class_id:
                cls = db.query(SchoolClass).filter(SchoolClass.id == student.class_id).first()
                if cls:
                    classroom_name = cls.name
                    
    current_dt = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    csv_filename = f"{classroom_name}-{subject_name}-{current_dt}.csv"
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(["Student Name", "Score (%)", "Correct Answers", "Total Questions"])
    for s in sheets_data:
        writer.writerow([
            s.get("student_name", ""),
            s.get("score", 0.0),
            s.get("correct_count", 0),
            s.get("total_questions", 0)
        ])
        
    output.seek(0)
    headers = {
        'Content-Disposition': f'attachment; filename="{csv_filename}"'
    }
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)



