import json
import re
import shlex
import subprocess
import time
from typing import Dict, List, Optional
from urllib.parse import urlparse

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


def ensure_docker_compose_is_available(server: Optional[dict] = None) -> None:
    result = _run_docker_command(["docker", "compose", "version"], server)

    if result.returncode != 0:
        error_message = result.stderr.strip() or result.stdout.strip()
        if server:
            raise HTTPException(
                status_code=500,
                detail=error_message or f'Docker Compose is not available on server {server["name"]}.',
            )
        raise HTTPException(
            status_code=500,
            detail=error_message or "Docker Compose is not available.",
        )


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
    secrets: Dict[str, str],
    server: Optional[dict] = None,
) -> subprocess.CompletedProcess:
    command: List[str] = ["docker", "run", "-d", "--name", container_name]

    if internal_port is not None and external_port is not None:
        command.extend(["-p", f"{external_port}:{internal_port}"])

    runtime_env = {**env, **secrets}

    for key, value in runtime_env.items():
        command.extend(["-e", f"{key}={value}"])

    command.append(image)

    return _run_docker_command(command, server)


def normalize_stack_name(stack_name: str) -> str:
    normalized = stack_name.strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Stack name is required.")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{1,62}", normalized):
        raise HTTPException(
            status_code=400,
            detail="Stack name must use only lowercase letters, numbers, dots, underscores, or hyphens.",
        )
    return normalized


def normalize_stack_health_target(health_target: str) -> str:
    normalized = health_target.strip()
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=400,
            detail="Stack health target must be a full http(s) URL for v0 stack deploys.",
        )
    return normalized


def extract_compose_services(compose_yaml: str) -> dict[str, dict[str, str | None]]:
    services: dict[str, dict[str, str | None]] = {}
    in_services_block = False
    service_indent: int | None = None
    current_service: str | None = None

    for raw_line in compose_yaml.splitlines():
        line = raw_line.rstrip()
        if not in_services_block:
            if re.match(r"^\s*services:\s*$", line):
                in_services_block = True
            continue

        if not line.strip() or line.lstrip().startswith("#"):
            continue

        indent = len(line) - len(line.lstrip(" "))
        if indent == 0:
            break

        service_match = re.match(r"^(\s+)([A-Za-z0-9._-]+):\s*$", line)
        if service_match:
            current_indent = len(service_match.group(1))
            if service_indent is None:
                service_indent = current_indent
            if current_indent == service_indent:
                current_service = service_match.group(2)
                services.setdefault(current_service, {"image": None})
                continue

        if current_service and service_indent is not None and indent > service_indent:
            image_match = re.match(r"^\s*image:\s*(\S+)\s*$", line)
            if image_match and not services[current_service].get("image"):
                services[current_service]["image"] = image_match.group(1)

    return services


def build_stack_project_name(deployment_id: str) -> str:
    return f"deploymate-{deployment_id}"


def build_stack_storage_dir(deployment_id: str) -> str:
    return f"${{HOME}}/.deploymate/stacks/{deployment_id}"


def build_stack_compose_path(deployment_id: str) -> str:
    return f"{build_stack_storage_dir(deployment_id)}/compose.yaml"


def _run_shell_script(script: str, server: Optional[dict] = None) -> subprocess.CompletedProcess:
    return run_runtime_command(["sh", "-lc", script], server)


def run_compose_stack_up(
    deployment_id: str,
    compose_yaml: str,
    server: Optional[dict] = None,
) -> subprocess.CompletedProcess:
    storage_dir = build_stack_storage_dir(deployment_id)
    compose_path = build_stack_compose_path(deployment_id)
    project_name = build_stack_project_name(deployment_id)
    delimiter = f"DEPLOYMATE_STACK_{deployment_id.replace('-', '_')}"
    script = "\n".join(
        [
            "set -e",
            f'storage_dir="{storage_dir}"',
            'compose_path="${storage_dir}/compose.yaml"',
            'mkdir -p "$storage_dir"',
            f"cat > \"$compose_path\" <<'{delimiter}'",
            compose_yaml.rstrip("\n"),
            delimiter,
            f"docker compose -f \"$compose_path\" -p {shlex.quote(project_name)} up -d",
        ]
    )
    return _run_shell_script(script, server)


def remove_stack_if_exists(
    deployment_id: str,
    server: Optional[dict] = None,
) -> subprocess.CompletedProcess:
    storage_dir = build_stack_storage_dir(deployment_id)
    project_name = build_stack_project_name(deployment_id)
    script = "\n".join(
        [
            "set -e",
            f'storage_dir="{storage_dir}"',
            'compose_path="${storage_dir}/compose.yaml"',
            'if [ ! -f "$compose_path" ]; then',
            f'  echo "Compose file is missing for stack deployment {deployment_id}." >&2',
            "  exit 1",
            "fi",
            f"docker compose -f \"$compose_path\" -p {shlex.quote(project_name)} down --remove-orphans",
            'rm -rf "$storage_dir"',
        ]
    )
    return _run_shell_script(script, server)


def get_stack_primary_container(
    deployment_id: str,
    primary_service: str,
    server: Optional[dict] = None,
) -> tuple[str, str]:
    storage_dir = build_stack_storage_dir(deployment_id)
    project_name = build_stack_project_name(deployment_id)
    script = "\n".join(
        [
            "set -e",
            f'storage_dir="{storage_dir}"',
            'compose_path="${storage_dir}/compose.yaml"',
            'if [ ! -f "$compose_path" ]; then',
            f'  echo "Compose file is missing for stack deployment {deployment_id}." >&2',
            "  exit 1",
            "fi",
            f"container_id=$(docker compose -f \"$compose_path\" -p {shlex.quote(project_name)} ps -q {shlex.quote(primary_service)} | head -n 1)",
            'if [ -z "$container_id" ]; then',
            f'  echo "Primary service {primary_service} did not produce a running container." >&2',
            "  exit 1",
            "fi",
            'container_name=$(docker inspect --format "{{.Name}}" "$container_id" | sed \'s#^/##\')',
            'if [ -z "$container_name" ]; then',
            '  echo "Failed to inspect the primary service container name." >&2',
            "  exit 1",
            "fi",
            'printf "%s\\n%s\\n" "$container_id" "$container_name"',
        ]
    )
    result = _run_shell_script(script, server)
    if result.returncode != 0:
        error_message = result.stderr.strip() or result.stdout.strip()
        raise HTTPException(
            status_code=500,
            detail=error_message or "Failed to inspect the stack primary service container.",
        )

    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if len(lines) < 2:
        raise HTTPException(
            status_code=500,
            detail="Failed to resolve the stack primary service container.",
        )

    return lines[0], lines[1]


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
