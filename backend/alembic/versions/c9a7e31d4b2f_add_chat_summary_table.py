"""add chat_summary table

Revision ID: c9a7e31d4b2f
Revises: a1c9e3b72f4d
Create Date: 2026-05-04 00:00:00.000000

"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c9a7e31d4b2f'
down_revision: Union[str, None] = 'a1c9e3b72f4d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'chat_summary',
        sa.Column('chat_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('summary', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('chat_id'),
    )


def downgrade() -> None:
    op.drop_table('chat_summary')
