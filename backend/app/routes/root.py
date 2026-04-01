import csv
import io
import uuid
from datetime import datetime, timezone

from typing import List

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query
from fastapi.responses import Response

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
    AdminAttentionItem,
    AdminOverviewResponse,
    AdminUpgradeRequestsSummary,
    AdminUserUpdateRequest,
    AdminUsersSummary,
    UpgradeRequestCreate,
    UpgradeRequestItem,
    UpgradeRequestResponse,
    UpgradeRequestUpdateRequest,
)
from app.services.auth import SESSION_COOKIE_NAME, hash_password, require_admin


router = APIRouter()


def _csv_response(filename: str, rows: list[dict], fieldnames: list[str]) -> Response:
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
def get_upgrade_requests(
    status: str = Query(default="all", pattern="^(all|new|in_review|approved|rejected|closed)$"),
    plan: str = Query(default="all", pattern="^(all|trial|solo|team)$"),
    q: str = Query(default=""),
    linked_only: bool = Query(default=False),
) -> List[UpgradeRequestItem]:
    normalized_query = q.strip().lower()
    items = list_upgrade_requests()
    filtered: list[UpgradeRequestItem] = []
    for item in items:
      if status != "all" and item.get("status") != status:
          continue
      if plan != "all" and (item.get("current_plan") or "") != plan:
          continue
      if linked_only and not item.get("target_user_id"):
          continue
      if normalized_query:
          haystack = " ".join(
              filter(
                  None,
                  [
                      item.get("name"),
                      item.get("email"),
                      item.get("company_or_team"),
                      item.get("use_case"),
                      item.get("current_plan"),
                      item.get("status"),
                      item.get("target_username"),
                      item.get("handled_by_username"),
                  ],
              )
          ).lower()
          if normalized_query not in haystack:
              continue
      filtered.append(UpgradeRequestItem(**item))
    return filtered


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
def get_users(
    role: str = Query(default="all", pattern="^(all|admin|member)$"),
    plan: str = Query(default="all", pattern="^(all|trial|solo|team)$"),
    q: str = Query(default=""),
    must_change_password: bool | None = Query(default=None),
) -> List[AdminUserItem]:
    normalized_query = q.strip().lower()
    items = list_users()
    filtered: list[AdminUserItem] = []
    for item in items:
      if role != "all" and item.get("role") != role:
          continue
      if plan != "all" and item.get("plan") != plan:
          continue
      if must_change_password is not None and bool(item.get("must_change_password")) != must_change_password:
          continue
      if normalized_query and normalized_query not in (item.get("username") or "").lower():
          continue
      filtered.append(AdminUserItem(**item))
    return filtered


@router.get(
    "/admin/overview",
    response_model=AdminOverviewResponse,
    dependencies=[Depends(require_admin)],
)
def get_admin_overview() -> AdminOverviewResponse:
    users = list_users()
    upgrade_requests = list_upgrade_requests()

    admins = [item for item in users if item.get("role") == "admin"]
    members = [item for item in users if item.get("role") == "member"]
    trial_users = [item for item in users if item.get("plan") == "trial"]
    solo_users = [item for item in users if item.get("plan") == "solo"]
    team_users = [item for item in users if item.get("plan") == "team"]
    must_change_users = [item for item in users if item.get("must_change_password")]

    new_requests = [item for item in upgrade_requests if item.get("status") == "new"]
    in_review_requests = [item for item in upgrade_requests if item.get("status") == "in_review"]
    approved_requests = [item for item in upgrade_requests if item.get("status") == "approved"]
    rejected_requests = [item for item in upgrade_requests if item.get("status") == "rejected"]
    closed_requests = [item for item in upgrade_requests if item.get("status") == "closed"]
    linked_requests = [item for item in upgrade_requests if item.get("target_user_id")]

    attention_items: list[AdminAttentionItem] = []
    if must_change_users:
        attention_items.append(
            AdminAttentionItem(
                level="warn",
                title=f"{len(must_change_users)} user{'s' if len(must_change_users) != 1 else ''} must change password",
                detail="Review user security state from the admin users page.",
            )
        )
    if new_requests:
        attention_items.append(
            AdminAttentionItem(
                level="info",
                title=f"{len(new_requests)} new upgrade request{'s' if len(new_requests) != 1 else ''}",
                detail="Review inbound demand in the upgrade inbox.",
            )
        )
    if approved_requests and len(linked_requests) < len(approved_requests):
        attention_items.append(
            AdminAttentionItem(
                level="warn",
                title="Some approved upgrade requests are not linked to users",
                detail="Link approved requests to target users where appropriate.",
            )
        )
    if len(admins) <= 1:
        attention_items.append(
            AdminAttentionItem(
                level="info",
                title="Only one admin account remains",
                detail="Consider adding another admin account for operational redundancy.",
            )
        )

    return AdminOverviewResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        users=AdminUsersSummary(
            total=len(users),
            admins=len(admins),
            members=len(members),
            trial=len(trial_users),
            solo=len(solo_users),
            team=len(team_users),
            must_change_password=len(must_change_users),
        ),
        upgrade_requests=AdminUpgradeRequestsSummary(
            total=len(upgrade_requests),
            new=len(new_requests),
            in_review=len(in_review_requests),
            approved=len(approved_requests),
            rejected=len(rejected_requests),
            closed=len(closed_requests),
            linked_users=len(linked_requests),
        ),
        attention_items=attention_items,
    )


@router.get(
    "/admin/exports/users",
    dependencies=[Depends(require_admin)],
)
def export_admin_users(format: str = Query(default="json", pattern="^(json|csv)$")):
    items = list_users()
    if format == "csv":
        return _csv_response(
            "deploymate-admin-users.csv",
            items,
            ["id", "username", "role", "plan", "must_change_password", "created_at"],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}


@router.get(
    "/admin/exports/upgrade-requests",
    dependencies=[Depends(require_admin)],
)
def export_admin_upgrade_requests(format: str = Query(default="json", pattern="^(json|csv)$")):
    items = list_upgrade_requests()
    if format == "csv":
        return _csv_response(
            "deploymate-upgrade-requests.csv",
            items,
            [
                "id",
                "status",
                "name",
                "email",
                "company_or_team",
                "use_case",
                "current_plan",
                "handled_by_username",
                "target_username",
                "reviewed_at",
                "updated_at",
                "created_at",
            ],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}


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
