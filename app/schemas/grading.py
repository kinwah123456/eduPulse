from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.student import StudentResponse
from app.schemas.academic import SubjectResponse


class AssessmentCreate(BaseModel):
    title: str
    subject_id: int
    grading_type: str  # "OMR", "MATH"
    config: str  # JSON config (answers key or expression rules)
    max_points: int = 100


class AssessmentUpdate(BaseModel):
    title: str | None = None
    subject_id: int | None = None
    grading_type: str | None = None
    config: str | None = None
    max_points: int | None = None


class AssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    subject_id: int
    teacher_id: int
    grading_type: str
    config: str
    max_points: int
    created_at: datetime
    updated_at: datetime

    # Optional relationships
    subject: SubjectResponse | None = None


class AssessmentListResponse(BaseModel):
    total: int
    items: list[AssessmentResponse]


class StudentGradeCreate(BaseModel):
    student_id: int
    assessment_id: int
    student_response: str  # JSON response or text


class StudentGradeUpdate(BaseModel):
    student_response: str | None = None
    score: float | None = None
    status: str | None = None
    feedback: str | None = None


class StudentGradeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    assessment_id: int
    student_response: str
    score: float
    status: str
    feedback: str | None
    created_at: datetime
    updated_at: datetime

    # Optional relationships
    student: StudentResponse | None = None
    assessment: AssessmentResponse | None = None


class StudentGradeListResponse(BaseModel):
    total: int
    items: list[StudentGradeResponse]


class BatchGradeConfirmItem(BaseModel):
    student_id: int
    student_response: str


class BatchGradeConfirmRequest(BaseModel):
    assessment_id: int
    grades: list[BatchGradeConfirmItem]

