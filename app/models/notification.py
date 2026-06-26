from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Text, Boolean, Float, DateTime, func, UniqueConstraint, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, TimestampMixin


class NotificationConnector(TimestampMixin, Base):
    __tablename__ = "notification_connectors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # "email" or "whatsapp"
    config: Mapped[str] = mapped_column(Text)  # JSON configuration
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    def __repr__(self) -> str:
        return f"<NotificationConnector {self.name} enabled={self.is_enabled}>"


class NotificationRule(TimestampMixin, Base):
    __tablename__ = "notification_rules"
    __table_args__ = (UniqueConstraint("event_type", "connector_type", name="uq_event_connector"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[str] = mapped_column(String(50), index=True)  # "student_absent" or "assignment_failed"
    connector_type: Mapped[str] = mapped_column(String(50))  # "email" or "whatsapp"
    template: Mapped[str] = mapped_column(Text)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    passing_threshold: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=50.0)

    def __repr__(self) -> str:
        return f"<NotificationRule {self.event_type} via {self.connector_type} enabled={self.is_enabled}>"


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    student_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    parent_contact: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    channel: Mapped[str] = mapped_column(String(50))  # "EMAIL" or "WHATSAPP"
    event_type: Mapped[str] = mapped_column(String(50))  # "student_absent", "assignment_failed"
    message_body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50))  # "SENT", "FAILED"
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Store session_id or grade_id
    smtp_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationship with Student for convenience
    student = relationship("Student", lazy="joined")

    def __repr__(self) -> str:
        return f"<NotificationLog {self.event_type} to={self.parent_contact} status={self.status}>"
