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


def describe_runtime_target(server: dict | None) -> str:
    if not server:
        return "local Docker target"
    return f'{server.get("username") or "deploy"}@{server.get("host") or "unknown-host"}:{server.get("port") or 22}'


def describe_port_mapping(internal_port: int | None, external_port: int | None) -> str:
    if internal_port is None and external_port is None:
        return "no published ports"
    return f"{internal_port or '-'} -> {external_port or '-'}"


def describe_env_shape(env: dict | None) -> str:
    count = len(env or {})
    return f"{count} env var{'s' if count != 1 else ''}"


def build_create_start_message(payload: DeploymentCreateRequest, server: dict | None, container_name: str) -> str:
    return (
        f"Starting deployment for {payload.image} as {container_name} on "
        f"{describe_runtime_target(server)} with ports "
        f"{describe_port_mapping(payload.internal_port, payload.external_port)} "
        f"and {describe_env_shape(payload.env)}."
    )


def build_redeploy_start_message(existing: dict, payload: DeploymentCreateRequest, server: dict | None, container_name: str) -> str:
    return (
        f"Starting redeploy for {existing['id']} from {existing.get('image') or 'unknown image'} "
        f"to {payload.image} on {describe_runtime_target(server)}. "
        f"Container: {existing.get('container_name') or existing['id']} -> {container_name}. "
        f"Ports: {describe_port_mapping(existing.get('internal_port'), existing.get('external_port'))} -> "
        f"{describe_port_mapping(payload.internal_port, payload.external_port)}. "
        f"Env: {describe_env_shape(existing.get('env') or {})} -> {describe_env_shape(payload.env)}."
    )


def build_delete_start_message(deployment: dict, server: dict | None) -> str:
    return (
        f"Starting delete for {deployment['id']} on {describe_runtime_target(server)}. "
        f"Container {deployment.get('container_name') or deployment['id']} will be removed if it still exists."
    )


def create_deployment(
    payload: DeploymentCreateRequest,
    user,
    *,
    enforce_plan_limit_fn,
    get_server_or_404_fn,
    ensure_remote_server_access_allowed_fn,
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
    ensure_remote_server_access_allowed_fn(user, server)
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
        "owner_user_id": user["id"],
        "created_at": datetime.now(timezone.utc),
        "error": None,
        "internal_port": payload.internal_port,
        "external_port": payload.external_port,
        "server_id": payload.server_id,
        "env": json.dumps(payload.env),
    }

    insert_deployment_record_fn(deployment_record)
    create_activity_event_fn(
        deployment_id=deployment_id,
        level="success",
        title="Deployment started",
        message=build_create_start_message(payload, server, container_name),
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
            title="Deployment failed",
            message=f"Deployment {deployment_id} failed: {error_message}",
        )
        create_activity_event_fn(
            deployment_id=deployment_id,
            level="error",
            title="Deployment failed",
            message=(
                f"Deployment {deployment_id} failed on {describe_runtime_target(server)}: "
                f"{error_message}"
            ),
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
    create_activity_event_fn(
        deployment_id=deployment_id,
        level="success",
        title="Redeploy started",
        message=build_redeploy_start_message(
            existing_deployment,
            payload,
            server,
            container_name,
        ),
    )

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
            message=(
                f"Redeploy for {deployment_id} failed on {describe_runtime_target(server)} "
                f"while preparing {payload.image}: {error_message}"
            ),
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
            message=(
                f"Redeploy for {deployment_id} failed on {describe_runtime_target(server)} "
                f"while starting {container_name}: {error_message}"
            ),
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
    create_activity_event_fn(
        deployment_id=deployment_id,
        level="success",
        title="Delete started",
        message=build_delete_start_message(deployment, server),
    )
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
            message=(
                f"Delete for {deployment_id} failed on {describe_runtime_target(server)}: "
                f"{error_message}"
            ),
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
