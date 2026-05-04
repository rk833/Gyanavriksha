"""update_concept_heatmap_entries_add_student_proficiency

Revision ID: 4f1ec220d248
Revises: a3f1d8c2e907
Create Date: 2026-05-05 01:37:11.528612

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '4f1ec220d248'
down_revision: Union[str, None] = 'a3f1d8c2e907'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'chat_history',
        sa.Column('history_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.Text(), nullable=False),
        sa.Column('summary', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default='now()', nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default='now()', nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.subject_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('history_id'),
    )
    op.create_index(op.f('ix_chat_history_student_id'), 'chat_history', ['student_id'], unique=False)
    op.create_index(op.f('ix_chat_history_subject_id'), 'chat_history', ['subject_id'], unique=False)

    op.add_column('concept_heatmap_entries', sa.Column('student_id', sa.UUID(), nullable=True))
    op.add_column('concept_heatmap_entries', sa.Column('proficiency_score', sa.Float(), nullable=True))
    op.drop_constraint('uq_heatmap_subject_topic', 'concept_heatmap_entries', type_='unique')
    op.create_index(op.f('ix_concept_heatmap_entries_student_id'), 'concept_heatmap_entries', ['student_id'], unique=False)
    op.create_unique_constraint('uq_heatmap_student_subject_topic', 'concept_heatmap_entries', ['student_id', 'subject_id', 'topic_tag'])
    op.create_foreign_key(None, 'concept_heatmap_entries', 'users', ['student_id'], ['user_id'], ondelete='CASCADE')
    op.drop_column('concept_heatmap_entries', 'severity_score')
    op.drop_column('concept_heatmap_entries', 'affected_student_count')

    op.add_column('knowledge_gaps', sa.Column('history_id', sa.UUID(), nullable=True))
    op.alter_column('knowledge_gaps', 'submission_id', existing_type=sa.UUID(), nullable=True)
    op.create_foreign_key(None, 'knowledge_gaps', 'chat_history', ['history_id'], ['history_id'])


def downgrade() -> None:
    op.drop_constraint(None, 'knowledge_gaps', type_='foreignkey')
    op.alter_column('knowledge_gaps', 'submission_id', existing_type=sa.UUID(), nullable=False)
    op.drop_column('knowledge_gaps', 'history_id')

    op.add_column('concept_heatmap_entries', sa.Column('affected_student_count', sa.INTEGER(), server_default=sa.text('1'), autoincrement=False, nullable=False))
    op.add_column('concept_heatmap_entries', sa.Column('severity_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'concept_heatmap_entries', type_='foreignkey')
    op.drop_constraint('uq_heatmap_student_subject_topic', 'concept_heatmap_entries', type_='unique')
    op.drop_index(op.f('ix_concept_heatmap_entries_student_id'), table_name='concept_heatmap_entries')
    op.create_unique_constraint('uq_heatmap_subject_topic', 'concept_heatmap_entries', ['subject_id', 'topic_tag'])
    op.drop_column('concept_heatmap_entries', 'proficiency_score')
    op.drop_column('concept_heatmap_entries', 'student_id')

    op.drop_index(op.f('ix_chat_history_subject_id'), table_name='chat_history')
    op.drop_index(op.f('ix_chat_history_student_id'), table_name='chat_history')
    op.drop_table('chat_history')
