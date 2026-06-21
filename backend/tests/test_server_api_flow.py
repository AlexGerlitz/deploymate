import unittest
import os
import tempfile
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import DiagnosticItem
from app.services.auth import require_admin
from app.services.server_diagnostics import build_server_passport, build_ssh_trust_summary


class ServerApiFlowTests(unittest.TestCase):
    def setUp(self):
        self.user = {
            "id": "admin-1",
            "username": "smoke-admin",
            "role": "admin",
            "plan": "team",
            "must_change_password": False,
        }
        self.server = None

        app.dependency_overrides[require_admin] = lambda: self.user

        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch("app.routes.servers.enforce_plan_limit", return_value=None),
            patch("app.routes.servers.insert_server", side_effect=self._insert_server),
            patch("app.routes.servers.list_servers", side_effect=self._list_servers),
            patch("app.routes.servers.get_server_or_404", side_effect=self._get_server_or_404),
            patch("app.routes.servers.update_server_record", side_effect=self._update_server_record),
            patch("app.routes.servers.delete_server_record", side_effect=self._delete_server_record),
            patch("app.routes.servers.count_deployments_for_server", side_effect=self._count_deployments_for_server),
            patch("app.routes.servers.test_server_connection", side_effect=self._test_server_connection),
            patch("app.routes.servers.collect_server_diagnostics", side_effect=self._collect_server_diagnostics),
            patch("app.routes.servers.get_suggested_external_ports", side_effect=self._get_suggested_external_ports),
        ]

        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)

    def _serialize_server(self, record):
        serialized = dict(record)
        created_at = serialized.get("created_at")
        if isinstance(created_at, datetime):
            serialized["created_at"] = created_at.isoformat()
        return serialized

    def _insert_server(self, record):
        self.server = self._serialize_server(record)

    def _list_servers(self):
        return [dict(self.server)] if self.server else []

    def _get_server_or_404(self, server_id):
        if not self.server or self.server["id"] != server_id:
            raise AssertionError(f"Unknown server requested: {server_id}")
        return dict(self.server)

    def _update_server_record(self, server_id, record):
        self.assertEqual(server_id, self.server["id"])
        self.server = self._serialize_server(
            {
                **self.server,
                **record,
                "id": server_id,
                "created_at": self.server["created_at"],
            }
        )

    def _delete_server_record(self, server_id):
        self.assertEqual(server_id, self.server["id"])
        self.server = None

    def _count_deployments_for_server(self, server_id):
        self.assertEqual(server_id, self.server["id"])
        return 0

    def _test_server_connection(self, server):
        self.assertEqual(server["id"], self.server["id"])
        return {
            "status": "success",
            "message": "Docker version 29.3.1, build c2be9cc",
            "target": f'{server["username"]}@{server["host"]}:{server["port"]}',
            "ssh_ok": True,
            "docker_ok": True,
            "docker_version": "Docker version 29.3.1, build c2be9cc",
        }

    def _collect_server_diagnostics(self, server):
        self.assertEqual(server["id"], self.server["id"])
        return {
            "target": f'{server["username"]}@{server["host"]}:{server["port"]}',
            "hostname": "smoke-vps",
            "operating_system": "Ubuntu 24.04",
            "uptime": "up 3 days",
            "disk_usage": "24%",
            "memory": "512Mi free",
            "docker_version": "Docker version 29.3.1, build c2be9cc",
            "docker_compose_version": "Docker Compose version v2.39.4",
            "listening_ports": [22, 80, 443],
            "ssh_trust": {
                "status": "ok",
                "mode": "yes",
                "known_hosts_path": "/etc/deploymate/known_hosts",
                "known_hosts_configured": True,
                "known_hosts_entries": 1,
                "review_command": "bash scripts/prepare_known_hosts.sh --host 203.0.113.20 --port 2222 --output /tmp/deploymate_known_hosts",
                "next_step": "Strict SSH trust is pinned.",
            },
            "items": [
                {
                    "key": "ssh_trust",
                    "label": "SSH trust",
                    "status": "ok",
                    "summary": "Strict SSH trust is pinned.",
                    "details": "Known host entry is present.",
                },
                {
                    "key": "ssh",
                    "label": "SSH access",
                    "status": "ok",
                    "summary": "SSH connection is available.",
                    "details": f'{server["username"]}@{server["host"]}:{server["port"]}',
                },
                {
                    "key": "docker",
                    "label": "Docker engine",
                    "status": "ok",
                    "summary": "Docker is available.",
                    "details": "Docker version 29.3.1, build c2be9cc",
                },
            ],
        }

    def _get_suggested_external_ports(self, server, limit=3, start_port=8080):
        self.assertEqual(server["id"], self.server["id"])
        self.assertEqual(limit, 2)
        self.assertEqual(start_port, 38080)
        return [38080, 38081]

    def test_create_server_requires_ssh_key_for_ssh_key_auth(self):
        response = self.client.post(
            "/servers",
            json={
                "name": "smoke-vps",
                "host": "203.0.113.10",
                "port": 22,
                "username": "deploy",
                "auth_type": "ssh_key",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "ssh_key is required for auth_type=ssh_key.")

    def test_full_server_http_flow(self):
        create_response = self.client.post(
            "/servers",
            json={
                "name": "smoke-vps",
                "host": "203.0.113.10",
                "port": 22,
                "username": "deploy",
                "auth_type": "ssh_key",
                "ssh_key": "PRIVATE-KEY",
            },
        )
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        server_id = created["id"]
        self.assertEqual(created["name"], "smoke-vps")

        list_response = self.client.get("/servers")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 1)

        get_response = self.client.get(f"/servers/{server_id}")
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.json()["host"], "203.0.113.10")

        update_response = self.client.patch(
            f"/servers/{server_id}",
            json={
                "name": "smoke-vps-2",
                "host": "203.0.113.20",
                "port": 2222,
                "username": "root",
                "auth_type": "ssh_key",
                "ssh_key": "UPDATED-PRIVATE-KEY",
            },
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["name"], "smoke-vps-2")
        self.assertEqual(updated["host"], "203.0.113.20")
        self.assertEqual(updated["port"], 2222)
        self.assertEqual(updated["username"], "root")

        test_response = self.client.post(f"/servers/{server_id}/test")
        self.assertEqual(test_response.status_code, 200)
        tested = test_response.json()
        self.assertTrue(tested["ssh_ok"])
        self.assertTrue(tested["docker_ok"])

        diagnostics_response = self.client.get(f"/servers/{server_id}/diagnostics")
        self.assertEqual(diagnostics_response.status_code, 200)
        diagnostics = diagnostics_response.json()
        self.assertEqual(diagnostics["overall_status"], "ok")
        self.assertEqual(diagnostics["deployment_count"], 0)
        self.assertEqual(diagnostics["listening_ports"], [22, 80, 443])
        self.assertEqual(diagnostics["ssh_trust"]["status"], "ok")
        self.assertEqual(diagnostics["ssh_trust"]["mode"], "yes")
        self.assertTrue(diagnostics["ssh_trust"]["known_hosts_configured"])
        self.assertIn("prepare_known_hosts.sh", diagnostics["ssh_trust"]["review_command"])
        self.assertEqual(diagnostics["passport"]["status"], "ready")
        self.assertEqual(diagnostics["passport"]["risk_level"], "low")
        self.assertIn("ready for the next deployment step", diagnostics["passport"]["summary"])
        self.assertIn("Deployment Workflow", diagnostics["passport"]["next_step"])
        self.assertEqual(diagnostics["passport"]["evidence_order"][0]["key"], "ssh_trust")
        self.assertEqual(diagnostics["passport"]["evidence_order"][1]["key"], "ssh")

        ports_response = self.client.get(
            f"/servers/{server_id}/suggested-ports?limit=2&start_port=38080"
        )
        self.assertEqual(ports_response.status_code, 200)
        self.assertEqual(ports_response.json()["ports"], [38080, 38081])

        delete_response = self.client.delete(f"/servers/{server_id}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["status"], "deleted")
        self.assertIsNone(self.server)

    def test_server_passport_blocks_reachable_server_without_docker(self):
        diagnostics = {
            "target": "deploy@203.0.113.10:22",
            "ssh_ok": True,
            "docker_ok": False,
            "operating_system": "Ubuntu 24.04",
            "items": [
                DiagnosticItem(
                    key="ssh",
                    label="SSH access",
                    status="ok",
                    summary="SSH connection is available.",
                ),
                DiagnosticItem(
                    key="docker",
                    label="Docker engine",
                    status="error",
                    summary="Docker is not available.",
                    details="docker: command not found",
                ),
            ],
        }

        passport = build_server_passport(
            {
                "name": "smoke-vps",
                "host": "203.0.113.10",
                "port": 22,
                "username": "deploy",
            },
            diagnostics,
            overall_status="error",
            deployment_count=0,
        )

        self.assertEqual(passport.status, "blocked")
        self.assertEqual(passport.risk_level, "high")
        self.assertIn("Docker is not ready", passport.summary)
        self.assertIn("Install or repair Docker", passport.next_step)
        self.assertEqual([item.key for item in passport.evidence_order], ["ssh", "docker"])

    def test_ssh_trust_summary_requires_known_hosts_in_strict_mode(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            missing_known_hosts = os.path.join(tmpdir, "known_hosts")
            with patch.dict(
                os.environ,
                {
                    "DEPLOYMATE_SSH_HOST_KEY_CHECKING": "yes",
                    "DEPLOYMATE_SSH_KNOWN_HOSTS_FILE": missing_known_hosts,
                },
                clear=False,
            ):
                summary = build_ssh_trust_summary(
                    {
                        "host": "203.0.113.10",
                        "port": 22,
                    }
                )

        self.assertEqual(summary.status, "error")
        self.assertEqual(summary.mode, "yes")
        self.assertFalse(summary.known_hosts_configured)
        self.assertIn("prepare_known_hosts.sh", summary.review_command)
        self.assertIn("known_hosts", summary.next_step)

    def test_ssh_trust_summary_counts_known_host_entries(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as handle:
            handle.write("# comment\n203.0.113.10 ssh-ed25519 AAAAC3NzaSmoke\n\n")
            known_hosts_path = handle.name

        self.addCleanup(lambda: os.path.exists(known_hosts_path) and os.unlink(known_hosts_path))

        with patch.dict(
            os.environ,
            {
                "DEPLOYMATE_SSH_HOST_KEY_CHECKING": "yes",
                "DEPLOYMATE_SSH_KNOWN_HOSTS_FILE": known_hosts_path,
            },
            clear=False,
        ):
            summary = build_ssh_trust_summary(
                {
                    "host": "203.0.113.10",
                    "port": 22,
                }
            )

        self.assertEqual(summary.status, "ok")
        self.assertTrue(summary.known_hosts_configured)
        self.assertEqual(summary.known_hosts_entries, 1)


if __name__ == "__main__":
    unittest.main()
