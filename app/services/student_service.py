from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.student import Student
from app.core.exceptions import NotFoundException, ConflictException


def create_student(db: Session, data: dict) -> Student:
    existing = db.query(Student).filter(Student.student_id_number == data["student_id_number"]).first()
    if existing:
        raise ConflictException(f"Student with ID {data['student_id_number']} already exists")
    student = Student(**data)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def get_student(db: Session, student_id: int) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise NotFoundException(f"Student with id {student_id} not found")
    return student


def get_students(
    db: Session, skip: int = 0, limit: int = 100,
    school_id: int | None = None, class_id: int | None = None,
) -> tuple[list[Student], int]:
    query = db.query(Student)
    if school_id is not None:
        query = query.filter(Student.school_id == school_id)
    if class_id is not None:
        query = query.filter(Student.class_id == class_id)
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return items, total


def update_student(db: Session, student_id: int, data: dict) -> Student:
    student = get_student(db, student_id)
    for key, value in data.items():
        if value is not None:
            setattr(student, key, value)
    db.commit()
    db.refresh(student)
    return student


def delete_student(db: Session, student_id: int) -> None:
    student = get_student(db, student_id)
    student.is_active = False
    db.commit()
