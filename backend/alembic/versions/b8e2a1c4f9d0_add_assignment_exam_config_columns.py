"""add assignment exam config columns

Revision ID: b8e2a1c4f9d0
Revises: 4f1ec220d248
Create Date: 2026-05-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8e2a1c4f9d0"
down_revision: Union[str, None] = "4f1ec220d248"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "assignments",
        sa.Column("exam_duration_minutes", sa.Integer(), nullable=True),
    )
    op.add_column(
        "assignments",
        sa.Column("exam_max_pauses", sa.Integer(), nullable=True),
    )
    op.add_column(
        "assignments",
        sa.Column(
            "exam_strict_proctor",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("assignments", "exam_strict_proctor")
    op.drop_column("assignments", "exam_max_pauses")
    op.drop_column("assignments", "exam_duration_minutes")
