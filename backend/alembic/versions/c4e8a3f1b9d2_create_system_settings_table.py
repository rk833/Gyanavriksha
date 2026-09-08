"""create system_settings table

Revision ID: c4e8a3f1b9d2
Revises: b3f7a2c1d8e5
Create Date: 2026-04-20
"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c4e8a3f1b9d2'
down_revision: Union[str, None] = 'b3f7a2c1d8e5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key'),
    )


def downgrade() -> None:
    op.drop_table('system_settings')
