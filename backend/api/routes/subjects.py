"""
ExamDesk — Subjects Routes
GET    /subjects
POST   /subjects   (instructor/admin)
GET    /subjects/{id}
PUT    /subjects/{id}  (admin)
DELETE /subjects/{id}  (admin)

Audit Logs Routes
GET /audit-logs  (admin)
"""

from uuid import UUID
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select, update

from api.dependencies import CurrentUser, DB, RequireAdmin
from models import Subject, AuditLog
from schemas import MessageResponse, PaginatedResponse, SubjectCreate, SubjectResponse, SubjectUpdate, AuditLogResponse

# ─── Subjects ──────────────────────────────────────────────────────────────
subjects_router = APIRouter(prefix="/subjects", tags=["Subjects"])


@subjects_router.get("", response_model=list)
async def list_subjects(current_user: CurrentUser, db: DB, active_only: bool = Query(True)):
    query = select(Subject)
    if active_only:
        query = query.where(Subject.is_active == True)
    result = await db.execute(query.order_by(Subject.name))
    subjects = result.scalars().all()
    return [SubjectResponse.model_validate(s) for s in subjects]


@subjects_router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
async def create_subject(payload: SubjectCreate, current_user: CurrentUser, db: DB):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    existing = await db.scalar(select(Subject).where(Subject.code == payload.code.upper()))
    if existing:
        raise HTTPException(status_code=409, detail="Subject code already exists")

    s = Subject(**payload.model_dump(), code=payload.code.upper())
    db.add(s)
    await db.commit()
    result = await db.execute(select(Subject).where(Subject.id == s.id))
    return SubjectResponse.model_validate(result.scalar_one())


@subjects_router.get("/{subject_id}", response_model=SubjectResponse)
async def get_subject(subject_id: UUID, current_user: CurrentUser, db: DB):
    s = await db.get(Subject, subject_id)
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    return SubjectResponse.model_validate(s)


@subjects_router.put("/{subject_id}", response_model=SubjectResponse)
async def update_subject(subject_id: UUID, payload: SubjectUpdate, _: RequireAdmin, db: DB):
    s = await db.get(Subject, subject_id)
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    update_data = payload.model_dump(exclude_none=True)
    if update_data:
        await db.execute(update(Subject).where(Subject.id == subject_id).values(**update_data))
        await db.commit()
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    return SubjectResponse.model_validate(result.scalar_one())


@subjects_router.delete("/{subject_id}", response_model=MessageResponse)
async def delete_subject(subject_id: UUID, _: RequireAdmin, db: DB):
    s = await db.get(Subject, subject_id)
    if not s:
        raise HTTPException(status_code=404, detail="Subject not found")
    await db.execute(update(Subject).where(Subject.id == subject_id).values(is_active=False))
    await db.commit()
    return MessageResponse(message="Subject deactivated")


# ─── Audit Logs ────────────────────────────────────────────────────────────
audit_router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@audit_router.get("", response_model=PaginatedResponse)
async def list_audit_logs(
    _: RequireAdmin,
    db: DB,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    action: str = Query(None),
    user_id: UUID = Query(None),
):
    query = select(AuditLog).order_by(AuditLog.occurred_at.desc())

    if action:
        from models import AuditAction
        query = query.where(AuditLog.action == AuditAction(action))
    if user_id:
        query = query.where(AuditLog.user_id == user_id)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    logs = result.scalars().all()

    return PaginatedResponse(
        items=[AuditLogResponse.model_validate(l) for l in logs],
        total=total, page=page, size=size,
        pages=(total + size - 1) // size,
    )
