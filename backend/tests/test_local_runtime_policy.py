import os
import unittest
from datetime import datetime, timezone
from subprocess import CompletedProcess
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import require_auth


class LocalRuntimePolicyTests(unittest.TestCase):
    def setUp(self):
        self.user = {
            "id": "user-1",
            "username": "smoke-admin",
            "role": "admin",
            "plan": "team",
            "must_change_password": False,
        }
        self.deployment = {
            "id": "deployment-local-1",
            "status": "running",
            "image": "nginx:alpine",
            "container_name": "local-runtime",
            "container_id": "container-local-1",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "error": None,
            "internal_port": 80,
            "external_port": 38080,
            "server_id": None,
            "server_name": None,
            "server_host": None,
            "env": {},
        }

        app.dependency_overrides[require_auth] = lambda: self.user
        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch("app.routes.deployments.enforce_plan_limit", return_value=None),
            patch("app.routes.deployments.get_deployment_record_or_404", return_value=dict(self.deployment)),
            patch("app.routes.deployments.get_server_or_404", side_effect=AssertionError("unexpected server lookup")),
            patch("app.routes.deployments.ensure_docker_is_available", return_value=None),
            patch("app.routes.deployments.ensure_external_port_is_available", return_value=None),
            patch("app.routes.deployments.ensure_container_name_is_available", return_value=None),
            patch("app.routes.deployments.remove_container_if_exists", return_value=None),
            patch(
                "app.routes.deployments.run_container",
                return_value=CompletedProcess(args=["docker", "run"], returncode=0, stdout="container-2\n", stderr=""),
            ),
        ]

        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)

    def test_create_deployment_rejects_local_runtime_when_disabled(self):
        with patch.dict(os.environ, {"DEPLOYMATE_LOCAL_DOCKER_ENABLED": "false"}, clear=False):
            response = self.client.post(
                "/deployments",
                json={
                    "image": "nginx:alpine",
                    "internal_port": 80,
                    "external_port": 38080,
                    "env": {},
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Local host deployments are disabled", response.json()["detail"])

    def test_template_create_rejects_local_runtime_when_disabled(self):
        with patch.dict(os.environ, {"DEPLOYMATE_LOCAL_DOCKER_ENABLED": "false"}, clear=False):
            response = self.client.post(
                "/deployment-templates",
                json={
                    "template_name": "local-template",
                    "image": "nginx:alpine",
                    "internal_port": 80,
                    "external_port": 38080,
                    "env": {},
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Local host deployments are disabled", response.json()["detail"])

    def test_redeploy_rejects_existing_local_deployment_when_disabled(self):
        with patch.dict(os.environ, {"DEPLOYMATE_LOCAL_DOCKER_ENABLED": "false"}, clear=False):
            response = self.client.post(
                f"/deployments/{self.deployment['id']}/redeploy",
                json={
                    "image": "nginx:alpine",
                    "name": "local-runtime",
                    "internal_port": 80,
                    "external_port": 38080,
                    "env": {},
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Local host deployments are disabled", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
