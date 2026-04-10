from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import (
    create_activity_event,
    create_notification,
    delete_deployment_record,
    get_server_or_404,
    get_deployment_record_or_404,
    insert_deployment_record,
    list_deployment_activity,
    list_deployment_records,
    update_deployment_configuration,
    update_deployment_record,
)
from app.schemas import (
    DeploymentCreateRequest,
    DeploymentDeleteResponse,
    DeploymentResponse,
)
from app.services.deployments import (
    ensure_container_name_is_available,
    ensure_docker_is_available,
    ensure_external_port_is_available,
    ensure_runtime_target_allowed,
    remove_container_if_exists,
    run_container,
)
from app.services.deployment_mutations import (
    create_deployment as _service_create_deployment,
    delete_deployment as _service_delete_deployment,
    normalize_runtime_error as _service_normalize_runtime_error,
    redeploy_deployment as _service_redeploy_deployment,
)
from app.services.deployment_observability import (
    build_activity_summary as _service_build_activity_summary,
    build_deployment_diagnostics as _service_build_deployment_diagnostics,
    build_deployment_health_response as _service_build_deployment_health_response,
    get_container_logs,
    get_container_logs_tail,
    inspect_container_state,
    probe_http_endpoint,
)
from app.services.auth import (
    enforce_plan_limit,
    ensure_remote_server_access_allowed,
    require_auth,
    user_is_admin,
)


router = APIRouter(dependencies=[Depends(require_auth)])


def _normalize_runtime_error(message: str | None, fallback: str) -> str:
    return _service_normalize_runtime_error(message, fallback)


def _create_deployment(
    payload: DeploymentCreateRequest,
    user,
) -> DeploymentResponse:
    return _service_create_deployment(
        payload,
        user,
        enforce_plan_limit_fn=enforce_plan_limit,
        get_server_or_404_fn=get_server_or_404,
        ensure_remote_server_access_allowed_fn=ensure_remote_server_access_allowed,
        ensure_runtime_target_allowed_fn=ensure_runtime_target_allowed,
        ensure_docker_is_available_fn=ensure_docker_is_available,
        ensure_external_port_is_available_fn=ensure_external_port_is_available,
        ensure_container_name_is_available_fn=ensure_container_name_is_available,
        insert_deployment_record_fn=insert_deployment_record,
        run_container_fn=run_container,
        update_deployment_record_fn=update_deployment_record,
        create_notification_fn=create_notification,
        create_activity_event_fn=create_activity_event,
        get_deployment_record_or_404_fn=get_deployment_record_or_404,
    )


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


def _build_deployment_health_response(deployment: dict):
    return _service_build_deployment_health_response(
        deployment,
        probe_http_endpoint_fn=probe_http_endpoint,
    )


def _build_deployment_diagnostics(deployment: dict):
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


def _list_user_deployments(user: dict) -> list[dict]:
    deployments = list_deployment_records()
    if user_is_admin(user):
        return deployments
    return [item for item in deployments if _deployment_visible_to_user(item, user)]


def _get_user_deployment_or_404(deployment_id: str, user: dict) -> dict:
    deployment = get_deployment_record_or_404(deployment_id)
    if _deployment_visible_to_user(deployment, user):
        return deployment
    raise HTTPException(status_code=404, detail="Deployment not found.")


@router.get("/deployments", response_model=List[DeploymentResponse])
def list_deployments(
    status: str = Query(default="all", pattern="^(all|running|failed|pending)$"),
    q: str = Query(default=""),
    server_id: str = Query(default=""),
    user=Depends(require_auth),
) -> List[DeploymentResponse]:
    deployments = _list_user_deployments(user)
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
    user=Depends(require_auth),
) -> DeploymentResponse:
    return _service_redeploy_deployment(
        deployment_id,
        payload,
        get_deployment_record_or_404_fn=lambda current_id: _get_user_deployment_or_404(current_id, user),
        get_server_or_404_fn=get_server_or_404,
        ensure_runtime_target_allowed_fn=ensure_runtime_target_allowed,
        ensure_docker_is_available_fn=ensure_docker_is_available,
        ensure_external_port_is_available_fn=ensure_external_port_is_available,
        ensure_container_name_is_available_fn=ensure_container_name_is_available,
        remove_container_if_exists_fn=remove_container_if_exists,
        update_deployment_configuration_fn=update_deployment_configuration,
        update_deployment_record_fn=update_deployment_record,
        run_container_fn=run_container,
        create_notification_fn=create_notification,
        create_activity_event_fn=create_activity_event,
    )


@router.get("/deployments/{deployment_id}", response_model=DeploymentResponse)
def get_deployment(deployment_id: str, user=Depends(require_auth)) -> DeploymentResponse:
    deployment = _get_user_deployment_or_404(deployment_id, user)
    return DeploymentResponse(**deployment)


@router.delete("/deployments/{deployment_id}", response_model=DeploymentDeleteResponse)
def delete_deployment(deployment_id: str, user=Depends(require_auth)) -> DeploymentDeleteResponse:
    return _service_delete_deployment(
        deployment_id,
        get_deployment_record_or_404_fn=lambda current_id: _get_user_deployment_or_404(current_id, user),
        get_server_or_404_fn=get_server_or_404,
        ensure_docker_is_available_fn=ensure_docker_is_available,
        remove_container_if_exists_fn=remove_container_if_exists,
        create_notification_fn=create_notification,
        create_activity_event_fn=create_activity_event,
        delete_deployment_record_fn=delete_deployment_record,
    )
