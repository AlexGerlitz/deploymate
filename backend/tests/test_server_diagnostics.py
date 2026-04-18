import subprocess
import unittest
from unittest.mock import patch

from app.services.server_diagnostics import collect_server_diagnostics


def _result(stdout: str = "", stderr: str = "", returncode: int = 0) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(args=["mock"], returncode=returncode, stdout=stdout, stderr=stderr)


class ServerDiagnosticsTests(unittest.TestCase):
    def setUp(self):
        self.server = {
            "name": "prod",
            "host": "203.0.113.10",
            "port": 22,
            "username": "deploy",
        }

    def _collect(self, disk_output: str) -> dict[str, object]:
        responses = [
            _result(stdout="deploymate-ssh-ok\n"),
            _result(stdout="Docker version 29.3.1, build c2be9cc\n"),
            _result(stdout="prod-vps\n"),
            _result(stdout="Linux 6.8.0\n"),
            _result(stdout="up 4 days\n"),
            _result(stdout=f"{disk_output}\n"),
            _result(stdout="used 512MB / total 2048MB\n"),
            _result(stdout="Docker Compose version v2.39.4\n"),
            _result(stdout="LISTEN 0 128 0.0.0.0:22 0.0.0.0:*\n"),
        ]

        with patch("app.services.server_diagnostics._run_remote_command", side_effect=responses):
            return collect_server_diagnostics(self.server)

    def test_collect_server_diagnostics_marks_root_disk_pressure_as_warn(self):
        diagnostics = self._collect("/dev/sda1 48G 40G 8.0G 84% /")

        disk_item = next(item for item in diagnostics["items"] if item["key"] == "disk_usage")
        self.assertEqual(disk_item["status"], "warn")
        self.assertIn("84% full", disk_item["summary"])
        self.assertIn("8.0G free", disk_item["details"])

    def test_collect_server_diagnostics_marks_root_disk_pressure_as_error(self):
        diagnostics = self._collect("/dev/sda1 48G 45G 3.0G 94% /")

        disk_item = next(item for item in diagnostics["items"] if item["key"] == "disk_usage")
        self.assertEqual(disk_item["status"], "error")
        self.assertIn("94% full", disk_item["summary"])
        self.assertIn("3.0G free", disk_item["details"])


if __name__ == "__main__":
    unittest.main()
