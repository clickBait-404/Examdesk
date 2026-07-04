"""
ExamDesk — Complete SQLAlchemy ORM Models
Full normalized schema covering all platform entities.
"""

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Integer, JSON, String, Text, UniqueConstraint, Index,
    func, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped

from database.session import Base


# ─── Enums ─────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    student = "student"
    instructor = "instructor"
    admin = "admin"


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    suspended = "suspended"


class QuestionType(str, enum.Enum):
    mcq = "mcq"
    true_false = "true_false"
    multi_select = "multi_select"
    fill_blank = "fill_blank"
    subjective = "subjective"
    descriptive = "descriptive"


class DifficultyLevel(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class ExamStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    live = "live"
    completed = "completed"
    cancelled = "cancelled"


class AttemptStatus(str, enum.Enum):
    started = "started"
    in_progress = "in_progress"
    submitted = "submitted"
    timed_out = "timed_out"
    disqualified = "disqualified"


class NotificationType(str, enum.Enum):
    exam_scheduled = "exam_scheduled"
    exam_reminder = "exam_reminder"
    result_published = "result_published"
    certificate_issued = "certificate_issued"
    announcement = "announcement"
    system = "system"


class AuditAction(str, enum.Enum):
    login = "login"
    logout = "logout"
    exam_started = "exam_started"
    exam_submitted = "exam_submitted"
    tab_switch = "tab_switch"
    copy_attempt = "copy_attempt"
    fullscreen_exit = "fullscreen_exit"
    result_published = "result_published"
    user_created = "user_created"
    user_updated = "user_updated"
    exam_created = "exam_created"
    exam_published = "exam_published"
    question_added = "question_added"


# ─── Mixins ────────────────────────────────────────────────────────────────

class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class UUIDMixin:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)


# ─── Users ─────────────────────────────────────────────────────────────────

class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.active, nullable=False)
    phone = Column(String(20), nullable=True)
    profile_picture = Column(String(512), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)
    email_verified = Column(Boolean, default=False)

    # Relationships
    student_profile = relationship("StudentProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    instructor_profile = relationship("InstructorProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_role_status", "role", "status"),
    )


class StudentProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "student_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    roll_number = Column(String(50), unique=True, nullable=True)
    department = Column(String(100), nullable=True)
    semester = Column(Integer, nullable=True)
    batch_year = Column(Integer, nullable=True)
    date_of_birth = Column(DateTime, nullable=True)
    address = Column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="student_profile")
    exam_attempts = relationship("ExamAttempt", back_populates="student", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="student", cascade="all, delete-orphan")
    rankings = relationship("Ranking", back_populates="student", cascade="all, delete-orphan")


class InstructorProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "instructor_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department = Column(String(100), nullable=True)
    designation = Column(String(100), nullable=True)
    employee_id = Column(String(50), unique=True, nullable=True)
    specialization = Column(String(255), nullable=True)

    # Relationships
    user = relationship("User", back_populates="instructor_profile")
    exams = relationship("Exam", back_populates="instructor", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="created_by")


# ─── Subjects ──────────────────────────────────────────────────────────────

class Subject(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subjects"

    name = Column(String(255), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    department = Column(String(100), nullable=True)
    credits = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    questions = relationship("Question", back_populates="subject")
    exams = relationship("Exam", back_populates="subject")


# ─── Questions ─────────────────────────────────────────────────────────────

class Question(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "questions"

    text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False)
    difficulty = Column(Enum(DifficultyLevel), nullable=False, default=DifficultyLevel.medium)
    topic = Column(String(255), nullable=True)
    tags = Column(JSON, default=list)            # ["networking", "tcp"]
    explanation = Column(Text, nullable=True)   # shown after exam
    version = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    image_url = Column(String(512), nullable=True)

    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("instructor_profiles.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    subject = relationship("Subject", back_populates="questions")
    created_by = relationship("InstructorProfile", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan", order_by="QuestionOption.order_index")
    exam_questions = relationship("ExamQuestion", back_populates="question")
    answers = relationship("StudentAnswer", back_populates="question")

    __table_args__ = (
        Index("ix_questions_subject_difficulty", "subject_id", "difficulty"),
        Index("ix_questions_type", "question_type"),
    )


class QuestionOption(Base, UUIDMixin):
    __tablename__ = "question_options"

    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    image_url = Column(String(512), nullable=True)

    # Relationships
    question = relationship("Question", back_populates="options")

    __table_args__ = (
        Index("ix_options_question_id", "question_id"),
    )


# ─── Exams ─────────────────────────────────────────────────────────────────

class Exam(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exams"

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    status = Column(Enum(ExamStatus), default=ExamStatus.draft, nullable=False)

    # Timing
    duration_minutes = Column(Integer, nullable=False)
    scheduled_start = Column(DateTime(timezone=True), nullable=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=True)
    actual_start = Column(DateTime(timezone=True), nullable=True)
    actual_end = Column(DateTime(timezone=True), nullable=True)

    # Scoring
    total_marks = Column(Float, nullable=False)
    passing_marks = Column(Float, nullable=False)
    negative_marking = Column(Boolean, default=False)
    negative_marks_per_wrong = Column(Float, default=0.25)

    # Behaviour
    randomize_questions = Column(Boolean, default=False)
    randomize_options = Column(Boolean, default=False)
    show_result_immediately = Column(Boolean, default=True)
    allow_review = Column(Boolean, default=True)
    max_attempts = Column(Integer, default=1)

    # Proctoring
    full_screen_required = Column(Boolean, default=True)
    tab_switch_detection = Column(Boolean, default=True)
    copy_paste_disabled = Column(Boolean, default=True)
    max_tab_switches_allowed = Column(Integer, default=3)

    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    instructor_id = Column(UUID(as_uuid=True), ForeignKey("instructor_profiles.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    subject = relationship("Subject", back_populates="exams")
    instructor = relationship("InstructorProfile", back_populates="exams")
    sections = relationship("ExamSection", back_populates="exam", cascade="all, delete-orphan", order_by="ExamSection.order_index")
    attempts = relationship("ExamAttempt", back_populates="exam", cascade="all, delete-orphan")
    results = relationship("Result", back_populates="exam", cascade="all, delete-orphan")
    rankings = relationship("Ranking", back_populates="exam", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_exams_status", "status"),
        Index("ix_exams_instructor", "instructor_id"),
        Index("ix_exams_scheduled", "scheduled_start"),
    )


class ExamSection(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exam_sections"

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    marks = Column(Float, nullable=False)
    time_limit_minutes = Column(Integer, nullable=True)  # per-section timer

    # Relationships
    exam = relationship("Exam", back_populates="sections")
    exam_questions = relationship("ExamQuestion", back_populates="section", cascade="all, delete-orphan")


class ExamQuestion(Base, UUIDMixin):
    __tablename__ = "exam_questions"

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("exam_sections.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    marks = Column(Float, nullable=False)
    is_compulsory = Column(Boolean, default=True)

    # Relationships
    exam = relationship("Exam")
    section = relationship("ExamSection", back_populates="exam_questions")
    question = relationship("Question", back_populates="exam_questions")

    __table_args__ = (
        UniqueConstraint("exam_id", "question_id", name="uq_exam_question"),
        Index("ix_exam_questions_exam", "exam_id"),
    )


# ─── Attempts ──────────────────────────────────────────────────────────────

class ExamAttempt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "exam_attempts"

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(AttemptStatus), default=AttemptStatus.started, nullable=False)

    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    time_taken_seconds = Column(Integer, nullable=True)

    # Proctoring
    tab_switches = Column(Integer, default=0)
    copy_attempts = Column(Integer, default=0)
    fullscreen_exits = Column(Integer, default=0)
    suspicious_activity_count = Column(Integer, default=0)
    ip_address = Column(String(50), nullable=True)
    browser_info = Column(String(500), nullable=True)

    # Question order (for randomization, stored per attempt)
    question_order = Column(JSON, default=list)

    # Relationships
    exam = relationship("Exam", back_populates="attempts")
    student = relationship("StudentProfile", back_populates="exam_attempts")
    answers = relationship("StudentAnswer", back_populates="attempt", cascade="all, delete-orphan")
    result = relationship("Result", back_populates="attempt", uselist=False)
    proctoring_events = relationship("ProctoringEvent", back_populates="attempt", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_attempt_exam_student"),
        Index("ix_attempts_exam_status", "exam_id", "status"),
    )


class StudentAnswer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "student_answers"

    attempt_id = Column(UUID(as_uuid=True), ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    selected_option_id = Column(UUID(as_uuid=True), ForeignKey("question_options.id", ondelete="SET NULL"), nullable=True)
    selected_option_ids = Column(JSON, default=list)  # multi-select
    text_answer = Column(Text, nullable=True)          # subjective / fill-blank
    is_marked_for_review = Column(Boolean, default=False)
    is_correct = Column(Boolean, nullable=True)        # null = not yet evaluated
    marks_awarded = Column(Float, nullable=True)
    evaluated_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    attempt = relationship("ExamAttempt", back_populates="answers")
    question = relationship("Question", back_populates="answers")

    __table_args__ = (
        UniqueConstraint("attempt_id", "question_id", name="uq_answer_attempt_question"),
        Index("ix_answers_attempt", "attempt_id"),
    )


# ─── Results ───────────────────────────────────────────────────────────────

class Result(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "results"

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("exam_attempts.id", ondelete="CASCADE"), unique=True, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)

    total_marks = Column(Float, nullable=False)
    obtained_marks = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False)
    is_passed = Column(Boolean, nullable=False)
    rank = Column(Integer, nullable=True)

    correct_answers = Column(Integer, default=0)
    wrong_answers = Column(Integer, default=0)
    unattempted = Column(Integer, default=0)
    negative_marks = Column(Float, default=0.0)

    section_scores = Column(JSON, default=dict)        # {section_id: score}
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    revaluation_requested = Column(Boolean, default=False)

    # Relationships
    exam = relationship("Exam", back_populates="results")
    attempt = relationship("ExamAttempt", back_populates="result")
    student = relationship("StudentProfile")
    certificate = relationship("Certificate", back_populates="result", uselist=False)

    __table_args__ = (
        Index("ix_results_exam_student", "exam_id", "student_id"),
    )


# ─── Rankings ──────────────────────────────────────────────────────────────

class Ranking(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "rankings"

    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    rank = Column(Integer, nullable=False)
    score = Column(Float, nullable=False)
    percentile = Column(Float, nullable=True)

    # Relationships
    exam = relationship("Exam", back_populates="rankings")
    student = relationship("StudentProfile", back_populates="rankings")

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_ranking_exam_student"),
        Index("ix_rankings_exam_rank", "exam_id", "rank"),
    )


# ─── Certificates ──────────────────────────────────────────────────────────

class Certificate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "certificates"

    student_id = Column(UUID(as_uuid=True), ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    result_id = Column(UUID(as_uuid=True), ForeignKey("results.id", ondelete="CASCADE"), unique=True, nullable=False)
    verification_code = Column(String(50), unique=True, nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    pdf_url = Column(String(512), nullable=True)
    is_valid = Column(Boolean, default=True, nullable=False)

    # Relationships
    student = relationship("StudentProfile", back_populates="certificates")
    result = relationship("Result", back_populates="certificate")


# ─── Notifications ─────────────────────────────────────────────────────────

class Notification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notifications"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    notification_metadata = Column("metadata", JSON, default=dict)   # exam_id, result_id etc.

    # Relationships
    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read"),
    )


# ─── Proctoring Events ─────────────────────────────────────────────────────

class ProctoringEvent(Base, UUIDMixin):
    __tablename__ = "proctoring_events"

    attempt_id = Column(UUID(as_uuid=True), ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False)   # tab_switch, copy, fullscreen_exit
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    description = Column(String(500), nullable=True)
    event_metadata = Column("metadata", JSON, default=dict)

    # Relationships
    attempt = relationship("ExamAttempt", back_populates="proctoring_events")

    __table_args__ = (
        Index("ix_proctoring_attempt", "attempt_id"),
    )


# ─── Audit Logs ────────────────────────────────────────────────────────────

class AuditLog(Base, UUIDMixin):
    __tablename__ = "audit_logs"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(Enum(AuditAction), nullable=False)
    resource_type = Column(String(50), nullable=True)  # "exam", "user", "question"
    resource_id = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    extra = Column(JSON, default=dict)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_logs_user", "user_id"),
        Index("ix_audit_logs_action", "action"),
        Index("ix_audit_logs_occurred_at", "occurred_at"),
    )
