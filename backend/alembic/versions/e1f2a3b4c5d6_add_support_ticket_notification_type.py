"""add support_ticket value to notification_type enum

Revision ID: e1f2a3b4c5d6
Revises: d5e6f7a8b9c0
Create Date: 2026-05-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add both the uppercase name (used by SQLAlchemy) and lowercase value
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
              ALTER TYPE notification_type ADD VALUE 'SUPPORT_TICKET';
            EXCEPTION
              WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
              ALTER TYPE notification_type ADD VALUE 'support_ticket';
            EXCEPTION
              WHEN duplicate_object THEN NULL;
            END $$;
            """
        )
    )


def downgrade() -> None:
    pass
