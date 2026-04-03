.PHONY: changed fast frontend backend full timing-history ship-staging

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

ship-staging:
	git push origin develop
