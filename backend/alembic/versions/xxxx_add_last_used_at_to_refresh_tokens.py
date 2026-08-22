"""add last_used_at to refresh_tokens

Revision ID: xxxx_add_last_used_at
Revises:
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "xxxx_add_last_used_at"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "refresh_tokens",
        sa.Column(
            "last_used_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("refresh_tokens", "last_used_at")