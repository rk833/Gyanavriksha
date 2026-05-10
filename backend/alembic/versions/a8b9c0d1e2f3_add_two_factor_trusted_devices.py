"""add two_factor_trusted_devices for 2FA remember-device

Revision ID: a8b9c0d1e2f3
Revises: e7f8a9b0c1d2
Create Date: 2026-05-07

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "two_factor_trusted_devices",
        sa.Column("trust_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default="now()", nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("trust_id"),
    )
    op.create_index(
        "ix_two_factor_trusted_devices_user_id",
        "two_factor_trusted_devices",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_two_factor_trusted_devices_token_hash",
        "two_factor_trusted_devices",
        ["token_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_two_factor_trusted_devices_token_hash", table_name="two_factor_trusted_devices")
    op.drop_index("ix_two_factor_trusted_devices_user_id", table_name="two_factor_trusted_devices")
    op.drop_table("two_factor_trusted_devices")
