"""Create the first admin user for EduPulse Ops."""
from __future__ import annotations

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, init_db
from app.core.security import get_password_hash
from app.models.user import User


def main():
    init_db()
    db = SessionLocal()

    try:
        # Check if admin already exists
        existing = db.query(User).filter(User.role == "ADMIN").first()
        if existing:
            print(f"Admin already exists: {existing.email}")
            return

        # Defaults (overridable via environment variables)
        email = os.getenv("ADMIN_EMAIL", "admin@edupulse.local")
        password = os.getenv("ADMIN_PASSWORD", "admin123")
        full_name = os.getenv("ADMIN_NAME", "System Administrator")

        user = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            role="ADMIN",
        )
        db.add(user)
        db.commit()
        print(f"[OK] Admin user created: {email} / {password}")
        print("  [!] Change the password after first login!")

    finally:
        db.close()


if __name__ == "__main__":
    main()
