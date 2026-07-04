"""
ExamDesk — Exam Attempt Routes
POST /attempts/{attempt_id}/answers          save/update answer
POST /attempts/{attempt_id}/answers/bulk     batch save
POST /attempts/{attempt_id}/proctoring       log proctoring event
POST /attempts/{attempt_id}/submit           submit exam
GET  /attempts/{attempt_id}                  get attempt details
GET  /attempts/{attempt_id}/answers          get saved answers
"""

from datetime import datetime, timezone, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from api.dependencies import CurrentUser, DB
from models import (
    ExamAttempt, AttemptStatus, StudentAnswer, Question,
    QuestionOption, QuestionType, ProctoringEvent,
    Result, ExamQuestion, Exam, StudentProfile,
    AuditLog, AuditAction,
)
from schemas import (
    AttemptResponse,
    BulkSaveAnswersRequest,
    MessageResponse,
    ProctoringEventRequest,
    SaveAnswerRequest,
)
from services.grading import grade_attempt

router = APIRouter(prefix="/attempts", tags=["Exam Attempts"])


async def _get_attempt_or_404(attempt_id: UUID, student_id: UUID, db) -> ExamAttempt:
    result = await db.execute(
        select(ExamAttempt)
        .options(selectinload(ExamAttempt.exam))
        .where(ExamAttempt.id == attempt_id, ExamAttempt.student_id == student_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return attempt


async def _get_student_id(user, db) -> UUID:
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=400, detail="Student profile not found")
    return profile.id


def _is_expired(attempt: ExamAttempt) -> bool:
    if attempt.status in (AttemptStatus.submitted, AttemptStatus.timed_out):
        return True
    deadline = attempt.started_at + timedelta(minutes=attempt.exam.duration_minutes)
    return datetime.now(timezone.utc) > deadline.replace(tzinfo=timezone.utc)


# ─── Save Single Answer ────────────────────────────────────────────────────

@router.post("/{attempt_id}/answers", response_model=MessageResponse)
async def save_answer(attempt_id: UUID, payload: SaveAnswerRequest, current_user: CurrentUser, db: DB):
    student_id = await _get_student_id(current_user, db)
    attempt = await _get_attempt_or_404(attempt_id, student_id, db)

    if _is_expired(attempt):
        await _auto_submit(attempt, db)
        raise HTTPException(status_code=400, detail="Exam time has expired. Your answers have been auto-submitted.")

    if attempt.status == AttemptStatus.submitted:
        raise HTTPException(status_code=400, detail="Exam already submitted")

    # Upsert answer
    existing = await db.scalar(
        select(StudentAnswer).where(
            StudentAnswer.attempt_id == attempt_id,
            StudentAnswer.question_id == payload.question_id,
        )
    )

    if existing:
        await db.execute(
            update(StudentAnswer)
            .where(StudentAnswer.id == existing.id)
            .values(
                selected_option_id=payload.selected_option_id,
                selected_option_ids=payload.selected_option_ids or [],
                text_answer=payload.text_answer,
                is_marked_for_review=payload.is_marked_for_review,
            )
        )
    else:
        db.add(StudentAnswer(
            attempt_id=attempt_id,
            question_id=payload.question_id,
            selected_option_id=payload.selected_option_id,
            selected_option_ids=payload.selected_option_ids or [],
            text_answer=payload.text_answer,
            is_marked_for_review=payload.is_marked_for_review,
        ))

    return MessageResponse(message="Answer saved")


# ─── Bulk Save Answers ─────────────────────────────────────────────────────

@router.post("/{attempt_id}/answers/bulk", response_model=MessageResponse)
async def bulk_save_answers(attempt_id: UUID, payload: BulkSaveAnswersRequest, current_user: CurrentUser, db: DB):
    student_id = await _get_student_id(current_user, db)
    attempt = await _get_attempt_or_404(attempt_id, student_id, db)

    if attempt.status == AttemptStatus.submitted:
        raise HTTPException(status_code=400, detail="Exam already submitted")

    for ans in payload.answers:
        existing = await db.scalar(
            select(StudentAnswer).where(
                StudentAnswer.attempt_id == attempt_id,
                StudentAnswer.question_id == ans.question_id,
            )
        )
        if existing:
            await db.execute(
                update(StudentAnswer).where(StudentAnswer.id == existing.id).values(
                    selected_option_id=ans.selected_option_id,
                    selected_option_ids=ans.selected_option_ids or [],
                    text_answer=ans.text_answer,
                    is_marked_for_review=ans.is_marked_for_review,
                )
            )
        else:
            db.add(StudentAnswer(
                attempt_id=attempt_id,
                question_id=ans.question_id,
                selected_option_id=ans.selected_option_id,
                selected_option_ids=ans.selected_option_ids or [],
                text_answer=ans.text_answer,
                is_marked_for_review=ans.is_marked_for_review,
            ))

    return MessageResponse(message=f"{len(payload.answers)} answers saved")


# ─── Get Saved Answers ─────────────────────────────────────────────────────

@router.get("/{attempt_id}/answers")
async def get_answers(attempt_id: UUID, current_user: CurrentUser, db: DB):
    student_id = await _get_student_id(current_user, db)
    await _get_attempt_or_404(attempt_id, student_id, db)

    result = await db.execute(
        select(StudentAnswer).where(StudentAnswer.attempt_id == attempt_id)
    )
    answers = result.scalars().all()
    return [
        {
            "question_id": str(a.question_id),
            "selected_option_id": str(a.selected_option_id) if a.selected_option_id else None,
            "selected_option_ids": a.selected_option_ids,
            "text_answer": a.text_answer,
            "is_marked_for_review": a.is_marked_for_review,
        }
        for a in answers
    ]


# ─── Log Proctoring Event ─────────────────────────────────────────────────

@router.post("/{attempt_id}/proctoring", response_model=MessageResponse)
async def log_proctoring_event(attempt_id: UUID, payload: ProctoringEventRequest, current_user: CurrentUser, db: DB):
    student_id = await _get_student_id(current_user, db)
    attempt = await _get_attempt_or_404(attempt_id, student_id, db)

    if attempt.status == AttemptStatus.submitted:
        return MessageResponse(message="Exam already submitted")

    db.add(ProctoringEvent(
        attempt_id=attempt_id,
        event_type=payload.event_type,
        description=payload.description,
        event_metadata=payload.metadata,
    ))

    # Increment counters
    increment_field = None
    if payload.event_type == "tab_switch":
        increment_field = "tab_switches"
    elif payload.event_type == "copy_attempt":
        increment_field = "copy_attempts"
    elif payload.event_type == "fullscreen_exit":
        increment_field = "fullscreen_exits"

    if increment_field:
        current_val = getattr(attempt, increment_field, 0)
        new_val = current_val + 1
        await db.execute(
            update(ExamAttempt).where(ExamAttempt.id == attempt_id)
            .values(**{increment_field: new_val, "suspicious_activity_count": attempt.suspicious_activity_count + 1})
        )

        # Auto-disqualify if too many tab switches.
        # Use the freshly computed count directly instead of re-querying —
        # the attempt object is cached in the session identity map and would
        # otherwise still show the pre-update value here.
        if payload.event_type == "tab_switch" and new_val >= attempt.exam.max_tab_switches_allowed:
            await db.execute(
                update(ExamAttempt).where(ExamAttempt.id == attempt_id)
                .values(status=AttemptStatus.disqualified)
            )

    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.tab_switch if payload.event_type == "tab_switch" else AuditAction.copy_attempt,
        resource_type="attempt",
        resource_id=str(attempt_id),
        description=payload.description,
    ))

    return MessageResponse(message="Event logged")


# ─── Submit Exam ───────────────────────────────────────────────────────────

@router.post("/{attempt_id}/submit")
async def submit_exam(attempt_id: UUID, current_user: CurrentUser, db: DB):
    student_id = await _get_student_id(current_user, db)
    attempt = await _get_attempt_or_404(attempt_id, student_id, db)

    if attempt.status == AttemptStatus.submitted:
        raise HTTPException(status_code=400, detail="Exam already submitted")

    result = await grade_attempt(attempt_id=attempt_id, db=db)

    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.exam_submitted,
        resource_type="attempt",
        resource_id=str(attempt_id),
    ))

    from schemas import ResultResponse
    return ResultResponse.model_validate(result)


# ─── Get Attempt ──────────────────────────────────────────────────────────

@router.get("/{attempt_id}", response_model=AttemptResponse)
async def get_attempt(attempt_id: UUID, current_user: CurrentUser, db: DB):
    student_id = await _get_student_id(current_user, db)
    attempt = await _get_attempt_or_404(attempt_id, student_id, db)
    return AttemptResponse.model_validate(attempt)


# ─── Internal: Auto Submit ────────────────────────────────────────────────

async def _auto_submit(attempt: ExamAttempt, db):
    if attempt.status in (AttemptStatus.submitted, AttemptStatus.timed_out):
        return
    await db.execute(
        update(ExamAttempt).where(ExamAttempt.id == attempt.id)
        .values(status=AttemptStatus.timed_out, submitted_at=datetime.now(timezone.utc))
    )
    await grade_attempt(attempt_id=attempt.id, db=db)
