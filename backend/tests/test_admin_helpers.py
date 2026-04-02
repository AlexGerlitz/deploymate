import unittest
from unittest.mock import patch

from app.routes.root import _build_admin_audit_summary, _build_backup_bundle


class AdminHelperTests(unittest.TestCase):
    def test_build_admin_audit_summary_counts_target_types(self):
        items = [
            {
                "id": "audit-3",
                "target_type": "upgrade_request",
                "action_type": "upgrade_request.updated",
                "created_at": "2026-04-02T12:05:00+00:00",
            },
            {
                "id": "audit-2",
                "target_type": "user",
                "action_type": "user.updated",
                "created_at": "2026-04-02T12:04:00+00:00",
            },
            {
                "id": "audit-1",
                "target_type": "user",
                "action_type": "user.created",
                "created_at": "2026-04-02T12:03:00+00:00",
            },
        ]

        summary = _build_admin_audit_summary(items)

        self.assertEqual(summary.total, 3)
        self.assertEqual(summary.user_actions, 2)
        self.assertEqual(summary.upgrade_request_actions, 1)
        self.assertEqual(summary.latest_action_type, "upgrade_request.updated")
        self.assertEqual(summary.latest_action_at, "2026-04-02T12:05:00+00:00")

    def test_build_admin_audit_summary_handles_empty_items(self):
        summary = _build_admin_audit_summary([])

        self.assertEqual(summary.total, 0)
        self.assertEqual(summary.user_actions, 0)
        self.assertEqual(summary.upgrade_request_actions, 0)
        self.assertIsNone(summary.latest_action_type)
        self.assertIsNone(summary.latest_action_at)

    @patch("app.routes.root.list_deployment_templates")
    @patch("app.routes.root.list_deployment_records")
    @patch("app.routes.root.list_servers")
    @patch("app.routes.root.list_admin_audit_events")
    @patch("app.routes.root.list_upgrade_requests")
    @patch("app.routes.root.list_users")
    def test_build_backup_bundle_reports_manifest_counts(
        self,
        mock_list_users,
        mock_list_upgrade_requests,
        mock_list_admin_audit_events,
        mock_list_servers,
        mock_list_deployment_records,
        mock_list_deployment_templates,
    ):
        mock_list_users.return_value = [{"id": "user-1", "username": "alex"}]
        mock_list_upgrade_requests.return_value = [{"id": "request-1"}]
        mock_list_admin_audit_events.return_value = [{"id": "audit-1"}, {"id": "audit-2"}]
        mock_list_servers.return_value = [{"id": "server-1"}]
        mock_list_deployment_records.return_value = []
        mock_list_deployment_templates.return_value = [{"id": "template-1"}]

        bundle = _build_backup_bundle()

        self.assertEqual(bundle.manifest.version, "2026-04-01.backup-bundle.v1")
        self.assertTrue(bundle.manifest.bundle_name.startswith("deploymate-backup-"))
        self.assertEqual(
            bundle.manifest.sections,
            {
                "users": 1,
                "upgrade_requests": 1,
                "audit_events": 2,
                "servers": 1,
                "deployments": 0,
                "templates": 1,
            },
        )
        self.assertEqual(len(bundle.data["users"]), 1)
        self.assertEqual(len(bundle.data["upgrade_requests"]), 1)
        self.assertEqual(len(bundle.data["audit_events"]), 2)
        self.assertEqual(len(bundle.data["servers"]), 1)
        self.assertEqual(len(bundle.data["deployments"]), 0)
        self.assertEqual(len(bundle.data["templates"]), 1)


if __name__ == "__main__":
    unittest.main()
