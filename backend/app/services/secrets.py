SECRET_MASK = "••••••"


def mask_secret_values(secrets: dict[str, str] | None) -> dict[str, str]:
    return {key: SECRET_MASK for key in (secrets or {}).keys() if key}


def apply_masked_secret_view(record: dict | None) -> dict | None:
    if not record:
        return record

    masked = dict(record)
    secret_values = masked.get("secrets") or {}
    masked["secret_count"] = len(secret_values)
    masked["secrets"] = mask_secret_values(secret_values)
    return masked
