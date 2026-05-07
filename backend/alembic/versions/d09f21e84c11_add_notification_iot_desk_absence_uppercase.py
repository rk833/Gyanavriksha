"""align notification_type enum label with SQLAlchemy Python Enum names

SQLAlchemy persists NotificationType member *names* (e.g. IOT_DESK_ABSENCE), not
the str Enum values (iot_desk_absence). The prior revision added the lowercase
label only; add the uppercase label PostgreSQL expects.

Revision ID: d09f21e84c11
Revises: b82c94e71a03
Create Date: 2026-05-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d09f21e84c11"
down_revision: Union[str, None] = "b82c94e71a03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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


def downgrade() -> None:
    pass
