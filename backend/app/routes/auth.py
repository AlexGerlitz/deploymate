import os

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response

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
    create_session_token,
    get_current_user,
    hash_password,
    public_signup_enabled,
    verify_password,
)
from datetime import datetime, timezone
import uuid


router = APIRouter(prefix="/auth")


def _cookie_secure_flag() -> bool:
    return os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, response: Response) -> UserResponse:
    user = get_user_by_username(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    session_token = create_session_token()
    create_session(session_token, user["id"])
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=_cookie_secure_flag(),
        path="/",
    )
    return UserResponse(**build_user_response_payload(user))


@router.post("/register", response_model=UserResponse)
def register(payload: PublicSignupRequest, response: Response) -> UserResponse:
    if not public_signup_enabled():
        raise HTTPException(status_code=403, detail="Public signup is disabled.")

    username = payload.username.strip()
    if username != payload.username:
        raise HTTPException(
            status_code=400,
            detail="Username cannot start or end with spaces.",
        )

    if get_user_by_username(username):
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
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=_cookie_secure_flag(),
        path="/",
    )
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
    user=Depends(get_current_user),
) -> UserResponse:
    full_user = get_user_by_id(user["id"])
    if not full_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not verify_password(payload.current_password, full_user["password_hash"]):
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

    return UserResponse(**build_user_response_payload(updated_user))


@router.post("/logout")
def logout(
    response: Response,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    user=Depends(get_current_user),
) -> dict:
    if session_token:
        delete_session(session_token)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"status": "logged_out"}
