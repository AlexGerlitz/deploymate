import os

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response

from app.db import (
    create_session,
    delete_session,
    get_user_by_id,
    get_user_by_username,
    update_user_password,
)
from app.schemas import ChangePasswordRequest, LoginRequest, UserResponse
from app.services.auth import (
    SESSION_COOKIE_NAME,
    build_user_response_payload,
    create_session_token,
    get_current_user,
    verify_password,
)


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
