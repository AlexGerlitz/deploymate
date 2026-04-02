import os

from cryptography.fernet import Fernet, InvalidToken


SERVER_CREDENTIALS_KEY_ENV = "DEPLOYMATE_SERVER_CREDENTIALS_KEY"
SERVER_CREDENTIALS_PREFIX = "enc:v1:"


class ServerCredentialCryptoError(RuntimeError):
    pass


def server_credentials_encryption_enabled() -> bool:
    return bool(os.getenv(SERVER_CREDENTIALS_KEY_ENV, "").strip())


def server_credential_is_encrypted(value: str | None) -> bool:
    return bool(value) and value.startswith(SERVER_CREDENTIALS_PREFIX)


def _get_fernet() -> Fernet:
    key = os.getenv(SERVER_CREDENTIALS_KEY_ENV, "").strip()
    if not key:
        raise ServerCredentialCryptoError(
            f"{SERVER_CREDENTIALS_KEY_ENV} must be set to encrypt or decrypt server credentials."
        )

    try:
        return Fernet(key.encode("utf-8"))
    except (TypeError, ValueError) as exc:
        raise ServerCredentialCryptoError(
            f"{SERVER_CREDENTIALS_KEY_ENV} is invalid. Expected a Fernet-compatible base64 key."
        ) from exc


def encrypt_server_credential(value: str | None) -> str | None:
    if value is None or value.startswith(SERVER_CREDENTIALS_PREFIX):
        return value

    return SERVER_CREDENTIALS_PREFIX + _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_server_credential(value: str | None) -> str | None:
    if value is None or not value.startswith(SERVER_CREDENTIALS_PREFIX):
        return value

    token = value.removeprefix(SERVER_CREDENTIALS_PREFIX).encode("utf-8")
    try:
        return _get_fernet().decrypt(token).decode("utf-8")
    except InvalidToken as exc:
        raise ServerCredentialCryptoError(
            "Server credential decryption failed. Check DEPLOYMATE_SERVER_CREDENTIALS_KEY."
        ) from exc
