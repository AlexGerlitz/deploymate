import csv
import io
from datetime import datetime, timezone
from typing import Iterable

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.db import list_deployment_records, list_deployment_templates, list_notifications, list_servers
from app.schemas import (
    OpsAttentionItem,
    OpsDeploymentsSummary,
    OpsNotificationsSummary,
    OpsOverviewResponse,
    OpsServersSummary,
    OpsTemplatesSummary,
    OpsUserSummary,
)
from app.services.auth import require_auth


router = APIRouter(prefix="/ops", dependencies=[Depends(require_auth)])


def _infer_activity_category(title: str | None, message: str | None) -> str:
    haystack = " ".join(filter(None, [title, message])).lower()
    if not haystack:
        return "general"
    if "redeploy" in haystack:
        return "redeploy"
    if "delete" in haystack:
        return "delete"
    if "health" in haystack:
        return "health"
    if "deploy" in haystack:
        return "deploy"
    return "general"


def _is_recent_date(value: str | None, days: int = 7) -> bool:
    if not value:
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    delta = datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)
    return delta.total_seconds() <= days * 24 * 60 * 60


def _build_ops_overview(user: dict, *, notifications_limit: int = 100) -> OpsOverviewResponse:
    deployments = list_deployment_records()
    servers = list_servers()
    templates = list_deployment_templates()
    notifications = list_notifications(limit=notifications_limit)

    active_server_ids = {deployment.get("server_id") for deployment in deployments if deployment.get("server_id")}
    failed_deployments = [item for item in deployments if item.get("status") == "failed"]
    running_deployments = [item for item in deployments if item.get("status") == "running"]
    pending_deployments = [item for item in deployments if item.get("status") == "pending"]
    local_deployments = [item for item in deployments if not item.get("server_id")]
    remote_deployments = [item for item in deployments if item.get("server_id")]
    exposed_deployments = [
        item for item in deployments if item.get("external_port") is not None
    ]
    public_url_deployments = [
        item for item in deployments if item.get("server_host") and item.get("external_port")
    ]
    password_servers = [item for item in servers if item.get("auth_type") == "password"]
    ssh_key_servers = [item for item in servers if item.get("auth_type") == "ssh_key"]
    unused_servers = [item for item in servers if item.get("id") not in active_server_ids]
    error_notifications = [item for item in notifications if item.get("level") == "error"]
    success_notifications = [item for item in notifications if item.get("level") == "success"]
    recent_error = error_notifications[0] if error_notifications else None
    unused_templates = [item for item in templates if int(item.get("use_count") or 0) == 0]
    recent_templates = [item for item in templates if _is_recent_date(item.get("last_used_at"), 7)]
    popular_templates = sorted(
        [item for item in templates if int(item.get("use_count") or 0) > 0],
        key=lambda item: int(item.get("use_count") or 0),
        reverse=True,
    )
    top_template = popular_templates[0] if popular_templates else None

    attention_items: list[OpsAttentionItem] = []

    if user.get("must_change_password"):
        attention_items.append(
            OpsAttentionItem(
                level="warn",
                title="Default admin password is still active",
                detail="Change it before making more production changes.",
            )
        )

    if failed_deployments:
        attention_items.append(
            OpsAttentionItem(
                level="error",
                title=f"{len(failed_deployments)} failed deployment{'s' if len(failed_deployments) != 1 else ''}",
                detail="Open deployment details and activity history before the next rollout.",
            )
        )

    if error_notifications:
        attention_items.append(
            OpsAttentionItem(
                level="warn",
                title=f"{len(error_notifications)} recent error event{'s' if len(error_notifications) != 1 else ''}",
                detail=(recent_error or {}).get("title") or "Review recent activity history.",
            )
        )

    if not servers:
        attention_items.append(
            OpsAttentionItem(
                level="info",
                title="No saved servers",
                detail="Only local deploys are available until a VPS target is added.",
            )
        )

    if unused_templates:
        attention_items.append(
            OpsAttentionItem(
                level="info",
                title=f"{len(unused_templates)} template{'s' if len(unused_templates) != 1 else ''} never used",
                detail="Review whether they are still useful or should be cleaned up later.",
            )
        )

    if any(item.get("external_port") is None for item in running_deployments):
        attention_items.append(
            OpsAttentionItem(
                level="info",
                title="Some running deployments have no external port",
                detail="They may be internal-only or require proxy access.",
            )
        )

    return OpsOverviewResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        user=OpsUserSummary(
            username=user["username"],
            plan=user.get("plan", "trial"),
            role=user.get("role", "member"),
        ),
        deployments=OpsDeploymentsSummary(
            total=len(deployments),
            running=len(running_deployments),
            failed=len(failed_deployments),
            pending=len(pending_deployments),
            local=len(local_deployments),
            remote=len(remote_deployments),
            exposed=len(exposed_deployments),
            public_urls=len(public_url_deployments),
        ),
        servers=OpsServersSummary(
            total=len(servers),
            password_auth=len(password_servers),
            ssh_key_auth=len(ssh_key_servers),
            unused=len(unused_servers),
        ),
        notifications=OpsNotificationsSummary(
            total=len(notifications),
            success=len(success_notifications),
            error=len(error_notifications),
            latest_error_title=(recent_error or {}).get("title"),
            latest_error_at=(recent_error or {}).get("created_at"),
        ),
        templates=OpsTemplatesSummary(
            total=len(templates),
            unused=len(unused_templates),
            recently_used=len(recent_templates),
            top_template_name=(top_template or {}).get("template_name"),
            top_template_use_count=int((top_template or {}).get("use_count") or 0),
        ),
        attention_items=attention_items,
    )


def _csv_response(filename: str, rows: Iterable[dict], fieldnames: list[str]) -> Response:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow({field: row.get(field) for field in fieldnames})

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/overview", response_model=OpsOverviewResponse)
def get_ops_overview(
    notifications_limit: int = Query(default=100, ge=10, le=500),
    user=Depends(require_auth),
) -> OpsOverviewResponse:
    return _build_ops_overview(user, notifications_limit=notifications_limit)


@router.get("/exports/deployments")
def export_deployments(format: str = Query(default="json", pattern="^(json|csv)$")):
    items = list_deployment_records()
    if format == "csv":
        return _csv_response(
            "deploymate-deployments.csv",
            items,
            [
                "id",
                "status",
                "image",
                "container_name",
                "container_id",
                "server_id",
                "server_name",
                "server_host",
                "internal_port",
                "external_port",
                "error",
                "created_at",
            ],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}


@router.get("/exports/servers")
def export_servers(format: str = Query(default="json", pattern="^(json|csv)$")):
    items = list_servers()
    if format == "csv":
        return _csv_response(
            "deploymate-servers.csv",
            items,
            ["id", "name", "host", "port", "username", "auth_type", "created_at"],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}


@router.get("/exports/templates")
def export_templates(format: str = Query(default="json", pattern="^(json|csv)$")):
    items = list_deployment_templates()
    if format == "csv":
        return _csv_response(
            "deploymate-templates.csv",
            items,
            [
                "id",
                "template_name",
                "image",
                "name",
                "server_id",
                "server_name",
                "server_host",
                "internal_port",
                "external_port",
                "use_count",
                "last_used_at",
                "updated_at",
                "created_at",
            ],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}


@router.get("/exports/activity")
def export_activity(
    format: str = Query(default="json", pattern="^(json|csv)$"),
    limit: int = Query(default=200, ge=1, le=1000),
):
    items = list_notifications(limit=limit)
    normalized = [
        {
            **item,
            "category": _infer_activity_category(item.get("title"), item.get("message")),
        }
        for item in items
    ]
    if format == "csv":
        return _csv_response(
            "deploymate-activity.csv",
            normalized,
            ["id", "deployment_id", "level", "category", "title", "message", "created_at"],
        )
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(normalized),
        "items": normalized,
    }
