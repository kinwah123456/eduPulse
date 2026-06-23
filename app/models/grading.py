from __future__ import annotations

from typing import Optional
from sqlalchemy import ForeignKey, String, Text, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, TimestampMixin


class Assessment(TimestampMixin, Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"))
    grading_type: Mapped[str] = mapped_column(String(20))  # OMR, MATH
    config: Mapped[str] = mapped_column(Text)  # JSON config (answers key or expression rules)
    max_points: Mapped[int] = mapped_column(Integer, default=100)

    # Relationships
    subject = relationship("Subject")
    teacher = relationship("Teacher")
    grades = relationship("StudentGrade", back_populates="assessment", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Assessment {self.id}: {self.title} ({self.grading_type})>"


class StudentGrade(TimestampMixin, Base):
    __tablename__ = "student_grades"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id"))
    student_response: Mapped[str] = mapped_column(Text)  # JSON or text response
    score: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="COMPLETED")  # COMPLETED, FAILED
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Detailed feedback

    # Relationships
    student = relationship("Student")
    assessment = relationship("Assessment", back_populates="grades")

    def __repr__(self) -> str:
        return f"<StudentGrade {self.id}: Student {self.student_id} Assessment {self.assessment_id} Score {self.score}>"
