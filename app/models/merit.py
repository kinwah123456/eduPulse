from datetime import datetime
from typing import Optional
from sqlalchemy import ForeignKey, String, Integer, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

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


class MeritSubmission(TimestampMixin, Base):
    __tablename__ = "merit_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    identity_card_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(String(2000), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    images: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Store JSON list of paths
    status: Mapped[str] = mapped_column(String(50), default="unread")  # "unread", "acknowledged"
    acknowledged_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    acknowledged_by = relationship("User", foreign_keys=[acknowledged_by_id])
    student = relationship("Student", foreign_keys=[student_id])

    def __repr__(self) -> str:
        return f"<MeritSubmission id={self.id} status={self.status} anonymous={self.is_anonymous}>"
