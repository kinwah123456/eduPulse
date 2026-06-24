# EduPulse Ops

EduPulse Ops is a comprehensive, production-ready School Resource, Attendance & Performance Optimization Ecosystem designed for Malaysia Public Schools. It provides teachers and school admins with powerful tools to streamline administrative operations, track attendance, evaluate grading performance via OMR, and manage student merit/discipline.

---

## Key Modules & Features

### 1. Student Merit & Discipline Module
Evaluate student behavior, award or reduce points based on predefined rules, and track log history.
* **Student Roster**: Track current merit points for all students.
* **Predefined Options**: Admin-configurable merit/discipline rules.
* **Activity Logs**: Traceable logs of point modifications.

### 2. NEW: Public Feedback Submission & Teacher Inbox
An intake system enabling students and the public to safely report incidents (e.g., bullying, skipping class, facilities complaints).
* **Public Feedback Form (`/feedback`)**: Accessible to everyone without logging in.
* **Submission Modes**: Users can choose to submit **Anonymously** or **Identify Themselves** by providing their Identity Card (IC) Number (validated against the database, with support for unregistered ICs).
* **Location Tracking (GPS-free)**: Reads a `loc` or `location` query parameter from the URL (e.g., `/feedback?loc=Canteen`) to identify the source location automatically via location-specific QR codes.
* **Evidence Attachments**: Support for live webcam photo capture (HTML5 video stream snapshot) and uploading multiple evidence images.
* **Teacher Feedback Inbox**: Teachers can monitor reports in real-time, view attachments in a lightbox modal, and **Acknowledge** entries (logging which teacher acknowledged the report and the exact date/time).
* **Automated Notifications**: Triggers notification logs for the school administration with comprehensive date-time information.

### 3. Attendance Tracking
Digital daily homeroom roll calls and period-based attendance schedules.

### 4. Grading & Performance Optimization
Automated assessment processing featuring:
* **OMR (Optical Mark Recognition) Scanning**: Batch upload and grade student response sheets.
* **Math Engine**: Automated grading for mathematical assessments.
* **Analytics**: Core metrics tracking and alert rules for grade drops.

---

## Tech Stack
* **Backend**: FastAPI (Python 3.11+)
* **Database**: SQLite (SQLAlchemy ORM)
* **Frontend**: Vanilla HTML5, CSS3, Tailwind CSS (CDN), FontAwesome Icons
* **Testing**: Pytest

---

## Installation & Setup

### Prerequisites
Ensure you have **Python 3.11+** installed.

### 1. Clone & Set Up Directory
Navigate to the project root:
```bash
cd eduPulse
```

### 2. Install Dependencies
Install dependencies using pip:
```bash
python -m pip install -r requirements.txt
# Or if using standard pip setup
python -m pip install .
```

### 3. Environment Variables
Create a `.env` file in the root directory to customize settings (optional):
```env
DATABASE_URL=sqlite:///data/edupulse.db
SECRET_KEY=your-production-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=480
DEBUG=False
```

### 4. Run the Application
Start the FastAPI development server:
```bash
uvicorn app.main:app --reload
```
* **Teacher Access Portal**: `http://localhost:8000/` or `/login`
* **Public Feedback Form**: `http://localhost:8000/feedback` (or `/feedback?loc=Canteen`)
* **API Documentation**: `http://localhost:8000/docs`

---

## Running Tests
Run the unit test suite to verify the application:
```bash
python -m pytest tests/
```
All core workflows, including auth, students, merit awarding, and public feedback submissions, are verified by automated tests.
