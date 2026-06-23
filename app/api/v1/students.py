from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_teacher_or_admin
from app.models.user import User
from app.schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentListResponse
from app.services import student_service

router = APIRouter()


@router.post("/", response_model=StudentResponse)
def create_student(body: StudentCreate, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    return student_service.create_student(db, body.model_dump())


@router.get("/", response_model=StudentListResponse)
def list_students(
    skip: int = 0, limit: int = 100,
    school_id: int | None = None, class_id: int | None = None,
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    items, total = student_service.get_students(db, skip, limit, school_id, class_id)
    return StudentListResponse(total=total, items=items)


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(student_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return student_service.get_student(db, student_id)


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(student_id: int, body: StudentUpdate, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    return student_service.update_student(db, student_id, body.model_dump(exclude_unset=True))


@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    student_service.delete_student(db, student_id)
    return {"message": "Student deactivated"}
