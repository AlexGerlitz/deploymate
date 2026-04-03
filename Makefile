.PHONY: changed fast frontend backend full timing-history timing-stats timing-hint ship-staging

changed:
	bash scripts/dev_verify_changed.sh

fast:
	bash scripts/dev_fast_check.sh full

frontend:
	bash scripts/dev_fast_check.sh frontend

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
