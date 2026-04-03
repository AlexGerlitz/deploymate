#!/usr/bin/env bash

# Project-specific smoke routes and assertions.

automation_smoke_auth_checks() {
  cat <<'EOF'
/login|login card|data-testid="auth-login-card"
/login|login title|data-testid="auth-login-title"
/login|login form|data-testid="auth-login-form"
/login|login username input|data-testid="auth-login-username-input"
/login|login password input|data-testid="auth-login-password-input"
/login|login submit button|data-testid="auth-login-submit-button"
/login|login help banner|data-testid="auth-login-help-banner"
/register|register card|data-testid="auth-register-card"
/register|register title|data-testid="auth-register-title"
/register|register username input or disabled banner|data-testid="auth-register-username-input"|data-testid="auth-register-disabled-banner"
/register|register back link|data-testid="auth-register-back-link"
/register|register screen copy|Create Trial Account
/change-password|change-password card|data-testid="auth-change-password-card"
/change-password|change-password title|data-testid="auth-change-password-title"
/change-password|change-password user|data-testid="auth-change-password-user"
/change-password|change-password required or help banner|data-testid="auth-change-password-required-banner"|data-testid="auth-change-password-help-banner"
/change-password|change-password form|data-testid="auth-change-password-form"
/change-password|change-password current input|data-testid="auth-change-password-current-input"
/change-password|change-password new input|data-testid="auth-change-password-new-input"
/change-password|change-password confirm input|data-testid="auth-change-password-confirm-input"
/change-password|change-password submit button|data-testid="auth-change-password-submit-button"
/change-password|change-password logout button|data-testid="auth-change-password-logout-button"
EOF
}

automation_smoke_ops_checks() {
  cat <<'EOF'
/app|ops overview card|data-testid="ops-overview-card"
/app|ops overview header|data-testid="ops-overview-header"
/app|ops overview title|data-testid="ops-overview-title"
/app|ops overview actions|data-testid="ops-overview-actions"
/app|ops copy summary button|data-testid="ops-copy-summary-button"
/app|ops download overview button|data-testid="ops-download-overview-button"
/app|ops export deployments button|data-testid="ops-export-deployments-button"
/app|ops export servers button|data-testid="ops-export-servers-button"
/app|ops export templates button|data-testid="ops-export-templates-button"
/app|ops export activity button|data-testid="ops-export-activity-button"
/app|ops overview grid|data-testid="ops-overview-grid"
/app|ops deployments card|data-testid="ops-overview-deployments-card"
/app|ops servers card|data-testid="ops-overview-servers-card"
/app|ops activity card|data-testid="ops-overview-activity-card"
/app|ops templates card|data-testid="ops-overview-templates-card"
/app|ops capabilities card|data-testid="ops-overview-capabilities-card"
/app|ops attention list or empty banner|data-testid="ops-attention-list"|data-testid="ops-attention-empty-banner"
/app|ops smoke deployment count copy|Deployments
/app|ops smoke servers copy|Servers
/app|ops smoke activity copy|Activity
/app|ops smoke templates copy|Templates
/app|ops runtime posture copy|remote-only|mixed
EOF
}

automation_smoke_runtime_checks() {
  cat <<'EOF'
/app|runtime page title|data-testid="runtime-page-title"
/app|runtime smoke banner|data-testid="runtime-smoke-banner"
/app|runtime deployments section|data-testid="runtime-deployments-section"
/app|runtime deployments title|data-testid="runtime-deployments-title"
/app|runtime deployments list|data-testid="runtime-deployments-list"
/app|runtime deployment card|data-testid="runtime-deployment-card-smoke-deployment"
/app|runtime deployment details link|data-testid="runtime-deployment-details-link-smoke-deployment"
/app|runtime smoke copy|smoke-runtime
/deployments/smoke-deployment|runtime detail page title|data-testid="runtime-detail-page-title"
/deployments/smoke-deployment|runtime detail smoke banner|data-testid="runtime-detail-smoke-banner"
/deployments/smoke-deployment|runtime detail header actions|data-testid="runtime-detail-header-actions"
/deployments/smoke-deployment|runtime detail copy summary button|data-testid="runtime-detail-copy-summary-button"
/deployments/smoke-deployment|runtime detail overview grid|data-testid="runtime-detail-overview-grid"
/deployments/smoke-deployment|runtime detail endpoint card|data-testid="runtime-detail-endpoint-card"
/deployments/smoke-deployment|runtime detail runtime card|data-testid="runtime-detail-runtime-card"
/deployments/smoke-deployment|runtime detail health overview card|data-testid="runtime-detail-health-overview-card"
/deployments/smoke-deployment|runtime detail attention card|data-testid="runtime-detail-attention-card"
/deployments/smoke-deployment|runtime detail attention banner|data-testid="runtime-detail-attention-banner"
/deployments/smoke-deployment|runtime detail summary card|data-testid="runtime-detail-summary-card"
/deployments/smoke-deployment|runtime detail quick reference card|data-testid="runtime-detail-quick-reference-card"
/deployments/smoke-deployment|runtime detail quick reference title|data-testid="runtime-detail-quick-reference-title"
/deployments/smoke-deployment|runtime detail attention list card|data-testid="runtime-detail-attention-list-card"
/deployments/smoke-deployment|runtime detail attention list title|data-testid="runtime-detail-attention-list-title"
/deployments/smoke-deployment|runtime detail attention empty state or list|data-testid="runtime-detail-attention-empty-state"|data-testid="runtime-detail-attention-list"
/deployments/smoke-deployment|runtime detail diagnostics card|data-testid="runtime-detail-diagnostics-card"
/deployments/smoke-deployment|runtime detail diagnostics title|data-testid="runtime-detail-diagnostics-title"
/deployments/smoke-deployment|runtime detail diagnostics badges|data-testid="runtime-detail-diagnostics-badges"
/deployments/smoke-deployment|runtime detail health card|data-testid="runtime-detail-health-card"
/deployments/smoke-deployment|runtime detail logs card|data-testid="runtime-detail-logs-card"
/deployments/smoke-deployment|runtime detail activity card|data-testid="runtime-detail-activity-card"
/deployments/smoke-deployment|runtime detail activity title|data-testid="runtime-detail-activity-title"
/deployments/smoke-deployment|runtime detail smoke host copy|Smoke VPS
EOF
}
