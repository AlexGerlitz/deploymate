import os
import unittest
from subprocess import CompletedProcess
from unittest.mock import patch

from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.services.deployments import _run_remote_command
from app.services.server_credentials import (
    SERVER_CREDENTIALS_KEY_ENV,
    decrypt_server_credential,
    encrypt_server_credential,
)


class ServerCredentialTests(unittest.TestCase):
    def test_encrypted_credentials_round_trip(self):
        key = Fernet.generate_key().decode("utf-8")
        with patch.dict(os.environ, {SERVER_CREDENTIALS_KEY_ENV: key}, clear=False):
            encrypted = encrypt_server_credential("secret-value")
            self.assertTrue(encrypted.startswith("enc:v1:"))
            self.assertEqual(decrypt_server_credential(encrypted), "secret-value")

    def test_legacy_plaintext_value_is_still_readable(self):
        self.assertEqual(decrypt_server_credential("legacy-secret"), "legacy-secret")

    def test_run_remote_command_decrypts_password_credentials(self):
        key = Fernet.generate_key().decode("utf-8")
        server = {
            "auth_type": "password",
            "password": None,
            "ssh_key": None,
            "port": 22,
            "username": "deploy",
            "host": "example.com",
        }

        with patch.dict(
            os.environ,
            {
                SERVER_CREDENTIALS_KEY_ENV: key,
                "DEPLOYMATE_SSH_HOST_KEY_CHECKING": "accept-new",
            },
            clear=False,
        ):
            server["password"] = encrypt_server_credential("s3cr3t")
            with patch("app.services.runtime_executors.which", return_value="/usr/bin/sshpass"):
                with patch("app.services.runtime_executors.subprocess.run") as mock_run:
                    mock_run.return_value = CompletedProcess(args=[], returncode=0, stdout="", stderr="")
                    _run_remote_command(server, ["docker", "--version"])

        command = mock_run.call_args.args[0]
        self.assertEqual(command[:3], ["sshpass", "-p", "s3cr3t"])
        self.assertIn("deploy@example.com", command)

    def test_run_remote_command_decrypts_ssh_key_credentials(self):
        key = Fernet.generate_key().decode("utf-8")
        server = {
            "auth_type": "ssh_key",
            "password": None,
            "ssh_key": None,
            "port": 22,
            "username": "deploy",
            "host": "example.com",
        }

        with patch.dict(
            os.environ,
            {
                SERVER_CREDENTIALS_KEY_ENV: key,
                "DEPLOYMATE_SSH_HOST_KEY_CHECKING": "accept-new",
            },
            clear=False,
        ):
            server["ssh_key"] = encrypt_server_credential("PRIVATE-KEY")

            def _fake_run(command, capture_output, text, check, timeout):
                key_path = command[command.index("-i") + 1]
                with open(key_path, "r", encoding="utf-8") as handle:
                    self.assertEqual(handle.read(), "PRIVATE-KEY")
                return CompletedProcess(args=command, returncode=0, stdout="", stderr="")

            with patch("app.services.runtime_executors.subprocess.run", side_effect=_fake_run):
                _run_remote_command(server, ["docker", "--version"])

    def test_encrypted_credentials_fail_without_key(self):
        with patch.dict(os.environ, {}, clear=False):
            with self.assertRaises(HTTPException) as context:
                _run_remote_command(
                    {
                        "auth_type": "password",
                        "password": "enc:v1:invalid",
                        "ssh_key": None,
                        "port": 22,
                        "username": "deploy",
                        "host": "example.com",
                    },
                    ["docker", "--version"],
                )

        self.assertEqual(context.exception.status_code, 500)
        self.assertIn(SERVER_CREDENTIALS_KEY_ENV, context.exception.detail)


if __name__ == "__main__":
    unittest.main()
