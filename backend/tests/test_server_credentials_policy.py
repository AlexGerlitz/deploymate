import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.db import _assert_server_credentials_policy, _build_server_credentials_audit


class _FakeCursor:
    def __init__(self, rows):
        self.rows = rows

    def execute(self, sql, params=None):
        self.sql = sql
        self.params = params

    def fetchall(self):
        return list(self.rows)


class ServerCredentialPolicyTests(unittest.TestCase):
    def test_build_server_credentials_audit_reports_plaintext_and_encrypted_counts(self):
        summary = _build_server_credentials_audit(
            [
                ("enc:v1:token-1", None),
                (None, "PRIVATE-KEY"),
                (None, None),
            ]
        )

        self.assertEqual(summary["server_records"], 3)
        self.assertEqual(summary["credential_records"], 2)
        self.assertEqual(summary["encrypted_values"], 1)
        self.assertEqual(summary["plaintext_values"], 1)
        self.assertEqual(summary["empty_values"], 1)
        self.assertEqual(summary["encrypted_records"], 1)
        self.assertEqual(summary["plaintext_records"], 1)

    def test_assert_policy_allows_empty_server_table_without_key(self):
        with patch("app.db.server_credentials_encryption_enabled", return_value=False):
            _assert_server_credentials_policy(_FakeCursor([]))

    def test_assert_policy_rejects_existing_credentials_without_key(self):
        with patch("app.db.server_credentials_encryption_enabled", return_value=False):
            with self.assertRaises(HTTPException) as context:
                _assert_server_credentials_policy(_FakeCursor([("legacy-password", None)]))

        self.assertEqual(context.exception.status_code, 500)
        self.assertIn("DEPLOYMATE_SERVER_CREDENTIALS_KEY", context.exception.detail)

    def test_assert_policy_allows_existing_credentials_with_key(self):
        with patch("app.db.server_credentials_encryption_enabled", return_value=True):
            _assert_server_credentials_policy(_FakeCursor([("enc:v1:token-1", None)]))


if __name__ == "__main__":
    unittest.main()
