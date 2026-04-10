import hashlib
import os
import secrets
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from fastapi import Cookie, Depends, HTTPException

from app.db import (
    clear_auth_rate_limit_events,
    count_all_deployments,
    count_all_servers,
    count_deployments_for_owner_user,
    count_recent_auth_rate_limit_events,
    delete_session,
    get_session_user_by_token,
    record_auth_rate_limit_event,
    reset_auth_rate_limit_events,
)


SESSION_COOKIE_NAME = "deploymate_session"
DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
DEFAULT_AUTH_RATE_LIMIT_ATTEMPTS = 5
DEFAULT_AUTH_RATE_LIMIT_WINDOW_SECONDS = 60
PLAN_LIMITS = {
    "trial": {
        "max_servers": 1,
        "max_deployments": 3,
    },
    "solo": {
        "max_servers": 3,
        "max_deployments": 15,
    },
    "team": {
        "max_servers": 10,
        "max_deployments": 100,
    },
}
_AUTH_RATE_LIMIT_BUCKETS: dict[str, deque[float]] = {}


def hash_password(password: str, salt: Optional[str] = None) -> str:
    password_salt = salt or secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        password_salt.encode("utf-8"),
        100000,
    ).hex()
    return f"{password_salt}${password_hash}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, expected_hash = password_hash.split("$", 1)
    except ValueError:
        return False

    candidate_hash = hash_password(password, salt).split("$", 1)[1]
    return secrets.compare_digest(candidate_hash, expected_hash)


def create_session_token() -> str:
    return secrets.token_urlsafe(32)


def _read_int_env(name: str, default: int, minimum: int) -> int:
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return default

    try:
        value = int(raw_value)
    except ValueError:
        return default

    return max(value, minimum)


def get_session_ttl_seconds() -> int:
    return _read_int_env(
        "DEPLOYMATE_SESSION_TTL_SECONDS",
        DEFAULT_SESSION_TTL_SECONDS,
        300,
    )


def get_auth_rate_limit_config() -> tuple[int, int]:
    return (
        _read_int_env(
            "DEPLOYMATE_AUTH_RATE_LIMIT_ATTEMPTS",
            DEFAULT_AUTH_RATE_LIMIT_ATTEMPTS,
            1,
        ),
        _read_int_env(
            "DEPLOYMATE_AUTH_RATE_LIMIT_WINDOW_SECONDS",
            DEFAULT_AUTH_RATE_LIMIT_WINDOW_SECONDS,
            1,
        ),
    )


def session_is_expired(created_at: str | datetime | None, now: datetime | None = None) -> bool:
    if not created_at:
        return False

    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at)
        except ValueError:
            return False

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    current_time = now or datetime.now(timezone.utc)
    return (current_time - created_at).total_seconds() > get_session_ttl_seconds()


def build_auth_rate_limit_key(action: str, *parts: str | None) -> str:
    normalized_parts = [action]
    for part in parts:
        normalized_parts.append((part or "unknown").strip().lower() or "unknown")
    return "::".join(normalized_parts)


def reset_auth_rate_limit_state() -> None:
    _AUTH_RATE_LIMIT_BUCKETS.clear()
    if get_auth_rate_limit_backend() == "database":
        try:
            reset_auth_rate_limit_events()
        except HTTPException:
            pass


def get_auth_rate_limit_backend() -> str:
    backend = os.getenv("DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND", "database").strip().lower()
    if backend in {"database", "memory"}:
        return backend
    return "database"


def _get_auth_rate_limit_bucket(action: str, *parts: str | None) -> deque[float]:
    bucket_key = build_auth_rate_limit_key(action, *parts)
    return _AUTH_RATE_LIMIT_BUCKETS.setdefault(bucket_key, deque())


def _prune_auth_rate_limit_bucket(bucket: deque[float], window_seconds: int, now: float) -> None:
    window_start = now - window_seconds
    while bucket and bucket[0] < window_start:
        bucket.popleft()


def enforce_auth_rate_limit(action: str, *parts: str | None) -> None:
    max_attempts, window_seconds = get_auth_rate_limit_config()
    if get_auth_rate_limit_backend() == "memory":
        bucket = _get_auth_rate_limit_bucket(action, *parts)
        now = datetime.now(timezone.utc).timestamp()
        _prune_auth_rate_limit_bucket(bucket, window_seconds, now)
        count = len(bucket)
    else:
        bucket_key = build_auth_rate_limit_key(action, *parts)
        count = count_recent_auth_rate_limit_events(bucket_key, window_seconds)

    if count >= max_attempts:
        raise HTTPException(
            status_code=429,
            detail="Too many authentication attempts. Please wait a minute and try again.",
        )


def record_auth_rate_limit_failure(action: str, *parts: str | None) -> None:
    if get_auth_rate_limit_backend() == "memory":
        _, window_seconds = get_auth_rate_limit_config()
        bucket = _get_auth_rate_limit_bucket(action, *parts)
        now = datetime.now(timezone.utc).timestamp()
        _prune_auth_rate_limit_bucket(bucket, window_seconds, now)
        bucket.append(now)
        return

    bucket_key = build_auth_rate_limit_key(action, *parts)
    record_auth_rate_limit_event(bucket_key)


def clear_auth_rate_limit(action: str, *parts: str | None) -> None:
    bucket_key = build_auth_rate_limit_key(action, *parts)
    _AUTH_RATE_LIMIT_BUCKETS.pop(bucket_key, None)
    if get_auth_rate_limit_backend() == "database":
        clear_auth_rate_limit_events(bucket_key)


def get_current_user(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    user = get_session_user_by_token(session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session.")

    if session_is_expired(user.get("session_created_at")):
        delete_session(session_token)
        raise HTTPException(status_code=401, detail="Session expired.")

    return user


def require_auth(user=Depends(get_current_user)):
    return user


def clear_invalid_session(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> None:
    if session_token:
        delete_session(session_token)


def get_default_admin_credentials() -> tuple[str, str]:
    username = os.getenv("DEPLOYMATE_ADMIN_USERNAME", "admin")
    password = os.getenv("DEPLOYMATE_ADMIN_PASSWORD", "admin")
    return username, password


def public_signup_enabled() -> bool:
    raw_value = os.getenv("DEPLOYMATE_PUBLIC_SIGNUP_ENABLED", "false").strip().lower()
    return raw_value in {"1", "true", "yes", "on"}


def get_plan_limits(plan: str) -> dict[str, int]:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"]).copy()


def get_plan_usage(user: dict | None = None) -> dict[str, int]:
    if not user:
        return {
            "servers": count_all_servers(),
            "deployments": count_all_deployments(),
        }

    deployments = (
        count_all_deployments()
        if user_is_admin(user)
        else count_deployments_for_owner_user(user["id"])
    )
    return {
        "servers": count_all_servers() if user_is_admin(user) else 0,
        "deployments": deployments,
    }


def build_user_response_payload(user: dict) -> dict:
    return {
        **user,
        "plan": user.get("plan", "trial"),
        "role": user.get("role", "member"),
        "is_admin": user.get("role") == "admin",
        "limits": get_plan_limits(user.get("plan", "trial")),
        "usage": get_plan_usage(user),
    }


def user_is_admin(user: dict | None) -> bool:
    return bool(user and user.get("role") == "admin")


def ensure_remote_server_access_allowed(user: dict, server: dict | None) -> None:
    if server is None:
        return
    if user_is_admin(user):
        return
    raise HTTPException(
        status_code=403,
        detail=(
            "Remote server targets are admin-only until DeployMate has an explicit "
            "sharing model for server access."
        ),
    )


def enforce_plan_limit(user: dict, resource: str) -> None:
    plan = user.get("plan", "trial")
    limits = get_plan_limits(plan)
    usage = get_plan_usage(user)

    if resource == "servers" and usage["servers"] >= limits["max_servers"]:
        raise HTTPException(
            status_code=403,
            detail=(
                f'{plan.capitalize()} plan limit reached: '
                f'{limits["max_servers"]} server'
                f'{"s" if limits["max_servers"] != 1 else ""} maximum.'
            ),
        )

    if resource == "deployments" and usage["deployments"] >= limits["max_deployments"]:
        raise HTTPException(
            status_code=403,
            detail=(
                f'{plan.capitalize()} plan limit reached: '
                f'{limits["max_deployments"]} deployment'
                f'{"s" if limits["max_deployments"] != 1 else ""} maximum.'
            ),
        )


def require_admin(user=Depends(get_current_user)):
    if not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user
