"""
ExamDesk — Questions Routes
GET    /questions              (paginated, filtered)
POST   /questions              (instructor/admin)
GET    /questions/{id}
PUT    /questions/{id}
DELETE /questions/{id}
POST   /questions/bulk-import  (instructor/admin)
"""

from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload

from api.dependencies import CurrentUser, DB
from models import Question, QuestionOption, DifficultyLevel, QuestionType, AuditLog, AuditAction
from schemas import PaginatedResponse, QuestionCreate, QuestionResponse, QuestionUpdate, MessageResponse

router = APIRouter(prefix="/questions", tags=["Question Bank"])


@router.get("", response_model=PaginatedResponse)
async def list_questions(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    subject_id: UUID = Query(None),
    difficulty: str = Query(None),
    question_type: str = Query(None),
    search: str = Query(None),
    topic: str = Query(None),
):
    query = (
        select(Question)
        .options(selectinload(Question.options), selectinload(Question.subject))
        .where(Question.is_active == True)
    )

    if subject_id:
        query = query.where(Question.subject_id == subject_id)
    if difficulty:
        query = query.where(Question.difficulty == DifficultyLevel(difficulty))
    if question_type:
        query = query.where(Question.question_type == QuestionType(question_type))
    if search:
        query = query.where(Question.text.ilike(f"%{search}%"))
    if topic:
        query = query.where(Question.topic.ilike(f"%{topic}%"))

    query = query.order_by(Question.created_at.desc())
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    questions = result.scalars().all()

    return PaginatedResponse(
        items=[QuestionResponse.model_validate(q) for q in questions],
        total=total, page=page, size=size,
        pages=(total + size - 1) // size,
    )


@router.post("", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(payload: QuestionCreate, current_user: CurrentUser, db: DB):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    from models import InstructorProfile
    instructor_id = None
    if current_user.role.value == "instructor":
        ip = await db.scalar(select(InstructorProfile).where(InstructorProfile.user_id == current_user.id))
        if ip:
            instructor_id = ip.id

    q = Question(
        text=payload.text,
        question_type=QuestionType(payload.question_type),
        difficulty=DifficultyLevel(payload.difficulty),
        topic=payload.topic,
        tags=payload.tags,
        explanation=payload.explanation,
        image_url=payload.image_url,
        subject_id=payload.subject_id,
        created_by_id=instructor_id,
    )
    db.add(q)
    await db.flush()

    for opt_data in payload.options:
        db.add(QuestionOption(
            question_id=q.id,
            text=opt_data.text,
            is_correct=opt_data.is_correct,
            order_index=opt_data.order_index,
            image_url=opt_data.image_url,
        ))

    db.add(AuditLog(user_id=current_user.id, action=AuditAction.question_added, resource_type="question", resource_id=str(q.id)))
    await db.commit()

    result = await db.execute(
        select(Question).options(selectinload(Question.options)).where(Question.id == q.id)
    )
    return QuestionResponse.model_validate(result.scalar_one())


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: UUID, current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(Question).options(selectinload(Question.options)).where(Question.id == question_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return QuestionResponse.model_validate(q)


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(question_id: UUID, payload: QuestionUpdate, current_user: CurrentUser, db: DB):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    update_data = payload.model_dump(exclude_none=True, exclude={"options"})
    if "difficulty" in update_data:
        update_data["difficulty"] = DifficultyLevel(update_data["difficulty"])
    if update_data:
        update_data["version"] = q.version + 1
        await db.execute(update(Question).where(Question.id == question_id).values(**update_data))

    if payload.options is not None:
        # Replace all options
        existing_opts = await db.execute(select(QuestionOption).where(QuestionOption.question_id == question_id))
        for opt in existing_opts.scalars().all():
            await db.delete(opt)
        for opt_data in payload.options:
            db.add(QuestionOption(
                question_id=question_id,
                text=opt_data.text,
                is_correct=opt_data.is_correct,
                order_index=opt_data.order_index,
            ))

    await db.commit()
    result = await db.execute(select(Question).options(selectinload(Question.options)).where(Question.id == question_id))
    return QuestionResponse.model_validate(result.scalar_one())


@router.delete("/{question_id}", response_model=MessageResponse)
async def delete_question(question_id: UUID, current_user: CurrentUser, db: DB):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(select(Question).where(Question.id == question_id))
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.execute(update(Question).where(Question.id == question_id).values(is_active=False))
    await db.commit()
    return MessageResponse(message="Question deactivated")
