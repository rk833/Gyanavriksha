"""add support tickets table

Revision ID: d5e6f7a8b9c0
Revises: c1d2e3f4a5b6
Create Date: 2026-05-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "d5e6f7a8b9c0"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_tickets",
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="Medium"),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("attachment_name", sa.String(length=255), nullable=True),
        sa.Column("attachment_path", sa.Text(), nullable=True),
        sa.Column("attachment_content_type", sa.String(length=120), nullable=True),
        sa.Column("attachment_size_bytes", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("ticket_id"),
    )
    op.create_index(op.f("ix_support_tickets_email"), "support_tickets", ["email"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_support_tickets_email"), table_name="support_tickets")
    op.drop_table("support_tickets")
