"""merge chat_summary branch with iot/settings branch

Revision ID: a3f1d8c2e907
Revises: e12f4c6b9a01, f3a9b2c8d1e7
Create Date: 2026-05-05 00:00:00.000000

"""
from typing import Union

from alembic import op

revision: str = 'a3f1d8c2e907'
down_revision: Union[tuple, None] = ('e12f4c6b9a01', 'f3a9b2c8d1e7')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
