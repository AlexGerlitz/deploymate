import json
import uuid
from datetime import datetime, timezone
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException

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
    update_deployment_configuration,
    update_deployment_record,
)
from app.schemas import (
    DeploymentCreateRequest,
    DeploymentDeleteResponse,
    DeploymentHealthResponse,
    DeploymentLogsResponse,
    DeploymentResponse,
    DeploymentTemplateCreateRequest,
    DeploymentTemplateResponse,
    NotificationResponse,
)
from app.services.deployments import (
    build_container_name,
    ensure_container_name_is_available,
    ensure_docker_is_available,
    ensure_external_port_is_available,
    get_container_logs,
    remove_container_if_exists,
    run_container,
)
from app.services.auth import enforce_plan_limit, require_auth


router = APIRouter(dependencies=[Depends(require_auth)])


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


@router.get("/deployments", response_model=List[DeploymentResponse])
def list_deployments() -> List[DeploymentResponse]:
    deployments = list_deployment_records()
    return [DeploymentResponse(**deployment) for deployment in deployments]


@router.get("/deployment-templates", response_model=List[DeploymentTemplateResponse])
def list_templates() -> List[DeploymentTemplateResponse]:
    templates = list_deployment_templates()
    return [DeploymentTemplateResponse(**template) for template in templates]


@router.post("/deployment-templates", response_model=DeploymentTemplateResponse)
def create_template(
    payload: DeploymentTemplateCreateRequest,
) -> DeploymentTemplateResponse:
    if (payload.internal_port is None) != (payload.external_port is None):
        raise HTTPException(
            status_code=400,
            detail="internal_port and external_port must be provided together.",
        )

    if payload.server_id:
        get_server_or_404(payload.server_id)

    template_id = str(uuid.uuid4())
    template_record = {
        "id": template_id,
        "template_name": payload.template_name.strip(),
        "image": payload.image,
        "name": payload.name.strip() if payload.name else None,
        "internal_port": payload.internal_port,
        "external_port": payload.external_port,
        "server_id": payload.server_id,
        "env": json.dumps(payload.env),
        "created_at": datetime.now(timezone.utc),
    }

    insert_deployment_template(template_record)
    saved_template = get_deployment_template_or_404(template_id)
    return DeploymentTemplateResponse(**saved_template)


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
    enforce_plan_limit(user, "deployments")
    server = get_server_or_404(payload.server_id) if payload.server_id else None
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
    return [NotificationResponse(**item) for item in activity]


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
    container_name = deployment["container_name"]
    external_port = deployment.get("external_port")

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
        )

    try:
        response = httpx.get(url, timeout=5.0)
        if 200 <= response.status_code < 400:
            return DeploymentHealthResponse(
                deployment_id=deployment_id,
                container_name=container_name,
                url=url,
                status="healthy",
                status_code=response.status_code,
                error=None,
            )

        return DeploymentHealthResponse(
            deployment_id=deployment_id,
            container_name=container_name,
            url=url,
            status="unhealthy",
            status_code=response.status_code,
            error=f"Application returned status code {response.status_code}.",
        )
    except httpx.RequestError as exc:
        return DeploymentHealthResponse(
            deployment_id=deployment_id,
            container_name=container_name,
            url=url,
            status="unhealthy",
            status_code=None,
            error=str(exc),
        )
