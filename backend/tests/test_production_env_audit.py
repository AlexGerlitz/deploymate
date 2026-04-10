import os
import subprocess
import tempfile
import unittest
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

    def _write_env_file(
        self,
        directory: Path,
        *,
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
                [
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


if __name__ == "__main__":
    unittest.main()
