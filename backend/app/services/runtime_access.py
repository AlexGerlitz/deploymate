import re

from fastapi import HTTPException

from app.services.auth import user_is_admin


ADMIN_MANAGED_TARGET_LABEL = "Managed by an admin"
REMOTE_RUNTIME_ADMIN_ONLY_DETAIL = (
    "Remote runtime server access is admin-only until DeployMate has an explicit "
    "sharing model for server targets."
)


def user_can_access_remote_servers(user: dict | None) -> bool:
    return user_is_admin(user)


def is_admin_managed_remote_record(record: dict | None, user: dict | None) -> bool:
    return bool(record and record.get("server_id") and not user_can_access_remote_servers(user))


def ensure_remote_runtime_action_allowed(record: dict, user: dict, *, action: str) -> None:
    if is_admin_managed_remote_record(record, user):
        raise HTTPException(
            status_code=403,
            detail=f"{action} is admin-only for admin-managed remote runtimes.",
        )


def sanitize_remote_target_fields(record: dict, user: dict) -> dict:
    sanitized = dict(record)
    if not is_admin_managed_remote_record(record, user):
        sanitized.setdefault("server_managed_by_admin", False)
        return sanitized

    sanitized["server_id"] = None
    sanitized["server_name"] = None
    sanitized["server_host"] = None
    sanitized["server_managed_by_admin"] = True
    return sanitized


def _remote_inventory_sensitive_values(record: dict | None) -> list[str]:
    if not record:
        return []

    values = [
        record.get("server_target"),
        record.get("server_host"),
        record.get("server_name"),
        record.get("server_id"),
    ]
    return sorted(
        {str(value) for value in values if value},
        key=len,
        reverse=True,
    )


def redact_remote_inventory_text(value: str | None, record: dict, user: dict) -> str | None:
    if value is None or not is_admin_managed_remote_record(record, user):
        return value

    redacted = str(value)
    server_host = record.get("server_host")
    if server_host:
        escaped_host = re.escape(str(server_host))
        redacted = re.sub(
            rf"\b[\w.-]+@{escaped_host}:\d+\b",
            ADMIN_MANAGED_TARGET_LABEL,
            redacted,
        )
        redacted = re.sub(
            rf"\bhttps?://{escaped_host}:\d+\b",
            ADMIN_MANAGED_TARGET_LABEL,
            redacted,
        )
    for sensitive_value in _remote_inventory_sensitive_values(record):
        redacted = redacted.replace(sensitive_value, ADMIN_MANAGED_TARGET_LABEL)
    return redacted


def sanitize_activity_event_for_user(item: dict, deployment: dict | None, user: dict) -> dict:
    sanitized = dict(item)
    if not deployment or not is_admin_managed_remote_record(deployment, user):
        return sanitized

    sanitized["title"] = redact_remote_inventory_text(sanitized.get("title"), deployment, user)
    sanitized["message"] = redact_remote_inventory_text(sanitized.get("message"), deployment, user)
    return sanitized


def sanitize_activity_events_for_user(items: list[dict], deployment: dict, user: dict) -> list[dict]:
    return [sanitize_activity_event_for_user(item, deployment, user) for item in items]


def sanitize_notifications_for_user(
    items: list[dict],
    deployments_by_id: dict[str, dict],
    user: dict,
) -> list[dict]:
    if user_can_access_remote_servers(user):
        return items

    return [
        sanitize_activity_event_for_user(
            item,
            deployments_by_id.get(str(item.get("deployment_id") or "")),
            user,
        )
        for item in items
    ]
