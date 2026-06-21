import os
import time
from pathlib import Path

from app.schemas import (
    DiagnosticItem,
    ServerPassportEvidenceItem,
    ServerPassportResponse,
    ServerSshTrustSummary,
)
from app.services.runtime_executors import _run_remote_command


def build_ssh_trust_summary(server: dict) -> ServerSshTrustSummary:
    mode = os.getenv("DEPLOYMATE_SSH_HOST_KEY_CHECKING", "yes").strip().lower() or "yes"
    if mode not in {"yes", "accept-new", "no"}:
        mode = "yes"

    known_hosts_path = os.getenv("DEPLOYMATE_SSH_KNOWN_HOSTS_FILE", "").strip() or None
    entries = 0
    known_hosts_configured = False
    if known_hosts_path:
        path = Path(known_hosts_path)
        if path.is_file():
            try:
                entries = sum(
                    1
                    for line in path.read_text(encoding="utf-8", errors="replace").splitlines()
                    if line.strip() and not line.lstrip().startswith("#")
                )
            except OSError:
                entries = 0
            known_hosts_configured = entries > 0

    host = server.get("host", "<target-host>")
    port = server.get("port", 22)
    review_command = (
        f"bash scripts/prepare_known_hosts.sh --host {host} --port {port} "
        "--output /tmp/deploymate_known_hosts"
    )

    if mode == "yes" and known_hosts_configured:
        return ServerSshTrustSummary(
            status="ok",
            mode=mode,
            known_hosts_path=known_hosts_path,
            known_hosts_configured=True,
            known_hosts_entries=entries,
            review_command=review_command,
            next_step="Strict SSH trust is pinned. Recheck the fingerprint only after a host rebuild or provider-side change.",
        )

    if mode == "yes":
        return ServerSshTrustSummary(
            status="error",
            mode=mode,
            known_hosts_path=known_hosts_path,
            known_hosts_configured=False,
            known_hosts_entries=entries,
            review_command=review_command,
            next_step="Prepare and confirm a non-empty known_hosts file before trusting this server for deployments.",
        )

    return ServerSshTrustSummary(
        status="warn",
        mode=mode,
        known_hosts_path=known_hosts_path,
        known_hosts_configured=known_hosts_configured,
        known_hosts_entries=entries,
        review_command=review_command,
        next_step="Switch back to strict known_hosts verification before treating this server as production-ready.",
    )


def collect_server_diagnostics(server: dict) -> dict[str, object]:
    target = f'{server["username"]}@{server["host"]}:{server["port"]}'
    ssh_trust = build_ssh_trust_summary(server)
    diagnostics: dict[str, object] = {
        "target": target,
        "checked_at": time.time(),
        "ssh_ok": False,
        "docker_ok": False,
        "ssh_trust": ssh_trust,
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
                "key": "ssh_trust",
                "label": "SSH trust",
                "status": ssh_trust.status,
                "summary": ssh_trust.next_step,
                "details": ssh_trust.review_command,
            },
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
            "key": "ssh_trust",
            "label": "SSH trust",
            "status": ssh_trust.status,
            "summary": ssh_trust.next_step,
            "details": ssh_trust.review_command,
        },
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


def build_server_passport(
    server: dict,
    diagnostics: dict[str, object],
    *,
    overall_status: str,
    deployment_count: int,
) -> ServerPassportResponse:
    raw_items = diagnostics.get("items") or []
    items = [
        item if isinstance(item, DiagnosticItem) else DiagnosticItem(**item)
        for item in raw_items
    ]
    error_items = [item for item in items if item.status == "error"]
    warn_items = [item for item in items if item.status == "warn"]
    server_name = server.get("name") or diagnostics.get("target") or "Server target"
    ssh_ok = bool(diagnostics.get("ssh_ok")) or any(
        item.key == "ssh" and item.status == "ok" for item in items
    )
    docker_ok = bool(diagnostics.get("docker_ok")) or any(
        item.key == "docker" and item.status == "ok" for item in items
    )

    if not ssh_ok or any(item.key == "ssh" and item.status == "error" for item in items):
        passport_status = "blocked"
        risk_level = "high"
        summary = f"{server_name} is blocked because SSH access is not confirmed."
        next_step = (
            "Fix SSH host, port, user, key, or network reachability before using this "
            "server for deployments."
        )
    elif not docker_ok or any(item.key == "docker" and item.status == "error" for item in items):
        passport_status = "blocked"
        risk_level = "high"
        summary = f"{server_name} is reachable, but Docker is not ready for deployments."
        next_step = "Install or repair Docker on the target, then rerun server readiness before moving to Step 2."
    elif overall_status == "warn" or warn_items:
        passport_status = "review"
        risk_level = "medium"
        summary = f"{server_name} needs operator review before it becomes the main rollout target."
        next_step = (
            "Review warnings, disk, memory, compose, and listening ports, then rerun "
            "diagnostics if anything changed."
        )
    elif overall_status == "ok":
        passport_status = "ready"
        risk_level = "low"
        summary = f"{server_name} looks ready for the next deployment step."
        next_step = (
            "Use this server in Deployment Workflow, and rerun readiness only if connection "
            "details or runtime state changed."
        )
    else:
        passport_status = "review"
        risk_level = "medium"
        summary = f"{server_name} still needs a readiness check before deployments use it."
        next_step = "Run full server diagnostics so DeployMate can confirm SSH, Docker, and basic runtime signals."

    item_by_key = {item.key: item for item in items}
    evidence_order = []
    for key in [
        "ssh_trust",
        "ssh",
        "docker",
        "disk_usage",
        "memory",
        "docker_compose_version",
        "listening_ports",
    ]:
        item = item_by_key.get(key)
        if item is None:
            continue
        evidence_order.append(
            ServerPassportEvidenceItem(
                key=item.key,
                label=item.label,
                status=item.status,
                summary=item.summary,
            )
        )

    if not evidence_order:
        evidence_order.append(
            ServerPassportEvidenceItem(
                key="server_target",
                label="Server target",
                status="unknown",
                summary="No ordered server evidence is available yet.",
            )
        )

    fallback_username = server.get("username", "deploy")
    fallback_host = server.get("host", "unknown")
    fallback_port = server.get("port", 22)
    target = str(diagnostics.get("target") or f"{fallback_username}@{fallback_host}:{fallback_port}")
    handoff_notes = [
        f"Target: {target}.",
        f"Overall status: {overall_status}.",
        f"Deployments using this server: {deployment_count}.",
        f"SSH: {'ok' if ssh_ok else 'not confirmed'}; Docker: {'ok' if docker_ok else 'not confirmed'}.",
    ]
    ssh_trust = diagnostics.get("ssh_trust")
    if isinstance(ssh_trust, ServerSshTrustSummary):
        handoff_notes.append(
            f"SSH trust: {ssh_trust.status}, mode {ssh_trust.mode}, known_hosts entries {ssh_trust.known_hosts_entries}."
        )
    elif isinstance(ssh_trust, dict):
        handoff_notes.append(
            "SSH trust: "
            f"{ssh_trust.get('status', 'unknown')}, mode {ssh_trust.get('mode', 'unknown')}, "
            f"known_hosts entries {ssh_trust.get('known_hosts_entries', 0)}."
        )
    if diagnostics.get("operating_system"):
        handoff_notes.append(f"OS: {diagnostics['operating_system']}.")
    if diagnostics.get("disk_usage"):
        handoff_notes.append(f"Disk: {diagnostics['disk_usage']}.")
    if diagnostics.get("memory"):
        handoff_notes.append(f"Memory: {diagnostics['memory']}.")
    listening_ports = diagnostics.get("listening_ports")
    if isinstance(listening_ports, list) and listening_ports:
        handoff_notes.append(
            "Listening ports: " + ", ".join(str(port) for port in listening_ports[:12]) + "."
        )

    return ServerPassportResponse(
        status=passport_status,
        risk_level=risk_level,
        summary=summary,
        next_step=next_step,
        evidence_order=evidence_order,
        handoff_notes=handoff_notes,
    )


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
