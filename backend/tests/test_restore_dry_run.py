import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.routes.root import _analyze_restore_bundle, _build_restore_import_plan


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
        self.assertEqual(response.summary.readiness_status, "review")
        self.assertIn("manual review", response.summary.plain_language_summary.lower())
        self.assertTrue(response.summary.next_step)
        self.assertEqual(response.summary.merge_review_sections, 3)
        self.assertEqual(response.summary.prepare_import_sections, 1)
        self.assertEqual(response.summary.validate_only_sections, 1)
        self.assertEqual(response.summary.dry_run_only_sections, 1)
        self.assertIn("merge review", response.summary.preparation_summary.lower())

        sections = {section.name: section for section in response.sections}
        self.assertEqual(sections["users"].status, "warn")
        self.assertEqual(sections["templates"].status, "warn")
        self.assertEqual(sections["servers"].status, "ok")
        self.assertEqual(sections["users"].preparation_mode, "merge_review")
        self.assertEqual(sections["audit_events"].preparation_mode, "validate_only")
        self.assertEqual(sections["servers"].preparation_mode, "merge_review")
        self.assertEqual(sections["upgrade_requests"].preparation_mode, "prepare_import")
        self.assertTrue(sections["users"].recommended_action)

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
        self.assertEqual(response.summary.readiness_status, "blocked")
        self.assertIn("not ready", response.summary.plain_language_summary.lower())
        self.assertIn("users", response.summary.highest_risk_sections)
        self.assertEqual(response.summary.merge_review_sections, 2)
        sections = {section.name: section for section in response.sections}
        self.assertEqual(sections["users"].status, "error")
        self.assertEqual(sections["users"].preparation_mode, "merge_review")
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
        self.assertEqual(response.summary.readiness_status, "review")

    @patch("app.routes.root.list_deployment_templates", return_value=[])
    @patch("app.routes.root.list_deployment_records", return_value=[])
    @patch("app.routes.root.list_servers", return_value=[])
    @patch("app.routes.root.list_admin_audit_events", return_value=[])
    @patch("app.routes.root.list_upgrade_requests", return_value=[])
    @patch("app.routes.root.list_users", return_value=[])
    def test_restore_dry_run_surfaces_missing_cross_section_references(
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
                "bundle_name": "refs-sample",
                "sections": {
                    "users": 1,
                    "upgrade_requests": 1,
                    "audit_events": 0,
                    "servers": 0,
                    "deployments": 1,
                    "templates": 1,
                },
            },
            "data": {
                "users": [{"id": "user-1", "username": "alice"}],
                "upgrade_requests": [
                    {"id": "req-1", "email": "alice@example.com", "target_user_id": "missing-user"}
                ],
                "audit_events": [],
                "servers": [],
                "deployments": [
                    {"id": "dep-1", "container_name": "web", "server_id": "missing-server", "template_id": "missing-template"}
                ],
                "templates": [
                    {"id": "tmpl-1", "template_name": "web-template", "server_id": "missing-server"}
                ],
            },
        }

        response = _analyze_restore_bundle(bundle)

        sections = {section.name: section for section in response.sections}
        upgrade_warning_codes = {issue.code for issue in sections["upgrade_requests"].warnings}
        deployment_blocker_codes = {issue.code for issue in sections["deployments"].blockers}
        deployment_warning_codes = {issue.code for issue in sections["deployments"].warnings}
        template_warning_codes = {issue.code for issue in sections["templates"].warnings}

        self.assertIn("target_user_missing", upgrade_warning_codes)
        self.assertIn("deployment_server_missing", deployment_blocker_codes)
        self.assertIn("deployment_template_missing", deployment_warning_codes)
        self.assertIn("template_server_missing", template_warning_codes)
        self.assertEqual(response.summary.readiness_status, "blocked")
        self.assertEqual(response.summary.dry_run_only_sections, 1)
        self.assertEqual(sections["deployments"].preparation_mode, "dry_run_only")
        self.assertEqual(sections["servers"].preparation_mode, "merge_review")
        self.assertEqual(sections["templates"].preparation_mode, "merge_review")

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

    @patch("app.routes.root.list_deployment_templates")
    @patch("app.routes.root.list_deployment_records")
    @patch("app.routes.root.list_servers")
    @patch("app.routes.root.list_admin_audit_events")
    @patch("app.routes.root.list_upgrade_requests")
    @patch("app.routes.root.list_users")
    def test_restore_import_plan_builds_controlled_scope_without_apply(
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
                "bundle_name": "plan-sample",
                "sections": {
                    "users": 1,
                    "upgrade_requests": 1,
                    "audit_events": 1,
                    "servers": 0,
                    "deployments": 0,
                    "templates": 1,
                },
            },
            "data": {
                "users": [{"id": "user-1", "username": "admin"}],
                "upgrade_requests": [{"id": "req-1", "email": "ops@example.com"}],
                "audit_events": [{"id": "audit-1"}],
                "servers": [],
                "deployments": [],
                "templates": [{"id": "template-1", "template_name": "web-template"}],
            },
        }

        report = _analyze_restore_bundle(bundle)
        plan = _build_restore_import_plan(report)

        self.assertFalse(plan.summary.apply_allowed)
        self.assertEqual(plan.summary.plan_status, "review_required")
        self.assertIn("intentionally blocked", plan.summary.apply_block_reason.lower())
        self.assertIn("not an apply screen", plan.summary.boundary_message.lower())
        self.assertEqual(plan.summary.apply_readiness_status, "review_required")
        self.assertEqual(len(plan.summary.acknowledgement_items), 3)
        self.assertTrue(plan.summary.typed_review_phrase.startswith("acknowledge import review "))
        self.assertEqual(plan.summary.approval_status, "approval_required")
        self.assertTrue(plan.summary.approval_checklist)
        self.assertEqual(plan.summary.included_sections, ["upgrade_requests", "templates"])
        self.assertIn("users", plan.summary.review_sections)
        self.assertIn("audit_events", plan.summary.excluded_sections)
        self.assertIn("deployments", plan.summary.excluded_sections)
        self.assertTrue(plan.summary.typed_confirmation_phrase.startswith("review import plan "))

        sections = {section.name: section for section in plan.sections}
        self.assertEqual(sections["upgrade_requests"].plan_state, "include")
        self.assertTrue(sections["upgrade_requests"].include_in_plan)
        self.assertEqual(sections["users"].plan_state, "review")
        self.assertEqual(sections["audit_events"].plan_state, "exclude")
        self.assertEqual(sections["deployments"].plan_state, "exclude")

    @patch("app.routes.root.list_deployment_templates", return_value=[])
    @patch("app.routes.root.list_deployment_records", return_value=[])
    @patch("app.routes.root.list_servers", return_value=[])
    @patch("app.routes.root.list_admin_audit_events", return_value=[])
    @patch("app.routes.root.list_upgrade_requests", return_value=[])
    @patch("app.routes.root.list_users", return_value=[])
    def test_restore_import_plan_blocks_error_sections(
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
                "bundle_name": "blocked-plan-sample",
                "sections": {
                    "users": 0,
                    "upgrade_requests": 0,
                    "audit_events": 0,
                    "servers": 1,
                    "deployments": 1,
                    "templates": 0,
                },
            },
            "data": {
                "users": [],
                "upgrade_requests": [],
                "audit_events": [],
                "servers": [{"id": "server-1", "name": "prod", "host": "10.0.0.1", "port": 22, "username": "deploy"}],
                "deployments": [{"id": "dep-1", "container_name": "web", "server_id": "missing-server"}],
                "templates": [],
            },
        }

        plan = _build_restore_import_plan(_analyze_restore_bundle(bundle))

        self.assertEqual(plan.summary.plan_status, "blocked")
        self.assertFalse(plan.summary.apply_allowed)
        self.assertTrue(plan.summary.apply_block_reason)
        self.assertEqual(plan.summary.apply_readiness_status, "not_ready")
        self.assertEqual(plan.summary.approval_status, "approval_blocked")
        self.assertIn("deployments", plan.summary.blocked_sections)
        deployment_section = next(section for section in plan.sections if section.name == "deployments")
        self.assertEqual(deployment_section.plan_state, "blocked")
        self.assertFalse(deployment_section.include_in_plan)


if __name__ == "__main__":
    unittest.main()
