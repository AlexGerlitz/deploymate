import unittest
import json
import os
import tempfile
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import require_auth


class OpsApiFlowTests(unittest.TestCase):
    def setUp(self):
        self.user = {
            "id": "user-1",
            "username": "smoke-admin",
            "role": "admin",
            "plan": "team",
            "must_change_password": True,
        }
        self.deployments = [
            {
                "id": "deployment-1",
                "status": "running",
                "image": "nginx:alpine",
                "container_name": "smoke-runtime",
                "container_id": "container-1",
                "server_id": "server-1",
                "server_name": "Smoke VPS",
                "server_host": "203.0.113.10",
                "internal_port": 80,
                "external_port": 38080,
                "error": None,
                "created_at": "2026-04-02T00:00:00Z",
            },
            {
                "id": "deployment-2",
                "status": "failed",
                "image": "redis:7-alpine",
                "container_name": "smoke-failed",
                "container_id": None,
                "server_id": None,
                "server_name": None,
                "server_host": None,
                "internal_port": None,
                "external_port": None,
                "error": "Image pull failed",
                "created_at": "2026-04-02T00:05:00Z",
            },
        ]
        self.servers = [
            {
                "id": "server-1",
                "name": "Smoke VPS",
                "host": "203.0.113.10",
                "port": 22,
                "username": "deploy",
                "auth_type": "ssh_key",
                "created_at": "2026-04-02T00:00:00Z",
            },
            {
                "id": "server-2",
                "name": "Legacy VPS",
                "host": "203.0.113.11",
                "port": 22,
                "username": "root",
                "auth_type": "password",
                "created_at": "2026-04-02T00:10:00Z",
            },
        ]
        self.templates = [
            {
                "id": "template-1",
                "template_name": "Smoke template",
                "image": "nginx:alpine",
                "name": "smoke-runtime",
                "server_id": "server-1",
                "server_name": "Smoke VPS",
                "server_host": "203.0.113.10",
                "internal_port": 80,
                "external_port": 38080,
                "env": {"APP_ENV": "smoke"},
                "use_count": 2,
                "last_used_at": "2026-04-02T00:20:00Z",
                "updated_at": "2026-04-02T00:20:00Z",
                "created_at": "2026-04-02T00:00:00Z",
            },
            {
                "id": "template-2",
                "template_name": "Unused template",
                "image": "redis:7-alpine",
                "name": "unused-cache",
                "server_id": None,
                "server_name": None,
                "server_host": None,
                "internal_port": None,
                "external_port": None,
                "env": {},
                "use_count": 0,
                "last_used_at": None,
                "updated_at": "2026-04-01T00:00:00Z",
                "created_at": "2026-04-01T00:00:00Z",
            },
        ]
        self.notifications = [
            {
                "id": "notification-1",
                "deployment_id": "deployment-2",
                "level": "error",
                "title": "Deployment failed",
                "message": "Image pull failed",
                "created_at": "2026-04-02T00:06:00Z",
            },
            {
                "id": "notification-2",
                "deployment_id": "deployment-1",
                "level": "success",
                "title": "Deployment created",
                "message": "Deploy completed successfully",
                "created_at": "2026-04-02T00:01:00Z",
            },
        ]

        app.dependency_overrides[require_auth] = lambda: self.user

        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch("app.routes.ops.list_deployment_records", side_effect=lambda: list(self.deployments)),
            patch("app.routes.ops.list_servers", side_effect=lambda: list(self.servers)),
            patch("app.routes.ops.list_deployment_templates", side_effect=lambda: list(self.templates)),
            patch("app.routes.ops.list_notifications", side_effect=self._list_notifications),
        ]

        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)

    def _list_notifications(self, limit=100):
        return list(self.notifications[:limit])

    def test_full_ops_http_flow(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as handle:
            handle.write("203.0.113.10 ssh-ed25519 AAAAC3NzaSmokeKey\n")
            known_hosts_path = handle.name

        self.addCleanup(lambda: os.path.exists(known_hosts_path) and os.unlink(known_hosts_path))

        with patch.dict(
            os.environ,
            {
                "DEPLOYMATE_LOCAL_DOCKER_ENABLED": "false",
                "DEPLOYMATE_SSH_HOST_KEY_CHECKING": "yes",
                "DEPLOYMATE_SSH_KNOWN_HOSTS_FILE": known_hosts_path,
                "DEPLOYMATE_SERVER_CREDENTIALS_KEY": "configured-key",
            },
            clear=False,
        ):
            overview_response = self.client.get("/ops/overview?notifications_limit=100")
            self.assertEqual(overview_response.status_code, 200)
            overview = overview_response.json()
            self.assertEqual(overview["user"]["username"], "smoke-admin")
            self.assertEqual(overview["deployments"]["total"], 2)
            self.assertEqual(overview["deployments"]["failed"], 1)
            self.assertEqual(overview["servers"]["unused"], 1)
            self.assertEqual(overview["notifications"]["error"], 1)
            self.assertEqual(overview["templates"]["top_template_name"], "Smoke template")
            self.assertFalse(overview["capabilities"]["local_docker_enabled"])
            self.assertEqual(overview["capabilities"]["ssh_host_key_checking"], "yes")
            self.assertTrue(overview["capabilities"]["strict_known_hosts_configured"])
            self.assertTrue(overview["capabilities"]["server_credentials_key_configured"])
            self.assertGreaterEqual(len(overview["attention_items"]), 3)

        deployments_export_response = self.client.get("/ops/exports/deployments?format=json")
        self.assertEqual(deployments_export_response.status_code, 200)
        self.assertEqual(deployments_export_response.json()["count"], 2)

        servers_export_response = self.client.get("/ops/exports/servers?format=csv")
        self.assertEqual(servers_export_response.status_code, 200)
        self.assertIn("deploymate-servers.csv", servers_export_response.headers["content-disposition"])
        self.assertIn("Smoke VPS", servers_export_response.text)

        servers_json_response = self.client.get("/ops/exports/servers?format=json")
        self.assertEqual(servers_json_response.status_code, 200)
        servers_json = servers_json_response.json()
        self.assertEqual(servers_json["count"], 2)
        self.assertNotIn("password", servers_json["items"][0])
        self.assertNotIn("ssh_key", servers_json["items"][0])

        templates_export_response = self.client.get("/ops/exports/templates?format=json")
        self.assertEqual(templates_export_response.status_code, 200)
        templates_export = templates_export_response.json()
        self.assertEqual(templates_export["count"], 2)
        self.assertEqual(templates_export["items"][0]["template_name"], "Smoke template")

        activity_export_response = self.client.get("/ops/exports/activity?format=csv&limit=2")
        self.assertEqual(activity_export_response.status_code, 200)
        self.assertIn("deploymate-activity.csv", activity_export_response.headers["content-disposition"])
        self.assertIn("deploy", activity_export_response.text.lower())
        self.assertIn("Deployment failed", activity_export_response.text)

        activity_json_response = self.client.get("/ops/exports/activity?format=json&limit=2")
        self.assertEqual(activity_json_response.status_code, 200)
        activity_json = activity_json_response.json()
        self.assertEqual(activity_json["count"], 2)
        categories = [item["category"] for item in activity_json["items"]]
        self.assertIn("deploy", categories)

    def test_ops_overview_degrades_when_notifications_are_unavailable(self):
        with patch("app.routes.ops.list_notifications", side_effect=RuntimeError("notifications unavailable")):
            response = self.client.get("/ops/overview?notifications_limit=100")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["notifications"]["total"], 0)
        degraded_titles = [item["title"] for item in payload["attention_items"]]
        self.assertIn("Activity data is temporarily unavailable", degraded_titles)

    def test_ops_overview_flags_strict_ssh_when_known_hosts_are_missing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            missing_known_hosts_path = os.path.join(temp_dir, "missing-known_hosts")

            with patch.dict(
                os.environ,
                {
                    "DEPLOYMATE_LOCAL_DOCKER_ENABLED": "false",
                    "DEPLOYMATE_SSH_HOST_KEY_CHECKING": "yes",
                    "DEPLOYMATE_SSH_KNOWN_HOSTS_FILE": missing_known_hosts_path,
                },
                clear=False,
            ):
                response = self.client.get("/ops/overview?notifications_limit=100")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        titles = [item["title"] for item in payload["attention_items"]]
        self.assertIn("Strict SSH trust is enabled but not ready", titles)

    def test_ops_overview_includes_release_maintenance_diagnostics(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as handle:
            json.dump(
                {
                    "generated_at": "2026-06-21T02:36:36Z",
                    "ready_for_unpause": "0",
                    "release_audit_scheduled_paused": "true",
                    "staging_release_paused": "true",
                    "network_checks": "enabled",
                    "issue_18_state": "OPEN",
                    "issue_18_failure_category": "ssh_auth_denied",
                    "issue_18_operator_hint": "Restore the deploy public key.",
                    "issue_19_state": "CLOSED",
                    "issue_19_failure_category": "unavailable",
                    "blocker_count": "3",
                    "blocker_1": "release audit schedule paused",
                },
                handle,
            )
            status_path = handle.name

        self.addCleanup(lambda: os.path.exists(status_path) and os.unlink(status_path))

        with patch.dict(
            os.environ,
            {
                "DEPLOYMATE_RELEASE_MAINTENANCE_STATUS_FILE": status_path,
            },
            clear=False,
        ):
            response = self.client.get("/ops/overview?notifications_limit=100")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        release = payload["release_maintenance"]
        self.assertTrue(release["available"])
        self.assertEqual(release["source"], "release_maintenance_status")
        self.assertFalse(release["ready_for_unpause"])
        self.assertTrue(release["release_audit_scheduled_paused"])
        self.assertTrue(release["staging_release_paused"])
        self.assertEqual(release["network_checks"], "enabled")
        self.assertEqual(release["blocker_count"], 3)
        self.assertEqual(release["primary_blocker"], "release audit schedule paused")
        self.assertEqual(release["production"]["state"], "OPEN")
        self.assertEqual(release["production"]["failure_category"], "ssh_auth_denied")
        self.assertEqual(release["next_step"], "Restore the deploy public key.")
        self.assertEqual(
            [step["key"] for step in release["repair_playbook"]],
            [
                "keep-trust-anchor",
                "restore-deploy-key",
                "rerun-release-audit",
                "close-and-unpause",
            ],
        )
        self.assertIn("authorized_keys", release["repair_playbook"][1]["detail"])
        titles = [item["title"] for item in payload["attention_items"]]
        self.assertIn("Release maintenance is not ready for unpause", titles)

    def test_ops_overview_accepts_public_evidence_bundle_status(self):
        with tempfile.NamedTemporaryFile("w", delete=False) as handle:
            json.dump(
                {
                    "maintenance": {
                        "generated_at": "2026-06-21T02:43:00Z",
                        "ready_for_unpause": "1",
                        "release_audit_scheduled_paused": "false",
                        "staging_release_paused": "false",
                        "network_checks": "skipped",
                        "issue_18_state": "CLOSED",
                        "issue_19_state": "CLOSED",
                        "blocker_count": "0",
                    }
                },
                handle,
            )
            status_path = handle.name

        self.addCleanup(lambda: os.path.exists(status_path) and os.unlink(status_path))

        with patch.dict(
            os.environ,
            {
                "DEPLOYMATE_RELEASE_MAINTENANCE_STATUS_FILE": status_path,
            },
            clear=False,
        ):
            response = self.client.get("/ops/overview?notifications_limit=100")

        self.assertEqual(response.status_code, 200)
        release = response.json()["release_maintenance"]
        self.assertTrue(release["available"])
        self.assertEqual(release["source"], "public_evidence_bundle")
        self.assertTrue(release["ready_for_unpause"])
        self.assertEqual(
            release["next_step"],
            "Release maintenance is ready; remove pauses only during a planned release window.",
        )
        self.assertEqual(release["repair_playbook"][0]["key"], "planned-unpause")

    def test_ops_export_returns_503_when_source_loader_fails(self):
        with patch("app.routes.ops.list_servers", side_effect=RuntimeError("db unavailable")):
            response = self.client.get("/ops/exports/servers?format=json")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["detail"],
            "Servers export is temporarily unavailable.",
        )


if __name__ == "__main__":
    unittest.main()
