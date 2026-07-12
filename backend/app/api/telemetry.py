import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.enums import ClientErrorStatus, UserRole
from app.models.telemetry import AnalyticsEvent, ClientErrorReport
from app.models.user import User
from app.schemas.telemetry import (
    AnalyticsBatchInput,
    ClientErrorAccepted,
    ClientErrorInput,
    ErrorStatusUpdate,
    TelemetryAccepted,
)
from app.services.telemetry import (
    anonymized_user_id,
    forward_json,
    safe_route,
    scrub_pii,
    structured_log,
)

router = APIRouter()
admin_router = APIRouter()


def _enforce_content_length(request: Request, maximum: int) -> None:
    raw = request.headers.get("content-length")
    if raw:
        try:
            if int(raw) > maximum:
                raise HTTPException(status_code=413, detail="Telemetry payload too large")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length")


@router.post("/events", response_model=TelemetryAccepted, status_code=202)
async def ingest_analytics_events(
    body: AnalyticsBatchInput,
    request: Request,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    _enforce_content_length(request, 128 * 1024)
    forwarded: list[dict] = []
    for event in body.events:
        properties = dict(event.properties)
        platform = properties.pop("platform", None) or request.headers.get("x-platform")
        app_version = properties.pop("app_version", None) or request.headers.get(
            "x-app-version"
        )
        row = AnalyticsEvent(
            event_name=event.event,
            user_id=current_user.id if current_user else None,
            anonymous_id=event.anonymous_id,
            session_id=event.session_id,
            platform=scrub_pii(platform, max_length=40),
            app_version=scrub_pii(app_version, max_length=40),
            properties=properties,
            occurred_at=event.occurred_at,
        )
        db.add(row)
        forwarded.append(
            {
                "event": event.event,
                "properties": properties,
                "occurred_at": event.occurred_at.isoformat(),
                "platform": row.platform,
                "app_version": row.app_version,
                "authenticated": current_user is not None,
            }
        )
    await db.commit()
    structured_log(
        "analytics_batch_accepted",
        count=len(body.events),
        authenticated=current_user is not None,
        request_id=getattr(request.state, "request_id", None),
    )
    await forward_json(settings.ANALYTICS_FORWARD_URL, {"events": forwarded})
    return TelemetryAccepted(accepted=len(body.events))


@router.post("/errors", response_model=ClientErrorAccepted, status_code=202)
async def ingest_client_error(
    body: ClientErrorInput,
    request: Request,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    _enforce_content_length(request, 8 * 1024)
    request_id = getattr(request.state, "request_id", None) or uuid.uuid4().hex
    anonymous_id = anonymized_user_id(current_user.id if current_user else None)
    route = safe_route(body.route)
    report = ClientErrorReport(
        user_id=current_user.id if current_user else None,
        fingerprint=scrub_pii(body.stack_fingerprint, max_length=128),
        message=scrub_pii(body.error_code, max_length=100),
        source=body.error_kind,
        platform=body.platform,
        app_version=scrub_pii(body.release, max_length=40),
        severity="ERROR",
        context={
            "occurred_at": body.occurred_at.isoformat(),
            "environment": scrub_pii(body.environment, max_length=50),
            "route": route,
            "client_request_id": scrub_pii(body.request_id, max_length=128),
            "server_request_id": request_id,
            "status_code": body.status_code,
            "anonymous_user_id": anonymous_id,
            "ingest_route": request.url.path,
        },
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    forwarded = {
        "error_code": report.message,
        "error_kind": report.source,
        "fingerprint": report.fingerprint,
        "platform": report.platform,
        "release": report.app_version,
        **report.context,
    }
    structured_log(
        "client_error_accepted",
        report_id=report.id,
        platform=report.platform,
        request_id=request_id,
    )
    await forward_json(settings.CLIENT_ERROR_FORWARD_URL, forwarded)
    return ClientErrorAccepted(id=report.id, request_id=request_id)


async def _admin_only(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@admin_router.get("/errors")
async def list_client_errors(
    limit: int = Query(default=50, ge=1, le=200),
    _: User = Depends(_admin_only),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClientErrorReport)
        .order_by(ClientErrorReport.created_at.desc())
        .limit(limit)
    )
    return [
        {
            "id": item.id,
            "fingerprint": item.fingerprint,
            "error_code": item.message,
            "error_kind": item.source,
            "platform": item.platform,
            "app_version": item.app_version,
            "status": item.status.value,
            "context": item.context,
            "created_at": item.created_at,
        }
        for item in result.scalars().all()
    ]


@admin_router.patch("/errors/{report_id}")
async def update_client_error_status(
    report_id: int,
    body: ErrorStatusUpdate,
    current_user: User = Depends(_admin_only),
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(ClientErrorReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Client error not found")
    report.status = ClientErrorStatus(body.status)
    if report.status == ClientErrorStatus.RESOLVED:
        report.resolved_at = datetime.now(timezone.utc)
        report.resolved_by_id = current_user.id
    else:
        report.resolved_at = None
        report.resolved_by_id = None
    await db.commit()
    return {"id": report.id, "status": report.status.value}
