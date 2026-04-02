import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import SESSION_COOKIE_NAME, hash_password


class AuthApiFlowTests(unittest.TestCase):
    def setUp(self):
        self.users = {
            "admin-1": {
                "id": "admin-1",
                "username": "admin",
                "password_hash": hash_password("admin-secret"),
                "plan": "team",
                "role": "admin",
                "must_change_password": False,
                "created_at": "2026-04-02T00:00:00+00:00",
            }
        }
        self.sessions = {}
        self.next_session_index = 1

        self.patchers = [
            patch("app.main.init_db", return_value=None),
            patch("app.routes.auth.public_signup_enabled", return_value=True),
            patch("app.routes.auth.get_user_by_username", side_effect=self._get_user_by_username),
            patch("app.routes.auth.get_user_by_id", side_effect=self._get_user_by_id),
            patch("app.routes.auth.insert_user", side_effect=self._insert_user),
            patch("app.routes.auth.create_session", side_effect=self._create_session),
            patch("app.routes.auth.delete_session", side_effect=self._delete_session),
            patch("app.routes.auth.update_user_password", side_effect=self._update_user_password),
            patch("app.routes.auth.create_session_token", side_effect=self._create_session_token),
            patch("app.services.auth.get_session_user_by_token", side_effect=self._get_session_user_by_token),
            patch("app.services.auth.get_plan_usage", return_value={"servers": 0, "deployments": 0}),
        ]

        for patcher in self.patchers:
            patcher.start()
            self.addCleanup(patcher.stop)

        self.client = TestClient(app)

    def _get_user_by_username(self, username):
        for user in self.users.values():
            if user["username"] == username:
                return dict(user)
        return None

    def _get_user_by_id(self, user_id):
        user = self.users.get(user_id)
        return dict(user) if user else None

    def _insert_user(self, record):
        serialized = dict(record)
        created_at = serialized.get("created_at")
        if isinstance(created_at, datetime):
            serialized["created_at"] = created_at.isoformat()
        self.users[serialized["id"]] = serialized

    def _create_session_token(self):
        token = f"session-token-{self.next_session_index}"
        self.next_session_index += 1
        return token

    def _create_session(self, token, user_id):
        self.sessions[token] = user_id

    def _delete_session(self, token):
        self.sessions.pop(token, None)

    def _get_session_user_by_token(self, token):
        user_id = self.sessions.get(token)
        if not user_id:
            return None
        user = self.users.get(user_id)
        if not user:
            return None
        return {
            "id": user["id"],
            "username": user["username"],
            "plan": user["plan"],
            "role": user["role"],
            "must_change_password": user["must_change_password"],
            "created_at": user["created_at"],
        }

    def _update_user_password(self, user_id, new_password):
        self.users[user_id]["password_hash"] = hash_password(new_password)
        self.users[user_id]["must_change_password"] = False

    def test_full_auth_http_flow(self):
        register_response = self.client.post(
            "/auth/register",
            json={"username": "new-member", "password": "secret-123"},
        )
        self.assertEqual(register_response.status_code, 200)
        registered = register_response.json()
        user_id = registered["id"]
        self.assertEqual(registered["username"], "new-member")
        self.assertEqual(registered["plan"], "trial")
        self.assertEqual(registered["role"], "member")
        self.assertIn(SESSION_COOKIE_NAME, register_response.cookies)

        me_response = self.client.get("/auth/me")
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.json()["username"], "new-member")

        change_password_response = self.client.post(
            "/auth/change-password",
            json={"current_password": "secret-123", "new_password": "secret-456"},
        )
        self.assertEqual(change_password_response.status_code, 200)
        self.assertEqual(change_password_response.json()["username"], "new-member")

        logout_response = self.client.post("/auth/logout")
        self.assertEqual(logout_response.status_code, 200)
        self.assertEqual(logout_response.json()["status"], "logged_out")

        me_after_logout_response = self.client.get("/auth/me")
        self.assertEqual(me_after_logout_response.status_code, 401)
        self.assertEqual(me_after_logout_response.json()["detail"], "Not authenticated.")

        login_old_password_response = self.client.post(
            "/auth/login",
            json={"username": "new-member", "password": "secret-123"},
        )
        self.assertEqual(login_old_password_response.status_code, 401)

        login_new_password_response = self.client.post(
            "/auth/login",
            json={"username": "new-member", "password": "secret-456"},
        )
        self.assertEqual(login_new_password_response.status_code, 200)
        self.assertEqual(login_new_password_response.json()["id"], user_id)
        self.assertIn(SESSION_COOKIE_NAME, login_new_password_response.cookies)

        me_after_login_response = self.client.get("/auth/me")
        self.assertEqual(me_after_login_response.status_code, 200)
        self.assertEqual(me_after_login_response.json()["username"], "new-member")


if __name__ == "__main__":
    unittest.main()
