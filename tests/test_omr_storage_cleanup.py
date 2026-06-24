import os
import shutil
import time
import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.services.grading_service import delete_temp_submission, cleanup_expired_temp_submissions

def test_delete_temp_submission():
    # 1. Create a dummy temp directory
    temp_dir = os.path.join("app", "static", "temp_submissions", "test-session-123")
    os.makedirs(temp_dir, exist_ok=True)
    with open(os.path.join(temp_dir, "test.txt"), "w") as f:
        f.write("dummy")
        
    assert os.path.exists(temp_dir)
    
    # 2. Delete it using utility
    delete_temp_submission("test-session-123")
    assert not os.path.exists(temp_dir)
    
    # 3. Path traversal protection check
    with pytest.raises(ValueError):
        delete_temp_submission("../invalid-path")


def test_cleanup_expired_temp_submissions():
    # 1. Create one expired and one recent temp directory
    expired_dir = os.path.join("app", "static", "temp_submissions", "expired-session")
    recent_dir = os.path.join("app", "static", "temp_submissions", "recent-session")
    
    os.makedirs(expired_dir, exist_ok=True)
    os.makedirs(recent_dir, exist_ok=True)
    
    with open(os.path.join(expired_dir, "test.txt"), "w") as f:
        f.write("dummy")
    with open(os.path.join(recent_dir, "test.txt"), "w") as f:
        f.write("dummy")
        
    # Set expired directory mtime to 2 days ago
    two_days_ago = time.time() - (2 * 86400)
    os.utime(expired_dir, (two_days_ago, two_days_ago))
    
    # Run cleanup with 24 hours threshold (86400 seconds)
    cleanup_expired_temp_submissions(86400)
    
    # Expired should be deleted, recent should remain
    assert not os.path.exists(expired_dir)
    assert os.path.exists(recent_dir)
    
    # Cleanup recent dir manually
    shutil.rmtree(recent_dir)


def test_api_batch_confirm_cleanup(client: TestClient, db_session: Session):
    # Setup auth
    # Register Admin
    resp = client.post("/api/v1/auth/register", json={
        "email": "admin@cleanup.local",
        "password": "admin123",
        "full_name": "Cleanup Admin",
        "role": "ADMIN"
    })
    assert resp.status_code == 200
    
    # Login Admin
    resp = client.post("/api/v1/auth/login", data={
        "username": "admin@cleanup.local",
        "password": "admin123"
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {token}"}
    
    # Create the dummy directory for session-cleanup-test
    temp_dir = os.path.join("app", "static", "temp_submissions", "session-cleanup-test")
    os.makedirs(temp_dir, exist_ok=True)
    assert os.path.exists(temp_dir)
    
    # Send mock batch confirmation
    resp = client.post("/api/v1/grading/batch-confirm", headers=admin_headers, json={
        "assessment_id": 1,
        "grades": [],
        "session_id": "session-cleanup-test"
    })
    assert resp.status_code == 200
    
    # Folder should be deleted
    assert not os.path.exists(temp_dir)
