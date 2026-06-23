from __future__ import annotations

from typing import Optional
from sqlalchemy import ForeignKey, String, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, TimestampMixin


class MeritOption(TimestampMixin, Base):
    __tablename__ = "merit_options"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    points: Mapped[int] = mapped_column(Integer)  # Positive for award, negative for reduction
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<MeritOption {self.name} ({self.points} pts)>"


class MeritLog(TimestampMixin, Base):
    __tablename__ = "merit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    merit_option_id: Mapped[Optional[int]] = mapped_column(ForeignKey("merit_options.id", ondelete="SET NULL"), nullable=True)
    points_changed: Mapped[int] = mapped_column(Integer)
    justification: Mapped[str] = mapped_column(String(1000))

    # Relationships
    student = relationship("Student", lazy="joined")
    user = relationship("User", lazy="joined")
    merit_option = relationship("MeritOption", lazy="joined")

    def __repr__(self) -> str:
        return f"<MeritLog student_id={self.student_id} user_id={self.user_id} points={self.points_changed}>"
