import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import require_admin


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
            "items": [
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

        ports_response = self.client.get(
            f"/servers/{server_id}/suggested-ports?limit=2&start_port=38080"
        )
        self.assertEqual(ports_response.status_code, 200)
        self.assertEqual(ports_response.json()["ports"], [38080, 38081])

        delete_response = self.client.delete(f"/servers/{server_id}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["status"], "deleted")
        self.assertIsNone(self.server)


if __name__ == "__main__":
    unittest.main()
