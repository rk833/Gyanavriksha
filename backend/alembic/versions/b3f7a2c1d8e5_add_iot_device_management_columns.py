"""add iot device management columns

Revision ID: b3f7a2c1d8e5
Revises: a1c9e3b72f4d
Create Date: 2026-04-20
"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3f7a2c1d8e5'
down_revision: Union[str, None] = 'a1c9e3b72f4d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('iot_devices', sa.Column('node_id', sa.String(100), nullable=True))
    op.add_column('iot_devices', sa.Column('device_type', sa.String(50), nullable=True))
    op.add_column('iot_devices', sa.Column('location', sa.String(150), nullable=True))
    op.add_column('iot_devices', sa.Column('status', sa.String(30), nullable=False, server_default='offline'))
    op.add_column('iot_devices', sa.Column('description', sa.Text, nullable=True))
    op.create_unique_constraint('uq_iot_devices_node_id', 'iot_devices', ['node_id'])


def downgrade() -> None:
    op.drop_constraint('uq_iot_devices_node_id', 'iot_devices', type_='unique')
    op.drop_column('iot_devices', 'description')
    op.drop_column('iot_devices', 'status')
    op.drop_column('iot_devices', 'location')
    op.drop_column('iot_devices', 'device_type')
    op.drop_column('iot_devices', 'node_id')
