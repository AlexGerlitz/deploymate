import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from app.schemas import (
    DeploymentCreateRequest,
    DeploymentResponse,
    DeploymentTemplateCreateRequest,
    DeploymentTemplateDuplicateRequest,
    DeploymentTemplateResponse,
)


def build_template_record(
    template_id: str,
    payload: DeploymentTemplateCreateRequest,
    owner_user_id: str | None = None,
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
        "owner_user_id": owner_user_id,
        "env": json.dumps(payload.env),
        "created_at": created,
        "updated_at": updated,
        "last_used_at": last_used_at,
        "use_count": use_count,
    }


def validate_template_payload(
    payload: DeploymentTemplateCreateRequest,
    user,
    *,
    get_server_or_404_fn,
    ensure_remote_server_access_allowed_fn,
    ensure_runtime_target_allowed_fn,
) -> None:
    if (payload.internal_port is None) != (payload.external_port is None):
        raise HTTPException(
            status_code=400,
            detail="internal_port and external_port must be provided together.",
        )

    if payload.server_id:
        server = get_server_or_404_fn(payload.server_id)
        ensure_remote_server_access_allowed_fn(user, server)
        return

    ensure_runtime_target_allowed_fn(None)


def list_templates(
    *,
    state: str,
    q: str,
    list_deployment_templates_fn,
) -> list[DeploymentTemplateResponse]:
    templates = list_deployment_templates_fn()
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


def create_template(
    payload: DeploymentTemplateCreateRequest,
    user,
    *,
    validate_template_payload_fn,
    insert_deployment_template_fn,
    get_deployment_template_or_404_fn,
) -> DeploymentTemplateResponse:
    validate_template_payload_fn(payload, user)
    template_id = str(uuid.uuid4())
    template_record = build_template_record(template_id, payload, owner_user_id=user["id"])
    insert_deployment_template_fn(template_record)
    saved_template = get_deployment_template_or_404_fn(template_id)
    return DeploymentTemplateResponse(**saved_template)


def update_template(
    template_id: str,
    payload: DeploymentTemplateCreateRequest,
    user,
    *,
    get_deployment_template_or_404_fn,
    validate_template_payload_fn,
    update_deployment_template_fn,
) -> DeploymentTemplateResponse:
    existing_template = get_deployment_template_or_404_fn(template_id)
    validate_template_payload_fn(payload, user)
    update_deployment_template_fn(
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
    saved_template = get_deployment_template_or_404_fn(template_id)
    if saved_template["id"] != existing_template["id"]:
        raise HTTPException(status_code=500, detail="Template update failed.")
    return DeploymentTemplateResponse(**saved_template)


def duplicate_template(
    template_id: str,
    user,
    payload: DeploymentTemplateDuplicateRequest | None = None,
    *,
    get_deployment_template_or_404_fn,
    insert_deployment_template_fn,
) -> DeploymentTemplateResponse:
    template = get_deployment_template_or_404_fn(template_id)
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
        "owner_user_id": user["id"],
        "env": json.dumps(template.get("env") or {}),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "last_used_at": None,
        "use_count": 0,
    }
    insert_deployment_template_fn(template_record)
    saved_template = get_deployment_template_or_404_fn(duplicate_id)
    return DeploymentTemplateResponse(**saved_template)


def deploy_from_template(
    template_id: str,
    user,
    *,
    get_deployment_template_or_404_fn,
    create_deployment_fn,
    mark_deployment_template_used_fn,
) -> DeploymentResponse:
    template = get_deployment_template_or_404_fn(template_id)
    payload = DeploymentCreateRequest(
        image=template["image"],
        name=template.get("name"),
        internal_port=template.get("internal_port"),
        external_port=template.get("external_port"),
        server_id=template.get("server_id"),
        env=template.get("env") or {},
    )
    deployment = create_deployment_fn(payload, user)
    mark_deployment_template_used_fn(template_id)
    return deployment


def delete_template(
    template_id: str,
    *,
    get_deployment_template_or_404_fn,
    delete_deployment_template_record_fn,
) -> DeploymentTemplateResponse:
    template = get_deployment_template_or_404_fn(template_id)
    delete_deployment_template_record_fn(template_id)
    return DeploymentTemplateResponse(**template)
