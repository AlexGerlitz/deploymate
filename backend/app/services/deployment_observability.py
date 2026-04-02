from datetime import datetime, timezone

from fastapi import HTTPException

from app.db import get_server_or_404, list_deployment_activity
from app.schemas import (
    DeploymentActivitySummaryResponse,
    DeploymentDiagnosticsResponse,
    DeploymentHealthResponse,
    DiagnosticItem,
)
from app.services.deployments import (
    get_container_logs,
    get_container_logs_tail,
    inspect_container_state,
    probe_http_endpoint,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_activity_summary(activity: list[dict]) -> DeploymentActivitySummaryResponse:
    success_events = sum(1 for item in activity if item.get("level") == "success")
    error_events = sum(1 for item in activity if item.get("level") == "error")
    recent_failure_titles = [
        item.get("title") or "Untitled event"
        for item in activity
        if item.get("level") == "error"
    ][:3]
    last_event = activity[0] if activity else None
    return DeploymentActivitySummaryResponse(
        total_events=len(activity),
        success_events=success_events,
        error_events=error_events,
        recent_failure_count=len(recent_failure_titles),
        recent_failure_titles=recent_failure_titles,
        last_event_title=last_event.get("title") if last_event else None,
        last_event_level=last_event.get("level") if last_event else None,
        last_event_at=last_event.get("created_at") if last_event else None,
    )


def build_deployment_health_response(
    deployment: dict,
    *,
    probe_http_endpoint_fn=probe_http_endpoint,
) -> DeploymentHealthResponse:
    deployment_id = deployment["id"]
    container_name = deployment["container_name"]
    external_port = deployment.get("external_port")
    checked_at = _now_iso()

    if not external_port:
        raise HTTPException(
            status_code=400,
            detail="Health check is available only for deployments with external_port.",
        )

    host = deployment.get("server_host") or "127.0.0.1"
    url = f"http://{host}:{external_port}"

    if deployment.get("status") != "running" or not deployment.get("container_id"):
        return DeploymentHealthResponse(
            deployment_id=deployment_id,
            container_name=container_name,
            url=None,
            status="unhealthy",
            status_code=None,
            error=deployment.get("error") or f"Deployment is {deployment.get('status', 'not running')}.",
            checked_at=checked_at,
            response_time_ms=None,
        )

    probe = probe_http_endpoint_fn(url, timeout=5.0)
    if probe["ok"]:
        return DeploymentHealthResponse(
            deployment_id=deployment_id,
            container_name=container_name,
            url=url,
            status="healthy",
            status_code=probe["status_code"],
            error=None,
            checked_at=checked_at,
            response_time_ms=probe["response_time_ms"],
        )

    status_code = probe.get("status_code")
    error = probe.get("error")
    if status_code is not None:
        error = f"Application returned status code {status_code}."

    return DeploymentHealthResponse(
        deployment_id=deployment_id,
        container_name=container_name,
        url=url,
        status="unhealthy",
        status_code=status_code,
        error=error,
        checked_at=checked_at,
        response_time_ms=probe["response_time_ms"],
    )


def build_deployment_diagnostics(
    deployment: dict,
    *,
    get_server_or_404_fn=get_server_or_404,
    list_deployment_activity_fn=list_deployment_activity,
    build_deployment_health_response_fn=build_deployment_health_response,
    inspect_container_state_fn=inspect_container_state,
    get_container_logs_tail_fn=get_container_logs_tail,
) -> DeploymentDiagnosticsResponse:
    server = get_server_or_404_fn(deployment["server_id"]) if deployment.get("server_id") else None
    try:
        health = build_deployment_health_response_fn(deployment)
    except HTTPException:
        health = DeploymentHealthResponse(
            deployment_id=deployment["id"],
            container_name=deployment["container_name"],
            url=None,
            status="unhealthy",
            status_code=None,
            error="Health check is unavailable because this deployment has no external port.",
            checked_at=_now_iso(),
            response_time_ms=None,
        )
    activity = list_deployment_activity_fn(deployment["id"])
    activity_summary = build_activity_summary(activity)
    server_target = (
        f'{server["username"]}@{server["host"]}:{server["port"]}'
        if server
        else "local host"
    )

    items: list[DiagnosticItem] = [
        DiagnosticItem(
            key="deployment_status",
            label="Deployment status",
            status="ok" if deployment.get("status") == "running" else "warn",
            summary=f'Current status is {deployment.get("status", "unknown")}.',
            details=deployment.get("error"),
        ),
        DiagnosticItem(
            key="health",
            label="HTTP health",
            status="ok" if health.status == "healthy" else "error",
            summary=(
                f'Health check responded with {health.status_code} in {health.response_time_ms} ms.'
                if health.status == "healthy" and health.status_code is not None
                else health.error or "Health check failed."
            ),
            details=health.url,
        ),
        DiagnosticItem(
            key="activity",
            label="Recent activity",
            status="error" if activity_summary.error_events else "ok",
            summary=(
                f"{activity_summary.total_events} events recorded, "
                f"{activity_summary.error_events} errors."
            ),
            details=activity_summary.last_event_title,
        ),
    ]

    container_state = inspect_container_state_fn(deployment["container_name"], server)
    if container_state:
        running = bool(container_state.get("Running"))
        restart_count = int(container_state.get("RestartCount") or 0)
        items.append(
            DiagnosticItem(
                key="container_runtime",
                label="Container runtime",
                status="ok" if running else "warn",
                summary="Container is running." if running else "Container is not running.",
                details=(
                    f"Started at {container_state.get('StartedAt') or 'unknown'}, "
                    f"restart count {restart_count}."
                ),
            )
        )
        if container_state.get("Error"):
            items.append(
                DiagnosticItem(
                    key="container_error",
                    label="Container state error",
                    status="error",
                    summary="Docker reported a container state error.",
                    details=str(container_state.get("Error")),
                )
            )
    else:
        items.append(
            DiagnosticItem(
                key="container_runtime",
                label="Container runtime",
                status="warn",
                summary="Container state is unavailable.",
                details="Container was not found during diagnostics.",
            )
        )

    logs_result = get_container_logs_tail_fn(deployment["container_name"], server, tail=30)
    log_excerpt = ""
    if logs_result.returncode == 0:
        log_excerpt = (logs_result.stdout.strip() or logs_result.stderr.strip())[-4000:]
        items.append(
            DiagnosticItem(
                key="logs",
                label="Recent logs",
                status="ok" if log_excerpt else "unknown",
                summary="Recent log excerpt collected." if log_excerpt else "No recent logs available.",
                details=None,
            )
        )
    else:
        log_error = logs_result.stderr.strip() or logs_result.stdout.strip()
        items.append(
            DiagnosticItem(
                key="logs",
                label="Recent logs",
                status="warn",
                summary="Recent logs could not be collected.",
                details=log_error or "docker logs failed.",
            )
        )

    return DeploymentDiagnosticsResponse(
        deployment_id=deployment["id"],
        container_name=deployment["container_name"],
        current_status=deployment.get("status", "unknown"),
        server_target=server_target,
        checked_at=_now_iso(),
        url=health.url,
        health=health,
        activity=activity_summary,
        log_excerpt=log_excerpt,
        items=items,
    )
