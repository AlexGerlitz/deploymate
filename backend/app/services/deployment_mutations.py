import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from app.schemas import DeploymentCreateRequest, DeploymentDeleteResponse, DeploymentResponse
from app.services.deployments import build_container_name


def normalize_runtime_error(message: str | None, fallback: str) -> str:
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


def create_deployment(
    payload: DeploymentCreateRequest,
    user,
    *,
    enforce_plan_limit_fn,
    get_server_or_404_fn,
    ensure_runtime_target_allowed_fn,
    ensure_docker_is_available_fn,
    ensure_external_port_is_available_fn,
    ensure_container_name_is_available_fn,
    insert_deployment_record_fn,
    run_container_fn,
    update_deployment_record_fn,
    create_notification_fn,
    create_activity_event_fn,
    get_deployment_record_or_404_fn,
) -> DeploymentResponse:
    enforce_plan_limit_fn(user, "deployments")
    server = get_server_or_404_fn(payload.server_id) if payload.server_id else None
    ensure_runtime_target_allowed_fn(server)
    ensure_docker_is_available_fn(server)
    ensure_external_port_is_available_fn(payload.external_port, server)

    if (payload.internal_port is None) != (payload.external_port is None):
        raise HTTPException(
            status_code=400,
            detail="internal_port and external_port must be provided together.",
        )

    deployment_id = str(uuid.uuid4())
    container_name = build_container_name(payload.name, deployment_id)
    ensure_container_name_is_available_fn(container_name, server)

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

    insert_deployment_record_fn(deployment_record)

    result = run_container_fn(
        image=payload.image,
        container_name=container_name,
        internal_port=payload.internal_port,
        external_port=payload.external_port,
        env=payload.env,
        server=server,
    )

    if result.returncode != 0:
        error_message = normalize_runtime_error(
            result.stderr.strip() or result.stdout.strip(),
            "Docker run failed.",
        )
        update_deployment_record_fn(
            deployment_id=deployment_id,
            status="failed",
            container_id=None,
            error=error_message,
        )
        create_notification_fn(
            deployment_id=deployment_id,
            level="error",
            title="Deployment failed",
            message=f"Deployment {deployment_id} failed: {error_message}",
        )
        create_activity_event_fn(
            deployment_id=deployment_id,
            level="error",
            title="Deployment failed",
            message=f"Deployment {deployment_id} failed: {error_message}",
        )
        saved_record = get_deployment_record_or_404_fn(deployment_id)
        return DeploymentResponse(**saved_record)

    container_id = result.stdout.strip()
    update_deployment_record_fn(
        deployment_id=deployment_id,
        status="running",
        container_id=container_id,
        error=None,
    )
    create_notification_fn(
        deployment_id=deployment_id,
        level="success",
        title="Deployment succeeded",
        message=f"Deployment {deployment_id} is running in container {container_name}.",
    )
    create_activity_event_fn(
        deployment_id=deployment_id,
        level="success",
        title="Deployment succeeded",
        message=f"Deployment {deployment_id} is running in container {container_name}.",
    )

    saved_record = get_deployment_record_or_404_fn(deployment_id)
    return DeploymentResponse(**saved_record)


def redeploy_deployment(
    deployment_id: str,
    payload: DeploymentCreateRequest,
    *,
    get_deployment_record_or_404_fn,
    get_server_or_404_fn,
    ensure_runtime_target_allowed_fn,
    ensure_docker_is_available_fn,
    ensure_external_port_is_available_fn,
    ensure_container_name_is_available_fn,
    remove_container_if_exists_fn,
    update_deployment_configuration_fn,
    update_deployment_record_fn,
    run_container_fn,
    create_notification_fn,
    create_activity_event_fn,
) -> DeploymentResponse:
    if (payload.internal_port is None) != (payload.external_port is None):
        raise HTTPException(
            status_code=400,
            detail="internal_port and external_port must be provided together.",
        )

    existing_deployment = get_deployment_record_or_404_fn(deployment_id)
    server = get_server_or_404_fn(existing_deployment["server_id"]) if existing_deployment.get("server_id") else None
    ensure_runtime_target_allowed_fn(server)
    ensure_docker_is_available_fn(server)
    if (
        payload.external_port is not None
        and payload.external_port != existing_deployment.get("external_port")
    ):
        ensure_external_port_is_available_fn(payload.external_port, server)
    container_name = payload.name or existing_deployment["container_name"]
    if container_name != existing_deployment["container_name"]:
        ensure_container_name_is_available_fn(container_name, server)

    try:
        remove_container_if_exists_fn(existing_deployment["container_name"], server)
    except HTTPException as exc:
        error_message = normalize_runtime_error(exc.detail, "Failed to redeploy deployment.")
        update_deployment_record_fn(
            deployment_id=deployment_id,
            status="failed",
            container_id=None,
            error=error_message,
        )
        create_notification_fn(
            deployment_id=deployment_id,
            level="error",
            title="Redeploy failed",
            message=f"Redeploy for {deployment_id} failed: {error_message}",
        )
        create_activity_event_fn(
            deployment_id=deployment_id,
            level="error",
            title="Redeploy failed",
            message=f"Redeploy for {deployment_id} failed: {error_message}",
        )
        raise HTTPException(status_code=exc.status_code, detail=error_message) from exc

    update_deployment_configuration_fn(
        deployment_id=deployment_id,
        image=payload.image,
        container_name=container_name,
        internal_port=payload.internal_port,
        external_port=payload.external_port,
        env=payload.env,
    )
    update_deployment_record_fn(
        deployment_id=deployment_id,
        status="pending",
        container_id=None,
        error=None,
    )

    result = run_container_fn(
        image=payload.image,
        container_name=container_name,
        internal_port=payload.internal_port,
        external_port=payload.external_port,
        env=payload.env,
        server=server,
    )

    if result.returncode != 0:
        error_message = normalize_runtime_error(
            result.stderr.strip() or result.stdout.strip(),
            "Docker run failed.",
        )
        update_deployment_record_fn(
            deployment_id=deployment_id,
            status="failed",
            container_id=None,
            error=error_message,
        )
        create_notification_fn(
            deployment_id=deployment_id,
            level="error",
            title="Redeploy failed",
            message=f"Redeploy for {deployment_id} failed: {error_message}",
        )
        create_activity_event_fn(
            deployment_id=deployment_id,
            level="error",
            title="Redeploy failed",
            message=f"Redeploy for {deployment_id} failed: {error_message}",
        )
        saved_record = get_deployment_record_or_404_fn(deployment_id)
        return DeploymentResponse(**saved_record)

    container_id = result.stdout.strip()
    update_deployment_record_fn(
        deployment_id=deployment_id,
        status="running",
        container_id=container_id,
        error=None,
    )
    create_notification_fn(
        deployment_id=deployment_id,
        level="success",
        title="Redeploy succeeded",
        message=f"Deployment {deployment_id} was redeployed in container {container_name}.",
    )
    create_activity_event_fn(
        deployment_id=deployment_id,
        level="success",
        title="Redeploy succeeded",
        message=f"Deployment {deployment_id} was redeployed in container {container_name}.",
    )

    saved_record = get_deployment_record_or_404_fn(deployment_id)
    return DeploymentResponse(**saved_record)


def delete_deployment(
    deployment_id: str,
    *,
    get_deployment_record_or_404_fn,
    get_server_or_404_fn,
    ensure_docker_is_available_fn,
    remove_container_if_exists_fn,
    create_notification_fn,
    create_activity_event_fn,
    delete_deployment_record_fn,
) -> DeploymentDeleteResponse:
    deployment = get_deployment_record_or_404_fn(deployment_id)
    server = get_server_or_404_fn(deployment["server_id"]) if deployment.get("server_id") else None
    ensure_docker_is_available_fn(server)
    try:
        remove_container_if_exists_fn(deployment["container_name"], server)
    except HTTPException as exc:
        error_message = normalize_runtime_error(exc.detail, "Failed to delete deployment.")
        create_notification_fn(
            deployment_id=deployment_id,
            level="error",
            title="Delete failed",
            message=f"Delete for {deployment_id} failed: {error_message}",
        )
        create_activity_event_fn(
            deployment_id=deployment_id,
            level="error",
            title="Delete failed",
            message=f"Delete for {deployment_id} failed: {error_message}",
        )
        raise HTTPException(status_code=exc.status_code, detail=error_message) from exc

    create_notification_fn(
        deployment_id=deployment_id,
        level="success",
        title="Delete succeeded",
        message=f"Deployment {deployment_id} was deleted.",
    )
    create_activity_event_fn(
        deployment_id=deployment_id,
        level="success",
        title="Delete succeeded",
        message=f"Deployment {deployment_id} was deleted.",
    )
    delete_deployment_record_fn(deployment_id)

    return DeploymentDeleteResponse(
        deployment_id=deployment_id,
        status="deleted",
    )
