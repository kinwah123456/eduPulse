from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.academic import SchoolClass
from app.core.exceptions import NotFoundException, ConflictException


def create_class(db: Session, data: dict) -> SchoolClass:
    existing = db.query(SchoolClass).filter(
        SchoolClass.name == data["name"],
        SchoolClass.school_id == data["school_id"]
    ).first()
    if existing:
        raise ConflictException(f"Classroom with name {data['name']} already exists in this school")
    
    school_class = SchoolClass(**data)
    db.add(school_class)
    db.commit()
    db.refresh(school_class)
    return school_class


def get_class(db: Session, class_id: int) -> SchoolClass:
    school_class = db.query(SchoolClass).filter(SchoolClass.id == class_id).first()
    if not school_class:
        raise NotFoundException(f"Classroom with id {class_id} not found")
    return school_class


def get_classes(
    db: Session, skip: int = 0, limit: int = 100, school_id: int | None = None
) -> tuple[list[SchoolClass], int]:
    query = db.query(SchoolClass)
    if school_id is not None:
        query = query.filter(SchoolClass.school_id == school_id)
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return items, total


def update_class(db: Session, class_id: int, data: dict) -> SchoolClass:
    school_class = get_class(db, class_id)
    for key, value in data.items():
        if value is not None:
            setattr(school_class, key, value)
    db.commit()
    db.refresh(school_class)
    return school_class
