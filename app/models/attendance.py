from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, TimestampMixin


class AttendanceSession(TimestampMixin, Base):
    __tablename__ = "attendance_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id"))
    date: Mapped[date] = mapped_column(Date)
    time_slot_id: Mapped[Optional[int]] = mapped_column(ForeignKey("time_slots.id"), nullable=True)
    recorded_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    method: Mapped[str] = mapped_column(String(20), default="MANUAL")  # MANUAL, CV_FACE, CV_BADGE

    # Relationships
    school_class = relationship("SchoolClass", back_populates="attendance_sessions")
    time_slot = relationship("TimeSlot")
    recorded_by = relationship("User")
    records = relationship("AttendanceRecord", back_populates="session", lazy="selectin", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<AttendanceSession {self.date} class={self.class_id}>"


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("attendance_sessions.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    status: Mapped[str] = mapped_column(String(20), default="PRESENT")  # PRESENT, ABSENT, LATE, EXCUSED
    recorded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student", back_populates="attendance_records")

    def __repr__(self) -> str:
        return f"<AttendanceRecord student={self.student_id} status={self.status}>"
