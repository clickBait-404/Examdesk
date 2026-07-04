"""
ExamDesk — Pydantic Schemas
Request/Response models for all API endpoints.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ─── Base ──────────────────────────────────────────────────────────────────

class BaseResponse(BaseModel):
    model_config = {"from_attributes": True}


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int


class MessageResponse(BaseModel):
    message: str


# ─── Auth ──────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserResponse"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


# ─── Users ─────────────────────────────────────────────────────────────────

class StudentProfileBase(BaseModel):
    roll_number: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[int] = None
    batch_year: Optional[int] = None
    date_of_birth: Optional[datetime] = None
    address: Optional[str] = None


class StudentProfileCreate(StudentProfileBase):
    pass


class StudentProfileResponse(StudentProfileBase, BaseResponse):
    id: UUID
    user_id: UUID


class InstructorProfileBase(BaseModel):
    department: Optional[str] = None
    designation: Optional[str] = None
    employee_id: Optional[str] = None
    specialization: Optional[str] = None


class InstructorProfileCreate(InstructorProfileBase):
    pass


class InstructorProfileResponse(InstructorProfileBase, BaseResponse):
    id: UUID
    user_id: UUID


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=255)
    role: str
    phone: Optional[str] = None
    student_profile: Optional[StudentProfileCreate] = None
    instructor_profile: Optional[InstructorProfileCreate] = None

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v):
        if v not in ("student", "instructor", "admin"):
            raise ValueError("Role must be student, instructor, or admin")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    profile_picture: Optional[str] = None
    student_profile: Optional[StudentProfileBase] = None
    instructor_profile: Optional[InstructorProfileBase] = None


class UserResponse(BaseResponse):
    id: UUID
    email: str
    full_name: str
    role: str
    status: str
    phone: Optional[str] = None
    profile_picture: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    student_profile: Optional[StudentProfileResponse] = None
    instructor_profile: Optional[InstructorProfileResponse] = None


class UserListResponse(BaseResponse):
    id: UUID
    email: str
    full_name: str
    role: str
    status: str
    created_at: datetime


class BulkUserCreate(BaseModel):
    users: List[UserCreate]


# ─── Subjects ──────────────────────────────────────────────────────────────

class SubjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=20)
    description: Optional[str] = None
    department: Optional[str] = None
    credits: Optional[int] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    credits: Optional[int] = None
    is_active: Optional[bool] = None


class SubjectResponse(BaseResponse):
    id: UUID
    name: str
    code: str
    description: Optional[str] = None
    department: Optional[str] = None
    credits: Optional[int] = None
    is_active: bool
    created_at: datetime


# ─── Questions ─────────────────────────────────────────────────────────────

class OptionCreate(BaseModel):
    text: str = Field(min_length=1)
    is_correct: bool = False
    order_index: int = 0
    image_url: Optional[str] = None


class OptionResponse(BaseResponse):
    id: UUID
    text: str
    is_correct: bool
    order_index: int
    image_url: Optional[str] = None


class OptionResponseStudent(BaseResponse):
    """Options without correct flag — shown during exam."""
    id: UUID
    text: str
    order_index: int
    image_url: Optional[str] = None


class QuestionCreate(BaseModel):
    text: str = Field(min_length=5)
    question_type: str
    difficulty: str = "medium"
    topic: Optional[str] = None
    tags: List[str] = []
    explanation: Optional[str] = None
    image_url: Optional[str] = None
    subject_id: Optional[UUID] = None
    options: List[OptionCreate] = []

    @field_validator("question_type")
    @classmethod
    def validate_type(cls, v):
        valid = {"mcq", "true_false", "multi_select", "fill_blank", "subjective", "descriptive"}
        if v not in valid:
            raise ValueError(f"question_type must be one of {valid}")
        return v

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v):
        if v not in ("easy", "medium", "hard"):
            raise ValueError("difficulty must be easy, medium, or hard")
        return v


class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    difficulty: Optional[str] = None
    topic: Optional[str] = None
    tags: Optional[List[str]] = None
    explanation: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    options: Optional[List[OptionCreate]] = None


class QuestionResponse(BaseResponse):
    id: UUID
    text: str
    question_type: str
    difficulty: str
    topic: Optional[str] = None
    tags: List[str] = []
    explanation: Optional[str] = None
    image_url: Optional[str] = None
    subject_id: Optional[UUID] = None
    is_active: bool
    version: int
    created_at: datetime
    options: List[OptionResponse] = []


class QuestionResponseStudent(BaseResponse):
    """Question shown to student during exam — no correct answer."""
    id: UUID
    text: str
    question_type: str
    image_url: Optional[str] = None
    options: List[OptionResponseStudent] = []


# ─── Exams ─────────────────────────────────────────────────────────────────

class ExamSectionCreate(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = None
    order_index: int = 0
    marks: float
    time_limit_minutes: Optional[int] = None
    question_ids: List[UUID] = []
    marks_per_question: Optional[float] = None  # if uniform


class ExamSectionResponse(BaseResponse):
    id: UUID
    name: str
    description: Optional[str] = None
    order_index: int
    marks: float
    time_limit_minutes: Optional[int] = None


class ExamCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: int = Field(gt=0, le=480)
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    total_marks: float = Field(gt=0)
    passing_marks: float = Field(gt=0)
    negative_marking: bool = False
    negative_marks_per_wrong: float = 0.25
    randomize_questions: bool = False
    randomize_options: bool = False
    show_result_immediately: bool = True
    allow_review: bool = True
    max_attempts: int = 1
    full_screen_required: bool = True
    tab_switch_detection: bool = True
    copy_paste_disabled: bool = True
    max_tab_switches_allowed: int = 3
    subject_id: Optional[UUID] = None
    sections: List[ExamSectionCreate] = []

    @model_validator(mode="after")
    def validate_passing_marks(self):
        if self.passing_marks > self.total_marks:
            raise ValueError("Passing marks cannot exceed total marks")
        return self


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    duration_minutes: Optional[int] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    total_marks: Optional[float] = None
    passing_marks: Optional[float] = None
    negative_marking: Optional[bool] = None
    randomize_questions: Optional[bool] = None
    randomize_options: Optional[bool] = None
    show_result_immediately: Optional[bool] = None
    full_screen_required: Optional[bool] = None
    tab_switch_detection: Optional[bool] = None
    copy_paste_disabled: Optional[bool] = None
    max_tab_switches_allowed: Optional[int] = None
    status: Optional[str] = None


class ExamResponse(BaseResponse):
    id: UUID
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    status: str
    duration_minutes: int
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    total_marks: float
    passing_marks: float
    negative_marking: bool
    negative_marks_per_wrong: float
    randomize_questions: bool
    randomize_options: bool
    show_result_immediately: bool
    allow_review: bool
    max_attempts: int
    full_screen_required: bool
    tab_switch_detection: bool
    copy_paste_disabled: bool
    max_tab_switches_allowed: int
    subject_id: Optional[UUID] = None
    instructor_id: Optional[UUID] = None
    created_at: datetime
    sections: List[ExamSectionResponse] = []
    subject: Optional[SubjectResponse] = None


class ExamListResponse(BaseResponse):
    id: UUID
    title: str
    status: str
    duration_minutes: int
    scheduled_start: Optional[datetime] = None
    total_marks: float
    passing_marks: float
    subject: Optional[SubjectResponse] = None
    created_at: datetime


# Exam with questions — sent to student when they start
class ExamAttemptStartResponse(BaseModel):
    attempt_id: UUID
    exam_id: UUID
    exam_title: str
    duration_minutes: int
    total_marks: float
    negative_marking: bool
    negative_marks_per_wrong: float
    full_screen_required: bool
    tab_switch_detection: bool
    copy_paste_disabled: bool
    max_tab_switches_allowed: int
    started_at: datetime
    ends_at: datetime
    sections: List[Dict[str, Any]] = []


# ─── Attempts & Answers ────────────────────────────────────────────────────

class SaveAnswerRequest(BaseModel):
    question_id: UUID
    selected_option_id: Optional[UUID] = None
    selected_option_ids: Optional[List[UUID]] = None
    text_answer: Optional[str] = None
    is_marked_for_review: bool = False


class BulkSaveAnswersRequest(BaseModel):
    answers: List[SaveAnswerRequest]


class ProctoringEventRequest(BaseModel):
    event_type: str  # tab_switch | copy_attempt | fullscreen_exit
    description: Optional[str] = None
    metadata: Dict[str, Any] = {}


class SubmitExamRequest(BaseModel):
    attempt_id: UUID


class AttemptResponse(BaseResponse):
    id: UUID
    exam_id: UUID
    student_id: UUID
    status: str
    started_at: datetime
    submitted_at: Optional[datetime] = None
    time_taken_seconds: Optional[int] = None
    tab_switches: int
    copy_attempts: int
    fullscreen_exits: int


# ─── Results ───────────────────────────────────────────────────────────────

class ResultResponse(BaseResponse):
    id: UUID
    exam_id: UUID
    student_id: UUID
    attempt_id: UUID
    total_marks: float
    obtained_marks: float
    percentage: float
    is_passed: bool
    rank: Optional[int] = None
    correct_answers: int
    wrong_answers: int
    unattempted: int
    negative_marks: float
    section_scores: Dict[str, Any] = {}
    is_published: bool
    published_at: Optional[datetime] = None
    created_at: datetime


class DetailedResultResponse(ResultResponse):
    exam: ExamListResponse
    question_wise: List[Dict[str, Any]] = []


# ─── Analytics ─────────────────────────────────────────────────────────────

class StudentAnalytics(BaseModel):
    total_exams: int
    exams_passed: int
    exams_failed: int
    average_score: float
    best_score: float
    current_rank: Optional[int] = None
    score_trend: List[Dict[str, Any]] = []
    subject_performance: List[Dict[str, Any]] = []


class InstructorAnalytics(BaseModel):
    total_exams: int
    total_students: int
    average_pass_rate: float
    average_score: float
    exam_stats: List[Dict[str, Any]] = []
    question_difficulty_stats: List[Dict[str, Any]] = []


class AdminAnalytics(BaseModel):
    total_students: int
    total_instructors: int
    total_exams: int
    total_attempts: int
    overall_pass_rate: float
    monthly_attempts: List[Dict[str, Any]] = []
    subject_stats: List[Dict[str, Any]] = []
    top_performers: List[Dict[str, Any]] = []


# ─── Notifications ─────────────────────────────────────────────────────────

class NotificationResponse(BaseResponse):
    id: UUID
    type: str
    title: str
    message: str
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    # The ORM attribute is `notification_metadata` (mapped to the "metadata"
    # database column — "metadata" itself is reserved on the declarative
    # base), so we read it via validation_alias while still exposing it as
    # `metadata` in the API response.
    metadata: Dict[str, Any] = Field(default_factory=dict, validation_alias="notification_metadata")

    model_config = {"from_attributes": True, "populate_by_name": True}


# ─── Certificates ──────────────────────────────────────────────────────────

class CertificateResponse(BaseResponse):
    id: UUID
    student_id: UUID
    result_id: UUID
    verification_code: str
    issued_at: datetime
    pdf_url: Optional[str] = None
    is_valid: bool


class CertificateVerifyResponse(BaseModel):
    is_valid: bool
    student_name: Optional[str] = None
    exam_title: Optional[str] = None
    score: Optional[float] = None
    percentage: Optional[float] = None
    issued_at: Optional[datetime] = None


# ─── Audit Logs ────────────────────────────────────────────────────────────

class AuditLogResponse(BaseResponse):
    id: UUID
    user_id: Optional[UUID] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    occurred_at: datetime


# ─── Leaderboard ───────────────────────────────────────────────────────────

class LeaderboardEntry(BaseModel):
    rank: int
    student_name: str
    roll_number: Optional[str] = None
    department: Optional[str] = None
    score: float
    percentage: float
    percentile: Optional[float] = None


class LeaderboardResponse(BaseModel):
    exam_id: UUID
    exam_title: str
    entries: List[LeaderboardEntry]
    total_participants: int
