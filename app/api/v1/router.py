from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, users, schools, students, teachers, attendance, schedules, classes, grading, merit, automation, notifications

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_v1_router.include_router(users.router, prefix="/users", tags=["Users"])
api_v1_router.include_router(schools.router, prefix="/schools", tags=["Schools"])
api_v1_router.include_router(classes.router, prefix="/classes", tags=["Classrooms"])
api_v1_router.include_router(students.router, prefix="/students", tags=["Students"])
api_v1_router.include_router(teachers.router, prefix="/teachers", tags=["Teachers"])
api_v1_router.include_router(attendance.router, prefix="/attendance", tags=["Attendance"])
api_v1_router.include_router(schedules.router, prefix="/schedules", tags=["Schedules"])
api_v1_router.include_router(grading.router, prefix="/grading", tags=["Grading"])
api_v1_router.include_router(merit.router, prefix="/merit", tags=["Merit"])
api_v1_router.include_router(automation.router, prefix="/automation", tags=["Automation"])
api_v1_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])

