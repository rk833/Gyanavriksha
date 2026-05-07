"""add exam_sessions.ended_reason and notification_type.IOT_DESK_ABSENCE

Revision ID: b82c94e71a03
Revises: b7c9d01e42af
Create Date: 2026-05-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b82c94e71a03"
down_revision: Union[str, None] = "b7c9d01e42af"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enum add-value: duplicate_object is harmless on re-run (PostgreSQL).
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
              ALTER TYPE notification_type ADD VALUE 'IOT_DESK_ABSENCE';
            EXCEPTION
              WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )
    op.add_column(
        "exam_sessions",
        sa.Column("ended_reason", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("exam_sessions", "ended_reason")
