"""
ExamDesk — Exam Routes
GET    /exams                  (all authenticated)
POST   /exams                  (instructor/admin)
GET    /exams/{id}             (all authenticated)
PUT    /exams/{id}             (instructor/admin)
DELETE /exams/{id}             (instructor/admin)
POST   /exams/{id}/publish     (instructor/admin)
POST   /exams/{id}/clone       (instructor/admin)
GET    /exams/{id}/questions   (student — during attempt only)
POST   /exams/{id}/start       (student)
"""

import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload

from api.dependencies import CurrentUser, DB, RequireInstructor
from models import (
    Exam, ExamSection, ExamQuestion, ExamAttempt, ExamStatus,
    AttemptStatus, Question, AuditLog, AuditAction,
)
from schemas import (
    ExamAttemptStartResponse,
    ExamCreate,
    ExamListResponse,
    ExamResponse,
    ExamUpdate,
    MessageResponse,
    PaginatedResponse,
)

router = APIRouter(prefix="/exams", tags=["Exams"])


# ─── Helpers ───────────────────────────────────────────────────────────────

def _exam_end_time(exam: Exam) -> datetime | None:
    """
    The moment an exam should stop being considered 'live', regardless
    of whether any attempt has actually been submitted. Prefers the
    explicit scheduled_end if set; otherwise derives it from
    scheduled_start + duration_minutes. Returns None if there's not
    enough info to know (e.g. no scheduled_start at all).
    """
    if exam.scheduled_end:
        return exam.scheduled_end
    if exam.scheduled_start:
        return exam.scheduled_start + timedelta(minutes=exam.duration_minutes)
    return None


async def _auto_complete_stale_exams(db) -> None:
    """
    The exam lifecycle (draft -> published -> live -> completed) only
    ever advances on explicit actions: publish, a student starting an
    attempt, or a manual update. Nothing previously checked the clock,
    so an exam whose scheduled window had already passed stayed stuck
    on 'live' or 'published' forever — which is why the dashboard kept
    showing exams as live long after their scheduled time.

    This runs a lightweight check before every list/get: find
    published/live exams whose end time has passed, and flip them to
    completed. It's called inline (not a background job) so the fix
    applies immediately on the next request without needing a
    scheduler — cheap enough since it only touches exams that are
    already overdue.
    """
    candidates_result = await db.execute(
        select(Exam).where(Exam.status.in_([ExamStatus.published, ExamStatus.live]))
    )
    candidates = candidates_result.scalars().all()

    now = datetime.now(timezone.utc)
    stale_ids = [e.id for e in candidates if (end := _exam_end_time(e)) and end < now]

    if stale_ids:
        await db.execute(
            update(Exam).where(Exam.id.in_(stale_ids)).values(status=ExamStatus.completed)
        )
        await db.commit()


async def _get_exam_or_404(exam_id: UUID, db) -> Exam:
    result = await db.execute(
        select(Exam)
        .options(
            selectinload(Exam.sections).selectinload(ExamSection.exam_questions),
            selectinload(Exam.subject),
        )
        .where(Exam.id == exam_id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


async def _get_instructor_profile_id(user, db) -> UUID:
    from models import InstructorProfile
    from sqlalchemy import select
    result = await db.execute(
        select(InstructorProfile).where(InstructorProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=403, detail="Instructor profile not found")
    return profile.id


async def _require_exam_owner(exam: Exam, current_user, db) -> None:
    """
    Enforces that only an admin, or the instructor who owns this exam,
    can modify it. Without this, any authenticated instructor/admin
    role-check alone would still let one instructor edit another
    instructor's exam.
    """
    if current_user.role.value == "admin":
        return
    owner_instructor_id = await _get_instructor_profile_id(current_user, db)
    if exam.instructor_id != owner_instructor_id:
        raise HTTPException(status_code=403, detail="You do not own this exam")


# ─── List Exams ────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse)
async def list_exams(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status_filter: str = Query(None, alias="status"),
    subject_id: UUID = Query(None),
    search: str = Query(None),
):
    await _auto_complete_stale_exams(db)

    query = select(Exam).options(selectinload(Exam.subject))

    # Students only see published/live/completed
    if current_user.role.value == "student":
        query = query.where(Exam.status.in_([ExamStatus.published, ExamStatus.live, ExamStatus.completed]))
    elif current_user.role.value == "instructor":
        from models import InstructorProfile
        result = await db.execute(select(InstructorProfile).where(InstructorProfile.user_id == current_user.id))
        profile = result.scalar_one_or_none()
        if profile:
            query = query.where(Exam.instructor_id == profile.id)

    if status_filter:
        query = query.where(Exam.status == ExamStatus(status_filter))
    if subject_id:
        query = query.where(Exam.subject_id == subject_id)
    if search:
        query = query.where(Exam.title.ilike(f"%{search}%"))

    query = query.order_by(Exam.created_at.desc())
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    exams = result.scalars().all()

    return PaginatedResponse(
        items=[ExamListResponse.model_validate(e) for e in exams],
        total=total, page=page, size=size,
        pages=(total + size - 1) // size,
    )


# ─── Create Exam ───────────────────────────────────────────────────────────

@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
async def create_exam(payload: ExamCreate, current_user: CurrentUser, db: DB):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Only instructors and admins can create exams")

    instructor_id = None
    if current_user.role.value == "instructor":
        instructor_id = await _get_instructor_profile_id(current_user, db)

    exam = Exam(
        title=payload.title,
        description=payload.description,
        instructions=payload.instructions,
        duration_minutes=payload.duration_minutes,
        scheduled_start=payload.scheduled_start,
        scheduled_end=payload.scheduled_end,
        total_marks=payload.total_marks,
        passing_marks=payload.passing_marks,
        negative_marking=payload.negative_marking,
        negative_marks_per_wrong=payload.negative_marks_per_wrong,
        randomize_questions=payload.randomize_questions,
        randomize_options=payload.randomize_options,
        show_result_immediately=payload.show_result_immediately,
        allow_review=payload.allow_review,
        max_attempts=payload.max_attempts,
        full_screen_required=payload.full_screen_required,
        tab_switch_detection=payload.tab_switch_detection,
        copy_paste_disabled=payload.copy_paste_disabled,
        max_tab_switches_allowed=payload.max_tab_switches_allowed,
        subject_id=payload.subject_id,
        instructor_id=instructor_id,
        status=ExamStatus.draft,
    )
    db.add(exam)
    await db.flush()

    for sec_data in payload.sections:
        section = ExamSection(
            exam_id=exam.id,
            name=sec_data.name,
            description=sec_data.description,
            order_index=sec_data.order_index,
            marks=sec_data.marks,
            time_limit_minutes=sec_data.time_limit_minutes,
        )
        db.add(section)
        await db.flush()

        for idx, q_id in enumerate(sec_data.question_ids):
            marks = sec_data.marks_per_question or (sec_data.marks / len(sec_data.question_ids)) if sec_data.question_ids else 1.0
            eq = ExamQuestion(
                exam_id=exam.id,
                section_id=section.id,
                question_id=q_id,
                order_index=idx,
                marks=marks,
            )
            db.add(eq)

    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.exam_created,
        resource_type="exam",
        resource_id=str(exam.id),
        description=f"Created exam: {exam.title}",
    ))
    await db.commit()
    return ExamResponse.model_validate(await _get_exam_or_404(exam.id, db))


# ─── Get Exam ──────────────────────────────────────────────────────────────

@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(exam_id: UUID, current_user: CurrentUser, db: DB):
    await _auto_complete_stale_exams(db)

    exam = await _get_exam_or_404(exam_id, db)

    if current_user.role.value == "student":
        if exam.status not in (ExamStatus.published, ExamStatus.live, ExamStatus.completed):
            raise HTTPException(status_code=404, detail="Exam not found")

    return ExamResponse.model_validate(exam)


# ─── Update Exam ───────────────────────────────────────────────────────────

@router.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(exam_id: UUID, payload: ExamUpdate, current_user: RequireInstructor, db: DB):
    exam = await _get_exam_or_404(exam_id, db)
    await _require_exam_owner(exam, current_user, db)

    if exam.status in (ExamStatus.live, ExamStatus.completed, ExamStatus.cancelled):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit a {exam.status.value} exam",
        )

    # ExamUpdate's own validator only catches passing_marks > total_marks
    # when BOTH are present in this request. Cross-check against the
    # exam's current (pre-update) value too, so setting just one field
    # can't slip past into an invalid state either.
    effective_total = payload.total_marks if payload.total_marks is not None else exam.total_marks
    effective_passing = payload.passing_marks if payload.passing_marks is not None else exam.passing_marks
    if effective_passing > effective_total:
        raise HTTPException(status_code=422, detail="Passing marks cannot exceed total marks")

    # sections replace the existing question selection wholesale when
    # provided; handled separately since it's a list of models, not a
    # column this ORM UPDATE can set directly.
    update_data = payload.model_dump(exclude_none=True, exclude={"sections"})
    if update_data:
        if "status" in update_data:
            update_data["status"] = ExamStatus(update_data["status"])
        await db.execute(update(Exam).where(Exam.id == exam_id).values(**update_data))

    if payload.sections is not None:
        # Drop existing sections (cascades to their exam_questions) and
        # rebuild from the submitted list, mirroring create_exam's logic.
        for section in list(exam.sections):
            await db.delete(section)
        await db.flush()

        for sec_data in payload.sections:
            section = ExamSection(
                exam_id=exam.id,
                name=sec_data.name,
                description=sec_data.description,
                order_index=sec_data.order_index,
                marks=sec_data.marks,
                time_limit_minutes=sec_data.time_limit_minutes,
            )
            db.add(section)
            await db.flush()

            for idx, q_id in enumerate(sec_data.question_ids):
                marks = sec_data.marks_per_question or (
                    sec_data.marks / len(sec_data.question_ids) if sec_data.question_ids else 1.0
                )
                db.add(ExamQuestion(
                    exam_id=exam.id,
                    section_id=section.id,
                    question_id=q_id,
                    order_index=idx,
                    marks=marks,
                ))

    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.exam_updated,
        resource_type="exam",
        resource_id=str(exam_id),
        description=f"Updated exam: {exam.title}",
    ))
    await db.commit()

    return ExamResponse.model_validate(await _get_exam_or_404(exam_id, db))


# ─── Delete Exam ───────────────────────────────────────────────────────────

@router.delete("/{exam_id}", response_model=MessageResponse)
async def delete_exam(exam_id: UUID, current_user: RequireInstructor, db: DB):
    exam = await _get_exam_or_404(exam_id, db)
    await _require_exam_owner(exam, current_user, db)
    if exam.status == ExamStatus.live:
        raise HTTPException(status_code=400, detail="Cannot delete a live exam")
    await db.delete(exam)
    await db.commit()
    return MessageResponse(message="Exam deleted")


# ─── Publish Exam ──────────────────────────────────────────────────────────

@router.post("/{exam_id}/publish", response_model=ExamResponse)
async def publish_exam(exam_id: UUID, current_user: CurrentUser, db: DB):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    exam = await _get_exam_or_404(exam_id, db)
    await _require_exam_owner(exam, current_user, db)
    if exam.status != ExamStatus.draft:
        raise HTTPException(status_code=400, detail=f"Cannot publish exam with status '{exam.status.value}'")

    total_questions = sum(len(s.exam_questions) for s in exam.sections)
    if total_questions == 0:
        raise HTTPException(status_code=400, detail="Exam must have at least one question")

    await db.execute(update(Exam).where(Exam.id == exam_id).values(status=ExamStatus.published))
    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.exam_published,
        resource_type="exam",
        resource_id=str(exam_id),
    ))
    await db.commit()
    return ExamResponse.model_validate(await _get_exam_or_404(exam_id, db))


# ─── Clone Exam ────────────────────────────────────────────────────────────

@router.post("/{exam_id}/clone", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
async def clone_exam(exam_id: UUID, current_user: CurrentUser, db: DB):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    source = await _get_exam_or_404(exam_id, db)

    instructor_id = None
    if current_user.role.value == "instructor":
        instructor_id = await _get_instructor_profile_id(current_user, db)

    clone = Exam(
        title=f"[Copy] {source.title}",
        description=source.description,
        instructions=source.instructions,
        duration_minutes=source.duration_minutes,
        scheduled_start=source.scheduled_start,
        scheduled_end=source.scheduled_end,
        total_marks=source.total_marks,
        passing_marks=source.passing_marks,
        negative_marking=source.negative_marking,
        negative_marks_per_wrong=source.negative_marks_per_wrong,
        randomize_questions=source.randomize_questions,
        randomize_options=source.randomize_options,
        show_result_immediately=source.show_result_immediately,
        allow_review=source.allow_review,
        max_attempts=source.max_attempts,
        full_screen_required=source.full_screen_required,
        tab_switch_detection=source.tab_switch_detection,
        copy_paste_disabled=source.copy_paste_disabled,
        max_tab_switches_allowed=source.max_tab_switches_allowed,
        subject_id=source.subject_id,
        instructor_id=instructor_id,
        status=ExamStatus.draft,
    )
    db.add(clone)
    await db.flush()

    for section in source.sections:
        new_section = ExamSection(
            exam_id=clone.id,
            name=section.name,
            description=section.description,
            order_index=section.order_index,
            marks=section.marks,
            time_limit_minutes=section.time_limit_minutes,
        )
        db.add(new_section)
        await db.flush()
        for eq in section.exam_questions:
            db.add(ExamQuestion(
                exam_id=clone.id,
                section_id=new_section.id,
                question_id=eq.question_id,
                order_index=eq.order_index,
                marks=eq.marks,
                is_compulsory=eq.is_compulsory,
            ))

    await db.commit()
    return ExamResponse.model_validate(await _get_exam_or_404(clone.id, db))


# ─── Start Exam (Student) ─────────────────────────────────────────────────

@router.post("/{exam_id}/start", response_model=ExamAttemptStartResponse)
async def start_exam(exam_id: UUID, current_user: CurrentUser, db: DB, request=None):
    if current_user.role.value != "student":
        raise HTTPException(status_code=403, detail="Only students can start exams")

    exam = await _get_exam_or_404(exam_id, db)
    if exam.status not in (ExamStatus.published, ExamStatus.live):
        raise HTTPException(status_code=400, detail="Exam is not available")

    end_time = _exam_end_time(exam)
    if end_time and datetime.now(timezone.utc) > end_time:
        await db.execute(update(Exam).where(Exam.id == exam_id).values(status=ExamStatus.completed))
        await db.commit()
        raise HTTPException(status_code=400, detail="Exam window has closed")

    from models import StudentProfile
    sp_result = await db.execute(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    student = sp_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=400, detail="Student profile not found")

    # Check existing attempt
    existing = await db.scalar(
        select(ExamAttempt).where(
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.student_id == student.id,
        )
    )
    if existing:
        if existing.status == AttemptStatus.submitted:
            raise HTTPException(status_code=400, detail="Exam already submitted")
        if existing.status in (AttemptStatus.started, AttemptStatus.in_progress):
            # Resume existing attempt
            attempt = existing
        else:
            raise HTTPException(status_code=400, detail="Cannot restart this exam")
    else:
        # Collect all questions across sections
        all_questions: List[UUID] = []
        for section in exam.sections:
            q_ids = [eq.question_id for eq in section.exam_questions]
            if exam.randomize_questions:
                random.shuffle(q_ids)
            all_questions.extend(q_ids)

        attempt = ExamAttempt(
            exam_id=exam.id,
            student_id=student.id,
            status=AttemptStatus.in_progress,
            question_order=[str(q) for q in all_questions],
        )
        db.add(attempt)
        await db.flush()

        if exam.status == ExamStatus.published:
            await db.execute(update(Exam).where(Exam.id == exam_id).values(status=ExamStatus.live))

        db.add(AuditLog(
            user_id=current_user.id,
            action=AuditAction.exam_started,
            resource_type="exam",
            resource_id=str(exam_id),
        ))
        await db.commit()

    from datetime import timedelta
    ends_at = attempt.started_at + timedelta(minutes=exam.duration_minutes)

    # Build sections with questions (no correct answers)
    sections_data: List[Dict[str, Any]] = []
    for section in exam.sections:
        questions_data = []
        for eq in section.exam_questions:
            q_result = await db.execute(
                select(Question)
                .options(selectinload(Question.options))
                .where(Question.id == eq.question_id)
            )
            q = q_result.scalar_one_or_none()
            if q:
                options = list(q.options)
                if exam.randomize_options:
                    random.shuffle(options)
                questions_data.append({
                    "id": str(q.id),
                    "text": q.text,
                    "question_type": q.question_type.value,
                    "image_url": q.image_url,
                    "marks": eq.marks,
                    "order_index": eq.order_index,
                    "options": [
                        {
                            "id": str(o.id),
                            "text": o.text,
                            "order_index": o.order_index,
                            "image_url": o.image_url,
                        }
                        for o in options
                    ],
                })
        sections_data.append({
            "id": str(section.id),
            "name": section.name,
            "marks": section.marks,
            "time_limit_minutes": section.time_limit_minutes,
            "questions": questions_data,
        })

    return ExamAttemptStartResponse(
        attempt_id=attempt.id,
        exam_id=exam.id,
        exam_title=exam.title,
        duration_minutes=exam.duration_minutes,
        total_marks=exam.total_marks,
        negative_marking=exam.negative_marking,
        negative_marks_per_wrong=exam.negative_marks_per_wrong,
        full_screen_required=exam.full_screen_required,
        tab_switch_detection=exam.tab_switch_detection,
        copy_paste_disabled=exam.copy_paste_disabled,
        max_tab_switches_allowed=exam.max_tab_switches_allowed,
        started_at=attempt.started_at,
        ends_at=ends_at,
        sections=sections_data,
    )
