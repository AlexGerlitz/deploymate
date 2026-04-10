from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import (
    delete_deployment_template_record,
    get_deployment_template_or_404,
    get_server_or_404,
    insert_deployment_template,
    list_deployment_templates,
    mark_deployment_template_used,
    update_deployment_template,
)
from app.schemas import (
    DeploymentCreateRequest,
    DeploymentResponse,
    DeploymentTemplateCreateRequest,
    DeploymentTemplateDuplicateRequest,
    DeploymentTemplateResponse,
)
from app.services.auth import ensure_remote_server_access_allowed, require_auth, user_is_admin
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
from app.services.deployments import ensure_runtime_target_allowed


router = APIRouter(dependencies=[Depends(require_auth)])


def _create_deployment(payload: DeploymentCreateRequest, user):
    from app.routes.deployments import _create_deployment as deployment_create

    return deployment_create(payload, user)


def _build_template_record(
    template_id: str,
    payload: DeploymentTemplateCreateRequest,
    created_at=None,
    updated_at=None,
    last_used_at=None,
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


def _template_visible_to_user(template: dict, user: dict) -> bool:
    return user_is_admin(user) or template.get("owner_user_id") == user["id"]


def _list_user_templates(user: dict) -> list[dict]:
    templates = list_deployment_templates()
    if user_is_admin(user):
        return templates
    return [item for item in templates if _template_visible_to_user(item, user)]


def _get_user_template_or_404(template_id: str, user: dict) -> dict:
    template = get_deployment_template_or_404(template_id)
    if _template_visible_to_user(template, user):
        return template
    raise HTTPException(status_code=404, detail="Deployment template not found.")


def _validate_template_payload_for_user(payload: DeploymentTemplateCreateRequest, user: dict) -> None:
    _service_validate_template_payload(
        payload,
        user,
        get_server_or_404_fn=get_server_or_404,
        ensure_remote_server_access_allowed_fn=ensure_remote_server_access_allowed,
        ensure_runtime_target_allowed_fn=ensure_runtime_target_allowed,
    )


@router.get("/deployment-templates", response_model=List[DeploymentTemplateResponse])
def list_templates(
    state: str = Query(default="all", pattern="^(all|unused|recent|popular)$"),
    q: str = Query(default=""),
    user=Depends(require_auth),
) -> List[DeploymentTemplateResponse]:
    return _service_list_templates(
        state=state,
        q=q,
        list_deployment_templates_fn=lambda: _list_user_templates(user),
    )


@router.post("/deployment-templates", response_model=DeploymentTemplateResponse)
def create_template(
    payload: DeploymentTemplateCreateRequest,
    user=Depends(require_auth),
) -> DeploymentTemplateResponse:
    return _service_create_template(
        payload,
        user,
        validate_template_payload_fn=_validate_template_payload_for_user,
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
    user=Depends(require_auth),
) -> DeploymentTemplateResponse:
    return _service_update_template(
        template_id,
        payload,
        user,
        get_deployment_template_or_404_fn=lambda current_id: _get_user_template_or_404(current_id, user),
        validate_template_payload_fn=_validate_template_payload_for_user,
        update_deployment_template_fn=update_deployment_template,
    )


@router.post(
    "/deployment-templates/{template_id}/duplicate",
    response_model=DeploymentTemplateResponse,
)
def duplicate_template(
    template_id: str,
    payload: DeploymentTemplateDuplicateRequest | None = None,
    user=Depends(require_auth),
) -> DeploymentTemplateResponse:
    return _service_duplicate_template(
        template_id,
        user,
        payload,
        get_deployment_template_or_404_fn=lambda current_id: _get_user_template_or_404(current_id, user),
        insert_deployment_template_fn=insert_deployment_template,
    )


@router.post(
    "/deployment-templates/{template_id}/deploy",
    response_model=DeploymentResponse,
)
def deploy_from_template(
    template_id: str,
    user=Depends(require_auth),
    create_deployment_fn=None,
) -> DeploymentResponse:
    create_deployment_adapter = create_deployment_fn
    if create_deployment_adapter is None:
        create_deployment_adapter = _create_deployment

    return _service_deploy_from_template(
        template_id,
        user,
        get_deployment_template_or_404_fn=lambda current_id: _get_user_template_or_404(current_id, user),
        create_deployment_fn=create_deployment_adapter,
        mark_deployment_template_used_fn=mark_deployment_template_used,
    )


@router.delete(
    "/deployment-templates/{template_id}",
    response_model=DeploymentTemplateResponse,
)
def delete_template(template_id: str, user=Depends(require_auth)) -> DeploymentTemplateResponse:
    return _service_delete_template(
        template_id,
        get_deployment_template_or_404_fn=lambda current_id: _get_user_template_or_404(current_id, user),
        delete_deployment_template_record_fn=delete_deployment_template_record,
    )
