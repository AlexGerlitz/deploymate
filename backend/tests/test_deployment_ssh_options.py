import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.services.auth import public_signup_enabled
from app.services.deployments import _build_ssh_base_command, ensure_local_docker_runtime_enabled


class DeploymentSshOptionsTests(unittest.TestCase):
    def test_public_signup_disabled_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            self.assertFalse(public_signup_enabled())

    def test_public_signup_enabled_helper_accepts_true_values(self):
        with patch.dict(os.environ, {"DEPLOYMATE_PUBLIC_SIGNUP_ENABLED": "true"}, clear=False):
            self.assertTrue(public_signup_enabled())

    def test_local_runtime_guard_blocks_when_disabled(self):
        with patch.dict(os.environ, {"DEPLOYMATE_LOCAL_DOCKER_ENABLED": "false"}, clear=False):
            with self.assertRaises(HTTPException) as context:
                ensure_local_docker_runtime_enabled()

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Local host deployments are disabled", context.exception.detail)

    def test_local_runtime_guard_allows_when_enabled(self):
        with patch.dict(os.environ, {"DEPLOYMATE_LOCAL_DOCKER_ENABLED": "true"}, clear=False):
            ensure_local_docker_runtime_enabled()

    def test_default_ssh_mode_is_accept_new(self):
        server = {"port": 22}

        with patch.dict(os.environ, {}, clear=False):
            command = _build_ssh_base_command(server)

        self.assertIn("StrictHostKeyChecking=accept-new", command)
        self.assertTrue(any(item.startswith("UserKnownHostsFile=") for item in command))

    def test_no_mode_uses_dev_null_known_hosts(self):
        server = {"port": 2222}

        with patch.dict(os.environ, {"DEPLOYMATE_SSH_HOST_KEY_CHECKING": "no"}, clear=False):
            command = _build_ssh_base_command(server)

        self.assertIn("StrictHostKeyChecking=no", command)
        self.assertIn("UserKnownHostsFile=/dev/null", command)

    def test_custom_known_hosts_file_is_respected(self):
        server = {"port": 2200}

        with tempfile.TemporaryDirectory() as temp_dir:
            known_hosts = os.path.join(temp_dir, "nested", "known_hosts")
            with patch.dict(
                os.environ,
                {
                    "DEPLOYMATE_SSH_HOST_KEY_CHECKING": "yes",
                    "DEPLOYMATE_SSH_KNOWN_HOSTS_FILE": known_hosts,
                },
                clear=False,
            ):
                command = _build_ssh_base_command(server)

            self.assertIn("StrictHostKeyChecking=yes", command)
            self.assertIn(f"UserKnownHostsFile={known_hosts}", command)
            self.assertTrue(os.path.isdir(os.path.dirname(known_hosts)))


if __name__ == "__main__":
    unittest.main()
