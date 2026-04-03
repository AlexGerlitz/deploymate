.PHONY: scaffold-product-resource export-product-starter bootstrap-product-starter dev-doctor start-pr-branch pr-ready pr-open pr-status pr-doctor pr-watch pr-land recommend-local-mode auto-local changed profile-changed profile-frontend profile-backend profile-fast profile-frontend-hot profile-fast-hot frontend-smoke-server-status frontend-smoke-server-stop audit-cache-clear export-automation-core bootstrap-core bootstrap-core-init upgrade-core doctor-core fast fast-hot frontend frontend-hot backend full timing-history timing-stats timing-hint ship-staging

scaffold-product-resource:
	bash scripts/scaffold_product_resource.sh $(TARGET_DIR) $(RESOURCE_FLAGS)

export-product-starter:
	bash scripts/export_product_starter.sh

bootstrap-product-starter:
	bash scripts/bootstrap_product_starter.sh $(TARGET_DIR) $(PRODUCT_STARTER_FLAGS)

dev-doctor:
	bash scripts/dev_doctor.sh

start-pr-branch:
	bash scripts/start_pr_branch.sh $(SLUG)

pr-ready:
	bash scripts/pr_ready_check.sh $(PR_READY_FLAGS)

pr-open:
	bash scripts/open_pull_request.sh $(PR_OPEN_FLAGS)

pr-status:
	bash scripts/pr_status.sh

pr-doctor:
	bash scripts/pr_doctor.sh $(PR_DOCTOR_FLAGS)

pr-watch:
	bash scripts/pr_watch.sh $(PR_WATCH_FLAGS)

pr-land:
	bash scripts/pr_land.sh $(PR_LAND_FLAGS)

recommend-local-mode:
	bash scripts/recommend_local_mode.sh

auto-local:
	bash scripts/run_recommended_local_mode.sh

changed:
	bash scripts/dev_verify_changed.sh

profile-changed:
	bash scripts/profile_changed.sh

profile-frontend:
	bash scripts/profile_surface.sh frontend

profile-backend:
	bash scripts/profile_surface.sh backend

profile-fast:
	bash scripts/profile_surface.sh full

profile-frontend-hot:
	FRONTEND_SMOKE_PERSIST_SERVER=1 bash scripts/profile_surface.sh frontend

profile-fast-hot:
	FRONTEND_SMOKE_PERSIST_SERVER=1 bash scripts/profile_surface.sh full

frontend-smoke-server-status:
	bash scripts/frontend_smoke_server_control.sh status

frontend-smoke-server-stop:
	bash scripts/frontend_smoke_server_control.sh stop

audit-cache-clear:
	bash scripts/audit_cache.sh clear_persistent

export-automation-core:
	bash scripts/export_automation_core.sh

bootstrap-core:
	bash scripts/bootstrap_project_automation.sh $(TARGET_DIR)

bootstrap-core-init:
	bash scripts/bootstrap_project_automation.sh $(TARGET_DIR) --init-adapters $(BOOTSTRAP_CORE_FLAGS)

upgrade-core:
	bash scripts/upgrade_project_automation.sh $(TARGET_DIR) $(UPGRADE_FLAGS)

doctor-core:
	bash scripts/automation_core_doctor.sh $(TARGET_DIR) $(DOCTOR_FLAGS)

fast:
	bash scripts/dev_fast_check.sh full

fast-hot:
	FRONTEND_SMOKE_PERSIST_SERVER=1 bash scripts/dev_fast_check.sh full

frontend:
	bash scripts/dev_fast_check.sh frontend

frontend-hot:
	FRONTEND_SMOKE_PERSIST_SERVER=1 bash scripts/dev_fast_check.sh frontend

backend:
	bash scripts/dev_fast_check.sh backend

full:
	bash scripts/release_workflow.sh --surface full

timing-history:
	bash scripts/timing_history.sh print_recent 20

timing-stats:
	bash scripts/timing_history.sh print_stats 160

timing-hint:
	bash scripts/timing_history.sh print_hint release_workflow full 1 160

ship-staging:
	git push origin develop
