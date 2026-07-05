# ExamDesk — Full-Stack Online Examination Platform

A production-quality, full-stack online examination system for universities, coaching institutes, certification providers, and recruitment companies.

---

## Project Structure

```
examdesk/
├── frontend/                  React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/            Reusable components (Button, Card, Modal, etc.)
│   │   │   └── layout/        AppShell, Sidebar, Topbar
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── student/       Student Dashboard, ExamPage
│   │   │   ├── instructor/    Instructor Dashboard, CreateExam
│   │   │   ├── admin/         Admin Dashboard
│   │   │   ├── QuestionBankPage.tsx
│   │   │   └── SharedPages.tsx  Results, Notifications, Profile, Users
│   │   ├── stores/            Zustand (auth)
│   │   ├── lib/               Axios client, API service layer
│   │   ├── types/             TypeScript interfaces
│   │   └── router.tsx         React Router with role guards
│   └── package.json
│
└── backend/                   FastAPI + SQLAlchemy + PostgreSQL
    ├── main.py                 App factory
    ├── config.py               Pydantic settings
    ├── models/__init__.py      16-table PostgreSQL schema
    ├── schemas/__init__.py     Pydantic v2 request/response models
    ├── api/
    │   ├── dependencies.py     Auth guards, role enforcement
    │   └── routes/             auth, users, subjects, questions,
    │                           exams, attempts, results, analytics
    ├── services/
    │   └── grading.py          Auto-grading engine
    ├── auth/security.py        JWT + bcrypt
    ├── middleware/logging.py   Request logging, error handler
    ├── utils/certificate.py    HMAC verification codes
    ├── alembic/                DB migrations
    ├── tests/                  Pytest async test suite
    ├── seed.py                 Sample data seeder
    └── Dockerfile + docker-compose.yml
```

---

## Quick Start

### Option A — Docker (Recommended)

```bash
git clone https://github.com/your-org/examdesk
cd examdesk

# Start everything
docker compose up --build

# In a separate terminal, seed the database
docker compose exec api python seed.py
```

Frontend: http://localhost:3000  
Backend API: http://localhost:8000  
API Docs: http://localhost:8000/api/docs

---

### Option B — Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv && source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL and SECRET_KEY

# Create database
createdb examdesk

# Run migrations
alembic upgrade head

# Seed sample data
python seed.py

# Start API server
python main.py
```

#### Frontend

```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_BASE_URL=http://localhost:8000/api/v1
npm run dev
```

---

## Demo Credentials

| Role       | Email                   | Password       |
|------------|-------------------------|----------------|
| Admin      | admin@examdesk.edu      | admin123       |
| Instructor | arjun@examdesk.edu      | instructor123  |
| Student    | rahul@examdesk.edu      | student123     |
| Student    | ananya@examdesk.edu     | student123     |
| Student    | priya@examdesk.edu      | student123     |

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Tailwind CSS | Utility-first styling |
| React Router v6 | Client-side routing with guards |
| TanStack Query v5 | Server state, caching, refetching |
| Zustand | Client state (auth persistence) |
| Axios | HTTP client with interceptors |
| React Hook Form + Zod | Form management and validation |
| Recharts | Analytics charts |
| React Hot Toast | Notifications |
| date-fns | Date formatting |
| Lucide React | Icons |

### Backend
| Technology | Purpose |
|---|---|
| FastAPI | Async REST API framework |
| SQLAlchemy 2.0 async | ORM with async session |
| Pydantic v2 | Request/response validation |
| Alembic | Database migrations |
| python-jose | JWT token creation/validation |
| passlib (bcrypt) | Password hashing |
| asyncpg | Async PostgreSQL driver |
| Redis | Session caching (optional) |

### Infrastructure
| Service | Purpose |
|---|---|
| PostgreSQL 15 | Primary database (Neon for production) |
| Redis 7 | Caching and session store |
| Docker + Compose | Local development stack |
| Render | Backend deployment |
| Vercel | Frontend deployment |
| Neon | Serverless PostgreSQL (production) |

---

## Key Features

### Authentication
- JWT access tokens (60 min) + refresh tokens (7 days)
- bcrypt password hashing
- Role-based access control (Student / Instructor / Admin)
- Automatic token refresh in Axios interceptor
- Forgot/reset password flow

### Student Module
- Dashboard with score trends and subject performance charts
- Browse and start published/live exams
- Real-time countdown timer during exam
- Question navigation panel with status indicators
- Auto-save answers every 30 seconds
- Mark questions for review
- Submit with confirmation modal
- Immediate result with pass/fail, score, rank
- View historical results and certificates

### Instructor Module
- Dashboard with live exam monitoring
- 4-step exam creation wizard
- Publish, clone, and manage exams
- Question bank with full CRUD
- View results per exam with rankings
- Analytics: pass rates, score distributions

### Admin Module
- Institute-wide analytics dashboard
- User management (create, suspend, bulk import)
- Live exam monitoring with alert feed
- Audit log viewer
- Complete exam oversight

### Exam Engine
- Timed exam with auto-submit on timeout
- Tab-switch detection with proctoring log
- Copy/paste blocking
- Question and option randomization per student
- Section-based exams with per-section scoring
- Negative marking support

### Grading Engine
- Auto-evaluates: MCQ, True/False, Multi-select, Fill-in-blank
- Subjective/descriptive flagged for manual review
- Negative marks calculated correctly
- Rankings + percentile recalculated after each submission
- Certificate auto-issued with HMAC verification code
- Notification sent to student

---

## Deployment

### Backend → Render
1. Push `backend/` to GitHub
2. New Web Service on Render
3. Build: `pip install -r requirements.txt && alembic upgrade head`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2`
5. Add env vars from `.env.example`

### Database → Neon
1. Create project at neon.tech
2. Copy connection string → set as `DATABASE_URL` in Render

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
# Set: VITE_API_BASE_URL=https://your-api.onrender.com/api/v1
```

---

## Running Tests

```bash
cd backend
createdb examdesk_test
pytest tests/ -v --cov=. --cov-report=html
```

---

## API Documentation

Interactive Swagger UI available at `/api/docs` when the backend is running.

Full endpoint reference: see `backend/README.md`

---
