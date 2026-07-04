"""
ExamDesk — User Management Routes
GET    /users                (admin)
POST   /users                (admin)
GET    /users/{id}           (admin | self)
PUT    /users/{id}           (admin | self)
DELETE /users/{id}           (admin)
PATCH  /users/{id}/status    (admin)
POST   /users/bulk           (admin)
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import selectinload

from api.dependencies import CurrentUser, DB, RequireAdmin
from models import User, UserRole, UserStatus, StudentProfile, InstructorProfile
from schemas import (
    BulkUserCreate,
    MessageResponse,
    PaginatedResponse,
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
from auth.security import hash_password

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=PaginatedResponse)
async def list_users(
    _: RequireAdmin,
    db: DB,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    role: str = Query(None),
    status_filter: str = Query(None, alias="status"),
    search: str = Query(None),
):
    query = select(User)

    if role:
        query = query.where(User.role == UserRole(role))
    if status_filter:
        query = query.where(User.status == UserStatus(status_filter))
    if search:
        query = query.where(User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    users = result.scalars().all()

    return PaginatedResponse(
        items=[UserListResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, _: RequireAdmin, db: DB):
    existing = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole(payload.role),
        phone=payload.phone,
    )
    db.add(user)
    await db.flush()

    if payload.role == "student" and payload.student_profile:
        db.add(StudentProfile(user_id=user.id, **payload.student_profile.model_dump()))
    elif payload.role == "instructor" and payload.instructor_profile:
        db.add(InstructorProfile(user_id=user.id, **payload.instructor_profile.model_dump()))

    await db.commit()
    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile), selectinload(User.instructor_profile))
        .where(User.id == user.id)
    )
    return UserResponse.model_validate(result.scalar_one())


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: UUID, current_user: CurrentUser, db: DB):
    if current_user.role.value != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile), selectinload(User.instructor_profile))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: UUID, payload: UserUpdate, current_user: CurrentUser, db: DB):
    if current_user.role.value != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = payload.model_dump(exclude_none=True, exclude={"student_profile", "instructor_profile"})
    if update_data:
        await db.execute(update(User).where(User.id == user_id).values(**update_data))

    if payload.student_profile:
        sp_data = payload.student_profile.model_dump(exclude_none=True)
        if sp_data:
            result2 = await db.execute(select(StudentProfile).where(StudentProfile.user_id == user_id))
            sp = result2.scalar_one_or_none()
            if sp:
                await db.execute(update(StudentProfile).where(StudentProfile.user_id == user_id).values(**sp_data))

    if payload.instructor_profile:
        ip_data = payload.instructor_profile.model_dump(exclude_none=True)
        if ip_data:
            result2 = await db.execute(select(InstructorProfile).where(InstructorProfile.user_id == user_id))
            ip = result2.scalar_one_or_none()
            if ip:
                await db.execute(update(InstructorProfile).where(InstructorProfile.user_id == user_id).values(**ip_data))

    await db.commit()
    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile), selectinload(User.instructor_profile))
        .where(User.id == user_id)
    )
    return UserResponse.model_validate(result.scalar_one())


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(user_id: UUID, _: RequireAdmin, db: DB):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return MessageResponse(message="User deleted")


@router.patch("/{user_id}/status", response_model=UserResponse)
async def update_user_status(user_id: UUID, new_status: str, _: RequireAdmin, db: DB):
    if new_status not in ("active", "inactive", "suspended"):
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.execute(update(User).where(User.id == user_id).values(status=UserStatus(new_status)))
    await db.commit()
    result = await db.execute(select(User).where(User.id == user_id))
    return UserResponse.model_validate(result.scalar_one())


@router.post("/bulk", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def bulk_create_users(payload: BulkUserCreate, _: RequireAdmin, db: DB):
    created = 0
    for u in payload.users:
        existing = await db.scalar(select(User).where(User.email == u.email.lower()))
        if existing:
            continue
        user = User(
            email=u.email.lower(),
            hashed_password=hash_password(u.password),
            full_name=u.full_name,
            role=UserRole(u.role),
            phone=u.phone,
        )
        db.add(user)
        await db.flush()
        if u.role == "student" and u.student_profile:
            db.add(StudentProfile(user_id=user.id, **u.student_profile.model_dump()))
        created += 1
    await db.commit()
    return MessageResponse(message=f"{created} users created successfully")
