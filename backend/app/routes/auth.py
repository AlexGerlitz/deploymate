from datetime import datetime, timezone
import os
import uuid

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response

from app.db import (
    create_session,
    delete_session,
    get_user_by_id,
    get_user_by_username,
    insert_user,
    update_user_password,
)
from app.schemas import ChangePasswordRequest, LoginRequest, PublicSignupRequest, UserResponse
from app.services.auth import (
    SESSION_COOKIE_NAME,
    build_user_response_payload,
    clear_auth_rate_limit,
    create_session_token,
    enforce_auth_rate_limit,
    get_current_user,
    get_session_ttl_seconds,
    hash_password,
    public_signup_enabled,
    record_auth_rate_limit_failure,
    verify_password,
)


router = APIRouter(prefix="/auth")


def _cookie_secure_flag() -> bool:
    return os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"


def _set_session_cookie(response: Response, session_token: str) -> None:
    ttl_seconds = get_session_ttl_seconds()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=_cookie_secure_flag(),
        path="/",
        max_age=ttl_seconds,
        expires=ttl_seconds,
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
        secure=_cookie_secure_flag(),
    )


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, response: Response, request: Request) -> UserResponse:
    client_host = request.client.host if request.client else None
    enforce_auth_rate_limit("login", client_host, payload.username)
    user = get_user_by_username(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        record_auth_rate_limit_failure("login", client_host, payload.username)
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    session_token = create_session_token()
    create_session(session_token, user["id"])
    _set_session_cookie(response, session_token)
    clear_auth_rate_limit("login", client_host, payload.username)
    return UserResponse(**build_user_response_payload(user))


@router.post("/register", response_model=UserResponse)
def register(payload: PublicSignupRequest, response: Response, request: Request) -> UserResponse:
    if not public_signup_enabled():
        raise HTTPException(status_code=403, detail="Public signup is disabled.")

    client_host = request.client.host if request.client else None

    username = payload.username.strip()
    if username != payload.username:
        raise HTTPException(
            status_code=400,
            detail="Username cannot start or end with spaces.",
        )

    if get_user_by_username(username):
        record_auth_rate_limit_failure("register", client_host, payload.username)
        raise HTTPException(status_code=400, detail="Username already exists.")

    user_record = {
        "id": str(uuid.uuid4()),
        "username": username,
        "password_hash": hash_password(payload.password),
        "plan": "trial",
        "role": "member",
        "must_change_password": False,
        "created_at": datetime.now(timezone.utc),
    }
    insert_user(user_record)

    session_token = create_session_token()
    create_session(session_token, user_record["id"])
    _set_session_cookie(response, session_token)
    clear_auth_rate_limit("register", client_host, payload.username)
    created_user = get_user_by_id(user_record["id"])
    if not created_user:
        raise HTTPException(status_code=500, detail="Failed to create user.")
    return UserResponse(**build_user_response_payload(created_user))


@router.get("/me", response_model=UserResponse)
def get_me(user=Depends(get_current_user)) -> UserResponse:
    return UserResponse(**build_user_response_payload(user))


@router.post("/change-password", response_model=UserResponse)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    user=Depends(get_current_user),
) -> UserResponse:
    client_host = request.client.host if request.client else None
    full_user = get_user_by_id(user["id"])
    if not full_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not verify_password(payload.current_password, full_user["password_hash"]):
        record_auth_rate_limit_failure("change-password", client_host, user["id"])
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the current password.",
        )

    update_user_password(full_user["id"], payload.new_password)
    updated_user = get_user_by_id(full_user["id"])
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found.")

    clear_auth_rate_limit("change-password", client_host, user["id"])
    return UserResponse(**build_user_response_payload(updated_user))


@router.post("/logout")
def logout(
    response: Response,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    user=Depends(get_current_user),
) -> dict:
    if session_token:
        delete_session(session_token)
    _clear_session_cookie(response)
    return {"status": "logged_out"}
