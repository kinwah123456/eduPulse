from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, TimestampMixin


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    day_of_week: Mapped[int] = mapped_column()  # 0=Monday..4=Friday
    period_number: Mapped[int] = mapped_column()  # 1-8
    start_time: Mapped[str] = mapped_column(String(5))  # "07:30"
    end_time: Mapped[str] = mapped_column(String(5))  # "08:10"
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"))

    # Relationships
    school = relationship("School", back_populates="time_slots")

    def __repr__(self) -> str:
        return f"<TimeSlot day={self.day_of_week} period={self.period_number}>"


class Timetable(TimestampMixin, Base):
    __tablename__ = "timetables"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id"))
    term: Mapped[str] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(default=False)
    generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    school = relationship("School", back_populates="timetables")
    entries = relationship("ScheduleEntry", back_populates="timetable", lazy="selectin", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Timetable {self.name} term={self.term}>"


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    timetable_id: Mapped[int] = mapped_column(ForeignKey("timetables.id"))
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id"))
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"))
    time_slot_id: Mapped[int] = mapped_column(ForeignKey("time_slots.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    timetable = relationship("Timetable", back_populates="entries")
    school_class = relationship("SchoolClass", back_populates="schedule_entries")
    subject = relationship("Subject", back_populates="schedule_entries")
    teacher = relationship("Teacher", back_populates="schedule_entries")
    time_slot = relationship("TimeSlot")

    def __repr__(self) -> str:
        return f"<ScheduleEntry class={self.class_id} subject={self.subject_id}>"
