"""
ExamDesk — Grading Service
Automatic evaluation engine for MCQ, True/False, Multi-select.
Calculates scores, section breakdowns, pass/fail, and rankings.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models import (
    ExamAttempt, AttemptStatus, StudentAnswer, Question,
    QuestionType, QuestionOption, ExamQuestion, ExamSection,
    Exam, Result, Ranking, Certificate, StudentProfile,
    Notification, NotificationType,
)
from utils.certificate import generate_verification_code


async def grade_attempt(attempt_id: UUID, db: AsyncSession) -> Result:
    """
    Grade a single exam attempt.
    - Evaluates all objective question answers automatically.
    - Subjective/descriptive answers are flagged for manual review.
    - Creates Result, updates Rankings, issues Certificate if passed.
    """

    # Load attempt with everything needed
    result = await db.execute(
        select(ExamAttempt)
        .options(
            selectinload(ExamAttempt.exam).selectinload(Exam.sections).selectinload(ExamSection.exam_questions),
            selectinload(ExamAttempt.answers),
        )
        .where(ExamAttempt.id == attempt_id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise ValueError(f"Attempt {attempt_id} not found")

    exam = attempt.exam
    answers_by_question = {a.question_id: a for a in attempt.answers}

    total_marks = 0.0
    correct_count = 0
    wrong_count = 0
    unattempted_count = 0
    negative_marks = 0.0
    section_scores: dict = {}

    for section in exam.sections:
        section_score = 0.0
        for eq in section.exam_questions:
            q_id = eq.question_id
            question = await db.get(Question, q_id)
            if not question:
                continue

            answer = answers_by_question.get(q_id)

            if question.question_type in (QuestionType.subjective, QuestionType.descriptive):
                # Manual review needed — no auto-grading
                if answer:
                    answer.is_correct = None   # null = pending review
                    answer.marks_awarded = None
                continue

            if not answer or (
                answer.selected_option_id is None
                and not answer.selected_option_ids
                and not answer.text_answer
            ):
                unattempted_count += 1
                if answer:
                    answer.is_correct = False
                    answer.marks_awarded = 0.0
                continue

            # ── Evaluate ──────────────────────────────────────────────

            if question.question_type == QuestionType.mcq:
                correct_options = await db.execute(
                    select(QuestionOption)
                    .where(QuestionOption.question_id == q_id, QuestionOption.is_correct == True)
                )
                correct_option = correct_options.scalar_one_or_none()
                is_correct = (
                    correct_option is not None
                    and answer.selected_option_id == correct_option.id
                )

            elif question.question_type == QuestionType.true_false:
                correct_options = await db.execute(
                    select(QuestionOption)
                    .where(QuestionOption.question_id == q_id, QuestionOption.is_correct == True)
                )
                correct_option = correct_options.scalar_one_or_none()
                is_correct = (
                    correct_option is not None
                    and answer.selected_option_id == correct_option.id
                )

            elif question.question_type == QuestionType.multi_select:
                correct_opts_result = await db.execute(
                    select(QuestionOption.id)
                    .where(QuestionOption.question_id == q_id, QuestionOption.is_correct == True)
                )
                correct_ids = {str(r) for r in correct_opts_result.scalars().all()}
                selected_ids = {str(oid) for oid in (answer.selected_option_ids or [])}
                is_correct = correct_ids == selected_ids

            elif question.question_type == QuestionType.fill_blank:
                correct_opts_result = await db.execute(
                    select(QuestionOption)
                    .where(QuestionOption.question_id == q_id, QuestionOption.is_correct == True)
                )
                correct_option = correct_opts_result.scalar_one_or_none()
                is_correct = (
                    correct_option is not None
                    and answer.text_answer is not None
                    and answer.text_answer.strip().lower() == correct_option.text.strip().lower()
                )
            else:
                is_correct = False

            # ── Score ─────────────────────────────────────────────────

            if is_correct:
                awarded = eq.marks
                correct_count += 1
            else:
                wrong_count += 1
                if exam.negative_marking:
                    awarded = -exam.negative_marks_per_wrong
                    negative_marks += exam.negative_marks_per_wrong
                else:
                    awarded = 0.0

            answer.is_correct = is_correct
            answer.marks_awarded = awarded
            total_marks += awarded
            section_score += awarded

        section_scores[str(section.id)] = round(max(section_score, 0), 2)

    total_marks = round(max(total_marks, 0), 2)
    percentage = round((total_marks / exam.total_marks) * 100, 2) if exam.total_marks > 0 else 0.0
    is_passed = total_marks >= exam.passing_marks

    # ── Mark attempt as submitted ──────────────────────────────────────────
    now = datetime.now(timezone.utc)
    time_taken = int((now - attempt.started_at.replace(tzinfo=timezone.utc)).total_seconds())

    await db.execute(
        update(ExamAttempt)
        .where(ExamAttempt.id == attempt_id)
        .values(
            status=AttemptStatus.submitted,
            submitted_at=now,
            time_taken_seconds=time_taken,
        )
    )

    # ── Create or update Result ────────────────────────────────────────────
    existing_result = await db.scalar(
        select(Result).where(Result.attempt_id == attempt_id)
    )
    if existing_result:
        await db.execute(
            update(Result).where(Result.id == existing_result.id).values(
                obtained_marks=total_marks,
                percentage=percentage,
                is_passed=is_passed,
                correct_answers=correct_count,
                wrong_answers=wrong_count,
                unattempted=unattempted_count,
                negative_marks=negative_marks,
                section_scores=section_scores,
                is_published=exam.show_result_immediately,
                published_at=now if exam.show_result_immediately else None,
            )
        )
        result_obj = await db.get(Result, existing_result.id)
    else:
        result_obj = Result(
            exam_id=exam.id,
            attempt_id=attempt.id,
            student_id=attempt.student_id,
            total_marks=exam.total_marks,
            obtained_marks=total_marks,
            percentage=percentage,
            is_passed=is_passed,
            correct_answers=correct_count,
            wrong_answers=wrong_count,
            unattempted=unattempted_count,
            negative_marks=negative_marks,
            section_scores=section_scores,
            is_published=exam.show_result_immediately,
            published_at=now if exam.show_result_immediately else None,
        )
        db.add(result_obj)
        await db.flush()

    # ── Update Rankings ────────────────────────────────────────────────────
    await _update_rankings(exam.id, db)

    # ── Issue Certificate if passed ────────────────────────────────────────
    if is_passed:
        await _issue_certificate(result_obj, db)

    # ── Send Notification ──────────────────────────────────────────────────
    student = await db.get(StudentProfile, attempt.student_id)
    if student:
        db.add(Notification(
            user_id=student.user_id,
            type=NotificationType.result_published,
            title=f"Result: {exam.title}",
            message=f"Your result has been published. Score: {total_marks}/{exam.total_marks} ({percentage}%). Status: {'Pass ✓' if is_passed else 'Fail ✗'}",
            notification_metadata={"exam_id": str(exam.id), "result_id": str(result_obj.id)},
        ))

    await db.commit()
    return result_obj


async def _update_rankings(exam_id: UUID, db: AsyncSession):
    """Recalculate and store rankings for all submitted results of an exam."""
    results_q = await db.execute(
        select(Result)
        .where(Result.exam_id == exam_id, Result.is_published == True)
        .order_by(Result.obtained_marks.desc(), Result.attempt_id)
    )
    results = results_q.scalars().all()
    total = len(results)

    for idx, res in enumerate(results):
        rank = idx + 1
        percentile = round(((total - rank) / total) * 100, 2) if total > 1 else 100.0

        # Upsert ranking
        existing = await db.scalar(
            select(Ranking).where(Ranking.exam_id == exam_id, Ranking.student_id == res.student_id)
        )
        if existing:
            await db.execute(
                update(Ranking).where(Ranking.id == existing.id)
                .values(rank=rank, score=res.obtained_marks, percentile=percentile)
            )
        else:
            db.add(Ranking(
                exam_id=exam_id,
                student_id=res.student_id,
                rank=rank,
                score=res.obtained_marks,
                percentile=percentile,
            ))

        # Update rank on result
        await db.execute(update(Result).where(Result.id == res.id).values(rank=rank))


async def _issue_certificate(result: Result, db: AsyncSession):
    """Issue a certificate for a passed exam result."""
    existing = await db.scalar(select(Certificate).where(Certificate.result_id == result.id))
    if existing:
        return

    code = generate_verification_code(result.id, result.student_id)
    cert = Certificate(
        student_id=result.student_id,
        result_id=result.id,
        verification_code=code,
    )
    db.add(cert)

    # Notification
    student = await db.get(StudentProfile, result.student_id)
    if student:
        db.add(Notification(
            user_id=student.user_id,
            type=NotificationType.certificate_issued,
            title="Certificate Issued!",
            message=f"Your certificate has been issued. Verification code: {code}",
            notification_metadata={"certificate_verification_code": code},
        ))
  
