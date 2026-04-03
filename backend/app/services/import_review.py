from datetime import datetime, timezone

from app.routes.root import (
    _analyze_restore_bundle,
    _build_backup_bundle,
    _build_restore_import_plan,
)


def build_import_review_workspace() -> dict:
    bundle = _build_backup_bundle()
    bundle_payload = bundle.model_dump()
    dry_run = _analyze_restore_bundle(bundle_payload)
    import_plan = _build_restore_import_plan(dry_run)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "bundle_manifest": bundle.manifest,
        "dry_run": dry_run,
        "import_plan": import_plan,
    }
