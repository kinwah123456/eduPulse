from __future__ import annotations

import json
import re
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.notification import NotificationConnector, NotificationRule, NotificationLog
from app.models.student import Student
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.grading import StudentGrade, Assessment
from app.core.exceptions import NotFoundException, ConflictException, ValidationException


def seed_notifications(db: Session) -> None:
    """Seed initial connectors and rule templates if they don't exist."""
    # Seed default connectors
    default_connectors = [
        {
            "name": "email",
            "config": json.dumps({
                "smtp_server": "smtp.mailtrap.io",
                "smtp_port": 2525,
                "sender_email": "noreply@edupulse.com",
                "sender_name": "EduPulse Alerts",
                "smtp_username": "mock_user",
                "smtp_password": "mock_password",
                "use_tls": True
            }),
            "is_enabled": False
        },
        {
            "name": "whatsapp",
            "config": json.dumps({
                "api_url": "https://api.twilio.com/mock",
                "account_sid": "ACmock",
                "auth_token": "mock_token",
                "sender_number": "+1234567890"
            }),
            "is_enabled": False
        }
    ]

    for conn_data in default_connectors:
        existing = db.query(NotificationConnector).filter(NotificationConnector.name == conn_data["name"]).first()
        if not existing:
            db.add(NotificationConnector(**conn_data))

    # Seed default rules
    default_rules = [
        {
            "event_type": "student_absent",
            "connector_type": "email",
            "template": "Dear Parent, this is to inform you that your child {student_name} was marked ABSENT on {date}.",
            "is_enabled": False,
            "passing_threshold": None
        },
        {
            "event_type": "student_absent",
            "connector_type": "whatsapp",
            "template": "Dear Parent, your child {student_name} was marked ABSENT on {date}.",
            "is_enabled": False,
            "passing_threshold": None
        },
        {
            "event_type": "assignment_failed",
            "connector_type": "email",
            "template": "Dear Parent, this is to inform you that your child {student_name} scored {score}/{max_points} on assignment '{assignment_title}' (below the passing mark of {passing_threshold}%).",
            "is_enabled": False,
            "passing_threshold": 50.0
        },
        {
            "event_type": "assignment_failed",
            "connector_type": "whatsapp",
            "template": "Dear Parent, your child {student_name} scored {score}/{max_points} on '{assignment_title}' (below the passing mark of {passing_threshold}%).",
            "is_enabled": False,
            "passing_threshold": 50.0
        },
        {
            "event_type": "feedback_submitted",
            "connector_type": "email",
            "template": "A new feedback submission has been received on {datetime}. Location: {location}. Identified As: {identification}. Description: {description}",
            "is_enabled": False,
            "passing_threshold": None
        },
        {
            "event_type": "feedback_submitted",
            "connector_type": "whatsapp",
            "template": "New feedback received on {datetime} at {location}. Identified As: {identification}. Description: {description}",
            "is_enabled": False,
            "passing_threshold": None
        }
    ]

    for rule_data in default_rules:
        existing = db.query(NotificationRule).filter(
            NotificationRule.event_type == rule_data["event_type"],
            NotificationRule.connector_type == rule_data["connector_type"]
        ).first()
        if not existing:
            db.add(NotificationRule(**rule_data))

    db.commit()


def get_connectors(db: Session) -> list[NotificationConnector]:
    return db.query(NotificationConnector).all()


def update_connector(db: Session, name: str, data: dict) -> NotificationConnector:
    connector = db.query(NotificationConnector).filter(NotificationConnector.name == name).first()
    if not connector:
        raise NotFoundException(f"Connector '{name}' not found")
    
    if "config" in data and data["config"] is not None:
        # Validate JSON format
        try:
            json.loads(data["config"])
        except ValueError:
            raise ValidationException("Configuration must be a valid JSON string")
        connector.config = data["config"]
        
    if "is_enabled" in data and data["is_enabled"] is not None:
        connector.is_enabled = data["is_enabled"]
        
    db.commit()
    db.refresh(connector)
    return connector


def get_rules(db: Session) -> list[NotificationRule]:
    return db.query(NotificationRule).all()


def update_rule(db: Session, event_type: str, connector_type: str, data: dict) -> NotificationRule:
    rule = db.query(NotificationRule).filter(
        NotificationRule.event_type == event_type,
        NotificationRule.connector_type == connector_type
    ).first()
    if not rule:
        raise NotFoundException(f"Rule for '{event_type}' via '{connector_type}' not found")
        
    if "template" in data and data["template"] is not None:
        rule.template = data["template"]
    if "is_enabled" in data and data["is_enabled"] is not None:
        rule.is_enabled = data["is_enabled"]
    if "passing_threshold" in data:
        rule.passing_threshold = data["passing_threshold"]
        
    db.commit()
    db.refresh(rule)
    return rule


def get_logs(db: Session, skip: int = 0, limit: int = 100) -> tuple[list[NotificationLog], int]:
    query = db.query(NotificationLog)
    total = query.count()
    items = query.order_by(NotificationLog.created_at.desc()).offset(skip).limit(limit).all()
    return items, total


def resolve_parent_contact(student: Student, channel: str) -> str | None:
    """Find a parent contact matching the channel (email vs phone number)."""
    contacts = [student.father_contact, student.mother_contact, student.guardian_contact]
    # Filter out empty or None
    contacts = [c.strip() for c in contacts if c and c.strip()]
    
    if not contacts:
        return None
        
    if channel.upper() == "EMAIL":
        # Find first containing '@'
        for c in contacts:
            if "@" in c:
                return c
        return contacts[0] if "@" in contacts[0] else None
    else:  # WHATSAPP
        # Find first matching numeric / phone pattern (doesn't contain '@')
        for c in contacts:
            if "@" not in c:
                return c
        return contacts[0] if "@" not in contacts[0] else None


def send_email(config: dict, recipient: str, subject: str, body: str) -> None:
    """Send an email using smtp, or mock if configured."""
    smtp_server = config.get("smtp_server", "")
    smtp_user = config.get("smtp_username", "")
    
    is_mock = "mock" in smtp_server.lower() or "mock" in smtp_user.lower() or not smtp_server
    if is_mock:
        print(f"[MOCK EMAIL] To: {recipient} | Subject: {subject} | Body: {body}")
        return

    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    msg = MIMEMultipart()
    msg['From'] = f"{config.get('sender_name', 'EduPulse')} <{config.get('sender_email')}>"
    msg['To'] = recipient
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    smtp_port = int(config.get("smtp_port", 587))
    use_tls = config.get("use_tls", True)

    if use_tls:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
    else:
        server = smtplib.SMTP_SSL(smtp_server, smtp_port)

    if smtp_user and config.get("smtp_password"):
        server.login(smtp_user, config["smtp_password"])
    
    server.sendmail(config.get("sender_email"), recipient, msg.as_string())
    server.quit()


def send_whatsapp(config: dict, recipient: str, body: str) -> None:
    """Send a WhatsApp message via API POST request, or mock if configured."""
    api_url = config.get("api_url", "")
    auth_token = config.get("auth_token", "")
    
    is_mock = "mock" in api_url.lower() or "mock" in auth_token.lower() or not api_url
    if is_mock:
        print(f"[MOCK WHATSAPP] To: {recipient} | Body: {body}")
        return

    import urllib.request
    import urllib.parse
    
    sender = config.get("sender_number", "")
    
    if "twilio" in api_url.lower():
        # Twilio Basic Authentication
        import base64
        account_sid = config.get("account_sid", "")
        auth_str = f"{account_sid}:{auth_token}"
        b64_auth = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
        
        data = urllib.parse.urlencode({
            "To": f"whatsapp:{recipient}" if not recipient.startswith("whatsapp:") else recipient,
            "From": f"whatsapp:{sender}" if not sender.startswith("whatsapp:") else sender,
            "Body": body
        }).encode('utf-8')
        
        req = urllib.request.Request(api_url, data=data, method="POST")
        req.add_header("Authorization", f"Basic {b64_auth}")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
    else:
        # Custom HTTP POST webhook
        payload = {
            "to": recipient,
            "from": sender,
            "message": body
        }
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(api_url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        if auth_token:
            req.add_header("Authorization", f"Bearer {auth_token}")
            
    with urllib.request.urlopen(req, timeout=5) as response:
        if response.status not in [200, 201]:
            raise Exception(f"WhatsApp API returned status {response.status}")


def test_connector(db: Session, name: str, recipient: str, message: str) -> None:
    """Test a connector with a simple message."""
    connector = db.query(NotificationConnector).filter(NotificationConnector.name == name).first()
    if not connector:
        raise NotFoundException(f"Connector '{name}' not found")
        
    config = json.loads(connector.config)
    
    if name == "email":
        send_email(config, recipient, "EduPulse Connector Test", message)
    elif name == "whatsapp":
        send_whatsapp(config, recipient, message)
    else:
        raise ValidationException(f"Unsupported connector channel '{name}'")


def trigger_attendance_notifications(db: Session, session: AttendanceSession) -> None:
    """Check for absent students and send alerts if configured."""
    # Find active rules for student_absent
    rules = db.query(NotificationRule).filter(
        NotificationRule.event_type == "student_absent",
        NotificationRule.is_enabled == True
    ).all()
    
    if not rules:
        return
        
    # Get active connectors
    connectors = {c.name: c for c in db.query(NotificationConnector).filter(NotificationConnector.is_enabled == True).all()}
    
    # Loop rules
    for rule in rules:
        conn_type = rule.connector_type  # "email" or "whatsapp"
        if conn_type not in connectors:
            # Connector is disabled globally, skip
            continue
            
        connector = connectors[conn_type]
        config = json.loads(connector.config)
        
        # Loop absent records
        for record in session.records:
            if record.status.upper() != "ABSENT":
                continue
                
            student = record.student
            if not student:
                continue
                
            # Check for existing log to prevent duplicate notifications for this specific session + student + channel
            existing = db.query(NotificationLog).filter(
                NotificationLog.student_id == student.id,
                NotificationLog.event_type == "student_absent",
                NotificationLog.channel == conn_type.upper(),
                NotificationLog.reference_id == session.id
            ).first()
            if existing:
                continue
                
            # Resolve parent contact
            parent_contact = resolve_parent_contact(student, conn_type)
            if not parent_contact:
                # Log a failure log in DB so the teacher knows parent contact is missing!
                error_log = NotificationLog(
                    student_id=student.id,
                    student_name=student.full_name,
                    parent_contact="MISSING",
                    channel=conn_type.upper(),
                    event_type="student_absent",
                    message_body="Unable to send: Parent contact missing.",
                    status="FAILED",
                    error_message=f"No valid {conn_type} contact detail found in Student's profile.",
                    reference_id=session.id
                )
                db.add(error_log)
                db.commit()
                continue
                
            # Build message
            message_body = rule.template.replace("{student_name}", student.full_name).replace("{date}", str(session.date))
            
            # Send and create log
            status = "SENT"
            error_msg = None
            try:
                if conn_type == "email":
                    send_email(config, parent_contact, "Student Absence Notification", message_body)
                elif conn_type == "whatsapp":
                    send_whatsapp(config, parent_contact, message_body)
            except Exception as e:
                status = "FAILED"
                error_msg = str(e)
                
            log = NotificationLog(
                student_id=student.id,
                student_name=student.full_name,
                parent_contact=parent_contact,
                channel=conn_type.upper(),
                event_type="student_absent",
                message_body=message_body,
                status=status,
                error_message=error_msg,
                reference_id=session.id
            )
            db.add(log)
            db.commit()


def trigger_grade_notifications(db: Session, grade: StudentGrade) -> None:
    """Check if the student failed the assignment and send alerts if configured."""
    # Find active rules for assignment_failed
    rules = db.query(NotificationRule).filter(
        NotificationRule.event_type == "assignment_failed",
        NotificationRule.is_enabled == True
    ).all()
    
    if not rules:
        return
        
    # Get active connectors
    connectors = {c.name: c for c in db.query(NotificationConnector).filter(NotificationConnector.is_enabled == True).all()}
    
    # Resolve assessment
    assessment = db.query(Assessment).filter(Assessment.id == grade.assessment_id).first()
    if not assessment:
        return
        
    student = db.query(Student).filter(Student.id == grade.student_id).first()
    if not student:
        return

    # Calculate score percentage
    score_pct = (grade.score / assessment.max_points) * 100.0 if assessment.max_points > 0 else 0.0

    for rule in rules:
        passing_threshold = rule.passing_threshold if rule.passing_threshold is not None else 50.0
        
        # Check if failing
        if score_pct >= passing_threshold:
            continue
            
        conn_type = rule.connector_type
        if conn_type not in connectors:
            continue
            
        connector = connectors[conn_type]
        config = json.loads(connector.config)
        
        # Check for existing log to prevent duplicate notifications for this grade record + channel
        existing = db.query(NotificationLog).filter(
            NotificationLog.student_id == student.id,
            NotificationLog.event_type == "assignment_failed",
            NotificationLog.channel == conn_type.upper(),
            NotificationLog.reference_id == grade.id
        ).first()
        if existing:
            continue
            
        # Resolve parent contact
        parent_contact = resolve_parent_contact(student, conn_type)
        if not parent_contact:
            error_log = NotificationLog(
                student_id=student.id,
                student_name=student.full_name,
                parent_contact="MISSING",
                channel=conn_type.upper(),
                event_type="assignment_failed",
                message_body="Unable to send: Parent contact missing.",
                status="FAILED",
                error_message=f"No valid {conn_type} contact detail found in Student's profile.",
                reference_id=grade.id
            )
            db.add(error_log)
            db.commit()
            continue
            
        # Build message
        message_body = (
            rule.template
            .replace("{student_name}", student.full_name)
            .replace("{assignment_title}", assessment.title)
            .replace("{score}", str(grade.score))
            .replace("{max_points}", str(assessment.max_points))
            .replace("{passing_threshold}", f"{passing_threshold:.0f}")
        )
        
        # Send and log
        status = "SENT"
        error_msg = None
        try:
            if conn_type == "email":
                send_email(config, parent_contact, "Academic Alert: Student Grade Notification", message_body)
            elif conn_type == "whatsapp":
                send_whatsapp(config, parent_contact, message_body)
        except Exception as e:
            status = "FAILED"
            error_msg = str(e)
            
        log = NotificationLog(
            student_id=student.id,
            student_name=student.full_name,
            parent_contact=parent_contact,
            channel=conn_type.upper(),
            event_type="assignment_failed",
            message_body=message_body,
            status=status,
            error_message=error_msg,
            reference_id=grade.id
        )
        db.add(log)
        db.commit()


def retry_notification(db: Session, log_id: int) -> NotificationLog:
    """Manually retry sending a failed notification log."""
    log = db.query(NotificationLog).filter(NotificationLog.id == log_id).first()
    if not log:
        raise NotFoundException(f"Notification log with id {log_id} not found")
        
    if log.status == "SENT":
        raise ConflictException("This notification is already successfully sent")
        
    # Get connector config
    connector_name = log.channel.lower()
    connector = db.query(NotificationConnector).filter(NotificationConnector.name == connector_name).first()
    if not connector:
        raise NotFoundException(f"Connector '{connector_name}' not found")
        
    if not connector.is_enabled:
        raise ValidationException(f"Connector '{connector_name}' is currently disabled. Please enable it first.")
        
    config = json.loads(connector.config)
    
    # Try resolving contact again if it was MISSING
    recipient = log.parent_contact
    if recipient == "MISSING":
        student = db.query(Student).filter(Student.id == log.student_id).first()
        if student:
            recipient = resolve_parent_contact(student, connector_name)
            if recipient:
                log.parent_contact = recipient
            else:
                raise ValidationException(f"Cannot retry: Student profile still lacks a valid {connector_name} contact.")
        else:
            raise NotFoundException("Student associated with this log no longer exists")

    # Send
    try:
        if connector_name == "email":
            send_email(config, recipient, "Academic / Attendance Alert (Retry)", log.message_body)
        elif connector_name == "whatsapp":
            send_whatsapp(config, recipient, log.message_body)
        
        log.status = "SENT"
        log.error_message = None
    except Exception as e:
        log.status = "FAILED"
        log.error_message = str(e)
        
    db.commit()
    db.refresh(log)
    return log


def trigger_attendance_notifications_background(attendance_session_id: int) -> None:
    """Background task to fetch attendance session and trigger notifications safely under a new DB session."""
    from app.core.database import SessionLocal
    from app.models.attendance import AttendanceSession
    
    db = SessionLocal()
    try:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == attendance_session_id).first()
        if session:
            trigger_attendance_notifications(db, session)
    except Exception as e:
        print(f"[Background Notifications] Failed to trigger attendance notifications for session {attendance_session_id}: {e}")
    finally:
        db.close()


def trigger_grade_notifications_background(grade_id: int) -> None:
    """Background task to fetch student grade and trigger notifications safely under a new DB session."""
    from app.core.database import SessionLocal
    from app.models.grading import StudentGrade
    
    db = SessionLocal()
    try:
        grade = db.query(StudentGrade).filter(StudentGrade.id == grade_id).first()
        if grade:
            trigger_grade_notifications(db, grade)
    except Exception as e:
        print(f"[Background Notifications] Failed to trigger grade notifications for grade {grade_id}: {e}")
    finally:
        db.close()


def trigger_feedback_notifications_background(submission_id: int) -> None:
    """Background task to fetch feedback submission and trigger notifications safely under a new DB session."""
    from app.core.database import SessionLocal
    from app.models.merit import MeritSubmission
    
    db = SessionLocal()
    try:
        submission = db.query(MeritSubmission).filter(MeritSubmission.id == submission_id).first()
        if submission:
            trigger_feedback_notifications(db, submission)
    except Exception as e:
        print(f"[Background Notifications] Failed to trigger feedback notifications for submission {submission_id}: {e}")
    finally:
        db.close()


def trigger_feedback_notifications(db: Session, submission) -> None:
    """Check active feedback rules and notify school admin/teachers."""
    active_rules = db.query(NotificationRule).filter(
        NotificationRule.event_type == "feedback_submitted",
        NotificationRule.is_enabled == True
    ).all()
    
    if not active_rules:
        return
        
    from app.models.user import User
    admin = db.query(User).filter(User.role == "ADMIN").first()
    admin_email = admin.email if admin else "admin@school.local"
    
    student_name = "Anonymous"
    if not submission.is_anonymous:
        if submission.student:
            student_name = submission.student.full_name
        else:
            student_name = f"Unregistered IC ({submission.identity_card_number})"
            
    dt_str = submission.created_at.strftime("%d/%m/%Y %I:%M %p") if submission.created_at else datetime.now().strftime("%d/%m/%Y %I:%M %p")
    
    for rule in active_rules:
        conn_type = rule.connector_type.lower()
        connector = db.query(NotificationConnector).filter(
            NotificationConnector.name == conn_type
        ).first()
        
        if not connector or not connector.is_enabled:
            continue
            
        try:
            config = json.loads(connector.config)
        except Exception:
            continue
            
        recipient = admin_email
        if conn_type == "whatsapp":
            recipient = config.get("sender_number", "+6012-3456789")
            
        message_body = (
            rule.template
            .replace("{datetime}", dt_str)
            .replace("{location}", submission.location or "General")
            .replace("{identification}", student_name)
            .replace("{description}", submission.description)
        )
        
        status = "SENT"
        error_msg = None
        try:
            if conn_type == "email":
                send_email(config, recipient, "New Feedback Submission Received", message_body)
            elif conn_type == "whatsapp":
                send_whatsapp(config, recipient, message_body)
        except Exception as e:
            status = "FAILED"
            error_msg = str(e)
            
        log = NotificationLog(
            student_id=submission.student_id,
            student_name=submission.student.full_name if submission.student else student_name,
            parent_contact=recipient,
            channel=conn_type.upper(),
            event_type="feedback_submitted",
            message_body=message_body,
            status=status,
            error_message=error_msg,
            reference_id=submission.id
        )
        db.add(log)
    db.commit()

