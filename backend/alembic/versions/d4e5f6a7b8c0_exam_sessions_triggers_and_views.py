"""exam_sessions: triggers (integrity) + reporting views

Revision ID: d4e5f6a7b8c0
Revises: f7c8d9e0a1b2
Create Date: 2026-05-05

Adds:
- 3 BEFORE triggers on exam_sessions (UTC started_at default, timestamp sanity, immutable keys)
- 3 views for SQL / BI / admin consoles (active sessions, joined detail, per-assignment stats)
"""
from typing import Sequence, Union

from alembic import op

revision: str = "d4e5f6a7b8c0"
down_revision: Union[str, None] = "f7c8d9e0a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION fn_exam_sessions_bi_default_started_at()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.started_at IS NULL THEN
                NEW.started_at := timezone('utc', now());
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_exam_sessions_bi_default_started_at
        BEFORE INSERT ON exam_sessions
        FOR EACH ROW
        EXECUTE PROCEDURE fn_exam_sessions_bi_default_started_at();
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION fn_exam_sessions_biu_validate_timestamps()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.ended_at IS NOT NULL AND NEW.ended_at < NEW.started_at THEN
                RAISE EXCEPTION 'exam_sessions: ended_at must be greater than or equal to started_at';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_exam_sessions_biu_validate_timestamps
        BEFORE INSERT OR UPDATE ON exam_sessions
        FOR EACH ROW
        EXECUTE PROCEDURE fn_exam_sessions_biu_validate_timestamps();
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION fn_exam_sessions_bu_immutable_keys()
        RETURNS TRIGGER AS $$
        BEGIN
            IF OLD.student_id IS DISTINCT FROM NEW.student_id
               OR OLD.assignment_id IS DISTINCT FROM NEW.assignment_id THEN
                RAISE EXCEPTION 'exam_sessions: student_id and assignment_id cannot be changed';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_exam_sessions_bu_immutable_keys
        BEFORE UPDATE ON exam_sessions
        FOR EACH ROW
        EXECUTE PROCEDURE fn_exam_sessions_bu_immutable_keys();
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW v_exam_sessions_active AS
        SELECT
            es.session_id,
            es.student_id,
            es.assignment_id,
            es.started_at,
            es.status,
            es.pause_count,
            es.total_paused_seconds,
            es.absence_alert_count
        FROM exam_sessions es
        WHERE es.ended_at IS NULL
          AND es.status IN ('active', 'paused');
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW v_exam_session_detail AS
        SELECT
            es.session_id,
            es.student_id,
            u.full_name AS student_name,
            u.email AS student_email,
            es.assignment_id,
            a.title AS assignment_title,
            s.subject_name,
            es.started_at,
            es.ended_at,
            es.status,
            es.pause_count,
            es.total_paused_seconds,
            es.absence_alert_count,
            es.device_id
        FROM exam_sessions es
        JOIN users u ON u.user_id = es.student_id
        JOIN assignments a ON a.assignment_id = es.assignment_id
        JOIN subjects s ON s.subject_id = a.subject_id;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE VIEW v_exam_sessions_per_assignment_stats AS
        SELECT
            es.assignment_id,
            COUNT(*)::bigint AS session_count,
            COUNT(*) FILTER (WHERE es.status = 'completed')::bigint AS completed_count,
            COUNT(*) FILTER (WHERE es.status = 'terminated')::bigint AS terminated_count,
            COUNT(*) FILTER (WHERE es.ended_at IS NULL AND es.status IN ('active', 'paused'))::bigint AS active_count
        FROM exam_sessions es
        GROUP BY es.assignment_id;
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_exam_sessions_per_assignment_stats")
    op.execute("DROP VIEW IF EXISTS v_exam_session_detail")
    op.execute("DROP VIEW IF EXISTS v_exam_sessions_active")

    op.execute(
        "DROP TRIGGER IF EXISTS trg_exam_sessions_bu_immutable_keys ON exam_sessions"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS trg_exam_sessions_biu_validate_timestamps ON exam_sessions"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS trg_exam_sessions_bi_default_started_at ON exam_sessions"
    )

    op.execute("DROP FUNCTION IF EXISTS fn_exam_sessions_bu_immutable_keys()")
    op.execute("DROP FUNCTION IF EXISTS fn_exam_sessions_biu_validate_timestamps()")
    op.execute("DROP FUNCTION IF EXISTS fn_exam_sessions_bi_default_started_at()")
