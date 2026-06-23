from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.school import School
from app.core.exceptions import NotFoundException, ConflictException


def create_school(db: Session, data: dict) -> School:
    existing = db.query(School).filter(School.code == data["code"]).first()
    if existing:
        raise ConflictException(f"School with code {data['code']} already exists")
    school = School(**data)
    db.add(school)
    db.commit()
    db.refresh(school)
    return school


def get_school(db: Session, school_id: int) -> School:
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise NotFoundException(f"School with id {school_id} not found")
    return school


def get_schools(db: Session, skip: int = 0, limit: int = 100) -> tuple[list[School], int]:
    total = db.query(School).count()
    items = db.query(School).offset(skip).limit(limit).all()
    return items, total


def update_school(db: Session, school_id: int, data: dict) -> School:
    school = get_school(db, school_id)
    for key, value in data.items():
        if value is not None:
            setattr(school, key, value)
    db.commit()
    db.refresh(school)
    return school


def delete_school(db: Session, school_id: int) -> None:
    school = get_school(db, school_id)
    db.delete(school)
    db.commit()
