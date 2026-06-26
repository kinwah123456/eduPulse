from __future__ import annotations

import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.notification import NotificationLog
from app.models.school import School
from app.models.student import Student


def test_webhook_unauthorized(client: TestClient, db_session: Session):
    response = client.post("/api/v1/notifications/webhooks/sendgrid?token=wrong_token", json={})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid webhook token"


def test_webhook_invalid_provider(client: TestClient, db_session: Session):
    response = client.post("/api/v1/notifications/webhooks/invalid_prov?token=edupulse_secret_token", json={})
    assert response.status_code == 400
    assert "Unsupported webhook provider" in response.json()["detail"]


def test_sendgrid_webhook_success(client: TestClient, db_session: Session):
    # Setup database log
    school = School(name="Webhook School", code="WH01")
    db_session.add(school)
    db_session.flush()

    student = Student(
        student_id_number="S5555",
        full_name="Webhook Student",
        school_id=school.id
    )
    db_session.add(student)
    db_session.flush()

    log = NotificationLog(
        student_id=student.id,
        student_name=student.full_name,
        parent_contact="parent@example.com",
        channel="EMAIL",
        event_type="student_absent",
        message_body="Test",
        status="SENT",
        smtp_message_id="<test-sendgrid-msg-id@edupulse.local>"
    )
    db_session.add(log)
    db_session.flush()

    # Payload matching SendGrid structure
    payload = [
        {
            "email": "parent@example.com",
            "timestamp": 1513282238,
            "event": "delivered",
            "smtp-id": "<test-sendgrid-msg-id@edupulse.local>"
        }
    ]

    response = client.post(
        "/api/v1/notifications/webhooks/sendgrid?token=edupulse_secret_token",
        json=payload
    )
    assert response.status_code == 200
    assert response.json()["processed_events"] == 1

    # Reload log and check status
    db_session.refresh(log)
    assert log.status == "DELIVERED"


def test_sendgrid_webhook_bounce(client: TestClient, db_session: Session):
    log = NotificationLog(
        student_id=None,
        student_name="Bounce Student",
        parent_contact="parent@bounce.com",
        channel="EMAIL",
        event_type="student_absent",
        message_body="Test",
        status="SENT",
        smtp_message_id="<test-sg-bounce-id@edupulse.local>"
    )
    db_session.add(log)
    db_session.flush()

    # Payload matching SendGrid bounce event
    payload = [
        {
            "email": "parent@bounce.com",
            "timestamp": 1513282239,
            "event": "bounce",
            "smtp-id": "<test-sg-bounce-id@edupulse.local>",
            "reason": "550 5.1.1 User Unknown"
        }
    ]

    response = client.post(
        "/api/v1/notifications/webhooks/sendgrid?token=edupulse_secret_token",
        json=payload
    )
    assert response.status_code == 200
    assert response.json()["processed_events"] == 1

    # Reload log and check status
    db_session.refresh(log)
    assert log.status == "FAILED"
    assert log.error_message == "550 5.1.1 User Unknown"


def test_mailgun_webhook_delivered(client: TestClient, db_session: Session):
    log = NotificationLog(
        student_id=None,
        student_name="Mailgun Student",
        parent_contact="parent@mailgun.com",
        channel="EMAIL",
        event_type="student_absent",
        message_body="Test",
        status="SENT",
        smtp_message_id="<test-mg-id@edupulse.local>"
    )
    db_session.add(log)
    db_session.flush()

    # Mailgun payload structures message-id
    payload = {
        "event-data": {
            "event": "delivered",
            "message": {
                "headers": {
                    "message-id": "test-mg-id@edupulse.local"
                }
            }
        }
    }

    response = client.post(
        "/api/v1/notifications/webhooks/mailgun?token=edupulse_secret_token",
        json=payload
    )
    assert response.status_code == 200
    assert response.json()["processed_events"] == 1

    # Reload log and check status (with bracket stripping robust check)
    db_session.refresh(log)
    assert log.status == "DELIVERED"


def test_generic_webhook_delivered(client: TestClient, db_session: Session):
    log = NotificationLog(
        student_id=None,
        student_name="Generic Student",
        parent_contact="parent@generic.com",
        channel="EMAIL",
        event_type="student_absent",
        message_body="Test",
        status="SENT",
        smtp_message_id="generic-msg-id"
    )
    db_session.add(log)
    db_session.flush()

    payload = {
        "message_id": "generic-msg-id",
        "status": "DELIVERED"
    }

    response = client.post(
        "/api/v1/notifications/webhooks/generic?token=edupulse_secret_token",
        json=payload
    )
    assert response.status_code == 200
    assert response.json()["processed_events"] == 1

    db_session.refresh(log)
    assert log.status == "DELIVERED"


def test_smtp2go_webhook_delivered(client: TestClient, db_session: Session):
    log = NotificationLog(
        student_id=None,
        student_name="SMTP2GO Student",
        parent_contact="parent@smtp2go.com",
        channel="EMAIL",
        event_type="student_absent",
        message_body="Test",
        status="SENT",
        smtp_message_id="<test-smtp2go-id@edupulse.local>"
    )
    db_session.add(log)
    db_session.flush()

    payload = {
        "event": "delivered",
        "email": "parent@smtp2go.com",
        "message-id": "<test-smtp2go-id@edupulse.local>"
    }

    response = client.post(
        "/api/v1/notifications/webhooks/smtp2go?token=edupulse_secret_token",
        json=payload
    )
    assert response.status_code == 200
    assert response.json()["processed_events"] == 1

    db_session.refresh(log)
    assert log.status == "DELIVERED"


def test_smtp2go_webhook_bounce(client: TestClient, db_session: Session):
    log = NotificationLog(
        student_id=None,
        student_name="SMTP2GO Bounce",
        parent_contact="parent@smtp2go.com",
        channel="EMAIL",
        event_type="student_absent",
        message_body="Test",
        status="SENT",
        smtp_message_id="<test-smtp2go-bounce@edupulse.local>"
    )
    db_session.add(log)
    db_session.flush()

    payload = {
        "event": "bounce",
        "email": "parent@smtp2go.com",
        "message-id": "<test-smtp2go-bounce@edupulse.local>",
        "description": "550 5.1.1 Recipient Rejected"
    }

    response = client.post(
        "/api/v1/notifications/webhooks/smtp2go?token=edupulse_secret_token",
        json=payload
    )
    assert response.status_code == 200
    assert response.json()["processed_events"] == 1

    db_session.refresh(log)
    assert log.status == "FAILED"
    assert log.error_message == "550 5.1.1 Recipient Rejected"

