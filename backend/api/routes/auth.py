"""
ExamDesk — Authentication Routes
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/change-password
GET  /auth/me
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import CurrentUser, DB, get_current_user
from auth.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
    verify_password_reset_token,
)
from models import AuditLog, AuditAction, User, UserRole, UserStatus, StudentProfile, InstructorProfile
from schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    RefreshTokenRequest,
)
from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def _build_token_response(user: User, db: AsyncSession) -> TokenResponse:
    access_token = create_access_token(subject=str(user.id), role=user.role.value)
    refresh_token = create_refresh_token(subject=str(user.id), role=user.role.value)

    # Update last login
    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(last_login_at=datetime.now(timezone.utc))
    )

    # Load relationships for response
    result = await db.execute(
    select(User)
    .options(
        selectinload(User.student_profile),
        selectinload(User.instructor_profile),
    )
    .where(User.id == user.id)
)
    user = result.scalar_one()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: DB):
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole(payload.role),
        phone=payload.phone,
    )
    db.add(user)
    await db.flush()  # get user.id

    if payload.role == "student" and payload.student_profile:
        profile = StudentProfile(user_id=user.id, **payload.student_profile.model_dump())
        db.add(profile)
    elif payload.role == "instructor" and payload.instructor_profile:
        profile = InstructorProfile(user_id=user.id, **payload.instructor_profile.model_dump())
        db.add(profile)

    # Audit log
    db.add(AuditLog(user_id=user.id, action=AuditAction.user_created, resource_type="user", resource_id=str(user.id)))
    await db.commit()

    result = await db.execute(select(User).where(User.id == user.id))
    return UserResponse.model_validate(result.scalar_one())


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: DB):
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if user.status == UserStatus.suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")

    db.add(AuditLog(
        user_id=user.id,
        action=AuditAction.login,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    ))

    return await _build_token_response(user, db)


# OAuth2 form-based login (for Swagger UI)
@router.post("/token", response_model=TokenResponse, include_in_schema=False)
async def token_login(form: Annotated[OAuth2PasswordRequestForm, Depends()], request: Request, db: DB):
    result = await db.execute(select(User).where(User.email == form.username.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect credentials")
    return await _build_token_response(user, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshTokenRequest, db: DB):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = data.get("sub")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    from uuid import UUID
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return await _build_token_response(user, db)


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: CurrentUser, request: Request, db: DB):
    db.add(AuditLog(
        user_id=current_user.id,
        action=AuditAction.logout,
        ip_address=request.client.host if request.client else None,
    ))
    return MessageResponse(message="Logged out successfully")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest, db: DB):
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    # Always return success to avoid email enumeration
    if user:
        token = create_password_reset_token(user.email)
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(password_reset_token=token)
        )
        # TODO: send email via SMTP/Celery task
    return MessageResponse(message="If the email exists, a reset link has been sent")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest, db: DB):
    email = verify_password_reset_token(payload.token)
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(hashed_password=hash_password(payload.new_password), password_reset_token=None)
    )
    return MessageResponse(message="Password reset successfully")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(payload: ChangePasswordRequest, current_user: CurrentUser, db: DB):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(hashed_password=hash_password(payload.new_password))
    )
    return MessageResponse(message="Password changed successfully")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser):
    return UserResponse.model_validate(current_user)
