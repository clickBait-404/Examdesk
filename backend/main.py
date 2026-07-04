"""
ExamDesk — FastAPI Application Entry Point
Wires together all routers, middleware, and startup hooks.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from database.session import create_tables
from middleware.logging import GlobalExceptionMiddleware, RequestLoggingMiddleware

# ── Routers ────────────────────────────────────────────────────────────────
from api.routes.auth import router as auth_router
from api.routes.users import router as users_router
from api.routes.subjects import subjects_router, audit_router
from api.routes.questions import router as questions_router
from api.routes.exams import router as exams_router
from api.routes.attempts import router as attempts_router
from api.routes.results import router as results_router
from api.routes.analytics import (
    analytics_router,
    leaderboard_router,
    notifications_router,
    certificates_router,
)

# ── Logging setup ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("examdesk")


# ── Lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 ExamDesk starting up...")
    if settings.ENVIRONMENT == "development":
        await create_tables()
        logger.info("✅ Database tables verified")
    yield
    logger.info("🛑 ExamDesk shutting down...")


# ── App factory ────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title="ExamDesk API",
        description=(
            "Production-grade Online Examination Platform API. "
            "Supports student, instructor, and admin roles with full exam lifecycle management."
        ),
        version=settings.APP_VERSION,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Correlation-ID", "X-Response-Time"],
    )

    # ── Custom middleware ──────────────────────────────────────────
    app.add_middleware(GlobalExceptionMiddleware)
    app.add_middleware(RequestLoggingMiddleware)

    # ── API v1 routers ─────────────────────────────────────────────
    PREFIX = "/api/v1"

    app.include_router(auth_router,          prefix=PREFIX)
    app.include_router(users_router,         prefix=PREFIX)
    app.include_router(subjects_router,      prefix=PREFIX)
    app.include_router(questions_router,     prefix=PREFIX)
    app.include_router(exams_router,         prefix=PREFIX)
    app.include_router(attempts_router,      prefix=PREFIX)
    app.include_router(results_router,       prefix=PREFIX)
    app.include_router(analytics_router,     prefix=PREFIX)
    app.include_router(leaderboard_router,   prefix=PREFIX)
    app.include_router(notifications_router, prefix=PREFIX)
    app.include_router(certificates_router,  prefix=PREFIX)
    app.include_router(audit_router,         prefix=PREFIX)

    # ── Health check ───────────────────────────────────────────────
    @app.get("/health", tags=["System"], include_in_schema=False)
    async def health():
        return JSONResponse({"status": "ok", "version": settings.APP_VERSION, "env": settings.ENVIRONMENT})

    @app.get("/", tags=["System"], include_in_schema=False)
    async def root():
        return {"message": "ExamDesk API", "docs": "/api/docs"}

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.WORKERS,
        log_level="debug" if settings.DEBUG else "info",
    )
