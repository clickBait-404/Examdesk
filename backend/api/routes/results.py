"""
ExamDesk — Results Routes
GET /results/me                   student's own results
GET /results/{result_id}          single result detail
GET /results/exam/{exam_id}       all results for an exam (instructor/admin)
POST /results/{result_id}/publish (instructor/admin)
"""

from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from api.dependencies import CurrentUser, DB
from models import (
    Result,
    StudentProfile,
    Exam,
    ExamAttempt,
    Question,
)
from schemas import (
    DetailedResultResponse,
    MessageResponse,
    PaginatedResponse,
    ResultResponse,
)

router = APIRouter(prefix="/results", tags=["Results"])


@router.get("/me", response_model=PaginatedResponse)
async def my_results(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    sp = await db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == current_user.id)
    )

    if not sp:
        raise HTTPException(status_code=400, detail="Student profile not found")

    from sqlalchemy import func

    query = (
        select(Result)
        .options(
            selectinload(Result.exam).selectinload(Exam.subject)
        )
        .where(
            Result.student_id == sp.id,
            Result.is_published == True,
        )
        .order_by(Result.created_at.desc())
    )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))

    results = (
        await db.execute(
            query.offset((page - 1) * size).limit(size)
        )
    ).scalars().all()

    return PaginatedResponse(
        items=[ResultResponse.model_validate(r) for r in results],
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.get("/exam/{exam_id}", response_model=PaginatedResponse)
async def exam_results(
    exam_id: UUID,
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    from sqlalchemy import func

    query = (
        select(Result)
        .options(
            selectinload(Result.exam).selectinload(Exam.subject)
        )
        .where(Result.exam_id == exam_id)
        .order_by(Result.obtained_marks.desc())
    )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))

    results = (
        await db.execute(
            query.offset((page - 1) * size).limit(size)
        )
    ).scalars().all()

    return PaginatedResponse(
        items=[ResultResponse.model_validate(r) for r in results],
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.get("/{result_id}", response_model=DetailedResultResponse)
async def get_result(
    result_id: UUID,
    current_user: CurrentUser,
    db: DB,
):
    result = await db.execute(
        select(Result)
        .options(
            selectinload(Result.exam).selectinload(Exam.subject),
            selectinload(Result.attempt).selectinload(ExamAttempt.answers),
        )
        .where(Result.id == result_id)
    )

    res = result.scalar_one_or_none()

    if not res:
        raise HTTPException(status_code=404, detail="Result not found")

    if current_user.role.value == "student":
        sp = await db.scalar(
            select(StudentProfile).where(
                StudentProfile.user_id == current_user.id
            )
        )

        if not sp or res.student_id != sp.id:
            raise HTTPException(status_code=403, detail="Access denied")

        if not res.is_published:
            raise HTTPException(
                status_code=404,
                detail="Result not yet published",
            )

    question_wise = []

    if res.attempt:
        for ans in res.attempt.answers:
            q = await db.get(Question, ans.question_id)

            if q:
                question_wise.append(
                    {
                        "question_id": str(q.id),
                        "question_text": q.text[:100],
                        "is_correct": ans.is_correct,
                        "marks_awarded": ans.marks_awarded,
                        "is_marked_for_review": ans.is_marked_for_review,
                    }
                )

    response = DetailedResultResponse.model_validate(res)
    response.question_wise = question_wise

    return response


@router.post("/{result_id}/publish", response_model=MessageResponse)
async def publish_result(
    result_id: UUID,
    current_user: CurrentUser,
    db: DB,
):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    res = await db.get(Result, result_id)

    if not res:
        raise HTTPException(status_code=404, detail="Result not found")

    await db.execute(
        update(Result)
        .where(Result.id == result_id)
        .values(
            is_published=True,
            published_at=datetime.now(timezone.utc),
        )
    )

    await db.commit()

    return MessageResponse(message="Result published")


@router.post("/exam/{exam_id}/publish-all", response_model=MessageResponse)
async def publish_all_results(
    exam_id: UUID,
    current_user: CurrentUser,
    db: DB,
):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    now = datetime.now(timezone.utc)

    await db.execute(
        update(Result)
        .where(
            Result.exam_id == exam_id,
            Result.is_published == False,
        )
        .values(
            is_published=True,
            published_at=now,
        )
    )

    await db.commit()

    from services.grading import _update_rankings

    await _update_rankings(exam_id, db)

    await db.commit()

    return MessageResponse(message="All results published")