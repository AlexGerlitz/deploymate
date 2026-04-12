import os
import json
import subprocess
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class ProductionEnvAuditScriptTests(unittest.TestCase):
    def setUp(self):
        self.repo_root = Path(__file__).resolve().parents[2]

    def _run_script(self, script_name: str, *args: str) -> subprocess.CompletedProcess[str]:
        cache_dir = Path(tempfile.mkdtemp())
        env = os.environ.copy()
        env["DEPLOYMATE_AUDIT_CACHE_DIR"] = str(cache_dir / "run")
        env["DEPLOYMATE_PERSISTENT_AUDIT_CACHE_DIR"] = str(cache_dir / "persistent")
        Path(env["DEPLOYMATE_AUDIT_CACHE_DIR"]).mkdir(parents=True, exist_ok=True)

        return subprocess.run(
            ["bash", f"scripts/{script_name}", *args],
            cwd=self.repo_root,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    def _start_precheck_server(self, mode: str):
        session_cookie = "deploymate_session=test-session"

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, format: str, *args) -> None:
                return

            def _write_json(self, status: int, payload: dict, headers: dict[str, str] | None = None) -> None:
                body = json.dumps(payload).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                for name, value in (headers or {}).items():
                    self.send_header(name, value)
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self) -> None:
                if self.path == "/api/health":
                    if mode == "login-401":
                        self._write_json(200, {"status": "healthy"})
                    else:
                        self._write_json(503, {"status": "starting"})
                    return

                if self.path == "/api/auth/me":
                    if mode == "login-200" and session_cookie in (self.headers.get("Cookie") or ""):
                        self._write_json(200, {"username": "admin"})
                    else:
                        self._write_json(401, {"detail": "Not authenticated"})
                    return

                self._write_json(404, {"detail": "Not found"})

            def do_POST(self) -> None:
                if self.path == "/api/auth/login":
                    length = int(self.headers.get("Content-Length", "0"))
                    body = self.rfile.read(length).decode("utf-8")
                    payload = json.loads(body or "{}")

                    if mode == "login-200" and payload == {"username": "admin", "password": "secret"}:
                        self._write_json(
                            200,
                            {"username": "admin"},
                            {"Set-Cookie": session_cookie},
                        )
                    elif mode == "login-401":
                        self._write_json(401, {"detail": "Invalid username or password."})
                    else:
                        self._write_json(503, {"detail": "Service unavailable"})
                    return

                if self.path == "/api/auth/logout":
                    self._write_json(200, {"status": "logged_out"})
                    return

                self._write_json(404, {"detail": "Not found"})

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        return server, thread

    def _write_env_file(
        self,
        directory: Path,
        *,
        admin_username: str | None = None,
        admin_password: str = "super-secret-admin-password",
        credentials_key: str = "real-fernet-key-for-production",
        session_cookie_secure: str = "true",
        auth_rate_limit_backend: str = "database",
        ssh_host_key_checking: str = "yes",
        known_hosts_file: str | None = None,
        local_docker_enabled: str = "false",
        local_deployments_enabled: str = "0",
    ) -> Path:
        env_path = directory / ".env.production"
        known_hosts_path = known_hosts_file or str(directory / "known_hosts")
        env_path.write_text(
            "\n".join(
                (
                    [f"DEPLOYMATE_ADMIN_USERNAME={admin_username}"] if admin_username is not None else []
                )
                + [
                    f"DEPLOYMATE_ADMIN_PASSWORD={admin_password}",
                    f"DEPLOYMATE_SERVER_CREDENTIALS_KEY={credentials_key}",
                    f"SESSION_COOKIE_SECURE={session_cookie_secure}",
                    f"DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND={auth_rate_limit_backend}",
                    f"DEPLOYMATE_SSH_HOST_KEY_CHECKING={ssh_host_key_checking}",
                    f"DEPLOYMATE_SSH_KNOWN_HOSTS_FILE={known_hosts_path}",
                    f"DEPLOYMATE_LOCAL_DOCKER_ENABLED={local_docker_enabled}",
                    f"NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED={local_deployments_enabled}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        return env_path

    def test_production_env_audit_accepts_secure_env_and_runtime_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            known_hosts_path = temp_path / "known_hosts"
            known_hosts_path.write_text(
                "deploymate.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBZexampleknownhostvalue\n",
                encoding="utf-8",
            )
            env_path = self._write_env_file(temp_path, known_hosts_file=str(known_hosts_path))

            result = self._run_script(
                "production_env_audit.sh",
                "--env-file",
                str(env_path),
                "--require-runtime-files",
            )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("[production-env-audit] ok", result.stdout)

    def test_production_env_audit_rejects_placeholder_admin_password(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            known_hosts_path = temp_path / "known_hosts"
            known_hosts_path.write_text("host ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestvalue\n", encoding="utf-8")
            env_path = self._write_env_file(
                temp_path,
                admin_password="admin",
                known_hosts_file=str(known_hosts_path),
            )

            result = self._run_script("production_env_audit.sh", "--env-file", str(env_path))

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DEPLOYMATE_ADMIN_PASSWORD", result.stderr)

    def test_production_env_audit_rejects_memory_rate_limit_backend(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            known_hosts_path = temp_path / "known_hosts"
            known_hosts_path.write_text("host ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestvalue\n", encoding="utf-8")
            env_path = self._write_env_file(
                temp_path,
                auth_rate_limit_backend="memory",
                known_hosts_file=str(known_hosts_path),
            )

            result = self._run_script("production_env_audit.sh", "--env-file", str(env_path))

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DEPLOYMATE_AUTH_RATE_LIMIT_BACKEND=database", result.stderr)

    def test_production_env_audit_rejects_non_strict_ssh_mode(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            known_hosts_path = temp_path / "known_hosts"
            known_hosts_path.write_text("host ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestvalue\n", encoding="utf-8")
            env_path = self._write_env_file(
                temp_path,
                ssh_host_key_checking="accept-new",
                known_hosts_file=str(known_hosts_path),
            )

            result = self._run_script("production_env_audit.sh", "--env-file", str(env_path))

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DEPLOYMATE_SSH_HOST_KEY_CHECKING=yes", result.stderr)

    def test_production_env_audit_requires_known_hosts_file_on_runtime_host(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            env_path = self._write_env_file(
                temp_path,
                known_hosts_file=str(temp_path / "missing_known_hosts"),
            )

            result = self._run_script(
                "production_env_audit.sh",
                "--env-file",
                str(env_path),
                "--require-runtime-files",
            )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("known_hosts file", result.stderr)

    def test_runtime_capability_audit_accepts_custom_env_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            env_path = self._write_env_file(temp_path)

            result = self._run_script("runtime_capability_audit.sh", "--env-file", str(env_path))

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("[runtime-capability-audit] ok", result.stdout)

    def test_runtime_capability_audit_rejects_misaligned_custom_env_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            env_path = self._write_env_file(
                temp_path,
                local_docker_enabled="false",
                local_deployments_enabled="1",
            )

            result = self._run_script("runtime_capability_audit.sh", "--env-file", str(env_path))

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=1", result.stderr)

    def test_remote_release_dry_run_forwards_smoke_curl_resolve(self):
        env = os.environ.copy()
        env["DEPLOYMATE_SMOKE_CURL_RESOLVE"] = "deploymatecloud.ru:443:103.88.241.103"

        result = subprocess.run(
            [
                "bash",
                "scripts/remote_release.sh",
                "--host",
                "deploymate",
                "--base-url",
                "https://deploymatecloud.ru",
                "--admin-username",
                "admin",
                "--admin-password",
                "super-secret-admin-password",
                "--dry-run",
            ],
            cwd=self.repo_root,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(
            "DEPLOYMATE_SMOKE_CURL_RESOLVE=deploymatecloud.ru:443:103.88.241.103",
            result.stdout,
        )

    def test_remote_release_dry_run_supports_remote_smoke_runner(self):
        env = os.environ.copy()
        env["DEPLOYMATE_SMOKE_RUNNER"] = "remote"
        env["DEPLOYMATE_SMOKE_CURL_RESOLVE"] = "deploymatecloud.ru:443:127.0.0.1"

        result = subprocess.run(
            [
                "bash",
                "scripts/remote_release.sh",
                "--host",
                "deploymate",
                "--base-url",
                "https://deploymatecloud.ru",
                "--admin-username",
                "admin",
                "--admin-password",
                "super-secret-admin-password",
                "--dry-run",
            ],
            cwd=self.repo_root,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("[remote-release] smoke runner: remote", result.stdout)
        self.assertIn("ssh deploymate", result.stdout)
        self.assertIn(
            "DEPLOYMATE_SMOKE_CURL_RESOLVE=deploymatecloud.ru:443:127.0.0.1",
            result.stdout,
        )

    def test_post_deploy_smoke_defines_json_query_helper(self):
        script = (self.repo_root / "scripts" / "post_deploy_smoke.sh").read_text(encoding="utf-8")

        self.assertIn("json_get()", script)
        self.assertIn("json_query()", script)

    def test_release_secret_contract_audit_accepts_matching_credentials(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            env_path = self._write_env_file(
                temp_path,
                admin_username="ops-admin",
                admin_password="shared-secret",
            )

            result = subprocess.run(
                [
                    "bash",
                    "scripts/release_secret_contract_audit.sh",
                    "--host",
                    "local",
                    "--repo-dir",
                    str(temp_path),
                    "--env-file",
                    env_path.name,
                    "--admin-username",
                    "ops-admin",
                    "--admin-password",
                    "shared-secret",
                ],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("runtime env matches provided smoke credentials", result.stdout)

    def test_release_secret_contract_audit_rejects_password_drift(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            env_path = self._write_env_file(
                temp_path,
                admin_username="ops-admin",
                admin_password="runtime-secret",
            )

            result = subprocess.run(
                [
                    "bash",
                    "scripts/release_secret_contract_audit.sh",
                    "--host",
                    "local",
                    "--repo-dir",
                    str(temp_path),
                    "--env-file",
                    env_path.name,
                    "--admin-username",
                    "ops-admin",
                    "--admin-password",
                    "github-secret",
                ],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("target admin password does not match", result.stderr)

    def test_release_secret_contract_audit_uses_default_admin_username(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            env_path = self._write_env_file(
                temp_path,
                admin_username=None,
                admin_password="shared-secret",
            )

            result = subprocess.run(
                [
                    "bash",
                    "scripts/release_secret_contract_audit.sh",
                    "--host",
                    "local",
                    "--repo-dir",
                    str(temp_path),
                    "--env-file",
                    env_path.name,
                    "--admin-username",
                    "admin",
                    "--admin-password",
                    "shared-secret",
                ],
                cwd=self.repo_root,
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("runtime env matches provided smoke credentials", result.stdout)

    def test_release_smoke_precheck_accepts_valid_credentials(self):
        server, thread = self._start_precheck_server("login-200")
        self.addCleanup(server.shutdown)
        self.addCleanup(server.server_close)
        self.addCleanup(thread.join, 1)

        env = os.environ.copy()
        env["DEPLOYMATE_BASE_URL"] = f"http://127.0.0.1:{server.server_address[1]}"
        env["DEPLOYMATE_ADMIN_USERNAME"] = "admin"
        env["DEPLOYMATE_ADMIN_PASSWORD"] = "secret"

        result = subprocess.run(
            ["bash", "scripts/release_smoke_precheck.sh"],
            cwd=self.repo_root,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("smoke credentials validated", result.stdout)

    def test_release_smoke_precheck_fails_fast_on_invalid_credentials(self):
        server, thread = self._start_precheck_server("login-401")
        self.addCleanup(server.shutdown)
        self.addCleanup(server.server_close)
        self.addCleanup(thread.join, 1)

        env = os.environ.copy()
        env["DEPLOYMATE_BASE_URL"] = f"http://127.0.0.1:{server.server_address[1]}"
        env["DEPLOYMATE_ADMIN_USERNAME"] = "admin"
        env["DEPLOYMATE_ADMIN_PASSWORD"] = "secret"

        result = subprocess.run(
            ["bash", "scripts/release_smoke_precheck.sh"],
            cwd=self.repo_root,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("smoke credentials are invalid", result.stderr)

    def test_release_smoke_precheck_allows_inconclusive_target_state(self):
        server, thread = self._start_precheck_server("login-503")
        self.addCleanup(server.shutdown)
        self.addCleanup(server.server_close)
        self.addCleanup(thread.join, 1)

        env = os.environ.copy()
        env["DEPLOYMATE_BASE_URL"] = f"http://127.0.0.1:{server.server_address[1]}"
        env["DEPLOYMATE_ADMIN_USERNAME"] = "admin"
        env["DEPLOYMATE_ADMIN_PASSWORD"] = "secret"

        result = subprocess.run(
            ["bash", "scripts/release_smoke_precheck.sh"],
            cwd=self.repo_root,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("login precheck inconclusive", result.stdout)

    def test_remote_release_dry_run_runs_precheck_before_remote_deploy(self):
        result = subprocess.run(
            [
                "bash",
                "scripts/remote_release.sh",
                "--host",
                "deploymate",
                "--base-url",
                "https://deploymatecloud.ru",
                "--admin-username",
                "admin",
                "--admin-password",
                "super-secret-admin-password",
                "--dry-run",
            ],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("bash scripts/release_secret_contract_audit.sh", result.stdout)
        self.assertIn("bash scripts/release_smoke_precheck.sh", result.stdout)
        self.assertLess(
            result.stdout.index("bash scripts/release_secret_contract_audit.sh"),
            result.stdout.index("bash scripts/release_smoke_precheck.sh"),
        )
        self.assertLess(
            result.stdout.index("bash scripts/release_smoke_precheck.sh"),
            result.stdout.index("ssh deploymate"),
        )


if __name__ == "__main__":
    unittest.main()
