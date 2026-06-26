@echo off
:: ── Self-reinvoke inside cmd /c so Ctrl+C exits cleanly (no Y/N prompt) ─────
if "%~1"=="" (
    cmd /c "%~f0" run
    exit /b
)

title EduPulse Ops — Launcher
color 0A

echo.
echo  ============================================
echo    EduPulse Ops ^| School Optimization System
echo  ============================================
echo.

:: ── Locate venv ──────────────────────────────────────────────────────────────
set "VENV_ACTIVATE=%~dp0venv\Scripts\activate.bat"

if not exist "%VENV_ACTIVATE%" (
    echo  [ERROR] Virtual environment not found.
    echo  Expected path: %~dp0venv\
    echo.
    echo  Please create it first by running:
    echo    python -m venv venv
    echo    venv\Scripts\activate
    echo    pip install -e .
    echo.
    pause
    exit /b 1
)

echo  [1/4] Activating virtual environment...
call "%VENV_ACTIVATE%"
echo        Done.

:: ── Seed database if first run ────────────────────────────────────────────────
echo  [2/4] Checking database...
python -c "from app.core.database import SessionLocal; from app.models.school import School; db=SessionLocal(); found=db.query(School).first(); db.close(); exit(0 if found else 1)" >nul 2>&1
if errorlevel 1 (
    echo        No data found. Running initial seed...
    python scripts\seed_data.py
    python scripts\create_admin.py
    echo        Database seeded successfully.
) else (
    echo        Database already seeded. Skipping.
)

:: ── Open browser after short delay ───────────────────────────────────────────
echo  [3/4] Opening browser in 3 seconds...
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"

:: ── Launch server ─────────────────────────────────────────────────────────────
echo  [4/4] Starting EduPulse Ops server...
echo.
echo  Access the app at: http://localhost:8000
echo  Press Ctrl+C to stop the server.
echo  ============================================
echo.

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

echo.
echo  [INFO] Server stopped.
