# ExamDesk — Online Examination Platform

A production-grade, full-stack online examination system built for universities, coaching institutes, certification providers, and recruitment companies.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Database Schema & ER Diagram](#database-schema--er-diagram)
- [API Endpoints Reference](#api-endpoints-reference)
- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
- [Deployment Guide](#deployment-guide)
- [Environment Variables](#environment-variables)
- [Role-Based Access Control](#role-based-access-control)
- [Exam Lifecycle](#exam-lifecycle)
- [Grading Engine](#grading-engine)
- [Security Features](#security-features)
- [Testing](#testing)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│   React + TypeScript + Tailwind CSS + Zustand + Recharts   │
│          Deployed: Vercel (CDN-backed, global)              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼──────────────────────────────────┐
│                        API LAYER                            │
│     FastAPI + Pydantic + JWT Auth + Role Guards            │
│          Deployed: Render (auto-scale)                      │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  Auth API  │  │  Exam API  │  │ Analytics  │  ...      │
│  └────────────┘  └────────────┘  └────────────┘           │
└──────────┬───────────────────────────────┬─────────────────┘
           │ SQLAlchemy async              │ redis-py
┌──────────▼──────────┐          ┌─────────▼──────────────┐
│   PostgreSQL (Neon) │          │   Redis (optional)     │
│   Primary database  │          │   Sessions / Cache     │
└─────────────────────┘          └────────────────────────┘
```

### Key Design Decisions

| Concern | Choice | Reason |
|---|---|---|
| Async ORM | SQLAlchemy 2.0 async | Non-blocking I/O for concurrent exams |
| Auth | JWT (access + refresh) | Stateless, scalable |
| Migrations | Alembic | Schema versioning, rollback support |
| Grading | Synchronous within request | Immediate result on submit |
| Anti-cheat | Server-side event log | Tamper-proof, queryable |
| Validation | Pydantic v2 | Fast, strict, descriptive errors |

---

## Database Schema & ER Diagram

### Entity Relationship Description

```
users (1) ─────────────── (0..1) student_profiles
users (1) ─────────────── (0..1) instructor_profiles
users (1) ─────────────── (N)   notifications
users (1) ─────────────── (N)   audit_logs

instructor_profiles (1) ── (N)  exams
instructor_profiles (1) ── (N)  questions

subjects (1) ──────────── (N)   questions
subjects (1) ──────────── (N)   exams

exams (1) ─────────────── (N)   exam_sections
exams (1) ─────────────── (N)   exam_attempts
exams (1) ─────────────── (N)   results
exams (1) ─────────────── (N)   rankings

exam_sections (1) ─────── (N)   exam_questions
exam_questions (N) ─────── (1)  questions

exam_attempts (1) ─────── (N)   student_answers
exam_attempts (1) ─────── (1)   results
exam_attempts (1) ─────── (N)   proctoring_events

results (1) ──────────────(0..1) certificates
student_profiles (1) ───── (N)  exam_attempts
student_profiles (1) ───── (N)  results
student_profiles (1) ───── (N)  certificates
student_profiles (1) ───── (N)  rankings

questions (1) ─────────── (N)   question_options
questions (1) ─────────── (N)   student_answers
```

### Core Tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | Indexed |
| hashed_password | VARCHAR(255) | bcrypt |
| full_name | VARCHAR(255) | |
| role | ENUM | student / instructor / admin |
| status | ENUM | active / inactive / suspended |
| last_login_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

#### `student_profiles`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | CASCADE DELETE |
| roll_number | VARCHAR(50) UNIQUE | |
| department | VARCHAR(100) | |
| semester | INTEGER | |
| batch_year | INTEGER | |

#### `exams`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| title | VARCHAR(255) | |
| status | ENUM | draft/published/live/completed/cancelled |
| duration_minutes | INTEGER | |
| scheduled_start | TIMESTAMPTZ | |
| total_marks | FLOAT | |
| passing_marks | FLOAT | |
| negative_marking | BOOLEAN | |
| randomize_questions | BOOLEAN | |
| full_screen_required | BOOLEAN | |
| tab_switch_detection | BOOLEAN | |
| max_tab_switches_allowed | INTEGER | |
| instructor_id | UUID FK | |
| subject_id | UUID FK | |

#### `questions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| text | TEXT | |
| question_type | ENUM | mcq/true_false/multi_select/fill_blank/subjective/descriptive |
| difficulty | ENUM | easy/medium/hard |
| tags | JSONB | Array of strings |
| explanation | TEXT | Shown post-exam |
| version | INTEGER | Incremented on edit |

#### `exam_attempts`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| exam_id | UUID FK | |
| student_id | UUID FK | |
| status | ENUM | started/in_progress/submitted/timed_out/disqualified |
| started_at | TIMESTAMPTZ | |
| submitted_at | TIMESTAMPTZ | |
| tab_switches | INTEGER | |
| copy_attempts | INTEGER | |
| question_order | JSONB | Randomized order per student |

#### `results`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| obtained_marks | FLOAT | |
| percentage | FLOAT | |
| is_passed | BOOLEAN | |
| rank | INTEGER | |
| correct_answers | INTEGER | |
| wrong_answers | INTEGER | |
| negative_marks | FLOAT | |
| section_scores | JSONB | Per-section breakdown |
| is_published | BOOLEAN | |

---

## API Endpoints Reference

### Authentication — `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | ✗ | Register new user |
| POST | `/login` | ✗ | Login, get JWT tokens |
| POST | `/refresh` | ✗ | Refresh access token |
| POST | `/logout` | ✓ | Logout (audit logged) |
| POST | `/forgot-password` | ✗ | Send reset email |
| POST | `/reset-password` | ✗ | Reset via token |
| POST | `/change-password` | ✓ | Change own password |
| GET | `/me` | ✓ | Get current user profile |

### Users — `/api/v1/users`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/users` | Admin | List all users (paginated) |
| POST | `/users` | Admin | Create user |
| GET | `/users/{id}` | Admin/Self | Get user |
| PUT | `/users/{id}` | Admin/Self | Update user |
| DELETE | `/users/{id}` | Admin | Delete user |
| PATCH | `/users/{id}/status` | Admin | Activate/Suspend |
| POST | `/users/bulk` | Admin | Bulk import users |

### Subjects — `/api/v1/subjects`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/subjects` | All | List subjects |
| POST | `/subjects` | Instructor/Admin | Create subject |
| GET | `/subjects/{id}` | All | Get subject |
| PUT | `/subjects/{id}` | Admin | Update |
| DELETE | `/subjects/{id}` | Admin | Deactivate |

### Question Bank — `/api/v1/questions`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/questions` | All | List (filter by type, difficulty, subject, topic) |
| POST | `/questions` | Instructor/Admin | Create question with options |
| GET | `/questions/{id}` | All | Get question |
| PUT | `/questions/{id}` | Instructor/Admin | Update (version++)|
| DELETE | `/questions/{id}` | Instructor/Admin | Soft delete |

### Exams — `/api/v1/exams`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/exams` | All | List exams (students see published+) |
| POST | `/exams` | Instructor/Admin | Create exam with sections |
| GET | `/exams/{id}` | All | Get exam details |
| PUT | `/exams/{id}` | Instructor/Admin | Update exam |
| DELETE | `/exams/{id}` | Instructor/Admin | Delete draft exam |
| POST | `/exams/{id}/publish` | Instructor/Admin | Publish exam |
| POST | `/exams/{id}/clone` | Instructor/Admin | Clone exam |
| POST | `/exams/{id}/start` | Student | Start attempt, get questions |

### Exam Attempts — `/api/v1/attempts`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/attempts/{id}` | Student | Get attempt info |
| POST | `/attempts/{id}/answers` | Student | Save/update single answer |
| POST | `/attempts/{id}/answers/bulk` | Student | Batch save answers |
| GET | `/attempts/{id}/answers` | Student | Get all saved answers |
| POST | `/attempts/{id}/proctoring` | Student | Log proctoring event |
| POST | `/attempts/{id}/submit` | Student | Submit exam → auto-grade |

### Results — `/api/v1/results`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/results/me` | Student | Own results (paginated) |
| GET | `/results/{id}` | All | Result with question breakdown |
| GET | `/results/exam/{exam_id}` | Instructor/Admin | All results for an exam |
| POST | `/results/{id}/publish` | Instructor/Admin | Publish single result |
| POST | `/results/exam/{id}/publish-all` | Instructor/Admin | Publish all + recalculate ranks |

### Analytics — `/api/v1/analytics`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/analytics/student/me` | Student | Score trends, subject perf |
| GET | `/analytics/instructor` | Instructor/Admin | Exam stats, difficulty analysis |
| GET | `/analytics/admin` | Admin | Institute-wide KPIs |

### Leaderboard — `/api/v1/leaderboard`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/leaderboard/{exam_id}` | All | Exam rankings with percentile |

### Notifications — `/api/v1/notifications`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/notifications` | All | Own notifications (paginated) |
| PATCH | `/notifications/{id}/read` | All | Mark as read |
| PATCH | `/notifications/read-all` | All | Mark all read |
| DELETE | `/notifications/{id}` | All | Delete |

### Certificates — `/api/v1/certificates`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/certificates/me` | Student | Own certificates |
| GET | `/certificates/verify/{code}` | Public | Verify certificate authenticity |

### Audit Logs — `/api/v1/audit-logs`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/audit-logs` | Admin | Paginated system audit log |

---

## Project Structure

```
examdesk-backend/
├── main.py                     # FastAPI app factory & entry point
├── config.py                   # Settings (pydantic-settings + .env)
├── requirements.txt
├── seed.py                     # Database seeder
├── alembic.ini
│
├── api/
│   ├── dependencies.py         # Auth dependencies & role guards
│   └── routes/
│       ├── auth.py             # Login, register, tokens
│       ├── users.py            # User CRUD & bulk import
│       ├── subjects.py         # Subject management
│       ├── questions.py        # Question bank CRUD
│       ├── exams.py            # Exam lifecycle
│       ├── attempts.py         # Exam taking & proctoring
│       ├── results.py          # Result retrieval & publishing
│       └── analytics.py        # Analytics + leaderboard + notifications + certs
│
├── models/
│   └── __init__.py             # All SQLAlchemy ORM models
│
├── schemas/
│   └── __init__.py             # All Pydantic request/response schemas
│
├── services/
│   └── grading.py              # Automatic grading engine
│
├── auth/
│   └── security.py             # JWT utils, password hashing
│
├── database/
│   └── session.py              # Async engine, session, Base
│
├── middleware/
│   └── logging.py              # Request logging & exception handler
│
├── utils/
│   └── certificate.py          # Verification code generation
│
├── alembic/
│   ├── env.py                  # Async Alembic env
│   └── versions/               # Migration files
│
└── tests/
    ├── conftest.py             # Fixtures & test DB setup
    └── test_core.py            # Auth, exam, grading tests
```

---

## Local Development Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Redis (optional, for caching)
- Node.js 20+ (for frontend)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/examdesk.git
cd examdesk/backend

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb examdesk

# Copy and edit environment file
cp .env.example .env
# Edit .env: set DATABASE_URL, SECRET_KEY, etc.
```

### 3. Run Migrations

```bash
# Generate initial migration (first time)
alembic revision --autogenerate -m "initial schema"

# Apply migrations
alembic upgrade head
```

### 4. Seed Sample Data

```bash
python seed.py
```

Output:
```
✅ Admin created:      admin@examdesk.edu      / admin123
✅ Instructor created: arjun@examdesk.edu      / instructor123
✅ 8 students seeded  (password: student123)
✅ 7 subjects seeded
✅ 14 questions seeded
✅ Sample exam created: 'Computer Networks Midterm'
```

### 5. Start the Server

```bash
# Development (auto-reload)
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API available at: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/api/docs`

---

## Deployment Guide

### Backend → Render

1. Push backend code to a GitHub repository

2. In Render dashboard: **New → Web Service**

3. Build command:
   ```bash
   pip install -r requirements.txt && alembic upgrade head
   ```

4. Start command:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
   ```

5. Add environment variables (see section below)

### Database → Neon PostgreSQL

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string: `postgresql+asyncpg://user:pass@host/dbname`
3. Set as `DATABASE_URL` in Render environment variables

### Frontend → Vercel

```bash
cd frontend
npm install
npm run build

# Deploy
npx vercel --prod
```

Set environment variable in Vercel:
```
VITE_API_BASE_URL=https://your-backend.onrender.com/api/v1
```

### Docker (Self-hosted)

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

```yaml
# docker-compose.yml
version: "3.9"
services:
  api:
    build: .
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [db, redis]

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: examdesk
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

```bash
docker compose up --build
docker compose exec api alembic upgrade head
docker compose exec api python seed.py
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL async URL |
| `SECRET_KEY` | ✅ | — | JWT signing key (min 32 chars) |
| `ALGORITHM` | | HS256 | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | 60 | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | | 7 | Refresh token lifetime |
| `ALLOWED_ORIGINS` | ✅ | — | Comma-separated CORS origins |
| `ENVIRONMENT` | | development | development / staging / production |
| `REDIS_URL` | | redis://localhost:6379/0 | Redis connection |
| `SMTP_HOST` | | smtp.gmail.com | Email server |
| `SMTP_USER` | | — | Email sender address |
| `SMTP_PASSWORD` | | — | Email password |
| `CERT_SECRET_KEY` | ✅ | — | Certificate HMAC key |
| `DEBUG` | | true | Enable debug logs |

---

## Role-Based Access Control

```
┌─────────────┬──────────┬────────────┬───────┐
│ Resource    │ Student  │ Instructor │ Admin │
├─────────────┼──────────┼────────────┼───────┤
│ Own profile │ RW       │ RW         │ RW    │
│ All users   │ —        │ —          │ CRUD  │
│ Subjects    │ R        │ RC         │ CRUD  │
│ Questions   │ R        │ CRUD       │ CRUD  │
│ Own exams   │ R (pub)  │ CRUD       │ CRUD  │
│ All exams   │ —        │ —          │ R     │
│ Start exam  │ ✓        │ —          │ —     │
│ Save answer │ ✓        │ —          │ —     │
│ Own results │ R (pub)  │ —          │ —     │
│ All results │ —        │ R          │ R     │
│ Publish res │ —        │ ✓          │ ✓     │
│ Analytics   │ Own      │ Own exams  │ Full  │
│ Audit logs  │ —        │ —          │ R     │
│ Certificates│ Own      │ —          │ R     │
└─────────────┴──────────┴────────────┴───────┘
```

---

## Exam Lifecycle

```
Draft ──publish──► Published ──first student starts──► Live ──all submitted──► Completed
  │                    │                                  │
  └──delete (ok)──     └──edit (ok)──                    └──no edits──
```

### Student Exam Flow

```
1. GET  /exams                     Browse published exams
2. POST /exams/{id}/start          Start attempt → receive questions (no correct answers)
3. POST /attempts/{id}/answers     Auto-save each answer as student progresses
4. POST /attempts/{id}/proctoring  Client logs tab switches, clipboard events
5. POST /attempts/{id}/submit      Submit → immediate grading → Result returned
6. GET  /results/{id}              View detailed result with question-wise breakdown
7. GET  /certificates/me           Download certificate (if passed)
```

---

## Grading Engine

Located in `services/grading.py`.

### Automatic Evaluation

| Question Type | Method |
|---|---|
| MCQ | Compare `selected_option_id` to the single correct option |
| True/False | Same as MCQ |
| Multi-select | Exact set match of selected IDs vs correct IDs |
| Fill in Blank | Case-insensitive string comparison |
| Subjective | Flagged `is_correct = None` — requires manual review |
| Descriptive | Same as subjective |

### Scoring Formula

```
raw_score = Σ(marks_per_question * is_correct)
           − Σ(negative_marks_per_wrong * is_wrong)   [if negative marking enabled]

final_score = max(0, raw_score)
percentage  = (final_score / total_marks) * 100
is_passed   = final_score >= passing_marks
```

### Post-Grading Actions

1. Result row created/updated in `results`
2. Rankings recalculated for all students in that exam
3. Percentile computed: `((total - rank) / total) * 100`
4. Certificate auto-issued with HMAC verification code (if passed)
5. Notification sent to student

---

## Security Features

### Authentication
- Passwords hashed with **bcrypt** (cost factor 12)
- Short-lived **access tokens** (60 min) + long-lived **refresh tokens** (7 days)
- Token type validation prevents refresh tokens from authorizing API calls

### Anti-Cheating
- **Tab switch detection**: client posts to `/proctoring`, server counts and can auto-disqualify
- **Copy/paste**: enforced client-side; attempts logged server-side
- **Fullscreen**: required client-side; exits logged
- **Auto-submit**: server compares `submitted_at` vs `started_at + duration`; timed-out attempts are graded automatically
- **Question randomization**: per-attempt question order stored in `exam_attempts.question_order`

### Data Protection
- Role checks on every endpoint — no privilege escalation possible
- Students receive questions **without** `is_correct` flags
- Result publishing is a separate step — students can't see results before instructor decides
- Certificate verification codes are **HMAC-SHA256** signed — not guessable

---

## Testing

### Run Tests

```bash
# Create test database
createdb examdesk_test

# Run all tests
pytest tests/ -v

# Run specific test class
pytest tests/test_core.py::TestAuth -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html
open htmlcov/index.html
```

### Test Categories

| Class | Coverage |
|---|---|
| `TestAuth` | Register, login, token refresh, password change, unauthorized access |
| `TestUsers` | Admin list, student self-update, role enforcement |
| `TestExams` | Create, publish validation, student visibility, clone |
| `TestQuestions` | MCQ creation, role enforcement, difficulty filter |
| `TestGrading` | Correct answer scoring, pass/fail logic |

---

## Frontend Integration

### Axios Setup

```typescript
// src/lib/axios.ts
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      // Attempt token refresh
      const refreshToken = useAuthStore.getState().refreshToken
      if (refreshToken) {
        const { data } = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
        err.config.headers.Authorization = `Bearer ${data.access_token}`
        return axios(err.config)
      }
      useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  }
)

export default api
```

### Example API Calls

```typescript
// Start an exam
const { data } = await api.post(`/exams/${examId}/start`)
// → { attempt_id, sections: [{ questions: [...] }], ends_at }

// Auto-save answer
await api.post(`/attempts/${attemptId}/answers`, {
  question_id: questionId,
  selected_option_id: optionId,
  is_marked_for_review: false,
})

// Log tab switch
await api.post(`/attempts/${attemptId}/proctoring`, {
  event_type: 'tab_switch',
  description: 'Student left exam window',
})

// Submit exam
const result = await api.post(`/attempts/${attemptId}/submit`)
// → { obtained_marks, percentage, is_passed, rank, ... }
```

---

## Contributing

```
1. Fork the repository
2. Create a feature branch: git checkout -b feature/your-feature
3. Write tests for new functionality
4. Ensure all tests pass: pytest tests/ -v
5. Submit a pull request with a clear description
```

---

## License

MIT License — free to use for educational and commercial projects.

---

*Built as a production-quality portfolio project demonstrating full-stack engineering, system design, and enterprise architecture.*
