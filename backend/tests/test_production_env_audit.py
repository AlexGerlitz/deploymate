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

    def test_release_maintenance_status_json_output_is_machine_readable(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fake_gh = Path(tmpdir) / "gh"
            fake_gh.write_text(
                """#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "variable" ] && [ "$2" = "list" ]; then
  printf 'RELEASE_AUDIT_SCHEDULED_PAUSED\\ttrue\\t2026-06-20T00:00:00Z\\n'
  printf 'STAGING_RELEASE_PAUSED\\tfalse\\t2026-06-20T00:00:00Z\\n'
  exit 0
fi
if [ "$1" = "issue" ] && [ "$2" = "view" ]; then
  if [ "$3" = "18" ]; then
    cat <<'JSON'
{"state":"CLOSED","body":"Resolved incident","comments":[]}
JSON
  else
    cat <<'JSON'
{"state":"OPEN","body":"Failure category: `ssh_auth_denied`\\nOperator hint: Restore deploy key.","comments":[]}
JSON
  fi
  exit 0
fi
exit 1
""",
                encoding="utf-8",
            )
            fake_gh.chmod(0o755)

            env = os.environ.copy()
            env["PATH"] = f"{tmpdir}:{env['PATH']}"

            result = subprocess.run(
                [
                    "bash",
                    "scripts/release_maintenance_status.sh",
                    "--repo",
                    "AlexGerlitz/deploymate",
                    "--no-network",
                    "--format",
                    "json",
                ],
                cwd=self.repo_root,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["repo"], "AlexGerlitz/deploymate")
        self.assertRegex(payload["generated_at"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
        self.assertEqual(payload["gh_available"], "1")
        self.assertEqual(payload["release_audit_scheduled_paused"], "true")
        self.assertEqual(payload["staging_release_paused"], "false")
        self.assertEqual(payload["issue_18_state"], "CLOSED")
        self.assertEqual(payload["issue_18_failure_category"], "unavailable")
        self.assertEqual(payload["issue_19_state"], "OPEN")
        self.assertEqual(payload["issue_19_failure_category"], "ssh_auth_denied")
        self.assertEqual(payload["issue_19_operator_hint"], "Restore deploy key.")
        self.assertEqual(payload["network_checks"], "skipped")
        self.assertEqual(payload["ready_for_unpause"], "0")
        self.assertEqual(payload["blocker_count"], "2")
        self.assertEqual(payload["blocker_1"], "release audit schedule paused")
        self.assertEqual(payload["blocker_2"], "issue #19 is OPEN")

    def test_release_maintenance_status_marks_enabled_network_checks(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fake_gh = Path(tmpdir) / "gh"
            fake_gh.write_text(
                """#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "variable" ] && [ "$2" = "list" ]; then
  printf 'RELEASE_AUDIT_SCHEDULED_PAUSED\\tfalse\\t2026-06-20T00:00:00Z\\n'
  printf 'STAGING_RELEASE_PAUSED\\tfalse\\t2026-06-20T00:00:00Z\\n'
  exit 0
fi
if [ "$1" = "issue" ] && [ "$2" = "view" ]; then
  cat <<'JSON'
{"state":"CLOSED","body":"Resolved incident","comments":[]}
JSON
  exit 0
fi
exit 1
""",
                encoding="utf-8",
            )
            fake_gh.chmod(0o755)

            fake_dig = Path(tmpdir) / "dig"
            fake_dig.write_text("#!/usr/bin/env bash\nprintf '203.0.113.10\\n'\n", encoding="utf-8")
            fake_dig.chmod(0o755)

            fake_curl = Path(tmpdir) / "curl"
            fake_curl.write_text(
                "#!/usr/bin/env bash\nprintf 'code=204 remote=203.0.113.10'\n",
                encoding="utf-8",
            )
            fake_curl.chmod(0o755)

            env = os.environ.copy()
            env["PATH"] = f"{tmpdir}:{env['PATH']}"

            result = subprocess.run(
                [
                    "bash",
                    "scripts/release_maintenance_status.sh",
                    "--repo",
                    "AlexGerlitz/deploymate",
                    "--hosts",
                    "example.com",
                    "--format",
                    "json",
                ],
                cwd=self.repo_root,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["network_checks"], "enabled")
        self.assertEqual(payload["host_example_com_dns"], "203.0.113.10")
        self.assertEqual(payload["host_example_com_https_code"], "204")
        self.assertEqual(payload["host_example_com_remote_ip"], "203.0.113.10")
        self.assertEqual(payload["ready_for_unpause"], "1")
        self.assertEqual(payload["blocker_count"], "0")

    def test_release_maintenance_status_tolerates_dns_probe_failure(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fake_gh = Path(tmpdir) / "gh"
            fake_gh.write_text(
                """#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "variable" ] && [ "$2" = "list" ]; then
  printf 'RELEASE_AUDIT_SCHEDULED_PAUSED\\tfalse\\t2026-06-20T00:00:00Z\\n'
  printf 'STAGING_RELEASE_PAUSED\\tfalse\\t2026-06-20T00:00:00Z\\n'
  exit 0
fi
if [ "$1" = "issue" ] && [ "$2" = "view" ]; then
  cat <<'JSON'
{"state":"CLOSED","body":"Resolved incident","comments":[]}
JSON
  exit 0
fi
exit 1
""",
                encoding="utf-8",
            )
            fake_gh.chmod(0o755)

            fake_dig = Path(tmpdir) / "dig"
            fake_dig.write_text(
                "#!/usr/bin/env bash\nprintf ';; connection timed out; no servers could be reached\\n'\nexit 9\n",
                encoding="utf-8",
            )
            fake_dig.chmod(0o755)

            fake_curl = Path(tmpdir) / "curl"
            fake_curl.write_text(
                "#!/usr/bin/env bash\nprintf 'code=204 remote=203.0.113.10'\n",
                encoding="utf-8",
            )
            fake_curl.chmod(0o755)

            env = os.environ.copy()
            env["PATH"] = f"{tmpdir}:{env['PATH']}"

            result = subprocess.run(
                [
                    "bash",
                    "scripts/release_maintenance_status.sh",
                    "--repo",
                    "AlexGerlitz/deploymate",
                    "--hosts",
                    "example.com",
                    "--format",
                    "json",
                ],
                cwd=self.repo_root,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["network_checks"], "enabled")
        self.assertEqual(payload["host_example_com_dns"], "unavailable")
        self.assertEqual(payload["host_example_com_https_code"], "204")
        self.assertEqual(payload["ready_for_unpause"], "1")

    def test_release_maintenance_status_markdown_output_is_human_readable(self):
        env = os.environ.copy()
        env["RELEASE_AUDIT_SCHEDULED_PAUSED"] = "true"
        env["STAGING_RELEASE_PAUSED"] = "true"

        result = subprocess.run(
            [
                "bash",
                "scripts/release_maintenance_status.sh",
                "--repo",
                "AlexGerlitz/deploymate",
                "--no-network",
                "--format",
                "markdown",
            ],
            cwd=self.repo_root,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("# Release Maintenance Status", result.stdout)
        self.assertIn("| Repository | `AlexGerlitz/deploymate` |", result.stdout)
        self.assertIn("| Ready for unpause | `0` |", result.stdout)
        self.assertIn("- Network checks were skipped for this run.", result.stdout)
        self.assertIn("- release audit schedule paused", result.stdout)
        self.assertIn("- staging release paused", result.stdout)

    def test_sync_release_maintenance_status_writes_runtime_status_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fake_gh = Path(tmpdir) / "gh"
            fake_gh.write_text(
                """#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "variable" ] && [ "$2" = "list" ]; then
  printf 'RELEASE_AUDIT_SCHEDULED_PAUSED\\ttrue\\t2026-06-21T00:00:00Z\\n'
  printf 'STAGING_RELEASE_PAUSED\\tfalse\\t2026-06-21T00:00:00Z\\n'
  exit 0
fi
if [ "$1" = "issue" ] && [ "$2" = "view" ]; then
  if [ "$3" = "18" ]; then
    cat <<'JSON'
{"state":"OPEN","body":"Failure category: `ssh_auth_denied`\\nOperator hint: Restore deploy key.","comments":[]}
JSON
  else
    cat <<'JSON'
{"state":"CLOSED","body":"Resolved incident","comments":[]}
JSON
  fi
  exit 0
fi
exit 1
""",
                encoding="utf-8",
            )
            fake_gh.chmod(0o755)
            output_path = Path(tmpdir) / "runtime" / "release-maintenance-status.json"

            env = os.environ.copy()
            env["PATH"] = f"{tmpdir}:{env['PATH']}"

            result = subprocess.run(
                [
                    "bash",
                    "scripts/sync_release_maintenance_status.sh",
                    "--source",
                    "maintenance",
                    "--repo",
                    "AlexGerlitz/deploymate",
                    "--output",
                    str(output_path),
                    "--no-network",
                ],
                cwd=self.repo_root,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            payload = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("[sync-release-maintenance] wrote maintenance status", result.stdout)
        self.assertEqual(payload["network_checks"], "skipped")
        self.assertEqual(payload["issue_18_state"], "OPEN")
        self.assertEqual(payload["issue_18_failure_category"], "ssh_auth_denied")
        self.assertEqual(payload["issue_18_operator_hint"], "Restore deploy key.")
        self.assertEqual(payload["ready_for_unpause"], "0")

    def test_sync_release_maintenance_status_writes_public_evidence_bundle(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fake_gh = Path(tmpdir) / "gh"
            fake_gh.write_text(
                """#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "run" ] && [ "$2" = "list" ]; then
  cat <<'JSON'
[
  {"workflowName":"CI","status":"completed","conclusion":"success","databaseId":201,"url":"https://example.test/actions/runs/201","headSha":"abc","displayTitle":"CI","event":"push","createdAt":"2026-06-21T00:00:00Z"},
  {"workflowName":"Release Maintenance Status","status":"completed","conclusion":"success","databaseId":202,"url":"https://example.test/actions/runs/202","headSha":"abc","displayTitle":"Release Maintenance Status","event":"workflow_dispatch","createdAt":"2026-06-21T00:01:00Z"}
]
JSON
  exit 0
fi
if [ "$1" = "variable" ] && [ "$2" = "list" ]; then
  printf 'RELEASE_AUDIT_SCHEDULED_PAUSED\\tfalse\\t2026-06-21T00:00:00Z\\n'
  printf 'STAGING_RELEASE_PAUSED\\tfalse\\t2026-06-21T00:00:00Z\\n'
  exit 0
fi
if [ "$1" = "issue" ] && [ "$2" = "view" ]; then
  cat <<'JSON'
{"state":"CLOSED","body":"Resolved incident","comments":[]}
JSON
  exit 0
fi
exit 1
""",
                encoding="utf-8",
            )
            fake_gh.chmod(0o755)
            output_path = Path(tmpdir) / "runtime" / "deploymate-public-evidence.json"

            env = os.environ.copy()
            env["PATH"] = f"{tmpdir}:{env['PATH']}"

            result = subprocess.run(
                [
                    "bash",
                    "scripts/sync_release_maintenance_status.sh",
                    "--source",
                    "evidence",
                    "--repo",
                    "AlexGerlitz/deploymate",
                    "--branch",
                    "develop",
                    "--output",
                    str(output_path),
                    "--no-network",
                ],
                cwd=self.repo_root,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            payload = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("[sync-release-maintenance] wrote evidence status", result.stdout)
        self.assertEqual(payload["workflows"]["ci"]["databaseId"], 201)
        self.assertEqual(payload["maintenance"]["network_checks"], "skipped")
        self.assertEqual(payload["maintenance"]["ready_for_unpause"], "1")
        self.assertEqual(payload["maintenance"]["issue_18_state"], "CLOSED")
        self.assertEqual(payload["maintenance"]["issue_19_state"], "CLOSED")
        self.assertEqual(payload["maintenance"]["repair_playbook"][0]["key"], "planned-unpause")

    def test_public_evidence_bundle_summarizes_workflows_and_maintenance(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            fake_gh = Path(tmpdir) / "gh"
            fake_gh.write_text(
                """#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = "run" ] && [ "$2" = "list" ]; then
  cat <<'JSON'
[
  {"workflowName":"CI","status":"in_progress","conclusion":"","databaseId":100,"url":"https://example.test/actions/runs/100","headSha":"abc","displayTitle":"CI pending","event":"push","createdAt":"2026-06-20T00:02:00Z"},
  {"workflowName":"CI","status":"completed","conclusion":"success","databaseId":101,"url":"https://example.test/actions/runs/101","headSha":"abc","displayTitle":"CI","event":"push","createdAt":"2026-06-20T00:00:00Z"},
  {"workflowName":"Release Maintenance Status","status":"completed","conclusion":"success","databaseId":102,"url":"https://example.test/actions/runs/102","headSha":"abc","displayTitle":"Release Maintenance Status","event":"workflow_dispatch","createdAt":"2026-06-20T00:01:00Z"}
]
JSON
  exit 0
fi
if [ "$1" = "variable" ] && [ "$2" = "list" ]; then
  printf 'RELEASE_AUDIT_SCHEDULED_PAUSED\\ttrue\\t2026-06-20T00:00:00Z\\n'
  printf 'STAGING_RELEASE_PAUSED\\ttrue\\t2026-06-20T00:00:00Z\\n'
  exit 0
fi
if [ "$1" = "issue" ] && [ "$2" = "view" ]; then
  cat <<'JSON'
{"state":"OPEN","body":"Failure category: `ssh_auth_denied`\\nOperator hint: Restore the deploy public key.","comments":[]}
JSON
  exit 0
fi
exit 1
""",
                encoding="utf-8",
            )
            fake_gh.chmod(0o755)

            env = os.environ.copy()
            env["PATH"] = f"{tmpdir}:{env['PATH']}"

            json_result = subprocess.run(
                [
                    "python3",
                    "scripts/public_evidence_bundle.py",
                    "--repo",
                    "AlexGerlitz/deploymate",
                    "--branch",
                    "develop",
                    "--format",
                    "json",
                ],
                cwd=self.repo_root,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            markdown_result = subprocess.run(
                [
                    "python3",
                    "scripts/public_evidence_bundle.py",
                    "--repo",
                    "AlexGerlitz/deploymate",
                    "--branch",
                    "develop",
                    "--format",
                    "markdown",
                ],
                cwd=self.repo_root,
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )

        self.assertEqual(json_result.returncode, 0, json_result.stdout + json_result.stderr)
        payload = json.loads(json_result.stdout)
        self.assertEqual(payload["repo"], "AlexGerlitz/deploymate")
        self.assertEqual(payload["branch"], "develop")
        self.assertEqual(payload["maintenance"]["ready_for_unpause"], "0")
        self.assertEqual(payload["maintenance"]["repair_playbook"][1]["key"], "restore-deploy-key")
        self.assertEqual(payload["workflows"]["ci"]["conclusion"], "success")
        self.assertEqual(payload["workflows"]["ci"]["databaseId"], 101)
        self.assertEqual(payload["workflows"]["release_maintenance_status"]["databaseId"], 102)

        self.assertEqual(markdown_result.returncode, 0, markdown_result.stdout + markdown_result.stderr)
        self.assertIn("# DeployMate Public Evidence Bundle", markdown_result.stdout)
        self.assertIn("| CI | `completed` | `success` | [101](https://example.test/actions/runs/101) |", markdown_result.stdout)
        self.assertIn("- release audit schedule paused", markdown_result.stdout)
        self.assertIn("## Release Repair Playbook", markdown_result.stdout)
        self.assertIn("**Restore the deploy public key**", markdown_result.stdout)
        self.assertIn("- `Release Maintenance Status artifact`", markdown_result.stdout)


if __name__ == "__main__":
    unittest.main()
