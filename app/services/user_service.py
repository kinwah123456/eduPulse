from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import User
from app.core.exceptions import NotFoundException


def get_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException(f"User with id {user_id} not found")
    return user


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> tuple[list[User], int]:
    total = db.query(User).count()
    items = db.query(User).offset(skip).limit(limit).all()
    return items, total


def update_user(db: Session, user_id: int, data: dict) -> User:
    user = get_user(db, user_id)
    for key, value in data.items():
        if value is not None:
            setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> None:
    user = get_user(db, user_id)
    user.is_active = False
    db.commit()
