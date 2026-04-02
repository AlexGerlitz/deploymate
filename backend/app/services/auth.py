import hashlib
import os
import secrets
from typing import Optional

from fastapi import Cookie, Depends, HTTPException

from app.db import (
    count_all_deployments,
    count_all_servers,
    delete_session,
    get_session_user_by_token,
)


SESSION_COOKIE_NAME = "deploymate_session"
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


def get_current_user(
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    user = get_session_user_by_token(session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session.")

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


def get_plan_usage() -> dict[str, int]:
    return {
        "servers": count_all_servers(),
        "deployments": count_all_deployments(),
    }


def build_user_response_payload(user: dict) -> dict:
    return {
        **user,
        "plan": user.get("plan", "trial"),
        "role": user.get("role", "member"),
        "is_admin": user.get("role") == "admin",
        "limits": get_plan_limits(user.get("plan", "trial")),
        "usage": get_plan_usage(),
    }


def enforce_plan_limit(user: dict, resource: str) -> None:
    plan = user.get("plan", "trial")
    limits = get_plan_limits(plan)
    usage = get_plan_usage()

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
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return user
