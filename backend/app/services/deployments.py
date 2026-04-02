import os
import json
import shlex
import subprocess
import tempfile
import time
from typing import Dict, List, Optional
from shutil import which

from fastapi import HTTPException


def build_container_name(request_name: Optional[str], deployment_id: str) -> str:
    if request_name:
        return request_name
    short_id = deployment_id.split("-")[0]
    return f"deploymate-{short_id}"


def _run_local_command(command: List[str]) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"{command[0]} is not installed or not available in PATH.",
        ) from exc


def local_docker_runtime_enabled() -> bool:
    raw_value = os.getenv("DEPLOYMATE_LOCAL_DOCKER_ENABLED", "true").strip().lower()
    return raw_value not in {"0", "false", "no", "off"}


def ensure_local_docker_runtime_enabled() -> None:
    if not local_docker_runtime_enabled():
        raise HTTPException(
            status_code=400,
            detail=(
                "Local host deployments are disabled in this environment. "
                "Attach a remote server target to continue."
            ),
        )


def _get_ssh_host_key_mode() -> str:
    mode = os.getenv("DEPLOYMATE_SSH_HOST_KEY_CHECKING", "accept-new").strip().lower()
    if mode in {"accept-new", "yes", "no"}:
        return mode
    return "accept-new"


def _get_ssh_known_hosts_file(mode: str) -> str:
    if mode == "no":
        return "/dev/null"

    configured = os.getenv("DEPLOYMATE_SSH_KNOWN_HOSTS_FILE", "").strip()
    if configured:
        return configured
    return os.path.expanduser("~/.deploymate_known_hosts")


def _build_ssh_base_command(server: dict) -> list[str]:
    mode = _get_ssh_host_key_mode()
    known_hosts_file = _get_ssh_known_hosts_file(mode)

    if known_hosts_file not in {"", "/dev/null"}:
        known_hosts_dir = os.path.dirname(known_hosts_file)
        if known_hosts_dir:
            os.makedirs(known_hosts_dir, exist_ok=True)

    return [
        "ssh",
        "-p",
        str(server["port"]),
        "-o",
        f"StrictHostKeyChecking={mode}",
        "-o",
        f"UserKnownHostsFile={known_hosts_file}",
        "-o",
        "LogLevel=ERROR",
    ]


def _run_remote_command(server: dict, command: List[str]) -> subprocess.CompletedProcess:
    ssh_command: List[str] = []
    temp_key_path = None

    if server["auth_type"] == "password":
        if not server.get("password"):
            raise HTTPException(status_code=400, detail="Password is required for this server.")
        if which("sshpass") is None:
            raise HTTPException(
                status_code=500,
                detail="sshpass is required for password-based SSH servers.",
            )
        ssh_command.extend(["sshpass", "-p", server["password"]])
    elif server["auth_type"] == "ssh_key":
        if not server.get("ssh_key"):
            raise HTTPException(status_code=400, detail="SSH key is required for this server.")
        with tempfile.NamedTemporaryFile("w", delete=False) as temp_key:
            temp_key.write(server["ssh_key"])
            temp_key_path = temp_key.name
        os.chmod(temp_key_path, 0o600)
    else:
        raise HTTPException(status_code=400, detail="Unsupported server auth_type.")

    ssh_command.extend(_build_ssh_base_command(server))

    if temp_key_path:
        ssh_command.extend(["-i", temp_key_path])

    ssh_command.append(f'{server["username"]}@{server["host"]}')
    ssh_command.append(shlex.join(command))

    try:
        return subprocess.run(
            ssh_command,
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail="SSH tooling is not installed or not available in PATH.",
        ) from exc
    finally:
        if temp_key_path and os.path.exists(temp_key_path):
            os.unlink(temp_key_path)


def _run_docker_command(command: List[str], server: Optional[dict]) -> subprocess.CompletedProcess:
    if server:
        return _run_remote_command(server, command)
    ensure_local_docker_runtime_enabled()
    return _run_local_command(command)


def run_diagnostic_command(
    command: List[str],
    server: Optional[dict] = None,
) -> subprocess.CompletedProcess:
    if server:
        return _run_remote_command(server, command)
    ensure_local_docker_runtime_enabled()
    return _run_local_command(command)


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


def collect_server_diagnostics(server: dict) -> dict[str, object]:
    target = f'{server["username"]}@{server["host"]}:{server["port"]}'
    diagnostics: dict[str, object] = {
        "target": target,
        "checked_at": time.time(),
        "ssh_ok": False,
        "docker_ok": False,
        "hostname": None,
        "operating_system": None,
        "uptime": None,
        "disk_usage": None,
        "memory": None,
        "docker_version": None,
        "docker_compose_version": None,
        "listening_ports": [],
        "items": [],
    }

    ssh_result = _run_remote_command(server, ["echo", "deploymate-ssh-ok"])
    if ssh_result.returncode != 0:
        error_message = ssh_result.stderr.strip() or ssh_result.stdout.strip()
        diagnostics["items"] = [
            {
                "key": "ssh",
                "label": "SSH access",
                "status": "error",
                "summary": "SSH connection failed.",
                "details": error_message or "SSH connection failed.",
            }
        ]
        return diagnostics

    diagnostics["ssh_ok"] = True
    items: list[dict[str, object]] = [
        {
            "key": "ssh",
            "label": "SSH access",
            "status": "ok",
            "summary": "SSH connection is available.",
            "details": target,
        }
    ]

    docker_result = _run_remote_command(server, ["docker", "--version"])
    if docker_result.returncode == 0:
        docker_output = docker_result.stdout.strip() or docker_result.stderr.strip()
        diagnostics["docker_ok"] = True
        diagnostics["docker_version"] = docker_output
        items.append(
            {
                "key": "docker",
                "label": "Docker engine",
                "status": "ok",
                "summary": "Docker is available.",
                "details": docker_output,
            }
        )
    else:
        docker_error = docker_result.stderr.strip() or docker_result.stdout.strip()
        items.append(
            {
                "key": "docker",
                "label": "Docker engine",
                "status": "error",
                "summary": "Docker is not available.",
                "details": docker_error or "Docker is not available on the server.",
            }
        )
        diagnostics["items"] = items
        return diagnostics

    command_specs = [
        ("hostname", ["hostname"], "Hostname"),
        ("operating_system", ["sh", "-lc", "uname -sr"], "Operating system"),
        ("uptime", ["sh", "-lc", "uptime"], "Uptime"),
        ("disk_usage", ["sh", "-lc", "df -h / | tail -1"], "Disk usage"),
        (
            "memory",
            ["sh", "-lc", "free -m | awk 'NR==2 {printf \"used %sMB / total %sMB\", $3, $2}'"],
            "Memory",
        ),
        ("docker_compose_version", ["docker", "compose", "version"], "Docker Compose"),
        ("listening_ports", ["ss", "-ltnH"], "Listening ports"),
    ]

    for key, command, label in command_specs:
        result = _run_remote_command(server, command)
        output = result.stdout.strip() or result.stderr.strip()
        if result.returncode != 0:
            if key in {"disk_usage", "memory", "docker_compose_version", "listening_ports"}:
                items.append(
                    {
                        "key": key,
                        "label": label,
                        "status": "warn",
                        "summary": "This diagnostic could not be collected.",
                        "details": output or "Command failed.",
                    }
                )
            continue

        if key == "listening_ports":
            ports: list[int] = []
            for line in output.splitlines():
                parts = line.split()
                if len(parts) < 4:
                    continue
                port_text = parts[3].rsplit(":", 1)[-1]
                if port_text.isdigit():
                    ports.append(int(port_text))
            diagnostics["listening_ports"] = sorted(set(ports))[:12]
            items.append(
                {
                    "key": "listening_ports",
                    "label": label,
                    "status": "ok",
                    "summary": f"Found {len(set(ports))} listening TCP ports.",
                    "details": ", ".join(str(port) for port in sorted(set(ports))[:12]) or "No TCP ports reported.",
                }
            )
            continue

        diagnostics[key] = output
        if key in {"disk_usage", "memory", "docker_compose_version"}:
            items.append(
                {
                    "key": key,
                    "label": label,
                    "status": "ok",
                    "summary": f"{label} collected.",
                    "details": output,
                }
            )

    diagnostics["items"] = items
    return diagnostics


def test_server_connection(server: dict) -> dict[str, object]:
    diagnostics = collect_server_diagnostics(server)
    target = str(diagnostics["target"])
    if not diagnostics.get("ssh_ok"):
        items = diagnostics.get("items") or []
        error_message = items[0]["details"] if items else None
        return {
            "status": "error",
            "message": error_message or "SSH connection failed.",
            "target": target,
            "ssh_ok": False,
            "docker_ok": False,
            "docker_version": None,
        }

    if not diagnostics.get("docker_ok"):
        docker_item = next(
            (item for item in diagnostics.get("items", []) if item.get("key") == "docker"),
            None,
        )
        error_message = docker_item.get("details") if docker_item else None
        return {
            "status": "error",
            "message": error_message or "Docker is not available on the server.",
            "target": target,
            "ssh_ok": True,
            "docker_ok": False,
            "docker_version": None,
        }

    docker_output = diagnostics.get("docker_version")
    return {
        "status": "success",
        "message": docker_output or f'SSH and Docker are available on server {server["name"]}.',
        "target": target,
        "ssh_ok": True,
        "docker_ok": True,
        "docker_version": docker_output or None,
    }
