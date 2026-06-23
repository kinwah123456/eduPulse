from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
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
    BatchGradeConfirmRequest
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
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    return await grading_service.grade_submission(db, body.model_dump())


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
        content = await file.read()
        results = grading_service.process_batch_zip(db, content, class_id, assessment_id)
        return {"session_id": results[0]["image_url"].split("/")[3] if results else None, "sheets": results}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batch-confirm")
async def batch_confirm(
    body: BatchGradeConfirmRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    results = []
    for item in body.grades:
        grade_payload = {
            "student_id": item.student_id,
            "assessment_id": body.assessment_id,
            "student_response": item.student_response
        }
        try:
            grade = await grading_service.grade_submission(db, grade_payload)
            results.append({
                "student_id": item.student_id,
                "status": "success",
                "score": grade.score,
                "grade_id": grade.id
            })
        except Exception as e:
            results.append({
                "student_id": item.student_id,
                "status": "failed",
                "detail": str(e)
            })
            
    return {"message": "Batch grading completed", "results": results}

