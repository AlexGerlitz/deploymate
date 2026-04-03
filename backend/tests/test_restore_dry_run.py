import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.routes.root import _analyze_restore_bundle


class RestoreDryRunTests(unittest.TestCase):
    @patch("app.routes.root.list_deployment_templates")
    @patch("app.routes.root.list_deployment_records")
    @patch("app.routes.root.list_servers")
    @patch("app.routes.root.list_admin_audit_events")
    @patch("app.routes.root.list_upgrade_requests")
    @patch("app.routes.root.list_users")
    def test_restore_dry_run_marks_existing_entities_as_review_required(
        self,
        mock_list_users,
        mock_list_upgrade_requests,
        mock_list_admin_audit_events,
        mock_list_servers,
        mock_list_deployment_records,
        mock_list_deployment_templates,
    ):
        mock_list_users.return_value = [
            {"id": "user-1", "username": "admin", "role": "admin", "plan": "team"}
        ]
        mock_list_upgrade_requests.return_value = []
        mock_list_admin_audit_events.return_value = []
        mock_list_servers.return_value = [
            {"id": "server-1", "name": "prod", "host": "10.0.0.1", "port": 22, "username": "deploy"}
        ]
        mock_list_deployment_records.return_value = []
        mock_list_deployment_templates.return_value = [
            {"id": "template-1", "template_name": "web-template", "image": "nginx:latest"}
        ]

        bundle = {
            "manifest": {
                "version": "2026-04-01.backup-bundle.v1",
                "generated_at": "2026-04-01T00:00:00+00:00",
                "bundle_name": "sample",
                "sections": {
                    "users": 1,
                    "upgrade_requests": 0,
                    "audit_events": 0,
                    "servers": 1,
                    "deployments": 0,
                    "templates": 1,
                },
            },
            "data": {
                "users": [{"id": "user-1", "username": "admin"}],
                "upgrade_requests": [],
                "audit_events": [],
                "servers": [{"id": "server-1", "name": "prod", "host": "10.0.0.1", "port": 22, "username": "deploy"}],
                "deployments": [],
                "templates": [{"id": "template-1", "template_name": "web-template"}],
            },
        }

        response = _analyze_restore_bundle(bundle)

        self.assertEqual(response.summary.total_sections, 6)
        self.assertEqual(response.summary.total_records, 3)
        self.assertEqual(response.summary.blocker_count, 0)
        self.assertEqual(response.summary.warning_count, 2)
        self.assertEqual(response.summary.ok_sections, 4)
        self.assertEqual(response.summary.review_required_sections, 2)
        self.assertEqual(response.summary.blocked_sections, 0)

        sections = {section.name: section for section in response.sections}
        self.assertEqual(sections["users"].status, "warn")
        self.assertEqual(sections["templates"].status, "warn")
        self.assertEqual(sections["servers"].status, "ok")

    @patch("app.routes.root.list_deployment_templates")
    @patch("app.routes.root.list_deployment_records")
    @patch("app.routes.root.list_servers")
    @patch("app.routes.root.list_admin_audit_events")
    @patch("app.routes.root.list_upgrade_requests")
    @patch("app.routes.root.list_users")
    def test_restore_dry_run_detects_duplicate_bundle_conflicts(
        self,
        mock_list_users,
        mock_list_upgrade_requests,
        mock_list_admin_audit_events,
        mock_list_servers,
        mock_list_deployment_records,
        mock_list_deployment_templates,
    ):
        mock_list_users.return_value = []
        mock_list_upgrade_requests.return_value = []
        mock_list_admin_audit_events.return_value = []
        mock_list_servers.return_value = []
        mock_list_deployment_records.return_value = []
        mock_list_deployment_templates.return_value = []

        bundle = {
            "manifest": {
                "version": "2026-04-01.backup-bundle.v1",
                "generated_at": "2026-04-01T00:00:00+00:00",
                "bundle_name": "duplicate-sample",
                "sections": {"users": 2, "upgrade_requests": 0, "audit_events": 0, "servers": 0, "deployments": 0, "templates": 0},
            },
            "data": {
                "users": [
                    {"id": "user-1", "username": "alice"},
                    {"id": "user-2", "username": "alice"},
                ],
                "upgrade_requests": [],
                "audit_events": [],
                "servers": [],
                "deployments": [],
                "templates": [],
            },
        }

        response = _analyze_restore_bundle(bundle)

        self.assertGreaterEqual(response.summary.blocker_count, 1)
        self.assertEqual(response.summary.blocked_sections, 1)
        sections = {section.name: section for section in response.sections}
        self.assertEqual(sections["users"].status, "error")
        self.assertTrue(
            any(issue.code == "duplicate_username_bundle" for issue in sections["users"].blockers)
        )

    @patch("app.routes.root.list_deployment_templates", return_value=[])
    @patch("app.routes.root.list_deployment_records", return_value=[])
    @patch("app.routes.root.list_servers", return_value=[])
    @patch("app.routes.root.list_admin_audit_events", return_value=[])
    @patch("app.routes.root.list_upgrade_requests", return_value=[])
    @patch("app.routes.root.list_users", return_value=[])
    def test_restore_dry_run_warns_on_manifest_mismatch_and_unknown_sections(
        self,
        _mock_list_users,
        _mock_list_upgrade_requests,
        _mock_list_admin_audit_events,
        _mock_list_servers,
        _mock_list_deployment_records,
        _mock_list_deployment_templates,
    ):
        bundle = {
            "manifest": {
                "version": "2026-05-01.backup-bundle.v2",
                "generated_at": "2026-04-01T00:00:00+00:00",
                "bundle_name": "mismatch-sample",
                "sections": {
                    "users": 3,
                    "upgrade_requests": 0,
                    "audit_events": 0,
                    "servers": 0,
                    "deployments": 0,
                    "templates": 0,
                    "extra_section": 2,
                },
            },
            "data": {
                "users": [{"id": "user-1", "username": "alice"}],
                "upgrade_requests": [],
                "audit_events": [],
                "servers": [],
                "deployments": [],
                "templates": [],
                "legacy_records": [],
            },
        }

        response = _analyze_restore_bundle(bundle)

        users_section = next(section for section in response.sections if section.name == "users")
        warning_codes = {issue.code for issue in users_section.warnings}
        self.assertIn("manifest_count_mismatch", warning_codes)
        self.assertIn("unknown_manifest_sections", warning_codes)
        self.assertIn("unknown_data_sections", warning_codes)
        self.assertIn("bundle_version_unrecognized", warning_codes)
        self.assertEqual(users_section.status, "warn")

    @patch("app.routes.root.list_deployment_templates", return_value=[])
    @patch("app.routes.root.list_deployment_records", return_value=[])
    @patch("app.routes.root.list_servers", return_value=[])
    @patch("app.routes.root.list_admin_audit_events", return_value=[])
    @patch("app.routes.root.list_upgrade_requests", return_value=[])
    @patch("app.routes.root.list_users", return_value=[])
    def test_restore_dry_run_rejects_non_list_section_payloads(
        self,
        _mock_list_users,
        _mock_list_upgrade_requests,
        _mock_list_admin_audit_events,
        _mock_list_servers,
        _mock_list_deployment_records,
        _mock_list_deployment_templates,
    ):
        bundle = {
            "manifest": {
                "version": "2026-04-01.backup-bundle.v1",
                "generated_at": "2026-04-01T00:00:00+00:00",
                "bundle_name": "invalid-sample",
                "sections": {
                    "users": 0,
                    "upgrade_requests": 0,
                    "audit_events": 0,
                    "servers": 0,
                    "deployments": 0,
                    "templates": 0,
                },
            },
            "data": {
                "users": {"id": "user-1", "username": "alice"},
                "upgrade_requests": [],
                "audit_events": [],
                "servers": [],
                "deployments": [],
                "templates": [],
            },
        }

        with self.assertRaises(HTTPException) as context:
            _analyze_restore_bundle(bundle)

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn('section "users" must be a list', context.exception.detail)


if __name__ == "__main__":
    unittest.main()
