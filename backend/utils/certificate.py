"""
ExamDesk — Certificate Utilities
Verification code generation and validation.
"""

import hashlib
import hmac
from uuid import UUID

from config import settings


def generate_verification_code(result_id: UUID, student_id: UUID) -> str:
    """
    Generate a deterministic, tamper-proof verification code.
    Format: ED-XXXXXXXX (12 hex chars, uppercase)
    """
    payload = f"{result_id}:{student_id}:{settings.CERT_SECRET_KEY}"
    digest = hmac.new(
        settings.CERT_SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    code = digest[:12].upper()
    return f"ED-{code}"


def verify_code(code: str, result_id: UUID, student_id: UUID) -> bool:
    """Re-generate and compare to verify certificate authenticity."""
    expected = generate_verification_code(result_id, student_id)
    return hmac.compare_digest(code, expected)
