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
    DiagnosticItem,
    ServerConnectionTestResponse,
    ServerCreateRequest,
    ServerDiagnosticsResponse,
    ServerResponse,
    ServerSuggestedPortsResponse,
)
from app.services.deployments import get_suggested_external_ports
from app.services.server_diagnostics import collect_server_diagnostics, test_server_connection
from app.services.auth import enforce_plan_limit, require_admin


router = APIRouter(dependencies=[Depends(require_admin)])


@router.post("/servers", response_model=ServerResponse)
def create_server(payload: ServerCreateRequest, user=Depends(require_admin)) -> ServerResponse:
    if payload.auth_type != "ssh_key":
        raise HTTPException(
            status_code=400,
            detail="New server targets must use ssh_key authentication.",
        )

    if payload.auth_type == "ssh_key" and not payload.ssh_key:
        raise HTTPException(status_code=400, detail="ssh_key is required for auth_type=ssh_key.")

    enforce_plan_limit(user, "servers")

    server_record = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "host": payload.host,
        "port": payload.port,
        "username": payload.username,
        "auth_type": payload.auth_type,
        "password": None,
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
        target=result.get("target"),
        ssh_ok=bool(result.get("ssh_ok")),
        docker_ok=bool(result.get("docker_ok")),
        docker_version=result.get("docker_version"),
    )


@router.get("/servers/{server_id}/diagnostics", response_model=ServerDiagnosticsResponse)
def get_server_diagnostics(server_id: str) -> ServerDiagnosticsResponse:
    server = get_server_or_404(server_id)
    diagnostics = collect_server_diagnostics(server)
    items = [DiagnosticItem(**item) for item in diagnostics.get("items", [])]
    overall_status = "unknown"
    if any(item.status == "error" for item in items):
        overall_status = "error"
    elif any(item.status == "warn" for item in items):
        overall_status = "warn"
    elif any(item.status == "ok" for item in items):
        overall_status = "ok"

    return ServerDiagnosticsResponse(
        server_id=server_id,
        target=str(diagnostics["target"]),
        checked_at=datetime.now(timezone.utc).isoformat(),
        overall_status=overall_status,
        deployment_count=count_deployments_for_server(server_id),
        hostname=diagnostics.get("hostname"),
        operating_system=diagnostics.get("operating_system"),
        uptime=diagnostics.get("uptime"),
        disk_usage=diagnostics.get("disk_usage"),
        memory=diagnostics.get("memory"),
        docker_version=diagnostics.get("docker_version"),
        docker_compose_version=diagnostics.get("docker_compose_version"),
        listening_ports=list(diagnostics.get("listening_ports", [])),
        items=items,
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
