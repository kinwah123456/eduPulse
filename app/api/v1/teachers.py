from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.schemas.teacher import TeacherCreate, TeacherUpdate, TeacherResponse, TeacherListResponse
from app.services import teacher_service

router = APIRouter()


@router.post("/", response_model=TeacherResponse)
def create_teacher(body: TeacherCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return teacher_service.create_teacher(db, body.model_dump())


@router.get("/", response_model=TeacherListResponse)
def list_teachers(
    skip: int = 0, limit: int = 100, school_id: int | None = None,
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    items, total = teacher_service.get_teachers(db, skip, limit, school_id)
    return TeacherListResponse(total=total, items=items)


@router.get("/{teacher_id}", response_model=TeacherResponse)
def get_teacher(teacher_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return teacher_service.get_teacher(db, teacher_id)


@router.put("/{teacher_id}", response_model=TeacherResponse)
def update_teacher(teacher_id: int, body: TeacherUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return teacher_service.update_teacher(db, teacher_id, body.model_dump(exclude_unset=True))


@router.delete("/{teacher_id}")
def delete_teacher(teacher_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    teacher_service.delete_teacher(db, teacher_id)
    return {"message": "Teacher deactivated"}
