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
    DeploymentCreateRequest,
    DeploymentDiagnosticsResponse,
    DeploymentDeleteResponse,
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
    remove_container_if_exists,
    run_container,
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
from app.services.deployment_mutations import (
    create_deployment as _service_create_deployment,
    delete_deployment as _service_delete_deployment,
    normalize_runtime_error as _service_normalize_runtime_error,
    redeploy_deployment as _service_redeploy_deployment,
)
from app.services.deployment_templates import (
    build_template_record as _service_build_template_record,
    create_template as _service_create_template,
    delete_template as _service_delete_template,
    deploy_from_template as _service_deploy_from_template,
    duplicate_template as _service_duplicate_template,
    list_templates as _service_list_templates,
    update_template as _service_update_template,
    validate_template_payload as _service_validate_template_payload,
)
from app.services.auth import enforce_plan_limit, require_auth


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


def _build_template_record(
    template_id: str,
    payload: DeploymentTemplateCreateRequest,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
    last_used_at: datetime | None = None,
    use_count: int = 0,
) -> dict:
    return _service_build_template_record(
        template_id,
        payload,
        created_at=created_at,
        updated_at=updated_at,
        last_used_at=last_used_at,
        use_count=use_count,
    )


def _validate_template_payload(payload: DeploymentTemplateCreateRequest) -> None:
    _service_validate_template_payload(
        payload,
        get_server_or_404_fn=get_server_or_404,
        ensure_runtime_target_allowed_fn=ensure_runtime_target_allowed,
    )


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
    return _service_list_templates(
        state=state,
        q=q,
        list_deployment_templates_fn=list_deployment_templates,
    )


@router.post("/deployment-templates", response_model=DeploymentTemplateResponse)
def create_template(
    payload: DeploymentTemplateCreateRequest,
) -> DeploymentTemplateResponse:
    return _service_create_template(
        payload,
        validate_template_payload_fn=_validate_template_payload,
        insert_deployment_template_fn=insert_deployment_template,
        get_deployment_template_or_404_fn=get_deployment_template_or_404,
    )


@router.put(
    "/deployment-templates/{template_id}",
    response_model=DeploymentTemplateResponse,
)
def update_template_endpoint(
    template_id: str,
    payload: DeploymentTemplateCreateRequest,
) -> DeploymentTemplateResponse:
    return _service_update_template(
        template_id,
        payload,
        get_deployment_template_or_404_fn=get_deployment_template_or_404,
        validate_template_payload_fn=_validate_template_payload,
        update_deployment_template_fn=update_deployment_template,
    )


@router.post(
    "/deployment-templates/{template_id}/duplicate",
    response_model=DeploymentTemplateResponse,
)
def duplicate_template(
    template_id: str,
    payload: DeploymentTemplateDuplicateRequest | None = None,
) -> DeploymentTemplateResponse:
    return _service_duplicate_template(
        template_id,
        payload,
        get_deployment_template_or_404_fn=get_deployment_template_or_404,
        insert_deployment_template_fn=insert_deployment_template,
    )


@router.post(
    "/deployment-templates/{template_id}/deploy",
    response_model=DeploymentResponse,
)
def deploy_from_template(
    template_id: str,
    user=Depends(require_auth),
) -> DeploymentResponse:
    return _service_deploy_from_template(
        template_id,
        user,
        get_deployment_template_or_404_fn=get_deployment_template_or_404,
        create_deployment_fn=_create_deployment,
        mark_deployment_template_used_fn=mark_deployment_template_used,
    )


@router.delete(
    "/deployment-templates/{template_id}",
    response_model=DeploymentTemplateResponse,
)
def delete_template(template_id: str) -> DeploymentTemplateResponse:
    return _service_delete_template(
        template_id,
        get_deployment_template_or_404_fn=get_deployment_template_or_404,
        delete_deployment_template_record_fn=delete_deployment_template_record,
    )


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
    return _service_redeploy_deployment(
        deployment_id,
        payload,
        get_deployment_record_or_404_fn=get_deployment_record_or_404,
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
    return _service_delete_deployment(
        deployment_id,
        get_deployment_record_or_404_fn=get_deployment_record_or_404,
        get_server_or_404_fn=get_server_or_404,
        ensure_docker_is_available_fn=ensure_docker_is_available,
        remove_container_if_exists_fn=remove_container_if_exists,
        create_notification_fn=create_notification,
        create_activity_event_fn=create_activity_event,
        delete_deployment_record_fn=delete_deployment_record,
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
