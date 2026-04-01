import uuid
from datetime import datetime, timezone

from typing import List

from fastapi import APIRouter, Cookie, Depends, HTTPException

from app.db import (
    count_users_by_role,
    delete_user_record,
    get_session_user_by_token,
    get_upgrade_request_or_404,
    get_user_by_id,
    get_user_by_username,
    insert_upgrade_request,
    insert_user,
    list_upgrade_requests,
    list_users,
    set_user_plan,
    set_user_role,
    update_upgrade_request,
)
from app.schemas import (
    AdminUserCreateRequest,
    AdminUserItem,
    AdminUserUpdateRequest,
    UpgradeRequestCreate,
    UpgradeRequestItem,
    UpgradeRequestResponse,
    UpgradeRequestUpdateRequest,
)
from app.services.auth import SESSION_COOKIE_NAME, hash_password, require_admin


router = APIRouter()


@router.get("/")
def read_root() -> dict:
    return {
        "service": "DeployMate API",
        "status": "ok",
    }


@router.get("/health")
def health_check() -> dict:
    return {
        "status": "healthy",
        "service": "deploymate-backend",
    }


@router.post("/upgrade-requests", response_model=UpgradeRequestResponse)
def create_upgrade_request(
    payload: UpgradeRequestCreate,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> UpgradeRequestResponse:
    current_plan = payload.current_plan
    if session_token:
        user = get_session_user_by_token(session_token)
        if user:
            current_plan = user.get("plan", current_plan)

    request_id = str(uuid.uuid4())
    insert_upgrade_request(
        {
            "id": request_id,
            "name": payload.name,
            "email": payload.email,
            "company_or_team": payload.company_or_team,
            "use_case": payload.use_case,
            "current_plan": current_plan,
            "status": "new",
            "internal_note": None,
            "handled_by_user_id": None,
            "target_user_id": None,
            "reviewed_at": None,
            "updated_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
        }
    )
    return UpgradeRequestResponse(request_id=request_id, status="submitted")


@router.get(
    "/admin/upgrade-requests",
    response_model=List[UpgradeRequestItem],
    dependencies=[Depends(require_admin)],
)
def get_upgrade_requests() -> List[UpgradeRequestItem]:
    return [UpgradeRequestItem(**item) for item in list_upgrade_requests()]


@router.get(
    "/admin/upgrade-requests/{request_id}",
    response_model=UpgradeRequestItem,
    dependencies=[Depends(require_admin)],
)
def get_upgrade_request(request_id: str) -> UpgradeRequestItem:
    return UpgradeRequestItem(**get_upgrade_request_or_404(request_id))


@router.patch(
    "/admin/upgrade-requests/{request_id}",
    response_model=UpgradeRequestItem,
)
def update_upgrade_request_endpoint(
    request_id: str,
    payload: UpgradeRequestUpdateRequest,
    admin_user=Depends(require_admin),
) -> UpgradeRequestItem:
    request_item = get_upgrade_request_or_404(request_id)
    if (
        payload.status is None
        and payload.internal_note is None
        and payload.target_user_id is None
        and payload.plan is None
    ):
        raise HTTPException(status_code=400, detail="At least one field must be provided.")

    target_user_id = payload.target_user_id
    if target_user_id == "":
        target_user_id = None

    if target_user_id:
        target_user = get_user_by_id(target_user_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found.")
    else:
        target_user = None

    if payload.plan is not None and not target_user_id:
        raise HTTPException(
            status_code=400,
            detail="target_user_id is required when assigning a plan.",
        )

    if target_user and payload.plan is not None:
        set_user_plan(target_user_id, payload.plan)

    now = datetime.now(timezone.utc)
    reviewed_at = request_item.get("reviewed_at")
    if payload.status is not None and payload.status != "new":
        reviewed_at = reviewed_at or now

    internal_note = request_item.get("internal_note")
    if payload.internal_note is not None:
        internal_note = payload.internal_note.strip() or None

    update_upgrade_request(
        request_id,
        status=payload.status,
        internal_note=internal_note,
        handled_by_user_id=admin_user["id"],
        target_user_id=target_user_id,
        reviewed_at=reviewed_at,
        updated_at=now,
    )
    return UpgradeRequestItem(**get_upgrade_request_or_404(request_id))


@router.get(
    "/admin/users",
    response_model=List[AdminUserItem],
    dependencies=[Depends(require_admin)],
)
def get_users() -> List[AdminUserItem]:
    return [AdminUserItem(**item) for item in list_users()]


@router.post(
    "/admin/users",
    response_model=AdminUserItem,
    dependencies=[Depends(require_admin)],
)
def create_user(payload: AdminUserCreateRequest) -> AdminUserItem:
    if get_user_by_username(payload.username):
        raise HTTPException(status_code=400, detail="Username already exists.")
    user_record = {
        "id": str(uuid.uuid4()),
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "plan": "trial",
        "role": payload.role,
        "must_change_password": False,
        "created_at": datetime.now(timezone.utc),
    }
    insert_user(user_record)
    return AdminUserItem(**get_user_by_id(user_record["id"]))


@router.patch(
    "/admin/users/{user_id}",
    response_model=AdminUserItem,
    dependencies=[Depends(require_admin)],
)
def update_user(user_id: str, payload: AdminUserUpdateRequest) -> AdminUserItem:
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if payload.role is None and payload.plan is None:
        raise HTTPException(status_code=400, detail="At least one field must be provided.")

    if (
        payload.role is not None
        and user["role"] == "admin"
        and payload.role != "admin"
        and count_users_by_role("admin") <= 1
    ):
        raise HTTPException(status_code=400, detail="Cannot demote the last admin user.")

    if payload.role is not None:
        set_user_role(user_id, payload.role)
    if payload.plan is not None:
        set_user_plan(user_id, payload.plan)

    updated_user = get_user_by_id(user_id)
    return AdminUserItem(**updated_user)


@router.delete(
    "/admin/users/{user_id}",
    dependencies=[Depends(require_admin)],
)
def delete_user(user_id: str) -> dict:
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user["role"] == "admin" and count_users_by_role("admin") <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last admin user.")
    delete_user_record(user_id)
    return {"user_id": user_id, "status": "deleted"}
