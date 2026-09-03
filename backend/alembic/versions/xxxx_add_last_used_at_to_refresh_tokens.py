"""add exam_updated to auditaction enum

Needed for the exam edit-mode fix: PUT /exams/{id} now logs an
AuditAction.exam_updated entry, so the DB enum must know that value.

Revision ID: xxxx_add_exam_updated
Revises: xxxx_add_last_used_at
Create Date: 2026-09-03
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "xxxx_add_exam_updated"
down_revision = "xxxx_add_last_used_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres requires ALTER TYPE ... ADD VALUE to run outside a
    # transaction block (it's not transactional before PG 12, and even
    # on newer versions can't be combined with using the new value in
    # the same transaction). autocommit_block() handles that for us.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'exam_updated'")


def downgrade() -> None:
    # Postgres has no direct "remove enum value" support. Leaving the
    # extra value in place on downgrade is safe — it just goes unused.
    pass
