from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings

# SQLite needs check_same_thread=False for FastAPI's threaded request handling.
# PostgreSQL ignores this kwarg, so it's safe to always include.
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency that yields a database session."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables defined by the ORM models."""
    from app.core.base_model import Base  # noqa
    import app.models  # noqa  — force model registration

    Base.metadata.create_all(bind=engine)

    # Dynamic migrations for SQLite database files
    try:
        with engine.begin() as conn:
            # Teachers table migrations
            cursor = conn.exec_driver_sql("PRAGMA table_info(teachers)")
            columns = [row[1] for row in cursor.fetchall()]
            if "contact_number" not in columns:
                conn.exec_driver_sql("ALTER TABLE teachers ADD COLUMN contact_number VARCHAR(50)")
                print("Added column 'contact_number' to 'teachers' table.")
            if "emergency_contact" not in columns:
                conn.exec_driver_sql("ALTER TABLE teachers ADD COLUMN emergency_contact VARCHAR(100)")
                print("Added column 'emergency_contact' to 'teachers' table.")

            # Students table migrations
            cursor = conn.exec_driver_sql("PRAGMA table_info(students)")
            student_cols = [row[1] for row in cursor.fetchall()]
            if "father_contact" not in student_cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN father_contact VARCHAR(50)")
                print("Added column 'father_contact' to 'students' table.")
            if "mother_contact" not in student_cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN mother_contact VARCHAR(50)")
                print("Added column 'mother_contact' to 'students' table.")
            if "guardian_contact" not in student_cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN guardian_contact VARCHAR(50)")
                print("Added column 'guardian_contact' to 'students' table.")
            if "parent_email" not in student_cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN parent_email VARCHAR(255)")
                print("Added column 'parent_email' to 'students' table.")
            if "residential_address" not in student_cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN residential_address VARCHAR(555)")
                print("Added column 'residential_address' to 'students' table.")
            if "gender" not in student_cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN gender VARCHAR(20)")
                print("Added column 'gender' to 'students' table.")
            if "identity_card_number" not in student_cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN identity_card_number VARCHAR(50)")
                print("Added column 'identity_card_number' to 'students' table.")
            if "birth_date" not in student_cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN birth_date DATE")
                print("Added column 'birth_date' to 'students' table.")
            if "enroll_date" not in student_cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN enroll_date DATE")
                print("Added column 'enroll_date' to 'students' table.")
            if "merit_points" not in student_cols:
                conn.exec_driver_sql("ALTER TABLE students ADD COLUMN merit_points INTEGER DEFAULT 50")
                print("Added column 'merit_points' to 'students' table.")

            # Notification logs migrations
            cursor = conn.exec_driver_sql("PRAGMA table_info(notification_logs)")
            log_cols = [row[1] for row in cursor.fetchall()]
            if "smtp_message_id" not in log_cols:
                conn.exec_driver_sql("ALTER TABLE notification_logs ADD COLUMN smtp_message_id VARCHAR(255)")
                print("Added column 'smtp_message_id' to 'notification_logs' table.")
    except Exception as e:
        print(f"Dynamic migration warning: {e}")
