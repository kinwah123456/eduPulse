from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from sqlalchemy.orm import Session

from app.models.teacher import Teacher
from app.models.academic import SchoolClass, Subject
from app.models.student import Student
from app.models.schedule import TimeSlot, Timetable, ScheduleEntry
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.merit import MeritOption, MeritLog
from app.core.exceptions import NotFoundException, ConflictException, ValidationException

# Helper: Parse OCR Text into Rows dynamically detecting delimiters
def parse_ocr_text_to_rows(text: str) -> list[list[str]]:
    rows = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return rows
    
    first_line = lines[0]
    if "," in first_line:
        separator = ","
    elif "\t" in first_line:
        separator = "\t"
    elif ";" in first_line:
        separator = ";"
    elif len(re.split(r'\s{2,}', first_line)) > 1:
        separator = re.compile(r'\s{2,}')
    else:
        separator = ","
        
    for line in lines:
        if isinstance(separator, re.Pattern):
            parts = [p.strip() for p in separator.split(line)]
        else:
            parts = [p.strip() for p in line.split(separator)]
        rows.append(parts)
    return rows


# Helper: Convert parsed rows to dictionary list
def parse_content_to_dicts(content: str, is_csv: bool = True) -> list[dict]:
    if is_csv:
        f = io.StringIO(content)
        # skipinitialspace=True handles whitespace immediately after delimiters correctly
        reader = csv.reader(f, skipinitialspace=True)
        rows = list(reader)
    else:
        rows = parse_ocr_text_to_rows(content)
        
    if not rows:
        return []
        
    headers = [h.strip().lower().replace(" ", "_") for h in rows[0]]
    dicts = []
    for row_idx, row in enumerate(rows[1:], start=2):
        # Recombine extra elements if row has more columns than headers (unquoted commas in values)
        if len(row) > len(headers):
            if "residential_address" in headers:
                addr_idx = headers.index("residential_address")
                num_after = len(headers) - addr_idx - 1
                addr_parts = row[addr_idx : len(row) - num_after]
                address = ", ".join([p.strip() for p in addr_parts])
                row = row[:addr_idx] + [address] + row[len(row) - num_after:]
            elif "emergency_contact" in headers:
                contact_idx = headers.index("emergency_contact")
                num_after = len(headers) - contact_idx - 1
                parts = row[contact_idx : len(row) - num_after]
                merged = ", ".join([p.strip() for p in parts])
                row = row[:contact_idx] + [merged] + row[len(row) - num_after:]
            elif "notes" in headers:
                notes_idx = headers.index("notes")
                merged = ", ".join([p.strip() for p in row[notes_idx:]])
                row = row[:notes_idx] + [merged]
            elif "justification" in headers:
                just_idx = headers.index("justification")
                merged = ", ".join([p.strip() for p in row[just_idx:]])
                row = row[:just_idx] + [merged]

        d = {}
        for col_idx, header in enumerate(headers):
            val = row[col_idx].strip() if col_idx < len(row) else ""
            if val.startswith(('"', "'")) and val.endswith(('"', "'")):
                val = val[1:-1].strip()
            d[header] = val
        dicts.append({"_row_num": row_idx, **d})
    return dicts


# Helper: Parse boolean string values
def parse_bool(val: str, default: bool = True) -> bool:
    if not val:
        return default
    val_clean = val.strip().lower()
    if val_clean in ("true", "1", "yes", "active", "y"):
        return True
    if val_clean in ("false", "0", "no", "inactive", "n"):
        return False
    return default


# Helper: Parse date strings (YYYY-MM-DD)
def parse_date_val(val: str) -> date | None:
    if not val:
        return None
    # Try common formats
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Invalid date format for '{val}'. Use YYYY-MM-DD.")


# Helper: Day of Week Name/Number parser
def parse_day_of_week(val: str) -> int:
    val_clean = val.strip().lower()
    day_map = {
        "monday": 0, "mon": 0, "0": 0,
        "tuesday": 1, "tue": 1, "1": 1,
        "wednesday": 2, "wed": 2, "2": 2,
        "thursday": 3, "thu": 3, "3": 3,
        "friday": 4, "fri": 4, "4": 4,
        "saturday": 5, "sat": 5, "5": 5,
        "sunday": 6, "sun": 6, "6": 6,
    }
    if val_clean in day_map:
        return day_map[val_clean]
    raise ValueError(f"Invalid day of week '{val}'. Use Monday-Friday or 0-4.")


# Helper: Create standard timeslots dynamically if missing
def get_or_create_timeslot(db: Session, school_id: int, day_of_week: int, period_number: int) -> TimeSlot:
    slot = db.query(TimeSlot).filter(
        TimeSlot.school_id == school_id,
        TimeSlot.day_of_week == day_of_week,
        TimeSlot.period_number == period_number
    ).first()
    
    if not slot:
        # Define standard period times (07:30 to 13:10)
        times = {
            1: ("07:30", "08:10"),
            2: ("08:10", "08:50"),
            3: ("08:50", "09:30"),
            4: ("09:30", "10:10"),
            5: ("10:30", "11:10"),
            6: ("11:10", "11:50"),
            7: ("11:50", "12:30"),
            8: ("12:30", "13:10"),
        }
        start_time, end_time = times.get(period_number, ("08:00", "08:40"))
        slot = TimeSlot(
            day_of_week=day_of_week,
            period_number=period_number,
            start_time=start_time,
            end_time=end_time,
            school_id=school_id
        )
        db.add(slot)
        db.flush()
    return slot


# ── BATCH IMPORT WORKERS ──────────────────────────────────────────────────

def process_batch_teachers(db: Session, rows: list[dict], school_id: int) -> list[dict]:
    results = []
    for r in rows:
        row_num = r.get("_row_num")
        try:
            emp_id = r.get("employee_id")
            name = r.get("full_name")
            if not emp_id or not name:
                raise ValueError("employee_id and full_name are required columns")
                
            teacher = db.query(Teacher).filter(Teacher.employee_id == emp_id).first()
            if teacher:
                # Update existing
                teacher.full_name = name
                if "email" in r: teacher.email = r["email"] or None
                if "contact_number" in r: teacher.contact_number = r["contact_number"] or None
                if "emergency_contact" in r: teacher.emergency_contact = r["emergency_contact"] or None
                if "is_active" in r: teacher.is_active = parse_bool(r["is_active"], True)
                action = "updated"
            else:
                # Create new
                teacher = Teacher(
                    employee_id=emp_id,
                    full_name=name,
                    email=r.get("email") or None,
                    contact_number=r.get("contact_number") or None,
                    emergency_contact=r.get("emergency_contact") or None,
                    school_id=school_id,
                    is_active=parse_bool(r.get("is_active"), True)
                )
                db.add(teacher)
                action = "created"
                
            db.flush()
            results.append({
                "row": row_num,
                "identifier": emp_id,
                "name": name,
                "status": "success",
                "action": action,
                "details": f"Teacher {action} successfully"
            })
        except Exception as e:
            results.append({
                "row": row_num,
                "identifier": r.get("employee_id", "Unknown"),
                "name": r.get("full_name", "Unknown"),
                "status": "failed",
                "error": str(e)
            })
    db.commit()
    return results


def process_batch_classrooms(db: Session, rows: list[dict], school_id: int) -> list[dict]:
    results = []
    for r in rows:
        row_num = r.get("_row_num")
        try:
            name = r.get("name")
            grade_str = r.get("grade_level")
            if not name or not grade_str:
                raise ValueError("name and grade_level are required columns")
            
            grade_level = int(grade_str)
            capacity = int(r.get("capacity")) if r.get("capacity") else 40
            
            # Resolve form teacher
            teacher_id = None
            teacher_emp_id = r.get("form_teacher_employee_id")
            if teacher_emp_id:
                teacher = db.query(Teacher).filter(Teacher.employee_id == teacher_emp_id).first()
                if not teacher:
                    raise ValueError(f"Teacher with Employee ID '{teacher_emp_id}' not found")
                teacher_id = teacher.id
                
            classroom = db.query(SchoolClass).filter(
                SchoolClass.name == name,
                SchoolClass.school_id == school_id
            ).first()
            
            if classroom:
                classroom.grade_level = grade_level
                classroom.capacity = capacity
                classroom.form_teacher_id = teacher_id
                action = "updated"
            else:
                classroom = SchoolClass(
                    name=name,
                    grade_level=grade_level,
                    capacity=capacity,
                    form_teacher_id=teacher_id,
                    school_id=school_id
                )
                db.add(classroom)
                action = "created"
                
            db.flush()
            results.append({
                "row": row_num,
                "identifier": name,
                "name": name,
                "status": "success",
                "action": action,
                "details": f"Classroom {action} successfully"
            })
        except Exception as e:
            results.append({
                "row": row_num,
                "identifier": r.get("name", "Unknown"),
                "name": r.get("name", "Unknown"),
                "status": "failed",
                "error": str(e)
            })
    db.commit()
    return results


def process_batch_students(db: Session, rows: list[dict], school_id: int) -> list[dict]:
    results = []
    for r in rows:
        row_num = r.get("_row_num")
        try:
            student_id = r.get("student_id_number")
            name = r.get("full_name")
            if not student_id or not name:
                raise ValueError("student_id_number and full_name are required columns")
                
            # Resolve class
            class_id = None
            class_name = r.get("class_name")
            if class_name:
                classroom = db.query(SchoolClass).filter(
                    SchoolClass.name == class_name,
                    SchoolClass.school_id == school_id
                ).first()
                if not classroom:
                    raise ValueError(f"Classroom '{class_name}' not found")
                class_id = classroom.id
                
            student = db.query(Student).filter(Student.student_id_number == student_id).first()
            
            student_data = {
                "student_id_number": student_id,
                "full_name": name,
                "class_id": class_id,
                "school_id": school_id,
                "is_active": parse_bool(r.get("is_active"), True),
                "merit_points": int(r["merit_points"]) if r.get("merit_points") else 50,
                "gender": r.get("gender") or None,
                "identity_card_number": r.get("identity_card_number") or None,
                "birth_date": parse_date_val(r.get("birth_date")),
                "enroll_date": parse_date_val(r.get("enroll_date")),
                "father_contact": r.get("father_contact") or None,
                "mother_contact": r.get("mother_contact") or None,
                "guardian_contact": r.get("guardian_contact") or None,
                "residential_address": r.get("residential_address") or None,
            }
            
            if student:
                for k, v in student_data.items():
                    if k in r or k in ("class_id", "birth_date", "enroll_date"):
                        setattr(student, k, v)
                action = "updated"
            else:
                student = Student(**student_data)
                db.add(student)
                action = "created"
                
            db.flush()
            results.append({
                "row": row_num,
                "identifier": student_id,
                "name": name,
                "status": "success",
                "action": action,
                "details": f"Student {action} successfully"
            })
        except Exception as e:
            results.append({
                "row": row_num,
                "identifier": r.get("student_id_number", "Unknown"),
                "name": r.get("full_name", "Unknown"),
                "status": "failed",
                "error": str(e)
            })
    db.commit()
    return results


def process_batch_schedules(db: Session, rows: list[dict], school_id: int) -> list[dict]:
    results = []
    for r in rows:
        row_num = r.get("_row_num")
        try:
            tt_name = r.get("timetable_name")
            class_name = r.get("class_name")
            sub_code = r.get("subject_code")
            teacher_emp_id = r.get("teacher_employee_id")
            day_str = r.get("day_of_week")
            period_str = r.get("period_number")
            
            if not class_name or not sub_code or not teacher_emp_id or not day_str or not period_str:
                raise ValueError("class_name, subject_code, teacher_employee_id, day_of_week, and period_number are required")
                
            day_of_week = parse_day_of_week(day_str)
            period_number = int(period_str)
            
            # Find/Create Timetable
            if tt_name:
                timetable = db.query(Timetable).filter(
                    Timetable.name == tt_name,
                    Timetable.school_id == school_id
                ).first()
                if not timetable:
                    timetable = Timetable(name=tt_name, school_id=school_id, term="Term 1", is_active=True)
                    db.add(timetable)
                    db.flush()
            else:
                # Fallback to active timetable or first, or create
                timetable = db.query(Timetable).filter(
                    Timetable.school_id == school_id,
                    Timetable.is_active == True
                ).first()
                if not timetable:
                    timetable = db.query(Timetable).filter(Timetable.school_id == school_id).first()
                if not timetable:
                    timetable = Timetable(name="Active Timetable", school_id=school_id, term="Term 1", is_active=True)
                    db.add(timetable)
                    db.flush()
            
            # Resolve class
            classroom = db.query(SchoolClass).filter(
                SchoolClass.name == class_name,
                SchoolClass.school_id == school_id
            ).first()
            if not classroom:
                raise ValueError(f"Classroom '{class_name}' not found")
                
            # Resolve Subject
            subject = db.query(Subject).filter(
                Subject.code == sub_code,
                Subject.school_id == school_id
            ).first()
            if not subject:
                # Create subject dynamically
                subject = Subject(code=sub_code, name=sub_code, school_id=school_id)
                db.add(subject)
                db.flush()
                
            # Resolve Teacher
            teacher = db.query(Teacher).filter(
                Teacher.employee_id == teacher_emp_id,
                Teacher.school_id == school_id
            ).first()
            if not teacher:
                raise ValueError(f"Teacher '{teacher_emp_id}' not found")
                
            # Get/Create TimeSlot
            timeslot = get_or_create_timeslot(db, school_id, day_of_week, period_number)
            
            # Check Classroom conflict - if classroom has another entry at this slot, update it or raise error.
            # To be friendly, we update/overwrite if same class, but raise conflict if the *teacher* is busy elsewhere.
            existing_class_entry = db.query(ScheduleEntry).filter(
                ScheduleEntry.timetable_id == timetable.id,
                ScheduleEntry.class_id == classroom.id,
                ScheduleEntry.time_slot_id == timeslot.id
            ).first()
            
            # Check if teacher is busy elsewhere at this slot
            teacher_conflict = db.query(ScheduleEntry).filter(
                ScheduleEntry.timetable_id == timetable.id,
                ScheduleEntry.teacher_id == teacher.id,
                ScheduleEntry.time_slot_id == timeslot.id
            )
            if existing_class_entry:
                teacher_conflict = teacher_conflict.filter(ScheduleEntry.id != existing_class_entry.id)
            teacher_conflict = teacher_conflict.first()
            
            if teacher_conflict:
                conflict_class = db.query(SchoolClass).filter(SchoolClass.id == teacher_conflict.class_id).first()
                conflict_class_name = conflict_class.name if conflict_class else "another class"
                raise ConflictException(f"Teacher {teacher.full_name} is already teaching {conflict_class_name} at this time slot.")
                
            if existing_class_entry:
                existing_class_entry.subject_id = subject.id
                existing_class_entry.teacher_id = teacher.id
                action = "updated"
            else:
                new_entry = ScheduleEntry(
                    timetable_id=timetable.id,
                    class_id=classroom.id,
                    subject_id=subject.id,
                    teacher_id=teacher.id,
                    time_slot_id=timeslot.id
                )
                db.add(new_entry)
                action = "created"
                
            db.flush()
            results.append({
                "row": row_num,
                "identifier": f"Period {period_number} - {class_name}",
                "name": f"{sub_code} ({teacher.full_name})",
                "status": "success",
                "action": action,
                "details": f"Schedule entry {action} successfully"
            })
        except Exception as e:
            results.append({
                "row": row_num,
                "identifier": f"Row {row_num}",
                "name": r.get("class_name", "Unknown"),
                "status": "failed",
                "error": str(e)
            })
    db.commit()
    return results


def process_batch_attendance(db: Session, rows: list[dict], school_id: int, user_id: int | None = None) -> list[dict]:
    results = []
    for r in rows:
        row_num = r.get("_row_num")
        try:
            student_id_num = r.get("student_id_number")
            date_str = r.get("date")
            status_str = r.get("status")
            period_str = r.get("period_number")
            notes = r.get("notes") or ""
            
            if not student_id_num or not date_str or not status_str:
                raise ValueError("student_id_number, date, and status are required columns")
                
            rec_date = parse_date_val(date_str)
            status = status_str.strip().upper()
            if status not in ("PRESENT", "ABSENT", "LATE", "EXCUSED"):
                raise ValueError("status must be PRESENT, ABSENT, LATE, or EXCUSED")
                
            # Find Student
            student = db.query(Student).filter(
                Student.student_id_number == student_id_num,
                Student.school_id == school_id
            ).first()
            if not student:
                raise ValueError(f"Student '{student_id_num}' not found")
            if not student.class_id:
                raise ValueError(f"Student '{student_id_num}' is not assigned to any classroom")
                
            # Get Timeslot if period attendance
            timeslot_id = None
            if period_str:
                period_num = int(period_str)
                # Day of week from date: Monday is 0, Sunday is 6
                day_of_week = rec_date.weekday()
                timeslot = get_or_create_timeslot(db, school_id, day_of_week, period_num)
                timeslot_id = timeslot.id
                
            # Find or create session
            session = db.query(AttendanceSession).filter(
                AttendanceSession.class_id == student.class_id,
                AttendanceSession.date == rec_date,
                AttendanceSession.time_slot_id == timeslot_id
            ).first()
            
            if not session:
                session = AttendanceSession(
                    class_id=student.class_id,
                    date=rec_date,
                    time_slot_id=timeslot_id,
                    recorded_by_id=user_id,
                    method="MANUAL"
                )
                db.add(session)
                db.flush()
                
            # Find or create record
            record = db.query(AttendanceRecord).filter(
                AttendanceRecord.session_id == session.id,
                AttendanceRecord.student_id == student.id
            ).first()
            
            if record:
                record.status = status
                record.notes = notes
                action = "updated"
            else:
                record = AttendanceRecord(
                    session_id=session.id,
                    student_id=student.id,
                    status=status,
                    notes=notes
                )
                db.add(record)
                action = "created"
                
            db.flush()
            results.append({
                "row": row_num,
                "identifier": student_id_num,
                "name": student.full_name,
                "status": "success",
                "action": action,
                "details": f"Attendance record {action} as {status}"
            })
        except Exception as e:
            results.append({
                "row": row_num,
                "identifier": r.get("student_id_number", "Unknown"),
                "name": "Unknown Student",
                "status": "failed",
                "error": str(e)
            })
    db.commit()
    return results


def process_batch_merit(db: Session, rows: list[dict], school_id: int, user_id: int) -> list[dict]:
    results = []
    for r in rows:
        row_num = r.get("_row_num")
        try:
            student_id_num = r.get("student_id_number")
            opt_name = r.get("merit_option_name")
            justification = r.get("justification") or opt_name or "Batch Point Adjustment"
            pts_str = r.get("points")
            
            if not student_id_num or not opt_name:
                raise ValueError("student_id_number and merit_option_name are required columns")
                
            # Resolve student
            student = db.query(Student).filter(
                Student.student_id_number == student_id_num,
                Student.school_id == school_id
            ).first()
            if not student:
                raise ValueError(f"Student '{student_id_num}' not found")
                
            # Resolve or create merit option
            merit_option = db.query(MeritOption).filter(MeritOption.name == opt_name).first()
            if not merit_option:
                # Deduce points
                pts = int(pts_str) if pts_str else 10
                merit_option = MeritOption(name=opt_name, points=pts, is_active=True)
                db.add(merit_option)
                db.flush()
            elif pts_str:
                # Update points if explicitly provided
                merit_option.points = int(pts_str)
                db.flush()
                
            if not merit_option.is_active:
                raise ValueError(f"Merit option '{opt_name}' is inactive and cannot be used")
                
            # Award points and log transaction
            student.merit_points += merit_option.points
            
            log = MeritLog(
                student_id=student.id,
                user_id=user_id,
                merit_option_id=merit_option.id,
                points_changed=merit_option.points,
                justification=justification
            )
            db.add(log)
            db.flush()
            
            action_desc = "awarded" if merit_option.points >= 0 else "reduced"
            results.append({
                "row": row_num,
                "identifier": student_id_num,
                "name": student.full_name,
                "status": "success",
                "action": "points_" + action_desc,
                "details": f"Points {action_desc} ({merit_option.points:+d} pts) for '{opt_name}'"
            })
        except Exception as e:
            results.append({
                "row": row_num,
                "identifier": r.get("student_id_number", "Unknown"),
                "name": "Unknown Student",
                "status": "failed",
                "error": str(e)
            })
    db.commit()
    return results
