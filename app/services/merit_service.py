from __future__ import annotations

import os
import json
import uuid
from datetime import datetime, timedelta
from fastapi import UploadFile, BackgroundTasks
from sqlalchemy.orm import Session
from app.models.merit import MeritOption, MeritLog, MeritSubmission
from app.models.student import Student
from app.models.user import User
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


def create_feedback_submission(
    db: Session,
    is_anonymous: bool,
    identity_card_number: str | None,
    description: str,
    location: str | None,
    uploaded_files: list[UploadFile] | None = None,
    background_tasks: BackgroundTasks | None = None
) -> MeritSubmission:
    if not description:
        raise ValidationException("Description is compulsory")
    if not is_anonymous and not identity_card_number:
        raise ValidationException("Identity card number is compulsory if anonymous is not selected")

    # Handle image uploads
    saved_paths = []
    if uploaded_files:
        upload_dir = os.path.join("app", "static", "feedback_uploads")
        os.makedirs(upload_dir, exist_ok=True)
        for file in uploaded_files:
            if not file.filename:
                continue
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
                continue
            unique_name = f"{uuid.uuid4()}{ext}"
            file_path = os.path.join(upload_dir, unique_name)
            content = file.file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            saved_paths.append(f"/static/feedback_uploads/{unique_name}")

    student_id = None
    if not is_anonymous and identity_card_number:
        student = db.query(Student).filter(Student.identity_card_number == identity_card_number).first()
        if student:
            student_id = student.id

    submission = MeritSubmission(
        is_anonymous=is_anonymous,
        identity_card_number=identity_card_number if not is_anonymous else None,
        description=description,
        location=location,
        images=json.dumps(saved_paths),
        status="unread",
        student_id=student_id
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    try:
        if background_tasks:
            from app.services.notification_service import trigger_feedback_notifications_background
            background_tasks.add_task(trigger_feedback_notifications_background, submission.id)
        else:
            from app.services.notification_service import trigger_feedback_notifications
            trigger_feedback_notifications(db, submission)
    except Exception as e:
        print(f"Failed to trigger feedback notifications: {e}")

    return submission


def get_feedback_submissions(db: Session) -> list[MeritSubmission]:
    return db.query(MeritSubmission).order_by(MeritSubmission.created_at.desc()).all()


def acknowledge_feedback_submission(db: Session, submission_id: int, user_id: int) -> MeritSubmission:
    submission = db.query(MeritSubmission).filter(MeritSubmission.id == submission_id).first()
    if not submission:
        raise NotFoundException(f"Feedback submission with id {submission_id} not found")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException(f"User with id {user_id} not found")

    submission.status = "acknowledged"
    submission.acknowledged_by_id = user.id
    submission.acknowledged_at = datetime.now()
    db.commit()
    db.refresh(submission)
    return submission


def cleanup_expired_feedback_submissions(db: Session, max_age_days: int = 365) -> int:
    """Delete feedback submissions older than 1 year (365 days) and their images."""
    cutoff = datetime.now() - timedelta(days=max_age_days)
    expired_subs = db.query(MeritSubmission).filter(MeritSubmission.created_at < cutoff).all()
    count = len(expired_subs)
    
    for sub in expired_subs:
        if sub.images:
            try:
                paths = json.loads(sub.images)
                for path in paths:
                    if path.startswith("/static/"):
                        # Convert /static/... to app/static/...
                        fs_path = os.path.join("app", "static", path.replace("/static/", "", 1))
                        if os.path.exists(fs_path):
                            os.remove(fs_path)
            except Exception as e:
                print(f"Failed to remove submission image: {e}")
        db.delete(sub)
        
    if count > 0:
        db.commit()
        
    return count


def delete_feedback_submission(db: Session, submission_id: int) -> None:
    """Delete a specific feedback submission and its uploaded images from the filesystem."""
    submission = db.query(MeritSubmission).filter(MeritSubmission.id == submission_id).first()
    if not submission:
        raise NotFoundException(f"Feedback submission with id {submission_id} not found")
        
    if submission.images:
        try:
            paths = json.loads(submission.images)
            for path in paths:
                if path.startswith("/static/"):
                    # Convert /static/... to app/static/...
                    fs_path = os.path.join("app", "static", path.replace("/static/", "", 1))
                    if os.path.exists(fs_path):
                        os.remove(fs_path)
        except Exception as e:
            print(f"Failed to remove submission image on delete: {e}")
            
    db.delete(submission)
    db.commit()


