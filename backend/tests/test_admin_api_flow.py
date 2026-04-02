import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import require_admin


class AdminApiFlowTests(unittest.TestCase):
    def setUp(self):
        self.admin_user = {
            "id": "admin-1",
            "username": "smoke-admin",
            "role": "admin",
            "plan": "team",
            "must_change_password": False,
            "created_at": "2026-04-02T00:00:00+00:00",
        }
        self.users = {self.admin_user["id"]: dict(self.admin_user)}
        self.upgrade_requests = {}
        self.audit_events = []
        self.servers = []
        self.deployments = []
        self.templates = []

        app.dependency_overrides[require_admin] = lambda: self.admin_user

        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch("app.routes.root.get_user_by_username", side_effect=self._get_user_by_username),
            patch("app.routes.root.get_user_by_id", side_effect=self._get_user_by_id),
            patch("app.routes.root.insert_user", side_effect=self._insert_user),
            patch("app.routes.root.list_users", side_effect=self._list_users),
            patch("app.routes.root.set_user_role", side_effect=self._set_user_role),
            patch("app.routes.root.set_user_plan", side_effect=self._set_user_plan),
            patch("app.routes.root.delete_user_record", side_effect=self._delete_user_record),
            patch("app.routes.root.count_users_by_role", side_effect=self._count_users_by_role),
            patch("app.routes.root.insert_upgrade_request", side_effect=self._insert_upgrade_request),
            patch("app.routes.root.list_upgrade_requests", side_effect=self._list_upgrade_requests),
            patch("app.routes.root.get_upgrade_request_or_404", side_effect=self._get_upgrade_request_or_404),
            patch("app.routes.root.update_upgrade_request", side_effect=self._update_upgrade_request),
            patch("app.routes.root.create_admin_audit_event", side_effect=self._create_admin_audit_event),
            patch("app.routes.root.list_admin_audit_events", side_effect=self._list_admin_audit_events),
            patch("app.routes.root.list_servers", side_effect=self._list_servers),
            patch("app.routes.root.list_deployment_records", side_effect=self._list_deployment_records),
            patch("app.routes.root.list_deployment_templates", side_effect=self._list_deployment_templates),
        ]

        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)

    def _serialize(self, record):
        serialized = dict(record)
        for key in ("created_at", "updated_at", "reviewed_at"):
            value = serialized.get(key)
            if isinstance(value, datetime):
                serialized[key] = value.isoformat()
        return serialized

    def _get_user_by_username(self, username):
        for user in self.users.values():
            if user["username"] == username:
                return dict(user)
        return None

    def _get_user_by_id(self, user_id):
        user = self.users.get(user_id)
        return dict(user) if user else None

    def _insert_user(self, record):
        self.users[record["id"]] = self._serialize(record)

    def _list_users(self):
        return [dict(user) for user in self.users.values()]

    def _set_user_role(self, user_id, role):
        self.users[user_id]["role"] = role

    def _set_user_plan(self, user_id, plan):
        self.users[user_id]["plan"] = plan

    def _delete_user_record(self, user_id):
        self.users.pop(user_id, None)

    def _count_users_by_role(self, role):
        return sum(1 for user in self.users.values() if user["role"] == role)

    def _insert_upgrade_request(self, record):
        self.upgrade_requests[record["id"]] = self._serialize(record)

    def _list_upgrade_requests(self):
        items = []
        for item in self.upgrade_requests.values():
            serialized = dict(item)
            handler = self.users.get(serialized.get("handled_by_user_id"))
            target = self.users.get(serialized.get("target_user_id"))
            serialized["handled_by_username"] = handler["username"] if handler else None
            serialized["target_username"] = target["username"] if target else None
            items.append(serialized)
        return items

    def _get_upgrade_request_or_404(self, request_id):
        item = self.upgrade_requests.get(request_id)
        if not item:
            raise AssertionError(f"Unknown upgrade request requested: {request_id}")
        serialized = dict(item)
        handler = self.users.get(serialized.get("handled_by_user_id"))
        target = self.users.get(serialized.get("target_user_id"))
        serialized["handled_by_username"] = handler["username"] if handler else None
        serialized["target_username"] = target["username"] if target else None
        return serialized

    def _update_upgrade_request(
        self,
        request_id,
        status=None,
        internal_note=None,
        handled_by_user_id=None,
        target_user_id=None,
        reviewed_at=None,
        updated_at=None,
    ):
        item = self.upgrade_requests[request_id]
        if status is not None:
            item["status"] = status
        item["internal_note"] = internal_note
        item["handled_by_user_id"] = handled_by_user_id
        item["target_user_id"] = target_user_id
        item["reviewed_at"] = reviewed_at.isoformat() if isinstance(reviewed_at, datetime) else reviewed_at
        item["updated_at"] = updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at

    def _create_admin_audit_event(self, **payload):
        entry = {
            "id": f"audit-{len(self.audit_events) + 1}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            **payload,
        }
        actor = self.users.get(entry.get("actor_user_id"))
        entry["actor_username"] = actor["username"] if actor else None
        self.audit_events.insert(0, entry)

    def _list_admin_audit_events(self, limit=100):
        return [dict(item) for item in self.audit_events[:limit]]

    def _list_servers(self):
        return list(self.servers)

    def _list_deployment_records(self):
        return list(self.deployments)

    def _list_deployment_templates(self):
        return list(self.templates)

    def test_full_admin_http_flow(self):
        upgrade_create_response = self.client.post(
            "/upgrade-requests",
            json={
                "name": "Alex",
                "email": "alex@example.com",
                "company_or_team": "DeployMate",
                "use_case": "Team rollout",
                "current_plan": "trial",
            },
        )
        self.assertEqual(upgrade_create_response.status_code, 200)
        request_id = upgrade_create_response.json()["request_id"]

        create_user_response = self.client.post(
            "/admin/users",
            json={
                "username": "new-member",
                "password": "secret-123",
                "role": "member",
            },
        )
        self.assertEqual(create_user_response.status_code, 200)
        created_user = create_user_response.json()
        user_id = created_user["id"]
        self.assertEqual(created_user["plan"], "trial")

        list_users_response = self.client.get("/admin/users?role=member&q=new")
        self.assertEqual(list_users_response.status_code, 200)
        self.assertEqual(len(list_users_response.json()), 1)

        update_user_response = self.client.patch(
            f"/admin/users/{user_id}",
            json={"plan": "team"},
        )
        self.assertEqual(update_user_response.status_code, 200)
        self.assertEqual(update_user_response.json()["plan"], "team")

        overview_response = self.client.get("/admin/overview")
        self.assertEqual(overview_response.status_code, 200)
        overview = overview_response.json()
        self.assertEqual(overview["users"]["total"], 2)
        self.assertEqual(overview["upgrade_requests"]["new"], 1)

        list_requests_response = self.client.get("/admin/upgrade-requests?status=new&plan=trial")
        self.assertEqual(list_requests_response.status_code, 200)
        self.assertEqual(len(list_requests_response.json()), 1)

        update_request_response = self.client.patch(
            f"/admin/upgrade-requests/{request_id}",
            json={
                "status": "approved",
                "internal_note": "Looks good",
                "target_user_id": user_id,
                "plan": "team",
            },
        )
        self.assertEqual(update_request_response.status_code, 200)
        updated_request = update_request_response.json()
        self.assertEqual(updated_request["status"], "approved")
        self.assertEqual(updated_request["target_user_id"], user_id)
        self.assertEqual(updated_request["target_username"], "new-member")

        get_request_response = self.client.get(f"/admin/upgrade-requests/{request_id}")
        self.assertEqual(get_request_response.status_code, 200)
        self.assertEqual(get_request_response.json()["handled_by_username"], "smoke-admin")

        users_export_response = self.client.get("/admin/exports/users?format=csv")
        self.assertEqual(users_export_response.status_code, 200)
        self.assertIn("deploymate-admin-users.csv", users_export_response.headers["content-disposition"])
        self.assertIn("new-member", users_export_response.text)

        requests_export_response = self.client.get("/admin/exports/upgrade-requests?format=json")
        self.assertEqual(requests_export_response.status_code, 200)
        self.assertEqual(requests_export_response.json()["count"], 1)

        backup_response = self.client.get("/admin/backup-bundle")
        self.assertEqual(backup_response.status_code, 200)
        backup_bundle = backup_response.json()
        self.assertEqual(backup_bundle["manifest"]["sections"]["users"], 2)
        self.assertEqual(backup_bundle["manifest"]["sections"]["upgrade_requests"], 1)

        backup_export_response = self.client.get("/admin/exports/backup-bundle")
        self.assertEqual(backup_export_response.status_code, 200)
        self.assertIn(".json", backup_export_response.headers["content-disposition"])

        restore_response = self.client.post("/admin/restore/dry-run", json={"bundle": backup_bundle})
        self.assertEqual(restore_response.status_code, 200)
        restore_summary = restore_response.json()["summary"]
        self.assertEqual(restore_summary["total_sections"], 6)
        self.assertGreaterEqual(restore_summary["review_required_sections"], 1)

        audit_events_response = self.client.get("/admin/audit-events?target_type=all")
        self.assertEqual(audit_events_response.status_code, 200)
        audit_events = audit_events_response.json()
        self.assertGreaterEqual(len(audit_events), 3)
        self.assertEqual(audit_events[0]["target_type"], "upgrade_request")

        audit_summary_response = self.client.get("/admin/audit-summary")
        self.assertEqual(audit_summary_response.status_code, 200)
        audit_summary = audit_summary_response.json()
        self.assertEqual(audit_summary["user_actions"], 2)
        self.assertEqual(audit_summary["upgrade_request_actions"], 1)

        delete_user_response = self.client.delete(f"/admin/users/{user_id}")
        self.assertEqual(delete_user_response.status_code, 200)
        self.assertEqual(delete_user_response.json()["status"], "deleted")
        self.assertNotIn(user_id, self.users)


if __name__ == "__main__":
    unittest.main()
