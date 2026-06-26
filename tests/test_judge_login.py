from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User


def test_judge_login_flow(client: TestClient, db_session: Session):
    # 1. Verify no ADMIN user exists initially
    admin_count = db_session.query(User).filter(User.role == "ADMIN").count()
    assert admin_count == 0

    # 2. Call the judge-login endpoint
    response = client.post("/api/v1/auth/judge-login")
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    token = data["access_token"]

    # 3. Call GET /me with the retrieved token to confirm ADMIN role
    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["role"] == "ADMIN"
    assert me_data["email"] == "admin@edupulse.local"

    # 4. Call judge-login again (when ADMIN user already exists)
    response_again = client.post("/api/v1/auth/judge-login")
    assert response_again.status_code == 200
    data_again = response_again.json()
    assert "access_token" in data_again
    
    # 5. Confirm that we didn't duplicate the admin user
    db_session.expire_all()
    admin_count_after = db_session.query(User).filter(User.role == "ADMIN").count()
    assert admin_count_after == 1
