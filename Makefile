.PHONY: changed profile-changed profile-frontend profile-backend profile-fast profile-frontend-hot profile-fast-hot frontend-smoke-server-status frontend-smoke-server-stop fast fast-hot frontend frontend-hot backend full timing-history timing-stats timing-hint ship-staging

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
