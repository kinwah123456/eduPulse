from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, TimestampMixin


class Teacher(TimestampMixin, Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    emergency_contact: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"))
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Relationships
    school = relationship("School", back_populates="teachers")
    user = relationship("User")
    form_classes = relationship("SchoolClass", back_populates="form_teacher", lazy="selectin")
    schedule_entries = relationship("ScheduleEntry", back_populates="teacher", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Teacher {self.employee_id}: {self.full_name}>"
