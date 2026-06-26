from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, TimestampMixin


class Student(TimestampMixin, Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    class_id: Mapped[Optional[int]] = mapped_column(ForeignKey("school_classes.id"), nullable=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"))
    is_active: Mapped[bool] = mapped_column(default=True)
    merit_points: Mapped[int] = mapped_column(default=50)

    # Extended profiling details
    father_contact: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    mother_contact: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    guardian_contact: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    parent_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    residential_address: Mapped[Optional[str]] = mapped_column(String(555), nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    identity_card_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    enroll_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Relationships
    school = relationship("School", back_populates="students")
    school_class = relationship("SchoolClass", back_populates="students")
    attendance_records = relationship("AttendanceRecord", back_populates="student", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Student {self.student_id_number}: {self.full_name}>"
