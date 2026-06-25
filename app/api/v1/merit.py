from __future__ import annotations

from fastapi import APIRouter, Depends, Form, UploadFile, File, Request, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
import time
from collections import defaultdict

# Rate limiting settings: 5 submissions per 60 seconds per IP
SUBMISSION_LIMIT = 5
WINDOW_SECONDS = 60
IP_REQUESTS = defaultdict(list)


def rate_limit_submissions(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    # Filter older timestamps
    IP_REQUESTS[client_ip] = [t for t in IP_REQUESTS[client_ip] if now - t < WINDOW_SECONDS]
    if len(IP_REQUESTS[client_ip]) >= SUBMISSION_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many feedback submissions. Please try again later."
        )
    IP_REQUESTS[client_ip].append(now)


from app.core.database import get_db
from app.dependencies import get_current_user, require_admin, require_teacher_or_admin
from app.models.user import User
from app.schemas.merit import (
    MeritOptionCreate, MeritOptionUpdate, MeritOptionResponse,
    MeritAwardRequest, MeritLogResponse, MeritSubmissionResponse
)
from app.services import merit_service

router = APIRouter()


@router.get("/options", response_model=list[MeritOptionResponse])
def list_merit_options(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    return merit_service.get_merit_options(db, active_only)


@router.post("/options", response_model=MeritOptionResponse)
def create_merit_option(
    body: MeritOptionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    return merit_service.create_merit_option(db, body.model_dump())


@router.put("/options/{option_id}", response_model=MeritOptionResponse)
def update_merit_option(
    option_id: int,
    body: MeritOptionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    return merit_service.update_merit_option(db, option_id, body.model_dump(exclude_unset=True))


@router.delete("/options/{option_id}")
def delete_merit_option(
    option_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    merit_service.delete_merit_option(db, option_id)
    return {"message": "Merit option deleted"}


@router.post("/award", response_model=MeritLogResponse)
def award_merit_points(
    body: MeritAwardRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin)
):
    return merit_service.award_merit_points(
        db,
        user_id=current_user.id,
        student_id=body.student_id,
        option_id=body.option_id,
        justification=body.justification
    )


@router.get("/logs", response_model=list[MeritLogResponse])
def get_merit_logs(
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    return merit_service.get_merit_logs(db)


@router.delete("/logs/{log_id}")
def delete_merit_log(
    log_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    merit_service.delete_merit_log(db, log_id)
    return {"message": "Merit log entry deleted"}


@router.post("/submissions", response_model=MeritSubmissionResponse)
def create_feedback_submission(
    is_anonymous: bool = Form(...),
    identity_card_number: str | None = Form(None),
    description: str = Form(...),
    location: str | None = Form(None),
    images: list[UploadFile] | None = File(None),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
    _rate_limit: None = Depends(rate_limit_submissions)
):
    return merit_service.create_feedback_submission(
        db,
        is_anonymous=is_anonymous,
        identity_card_number=identity_card_number,
        description=description,
        location=location,
        uploaded_files=images,
        background_tasks=background_tasks
    )


@router.get("/submissions", response_model=list[MeritSubmissionResponse])
def list_feedback_submissions(
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin)
):
    return merit_service.get_feedback_submissions(db)


@router.post("/submissions/{submission_id}/acknowledge", response_model=MeritSubmissionResponse)
def acknowledge_feedback_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin)
):
    return merit_service.acknowledge_feedback_submission(
        db,
        submission_id=submission_id,
        user_id=current_user.id
    )


@router.delete("/submissions/{submission_id}")
def delete_feedback_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin)
):
    merit_service.delete_feedback_submission(db, submission_id)
    return {"message": "Feedback submission deleted"}

