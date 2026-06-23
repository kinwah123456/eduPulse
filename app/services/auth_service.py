from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.exceptions import UnauthorizedException, ConflictException


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise UnauthorizedException("Invalid email or password")
    if not user.is_active:
        raise UnauthorizedException("Account is disabled")
    return user


def create_token_for_user(user: User) -> str:
    return create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role})


def register_user(
    db: Session,
    email: str,
    password: str,
    full_name: str,
    role: str = "VIEWER",
    employee_id: str | None = None,
    school_id: int | None = None,
) -> User:
    from app.models.teacher import Teacher
    from app.models.school import School
    import random

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ConflictException(f"User with email {email} already exists")
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        role=role,
    )
    db.add(user)
    db.flush()

    if role == "TEACHER":
        if not school_id:
            first_school = db.query(School).first()
            school_id = first_school.id if first_school else 1

        if not employee_id:
            employee_id = f"T{random.randint(1000, 9999)}"
            while db.query(Teacher).filter(Teacher.employee_id == employee_id).first():
                employee_id = f"T{random.randint(1000, 9999)}"

        teacher = Teacher(
            employee_id=employee_id,
            full_name=full_name,
            email=email,
            school_id=school_id,
            user_id=user.id,
            is_active=True,
        )
        db.add(teacher)

    db.commit()
    db.refresh(user)
    return user
