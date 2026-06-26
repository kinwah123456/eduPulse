"""Unit tests for Twilio SMS notification connector."""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.notification import NotificationConnector, NotificationRule
from app.services.notification_service import send_sms, test_connector as verify_connector, seed_notifications


# ─── send_sms unit tests ────────────────────────────────────────────────────

def test_send_sms_mock_config_does_not_raise():
    """Mock credentials should print and return without raising."""
    config = {
        "account_sid": "ACmock",
        "auth_token": "mock_token",
        "sender_number": "+1234567890"
    }
    # Should not raise — mock mode just prints
    send_sms(config, "+60123456789", "Test SMS message")


def test_send_sms_empty_account_sid_treated_as_mock():
    """Empty account_sid is treated as mock (no HTTP call)."""
    config = {
        "account_sid": "",
        "auth_token": "any_token",
        "sender_number": "+1234567890"
    }
    send_sms(config, "+60123456789", "Test SMS message")


def test_send_sms_real_config_builds_correct_request():
    """Real credentials should POST to the correct Twilio endpoint with Basic auth."""
    config = {
        "account_sid": "AC_real_sid",
        "auth_token": "real_token",
        "sender_number": "+10987654321"
    }

    mock_response = MagicMock()
    mock_response.status = 201
    mock_response.__enter__ = lambda s: s
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("urllib.request.urlopen", return_value=mock_response) as mock_urlopen:
        send_sms(config, "+60123456789", "Hello Parent")

        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args[0][0]

        # Verify URL points to Twilio
        assert "api.twilio.com" in req.full_url
        assert "AC_real_sid" in req.full_url

        # Verify Basic auth header
        auth_header = req.get_header("Authorization")
        assert auth_header.startswith("Basic ")

        # Verify payload contains To, From, Body
        body = req.data.decode("utf-8")
        assert "To=" in body
        assert "From=" in body
        assert "Body=" in body


def test_send_sms_raises_on_non_2xx():
    """A non-2xx response should raise an Exception."""
    config = {
        "account_sid": "AC_real_sid",
        "auth_token": "real_token",
        "sender_number": "+10987654321"
    }

    mock_response = MagicMock()
    mock_response.status = 400
    mock_response.__enter__ = lambda s: s
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("urllib.request.urlopen", return_value=mock_response):
        with pytest.raises(Exception, match="Twilio SMS API returned status 400"):
            send_sms(config, "+60123456789", "Hello Parent")


# ─── Integration: seed_notifications includes SMS ──────────────────────────

def test_seed_notifications_creates_sms_connector(db_session: Session):
    """seed_notifications should create a connector row named 'sms'."""
    seed_notifications(db_session)

    sms_connector = db_session.query(NotificationConnector).filter(
        NotificationConnector.name == "sms"
    ).first()

    assert sms_connector is not None
    assert sms_connector.is_enabled is False
    cfg = json.loads(sms_connector.config)
    assert "account_sid" in cfg
    assert "auth_token" in cfg
    assert "sender_number" in cfg


def test_seed_notifications_creates_sms_rules(db_session: Session):
    """seed_notifications should create SMS rules for student_absent and assignment_failed."""
    seed_notifications(db_session)

    sms_rules = db_session.query(NotificationRule).filter(
        NotificationRule.connector_type == "sms"
    ).all()

    event_types = {r.event_type for r in sms_rules}
    assert "student_absent" in event_types
    assert "assignment_failed" in event_types
    assert "feedback_submitted" in event_types


# ─── Integration: test_connector dispatches SMS ─────────────────────────────

def test_test_connector_sms_mock(db_session: Session, client: TestClient):
    """test_connector with 'sms' name and mock config should not raise."""
    seed_notifications(db_session)

    # test_connector is called from the API; test at service layer directly
    verify_connector(db_session, "sms", "+60123456789", "Test message from EduPulse")
