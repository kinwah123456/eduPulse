"""Seed the database with sample data for development/testing."""
from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, init_db
from app.models.school import School
from app.models.academic import Subject, SchoolClass
from app.models.teacher import Teacher
from app.models.student import Student
from app.models.schedule import TimeSlot, Timetable, ScheduleEntry


def main():
    init_db()
    db = SessionLocal()

    try:
        # Check if already seeded
        if db.query(School).first():
            print("Database already has data. Skipping seed.")
            return

        # ── School ──
        school = School(name="SMK Taman Melawati", code="SMK001", state="Selangor", district="Gombak")
        db.add(school)
        db.flush()
        print(f"[OK] School: {school.name}")

        # ── Subjects ──
        subjects_data = [
            ("Bahasa Melayu", "BM"),
            ("English", "ENG"),
            ("Mathematics", "MATH"),
            ("Science", "SCI"),
            ("Sejarah", "SEJ"),
        ]
        subjects = []
        for name, code in subjects_data:
            s = Subject(name=name, code=code, school_id=school.id)
            db.add(s)
            subjects.append(s)
        db.flush()
        print(f"[OK] Subjects: {len(subjects)} created")

        # ── Teachers ──
        teachers_data = [
            ("T001", "Cikgu Ahmad bin Ismail", "ahmad@smk001.edu.my"),
            ("T002", "Cikgu Siti Nurhaliza", "siti@smk001.edu.my"),
            ("T003", "Cikgu Raj Kumar", "raj@smk001.edu.my"),
            ("T004", "Cikgu Mei Ling", "meiling@smk001.edu.my"),
            ("T005", "Cikgu Farah Aisyah", "farah@smk001.edu.my"),
        ]
        teachers = []
        for emp_id, name, email in teachers_data:
            t = Teacher(employee_id=emp_id, full_name=name, email=email, school_id=school.id)
            db.add(t)
            teachers.append(t)
        db.flush()
        print(f"[OK] Teachers: {len(teachers)} created")

        # ── Classes ──
        classes_data = [
            ("5 Amanah", 5, teachers[0].id),
            ("5 Bestari", 5, teachers[1].id),
            ("5 Cemerlang", 5, teachers[2].id),
        ]
        classes = []
        for name, grade, ft_id in classes_data:
            c = SchoolClass(name=name, grade_level=grade, school_id=school.id, form_teacher_id=ft_id)
            db.add(c)
            classes.append(c)
        db.flush()
        print(f"[OK] Classes: {len(classes)} created")

        # ── Students ──
        student_names = [
            "Amir Hakimi", "Nurul Izzah", "Tan Wei Ming", "Priya Devi", "Muhammad Fikri",
            "Siti Aishah", "Lee Jia Wen", "Ravi Kumar", "Nor Hidayah", "Chong Kah Yan",
            "Ahmad Danial", "Fatimah Zahra", "Lim Boon Huat", "Kavitha Moorthy", "Mohd Irfan",
            "Nur Aqilah", "Wong Siew Ting", "Ganesh Kumar", "Aisyah Hanim", "David Chen",
        ]
        students = []
        for i, name in enumerate(student_names, 1):
            class_idx = (i - 1) % len(classes)
            s = Student(
                student_id_number=f"STU{i:04d}",
                full_name=name,
                class_id=classes[class_idx].id,
                school_id=school.id,
                father_contact=f"+6012-345678{i:01d}",
                mother_contact=f"+6019-123456{i:02d}",
                parent_email=f"parent_{i}@edupulse.local",
                gender="MALE" if i % 2 == 0 else "FEMALE",
                identity_card_number=f"120101-14-{i:04d}"
            )
            db.add(s)
            students.append(s)
        db.flush()
        print(f"[OK] Students: {len(students)} created")

        # ── Time Slots (Mon-Fri, 8 periods) ──
        period_times = [
            ("07:30", "08:10"), ("08:10", "08:50"), ("08:50", "09:30"), ("09:30", "10:10"),
            ("10:30", "11:10"), ("11:10", "11:50"), ("11:50", "12:30"), ("12:30", "13:10"),
        ]
        slot_count = 0
        for day in range(5):
            for period, (start, end) in enumerate(period_times, 1):
                ts = TimeSlot(
                    day_of_week=day, period_number=period,
                    start_time=start, end_time=end, school_id=school.id,
                )
                db.add(ts)
                slot_count += 1
        db.flush()
        print(f"[OK] Time Slots: {slot_count} created (5 days x 8 periods)")

        # ── Default Active Timetable ──
        timetable = Timetable(
            name="Main School Term 1",
            school_id=school.id,
            term="Term 1 2026",
            is_active=True
        )
        db.add(timetable)
        db.flush()
        print(f"[OK] Timetable: {timetable.name} created")

        # ── Merit Options ──
        from app.models.merit import MeritOption
        merit_options_data = [
            ("Outstanding Classroom Helpfulness", 10),
            ("Active Participation in Discussions", 5),
            ("Perfect Weekly Attendance", 15),
            ("Excellent Team Project Leadership", 20),
            ("Classroom Disruption or Noise", -10),
            ("Failure to Submit Homework on Time", -5),
            ("Late Arrival to Class without Reason", -5),
            ("Disrespectful Behavior towards Peers/Staff", -15),
        ]
        for name, pts in merit_options_data:
            mo = MeritOption(name=name, points=pts, is_active=True)
            db.add(mo)
        db.flush()
        print(f"[OK] Merit Options: {len(merit_options_data)} created")

        db.commit()
        print("\n[DONE] Seed data complete!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] {e}")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
