import os
import re
from fastapi.testclient import TestClient

def test_dashboard_page_serves(client: TestClient):
    """Test that /dashboard is served and returns HTML."""
    resp = client.get("/dashboard")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"].lower()

def test_static_js_modules_serve(client: TestClient):
    """Verify that JS modules are served with the correct MIME type."""
    js_files = [
        "main.js", "api.js", "ui.js",
        "merit.js", "attendance.js", "schedules.js", "grading.js",
        "classrooms.js", "students.js", "teachers.js", "automation.js", "notifications.js"
    ]
    # Check if we have modularized any files yet
    js_dir = os.path.join("app", "static", "js")
    if not os.path.exists(js_dir):
        return  # No files to check yet

    for js in js_files:
        js_path = os.path.join(js_dir, js)
        if os.path.exists(js_path):
            resp = client.get(f"/static/js/{js}")
            assert resp.status_code == 200
            assert "javascript" in resp.headers["content-type"].lower()

def test_static_js_imports_validity():
    """Verify that all import paths inside JS modules point to actual files in the directory."""
    js_dir = os.path.join("app", "static", "js")
    if not os.path.exists(js_dir):
        return  # Stage 1 not started yet

    for filename in os.listdir(js_dir):
        if not filename.endswith(".js"):
            continue
        file_path = os.path.join(js_dir, filename)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Find imports: e.g. from './api.js' or from "./api.js"
        imports = re.findall(r'from\s+[\'"]([^\'"]+)[\'"]', content)
        for imp in imports:
            if imp.startswith("./"):
                target_file = imp[2:]
                target_path = os.path.join(js_dir, target_file)
                assert os.path.exists(target_path), f"In {filename}, imported file {imp} does not exist!"
