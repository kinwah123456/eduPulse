from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.school import School
from app.models.student import Student
from app.models.merit import MeritOption, MeritLog


def test_merit_module_workflow(client: TestClient, db_session: Session):
    # ── Phase 1: Authentication & Setup ──
    # Register Admin
    resp = client.post("/api/v1/auth/register", json={
        "email": "admin@merit.local",
        "password": "admin123",
        "full_name": "Merit Admin",
        "role": "ADMIN"
    })
    assert resp.status_code == 200
    
    # Login Admin
    resp = client.post("/api/v1/auth/login", data={
        "username": "admin@merit.local",
        "password": "admin123"
    })
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create School
    resp = client.post("/api/v1/schools/", headers=admin_headers, json={
        "name": "SMK Test Merit",
        "code": "SMKTM",
        "state": "Selangor",
        "district": "Petaling"
    })
    assert resp.status_code == 200
    school_id = resp.json()["id"]

    # Register Teacher
    resp = client.post("/api/v1/auth/register", headers=admin_headers, json={
        "email": "teacher@merit.local",
        "password": "teacher123",
        "full_name": "Cikgu Merit",
        "role": "TEACHER",
        "school_id": school_id,
        "employee_id": "TM001"
    })
    assert resp.status_code == 200

    # Login Teacher
    resp = client.post("/api/v1/auth/login", data={
        "username": "teacher@merit.local",
        "password": "teacher123"
    })
    assert resp.status_code == 200
    teacher_token = resp.json()["access_token"]
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    # Create Student
    resp = client.post("/api/v1/students/", headers=teacher_headers, json={
        "student_id_number": "SM0001",
        "full_name": "Abu Bakar",
        "school_id": school_id
    })
    assert resp.status_code == 200
    student_id = resp.json()["id"]
    
    # Verify student has default 50 points
    assert resp.json()["merit_points"] == 50

    # ── Phase 2: Manage Merit Options (Admin Only) ──
    # Teacher tries to create merit option (should fail with 403)
    resp = client.post("/api/v1/merit/options", headers=teacher_headers, json={
        "name": "Helping Peer",
        "points": 10
    })
    assert resp.status_code == 403

    # Admin creates merit option
    resp = client.post("/api/v1/merit/options", headers=admin_headers, json={
        "name": "Helping Peer",
        "points": 10
    })
    assert resp.status_code == 200
    option_id = resp.json()["id"]
    assert resp.json()["name"] == "Helping Peer"
    assert resp.json()["points"] == 10

    # Admin creates negative merit option (reduction)
    resp = client.post("/api/v1/merit/options", headers=admin_headers, json={
        "name": "Class Disruption",
        "points": -15
    })
    assert resp.status_code == 200
    neg_option_id = resp.json()["id"]

    # ── Phase 3: Awarding & Reducing Points (Teacher/Admin) ──
    # Teacher awards points to student (Helping Peer +10)
    resp = client.post("/api/v1/merit/award", headers=teacher_headers, json={
        "student_id": student_id,
        "option_id": option_id,
        "justification": "Abu helped clear the whiteboard."
    })
    assert resp.status_code == 200
    assert resp.json()["points_changed"] == 10
    assert resp.json()["justification"] == "Abu helped clear the whiteboard."

    # Verify student points increased to 60
    resp = client.get(f"/api/v1/students/{student_id}", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["merit_points"] == 60

    # Teacher reduces points from student (Class Disruption -15)
    resp = client.post("/api/v1/merit/award", headers=teacher_headers, json={
        "student_id": student_id,
        "option_id": neg_option_id,
        "justification": "Abu was shouting in class."
    })
    assert resp.status_code == 200
    assert resp.json()["points_changed"] == -15

    # Verify student points decreased to 45
    resp = client.get(f"/api/v1/students/{student_id}", headers=teacher_headers)
    assert resp.status_code == 200
    assert resp.json()["merit_points"] == 45

    # Justification requirement: validation error if empty or too short
    resp = client.post("/api/v1/merit/award", headers=teacher_headers, json={
        "student_id": student_id,
        "option_id": option_id,
        "justification": ""
    })
    assert resp.status_code == 422

    # ── Phase 4: History Logs (View & Delete) ──
    # Teacher views history logs
    resp = client.get("/api/v1/merit/logs", headers=teacher_headers)
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) == 2
    # Verify log details
    latest_log = logs[0]
    assert latest_log["student"]["full_name"] == "Abu Bakar"
    assert latest_log["user"]["full_name"] == "Cikgu Merit"
    assert latest_log["points_changed"] == -15
    assert latest_log["justification"] == "Abu was shouting in class."
    
    log_id_to_delete = latest_log["id"]

    # Teacher tries to delete history log (should fail with 403)
    resp = client.delete(f"/api/v1/merit/logs/{log_id_to_delete}", headers=teacher_headers)
    assert resp.status_code == 403

    # Admin views history logs
    resp = client.get("/api/v1/merit/logs", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # Admin deletes history log (should succeed)
    resp = client.delete(f"/api/v1/merit/logs/{log_id_to_delete}", headers=admin_headers)
    assert resp.status_code == 200

    # Verify logs count is now 1
    resp = client.get("/api/v1/merit/logs", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
