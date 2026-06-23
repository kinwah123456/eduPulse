from __future__ import annotations

from typing import Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, TimestampMixin


class Subject(TimestampMixin, Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"))

    # Relationships
    school = relationship("School", back_populates="subjects")
    schedule_entries = relationship("ScheduleEntry", back_populates="subject", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Subject {self.code}: {self.name}>"


class SchoolClass(TimestampMixin, Base):
    __tablename__ = "school_classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    grade_level: Mapped[int] = mapped_column()
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"))
    form_teacher_id: Mapped[Optional[int]] = mapped_column(ForeignKey("teachers.id"), nullable=True)
    capacity: Mapped[int] = mapped_column(default=40)

    # Relationships
    school = relationship("School", back_populates="classes")
    form_teacher = relationship("Teacher", back_populates="form_classes")
    students = relationship("Student", back_populates="school_class", lazy="selectin")
    attendance_sessions = relationship("AttendanceSession", back_populates="school_class", lazy="selectin")
    schedule_entries = relationship("ScheduleEntry", back_populates="school_class", lazy="selectin")

    def __repr__(self) -> str:
        return f"<SchoolClass {self.name} (Grade {self.grade_level})>"
