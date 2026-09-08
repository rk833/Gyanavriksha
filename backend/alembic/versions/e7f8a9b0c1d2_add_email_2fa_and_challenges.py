"""add email_2fa_enabled and two_factor_email_challenges

Revision ID: e7f8a9b0c1d2
Revises: f4c8e9a1b2d3
Create Date: 2026-05-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "f4c8e9a1b2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "email_2fa_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    op.create_table(
        "two_factor_email_challenges",
        sa.Column("challenge_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default="now()", nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("challenge_id"),
    )
    op.create_index(
        "ix_two_factor_email_challenges_user_id",
        "two_factor_email_challenges",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_two_factor_email_challenges_user_id", table_name="two_factor_email_challenges")
    op.drop_table("two_factor_email_challenges")
    op.drop_column("users", "email_2fa_enabled")
