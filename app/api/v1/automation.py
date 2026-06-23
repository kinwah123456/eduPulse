from __future__ import annotations

import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from PIL import Image
import winocr

from app.core.database import get_db
from app.dependencies import require_teacher_or_admin
from app.models.user import User
from app.models.teacher import Teacher
from app.services.omr_processor import run_sync
from app.services import automation_service

router = APIRouter()

TEMPLATES = {
    "teachers": "employee_id,full_name,email,contact_number,emergency_contact,is_active\nT8002,Noraini Binti Abdullah,noraini@school.edu.my,+6012-3456789,Husband: +6012-9876543,true\nT8010,Ahmad Bin Kassim,ahmadk@school.edu.my,+6013-1112223,Wife: +6013-4445556,true\n",
    "classrooms": "name,grade_level,capacity,form_teacher_employee_id\n3 Cempaka,3,35,T8002\n5 Dahlia,5,40,T8005\n",
    "students": "student_id_number,full_name,class_name,gender,identity_card_number,birth_date,enroll_date,father_contact,mother_contact,guardian_contact,residential_address,merit_points,is_active\nS2001,Muhammad Ali Bin Hassan,3 Cempaka,MALE,120101-14-1111,2012-01-01,2024-01-15,+6012-3456789,+6019-8765432,,No. 5 Jalan Melawati,50,true\nS2007,Chong Wei Liang,3 Cempaka,MALE,120404-10-8888,2012-04-04,2024-01-15,+6012-8888888,,,Cheras Kuala Lumpur,50,true\n",
    "schedules": "timetable_name,class_name,subject_code,teacher_employee_id,day_of_week,period_number\nDemo Timetable,3 Cempaka,MAT101,T8002,Monday,1\nDemo Timetable,3 Cempaka,SCI101,T8002,Monday,2\n",
    "attendance": "student_id_number,date,status,period_number,notes\nS2001,2026-06-22,PRESENT,,On time\nS2002,2026-06-22,ABSENT,,No reason\nS2003,2026-06-22,LATE,1,Bus breakdown\n",
    "merit": "student_id_number,merit_option_name,points,justification\nS2001,Excellent Homework,10,Submitted ahead of time\nS2002,Tardy,-5,Late to class 3 times\n"
}

@router.get("/templates/{task}")
def download_template(task: str):
    if task not in TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Template for task '{task}' not found")
        
    content = TEMPLATES[task]
    headers = {
        "Content-Disposition": f"attachment; filename=template_{task}.csv"
    }
    return Response(content=content, media_type="text/csv", headers=headers)


@router.post("/upload")
async def upload_automation_file(
    task: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin)
):
    if task not in TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Invalid task: {task}")
        
    # Enforce role restrictions
    if task == "teachers" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only administrators can batch import/modify teachers")
        
    # Resolve school ID
    teacher = db.query(Teacher).filter(Teacher.user_id == current_user.id).first()
    school_id = teacher.school_id if teacher else 1
    
    # Read file content
    file_bytes = await file.read()
    filename = file.filename.lower()
    
    is_csv = True
    text_content = ""
    
    if filename.endswith(".csv"):
        is_csv = True
        try:
            text_content = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text_content = file_bytes.decode("latin1")
            except Exception:
                raise HTTPException(status_code=400, detail="Failed to decode CSV file. Please upload a valid UTF-8 file.")
    elif filename.endswith((".png", ".jpg", ".jpeg", ".bmp", ".tiff")):
        is_csv = False
        # Run OCR
        try:
            img = Image.open(io.BytesIO(file_bytes))
            ocr_result = run_sync(winocr.recognize_pil(img))
            if not ocr_result or not ocr_result.text:
                raise HTTPException(status_code=400, detail="OCR processed the image but could not extract any text.")
            text_content = ocr_result.text
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process image OCR: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a CSV or an Image.")
        
    # Parse rows into lists of dictionaries
    try:
        rows = automation_service.parse_content_to_dicts(text_content, is_csv=is_csv)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse content: {str(e)}")
        
    if not rows:
        return {
            "task": task,
            "filename": file.filename,
            "parsed_lines": 0,
            "results": [],
            "message": "No data rows found in the uploaded file or image."
        }
        
    # Process rows based on task
    results = []
    if task == "teachers":
        results = automation_service.process_batch_teachers(db, rows, school_id)
    elif task == "classrooms":
        results = automation_service.process_batch_classrooms(db, rows, school_id)
    elif task == "students":
        results = automation_service.process_batch_students(db, rows, school_id)
    elif task == "schedules":
        results = automation_service.process_batch_schedules(db, rows, school_id)
    elif task == "attendance":
        results = automation_service.process_batch_attendance(db, rows, school_id, current_user.id)
    elif task == "merit":
        results = automation_service.process_batch_merit(db, rows, school_id, current_user.id)
        
    success_count = sum(1 for r in results if r.get("status") == "success")
    failed_count = sum(1 for r in results if r.get("status") == "failed")
    
    return {
        "task": task,
        "filename": file.filename,
        "parsed_lines": len(rows),
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results,
        "ocr_extracted_text": text_content if not is_csv else None
    }
