import unittest
from subprocess import CompletedProcess
from unittest.mock import patch

from fastapi import HTTPException

from app.routes.deployments import (
    _build_deployment_diagnostics,
    delete_deployment,
    redeploy_deployment,
)
from app.services.deployment_observability import build_deployment_health_response
from app.schemas import DeploymentCreateRequest


def _deployment_record(**overrides):
    record = {
        "id": "dep-1",
        "status": "running",
        "image": "nginx:latest",
        "container_name": "demo-app",
        "container_id": "container-1",
        "created_at": "2026-04-02T10:00:00+00:00",
        "error": None,
        "internal_port": 80,
        "external_port": 8080,
        "server_id": "srv-1",
        "server_name": "prod",
        "server_host": "deploymate.example",
        "env": {"MODE": "prod"},
    }
    record.update(overrides)
    return record


def _server_record(**overrides):
    record = {
        "id": "srv-1",
        "name": "prod",
        "host": "deploymate.example",
        "port": 22,
        "username": "deploy",
        "auth_type": "ssh_key",
    }
    record.update(overrides)
    return record


def _admin_user():
    return {
        "id": "admin-1",
        "username": "admin",
        "role": "admin",
    }


class DeploymentRouteTests(unittest.TestCase):
    def test_redeploy_success_updates_record_and_emits_success_events(self):
        payload = DeploymentCreateRequest(
            image="nginx:1.27",
            name="demo-v2",
            internal_port=80,
            external_port=8081,
            env={"MODE": "blue"},
        )
        existing = _deployment_record()
        saved = _deployment_record(
            image="nginx:1.27",
            container_name="demo-v2",
            container_id="container-2",
            external_port=8081,
            env={"MODE": "blue"},
        )

        with patch("app.routes.deployments.get_deployment_record_or_404", side_effect=[existing, saved]):
            with patch("app.routes.deployments.get_server_or_404", return_value=_server_record()):
                with patch("app.routes.deployments.ensure_docker_is_available") as ensure_docker:
                    with patch("app.routes.deployments.ensure_external_port_is_available") as ensure_port:
                        with patch("app.routes.deployments.ensure_container_name_is_available") as ensure_name:
                            with patch("app.routes.deployments.remove_container_if_exists") as remove_container:
                                with patch("app.routes.deployments.update_deployment_configuration") as update_config:
                                    with patch("app.routes.deployments.update_deployment_record") as update_record:
                                        with patch(
                                            "app.routes.deployments.run_container",
                                            return_value=CompletedProcess(
                                                args=["docker", "run"],
                                                returncode=0,
                                                stdout="container-2\n",
                                                stderr="",
                                            ),
                                        ) as run_container:
                                            with patch("app.routes.deployments.create_notification") as notify:
                                                with patch("app.routes.deployments.create_activity_event") as activity:
                                                    response = redeploy_deployment("dep-1", payload, user=_admin_user())

        self.assertEqual(response.container_name, "demo-v2")
        self.assertEqual(response.container_id, "container-2")
        ensure_docker.assert_called_once()
        ensure_port.assert_called_once_with(8081, _server_record())
        ensure_name.assert_called_once_with("demo-v2", _server_record())
        remove_container.assert_called_once_with("demo-app", _server_record())
        update_config.assert_called_once_with(
            deployment_id="dep-1",
            image="nginx:1.27",
            container_name="demo-v2",
            internal_port=80,
            external_port=8081,
            env={"MODE": "blue"},
        )
        self.assertEqual(
            update_record.call_args_list[0].kwargs,
            {
                "deployment_id": "dep-1",
                "status": "pending",
                "container_id": None,
                "error": None,
            },
        )
        self.assertEqual(
            update_record.call_args_list[1].kwargs,
            {
                "deployment_id": "dep-1",
                "status": "running",
                "container_id": "container-2",
                "error": None,
            },
        )
        run_container.assert_called_once_with(
            image="nginx:1.27",
            container_name="demo-v2",
            internal_port=80,
            external_port=8081,
            env={"MODE": "blue"},
            server=_server_record(),
        )
        self.assertEqual(notify.call_args.kwargs["title"], "Redeploy succeeded")
        self.assertEqual(activity.call_args.kwargs["title"], "Redeploy succeeded")
        self.assertEqual(activity.call_args_list[0].kwargs["title"], "Redeploy started")
        self.assertIn("Starting redeploy for dep-1", activity.call_args_list[0].kwargs["message"])
        self.assertIn("nginx:1.27", activity.call_args_list[0].kwargs["message"])

    def test_redeploy_runtime_failure_marks_deployment_failed(self):
        payload = DeploymentCreateRequest(
            image="nginx:1.27",
            name=None,
            internal_port=80,
            external_port=8080,
            env={},
        )
        existing = _deployment_record()
        failed = _deployment_record(status="failed", container_id=None, error="port 8080 is already allocated")

        with patch("app.routes.deployments.get_deployment_record_or_404", side_effect=[existing, failed]):
            with patch("app.routes.deployments.get_server_or_404", return_value=_server_record()):
                with patch("app.routes.deployments.ensure_docker_is_available"):
                    with patch("app.routes.deployments.remove_container_if_exists"):
                        with patch("app.routes.deployments.update_deployment_configuration") as update_config:
                            with patch("app.routes.deployments.update_deployment_record") as update_record:
                                with patch(
                                    "app.routes.deployments.run_container",
                                    return_value=CompletedProcess(
                                        args=["docker", "run"],
                                        returncode=1,
                                        stdout="docker: Error response from daemon: port 8080 is already allocated\n",
                                        stderr="",
                                    ),
                                ):
                                    with patch("app.routes.deployments.create_notification") as notify:
                                        with patch("app.routes.deployments.create_activity_event") as activity:
                                            response = redeploy_deployment("dep-1", payload, user=_admin_user())

        self.assertEqual(response.status, "failed")
        self.assertEqual(response.error, "port 8080 is already allocated")
        update_config.assert_called_once()
        self.assertEqual(
            update_record.call_args_list[0].kwargs,
            {
                "deployment_id": "dep-1",
                "status": "pending",
                "container_id": None,
                "error": None,
            },
        )
        self.assertEqual(
            update_record.call_args_list[1].kwargs,
            {
                "deployment_id": "dep-1",
                "status": "failed",
                "container_id": None,
                "error": "port 8080 is already allocated",
            },
        )
        self.assertEqual(notify.call_args.kwargs["title"], "Redeploy failed")
        self.assertIn("port 8080 is already allocated", notify.call_args.kwargs["message"])
        self.assertEqual(activity.call_args.kwargs["title"], "Redeploy failed")
        self.assertEqual(activity.call_args_list[0].kwargs["title"], "Redeploy started")
        self.assertIn("Starting redeploy for dep-1", activity.call_args_list[0].kwargs["message"])
        self.assertIn("while starting demo-app", activity.call_args_list[1].kwargs["message"])

    def test_delete_failure_emits_error_events_and_raises_clean_message(self):
        deployment = _deployment_record()

        with patch("app.routes.deployments.get_deployment_record_or_404", return_value=deployment):
            with patch("app.routes.deployments.get_server_or_404", return_value=_server_record()):
                with patch("app.routes.deployments.ensure_docker_is_available"):
                    with patch(
                        "app.routes.deployments.remove_container_if_exists",
                        side_effect=HTTPException(
                            status_code=500,
                            detail="docker: Error response from daemon: No such container: demo-app",
                        ),
                    ):
                        with patch("app.routes.deployments.create_notification") as notify:
                            with patch("app.routes.deployments.create_activity_event") as activity:
                                with self.assertRaises(HTTPException) as context:
                                    delete_deployment("dep-1", user=_admin_user())

        self.assertEqual(context.exception.status_code, 500)
        self.assertEqual(context.exception.detail, "No such container: demo-app")
        self.assertEqual(notify.call_args.kwargs["title"], "Delete failed")
        self.assertEqual(activity.call_args.kwargs["title"], "Delete failed")
        self.assertEqual(activity.call_args_list[0].kwargs["title"], "Delete started")
        self.assertIn("Starting delete for dep-1", activity.call_args_list[0].kwargs["message"])

    def test_build_deployment_diagnostics_handles_missing_external_port_and_missing_runtime_state(self):
        deployment = _deployment_record(
            external_port=None,
            status="failed",
            container_id=None,
            error="Container crashed during boot.",
            server_host=None,
        )
        activity = [
            {
                "id": "evt-1",
                "deployment_id": "dep-1",
                "level": "error",
                "title": "Redeploy failed",
                "message": "Container crashed during boot.",
                "created_at": "2026-04-02T10:10:00+00:00",
            }
        ]

        with patch("app.routes.deployments.get_server_or_404", return_value=_server_record()):
            with patch("app.routes.deployments.list_deployment_activity", return_value=activity):
                with patch("app.routes.deployments.inspect_container_state", return_value=None):
                    with patch(
                        "app.routes.deployments.get_container_logs_tail",
                        return_value=CompletedProcess(
                            args=["docker", "logs"],
                            returncode=1,
                            stdout="",
                            stderr="docker logs failed",
                        ),
                    ):
                        diagnostics = _build_deployment_diagnostics(deployment)

        self.assertEqual(diagnostics.health.status, "unhealthy")
        self.assertIn("no external port", diagnostics.health.error.lower())
        self.assertEqual(diagnostics.server_target, "deploy@deploymate.example:22")
        self.assertEqual(diagnostics.activity.error_events, 1)
        self.assertEqual(diagnostics.log_excerpt, "")
        item_by_key = {item.key: item for item in diagnostics.items}
        self.assertEqual(item_by_key["deployment_status"].status, "warn")
        self.assertEqual(item_by_key["health"].status, "error")
        self.assertEqual(item_by_key["activity"].status, "error")
        self.assertEqual(item_by_key["container_runtime"].summary, "Container state is unavailable.")
        self.assertEqual(item_by_key["logs"].status, "warn")
        self.assertEqual(item_by_key["logs"].details, "docker logs failed")

    def test_build_deployment_health_response_returns_unhealthy_when_external_port_missing(self):
        deployment = _deployment_record(
            external_port=None,
            status="running",
            container_id="container-1",
        )

        health = build_deployment_health_response(deployment)

        self.assertEqual(health.status, "unhealthy")
        self.assertIsNone(health.url)
        self.assertIn("no external port", health.error.lower())

    def test_build_deployment_diagnostics_keeps_working_when_server_record_is_missing(self):
        deployment = _deployment_record(
            server_host="prod.example.com",
            status="running",
        )

        with patch(
            "app.routes.deployments.get_server_or_404",
            side_effect=HTTPException(status_code=404, detail="Server not found."),
        ):
            with patch("app.routes.deployments.list_deployment_activity", return_value=[]):
                with patch(
                    "app.routes.deployments.inspect_container_state",
                    return_value={
                        "Running": True,
                        "RestartCount": 0,
                        "StartedAt": "2026-04-02T00:00:00Z",
                        "Error": "",
                    },
                ):
                    with patch(
                        "app.routes.deployments.get_container_logs_tail",
                        return_value=CompletedProcess(
                            args=["docker", "logs"],
                            returncode=0,
                            stdout="runtime ok",
                            stderr="",
                        ),
                    ):
                        diagnostics = _build_deployment_diagnostics(deployment)

        self.assertEqual(diagnostics.server_target, "deploy@prod.example.com:22")
        item_by_key = {item.key: item for item in diagnostics.items}
        self.assertEqual(item_by_key["server_record"].status, "warn")
        self.assertIn("404", item_by_key["server_record"].details)


if __name__ == "__main__":
    unittest.main()
