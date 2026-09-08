"""add notification_preferences json to users

Revision ID: b7c9d01e42af
Revises: a3f1d8c2e907, d4e5f6a7b8c0
Create Date: 2026-05-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b7c9d01e42af"
down_revision: Union[str, tuple[str, ...], None] = ("a3f1d8c2e907", "d4e5f6a7b8c0")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "notification_preferences",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "notification_preferences")
