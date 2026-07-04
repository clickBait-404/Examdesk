"""
ExamDesk — Database Seed Script
Creates realistic sample data for development and demos.

Usage:
    python seed.py
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from database.session import AsyncSessionLocal, create_tables
from auth.security import hash_password
from models import (
    User, UserRole, StudentProfile, InstructorProfile,
    Subject, Question, QuestionType, QuestionOption, DifficultyLevel,
    Exam, ExamSection, ExamQuestion, ExamStatus,
)


SUBJECTS_DATA = [
    {"name": "Computer Networks", "code": "CN401", "department": "CSE", "credits": 4},
    {"name": "Data Structures & Algorithms", "code": "DSA301", "department": "CSE", "credits": 4},
    {"name": "Database Management Systems", "code": "DBMS302", "department": "CSE", "credits": 4},
    {"name": "Operating Systems", "code": "OS303", "department": "CSE", "credits": 4},
    {"name": "Software Engineering", "code": "SE402", "department": "CSE", "credits": 3},
    {"name": "Object Oriented Programming", "code": "OOP201", "department": "CSE", "credits": 4},
    {"name": "Theory of Computation", "code": "TOC401", "department": "CSE", "credits": 3},
]

STUDENTS_DATA = [
    {"full_name": "Rahul Verma", "email": "rahul@examdesk.edu", "password": "student123",
     "roll_number": "CS2021001", "department": "CSE", "semester": 6, "batch_year": 2021},
    {"full_name": "Ananya Singh", "email": "ananya@examdesk.edu", "password": "student123",
     "roll_number": "CS2021002", "department": "CSE", "semester": 6, "batch_year": 2021},
    {"full_name": "Karan Patel", "email": "karan@examdesk.edu", "password": "student123",
     "roll_number": "CS2021003", "department": "IT", "semester": 6, "batch_year": 2021},
    {"full_name": "Priya Reddy", "email": "priya@examdesk.edu", "password": "student123",
     "roll_number": "CS2021004", "department": "CSE", "semester": 6, "batch_year": 2021},
    {"full_name": "Saurabh Kumar", "email": "saurabh@examdesk.edu", "password": "student123",
     "roll_number": "CS2021005", "department": "ECE", "semester": 6, "batch_year": 2021},
    {"full_name": "Divya Nair", "email": "divya@examdesk.edu", "password": "student123",
     "roll_number": "CS2021006", "department": "CSE", "semester": 6, "batch_year": 2021},
    {"full_name": "Aditya Sharma", "email": "aditya@examdesk.edu", "password": "student123",
     "roll_number": "CS2021007", "department": "CSE", "semester": 6, "batch_year": 2021},
    {"full_name": "Meera Joshi", "email": "meera@examdesk.edu", "password": "student123",
     "roll_number": "CS2021008", "department": "IT", "semester": 6, "batch_year": 2021},
]

QUESTIONS_DATA = [
    # Computer Networks MCQs
    {
        "text": "Which layer of the OSI model is responsible for end-to-end communication and error recovery?",
        "question_type": QuestionType.mcq, "difficulty": DifficultyLevel.easy,
        "topic": "OSI Model", "tags": ["networking", "osi"],
        "options": [
            {"text": "Physical Layer", "is_correct": False},
            {"text": "Transport Layer", "is_correct": True},
            {"text": "Network Layer", "is_correct": False},
            {"text": "Application Layer", "is_correct": False},
        ],
        "explanation": "The Transport Layer (Layer 4) provides end-to-end communication services.",
    },
    {
        "text": "TCP is a _______ protocol.",
        "question_type": QuestionType.fill_blank, "difficulty": DifficultyLevel.easy,
        "topic": "TCP/IP", "tags": ["tcp", "protocols"],
        "options": [{"text": "connection-oriented", "is_correct": True}],
        "explanation": "TCP (Transmission Control Protocol) is connection-oriented.",
    },
    {
        "text": "Which protocol is used to assign IP addresses dynamically?",
        "question_type": QuestionType.mcq, "difficulty": DifficultyLevel.easy,
        "topic": "IP Addressing", "tags": ["dhcp", "ip"],
        "options": [
            {"text": "DNS", "is_correct": False},
            {"text": "ARP", "is_correct": False},
            {"text": "DHCP", "is_correct": True},
            {"text": "ICMP", "is_correct": False},
        ],
    },
    {
        "text": "UDP provides guaranteed delivery of packets.",
        "question_type": QuestionType.true_false, "difficulty": DifficultyLevel.easy,
        "topic": "UDP", "tags": ["udp"],
        "options": [
            {"text": "True", "is_correct": False},
            {"text": "False", "is_correct": True},
        ],
        "explanation": "UDP is connectionless and does NOT guarantee delivery.",
    },
    {
        "text": "What is the maximum size of an IPv4 address in bits?",
        "question_type": QuestionType.mcq, "difficulty": DifficultyLevel.medium,
        "topic": "IP Addressing", "tags": ["ipv4"],
        "options": [
            {"text": "16 bits", "is_correct": False},
            {"text": "32 bits", "is_correct": True},
            {"text": "64 bits", "is_correct": False},
            {"text": "128 bits", "is_correct": False},
        ],
    },
    # DSA Questions
    {
        "text": "What is the time complexity of binary search on a sorted array of n elements?",
        "question_type": QuestionType.mcq, "difficulty": DifficultyLevel.easy,
        "topic": "Search Algorithms", "tags": ["binary-search", "complexity"],
        "options": [
            {"text": "O(n)", "is_correct": False},
            {"text": "O(n²)", "is_correct": False},
            {"text": "O(log n)", "is_correct": True},
            {"text": "O(1)", "is_correct": False},
        ],
    },
    {
        "text": "Which data structure follows the Last In First Out (LIFO) principle?",
        "question_type": QuestionType.mcq, "difficulty": DifficultyLevel.easy,
        "topic": "Stacks", "tags": ["stack", "lifo"],
        "options": [
            {"text": "Queue", "is_correct": False},
            {"text": "Stack", "is_correct": True},
            {"text": "Linked List", "is_correct": False},
            {"text": "Binary Tree", "is_correct": False},
        ],
    },
    {
        "text": "What is the worst-case time complexity of QuickSort?",
        "question_type": QuestionType.mcq, "difficulty": DifficultyLevel.medium,
        "topic": "Sorting Algorithms", "tags": ["quicksort", "complexity"],
        "options": [
            {"text": "O(n log n)", "is_correct": False},
            {"text": "O(n)", "is_correct": False},
            {"text": "O(n²)", "is_correct": True},
            {"text": "O(log n)", "is_correct": False},
        ],
        "explanation": "QuickSort worst case occurs when pivot is always the smallest/largest element.",
    },
    {
        "text": "In a complete binary tree with n nodes, what is the height?",
        "question_type": QuestionType.mcq, "difficulty": DifficultyLevel.medium,
        "topic": "Trees", "tags": ["binary-tree", "height"],
        "options": [
            {"text": "O(n)", "is_correct": False},
            {"text": "O(log n)", "is_correct": True},
            {"text": "O(n log n)", "is_correct": False},
            {"text": "O(√n)", "is_correct": False},
        ],
    },
    # DBMS Questions
    {
        "text": "Which normal form eliminates transitive dependencies?",
        "question_type": QuestionType.mcq, "difficulty": DifficultyLevel.medium,
        "topic": "Normalization", "tags": ["normalization", "3nf"],
        "options": [
            {"text": "1NF", "is_correct": False},
            {"text": "2NF", "is_correct": False},
            {"text": "3NF", "is_correct": True},
            {"text": "BCNF", "is_correct": False},
        ],
    },
    {
        "text": "What does ACID stand for in database transactions?",
        "question_type": QuestionType.mcq, "difficulty": DifficultyLevel.easy,
        "topic": "Transactions", "tags": ["acid", "transactions"],
        "options": [
            {"text": "Atomicity, Consistency, Isolation, Durability", "is_correct": True},
            {"text": "Atomicity, Clarity, Isolation, Durability", "is_correct": False},
            {"text": "Accuracy, Consistency, Integrity, Durability", "is_correct": False},
            {"text": "Atomicity, Consistency, Integrity, Dependency", "is_correct": False},
        ],
    },
    {
        "text": "Explain the concept of deadlock in database management systems and the conditions required for it to occur.",
        "question_type": QuestionType.subjective, "difficulty": DifficultyLevel.hard,
        "topic": "Concurrency Control", "tags": ["deadlock", "concurrency"],
        "options": [],
    },
    # OS Questions
    {
        "text": "Which CPU scheduling algorithm minimizes average waiting time?",
        "question_type": QuestionType.mcq, "difficulty": DifficultyLevel.hard,
        "topic": "CPU Scheduling", "tags": ["scheduling", "sjf"],
        "options": [
            {"text": "FCFS", "is_correct": False},
            {"text": "Round Robin", "is_correct": False},
            {"text": "Shortest Job First (SJF)", "is_correct": True},
            {"text": "Priority Scheduling", "is_correct": False},
        ],
    },
    {
        "text": "What is thrashing in the context of virtual memory?",
        "question_type": QuestionType.subjective, "difficulty": DifficultyLevel.hard,
        "topic": "Virtual Memory", "tags": ["thrashing", "virtual-memory"],
        "options": [],
    },
]


async def seed():
    print("🌱 Creating tables...")
    await create_tables()

    async with AsyncSessionLocal() as db:
        # ── Admin ──────────────────────────────────────────────────
        existing_admin = await db.scalar(select(User).where(User.email == "admin@examdesk.edu"))
        if not existing_admin:
            admin = User(
                email="admin@examdesk.edu",
                hashed_password=hash_password("admin123"),
                full_name="Dr. Priya Sharma",
                role=UserRole.admin,
                email_verified=True,
            )
            db.add(admin)
            print("✅ Admin created: admin@examdesk.edu / admin123")

        # ── Instructor ─────────────────────────────────────────────
        existing_instructor = await db.scalar(select(User).where(User.email == "arjun@examdesk.edu"))
        instructor_profile_id = None
        if not existing_instructor:
            instructor_user = User(
                email="arjun@examdesk.edu",
                hashed_password=hash_password("instructor123"),
                full_name="Prof. Arjun Mehta",
                role=UserRole.instructor,
                email_verified=True,
            )
            db.add(instructor_user)
            await db.flush()

            instructor_profile = InstructorProfile(
                user_id=instructor_user.id,
                department="Computer Science & Engineering",
                designation="Associate Professor",
                employee_id="EMP2018042",
                specialization="Computer Networks & Distributed Systems",
            )
            db.add(instructor_profile)
            await db.flush()
            instructor_profile_id = instructor_profile.id
            print("✅ Instructor created: arjun@examdesk.edu / instructor123")

        # ── Subjects ───────────────────────────────────────────────
        subject_ids = {}
        for s_data in SUBJECTS_DATA:
            existing = await db.scalar(select(Subject).where(Subject.code == s_data["code"]))
            if not existing:
                s = Subject(**s_data)
                db.add(s)
                await db.flush()
                subject_ids[s_data["name"]] = s.id
            else:
                subject_ids[s_data["name"]] = existing.id

        await db.commit()
        print(f"✅ {len(subject_ids)} subjects seeded")

        # ── Students ───────────────────────────────────────────────
        student_profile_ids = []
        for s_data in STUDENTS_DATA:
            existing = await db.scalar(select(User).where(User.email == s_data["email"]))
            if not existing:
                u = User(
                    email=s_data["email"],
                    hashed_password=hash_password(s_data["password"]),
                    full_name=s_data["full_name"],
                    role=UserRole.student,
                    email_verified=True,
                )
                db.add(u)
                await db.flush()
                sp = StudentProfile(
                    user_id=u.id,
                    roll_number=s_data["roll_number"],
                    department=s_data["department"],
                    semester=s_data["semester"],
                    batch_year=s_data["batch_year"],
                )
                db.add(sp)
                await db.flush()
                student_profile_ids.append(sp.id)

        await db.commit()
        print(f"✅ {len(STUDENTS_DATA)} students seeded")

        # ── Questions ──────────────────────────────────────────────
        cn_subject_id = subject_ids.get("Computer Networks")
        dsa_subject_id = subject_ids.get("Data Structures & Algorithms")
        dbms_subject_id = subject_ids.get("Database Management Systems")
        os_subject_id = subject_ids.get("Operating Systems")

        q_subject_map = {
            "networking": cn_subject_id, "osi": cn_subject_id,
            "tcp": cn_subject_id, "udp": cn_subject_id, "dhcp": cn_subject_id, "ipv4": cn_subject_id,
            "binary-search": dsa_subject_id, "stack": dsa_subject_id,
            "quicksort": dsa_subject_id, "binary-tree": dsa_subject_id,
            "normalization": dbms_subject_id, "acid": dbms_subject_id, "deadlock": dbms_subject_id,
            "scheduling": os_subject_id, "thrashing": os_subject_id,
        }

        question_ids = []
        for q_data in QUESTIONS_DATA:
            # Determine subject from tags
            subject_id = None
            for tag in q_data.get("tags", []):
                if tag in q_subject_map:
                    subject_id = q_subject_map[tag]
                    break

            q = Question(
                text=q_data["text"],
                question_type=q_data["question_type"],
                difficulty=q_data["difficulty"],
                topic=q_data.get("topic"),
                tags=q_data.get("tags", []),
                explanation=q_data.get("explanation"),
                subject_id=subject_id,
                created_by_id=instructor_profile_id,
            )
            db.add(q)
            await db.flush()
            question_ids.append(q.id)

            for opt_data in q_data.get("options", []):
                db.add(QuestionOption(
                    question_id=q.id,
                    text=opt_data["text"],
                    is_correct=opt_data["is_correct"],
                    order_index=q_data["options"].index(opt_data),
                ))

        await db.commit()
        print(f"✅ {len(QUESTIONS_DATA)} questions seeded")

        # ── Exam ───────────────────────────────────────────────────
        if instructor_profile_id:
            # Get instructor profile id
            ip = await db.scalar(
                select(InstructorProfile).where(InstructorProfile.employee_id == "EMP2018042")
            )
            if ip:
                now = datetime.now(timezone.utc)
                exam = Exam(
                    title="Computer Networks Midterm Examination",
                    description="Midterm examination covering OSI model, TCP/IP, and network protocols",
                    instructions="Read all questions carefully. Each correct answer carries 2 marks. There is no negative marking.",
                    duration_minutes=90,
                    scheduled_start=now + timedelta(days=2),
                    scheduled_end=now + timedelta(days=2, hours=2),
                    total_marks=20,
                    passing_marks=8,
                    negative_marking=False,
                    randomize_questions=True,
                    randomize_options=True,
                    show_result_immediately=True,
                    full_screen_required=True,
                    tab_switch_detection=True,
                    copy_paste_disabled=True,
                    max_tab_switches_allowed=3,
                    subject_id=cn_subject_id,
                    instructor_id=ip.id,
                    status=ExamStatus.published,
                )
                db.add(exam)
                await db.flush()

                # One section with first 5 CN questions
                cn_questions = [qid for qid, qdata in zip(question_ids, QUESTIONS_DATA) if "networking" in qdata.get("tags",[]) or "osi" in qdata.get("tags",[]) or "tcp" in qdata.get("tags",[]) or "udp" in qdata.get("tags",[]) or "dhcp" in qdata.get("tags",[]) or "ipv4" in qdata.get("tags",[])]

                section = ExamSection(
                    exam_id=exam.id,
                    name="Section A: Computer Networks MCQ",
                    marks=20.0,
                    order_index=0,
                )
                db.add(section)
                await db.flush()

                for idx, q_id in enumerate(cn_questions[:10]):
                    db.add(ExamQuestion(
                        exam_id=exam.id,
                        section_id=section.id,
                        question_id=q_id,
                        order_index=idx,
                        marks=2.0,
                    ))

                await db.commit()
                print(f"✅ Sample exam created: 'Computer Networks Midterm'")

    print("\n🎉 Seed completed! Login credentials:")
    print("   Admin:      admin@examdesk.edu      / admin123")
    print("   Instructor: arjun@examdesk.edu      / instructor123")
    print("   Student:    rahul@examdesk.edu      / student123")
    print("   (+ 7 more students with password: student123)\n")


if __name__ == "__main__":
    asyncio.run(seed())
