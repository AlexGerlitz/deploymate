import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import require_auth


class TemplateApiFlowTests(unittest.TestCase):
    def setUp(self):
        self.user = {
            "id": "user-1",
            "username": "smoke-admin",
            "role": "admin",
            "plan": "team",
            "must_change_password": False,
        }
        self.templates = {}
        self.deployments = []

        app.dependency_overrides[require_auth] = lambda: self.user

        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch("app.routes.deployment_templates.insert_deployment_template", side_effect=self._insert_template),
            patch("app.routes.deployment_templates.list_deployment_templates", side_effect=self._list_templates),
            patch("app.routes.deployment_templates.get_deployment_template_or_404", side_effect=self._get_template_or_404),
            patch("app.routes.deployment_templates.update_deployment_template", side_effect=self._update_template),
            patch("app.routes.deployment_templates.delete_deployment_template_record", side_effect=self._delete_template),
            patch("app.routes.deployment_templates.mark_deployment_template_used", side_effect=self._mark_template_used),
            patch("app.routes.deployment_templates.get_server_or_404", side_effect=self._get_server_or_404),
            patch(
                "app.routes.deployment_templates._validate_template_payload_for_user",
                side_effect=self._validate_template_payload,
            ),
            patch("app.routes.deployment_templates._create_deployment", side_effect=self._create_deployment),
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

        self._seed_template(
            {
                "id": "template-popular",
                "template_name": "popular-web",
                "image": "nginx:1.27-alpine",
                "name": "popular-web",
                "internal_port": 80,
                "external_port": 38081,
                "server_id": None,
                "env": {"MODE": "popular"},
                "created_at": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
                "updated_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
                "last_used_at": datetime.now(timezone.utc).isoformat(),
                "use_count": 3,
            }
        )

    def _seed_template(self, record):
        self.templates[record["id"]] = dict(record)

    def _serialize_template(self, record):
        serialized = dict(record)
        for key in ("created_at", "updated_at", "last_used_at"):
            value = serialized.get(key)
            if isinstance(value, datetime):
                serialized[key] = value.isoformat()
        env = serialized.get("env")
        if isinstance(env, str):
            serialized["env"] = json.loads(env)
        return serialized

    def _insert_template(self, record):
        serialized = self._serialize_template(record)
        self.templates[serialized["id"]] = serialized

    def _list_templates(self):
        return [dict(item) for item in self.templates.values()]

    def _get_template_or_404(self, template_id):
        template = self.templates.get(template_id)
        if not template:
            raise AssertionError(f"Unknown template requested: {template_id}")
        return dict(template)

    def _update_template(self, template_id, record):
        updated = dict(self.templates[template_id])
        updated.update(self._serialize_template(record))
        self.templates[template_id] = updated

    def _delete_template(self, template_id):
        self.templates.pop(template_id, None)

    def _mark_template_used(self, template_id):
        template = self.templates[template_id]
        template["use_count"] = int(template.get("use_count") or 0) + 1
        template["last_used_at"] = datetime.now(timezone.utc).isoformat()

    def _create_deployment(self, payload, user):
        deployment = {
            "id": f"deployment-{len(self.deployments) + 1}",
            "status": "running",
            "image": payload.image,
            "container_name": payload.name or f"deployment-{len(self.deployments) + 1}",
            "container_id": f"container-{len(self.deployments) + 1}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "error": None,
            "internal_port": payload.internal_port,
            "external_port": payload.external_port,
            "server_id": payload.server_id,
            "server_name": None,
            "server_host": None,
            "env": payload.env,
        }
        self.deployments.append(deployment)
        self.assertEqual(user["id"], self.user["id"])
        return deployment

    def _get_server_or_404(self, server_id):
        raise AssertionError(f"Unexpected server lookup for template flow: {server_id}")

    def _validate_template_payload(self, payload, user):
        self.assertEqual(user["id"], self.user["id"])
        return None

    def test_full_template_http_flow(self):
        create_response = self.client.post(
            "/deployment-templates",
            json={
                "template_name": "web-template",
                "image": "nginx:alpine",
                "name": "web-runtime",
                "internal_port": 80,
                "external_port": 38080,
                "env": {"APP_ENV": "smoke"},
            },
        )
        self.assertEqual(create_response.status_code, 200)
        created = create_response.json()
        template_id = created["id"]
        self.assertEqual(created["template_name"], "web-template")
        self.assertEqual(created["env"]["APP_ENV"], "smoke")

        list_response = self.client.get("/deployment-templates?q=web-template")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 1)

        popular_response = self.client.get("/deployment-templates?state=popular")
        self.assertEqual(popular_response.status_code, 200)
        popular_items = popular_response.json()
        self.assertGreaterEqual(len(popular_items), 1)
        self.assertEqual(popular_items[0]["id"], "template-popular")

        recent_response = self.client.get("/deployment-templates?state=recent")
        self.assertEqual(recent_response.status_code, 200)
        self.assertEqual(recent_response.json()[0]["id"], "template-popular")

        update_response = self.client.put(
            f"/deployment-templates/{template_id}",
            json={
                "template_name": "web-template-v2",
                "image": "nginx:1.27-alpine",
                "name": "web-runtime-v2",
                "internal_port": 8080,
                "external_port": 39090,
                "env": {"APP_ENV": "updated"},
            },
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["template_name"], "web-template-v2")
        self.assertEqual(updated["external_port"], 39090)

        duplicate_response = self.client.post(
            f"/deployment-templates/{template_id}/duplicate",
            json={"template_name": "web-template-copy"},
        )
        self.assertEqual(duplicate_response.status_code, 200)
        duplicate = duplicate_response.json()
        duplicate_id = duplicate["id"]
        self.assertNotEqual(duplicate_id, template_id)
        self.assertEqual(duplicate["template_name"], "web-template-copy")
        self.assertEqual(duplicate["use_count"], 0)

        deploy_response = self.client.post(f"/deployment-templates/{template_id}/deploy")
        self.assertEqual(deploy_response.status_code, 200)
        deployed = deploy_response.json()
        self.assertEqual(deployed["image"], "nginx:1.27-alpine")
        self.assertEqual(deployed["external_port"], 39090)
        self.assertEqual(self.templates[template_id]["use_count"], 1)

        delete_response = self.client.delete(f"/deployment-templates/{duplicate_id}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.json()["id"], duplicate_id)
        self.assertNotIn(duplicate_id, self.templates)


if __name__ == "__main__":
    unittest.main()
