import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import SESSION_COOKIE_NAME, hash_password, reset_auth_rate_limit_state


class AuthSecurityTests(unittest.TestCase):
    def setUp(self):
        reset_auth_rate_limit_state()
        self.addCleanup(reset_auth_rate_limit_state)
        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch("app.services.auth.get_plan_usage", return_value={"servers": 0, "deployments": 0}),
        ]

        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

        self.client = TestClient(app)

    def test_session_expiration_rejects_authenticated_request(self):
        expired_at = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        stale_user = {
            "id": "user-1",
            "username": "member",
            "plan": "trial",
            "role": "member",
            "must_change_password": False,
            "created_at": "2026-04-01T00:00:00+00:00",
            "session_created_at": expired_at,
        }

        with (
            patch("app.services.auth.get_session_user_by_token", return_value=stale_user),
            patch("app.services.auth.delete_session") as delete_session_mock,
        ):
            response = self.client.get(
                "/auth/me",
                cookies={SESSION_COOKIE_NAME: "expired-session"},
            )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Session expired.")
        delete_session_mock.assert_called_once_with("expired-session")

    def test_login_is_rate_limited_after_repeated_failures(self):
        user = {
            "id": "admin-1",
            "username": "admin",
            "password_hash": hash_password("admin-secret"),
            "plan": "team",
            "role": "admin",
            "must_change_password": False,
            "created_at": "2026-04-02T00:00:00+00:00",
        }

        with (
            patch.dict(
                os.environ,
                {
                    "DEPLOYMATE_AUTH_RATE_LIMIT_ATTEMPTS": "2",
                    "DEPLOYMATE_AUTH_RATE_LIMIT_WINDOW_SECONDS": "60",
                },
                clear=False,
            ),
            patch("app.routes.auth.get_user_by_username", return_value=user),
            patch("app.routes.auth.verify_password", return_value=False),
        ):
            first = self.client.post(
                "/auth/login",
                json={"username": "admin", "password": "wrong-pass-1"},
            )
            second = self.client.post(
                "/auth/login",
                json={"username": "admin", "password": "wrong-pass-2"},
            )
            third = self.client.post(
                "/auth/login",
                json={"username": "admin", "password": "wrong-pass-3"},
            )

        self.assertEqual(first.status_code, 401)
        self.assertEqual(second.status_code, 401)
        self.assertEqual(third.status_code, 429)
        self.assertIn("Too many authentication attempts", third.json()["detail"])

    def test_security_headers_are_present(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["x-frame-options"], "DENY")
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertEqual(response.headers["referrer-policy"], "strict-origin-when-cross-origin")
        self.assertIn("camera=()", response.headers["permissions-policy"])

    def test_authenticated_write_rejects_foreign_origin(self):
        user = {
            "id": "user-1",
            "username": "member",
            "plan": "trial",
            "role": "member",
            "must_change_password": False,
            "created_at": "2026-04-01T00:00:00+00:00",
            "session_created_at": datetime.now(timezone.utc).isoformat(),
        }

        with patch("app.services.auth.get_session_user_by_token", return_value=user):
            response = self.client.post(
                "/auth/logout",
                headers={"Origin": "https://evil.example.com"},
                cookies={SESSION_COOKIE_NAME: "live-session"},
            )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "Origin is not allowed for authenticated write requests.",
        )

    def test_authenticated_write_allows_configured_origin(self):
        user = {
            "id": "user-1",
            "username": "member",
            "plan": "trial",
            "role": "member",
            "must_change_password": False,
            "created_at": "2026-04-01T00:00:00+00:00",
            "session_created_at": datetime.now(timezone.utc).isoformat(),
        }

        with (
            patch.dict(
                os.environ,
                {"CORS_ALLOW_ORIGINS": "https://deploymatecloud.ru, https://app.deploymatecloud.ru/"},
                clear=False,
            ),
            patch("app.services.auth.get_session_user_by_token", return_value=user),
            patch("app.routes.auth.delete_session", return_value=None),
        ):
            response = self.client.post(
                "/auth/logout",
                headers={"Origin": "https://app.deploymatecloud.ru"},
                cookies={SESSION_COOKIE_NAME: "live-session"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "logged_out")


if __name__ == "__main__":
    unittest.main()
