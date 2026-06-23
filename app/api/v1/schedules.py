from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user, require_admin, require_teacher_or_admin
from app.models.user import User
from app.schemas.schedule import (
    TimeSlotCreate, TimeSlotResponse, TimeSlotListResponse, TimeSlotUpdate,
    TimetableCreate, TimetableUpdate, TimetableResponse, TimetableListResponse,
    ScheduleEntryCreate, ScheduleEntryResponse, ScheduleEntryListResponse, ScheduleEntryUpdate,
)
from app.services import schedule_service

router = APIRouter()


# --- Time Slots ---

@router.post("/time-slots", response_model=TimeSlotResponse)
def create_time_slot(body: TimeSlotCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return schedule_service.create_time_slot(db, body.model_dump())


@router.get("/time-slots", response_model=TimeSlotListResponse)
def list_time_slots(school_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    items = schedule_service.get_time_slots(db, school_id)
    return TimeSlotListResponse(total=len(items), items=items)


@router.put("/time-slots/{slot_id}", response_model=TimeSlotResponse)
def update_time_slot(slot_id: int, body: TimeSlotUpdate, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    return schedule_service.update_time_slot(db, slot_id, body.model_dump(exclude_unset=True))


@router.delete("/time-slots/{slot_id}")
def delete_time_slot(slot_id: int, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    schedule_service.delete_time_slot(db, slot_id)
    return {"message": "Time slot deleted"}


# --- Timetables ---

@router.post("/timetables", response_model=TimetableResponse)
def create_timetable(body: TimetableCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return schedule_service.create_timetable(db, body.model_dump())


@router.get("/timetables", response_model=TimetableListResponse)
def list_timetables(
    skip: int = 0, limit: int = 100, school_id: int | None = None,
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    items, total = schedule_service.get_timetables(db, skip, limit, school_id)
    return TimetableListResponse(total=total, items=items)


@router.get("/timetables/{timetable_id}", response_model=TimetableResponse)
def get_timetable(timetable_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return schedule_service.get_timetable(db, timetable_id)


@router.put("/timetables/{timetable_id}", response_model=TimetableResponse)
def update_timetable(timetable_id: int, body: TimetableUpdate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return schedule_service.update_timetable(db, timetable_id, body.model_dump(exclude_unset=True))


@router.delete("/timetables/{timetable_id}")
def delete_timetable(timetable_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    schedule_service.delete_timetable(db, timetable_id)
    return {"message": "Timetable deleted"}


# --- Schedule Entries ---

@router.post("/timetables/{timetable_id}/entries", response_model=ScheduleEntryResponse)
def add_entry(timetable_id: int, body: ScheduleEntryCreate, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    data = body.model_dump()
    data["timetable_id"] = timetable_id
    return schedule_service.add_schedule_entry(db, data)


@router.get("/timetables/{timetable_id}/entries", response_model=ScheduleEntryListResponse)
def list_entries(
    timetable_id: int,
    class_id: int | None = None,
    teacher_id: int | None = None,
    student_id: int | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items = schedule_service.get_schedule_entries(
        db, timetable_id, class_id=class_id, teacher_id=teacher_id, student_id=student_id
    )
    return ScheduleEntryListResponse(total=len(items), items=items)


@router.put("/entries/{entry_id}", response_model=ScheduleEntryResponse)
def update_entry(entry_id: int, body: ScheduleEntryUpdate, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    return schedule_service.update_schedule_entry(db, entry_id, body.model_dump(exclude_unset=True))


@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db), _: User = Depends(require_teacher_or_admin)):
    schedule_service.delete_schedule_entry(db, entry_id)
    return {"message": "Schedule entry deleted"}
