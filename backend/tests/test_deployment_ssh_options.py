import os
import tempfile
import unittest
from unittest.mock import patch

from app.services.deployments import _build_ssh_base_command


class DeploymentSshOptionsTests(unittest.TestCase):
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
