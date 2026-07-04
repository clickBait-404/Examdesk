"""
ExamDesk — Middleware
- Request/response logging
- Correlation ID injection
- Global exception handler
"""

import time
import uuid
import logging
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("examdesk")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        correlation_id = str(uuid.uuid4())[:8]
        request.state.correlation_id = correlation_id

        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Response-Time"] = f"{duration_ms}ms"

        logger.info(
            f"[{correlation_id}] {request.method} {request.url.path} "
            f"→ {response.status_code} ({duration_ms}ms)"
        )
        return response


class GlobalExceptionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error. Please try again later."},
            )
