from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.teacher import Teacher
from app.core.exceptions import NotFoundException, ConflictException


def create_teacher(db: Session, data: dict) -> Teacher:
    existing = db.query(Teacher).filter(Teacher.employee_id == data["employee_id"]).first()
    if existing:
        raise ConflictException(f"Teacher with employee ID {data['employee_id']} already exists")
    teacher = Teacher(**data)
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher


def get_teacher(db: Session, teacher_id: int) -> Teacher:
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise NotFoundException(f"Teacher with id {teacher_id} not found")
    return teacher


def get_teachers(
    db: Session, skip: int = 0, limit: int = 100,
    school_id: int | None = None,
) -> tuple[list[Teacher], int]:
    query = db.query(Teacher)
    if school_id is not None:
        query = query.filter(Teacher.school_id == school_id)
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return items, total


def update_teacher(db: Session, teacher_id: int, data: dict) -> Teacher:
    teacher = get_teacher(db, teacher_id)
    for key, value in data.items():
        if value is not None:
            setattr(teacher, key, value)
    db.commit()
    db.refresh(teacher)
    return teacher


def delete_teacher(db: Session, teacher_id: int) -> None:
    teacher = get_teacher(db, teacher_id)
    teacher.is_active = False
    db.commit()
