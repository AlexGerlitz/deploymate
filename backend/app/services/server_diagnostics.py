import time

from app.services.runtime_executors import _run_remote_command


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
