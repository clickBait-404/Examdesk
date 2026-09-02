# 🎓 ExamDesk – Full-Stack Online Examination Platform


A production-ready Online Examination System built using **FastAPI**, **React**, **PostgreSQL**, **Redis**, and **Docker**.

The platform supports Students, Instructors, and Administrators with secure authentication, online exams, question management, automatic grading, analytics, and role-based access control.

---

# Live Status

- ✅ Dockerized Backend
- ✅ PostgreSQL Integration
- ✅ Redis Integration
- ✅ JWT Authentication
- ✅ Role Based Access Control
- ✅ Exam Management
- ✅ Question Bank
- ✅ Automatic Grading
- ✅ Swagger Documentation

---

# Tech Stack

## Backend

- FastAPI
- SQLAlchemy Async
- PostgreSQL
- Redis
- JWT Authentication


## Frontend

- React
- TypeScript
- TailwindCSS


---

## 📂 Project Structure

```text
Examdesk/
│     
│
├── backend/
│   ├── api/
│   │   ├── routes/
│   │   ├── __init__.py
│   │   └── dependencies.py
│   ├── auth/
│   ├── database/
│   ├── middleware/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── tests/
│   ├── utils/
│   ├── alembic/
│   ├── config.py
│   ├── main.py
│   ├── seed.py
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pytest.ini
│   └── alembic.ini
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
│
├── docker-compose.yml
├── .gitignore
├── README.md
```

---

# Clone Repository

```bash
git clone https://github.com/clickBait-404/Examdesk.git
cd Examdesk
```

---

# Run with Docker

```bash
docker compose up --build
```

Seed the database

```bash
docker compose exec backend python seed.py
```

Backend

```
http://localhost:8000
```

Swagger

```
http://localhost:8000/api/docs
```

---

# Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@examdesk.edu | admin123 |
| Instructor | arjun@examdesk.edu | instructor123 |
| Student | rahul@examdesk.edu | student123 |

---

# Features

## Authentication

- JWT Login
- Refresh Tokens
- Password Hashing
- RBAC

## Student

- Take Exams
- View Results
- Dashboard
- Notifications

## Instructor

- Create Exams
- Publish Exams
- Clone Exams
- Question Bank

## Admin

- Manage Users
- Analytics
- Monitor Exams

## Exam Engine

- Timer
- Auto Submit
- Random Questions
- Negative Marking
- Auto Grading

---

# Testing

✔ Authentication

✔ Users

✔ Exams

✔ Questions

✔ Grading


# Deployment

- Render
- Vercel
- Neon PostgreSQL


---


# Author

**Himanshu Yadav**

GitHub

https://github.com/clickBait-404

Repository

https://github.com/clickBait-404/Examdesk
