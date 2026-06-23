from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.schemas.school import SchoolCreate, SchoolUpdate, SchoolResponse, SchoolListResponse
from app.services import school_service

router = APIRouter()


@router.post("/", response_model=SchoolResponse)
def create_school(body: SchoolCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return school_service.create_school(db, body.model_dump())


@router.get("/", response_model=SchoolListResponse)
def list_schools(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    items, total = school_service.get_schools(db, skip, limit)
    return SchoolListResponse(total=total, items=items)


@router.get("/{school_id}", response_model=SchoolResponse)
def get_school(school_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return school_service.get_school(db, school_id)


@router.put("/{school_id}", response_model=SchoolResponse)
def update_school(school_id: int, body: SchoolUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return school_service.update_school(db, school_id, body.model_dump(exclude_unset=True))


@router.delete("/{school_id}")
def delete_school(school_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    school_service.delete_school(db, school_id)
    return {"message": "School deleted"}
