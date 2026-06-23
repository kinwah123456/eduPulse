from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_teacher_or_admin
from app.models.user import User
from app.schemas.academic import SchoolClassCreate, SchoolClassUpdate, SchoolClassResponse, SchoolClassListResponse
from app.services import class_service

router = APIRouter()


@router.post("/", response_model=SchoolClassResponse)
def create_classroom(body: SchoolClassCreate, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    return class_service.create_class(db, body.model_dump())


@router.get("/", response_model=SchoolClassListResponse)
def list_classrooms(
    skip: int = 0, limit: int = 100, school_id: int | None = None,
    db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    items, total = class_service.get_classes(db, skip, limit, school_id)
    return SchoolClassListResponse(total=total, items=items)


@router.get("/{class_id}", response_model=SchoolClassResponse)
def get_classroom(class_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return class_service.get_class(db, class_id)


@router.put("/{class_id}", response_model=SchoolClassResponse)
def update_classroom(class_id: int, body: SchoolClassUpdate, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    return class_service.update_class(db, class_id, body.model_dump(exclude_unset=True))
