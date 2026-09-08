"""add chat_history column to chat_summary

Revision ID: e12f4c6b9a01
Revises: c9a7e31d4b2f
Create Date: 2026-05-04 01:00:00.000000

"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'e12f4c6b9a01'
down_revision: Union[str, None] = 'c9a7e31d4b2f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'chat_summary',
        sa.Column('chat_history', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.execute("UPDATE chat_summary SET chat_history = '[]'::jsonb WHERE chat_history IS NULL")
    op.alter_column('chat_summary', 'chat_history', nullable=False)


def downgrade() -> None:
    op.drop_column('chat_summary', 'chat_history')
