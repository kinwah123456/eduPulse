from __future__ import annotations

from fastapi import APIRouter, Depends, Request, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate, UserResponse
from app.services import auth_service

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticate user and return JWT token."""
    user = auth_service.authenticate_user(db, form_data.username, form_data.password)
    token = auth_service.create_token_for_user(user)
    return TokenResponse(access_token=token)


@router.post("/register", response_model=UserResponse)
def register(request: Request, body: UserCreate, db: Session = Depends(get_db)):
    """Register a new user.

    If no users exist in the DB, the first registration is auto-promoted to ADMIN.
    Otherwise, only admins can register new users.
    """
    user_count = db.query(User).count()
    if user_count > 0:
        # Enforce that only admins can register new users
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated. Admin token required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = auth_header.split(" ")[1]
        try:
            current_user = get_current_user(token, db)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if current_user.role != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to register new users",
            )
            
    role = "ADMIN" if user_count == 0 else body.role

    user = auth_service.register_user(
        db,
        body.email,
        body.password,
        body.full_name,
        role,
        body.employee_id,
        body.school_id
    )
    return user


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user
