"""
ExamDesk — Core Test Suite
Tests for authentication, exam lifecycle, and grading engine.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

from tests.conftest import get_auth_token


# ─── Auth Tests ────────────────────────────────────────────────────────────

class TestAuth:
    @pytest.mark.asyncio
    async def test_register_student(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/register", json={
            "email": "newstudent@test.com",
            "password": "password123",
            "full_name": "New Student",
            "role": "student",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newstudent@test.com"
        assert data["role"] == "student"
        assert "hashed_password" not in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, student_user):
        response = await client.post("/api/v1/auth/register", json={
            "email": "student@test.com",  # already exists
            "password": "password123",
            "full_name": "Duplicate",
            "role": "student",
        })
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, student_user):
        response = await client.post("/api/v1/auth/login", json={
            "email": "student@test.com",
            "password": "test123",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, student_user):
        response = await client.post("/api/v1/auth/login", json={
            "email": "student@test.com",
            "password": "wrongpassword",
        })
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_me(self, client: AsyncClient, student_user):
        token = await get_auth_token(client, "student@test.com", "test123")
        response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json()["email"] == "student@test.com"

    @pytest.mark.asyncio
    async def test_refresh_token(self, client: AsyncClient, student_user):
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": "student@test.com", "password": "test123"
        })
        refresh_token = login_resp.json()["refresh_token"]
        response = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert response.status_code == 200
        assert "access_token" in response.json()

    @pytest.mark.asyncio
    async def test_change_password(self, client: AsyncClient, student_user):
        token = await get_auth_token(client, "student@test.com", "test123")
        response = await client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "test123", "new_password": "newpass456", "confirm_password": "newpass456"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_unauthorized_access(self, client: AsyncClient):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401


# ─── User Tests ─────────────────────────────────────────────────────────────

class TestUsers:
    @pytest.mark.asyncio
    async def test_admin_can_list_users(self, client: AsyncClient, admin_user, student_user):
        token = await get_auth_token(client, "admin@test.com", "admin123")
        response = await client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_student_cannot_list_users(self, client: AsyncClient, student_user):
        token = await get_auth_token(client, "student@test.com", "test123")
        response = await client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_update_own_profile(self, client: AsyncClient, student_user):
        token = await get_auth_token(client, "student@test.com", "test123")
        response = await client.put(
            f"/api/v1/users/{student_user.id}",
            json={"full_name": "Updated Name", "phone": "+919876543210"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["full_name"] == "Updated Name"


# ─── Exam Tests ─────────────────────────────────────────────────────────────

class TestExams:
    @pytest.mark.asyncio
    async def test_instructor_can_create_exam(self, client: AsyncClient, instructor_user, db):
        token = await get_auth_token(client, "instructor@test.com", "test123")
        response = await client.post("/api/v1/exams", json={
            "title": "Test Exam",
            "duration_minutes": 60,
            "total_marks": 100.0,
            "passing_marks": 40.0,
        }, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Exam"
        assert data["status"] == "draft"

    @pytest.mark.asyncio
    async def test_student_cannot_create_exam(self, client: AsyncClient, student_user):
        token = await get_auth_token(client, "student@test.com", "test123")
        response = await client.post("/api/v1/exams", json={
            "title": "Unauthorized Exam",
            "duration_minutes": 60,
            "total_marks": 100.0,
            "passing_marks": 40.0,
        }, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_list_exams_student_sees_only_published(self, client: AsyncClient, student_user, instructor_user, db):
        # Create a draft exam as instructor
        inst_token = await get_auth_token(client, "instructor@test.com", "test123")
        await client.post("/api/v1/exams", json={
            "title": "Draft Exam",
            "duration_minutes": 60,
            "total_marks": 50.0,
            "passing_marks": 20.0,
        }, headers={"Authorization": f"Bearer {inst_token}"})

        # Student should not see draft exams
        student_token = await get_auth_token(client, "student@test.com", "test123")
        response = await client.get("/api/v1/exams", headers={"Authorization": f"Bearer {student_token}"})
        assert response.status_code == 200
        for exam in response.json()["items"]:
            assert exam["status"] in ("published", "live", "completed")

    @pytest.mark.asyncio
    async def test_cannot_publish_exam_without_questions(self, client: AsyncClient, instructor_user):
        token = await get_auth_token(client, "instructor@test.com", "test123")
        # Create draft exam
        create_resp = await client.post("/api/v1/exams", json={
            "title": "Empty Exam",
            "duration_minutes": 30,
            "total_marks": 50.0,
            "passing_marks": 20.0,
        }, headers={"Authorization": f"Bearer {token}"})
        exam_id = create_resp.json()["id"]

        # Attempt to publish without questions
        publish_resp = await client.post(
            f"/api/v1/exams/{exam_id}/publish",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert publish_resp.status_code == 400

    @pytest.mark.asyncio
    async def test_clone_exam(self, client: AsyncClient, instructor_user):
        token = await get_auth_token(client, "instructor@test.com", "test123")
        create_resp = await client.post("/api/v1/exams", json={
            "title": "Original Exam",
            "duration_minutes": 60,
            "total_marks": 100.0,
            "passing_marks": 40.0,
        }, headers={"Authorization": f"Bearer {token}"})
        exam_id = create_resp.json()["id"]

        clone_resp = await client.post(
            f"/api/v1/exams/{exam_id}/clone",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert clone_resp.status_code == 201
        assert "[Copy]" in clone_resp.json()["title"]
        assert clone_resp.json()["id"] != exam_id


# ─── Question Bank Tests ─────────────────────────────────────────────────────

class TestQuestions:
    @pytest.mark.asyncio
    async def test_create_mcq_question(self, client: AsyncClient, instructor_user):
        token = await get_auth_token(client, "instructor@test.com", "test123")
        response = await client.post("/api/v1/questions", json={
            "text": "What is 2 + 2?",
            "question_type": "mcq",
            "difficulty": "easy",
            "topic": "Math",
            "tags": ["arithmetic"],
            "options": [
                {"text": "3", "is_correct": False, "order_index": 0},
                {"text": "4", "is_correct": True, "order_index": 1},
                {"text": "5", "is_correct": False, "order_index": 2},
                {"text": "6", "is_correct": False, "order_index": 3},
            ],
        }, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 201
        data = response.json()
        assert len(data["options"]) == 4

    @pytest.mark.asyncio
    async def test_student_cannot_create_question(self, client: AsyncClient, student_user):
        token = await get_auth_token(client, "student@test.com", "test123")
        response = await client.post("/api/v1/questions", json={
            "text": "Unauthorized question?",
            "question_type": "mcq",
            "difficulty": "easy",
            "options": [],
        }, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_filter_questions_by_difficulty(self, client: AsyncClient, instructor_user):
        token = await get_auth_token(client, "instructor@test.com", "test123")
        # Create easy question
        await client.post("/api/v1/questions", json={
            "text": "Easy question?",
            "question_type": "true_false",
            "difficulty": "easy",
            "options": [{"text": "True", "is_correct": True, "order_index": 0}, {"text": "False", "is_correct": False, "order_index": 1}],
        }, headers={"Authorization": f"Bearer {token}"})

        response = await client.get(
            "/api/v1/questions?difficulty=easy",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        for q in response.json()["items"]:
            assert q["difficulty"] == "easy"


# ─── Grading Tests ────────────────────────────────────────────────────────────

class TestGrading:
    @pytest.mark.asyncio
    async def test_correct_answer_awards_full_marks(self, db):
        """Unit test: grading engine awards marks for correct MCQ answer."""
        from services.grading import grade_attempt
        from models import (
            Exam, ExamSection, ExamQuestion, ExamAttempt, AttemptStatus,
            Question, QuestionOption, QuestionType, DifficultyLevel,
            StudentProfile, User, UserRole,
        )
        from datetime import datetime, timezone

        # Create minimal fixtures
        user = User(email="g@t.com", hashed_password="x", full_name="G", role=UserRole.student)
        db.add(user)
        await db.flush()
        sp = StudentProfile(user_id=user.id, roll_number="G001", department="CSE")
        db.add(sp)
        await db.flush()

        exam = Exam(
            title="Grading Test",
            duration_minutes=30,
            total_marks=4.0,
            passing_marks=2.0,
            show_result_immediately=True,
        )
        db.add(exam)
        await db.flush()

        section = ExamSection(exam_id=exam.id, name="S1", marks=4.0, order_index=0)
        db.add(section)
        await db.flush()

        q = Question(text="Q?", question_type=QuestionType.mcq, difficulty=DifficultyLevel.easy)
        db.add(q)
        await db.flush()

        correct_opt = QuestionOption(question_id=q.id, text="Correct", is_correct=True, order_index=0)
        wrong_opt   = QuestionOption(question_id=q.id, text="Wrong",   is_correct=False, order_index=1)
        db.add_all([correct_opt, wrong_opt])
        await db.flush()

        eq = ExamQuestion(exam_id=exam.id, section_id=section.id, question_id=q.id, order_index=0, marks=4.0)
        db.add(eq)
        await db.flush()

        attempt = ExamAttempt(
            exam_id=exam.id,
            student_id=sp.id,
            status=AttemptStatus.in_progress,
            started_at=datetime.now(timezone.utc),
        )
        db.add(attempt)
        await db.flush()

        from models import StudentAnswer
        answer = StudentAnswer(
            attempt_id=attempt.id,
            question_id=q.id,
            selected_option_id=correct_opt.id,
        )
        db.add(answer)
        await db.commit()

        result = await grade_attempt(attempt.id, db)

        assert result.obtained_marks == 4.0
        assert result.is_passed is True
        assert result.correct_answers == 1
        assert result.wrong_answers == 0
