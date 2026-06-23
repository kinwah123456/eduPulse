from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_admin, require_teacher_or_admin
from app.models.user import User
from app.schemas.merit import (
    MeritOptionCreate, MeritOptionUpdate, MeritOptionResponse,
    MeritAwardRequest, MeritLogResponse
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
