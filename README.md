# EduPulse Ops

> **School Resource, Attendance & Performance Optimization Ecosystem**
> Designed for Malaysian public schools — built with FastAPI, SQLAlchemy, and Tailwind CSS.

EduPulse Ops gives teachers and school administrators a unified platform to manage daily operations: take attendance, grade assessments via OMR scanning, track student merit & discipline, process public feedback, and notify parents automatically through Email, WhatsApp, and SMS.

---

## Table of Contents

- [Key Modules & Features](#key-modules--features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Installation & Setup](#installation--setup)
- [Configuration & Run](#configuration--run)
- [Running Tests](#running-tests)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Key Modules & Features

### 1. Student Merit & Discipline
Evaluate student behaviour, award or reduce points based on predefined rules, and maintain a traceable activity log.
* **Student Roster** — View current merit points for every student at a glance.
* **Predefined Options** — Admin-configurable merit/discipline rules.
* **Activity Logs** — Timestamped, searchable records of all point modifications.

### 2. Public Feedback Submission & Teacher Inbox
An intake system enabling students and the public to safely report incidents (e.g., bullying, skipping class, facilities complaints).
* **Public Form (`/feedback`)** — No login required. Supports **anonymous** or **identified** submissions (IC Number validated against the database).
* **Location Tracking (GPS-free)** — Reads a `loc` query parameter (e.g., `/feedback?loc=Canteen`) to auto-populate the source location via QR codes.
* **Evidence Attachments** — Live webcam capture (HTML5 video snapshot) and multi-image upload.
* **Teacher Inbox** — Real-time monitoring, lightbox modal for attachments, and **Acknowledge** action with teacher name + timestamp logging.
* **Automated Notifications** — Triggers alerts to school administration on every new submission.

### 3. Attendance Tracking
Digital daily homeroom roll calls and period-based attendance schedules.
* **Daily Homeroom** — One-click bulk mark present/absent for an entire classroom.
* **Absence Alerts** — Automatically triggers parent notifications when a student is marked absent (if enabled).

### 4. Grading & Performance (OMR)
Automated assessment processing with advanced review tools:
* **OMR Scanning** — Batch upload and grade student response sheets in the SPM-style Malaysian layout.
* **Batch History** — Dedicated tab with CSV re-export (`[Classroom]-[Subject]-[Datetime].csv`), per-question histograms, student response inspection, and in-place answer corrections that re-grade and sync live scores.
* **Math Engine** — Automated grading for mathematical expression assessments.
* **Auto-Cleanup** — Assessments idle >1 year and historical records >1 year are pruned on startup. Temp images are deleted immediately after batch confirmation.

### 5. Notification Hub
Automated parent and admin alerting across **three independent channels**, each configurable from the dashboard:

| Channel | Provider | Triggers |
|---------|----------|----------|
| **Email** | Any SMTP (Mailtrap, Mailgun, SendGrid, SMTP2Go) | Absences, failed assignments, feedback |
| **WhatsApp** | Twilio WhatsApp API / custom webhook | Absences, failed assignments, feedback |
| **SMS** | Twilio SMS REST API | Absences, failed assignments, feedback |

Each channel has its own connector card under **Dashboard → Notifications → Connectors** with independent enable/disable toggles, credentials, message templates, and a **Test Connection** button.

### 6. Judge / Evaluator Access
A one-click **"Enter as Judge"** button on the login page provides instant admin access for evaluators — no credentials required.
* Calls `/api/v1/auth/judge-login` → retrieves (or auto-creates) the first admin user → returns a JWT → redirects to the dashboard.
* Falls back to offline simulation mode if the backend is unreachable.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI (Python 3.11+) |
| Database | SQLite via SQLAlchemy ORM, Alembic migrations |
| Frontend | Vanilla HTML5 / CSS3 / JS, Tailwind CSS (CDN), Font Awesome |
| Vision AI | Moondream model via [Ollama](https://ollama.com) (local, for OMR name detection) |
| Testing | Pytest (49 tests across 14 test files) |

---

## Project Structure

```
eduPulse/
├── app/
│   ├── api/v1/          # FastAPI route handlers (auth, attendance, grading, merit, notifications …)
│   ├── core/            # Config, database engine, security helpers
│   ├── models/          # SQLAlchemy ORM models
│   ├── services/        # Business logic (notification_service, omr_service, …)
│   └── static/          # HTML pages, JS modules, CSS
├── scripts/
│   ├── seed_data.py     # Populate sample school, classrooms, students, teachers
│   └── create_admin.py  # Create the default admin user
├── tests/               # Pytest unit, integration, and E2E test suites
├── data/                # SQLite database (auto-created)
├── start.bat            # One-click Windows launcher
├── pyproject.toml       # Project metadata & dependencies
└── README.md
```

---

## Quick Start

> **Windows users** — the fastest path is the one-click launcher:

```
1.  python -m venv venv
2.  venv\Scripts\activate && pip install -e .[dev]
3.  Double-click  start.bat
```

`start.bat` activates the venv, seeds the database on first run, opens the browser, and starts the server. That's it.

For manual setup or non-Windows platforms, continue to the sections below.

---

## Installation & Setup

### Prerequisites
* **Python 3.11+** installed and available on `PATH`.
* **Ollama** with the `moondream` model (required only for Batch OMR name detection).

### 1. Create & Activate Virtual Environment

```bash
# Create
python -m venv venv          # Windows
python3 -m venv venv         # macOS / Linux

# Activate
.\venv\Scripts\activate.bat  # Windows CMD
.\venv\Scripts\Activate.ps1  # Windows PowerShell
source venv/bin/activate     # macOS / Linux
```

Your prompt will be prefixed with `(venv)` when activated. Verify with:
```bash
where python    # Windows — should point to venv\Scripts\python.exe
which python    # macOS / Linux — should point to venv/bin/python
```

### 2. Install Dependencies

```bash
python -m pip install --upgrade pip
pip install -e .[dev]
```

`.[dev]` installs core dependencies (FastAPI, SQLAlchemy, uvicorn, etc.) plus testing packages (`pytest`, `httpx`).

### 3. Setup Ollama & Moondream (OMR Only)

1. Download and install [Ollama](https://ollama.com).
2. Pull the vision model:
   ```bash
   ollama pull moondream
   ```
3. Ensure Ollama is running (`http://localhost:11434`) before processing OMR zip files.

---

## Configuration & Run

### Environment Variables (Optional)

Create a `.env` file in the project root:
```env
DATABASE_URL=sqlite:///data/edupulse.db
SECRET_KEY=your-production-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=480
DEBUG=False
```

### Running the Application

#### Option A — One-Click Launcher (Windows)

Double-click **`start.bat`** in the project root. It will:

1. Activate the virtual environment.
2. Seed the database if this is the first run (`seed_data.py` + `create_admin.py`).
3. Open `http://localhost:8000` in your default browser (3-second delay).
4. Start `uvicorn` on port 8000 with hot-reload.

Press `Ctrl+C` to stop the server.

#### Option B — Manual Launch

```bash
# Seed the database (first time only)
python scripts/seed_data.py
python scripts/create_admin.py

# Start the server
uvicorn app.main:app --reload
```

### Application URLs

| URL | Description |
|-----|-------------|
| [`http://localhost:8000`](http://localhost:8000/) | Login page (includes Judge access button) |
| [`http://localhost:8000/dashboard`](http://localhost:8000/dashboard) | Teacher / Admin dashboard |
| [`http://localhost:8000/feedback`](http://localhost:8000/feedback) | Public feedback form (append `?loc=Canteen` for location) |
| [`http://localhost:8000/docs`](http://localhost:8000/docs) | Interactive API documentation (Swagger UI) |

---

## Running Tests

> Ensure your virtual environment is active before running tests.

### Unit & Integration Tests

```bash
pytest           # Run all 49 tests
pytest -v        # Verbose output
pytest -x        # Stop on first failure
```

#### Test File Reference

| File | Coverage |
|------|----------|
| `test_notifications.py` | Email / WhatsApp / SMS seeding, connector toggles, rule updates, attendance & grade triggers |
| `test_sms_notification.py` | Twilio SMS mock/live dispatch, Basic auth headers, seeding, connector test |
| `test_judge_login.py` | Passwordless admin token, `/me` role verification, no-duplicate guard |
| `test_merit_api.py` | Merit CRUD, feedback submissions, rate limiting, pagination |
| `test_batch_omr_history.py` | OMR history endpoints, in-place editing, record expiry cleanup |
| `test_attendance_warnings.py` | Bulk absence warning logic and API validation |
| `test_webhooks.py` | SendGrid, Mailgun, SMTP2Go, and generic webhook handlers |
| `test_qa_suite.py` | Full end-to-end workflow across all modules |
| `test_frontend_assets.py` | Static file serving and JS import validity |

### End-to-End (E2E) QA Suite

```bash
python tests/run_e2e_qa.py
```

Runs a 6-phase simulated browser test across guest, admin, and teacher pathways:

| Phase | Coverage |
|-------|----------|
| 1 | Database schema initialization & health |
| 2 | Feedback: location tracking, anonymous/identified modes, attachments, validation |
| 3 | User promotion, admin lockout bounds, teacher profiles |
| 4 | Dashboard UI structure, feedback acknowledgement, attendance registers |
| 5 | OMR zip processing, Math engine grading, performance warning triggers |
| 6 | Asset cleanup, OMR directory wipes, seeding configs |

Results are recorded in `tests/qa_test_results.json`.

---

## Troubleshooting

### Port 8000 Already in Use

If the dashboard hangs on **"Authenticating session…"** or the server refuses to start, a previous process is likely occupying port 8000.

**Windows:**
```powershell
netstat -ano | findstr 8000       # Find the PID
taskkill /F /PID <PID>            # Kill it
```

**macOS / Linux:**
```bash
lsof -i :8000                     # Find the PID
kill -9 <PID>                     # Kill it
```

Then restart with `start.bat` (Windows) or `uvicorn app.main:app --reload`.

---

## License

This project is licensed under the terms specified in [LICENSE](LICENSE).
