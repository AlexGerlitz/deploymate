import os
import shlex
import subprocess
import tempfile
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

    ssh_command.extend(
        [
            "ssh",
            "-p",
            str(server["port"]),
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "UserKnownHostsFile=/dev/null",
        ]
    )

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


def test_server_connection(server: dict) -> dict[str, str]:
    ssh_result = _run_remote_command(server, ["echo", "deploymate-ssh-ok"])
    if ssh_result.returncode != 0:
        error_message = ssh_result.stderr.strip() or ssh_result.stdout.strip()
        return {
            "status": "error",
            "message": error_message or "SSH connection failed.",
        }

    docker_result = _run_remote_command(server, ["docker", "--version"])
    if docker_result.returncode != 0:
        error_message = docker_result.stderr.strip() or docker_result.stdout.strip()
        return {
            "status": "error",
            "message": error_message or "Docker is not available on the server.",
        }

    docker_output = docker_result.stdout.strip() or docker_result.stderr.strip()
    return {
        "status": "success",
        "message": docker_output or f'SSH and Docker are available on server {server["name"]}.',
    }
