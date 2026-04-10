import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app import db


class BootstrapSecurityTests(unittest.TestCase):
    def test_refuses_new_default_admin_without_explicit_override(self):
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("app.db.get_user_by_username", return_value=None),
            patch("app.db.insert_user") as insert_user_mock,
        ):
            with self.assertRaises(HTTPException) as context:
                db.ensure_default_user()

        self.assertEqual(context.exception.status_code, 500)
        self.assertIn("refuses to create the bootstrap admin/admin account", context.exception.detail)
        insert_user_mock.assert_not_called()

    def test_allows_new_default_admin_when_explicit_override_is_enabled(self):
        with (
            patch.dict(
                os.environ,
                {"DEPLOYMATE_ALLOW_INSECURE_DEFAULT_ADMIN": "true"},
                clear=True,
            ),
            patch("app.db.get_user_by_username", return_value=None),
            patch("app.db.insert_user") as insert_user_mock,
        ):
            db.ensure_default_user()

        insert_user_mock.assert_called_once()
        record = insert_user_mock.call_args.args[0]
        self.assertEqual(record["username"], "admin")
        self.assertEqual(record["role"], "admin")
        self.assertTrue(record["must_change_password"])

    def test_rotates_existing_default_admin_when_real_secret_is_configured(self):
        existing_user = {
            "id": "admin-1",
            "username": "admin",
            "password_hash": db._hash_password("admin"),
            "plan": "trial",
            "role": "admin",
            "must_change_password": True,
            "created_at": "2026-04-09T00:00:00+00:00",
        }

        with (
            patch.dict(
                os.environ,
                {"DEPLOYMATE_ADMIN_PASSWORD": "super-secret-admin-password"},
                clear=True,
            ),
            patch("app.db.get_user_by_username", return_value=existing_user),
            patch("app.db.set_user_role") as set_user_role_mock,
            patch("app.db.update_user_password") as update_user_password_mock,
            patch("app.db.set_user_must_change_password") as set_user_must_change_password_mock,
        ):
            db.ensure_default_user()

        set_user_role_mock.assert_called_once_with("admin-1", "admin")
        update_user_password_mock.assert_called_once_with("admin-1", "super-secret-admin-password")
        set_user_must_change_password_mock.assert_not_called()

    def test_refuses_existing_default_admin_without_explicit_override(self):
        existing_user = {
            "id": "admin-1",
            "username": "admin",
            "password_hash": db._hash_password("admin"),
            "plan": "trial",
            "role": "admin",
            "must_change_password": True,
            "created_at": "2026-04-09T00:00:00+00:00",
        }

        with (
            patch.dict(os.environ, {}, clear=True),
            patch("app.db.get_user_by_username", return_value=existing_user),
            patch("app.db.set_user_role") as set_user_role_mock,
        ):
            with self.assertRaises(HTTPException) as context:
                db.ensure_default_user()

        self.assertEqual(context.exception.status_code, 500)
        self.assertIn("refuses to start with the bootstrap admin/admin credentials", context.exception.detail)
        set_user_role_mock.assert_called_once_with("admin-1", "admin")


if __name__ == "__main__":
    unittest.main()
