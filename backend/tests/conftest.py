"""
ExamDesk — Pytest Configuration & Shared Fixtures
"""

import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from main import app
from database.session import Base, get_db
from auth.security import hash_password
from models import User, UserRole, StudentProfile, InstructorProfile

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:password@localhost:5432/examdesk_test"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db):
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_user(db):
    user = User(
        email="admin@test.com",
        hashed_password=hash_password("admin123"),
        full_name="Test Admin",
        role=UserRole.admin,
    )
    db.add(user)
    await db.commit()
    return user


@pytest_asyncio.fixture
async def instructor_user(db):
    user = User(
        email="instructor@test.com",
        hashed_password=hash_password("test123"),
        full_name="Test Instructor",
        role=UserRole.instructor,
    )
    db.add(user)
    await db.flush()
    profile = InstructorProfile(
        user_id=user.id,
        department="CSE",
        designation="Lecturer",
        employee_id="EMP001",
    )
    db.add(profile)
    await db.commit()
    return user


@pytest_asyncio.fixture
async def student_user(db):
    user = User(
        email="student@test.com",
        hashed_password=hash_password("test123"),
        full_name="Test Student",
        role=UserRole.student,
    )
    db.add(user)
    await db.flush()
    profile = StudentProfile(
        user_id=user.id,
        roll_number="CS001",
        department="CSE",
    )
    db.add(profile)
    await db.commit()
    return user


async def get_auth_token(client: AsyncClient, email: str, password: str) -> str:
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]
