from __future__ import annotations

from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, TimestampMixin


class School(TimestampMixin, Base):
    __tablename__ = "schools"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    students = relationship("Student", back_populates="school", lazy="selectin")
    teachers = relationship("Teacher", back_populates="school", lazy="selectin")
    classes = relationship("SchoolClass", back_populates="school", lazy="selectin")
    subjects = relationship("Subject", back_populates="school", lazy="selectin")
    timetables = relationship("Timetable", back_populates="school", lazy="selectin")
    time_slots = relationship("TimeSlot", back_populates="school", lazy="selectin")

    def __repr__(self) -> str:
        return f"<School {self.code}: {self.name}>"
