import json
import subprocess
import time
from typing import Dict, List, Optional

from fastapi import HTTPException

from app.services.runtime_executors import (
    _build_ssh_base_command,
    _run_remote_command,
    ensure_local_docker_runtime_enabled,
    ensure_runtime_target_allowed,
    local_docker_runtime_enabled,
    run_diagnostic_command,
    run_runtime_command,
)


def build_container_name(request_name: Optional[str], deployment_id: str) -> str:
    if request_name:
        return request_name
    short_id = deployment_id.split("-")[0]
    return f"deploymate-{short_id}"


def _run_docker_command(command: List[str], server: Optional[dict]):
    return run_runtime_command(command, server)


def ensure_docker_is_available(server: Optional[dict] = None) -> None:
    result = _run_docker_command(["docker", "--version"], server)

    if result.returncode != 0:
        if server:
            raise HTTPException(
                status_code=500,
                detail=result.stderr.strip()
                or result.stdout.strip()
                or f'Docker is not available on server {server["name"]}.',
            )
        raise HTTPException(status_code=500, detail="Docker is not available.")


def ensure_external_port_is_available(external_port: Optional[int], server: Optional[dict] = None) -> None:
    if external_port is None:
        return

    result = _run_docker_command(["ss", "-ltnH", f"( sport = :{external_port} )"], server)
    if result.returncode != 0:
        return

    if not result.stdout.strip():
        return

    if server:
        raise HTTPException(
            status_code=400,
            detail=f"Port {external_port} is already in use on server {server['name']}.",
        )

    raise HTTPException(
        status_code=400,
        detail=f"Port {external_port} is already in use on this host.",
    )


def ensure_container_name_is_available(
    container_name: str,
    server: Optional[dict] = None,
) -> None:
    result = _run_docker_command(["docker", "container", "inspect", container_name], server)
    if result.returncode != 0:
        error_message = result.stderr.strip() or result.stdout.strip()
        if "No such object" in error_message or "No such container" in error_message:
            return
        return

    if server:
        raise HTTPException(
            status_code=400,
            detail=f"Container name {container_name} is already in use on server {server['name']}.",
        )

    raise HTTPException(
        status_code=400,
        detail=f"Container name {container_name} is already in use on this host.",
    )


def get_suggested_external_ports(
    server: Optional[dict] = None,
    *,
    limit: int = 3,
    start_port: int = 8080,
    end_port: int = 65535,
) -> list[int]:
    result = _run_docker_command(["ss", "-ltnH"], server)
    if result.returncode != 0:
        error_message = result.stderr.strip() or result.stdout.strip()
        raise HTTPException(
            status_code=500,
            detail=error_message or "Failed to inspect listening ports.",
        )

    used_ports: set[int] = set()
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) < 4:
            continue
        local_address = parts[3]
        port_text = local_address.rsplit(":", 1)[-1]
        if port_text.startswith("[") or not port_text.isdigit():
            continue
        used_ports.add(int(port_text))

    suggestions: list[int] = []
    for port in range(start_port, end_port + 1):
        if port in used_ports:
            continue
        suggestions.append(port)
        if len(suggestions) >= limit:
            break

    return suggestions


def run_container(
    image: str,
    container_name: str,
    internal_port: Optional[int],
    external_port: Optional[int],
    env: Dict[str, str],
    server: Optional[dict] = None,
) -> subprocess.CompletedProcess:
    command: List[str] = ["docker", "run", "-d", "--name", container_name]

    if internal_port is not None and external_port is not None:
        command.extend(["-p", f"{external_port}:{internal_port}"])

    for key, value in env.items():
        command.extend(["-e", f"{key}={value}"])

    command.append(image)

    return _run_docker_command(command, server)


def remove_container_if_exists(container_name: str, server: Optional[dict] = None) -> None:
    result = _run_docker_command(["docker", "rm", "-f", container_name], server)

    if result.returncode == 0:
        return

    error_message = result.stderr.strip() or result.stdout.strip()
    if "No such container" in error_message:
        return

    raise HTTPException(
        status_code=500,
        detail=error_message or "Failed to remove container.",
    )


def get_container_logs(container_name: str, server: Optional[dict] = None) -> subprocess.CompletedProcess:
    return _run_docker_command(["docker", "logs", container_name], server)


def get_container_logs_tail(
    container_name: str,
    server: Optional[dict] = None,
    *,
    tail: int = 40,
) -> subprocess.CompletedProcess:
    return _run_docker_command(["docker", "logs", "--tail", str(tail), container_name], server)


def inspect_container_state(
    container_name: str,
    server: Optional[dict] = None,
) -> dict[str, object] | None:
    result = _run_docker_command(
        ["docker", "inspect", "--format", "{{json .State}}", container_name],
        server,
    )
    if result.returncode != 0:
        error_message = result.stderr.strip() or result.stdout.strip()
        if "No such object" in error_message or "No such container" in error_message:
            return None
        raise HTTPException(
            status_code=500,
            detail=error_message or "Failed to inspect container state.",
        )

    payload = result.stdout.strip()
    if not payload:
        return None

    try:
        decoded = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to decode container diagnostics.",
        ) from exc

    return decoded if isinstance(decoded, dict) else None


def probe_http_endpoint(url: str, timeout: float = 5.0) -> dict[str, object]:
    import httpx

    checked_at = time.time()
    started_at = time.perf_counter()
    try:
        response = httpx.get(url, timeout=timeout)
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        return {
            "checked_at": checked_at,
            "ok": 200 <= response.status_code < 400,
            "status_code": response.status_code,
            "error": None,
            "response_time_ms": elapsed_ms,
        }
    except httpx.RequestError as exc:
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        return {
            "checked_at": checked_at,
            "ok": False,
            "status_code": None,
            "error": str(exc),
            "response_time_ms": elapsed_ms,
        }
