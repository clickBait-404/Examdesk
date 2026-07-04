"""
ExamDesk — Analytics Routes
GET /analytics/student/me
GET /analytics/instructor
GET /analytics/admin
GET /leaderboard/{exam_id}
GET /leaderboard/global

Notifications Routes
GET    /notifications
PATCH  /notifications/{id}/read
PATCH  /notifications/read-all
DELETE /notifications/{id}

Certificates Routes
GET  /certificates/me
GET  /certificates/{id}
GET  /certificates/verify/{code}
"""

from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload

from api.dependencies import CurrentUser, DB
from models import (
    Result, ExamAttempt, Exam, StudentProfile, InstructorProfile,
    Ranking, Notification, Certificate, User,
)
from schemas import (
    AdminAnalytics, CertificateResponse, CertificateVerifyResponse,
    InstructorAnalytics, LeaderboardEntry, LeaderboardResponse,
    MessageResponse, NotificationResponse, PaginatedResponse, StudentAnalytics,
)

# ─── Analytics ─────────────────────────────────────────────────────────────

analytics_router = APIRouter(prefix="/analytics", tags=["Analytics"])


@analytics_router.get("/student/me", response_model=StudentAnalytics)
async def student_analytics(current_user: CurrentUser, db: DB):
    sp = await db.scalar(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    if not sp:
        raise HTTPException(status_code=400, detail="Student profile not found")

    results = await db.execute(
        select(Result)
        .options(selectinload(Result.exam))
        .where(Result.student_id == sp.id, Result.is_published == True)
        .order_by(Result.created_at.asc())
    )
    results_list = results.scalars().all()

    total = len(results_list)
    passed = sum(1 for r in results_list if r.is_passed)
    failed = total - passed
    avg_score = round(sum(r.percentage for r in results_list) / total, 2) if total else 0.0
    best_score = round(max((r.percentage for r in results_list), default=0.0), 2)

    score_trend = [
        {
            "exam": r.exam.title[:30] if r.exam else "—",
            "score": r.obtained_marks,
            "percentage": r.percentage,
            "date": r.created_at.isoformat(),
        }
        for r in results_list
    ]

    # Subject performance: group by subject
    subject_map: dict = {}
    for r in results_list:
        if r.exam and r.exam.subject_id:
            key = str(r.exam.subject_id)
            subject_map.setdefault(key, []).append(r.percentage)

    subject_performance = [
        {"subject_id": k, "avg_percentage": round(sum(v) / len(v), 2)}
        for k, v in subject_map.items()
    ]

    # Current rank (from latest exam)
    current_rank = None
    if results_list:
        latest = results_list[-1]
        rank_entry = await db.scalar(
            select(Ranking).where(Ranking.exam_id == latest.exam_id, Ranking.student_id == sp.id)
        )
        if rank_entry:
            current_rank = rank_entry.rank

    return StudentAnalytics(
        total_exams=total,
        exams_passed=passed,
        exams_failed=failed,
        average_score=avg_score,
        best_score=best_score,
        current_rank=current_rank,
        score_trend=score_trend,
        subject_performance=subject_performance,
    )


@analytics_router.get("/instructor", response_model=InstructorAnalytics)
async def instructor_analytics(current_user: CurrentUser, db: DB):
    if current_user.role.value not in ("instructor", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    ip = await db.scalar(select(InstructorProfile).where(InstructorProfile.user_id == current_user.id))

    # All exams by this instructor
    exams_q = select(Exam)
    if ip and current_user.role.value == "instructor":
        exams_q = exams_q.where(Exam.instructor_id == ip.id)

    exams_result = await db.execute(exams_q)
    exams = exams_result.scalars().all()
    exam_ids = [e.id for e in exams]

    if not exam_ids:
        return InstructorAnalytics(total_exams=0, total_students=0, average_pass_rate=0.0, average_score=0.0)

    results_q = await db.execute(select(Result).where(Result.exam_id.in_(exam_ids)))
    all_results = results_q.scalars().all()

    total_students = len({r.student_id for r in all_results})
    pass_rate = round(sum(1 for r in all_results if r.is_passed) / len(all_results) * 100, 2) if all_results else 0.0
    avg_score = round(sum(r.percentage for r in all_results) / len(all_results), 2) if all_results else 0.0

    exam_stats = []
    for e in exams:
        e_results = [r for r in all_results if r.exam_id == e.id]
        exam_stats.append({
            "exam_id": str(e.id),
            "exam_title": e.title,
            "attempts": len(e_results),
            "pass_rate": round(sum(1 for r in e_results if r.is_passed) / len(e_results) * 100, 2) if e_results else 0.0,
            "avg_score": round(sum(r.percentage for r in e_results) / len(e_results), 2) if e_results else 0.0,
        })

    return InstructorAnalytics(
        total_exams=len(exams),
        total_students=total_students,
        average_pass_rate=pass_rate,
        average_score=avg_score,
        exam_stats=exam_stats,
    )


@analytics_router.get("/admin", response_model=AdminAnalytics)
async def admin_analytics(current_user: CurrentUser, db: DB):
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Access denied")

    from models import UserRole
    total_students = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.student)) or 0
    total_instructors = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.instructor)) or 0
    total_exams = await db.scalar(select(func.count(Exam.id))) or 0
    total_attempts = await db.scalar(select(func.count(ExamAttempt.id))) or 0

    results_q = await db.execute(select(Result))
    all_results = results_q.scalars().all()
    overall_pass_rate = round(sum(1 for r in all_results if r.is_passed) / len(all_results) * 100, 2) if all_results else 0.0

    # Top performers
    top_performers_q = await db.execute(
        select(Result, StudentProfile, User)
        .join(StudentProfile, Result.student_id == StudentProfile.id)
        .join(User, StudentProfile.user_id == User.id)
        .order_by(Result.percentage.desc())
        .limit(5)
    )
    top_performers = [
        {"student_name": u.full_name, "percentage": r.percentage, "exam_id": str(r.exam_id)}
        for r, sp, u in top_performers_q.all()
    ]

    return AdminAnalytics(
        total_students=total_students,
        total_instructors=total_instructors,
        total_exams=total_exams,
        total_attempts=total_attempts,
        overall_pass_rate=overall_pass_rate,
        top_performers=top_performers,
    )


# ─── Leaderboard ───────────────────────────────────────────────────────────

leaderboard_router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


@leaderboard_router.get("/{exam_id}", response_model=LeaderboardResponse)
async def exam_leaderboard(exam_id: UUID, current_user: CurrentUser, db: DB):
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    rankings_q = await db.execute(
        select(Ranking, StudentProfile, User)
        .join(StudentProfile, Ranking.student_id == StudentProfile.id)
        .join(User, StudentProfile.user_id == User.id)
        .where(Ranking.exam_id == exam_id)
        .order_by(Ranking.rank)
    )
    rows = rankings_q.all()

    entries = [
        LeaderboardEntry(
            rank=r.rank,
            student_name=u.full_name,
            roll_number=sp.roll_number,
            department=sp.department,
            score=r.score,
            percentage=round(r.score / exam.total_marks * 100, 2),
            percentile=r.percentile,
        )
        for r, sp, u in rows
    ]

    return LeaderboardResponse(
        exam_id=exam_id,
        exam_title=exam.title,
        entries=entries,
        total_participants=len(entries),
    )


# ─── Notifications ─────────────────────────────────────────────────────────

notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])


@notifications_router.get("", response_model=PaginatedResponse)
async def list_notifications(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
):
    query = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        query = query.where(Notification.is_read == False)
    query = query.order_by(Notification.created_at.desc())

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.offset((page - 1) * size).limit(size))
    notifs = result.scalars().all()

    return PaginatedResponse(
        items=[NotificationResponse.model_validate(n) for n in notifs],
        total=total, page=page, size=size,
        pages=(total + size - 1) // size,
    )


@notifications_router.patch("/{notif_id}/read", response_model=MessageResponse)
async def mark_read(notif_id: UUID, current_user: CurrentUser, db: DB):
    n = await db.scalar(
        select(Notification).where(Notification.id == notif_id, Notification.user_id == current_user.id)
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.execute(
        update(Notification).where(Notification.id == notif_id)
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return MessageResponse(message="Marked as read")


@notifications_router.patch("/read-all", response_model=MessageResponse)
async def mark_all_read(current_user: CurrentUser, db: DB):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return MessageResponse(message="All notifications marked as read")


@notifications_router.delete("/{notif_id}", response_model=MessageResponse)
async def delete_notification(notif_id: UUID, current_user: CurrentUser, db: DB):
    n = await db.scalar(
        select(Notification).where(Notification.id == notif_id, Notification.user_id == current_user.id)
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.delete(n)
    await db.commit()
    return MessageResponse(message="Notification deleted")


# ─── Certificates ──────────────────────────────────────────────────────────

certificates_router = APIRouter(prefix="/certificates", tags=["Certificates"])


@certificates_router.get("/me", response_model=PaginatedResponse)
async def my_certificates(current_user: CurrentUser, db: DB):
    sp = await db.scalar(select(StudentProfile).where(StudentProfile.user_id == current_user.id))
    if not sp:
        raise HTTPException(status_code=400, detail="Student profile not found")

    result = await db.execute(
        select(Certificate).where(Certificate.student_id == sp.id).order_by(Certificate.issued_at.desc())
    )
    certs = result.scalars().all()
    return PaginatedResponse(
        items=[CertificateResponse.model_validate(c) for c in certs],
        total=len(certs), page=1, size=len(certs), pages=1,
    )


@certificates_router.get("/verify/{code}", response_model=CertificateVerifyResponse)
async def verify_certificate(code: str, db: DB):
    result = await db.execute(
        select(Certificate)
        .options(
            selectinload(Certificate.result).selectinload(Result.exam),
            selectinload(Certificate.student).selectinload(StudentProfile.user),
        )
        .where(Certificate.verification_code == code)
    )
    cert = result.scalar_one_or_none()

    if not cert or not cert.is_valid:
        return CertificateVerifyResponse(is_valid=False)

    return CertificateVerifyResponse(
        is_valid=True,
        student_name=cert.student.user.full_name if cert.student and cert.student.user else None,
        exam_title=cert.result.exam.title if cert.result and cert.result.exam else None,
        score=cert.result.obtained_marks if cert.result else None,
        percentage=cert.result.percentage if cert.result else None,
        issued_at=cert.issued_at,
    )
