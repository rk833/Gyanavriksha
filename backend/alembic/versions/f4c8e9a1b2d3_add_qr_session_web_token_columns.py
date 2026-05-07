"""add qr_sessions web token handoff columns

Revision ID: f4c8e9a1b2d3
Revises: d09f21e84c11
Create Date: 2026-05-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f4c8e9a1b2d3"
down_revision: Union[str, None] = "d09f21e84c11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "qr_sessions",
        sa.Column("web_access_token", sa.Text(), nullable=True),
    )
    op.add_column(
        "qr_sessions",
        sa.Column("web_refresh_token", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("qr_sessions", "web_refresh_token")
    op.drop_column("qr_sessions", "web_access_token")
