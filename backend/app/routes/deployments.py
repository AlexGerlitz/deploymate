import json
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import (
    create_activity_event,
    create_notification,
    delete_deployment_record,
    delete_deployment_template_record,
    get_server_or_404,
    get_deployment_record_or_404,
    get_deployment_template_or_404,
    insert_deployment_record,
    insert_deployment_template,
    list_deployment_activity,
    list_deployment_records,
    list_deployment_templates,
    mark_deployment_template_used,
    update_deployment_configuration,
    update_deployment_record,
    update_deployment_template,
)
from app.schemas import (
    DeploymentActivitySummaryResponse,
    DeploymentCreateRequest,
    DeploymentDiagnosticsResponse,
    DeploymentDeleteResponse,
    DiagnosticItem,
    DeploymentHealthResponse,
    DeploymentLogsResponse,
    DeploymentResponse,
    DeploymentTemplateCreateRequest,
    DeploymentTemplateDuplicateRequest,
    DeploymentTemplateResponse,
    NotificationResponse,
)
from app.services.deployments import (
    build_container_name,
    ensure_container_name_is_available,
    ensure_docker_is_available,
    ensure_external_port_is_available,
    ensure_runtime_target_allowed,
    get_container_logs,
    get_container_logs_tail,
    inspect_container_state,
    probe_http_endpoint,
    remove_container_if_exists,
    run_container,
)
from app.services.auth import enforce_plan_limit, require_auth


router = APIRouter(dependencies=[Depends(require_auth)])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_runtime_error(message: str | None, fallback: str) -> str:
    text = (message or "").strip()
    if not text:
        return fallback

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return fallback

    text = " ".join(lines)
    text = text.replace("docker: Error response from daemon:", "")
    text = text.replace("Error response from daemon:", "")
    text = text.replace("docker:", "")

    if "See 'docker run --help'." in text:
        text = text.split("See 'docker run --help'.", 1)[0].strip()

    return text.strip() or fallback


def _create_deployment(
    payload: DeploymentCreateRequest,
    user,
) -> DeploymentResponse:
    enforce_plan_limit(user, "deployments")
    server = get_server_or_404(payload.server_id) if payload.server_id else None
    ensure_runtime_target_allowed(server)
    ensure_docker_is_available(server)
    ensure_external_port_is_available(payload.external_port, server)

    if (payload.internal_port is None) != (payload.external_port is None):
        raise HTTPException(
            status_code=400,
            detail="internal_port and external_port must be provided together.",
        )

    deployment_id = str(uuid.uuid4())
    container_name = build_container_name(payload.name, deployment_id)
    ensure_container_name_is_available(container_name, server)

    deployment_record = {
        "id": deployment_id,
        "status": "pending",
        "image": payload.image,
        "container_name": container_name,
        "container_id": None,
        "created_at": datetime.now(timezone.utc),
        "error": None,
        "internal_port": payload.internal_port,
        "external_port": payload.external_port,
        "server_id": payload.server_id,
        "env": json.dumps(payload.env),
    }

    insert_deployment_record(deployment_record)

    result = run_container(
        image=payload.image,
        container_name=container_name,
        internal_port=payload.internal_port,
        external_port=payload.external_port,
        env=payload.env,
        server=server,
    )

    if result.returncode != 0:
        error_message = _normalize_runtime_error(
            result.stderr.strip() or result.stdout.strip(),
            "Docker run failed.",
        )
        update_deployment_record(
            deployment_id=deployment_id,
            status="failed",
            container_id=None,
            error=error_message,
        )
        create_notification(
            deployment_id=deployment_id,
            level="error",
            title="Deployment failed",
            message=f"Deployment {deployment_id} failed: {error_message}",
        )
        create_activity_event(
            deployment_id=deployment_id,
            level="error",
            title="Deployment failed",
            message=f"Deployment {deployment_id} failed: {error_message}",
        )
        saved_record = get_deployment_record_or_404(deployment_id)
        return DeploymentResponse(**saved_record)

    container_id = result.stdout.strip()
    update_deployment_record(
        deployment_id=deployment_id,
        status="running",
        container_id=container_id,
        error=None,
    )
    create_notification(
        deployment_id=deployment_id,
        level="success",
        title="Deployment succeeded",
        message=f"Deployment {deployment_id} is running in container {container_name}.",
    )
    create_activity_event(
        deployment_id=deployment_id,
        level="success",
        title="Deployment succeeded",
        message=f"Deployment {deployment_id} is running in container {container_name}.",
    )

    saved_record = get_deployment_record_or_404(deployment_id)
    return DeploymentResponse(**saved_record)


def _infer_activity_category(title: str | None, message: str | None) -> str | None:
    haystack = " ".join(filter(None, [title, message])).lower()
    if not haystack:
        return None
    if "redeploy" in haystack:
        return "redeploy"
    if "delete" in haystack:
        return "delete"
    if "health" in haystack:
        return "health"
    if "deploy" in haystack:
        return "deploy"
    return "general"


def _build_activity_summary(activity: list[dict]) -> DeploymentActivitySummaryResponse:
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


def _build_deployment_health_response(deployment: dict) -> DeploymentHealthResponse:
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

    probe = probe_http_endpoint(url, timeout=5.0)
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


def _build_deployment_diagnostics(deployment: dict) -> DeploymentDiagnosticsResponse:
    server = get_server_or_404(deployment["server_id"]) if deployment.get("server_id") else None
    try:
        health = _build_deployment_health_response(deployment)
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
    activity = list_deployment_activity(deployment["id"])
    activity_summary = _build_activity_summary(activity)
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

    container_state = inspect_container_state(deployment["container_name"], server)
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

    logs_result = get_container_logs_tail(deployment["container_name"], server, tail=30)
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


def _build_template_record(
    template_id: str,
    payload: DeploymentTemplateCreateRequest,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
    last_used_at: datetime | None = None,
    use_count: int = 0,
) -> dict:
    created = created_at or datetime.now(timezone.utc)
    updated = updated_at or created
    return {
        "id": template_id,
        "template_name": payload.template_name.strip(),
        "image": payload.image.strip(),
        "name": payload.name.strip() if payload.name else None,
        "internal_port": payload.internal_port,
        "external_port": payload.external_port,
        "server_id": payload.server_id,
        "env": json.dumps(payload.env),
        "created_at": created,
        "updated_at": updated,
        "last_used_at": last_used_at,
        "use_count": use_count,
    }


def _validate_template_payload(payload: DeploymentTemplateCreateRequest) -> None:
    if (payload.internal_port is None) != (payload.external_port is None):
        raise HTTPException(
            status_code=400,
            detail="internal_port and external_port must be provided together.",
        )

    if payload.server_id:
        get_server_or_404(payload.server_id)
        return

    ensure_runtime_target_allowed(None)


@router.get("/deployments", response_model=List[DeploymentResponse])
def list_deployments(
    status: str = Query(default="all", pattern="^(all|running|failed|pending)$"),
    q: str = Query(default=""),
    server_id: str = Query(default=""),
) -> List[DeploymentResponse]:
    deployments = list_deployment_records()
    normalized_query = q.strip().lower()
    normalized_server_id = server_id.strip()
    filtered = []
    for deployment in deployments:
        if status != "all" and deployment.get("status") != status:
            continue
        if normalized_server_id and (deployment.get("server_id") or "") != normalized_server_id:
            continue
        if normalized_query:
            haystack = " ".join(
                filter(
                    None,
                    [
                        deployment.get("image"),
                        deployment.get("container_name"),
                        deployment.get("server_name"),
                        deployment.get("server_host"),
                        deployment.get("status"),
                    ],
                )
            ).lower()
            if normalized_query not in haystack:
                continue
        filtered.append(DeploymentResponse(**deployment))
    return filtered


@router.get("/deployment-templates", response_model=List[DeploymentTemplateResponse])
def list_templates(
    state: str = Query(default="all", pattern="^(all|unused|recent|popular)$"),
    q: str = Query(default=""),
) -> List[DeploymentTemplateResponse]:
    templates = list_deployment_templates()
    normalized_query = q.strip().lower()
    filtered: list[DeploymentTemplateResponse] = []

    for template in templates:
        use_count = int(template.get("use_count") or 0)
        if state == "unused" and use_count > 0:
            continue
        if state == "recent":
            last_used_at = template.get("last_used_at")
            if not last_used_at:
                continue
            try:
                parsed = datetime.fromisoformat(last_used_at.replace("Z", "+00:00"))
            except ValueError:
                continue
            if (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds() > 7 * 24 * 60 * 60:
                continue
        if state == "popular" and use_count == 0:
            continue

        if normalized_query:
            haystack = " ".join(
                filter(
                    None,
                    [
                        template.get("template_name"),
                        template.get("image"),
                        template.get("name"),
                        template.get("server_name"),
                        template.get("server_host"),
                        " ".join((template.get("env") or {}).keys()),
                        " ".join(str(value) for value in (template.get("env") or {}).values()),
                    ],
                )
            ).lower()
            if normalized_query not in haystack:
                continue

        filtered.append(DeploymentTemplateResponse(**template))

    if state == "popular":
        filtered.sort(key=lambda item: item.use_count, reverse=True)
    elif state == "recent":
        filtered.sort(key=lambda item: item.last_used_at or "", reverse=True)

    return filtered


@router.post("/deployment-templates", response_model=DeploymentTemplateResponse)
def create_template(
    payload: DeploymentTemplateCreateRequest,
) -> DeploymentTemplateResponse:
    _validate_template_payload(payload)
    template_id = str(uuid.uuid4())
    template_record = _build_template_record(template_id, payload)

    insert_deployment_template(template_record)
    saved_template = get_deployment_template_or_404(template_id)
    return DeploymentTemplateResponse(**saved_template)


@router.put(
    "/deployment-templates/{template_id}",
    response_model=DeploymentTemplateResponse,
)
def update_template_endpoint(
    template_id: str,
    payload: DeploymentTemplateCreateRequest,
) -> DeploymentTemplateResponse:
    existing_template = get_deployment_template_or_404(template_id)
    _validate_template_payload(payload)
    update_deployment_template(
        template_id,
        {
            "template_name": payload.template_name.strip(),
            "image": payload.image.strip(),
            "name": payload.name.strip() if payload.name else None,
            "internal_port": payload.internal_port,
            "external_port": payload.external_port,
            "server_id": payload.server_id,
            "env": json.dumps(payload.env),
            "updated_at": datetime.now(timezone.utc),
        },
    )
    saved_template = get_deployment_template_or_404(template_id)
    if saved_template["id"] != existing_template["id"]:
        raise HTTPException(status_code=500, detail="Template update failed.")
    return DeploymentTemplateResponse(**saved_template)


@router.post(
    "/deployment-templates/{template_id}/duplicate",
    response_model=DeploymentTemplateResponse,
)
def duplicate_template(
    template_id: str,
    payload: DeploymentTemplateDuplicateRequest | None = None,
) -> DeploymentTemplateResponse:
    template = get_deployment_template_or_404(template_id)
    duplicate_id = str(uuid.uuid4())
    duplicate_name = (
        payload.template_name.strip()
        if payload and payload.template_name
        else f"{template['template_name']} copy"
    )
    template_record = {
        "id": duplicate_id,
        "template_name": duplicate_name,
        "image": template["image"],
        "name": template.get("name"),
        "internal_port": template.get("internal_port"),
        "external_port": template.get("external_port"),
        "server_id": template.get("server_id"),
        "env": json.dumps(template.get("env") or {}),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "last_used_at": None,
        "use_count": 0,
    }
    insert_deployment_template(template_record)
    saved_template = get_deployment_template_or_404(duplicate_id)
    return DeploymentTemplateResponse(**saved_template)


@router.post(
    "/deployment-templates/{template_id}/deploy",
    response_model=DeploymentResponse,
)
def deploy_from_template(
    template_id: str,
    user=Depends(require_auth),
) -> DeploymentResponse:
    template = get_deployment_template_or_404(template_id)
    payload = DeploymentCreateRequest(
        image=template["image"],
        name=template.get("name"),
        internal_port=template.get("internal_port"),
        external_port=template.get("external_port"),
        server_id=template.get("server_id"),
        env=template.get("env") or {},
    )
    deployment = _create_deployment(payload, user)
    mark_deployment_template_used(template_id)
    return deployment


@router.delete(
    "/deployment-templates/{template_id}",
    response_model=DeploymentTemplateResponse,
)
def delete_template(template_id: str) -> DeploymentTemplateResponse:
    template = get_deployment_template_or_404(template_id)
    delete_deployment_template_record(template_id)
    return DeploymentTemplateResponse(**template)


@router.post("/deployments", response_model=DeploymentResponse)
def create_deployment_endpoint(
    payload: DeploymentCreateRequest,
    user=Depends(require_auth),
) -> DeploymentResponse:
    return _create_deployment(payload, user)


@router.post("/deployments/{deployment_id}/redeploy", response_model=DeploymentResponse)
def redeploy_deployment(
    deployment_id: str,
    payload: DeploymentCreateRequest,
) -> DeploymentResponse:
    if (payload.internal_port is None) != (payload.external_port is None):
        raise HTTPException(
            status_code=400,
            detail="internal_port and external_port must be provided together.",
        )

    existing_deployment = get_deployment_record_or_404(deployment_id)
    server = get_server_or_404(existing_deployment["server_id"]) if existing_deployment.get("server_id") else None
    ensure_runtime_target_allowed(server)
    ensure_docker_is_available(server)
    if (
        payload.external_port is not None
        and payload.external_port != existing_deployment.get("external_port")
    ):
        ensure_external_port_is_available(payload.external_port, server)
    container_name = payload.name or existing_deployment["container_name"]
    if container_name != existing_deployment["container_name"]:
        ensure_container_name_is_available(container_name, server)

    try:
        remove_container_if_exists(existing_deployment["container_name"], server)
    except HTTPException as exc:
        error_message = _normalize_runtime_error(exc.detail, "Failed to redeploy deployment.")
        update_deployment_record(
            deployment_id=deployment_id,
            status="failed",
            container_id=None,
            error=error_message,
        )
        create_notification(
            deployment_id=deployment_id,
            level="error",
            title="Redeploy failed",
            message=f"Redeploy for {deployment_id} failed: {error_message}",
        )
        create_activity_event(
            deployment_id=deployment_id,
            level="error",
            title="Redeploy failed",
            message=f"Redeploy for {deployment_id} failed: {error_message}",
        )
        raise HTTPException(status_code=exc.status_code, detail=error_message) from exc

    update_deployment_configuration(
        deployment_id=deployment_id,
        image=payload.image,
        container_name=container_name,
        internal_port=payload.internal_port,
        external_port=payload.external_port,
        env=payload.env,
    )
    update_deployment_record(
        deployment_id=deployment_id,
        status="pending",
        container_id=None,
        error=None,
    )

    result = run_container(
        image=payload.image,
        container_name=container_name,
        internal_port=payload.internal_port,
        external_port=payload.external_port,
        env=payload.env,
        server=server,
    )

    if result.returncode != 0:
        error_message = _normalize_runtime_error(
            result.stderr.strip() or result.stdout.strip(),
            "Docker run failed.",
        )
        update_deployment_record(
            deployment_id=deployment_id,
            status="failed",
            container_id=None,
            error=error_message,
        )
        create_notification(
            deployment_id=deployment_id,
            level="error",
            title="Redeploy failed",
            message=f"Redeploy for {deployment_id} failed: {error_message}",
        )
        create_activity_event(
            deployment_id=deployment_id,
            level="error",
            title="Redeploy failed",
            message=f"Redeploy for {deployment_id} failed: {error_message}",
        )
        saved_record = get_deployment_record_or_404(deployment_id)
        return DeploymentResponse(**saved_record)

    container_id = result.stdout.strip()
    update_deployment_record(
        deployment_id=deployment_id,
        status="running",
        container_id=container_id,
        error=None,
    )
    create_notification(
        deployment_id=deployment_id,
        level="success",
        title="Redeploy succeeded",
        message=f"Deployment {deployment_id} was redeployed in container {container_name}.",
    )
    create_activity_event(
        deployment_id=deployment_id,
        level="success",
        title="Redeploy succeeded",
        message=f"Deployment {deployment_id} was redeployed in container {container_name}.",
    )

    saved_record = get_deployment_record_or_404(deployment_id)
    return DeploymentResponse(**saved_record)


@router.get("/deployments/{deployment_id}", response_model=DeploymentResponse)
def get_deployment(deployment_id: str) -> DeploymentResponse:
    deployment = get_deployment_record_or_404(deployment_id)
    return DeploymentResponse(**deployment)


@router.get("/deployments/{deployment_id}/activity", response_model=List[NotificationResponse])
def get_deployment_activity(deployment_id: str) -> List[NotificationResponse]:
    get_deployment_record_or_404(deployment_id)
    activity = list_deployment_activity(deployment_id)
    return [
        NotificationResponse(**item, category=_infer_activity_category(item.get("title"), item.get("message")))
        for item in activity
    ]


@router.get(
    "/deployments/{deployment_id}/diagnostics",
    response_model=DeploymentDiagnosticsResponse,
)
def get_deployment_diagnostics(deployment_id: str) -> DeploymentDiagnosticsResponse:
    deployment = get_deployment_record_or_404(deployment_id)
    return _build_deployment_diagnostics(deployment)


@router.delete("/deployments/{deployment_id}", response_model=DeploymentDeleteResponse)
def delete_deployment(deployment_id: str) -> DeploymentDeleteResponse:
    deployment = get_deployment_record_or_404(deployment_id)
    server = get_server_or_404(deployment["server_id"]) if deployment.get("server_id") else None
    ensure_docker_is_available(server)
    try:
        remove_container_if_exists(deployment["container_name"], server)
    except HTTPException as exc:
        error_message = _normalize_runtime_error(exc.detail, "Failed to delete deployment.")
        create_notification(
            deployment_id=deployment_id,
            level="error",
            title="Delete failed",
            message=f"Delete for {deployment_id} failed: {error_message}",
        )
        create_activity_event(
            deployment_id=deployment_id,
            level="error",
            title="Delete failed",
            message=f"Delete for {deployment_id} failed: {error_message}",
        )
        raise HTTPException(status_code=exc.status_code, detail=error_message) from exc

    create_notification(
        deployment_id=deployment_id,
        level="success",
        title="Delete succeeded",
        message=f"Deployment {deployment_id} was deleted.",
    )
    create_activity_event(
        deployment_id=deployment_id,
        level="success",
        title="Delete succeeded",
        message=f"Deployment {deployment_id} was deleted.",
    )
    delete_deployment_record(deployment_id)

    return DeploymentDeleteResponse(
        deployment_id=deployment_id,
        status="deleted",
    )


@router.get("/deployments/{deployment_id}/logs", response_model=DeploymentLogsResponse)
def get_deployment_logs(deployment_id: str) -> DeploymentLogsResponse:
    deployment = get_deployment_record_or_404(deployment_id)
    server = get_server_or_404(deployment["server_id"]) if deployment.get("server_id") else None
    ensure_docker_is_available(server)
    container_name = deployment["container_name"]

    if deployment.get("status") != "running" or not deployment.get("container_id"):
        return DeploymentLogsResponse(
            deployment_id=deployment_id,
            container_name=container_name,
            logs=deployment.get("error") or "",
        )

    result = get_container_logs(container_name, server)

    if result.returncode != 0:
        error_message = result.stderr.strip() or result.stdout.strip()
        if "No such container" in error_message:
            return DeploymentLogsResponse(
                deployment_id=deployment_id,
                container_name=container_name,
                logs=deployment.get("error") or "",
            )
        raise HTTPException(
            status_code=500,
            detail=error_message or "Failed to get container logs.",
        )

    logs_output = result.stdout.strip()
    if not logs_output:
        logs_output = result.stderr.strip()

    return DeploymentLogsResponse(
        deployment_id=deployment_id,
        container_name=container_name,
        logs=logs_output,
    )


@router.get("/deployments/{deployment_id}/health", response_model=DeploymentHealthResponse)
def get_deployment_health(deployment_id: str) -> DeploymentHealthResponse:
    deployment = get_deployment_record_or_404(deployment_id)
    return _build_deployment_health_response(deployment)
