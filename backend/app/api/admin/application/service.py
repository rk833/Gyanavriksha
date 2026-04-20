"""Application-layer use cases for the admin bounded context.

Each function orchestrates one admin-facing operation: calls the underlying
service layer, maps results and errors to response schemas or HTTPExceptions,
and keeps the presentation layer free of business logic.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.admin import AdminDashboardResponse, SystemHealthSummary
from app.services import admin_service


def _build_stub_health() -> SystemHealthSummary:
    """Return a placeholder system health snapshot until live metrics are wired up."""
    return SystemHealthSummary(
        node_uptime_pct=99.9,
        memory_load_pct=64.0,
        live_monitoring_active=True,
    )


def get_dashboard(db: Session) -> AdminDashboardResponse:
    """Return the aggregated admin control panel overview.

    Real IoT, ChromaDB, and integrity data will be wired up in a later phase.
    This stub validates the route is reachable and role-guarded.
    """
    stats = admin_service.get_platform_stats(db)
    two_fa = stats["two_fa_compliance"]

    return AdminDashboardResponse(
        iot_nodes_active=0,
        chromadb_accuracy_pct=None,
        two_fa_compliance_pct=two_fa["compliance_pct"],
        iot_registry_preview=[],
        integrity_status="No audit run yet",
        integrity_verified_count=0,
        quick_user_access=[],
        system_health=_build_stub_health(),
    )


def _raise_if_not_found(obj: object, detail: str) -> None:
    """Raise HTTP 404 when a required resource is missing."""
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _raise_if_last_admin(db: Session, user_id: object) -> None:
    """Raise HTTP 400 when an operation would remove the last active admin."""
    if admin_service.count_active_admins(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot perform this action on the last active admin",
        )
