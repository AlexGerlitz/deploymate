.PHONY: changed fast frontend backend full ship-staging

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

ship-staging:
	git push origin develop
