"""add grade_id to users

Revision ID: f3a9b2c8d1e7
Revises: c4e8a3f1b9d2
Create Date: 2026-04-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3a9b2c8d1e7'
down_revision: Union[str, None] = 'c4e8a3f1b9d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('grade_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_users_grade_id',
        'users',
        'grades',
        ['grade_id'],
        ['grade_id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_users_grade_id', 'users', type_='foreignkey')
    op.drop_column('users', 'grade_id')
