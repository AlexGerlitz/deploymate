import unittest
import os
from datetime import datetime, timezone
from subprocess import CompletedProcess
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import require_auth


class DeploymentApiFlowTests(unittest.TestCase):
    def setUp(self):
        self.user = {
            "id": "user-1",
            "username": "smoke-admin",
            "role": "admin",
            "plan": "team",
            "must_change_password": False,
        }
        self.deployment = None
        self.notifications = []
        self.activity = []

        app.dependency_overrides[require_auth] = lambda: self.user

        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch("app.routes.deployments.enforce_plan_limit", return_value=None),
            patch("app.routes.deployments.ensure_docker_is_available", return_value=None),
            patch("app.routes.deployments.ensure_docker_compose_is_available", return_value=None),
            patch("app.routes.deployments.ensure_external_port_is_available", return_value=None),
            patch("app.routes.deployments.ensure_container_name_is_available", return_value=None),
            patch("app.routes.deployments.run_container", side_effect=self._run_container),
            patch("app.routes.deployments.run_compose_stack_up", side_effect=self._run_compose_stack_up),
            patch(
                "app.routes.deployments.get_stack_primary_container",
                side_effect=self._get_stack_primary_container,
            ),
            patch("app.routes.deployments.remove_container_if_exists", return_value=None),
            patch("app.routes.deployments.remove_stack_if_exists", side_effect=self._remove_stack_if_exists),
            patch("app.routes.deployments.insert_deployment_record", side_effect=self._insert_deployment_record),
            patch("app.routes.deployments.update_deployment_record", side_effect=self._update_deployment_record),
            patch("app.routes.deployments.update_deployment_configuration", side_effect=self._update_deployment_configuration),
            patch(
                "app.routes.deployments.update_deployment_previous_release_snapshot",
                side_effect=self._update_previous_release_snapshot,
            ),
            patch("app.routes.deployments.get_deployment_record_or_404", side_effect=self._get_deployment_record_or_404),
            patch("app.routes.deployments.delete_deployment_record", side_effect=self._delete_deployment_record),
            patch("app.routes.deployments.create_notification", side_effect=self._create_notification),
            patch("app.routes.deployments.create_activity_event", side_effect=self._create_activity_event),
            patch("app.routes.deployments.list_deployment_activity", side_effect=self._list_deployment_activity),
            patch("app.routes.deployment_observability.get_container_logs", side_effect=self._get_container_logs),
            patch("app.routes.deployment_observability.get_container_logs_tail", side_effect=self._get_container_logs),
            patch("app.routes.deployment_observability.inspect_container_state", side_effect=self._inspect_container_state),
            patch("app.routes.deployment_observability.probe_http_endpoint", side_effect=self._probe_http_endpoint),
            patch("app.routes.deployment_observability.get_deployment_record_or_404", side_effect=self._get_deployment_record_or_404),
            patch("app.routes.deployment_observability.get_server_or_404", return_value=None),
            patch("app.routes.deployment_observability.list_deployment_activity", side_effect=self._list_deployment_activity),
        ]

        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

        self.addCleanup(app.dependency_overrides.clear)
        self.local_runtime_env = patch.dict(
            os.environ,
            {"DEPLOYMATE_LOCAL_DOCKER_ENABLED": "true"},
            clear=False,
        )
        self.local_runtime_env.start()
        self.addCleanup(self.local_runtime_env.stop)
        self.client = TestClient(app)

    def _serialize_record(self, record):
        serialized = dict(record)
        for key, value in list(serialized.items()):
            if isinstance(value, datetime):
                serialized[key] = value.isoformat()
        env = serialized.get("env")
        if isinstance(env, str):
            import json

            serialized["env"] = json.loads(env)
        secrets = serialized.get("secrets")
        if isinstance(secrets, str):
            import json

            serialized["secrets"] = json.loads(secrets)
        return serialized

    def _insert_deployment_record(self, record):
        self.assertIn("stack_name", record)
        self.assertIn("primary_service", record)
        self.assertIn("health_target", record)
        self.assertIn("compose_yaml", record)
        self.deployment = self._serialize_record(record)

    def _update_deployment_record(self, deployment_id, **updates):
        self.assertEqual(deployment_id, self.deployment["id"])
        self.deployment.update(self._serialize_record(updates))

    def _update_deployment_configuration(self, deployment_id, **updates):
        self.assertEqual(deployment_id, self.deployment["id"])
        self.deployment.update(self._serialize_record(updates))

    def _update_previous_release_snapshot(self, deployment_id, previous_release_snapshot):
        self.assertEqual(deployment_id, self.deployment["id"])
        self.deployment["previous_release_snapshot"] = self._serialize_record(
            previous_release_snapshot
        ) if previous_release_snapshot else None

    def _get_deployment_record_or_404(self, deployment_id):
        if not self.deployment or self.deployment["id"] != deployment_id:
            raise AssertionError(f"Unknown deployment requested: {deployment_id}")
        return dict(self.deployment)

    def _delete_deployment_record(self, deployment_id):
        self.assertEqual(deployment_id, self.deployment["id"])
        self.deployment = None

    def _create_notification(self, **payload):
        entry = {
            "id": f"notification-{len(self.notifications) + 1}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            **payload,
        }
        self.notifications.append(entry)

    def _create_activity_event(self, **payload):
        entry = {
            "id": f"activity-{len(self.activity) + 1}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            **payload,
        }
        self.activity.insert(0, entry)

    def _list_deployment_activity(self, deployment_id):
        self.assertIsNotNone(self.deployment)
        self.assertEqual(deployment_id, self.deployment["id"])
        return list(self.activity)

    def _run_container(self, image, container_name, internal_port, external_port, env, secrets, server=None):
        self.assertIsNone(server)
        self.assertEqual(image, self.deployment["image"])
        self.assertEqual(container_name, self.deployment["container_name"])
        return CompletedProcess(
            args=["docker", "run"],
            returncode=0,
            stdout="container-flow-1\n",
            stderr="",
        )

    def _run_compose_stack_up(self, deployment_id, compose_yaml, server=None):
        self.assertIsNone(server)
        self.assertEqual(deployment_id, self.deployment["id"])
        self.assertIn("services:", compose_yaml)
        self.assertIn("web:", compose_yaml)
        return CompletedProcess(
            args=["docker", "compose", "up"],
            returncode=0,
            stdout="stack-up\n",
            stderr="",
        )

    def _get_stack_primary_container(self, deployment_id, primary_service, server=None):
        self.assertIsNone(server)
        self.assertEqual(deployment_id, self.deployment["id"])
        self.assertEqual(primary_service, self.deployment["primary_service"])
        return ("container-stack-1", "customer-portal-web-1")

    def _remove_stack_if_exists(self, deployment_id, server=None):
        self.assertIsNone(server)
        self.assertEqual(deployment_id, self.deployment["id"])
        return CompletedProcess(
            args=["docker", "compose", "down"],
            returncode=0,
            stdout="stack-down\n",
            stderr="",
        )

    def _get_container_logs(self, container_name, server=None, tail=None):
        self.assertIsNone(server)
        self.assertEqual(container_name, self.deployment["container_name"])
        if tail is not None:
            self.assertEqual(tail, 30)
        return CompletedProcess(
            args=["docker", "logs"],
            returncode=0,
            stdout="nginx entered RUNNING state\n",
            stderr="",
        )

    def _inspect_container_state(self, container_name, server=None):
        self.assertIsNone(server)
        self.assertEqual(container_name, self.deployment["container_name"])
        return {
            "Running": True,
            "RestartCount": 0,
            "StartedAt": "2026-04-02T00:00:00Z",
            "Error": "",
        }

    def _probe_http_endpoint(self, url, timeout=5.0):
        if self.deployment.get("health_target"):
            expected_url = self.deployment["health_target"]
        elif self.deployment.get("custom_domain"):
            expected_url = (
                f"{'https' if self.deployment.get('tls_enabled') else 'http'}://"
                f"{self.deployment['custom_domain']}"
            )
        else:
            expected_url = (
                f"http://{self.deployment.get('server_host') or '127.0.0.1'}:"
                f"{self.deployment['external_port']}"
            )
        self.assertEqual(url, expected_url)
        self.assertEqual(timeout, 5.0)
        return {
            "checked_at": 0,
            "ok": True,
            "status_code": 200,
            "error": None,
            "response_time_ms": 41,
        }

    def test_full_deployment_http_flow(self):
        create_response = self.client.post(
            "/deployments",
            json={
                "image": "nginx:alpine",
                "internal_port": 80,
                "external_port": 38080,
                "custom_domain": "app.example.com",
                "tls_enabled": True,
                "env": {"DEPLOYMATE_SMOKE": "1"},
            },
        )
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        deployment_id = created["id"]
        self.assertEqual(created["status"], "running")
        self.assertEqual(created["container_id"], "container-flow-1")
        self.assertEqual(created["external_port"], 38080)
        self.assertEqual(created["release_source"], "manual")
        self.assertEqual(created["runtime_shape"], "single")
        self.assertEqual(created["release_image_tag"], "alpine")
        self.assertEqual(created["release_triggered_by"], "smoke-admin")
        self.assertTrue(created["release_webhook_token"])
        self.assertEqual(created["custom_domain"], "app.example.com")
        self.assertTrue(created["tls_enabled"])
        self.assertEqual(created["secret_count"], 0)
        self.assertFalse(created["rollback_available"])
        self.assertIsNone(created["rollback_summary"])

        health_response = self.client.get(f"/deployments/{deployment_id}/health")
        self.assertEqual(health_response.status_code, 200)
        self.assertEqual(health_response.json()["status"], "healthy")

        logs_response = self.client.get(f"/deployments/{deployment_id}/logs")
        self.assertEqual(logs_response.status_code, 200)
        self.assertIn("RUNNING", logs_response.json()["logs"])

        diagnostics_response = self.client.get(f"/deployments/{deployment_id}/diagnostics")
        self.assertEqual(diagnostics_response.status_code, 200)
        diagnostics = diagnostics_response.json()
        self.assertEqual(diagnostics["deployment_id"], deployment_id)
        self.assertEqual(diagnostics["health"]["status"], "healthy")
        self.assertTrue(any(item["key"] == "container_runtime" for item in diagnostics["items"]))

        activity_response = self.client.get(f"/deployments/{deployment_id}/activity")
        self.assertEqual(activity_response.status_code, 200)
        activity = activity_response.json()
        self.assertGreaterEqual(len(activity), 1)
        self.assertEqual(activity[0]["category"], "deploy")
        titles = [item["title"] for item in activity]
        self.assertIn("Deployment started", titles)
        self.assertIn("Deployment succeeded", titles)
        started_event = next(item for item in activity if item["title"] == "Deployment started")
        self.assertIn("Starting deployment for nginx:alpine", started_event["message"])
        self.assertIn("Release trace: source manual", started_event["message"])

        delete_response = self.client.delete(f"/deployments/{deployment_id}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["status"], "deleted")
        self.assertIsNone(self.deployment)

    def test_stack_deployment_flow_uses_compose_runtime(self):
        create_response = self.client.post(
            "/deployments/stack",
            json={
                "stack_name": "customer-portal",
                "primary_service": "web",
                "health_target": "https://customer-portal.example.com/health",
                "compose_yaml": (
                    "services:\n"
                    "  web:\n"
                    "    image: ghcr.io/deploymate/customer-portal-web:2026.04.17\n"
                    "  worker:\n"
                    "    image: ghcr.io/deploymate/customer-portal-worker:2026.04.17\n"
                ),
            },
        )
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        deployment_id = created["id"]
        self.assertEqual(created["status"], "running")
        self.assertEqual(created["container_id"], "container-stack-1")
        self.assertEqual(created["container_name"], "customer-portal-web-1")
        self.assertEqual(created["runtime_shape"], "stack")
        self.assertEqual(created["release_source"], "compose")
        self.assertEqual(created["stack_name"], "customer-portal")
        self.assertEqual(created["primary_service"], "web")
        self.assertEqual(
            created["health_target"],
            "https://customer-portal.example.com/health",
        )

        health_response = self.client.get(f"/deployments/{deployment_id}/health")
        self.assertEqual(health_response.status_code, 200)
        health = health_response.json()
        self.assertEqual(health["status"], "healthy")
        self.assertEqual(
            health["url"],
            "https://customer-portal.example.com/health",
        )

        logs_response = self.client.get(f"/deployments/{deployment_id}/logs")
        self.assertEqual(logs_response.status_code, 200)
        self.assertIn("RUNNING", logs_response.json()["logs"])

        activity_response = self.client.get(f"/deployments/{deployment_id}/activity")
        self.assertEqual(activity_response.status_code, 200)
        activity = activity_response.json()
        titles = [item["title"] for item in activity]
        self.assertIn("Stack deployment started", titles)
        self.assertIn("Stack deployment succeeded", titles)

        delete_response = self.client.delete(f"/deployments/{deployment_id}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["status"], "deleted")
        self.assertIsNone(self.deployment)

    def test_stack_deployment_redeploy_endpoint_is_blocked(self):
        create_response = self.client.post(
            "/deployments/stack",
            json={
                "stack_name": "customer-portal",
                "primary_service": "web",
                "health_target": "https://customer-portal.example.com/health",
                "compose_yaml": (
                    "services:\n"
                    "  web:\n"
                    "    image: ghcr.io/deploymate/customer-portal-web:2026.04.17\n"
                    "  worker:\n"
                    "    image: ghcr.io/deploymate/customer-portal-worker:2026.04.17\n"
                ),
            },
        )
        deployment_id = create_response.json()["id"]

        redeploy_response = self.client.post(
            f"/deployments/{deployment_id}/redeploy",
            json={
                "image": "ghcr.io/deploymate/customer-portal-web:2026.04.18",
                "name": "customer-portal-web-v2",
                "internal_port": 80,
                "external_port": 38080,
                "env": {},
                "secrets": {},
            },
        )

        self.assertEqual(redeploy_response.status_code, 400)
        self.assertEqual(
            redeploy_response.json()["detail"],
            "Stack redeploy is not available yet. Review the running stack and delete it deliberately if you need a replacement.",
        )

    def test_stack_deployment_release_webhook_endpoint_is_blocked(self):
        create_response = self.client.post(
            "/deployments/stack",
            json={
                "stack_name": "customer-portal",
                "primary_service": "web",
                "health_target": "https://customer-portal.example.com/health",
                "compose_yaml": (
                    "services:\n"
                    "  web:\n"
                    "    image: ghcr.io/deploymate/customer-portal-web:2026.04.17\n"
                    "  worker:\n"
                    "    image: ghcr.io/deploymate/customer-portal-worker:2026.04.17\n"
                ),
            },
        )
        deployment_id = create_response.json()["id"]

        webhook_response = self.client.post(
            f"/deployments/{deployment_id}/release-webhook",
            headers={"x-deploymate-webhook-token": "unused-token"},
            json={
                "image": "ghcr.io/deploymate/customer-portal-web:2026.04.18",
                "ref": "refs/heads/main",
                "commit_sha": "abcdef1234567890",
            },
        )

        self.assertEqual(webhook_response.status_code, 400)
        self.assertEqual(
            webhook_response.json()["detail"],
            "Webhook-driven releases are not available for stack deployments yet.",
        )

    def test_stack_deployment_rollback_endpoint_is_blocked(self):
        create_response = self.client.post(
            "/deployments/stack",
            json={
                "stack_name": "customer-portal",
                "primary_service": "web",
                "health_target": "https://customer-portal.example.com/health",
                "compose_yaml": (
                    "services:\n"
                    "  web:\n"
                    "    image: ghcr.io/deploymate/customer-portal-web:2026.04.17\n"
                    "  worker:\n"
                    "    image: ghcr.io/deploymate/customer-portal-worker:2026.04.17\n"
                ),
            },
        )
        deployment_id = create_response.json()["id"]

        rollback_response = self.client.post(f"/deployments/{deployment_id}/rollback")

        self.assertEqual(rollback_response.status_code, 400)
        self.assertEqual(
            rollback_response.json()["detail"],
            "Stack rollback is not available yet. Review the running stack and replace it deliberately if needed.",
        )

    def test_logs_stay_readable_when_saved_server_target_is_missing(self):
        self.deployment = {
            "id": "dep-missing-server",
            "status": "running",
            "image": "nginx:alpine",
            "container_name": "missing-server-runtime",
            "container_id": "container-flow-2",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "error": None,
            "internal_port": 80,
            "external_port": 38080,
            "server_id": "srv-missing",
            "server_name": "Missing server",
            "server_host": "missing.example.com",
            "env": {},
        }

        with patch(
            "app.routes.deployment_observability.get_server_or_404",
            side_effect=HTTPException(status_code=404, detail="Server not found."),
        ):
            logs_response = self.client.get("/deployments/dep-missing-server/logs")

        self.assertEqual(logs_response.status_code, 200)
        self.assertIn("could not be loaded", logs_response.json()["logs"])

    def test_release_webhook_redeploys_existing_deployment_with_release_trace(self):
        self.deployment = {
            "id": "dep-webhook",
            "status": "running",
            "image": "nginx:alpine",
            "container_name": "webhook-runtime",
            "container_id": "container-flow-3",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "error": None,
            "internal_port": 80,
            "external_port": 38080,
            "server_id": None,
            "server_name": None,
            "server_host": None,
            "release_source": "manual",
            "runtime_shape": "single",
            "release_ref": None,
            "release_commit_sha": None,
            "release_image_tag": "alpine",
            "release_image_digest": None,
            "release_triggered_at": datetime.now(timezone.utc).isoformat(),
            "release_triggered_by": "smoke-admin",
            "release_webhook_token": "webhook-token-1",
            "env": {"DEPLOYMATE_SMOKE": "1"},
            "secrets": {"API_KEY": "super-secret"},
            "secret_count": 1,
        }

        response = self.client.post(
            "/deployments/dep-webhook/release-webhook",
            headers={"x-deploymate-webhook-token": "webhook-token-1"},
            json={
                "image": "nginx:1.27",
                "ref": "refs/heads/main",
                "commit_sha": "abcdef1234567890",
                "triggered_by": "github-actions",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["image"], "nginx:1.27")
        self.assertEqual(payload["release_source"], "webhook")
        self.assertEqual(payload["release_ref"], "refs/heads/main")
        self.assertEqual(payload["release_commit_sha"], "abcdef1234567890")
        self.assertEqual(payload["release_image_tag"], "1.27")
        self.assertEqual(payload["release_triggered_by"], "github-actions")
        self.assertEqual(payload["secret_count"], 1)
        self.assertEqual(payload["secrets"]["API_KEY"], "••••••")

        activity_response = self.client.get("/deployments/dep-webhook/activity")
        self.assertEqual(activity_response.status_code, 200)
        titles = [item["title"] for item in activity_response.json()]
        self.assertIn("Release webhook received", titles)
        succeeded_event = next(
            item for item in activity_response.json() if item["title"] == "Redeploy succeeded"
        )
        self.assertIn("source webhook", succeeded_event["message"])
        self.assertIn("refs/heads/main", succeeded_event["message"])

    def test_rollback_restores_previous_release_snapshot(self):
        create_response = self.client.post(
            "/deployments",
            json={
                "image": "nginx:alpine",
                "internal_port": 80,
                "external_port": 38080,
            },
        )
        deployment_id = create_response.json()["id"]

        redeploy_response = self.client.post(
            f"/deployments/{deployment_id}/redeploy",
            json={
                "image": "nginx:1.27",
                "name": "runtime-v2",
                "internal_port": 80,
                "external_port": 38080,
                "env": {"MODE": "v2"},
                "secrets": {},
            },
        )
        self.assertEqual(redeploy_response.status_code, 200)
        redeployed = redeploy_response.json()
        self.assertTrue(redeployed["rollback_available"])
        self.assertIn("nginx:alpine", redeployed["rollback_summary"])

        rollback_response = self.client.post(f"/deployments/{deployment_id}/rollback")
        self.assertEqual(rollback_response.status_code, 200)
        rolled_back = rollback_response.json()
        self.assertEqual(rolled_back["image"], "nginx:alpine")
        self.assertEqual(rolled_back["release_source"], "rollback")
        self.assertFalse(rolled_back["rollback_available"])


if __name__ == "__main__":
    unittest.main()
