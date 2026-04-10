import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import require_auth


class MemberOwnershipIsolationTests(unittest.TestCase):
    def setUp(self):
        self.user = {
            "id": "member-1",
            "username": "member-user",
            "role": "member",
            "plan": "trial",
            "must_change_password": False,
        }
        self.deployments = [
            {
                "id": "deployment-own",
                "owner_user_id": "member-1",
                "status": "running",
                "image": "nginx:alpine",
                "container_name": "member-runtime",
                "container_id": "container-own",
                "created_at": "2026-04-02T00:00:00Z",
                "error": None,
                "internal_port": 80,
                "external_port": 38080,
                "server_id": None,
                "server_name": None,
                "server_host": None,
                "env": {},
            },
            {
                "id": "deployment-foreign",
                "owner_user_id": "admin-1",
                "status": "running",
                "image": "redis:7-alpine",
                "container_name": "admin-runtime",
                "container_id": "container-foreign",
                "created_at": "2026-04-02T00:05:00Z",
                "error": None,
                "internal_port": 6379,
                "external_port": 38081,
                "server_id": None,
                "server_name": None,
                "server_host": None,
                "env": {},
            },
        ]
        self.templates = [
            {
                "id": "template-own",
                "owner_user_id": "member-1",
                "template_name": "member-template",
                "image": "nginx:alpine",
                "name": "member-runtime",
                "internal_port": 80,
                "external_port": 38080,
                "server_id": None,
                "server_name": None,
                "server_host": None,
                "env": {},
                "created_at": "2026-04-02T00:00:00Z",
                "updated_at": "2026-04-02T00:00:00Z",
                "last_used_at": None,
                "use_count": 0,
            },
            {
                "id": "template-foreign",
                "owner_user_id": "admin-1",
                "template_name": "admin-template",
                "image": "redis:7-alpine",
                "name": "admin-runtime",
                "internal_port": 6379,
                "external_port": 38081,
                "server_id": None,
                "server_name": None,
                "server_host": None,
                "env": {},
                "created_at": "2026-04-02T00:05:00Z",
                "updated_at": "2026-04-02T00:05:00Z",
                "last_used_at": None,
                "use_count": 1,
            },
        ]
        self.notifications = [
            {
                "id": "notification-own",
                "deployment_id": "deployment-own",
                "level": "success",
                "title": "Deployment succeeded",
                "message": "Member deployment completed successfully.",
                "created_at": "2026-04-02T00:06:00Z",
            },
            {
                "id": "notification-foreign",
                "deployment_id": "deployment-foreign",
                "level": "error",
                "title": "Deployment failed",
                "message": "Foreign deployment failed.",
                "created_at": "2026-04-02T00:07:00Z",
            },
        ]
        self.remote_server = {
            "id": "server-admin",
            "name": "Admin VPS",
            "host": "203.0.113.10",
            "port": 22,
            "username": "deploy",
            "auth_type": "ssh_key",
            "created_at": "2026-04-02T00:00:00Z",
        }

        app.dependency_overrides[require_auth] = lambda: self.user
        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch("app.routes.deployments.enforce_plan_limit", return_value=None),
            patch("app.routes.deployments.list_deployment_records", side_effect=lambda: list(self.deployments)),
            patch("app.routes.deployments.get_deployment_record_or_404", side_effect=self._get_deployment_or_404),
            patch("app.routes.deployments.get_server_or_404", side_effect=self._get_server_or_404),
            patch(
                "app.routes.deployment_observability.get_deployment_record_or_404",
                side_effect=self._get_deployment_or_404,
            ),
            patch(
                "app.routes.deployment_observability.get_container_logs",
                side_effect=AssertionError("unexpected access to foreign logs"),
            ),
            patch("app.routes.deployment_templates.list_deployment_templates", side_effect=lambda: list(self.templates)),
            patch(
                "app.routes.deployment_templates.get_deployment_template_or_404",
                side_effect=self._get_template_or_404,
            ),
            patch("app.routes.deployment_templates.get_server_or_404", side_effect=self._get_server_or_404),
            patch("app.routes.ops.list_deployment_records", side_effect=lambda: list(self.deployments)),
            patch("app.routes.ops.list_deployment_templates", side_effect=lambda: list(self.templates)),
            patch("app.routes.ops.list_notifications", side_effect=self._list_notifications),
            patch("app.routes.notifications.list_deployment_records", side_effect=lambda: list(self.deployments)),
            patch("app.routes.notifications.list_notifications", side_effect=self._list_notifications),
        ]

        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)

    def _get_deployment_or_404(self, deployment_id):
        for deployment in self.deployments:
            if deployment["id"] == deployment_id:
                return dict(deployment)
        raise AssertionError(f"Unknown deployment requested: {deployment_id}")

    def _get_template_or_404(self, template_id):
        for template in self.templates:
            if template["id"] == template_id:
                return dict(template)
        raise AssertionError(f"Unknown template requested: {template_id}")

    def _list_notifications(self, limit=100):
        return list(self.notifications[:limit])

    def _get_server_or_404(self, server_id):
        if server_id != self.remote_server["id"]:
            raise AssertionError(f"Unknown server requested: {server_id}")
        return dict(self.remote_server)

    def test_member_sees_only_owned_deployments_and_templates(self):
        deployments_response = self.client.get("/deployments")
        self.assertEqual(deployments_response.status_code, 200)
        deployments = deployments_response.json()
        self.assertEqual(len(deployments), 1)
        self.assertEqual(deployments[0]["id"], "deployment-own")

        foreign_deployment_response = self.client.get("/deployments/deployment-foreign")
        self.assertEqual(foreign_deployment_response.status_code, 404)
        self.assertEqual(foreign_deployment_response.json()["detail"], "Deployment not found.")

        templates_response = self.client.get("/deployment-templates")
        self.assertEqual(templates_response.status_code, 200)
        templates = templates_response.json()
        self.assertEqual(len(templates), 1)
        self.assertEqual(templates[0]["id"], "template-own")

        foreign_template_response = self.client.put(
            "/deployment-templates/template-foreign",
            json={
                "template_name": "admin-template",
                "image": "redis:7-alpine",
                "name": "admin-runtime",
                "internal_port": 6379,
                "external_port": 38081,
                "env": {},
            },
        )
        self.assertEqual(foreign_template_response.status_code, 404)
        self.assertEqual(foreign_template_response.json()["detail"], "Deployment template not found.")

    def test_member_exports_are_scoped_to_owned_records(self):
        overview_response = self.client.get("/ops/overview?notifications_limit=100")
        self.assertEqual(overview_response.status_code, 200)
        overview = overview_response.json()
        self.assertEqual(overview["deployments"]["total"], 1)
        self.assertEqual(overview["templates"]["total"], 1)
        self.assertEqual(overview["notifications"]["total"], 1)
        self.assertEqual(overview["servers"]["total"], 0)

        deployments_export_response = self.client.get("/ops/exports/deployments?format=json")
        self.assertEqual(deployments_export_response.status_code, 200)
        deployments_export = deployments_export_response.json()
        self.assertEqual(deployments_export["count"], 1)
        self.assertEqual(deployments_export["items"][0]["id"], "deployment-own")

        templates_export_response = self.client.get("/ops/exports/templates?format=json")
        self.assertEqual(templates_export_response.status_code, 200)
        templates_export = templates_export_response.json()
        self.assertEqual(templates_export["count"], 1)
        self.assertEqual(templates_export["items"][0]["id"], "template-own")

        activity_export_response = self.client.get("/ops/exports/activity?format=json&limit=10")
        self.assertEqual(activity_export_response.status_code, 200)
        activity_export = activity_export_response.json()
        self.assertEqual(activity_export["count"], 1)
        self.assertEqual(activity_export["items"][0]["deployment_id"], "deployment-own")

    def test_member_cannot_open_foreign_logs_or_server_inventory_export(self):
        logs_response = self.client.get("/deployments/deployment-foreign/logs")
        self.assertEqual(logs_response.status_code, 404)
        self.assertEqual(logs_response.json()["detail"], "Deployment not found.")

        servers_export_response = self.client.get("/ops/exports/servers?format=json")
        self.assertEqual(servers_export_response.status_code, 403)
        self.assertEqual(
            servers_export_response.json()["detail"],
            "Remote server inventory is admin-only.",
        )

    def test_member_notifications_are_scoped_to_owned_deployments(self):
        response = self.client.get("/notifications?limit=10")
        self.assertEqual(response.status_code, 200)
        notifications = response.json()
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0]["deployment_id"], "deployment-own")
        self.assertEqual(notifications[0]["id"], "notification-own")

    def test_member_cannot_target_remote_admin_servers(self):
        deployment_response = self.client.post(
            "/deployments",
            json={
                "image": "nginx:alpine",
                "server_id": "server-admin",
                "env": {},
            },
        )
        self.assertEqual(deployment_response.status_code, 403)
        self.assertIn("admin-only", deployment_response.json()["detail"])

        template_response = self.client.post(
            "/deployment-templates",
            json={
                "template_name": "remote-template",
                "image": "nginx:alpine",
                "server_id": "server-admin",
                "env": {},
            },
        )
        self.assertEqual(template_response.status_code, 403)
        self.assertIn("admin-only", template_response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
