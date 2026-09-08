"""add must_change_password to users

Revision ID: c1d2e3f4a5b6
Revises: a8b9c0d1e2f3
Create Date: 2026-05-07

"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = 'a8b9c0d1e2f3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'must_change_password',
            sa.Boolean(),
            nullable=False,
            server_default='false',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'must_change_password')
