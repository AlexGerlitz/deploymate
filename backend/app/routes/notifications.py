from typing import List

from fastapi import APIRouter, Depends, Query

from app.db import list_deployment_records, list_notifications
from app.schemas import NotificationResponse
from app.services.auth import require_auth, user_is_admin
from app.services.runtime_access import sanitize_notifications_for_user


router = APIRouter(dependencies=[Depends(require_auth)])


@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    level: str = Query(default="all", pattern="^(all|success|error)$"),
    category: str = Query(default="all"),
    q: str = Query(default=""),
    user=Depends(require_auth),
) -> List[NotificationResponse]:
    notifications = list_notifications(limit=max(limit, 200))
    if user_is_admin(user):
        visible_deployment_ids = None
        deployments_by_id = {}
    else:
        visible_deployments = [
            item for item in list_deployment_records() if item.get("owner_user_id") == user["id"]
        ]
        deployments_by_id = {item["id"]: item for item in visible_deployments}
        visible_deployment_ids = set(deployments_by_id)
    normalized_query = q.strip().lower()
    normalized_category = category.strip().lower()

    def infer_activity_category(item: dict) -> str:
        haystack = " ".join(
            filter(None, [item.get("title"), item.get("message")]),
        ).lower()
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

    filtered: list[NotificationResponse] = []
    for item in notifications:
        if visible_deployment_ids is not None and item.get("deployment_id") not in visible_deployment_ids:
            continue
        sanitized_item = sanitize_notifications_for_user([item], deployments_by_id, user)[0]
        inferred_category = infer_activity_category(sanitized_item)
        if level != "all" and item.get("level") != level:
            continue
        if normalized_category and normalized_category != "all" and inferred_category != normalized_category:
            continue
        if normalized_query:
            haystack = " ".join(
                filter(
                    None,
                    [
                        sanitized_item.get("title"),
                        sanitized_item.get("message"),
                        sanitized_item.get("deployment_id"),
                        inferred_category,
                    ],
                )
            ).lower()
            if normalized_query not in haystack:
                continue
        filtered.append(NotificationResponse(**sanitized_item, category=inferred_category))
    return filtered[:limit]
