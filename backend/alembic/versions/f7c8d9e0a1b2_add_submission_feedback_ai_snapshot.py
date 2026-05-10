"""add submission_feedback.ai_snapshot for instructor vs AI UI

Revision ID: f7c8d9e0a1b2
Revises: b8e2a1c4f9d0
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f7c8d9e0a1b2"
down_revision: Union[str, None] = "b8e2a1c4f9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "submission_feedback",
        sa.Column("ai_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("submission_feedback", "ai_snapshot")
