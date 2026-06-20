#!/usr/bin/env python3

from __future__ import annotations

import unittest

from release_incident_diagnostics import extract_issue_diagnostics


class ReleaseIncidentDiagnosticsTest(unittest.TestCase):
    def test_extracts_latest_classifier_fields_from_comments(self) -> None:
        payload = {
            "body": "Failure category: `ssh_host_key_changed`\nOperator hint: Refresh known_hosts.",
            "comments": [
                {"body": "old comment"},
                {
                    "body": (
                        "Follow-up.\n\n"
                        "Current verified blocker from the latest manual audit/log replay: `ssh_auth_denied`.\n\n"
                        "Meaning: the deploy host now passes the pinned known_hosts trust check, "
                        "but rejects the configured deploy SSH key."
                    )
                },
            ],
        }

        diagnostics = extract_issue_diagnostics(payload)

        self.assertEqual(diagnostics["failure_category"], "ssh_auth_denied")
        self.assertIn("rejects the configured deploy SSH key", diagnostics["operator_hint"])

    def test_extracts_classifier_fields_from_issue_body(self) -> None:
        payload = {
            "body": "Failure category: `runtime_admin_password_mismatch`\nOperator hint: Align runtime env.",
            "comments": [],
        }

        diagnostics = extract_issue_diagnostics(payload)

        self.assertEqual(diagnostics["failure_category"], "runtime_admin_password_mismatch")
        self.assertEqual(diagnostics["operator_hint"], "Align runtime env.")

    def test_falls_back_to_known_hosts_language(self) -> None:
        payload = {
            "body": "Root cause triage: strict SSH host-key verification detected pinned known_hosts drift.",
            "comments": [],
        }

        diagnostics = extract_issue_diagnostics(payload)

        self.assertEqual(diagnostics["failure_category"], "ssh_host_key_changed")

    def test_returns_unavailable_without_diagnostics(self) -> None:
        diagnostics = extract_issue_diagnostics({"body": "plain incident", "comments": []})

        self.assertEqual(diagnostics["failure_category"], "unavailable")
        self.assertEqual(diagnostics["operator_hint"], "")


if __name__ == "__main__":
    unittest.main()
