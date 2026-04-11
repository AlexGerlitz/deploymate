from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_deployment_record_or_404, get_server_or_404, list_deployment_activity
from app.schemas import (
    DeploymentDiagnosticsResponse,
    DeploymentHealthResponse,
    DeploymentLogsResponse,
    NotificationResponse,
)
from app.services.auth import require_auth, user_is_admin
from app.services.deployment_observability import (
    build_activity_summary as _service_build_activity_summary,
    build_deployment_diagnostics as _service_build_deployment_diagnostics,
    build_deployment_health_response as _service_build_deployment_health_response,
    get_container_logs,
    get_container_logs_tail,
    inspect_container_state,
    probe_http_endpoint,
)
from app.services.deployments import ensure_docker_is_available
from app.services.runtime_access import (
    ensure_remote_runtime_action_allowed,
    sanitize_activity_events_for_user,
)


router = APIRouter(dependencies=[Depends(require_auth)])


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


def _build_activity_summary(activity: list[dict]):
    return _service_build_activity_summary(activity)


def _build_deployment_health_response(deployment: dict) -> DeploymentHealthResponse:
    return _service_build_deployment_health_response(
        deployment,
        probe_http_endpoint_fn=probe_http_endpoint,
    )


def _build_deployment_diagnostics(deployment: dict) -> DeploymentDiagnosticsResponse:
    return _service_build_deployment_diagnostics(
        deployment,
        get_server_or_404_fn=get_server_or_404,
        list_deployment_activity_fn=list_deployment_activity,
        build_deployment_health_response_fn=_build_deployment_health_response,
        inspect_container_state_fn=inspect_container_state,
        get_container_logs_tail_fn=get_container_logs_tail,
    )


def _deployment_visible_to_user(deployment: dict, user: dict) -> bool:
    return user_is_admin(user) or deployment.get("owner_user_id") == user["id"]


def _get_user_deployment_or_404(deployment_id: str, user: dict) -> dict:
    deployment = get_deployment_record_or_404(deployment_id)
    if _deployment_visible_to_user(deployment, user):
        return deployment
    raise HTTPException(status_code=404, detail="Deployment not found.")


@router.get("/deployments/{deployment_id}/activity", response_model=List[NotificationResponse])
def get_deployment_activity(deployment_id: str, user=Depends(require_auth)) -> List[NotificationResponse]:
    deployment = _get_user_deployment_or_404(deployment_id, user)
    activity = list_deployment_activity(deployment_id)
    return [
        NotificationResponse(**item, category=_infer_activity_category(item.get("title"), item.get("message")))
        for item in sanitize_activity_events_for_user(activity, deployment, user)
    ]


@router.get(
    "/deployments/{deployment_id}/diagnostics",
    response_model=DeploymentDiagnosticsResponse,
)
def get_deployment_diagnostics(
    deployment_id: str,
    user=Depends(require_auth),
) -> DeploymentDiagnosticsResponse:
    deployment = _get_user_deployment_or_404(deployment_id, user)
    ensure_remote_runtime_action_allowed(deployment, user, action="Remote runtime diagnostics")
    return _build_deployment_diagnostics(deployment)


@router.get("/deployments/{deployment_id}/logs", response_model=DeploymentLogsResponse)
def get_deployment_logs(deployment_id: str, user=Depends(require_auth)) -> DeploymentLogsResponse:
    deployment = _get_user_deployment_or_404(deployment_id, user)
    ensure_remote_runtime_action_allowed(deployment, user, action="Remote runtime logs")
    container_name = deployment["container_name"]

    if deployment.get("status") != "running" or not deployment.get("container_id"):
        return DeploymentLogsResponse(
            deployment_id=deployment_id,
            container_name=container_name,
            logs=deployment.get("error") or "",
        )

    server = None
    if deployment.get("server_id"):
        try:
            server = get_server_or_404(deployment["server_id"])
        except HTTPException as exc:
            if exc.status_code == 404:
                return DeploymentLogsResponse(
                    deployment_id=deployment_id,
                    container_name=container_name,
                    logs="Logs are unavailable because the saved server target could not be loaded.",
                )
            raise

    ensure_docker_is_available(server)

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
def get_deployment_health(deployment_id: str, user=Depends(require_auth)) -> DeploymentHealthResponse:
    deployment = _get_user_deployment_or_404(deployment_id, user)
    ensure_remote_runtime_action_allowed(deployment, user, action="Remote runtime health checks")
    return _build_deployment_health_response(deployment)
