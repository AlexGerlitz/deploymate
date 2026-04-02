import os
import shlex
import subprocess
import tempfile
from dataclasses import dataclass
from shutil import which
from typing import List, Optional

from fastapi import HTTPException

from app.services.server_credentials import ServerCredentialCryptoError, decrypt_server_credential


def local_docker_runtime_enabled() -> bool:
    raw_value = os.getenv("DEPLOYMATE_LOCAL_DOCKER_ENABLED", "false").strip().lower()
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


def ensure_runtime_target_allowed(server: Optional[dict] = None) -> None:
    if server is not None:
        return
    ensure_local_docker_runtime_enabled()


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

    if mode == "yes":
        if not known_hosts_file or known_hosts_file == "/dev/null":
            raise HTTPException(
                status_code=500,
                detail="Strict SSH host key checking requires a real known_hosts file.",
            )
        if not os.path.isfile(known_hosts_file):
            raise HTTPException(
                status_code=500,
                detail=(
                    "Strict SSH host key checking is enabled, but the known_hosts file "
                    f'"{known_hosts_file}" does not exist.'
                ),
            )
        if os.path.getsize(known_hosts_file) == 0:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Strict SSH host key checking is enabled, but the known_hosts file "
                    f'"{known_hosts_file}" is empty.'
                ),
            )

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


@dataclass
class LocalRuntimeExecutor:
    def run(self, command: List[str]) -> subprocess.CompletedProcess:
        ensure_local_docker_runtime_enabled()
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


@dataclass
class RemoteRuntimeExecutor:
    server: dict

    def run(self, command: List[str]) -> subprocess.CompletedProcess:
        ssh_command: List[str] = []
        temp_key_path = None
        try:
            password = decrypt_server_credential(self.server.get("password"))
            ssh_key = decrypt_server_credential(self.server.get("ssh_key"))
        except ServerCredentialCryptoError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        if self.server["auth_type"] == "password":
            if not password:
                raise HTTPException(status_code=400, detail="Password is required for this server.")
            if which("sshpass") is None:
                raise HTTPException(
                    status_code=500,
                    detail="sshpass is required for password-based SSH servers.",
                )
            ssh_command.extend(["sshpass", "-p", password])
        elif self.server["auth_type"] == "ssh_key":
            if not ssh_key:
                raise HTTPException(status_code=400, detail="SSH key is required for this server.")
            with tempfile.NamedTemporaryFile("w", delete=False) as temp_key:
                temp_key.write(ssh_key)
                temp_key_path = temp_key.name
            os.chmod(temp_key_path, 0o600)
        else:
            raise HTTPException(status_code=400, detail="Unsupported server auth_type.")

        ssh_command.extend(_build_ssh_base_command(self.server))

        if temp_key_path:
            ssh_command.extend(["-i", temp_key_path])

        ssh_command.append(f'{self.server["username"]}@{self.server["host"]}')
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


def get_runtime_executor(server: Optional[dict] = None) -> LocalRuntimeExecutor | RemoteRuntimeExecutor:
    if server:
        return RemoteRuntimeExecutor(server)
    return LocalRuntimeExecutor()


def run_runtime_command(
    command: List[str],
    server: Optional[dict] = None,
) -> subprocess.CompletedProcess:
    return get_runtime_executor(server).run(command)


def run_diagnostic_command(
    command: List[str],
    server: Optional[dict] = None,
) -> subprocess.CompletedProcess:
    return run_runtime_command(command, server)


def _run_remote_command(server: dict, command: List[str]) -> subprocess.CompletedProcess:
    return RemoteRuntimeExecutor(server).run(command)
