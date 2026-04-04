import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import require_admin


class ImportReviewApiFlowTests(unittest.TestCase):
    def setUp(self):
        self.user = {
            "id": "admin-1",
            "username": "smoke-admin",
            "role": "admin",
            "plan": "team",
            "must_change_password": False,
        }

        app.dependency_overrides[require_admin] = lambda: self.user

        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch(
                "app.routes.import_review.build_import_review_workspace",
                side_effect=self._build_workspace,
            ),
        ]

        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

        self.addCleanup(app.dependency_overrides.clear)
        self.client = TestClient(app)

    def _build_workspace(self):
        return {
            "generated_at": "2026-04-04T12:00:00+00:00",
            "bundle_manifest": {
                "version": "2026-04-01.backup-bundle.v1",
                "generated_at": "2026-04-04T11:58:00+00:00",
                "bundle_name": "deploymate-backup-live",
                "sections": {
                    "users": 2,
                    "upgrade_requests": 1,
                    "audit_events": 2,
                    "servers": 1,
                    "deployments": 1,
                    "templates": 1,
                },
            },
            "dry_run": {
                "generated_at": "2026-04-04T11:59:00+00:00",
                "manifest": {
                    "version": "2026-04-01.backup-bundle.v1",
                    "generated_at": "2026-04-04T11:58:00+00:00",
                    "bundle_name": "deploymate-backup-live",
                    "sections": {
                        "users": 2,
                        "upgrade_requests": 1,
                        "audit_events": 2,
                        "servers": 1,
                        "deployments": 1,
                        "templates": 1,
                    },
                },
                "summary": {
                    "total_sections": 6,
                    "total_records": 8,
                    "blocker_count": 1,
                    "warning_count": 2,
                    "ok_sections": 2,
                    "review_required_sections": 2,
                    "blocked_sections": 2,
                    "readiness_status": "blocked",
                    "next_step": "Resolve blocked sections before any import preparation work.",
                    "plain_language_summary": "This backup still has blocked sections.",
                    "highest_risk_sections": ["servers", "deployments"],
                    "preparation_summary": "Preparation mix: 1 ready to document for import preparation, 2 still need merge review, 1 are validation-only, 2 should stay dry-run only",
                    "validate_only_sections": 1,
                    "merge_review_sections": 2,
                    "prepare_import_sections": 1,
                    "dry_run_only_sections": 2,
                },
                "sections": [
                    {
                        "name": "users",
                        "incoming_count": 2,
                        "current_count": 2,
                        "status": "warn",
                        "preparation_mode": "merge_review",
                        "recommended_action": "Review users as merge candidates only.",
                        "blockers": [],
                        "warnings": [{"severity": "warn", "code": "user_exists", "message": "Users need merge review."}],
                        "notes": ["Users should stay under manual review."],
                    },
                    {
                        "name": "deployments",
                        "incoming_count": 1,
                        "current_count": 1,
                        "status": "error",
                        "preparation_mode": "dry_run_only",
                        "recommended_action": "Keep deployments in dry-run only.",
                        "blockers": [{"severity": "error", "code": "runtime_sensitive", "message": "Deployments stay dry-run only."}],
                        "warnings": [],
                        "notes": ["Runtime-sensitive section."],
                    },
                ],
            },
            "import_plan": {
                "generated_at": "2026-04-04T12:00:00+00:00",
                "dry_run_generated_at": "2026-04-04T11:59:00+00:00",
                "manifest": {
                    "version": "2026-04-01.backup-bundle.v1",
                    "generated_at": "2026-04-04T11:58:00+00:00",
                    "bundle_name": "deploymate-backup-live",
                    "sections": {
                        "users": 2,
                        "upgrade_requests": 1,
                        "audit_events": 2,
                        "servers": 1,
                        "deployments": 1,
                        "templates": 1,
                    },
                },
                "summary": {
                    "plan_id": "import-plan-123",
                    "plan_status": "blocked",
                    "apply_allowed": False,
                    "apply_block_reason": "Live restore apply is intentionally blocked in DeployMate right now.",
                    "boundary_message": "This is not an apply screen.",
                    "apply_readiness_status": "not_ready",
                    "apply_readiness_summary": "The operator can review and acknowledge scope, but the system is not ready for live restore apply.",
                    "acknowledgement_items": [
                        "I reviewed blocked sections.",
                        "I understand this is not a live apply screen.",
                    ],
                    "typed_review_phrase": "acknowledge import review deploymate-backup-live",
                    "approval_status": "approval_blocked",
                    "approval_packet_title": "Import review approval for deploymate-backup-live",
                    "approval_subject_line": "[DeployMate import review] deploymate-backup-live requires approval handoff",
                    "approval_share_summary": "Bundle deploymate-backup-live: plan blocked, included 0, review 1, blocked 1.",
                    "approval_summary": "Approval can only cover review scope and preparation handoff.",
                    "approval_decision_question": "Do we approve this bundle for continued review and preparation work, without approving any live restore apply?",
                    "approval_checklist": [
                        "Blocked sections were explicitly reviewed.",
                        "Approval here does not mean permission to run live restore apply.",
                    ],
                    "approval_handoff_note": "Use this packet to hand off a review decision, not an execution decision.",
                    "approval_next_step": "Send the approval packet to the reviewer or approver, then keep work at the review/preparation boundary until a separate controlled restore flow exists.",
                    "preparation_status": "preparation_blocked",
                    "preparation_packet_title": "Controlled preparation handoff for deploymate-backup-live",
                    "preparation_share_summary": "Preparation scope for deploymate-backup-live: prepare 0, review 1, blocked 1, exclude 1.",
                    "preparation_summary": "Controlled preparation can document included sections, keep review sections under manual review, and leave blocked sections outside any preparation scope.",
                    "preparation_checklist": [
                        "Preparation work only covers documented scope and does not authorize execution.",
                        "Review-required sections stay under manual review until their warnings are resolved.",
                    ],
                    "preparation_handoff_note": "Use this handoff when the next person needs to prepare documentation, sequence review work, or line up prerequisites without moving into live restore apply.",
                    "preparation_next_step": "Document the included scope, assign review work for review-required sections, and keep blocked sections out of the preparation path until the next dry-run clears them.",
                    "workflow_focus": "Resolve blocked sections before any preparation handoff can be treated as ready.",
                    "workflow_summary": "Validate restore bundle -> Review import scope -> Resolve blocked sections -> Hand off controlled preparation",
                    "workflow_steps": [
                        {
                            "key": "dry_run",
                            "title": "Validate restore bundle",
                            "status": "complete",
                            "detail": "Dry-run already ran on this bundle and exposed the current risk profile.",
                        },
                        {
                            "key": "blocked_review",
                            "title": "Resolve blocked sections",
                            "status": "current",
                            "detail": "Blocked sections still stop the flow here.",
                        },
                    ],
                    "plan_scope_summary": "Controlled import scope: hold users for review; block deployments",
                    "reviewer_guidance": "Review only. No live apply is authorized.",
                    "typed_confirmation_phrase": "review import plan deploymate-backup-live",
                    "included_sections": [],
                    "review_sections": ["users"],
                    "blocked_sections": ["deployments"],
                    "excluded_sections": ["audit_events"],
                },
                "sections": [
                    {
                        "name": "users",
                        "source_status": "warn",
                        "preparation_mode": "merge_review",
                        "plan_state": "review",
                        "include_in_plan": False,
                        "rationale": "Users need review first.",
                        "recommended_action": "Review users as merge candidates only.",
                    },
                    {
                        "name": "deployments",
                        "source_status": "error",
                        "preparation_mode": "dry_run_only",
                        "plan_state": "blocked",
                        "include_in_plan": False,
                        "rationale": "Deployments stay outside apply scope.",
                        "recommended_action": "Keep deployments in dry-run only.",
                    },
                ],
            },
        }

    def test_import_review_workspace_flow(self):
        response = self.client.get("/import-review")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["bundle_manifest"]["bundle_name"], "deploymate-backup-live")
        self.assertEqual(payload["dry_run"]["summary"]["readiness_status"], "blocked")
        self.assertEqual(payload["import_plan"]["summary"]["plan_status"], "blocked")
        self.assertFalse(payload["import_plan"]["summary"]["apply_allowed"])
        self.assertIn("blocked", payload["import_plan"]["summary"]["apply_block_reason"].lower())
        self.assertEqual(payload["import_plan"]["summary"]["apply_readiness_status"], "not_ready")
        self.assertEqual(payload["import_plan"]["summary"]["approval_status"], "approval_blocked")
        self.assertIn("approval", payload["import_plan"]["summary"]["approval_packet_title"].lower())
        self.assertIn("deploymate-backup-live", payload["import_plan"]["summary"]["approval_subject_line"])
        self.assertEqual(payload["import_plan"]["summary"]["preparation_status"], "preparation_blocked")
        self.assertIn("preparation", payload["import_plan"]["summary"]["preparation_packet_title"].lower())
        self.assertIn("blocked sections", payload["import_plan"]["summary"]["workflow_focus"].lower())
        self.assertGreaterEqual(len(payload["import_plan"]["summary"]["workflow_steps"]), 2)
        self.assertEqual(payload["import_plan"]["sections"][0]["plan_state"], "review")


if __name__ == "__main__":
    unittest.main()
