from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.schedule import TimeSlot, Timetable, ScheduleEntry
from app.core.exceptions import NotFoundException, ConflictException


def create_time_slot(db: Session, data: dict) -> TimeSlot:
    slot = TimeSlot(**data)
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


def get_time_slots(db: Session, school_id: int) -> list[TimeSlot]:
    return db.query(TimeSlot).filter(TimeSlot.school_id == school_id).order_by(
        TimeSlot.day_of_week, TimeSlot.period_number
    ).all()


def update_time_slot(db: Session, slot_id: int, data: dict) -> TimeSlot:
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id).first()
    if not slot:
        raise NotFoundException(f"Time slot {slot_id} not found")
    for key, value in data.items():
        if value is not None:
            setattr(slot, key, value)
    db.commit()
    db.refresh(slot)
    return slot


def delete_time_slot(db: Session, slot_id: int) -> None:
    slot = db.query(TimeSlot).filter(TimeSlot.id == slot_id).first()
    if not slot:
        raise NotFoundException(f"Time slot {slot_id} not found")
    
    # Check if referenced by schedule entries
    referencing_entries = db.query(ScheduleEntry).filter(ScheduleEntry.time_slot_id == slot_id).count()
    if referencing_entries > 0:
        raise ConflictException("Cannot delete timeslot: it is referenced by existing schedule entries.")
        
    db.delete(slot)
    db.commit()



def create_timetable(db: Session, data: dict) -> Timetable:
    timetable = Timetable(**data)
    db.add(timetable)
    db.commit()
    db.refresh(timetable)
    return timetable


def get_timetable(db: Session, timetable_id: int) -> Timetable:
    timetable = db.query(Timetable).filter(Timetable.id == timetable_id).first()
    if not timetable:
        raise NotFoundException(f"Timetable {timetable_id} not found")
    return timetable


def get_timetables(
    db: Session, skip: int = 0, limit: int = 100, school_id: int | None = None,
) -> tuple[list[Timetable], int]:
    query = db.query(Timetable)
    if school_id is not None:
        query = query.filter(Timetable.school_id == school_id)
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return items, total


def update_timetable(db: Session, timetable_id: int, data: dict) -> Timetable:
    timetable = get_timetable(db, timetable_id)
    if data.get("is_active") is True:
        # Deactivate all other timetables for the same school
        db.query(Timetable).filter(
            Timetable.school_id == timetable.school_id,
            Timetable.id != timetable_id
        ).update({Timetable.is_active: False})

    for key, value in data.items():
        if value is not None:
            setattr(timetable, key, value)
    db.commit()
    db.refresh(timetable)
    return timetable


def delete_timetable(db: Session, timetable_id: int) -> None:
    timetable = get_timetable(db, timetable_id)
    db.delete(timetable)
    db.commit()


def add_schedule_entry(db: Session, data: dict) -> ScheduleEntry:
    timetable_id = data.get("timetable_id")
    class_id = data.get("class_id")
    teacher_id = data.get("teacher_id")
    time_slot_id = data.get("time_slot_id")

    # 1. Check classroom conflict
    existing_class_slot = db.query(ScheduleEntry).filter(
        ScheduleEntry.timetable_id == timetable_id,
        ScheduleEntry.class_id == class_id,
        ScheduleEntry.time_slot_id == time_slot_id
    ).first()
    if existing_class_slot:
        raise ConflictException("This classroom is already scheduled for another subject at this time slot.")

    # 2. Check teacher conflict
    existing_teacher_slot = db.query(ScheduleEntry).filter(
        ScheduleEntry.timetable_id == timetable_id,
        ScheduleEntry.teacher_id == teacher_id,
        ScheduleEntry.time_slot_id == time_slot_id
    ).first()
    if existing_teacher_slot:
        from app.models.teacher import Teacher
        teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
        teacher_name = teacher.full_name if teacher else "Teacher"
        raise ConflictException(f"{teacher_name} is already scheduled to teach another class at this time slot.")

    entry = ScheduleEntry(**data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def update_schedule_entry(db: Session, entry_id: int, data: dict) -> ScheduleEntry:
    entry = db.query(ScheduleEntry).filter(ScheduleEntry.id == entry_id).first()
    if not entry:
        raise NotFoundException(f"Schedule entry {entry_id} not found")

    timetable_id = entry.timetable_id
    class_id = entry.class_id
    teacher_id = data.get("teacher_id", entry.teacher_id)
    time_slot_id = entry.time_slot_id

    # Since class_id and time_slot_id are fixed for this specific entry cell,
    # we only need to check if the new teacher is conflicted with another class at this time slot.
    if teacher_id != entry.teacher_id:
        existing_teacher_slot = db.query(ScheduleEntry).filter(
            ScheduleEntry.timetable_id == timetable_id,
            ScheduleEntry.teacher_id == teacher_id,
            ScheduleEntry.time_slot_id == time_slot_id,
            ScheduleEntry.id != entry_id
        ).first()
        if existing_teacher_slot:
            from app.models.teacher import Teacher
            teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
            teacher_name = teacher.full_name if teacher else "Teacher"
            raise ConflictException(f"{teacher_name} is already scheduled to teach another class at this time slot.")

    for key, value in data.items():
        setattr(entry, key, value)

    db.commit()
    db.refresh(entry)
    return entry


def get_schedule_entries(
    db: Session,
    timetable_id: int,
    class_id: int | None = None,
    teacher_id: int | None = None,
    student_id: int | None = None
) -> list[ScheduleEntry]:
    query = db.query(ScheduleEntry).filter(ScheduleEntry.timetable_id == timetable_id)
    if class_id is not None:
        query = query.filter(ScheduleEntry.class_id == class_id)
    elif teacher_id is not None:
        query = query.filter(ScheduleEntry.teacher_id == teacher_id)
    elif student_id is not None:
        from app.models.student import Student
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student or not student.class_id:
            return []
        query = query.filter(ScheduleEntry.class_id == student.class_id)
    return query.all()


def delete_schedule_entry(db: Session, entry_id: int) -> None:
    entry = db.query(ScheduleEntry).filter(ScheduleEntry.id == entry_id).first()
    if not entry:
        raise NotFoundException(f"Schedule entry {entry_id} not found")
    db.delete(entry)
    db.commit()
