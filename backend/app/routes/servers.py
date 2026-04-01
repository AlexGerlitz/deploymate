import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import (
    count_deployments_for_server,
    delete_server_record,
    get_server_or_404,
    insert_server,
    list_servers,
)
from app.schemas import (
    ServerConnectionTestResponse,
    ServerCreateRequest,
    ServerResponse,
    ServerSuggestedPortsResponse,
)
from app.services.deployments import get_suggested_external_ports, test_server_connection
from app.services.auth import enforce_plan_limit, require_auth


router = APIRouter(dependencies=[Depends(require_auth)])


@router.post("/servers", response_model=ServerResponse)
def create_server(payload: ServerCreateRequest, user=Depends(require_auth)) -> ServerResponse:
    enforce_plan_limit(user, "servers")

    if payload.auth_type == "password" and not payload.password:
        raise HTTPException(status_code=400, detail="password is required for auth_type=password.")

    if payload.auth_type == "ssh_key" and not payload.ssh_key:
        raise HTTPException(status_code=400, detail="ssh_key is required for auth_type=ssh_key.")

    server_record = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "host": payload.host,
        "port": payload.port,
        "username": payload.username,
        "auth_type": payload.auth_type,
        "password": payload.password,
        "ssh_key": payload.ssh_key,
        "created_at": datetime.now(timezone.utc),
    }

    insert_server(server_record)
    saved_server = get_server_or_404(server_record["id"])
    return ServerResponse(**saved_server)


@router.get("/servers", response_model=List[ServerResponse])
def get_servers() -> List[ServerResponse]:
    return [ServerResponse(**item) for item in list_servers()]


@router.get("/servers/{server_id}", response_model=ServerResponse)
def get_server(server_id: str) -> ServerResponse:
    server = get_server_or_404(server_id)
    return ServerResponse(**server)


@router.post("/servers/{server_id}/test", response_model=ServerConnectionTestResponse)
def test_server(server_id: str) -> ServerConnectionTestResponse:
    server = get_server_or_404(server_id)
    result = test_server_connection(server)
    return ServerConnectionTestResponse(
        server_id=server_id,
        status=result["status"],
        message=result["message"],
    )


@router.get("/servers/{server_id}/suggested-ports", response_model=ServerSuggestedPortsResponse)
def get_server_suggested_ports(
    server_id: str,
    limit: int = Query(default=3, ge=1, le=10),
    start_port: int = Query(default=8080, ge=1, le=65535),
) -> ServerSuggestedPortsResponse:
    server = get_server_or_404(server_id)
    ensure_limit = min(limit, 10)
    ports = get_suggested_external_ports(server, limit=ensure_limit, start_port=start_port)
    return ServerSuggestedPortsResponse(server_id=server_id, ports=ports)


@router.delete("/servers/{server_id}")
def delete_server(server_id: str) -> dict:
    get_server_or_404(server_id)

    if count_deployments_for_server(server_id) > 0:
        raise HTTPException(
            status_code=400,
            detail="Server cannot be deleted while it is used by deployments.",
        )

    delete_server_record(server_id)
    return {"server_id": server_id, "status": "deleted"}
