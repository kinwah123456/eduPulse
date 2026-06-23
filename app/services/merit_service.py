from __future__ import annotations

from sqlalchemy.orm import Session
from app.models.merit import MeritOption, MeritLog
from app.models.student import Student
from app.core.exceptions import NotFoundException, ConflictException, ValidationException


def create_merit_option(db: Session, data: dict) -> MeritOption:
    existing = db.query(MeritOption).filter(MeritOption.name == data["name"]).first()
    if existing:
        raise ConflictException(f"Merit option with name '{data['name']}' already exists")
    option = MeritOption(**data)
    db.add(option)
    db.commit()
    db.refresh(option)
    return option


def get_merit_options(db: Session, active_only: bool = False) -> list[MeritOption]:
    query = db.query(MeritOption)
    if active_only:
        query = query.filter(MeritOption.is_active == True)
    return query.all()


def get_merit_option(db: Session, option_id: int) -> MeritOption:
    option = db.query(MeritOption).filter(MeritOption.id == option_id).first()
    if not option:
        raise NotFoundException(f"Merit option with id {option_id} not found")
    return option


def update_merit_option(db: Session, option_id: int, data: dict) -> MeritOption:
    option = get_merit_option(db, option_id)
    if "name" in data and data["name"] != option.name:
        existing = db.query(MeritOption).filter(MeritOption.name == data["name"]).first()
        if existing:
            raise ConflictException(f"Merit option with name '{data['name']}' already exists")
    for key, value in data.items():
        if value is not None:
            setattr(option, key, value)
    db.commit()
    db.refresh(option)
    return option


def delete_merit_option(db: Session, option_id: int) -> None:
    option = get_merit_option(db, option_id)
    db.delete(option)
    db.commit()


def award_merit_points(db: Session, user_id: int, student_id: int, option_id: int, justification: str) -> MeritLog:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise NotFoundException(f"Student with id {student_id} not found")

    option = get_merit_option(db, option_id)
    if not option.is_active:
        raise ValidationException(f"Merit option '{option.name}' is inactive and cannot be used")

    # Modify student's points (and ensure it doesn't drop below 0 if that's a constraint, but typically point tallies can be negative or positive. The requirements don't mention a minimum floor, so standard addition/subtraction is perfect.)
    student.merit_points += option.points

    log = MeritLog(
        student_id=student_id,
        user_id=user_id,
        merit_option_id=option_id,
        points_changed=option.points,
        justification=justification
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_merit_logs(db: Session) -> list[MeritLog]:
    return db.query(MeritLog).order_by(MeritLog.created_at.desc()).all()


def delete_merit_log(db: Session, log_id: int) -> None:
    log = db.query(MeritLog).filter(MeritLog.id == log_id).first()
    if not log:
        raise NotFoundException(f"Merit log with id {log_id} not found")
    db.delete(log)
    db.commit()
