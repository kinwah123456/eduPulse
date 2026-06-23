from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.schemas.user import UserUpdate, UserResponse, UserListResponse
from app.services import user_service

router = APIRouter()


@router.get("/", response_model=UserListResponse)
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    items, total = user_service.get_users(db, skip, limit)
    return UserListResponse(total=total, items=items)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return user_service.get_user(db, user_id)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return user_service.update_user(db, user_id, body.model_dump(exclude_unset=True))


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user_service.delete_user(db, user_id)
    return {"message": "User deactivated"}
