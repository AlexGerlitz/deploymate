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
/app|workspace scenario card|data-testid="workspace-scenario-card"
/app|workspace scenario title|data-testid="workspace-scenario-title"
/app|workspace scenario grid|data-testid="workspace-scenario-grid"
/app|workspace scenario deploy action|data-testid="workspace-scenario-action-deploy"
/app|workspace scenario runtime action|data-testid="workspace-scenario-action-runtime"
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
/deployments/smoke-deployment|runtime detail handoff card|data-testid="runtime-detail-handoff-card"
/deployments/smoke-deployment|runtime detail plain summary button|data-testid="runtime-detail-copy-plain-summary-button"
/deployments/smoke-deployment|runtime detail snapshot button|data-testid="runtime-detail-download-snapshot-button"
/deployments/smoke-deployment|runtime detail handoff download button|data-testid="runtime-detail-download-handoff-button"
/deployments/smoke-deployment|runtime detail next step|data-testid="runtime-detail-next-step"
/deployments/smoke-deployment|runtime detail delete review button|data-testid="runtime-detail-delete-review-button"
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
/deployments/smoke-deployment|runtime detail activity search|data-testid="runtime-detail-activity-search"
/deployments/smoke-deployment|runtime detail activity level filter|data-testid="runtime-detail-activity-level-filter"
/deployments/smoke-deployment|runtime detail activity sort|data-testid="runtime-detail-activity-sort"
/deployments/smoke-deployment|runtime detail activity export|data-testid="runtime-detail-activity-export-button"
/deployments/smoke-deployment|runtime detail activity summary|data-testid="runtime-detail-activity-summary"
/deployments/smoke-deployment|runtime detail smoke host copy|Smoke VPS
EOF
}

automation_smoke_admin_checks() {
  cat <<'EOF'
/register|register copy|Create Trial Account|Public signup is not enabled
/app/users|users page title|data-testid="users-page-title"
/app/users|users primary action button|data-testid="users-primary-action-button"
/app/users|backup panel title|data-testid="backup-panel-title"
/app/users|admin smoke banner|data-testid="admin-smoke-banner"
/app/users|users refresh button|data-testid="users-refresh-button"
/app/users|users copy link button|data-testid="users-copy-link-button"
/app/users|users export button|data-testid="users-export-button"
/app/users|users audit export button|data-testid="users-audit-export-button"
/app/users|users audit search|data-testid="users-audit-search"
/app/users|users audit scope filter|data-testid="users-audit-scope-filter"
/app/users|users audit sort|data-testid="users-audit-sort"
/app/users|users audit copy link button|data-testid="users-audit-copy-link-button"
/app/users|users audit current export button|data-testid="users-audit-current-export-button"
/app/users|users audit reset button|data-testid="users-audit-reset-button"
/app/users|users save audit view button|data-testid="users-save-audit-view-button"
/app/users|users audit views list|data-testid="users-audit-views-list"
/app/users|users reset filters button|data-testid="users-reset-filters-button"
/app/users|users copy filter link button|data-testid="users-copy-filter-link-button"
/app/users|users save view button|data-testid="users-save-view-button"
/app/users|users update current view button|data-testid="users-update-current-view-button"
/app/users|users saved views list|data-testid="users-saved-views-list"
/app/users|users saved views search|data-testid="users-saved-views-search"
/app/users|users saved views source filter|data-testid="users-saved-views-source-filter"
/app/users|users saved views sort|data-testid="users-saved-views-sort"
/app/users|users export saved views button|data-testid="users-export-saved-views-button"
/app/users|users import saved views button|data-testid="users-import-saved-views-button"
/app/users|users clear saved views button|data-testid="users-clear-saved-views-button"
/app/users|users clear imported saved views button|data-testid="users-clear-imported-saved-views-button"
/app/users|users reset saved views tools button|data-testid="users-reset-saved-views-tools-button"
/app/users|users bulk selection summary|data-testid="users-bulk-selection-summary"
/app/users|users bulk card|data-testid="users-bulk-card"
/app/users|users bulk title|data-testid="users-bulk-title"
/app/users|users bulk stats|data-testid="users-bulk-stats"
/app/users|users bulk presets|data-testid="users-bulk-presets"
/app/users|users bulk action summary|data-testid="users-bulk-action-summary"
/app/users|users bulk select visible button|data-testid="users-bulk-select-visible-button"
/app/users|users bulk clear selection button|data-testid="users-bulk-clear-selection-button"
/app/users|users bulk export selection button|data-testid="users-bulk-export-selection-button"
/app/users|users bulk export filtered button|data-testid="users-bulk-export-filtered-button"
/app/users|users bulk select admins button|data-testid="users-bulk-select-admins-button"
/app/users|users bulk select members button|data-testid="users-bulk-select-members-button"
/app/users|users bulk select password required button|data-testid="users-bulk-select-password-required-button"
/app/users|users bulk select current filter button|data-testid="users-bulk-select-current-filter-button"
/app/users|users bulk reset tools button|data-testid="users-bulk-reset-tools-button"
/app/users|users bulk preset admin button|data-testid="users-bulk-preset-admin-button"
/app/users|users bulk preset team button|data-testid="users-bulk-preset-team-button"
/app/users|users bulk preset trial button|data-testid="users-bulk-preset-trial-button"
/app/users|users bulk role select|data-testid="users-bulk-role-select"
/app/users|users bulk role apply button|data-testid="users-bulk-role-apply-button"
/app/users|users bulk plan select|data-testid="users-bulk-plan-select"
/app/users|users bulk plan apply button|data-testid="users-bulk-plan-apply-button"
/app/users|users update current view copy|Update current view
/app/users|users saved views storage copy|Loaded from local browser storage|Using local browser storage
/app/users|restore dry run button|data-testid="restore-dry-run-button"
/app/users|restore report json button|data-testid="restore-report-json-button"
/app/users|restore report csv button|data-testid="restore-report-csv-button"
/app/users|backup download bundle button|data-testid="backup-download-bundle-button"
/app/users|backup paste sample button|data-testid="backup-paste-sample-button"
/app/users|backup upload file input|data-testid="backup-upload-file-input"
/app/users|backup clear bundle button|data-testid="backup-clear-bundle-button"
/app/users|backup preflight banner|data-testid="backup-preflight-banner"
/app/users|restore dry run disabled|data-testid="restore-dry-run-button"[^>]*disabled
/app/users|restore report json disabled|data-testid="restore-report-json-button"[^>]*disabled
/app/users|restore report csv disabled|data-testid="restore-report-csv-button"[^>]*disabled
/app/upgrade-requests|upgrade requests page title|data-testid="upgrade-requests-page-title"
/app/upgrade-requests|upgrade primary action button|data-testid="upgrade-primary-action-button"
/app/upgrade-requests|upgrade smoke banner|data-testid="admin-smoke-banner"
/app/upgrade-requests|upgrade refresh button|data-testid="upgrade-refresh-button"
/app/upgrade-requests|upgrade main next step card|data-testid="upgrade-main-next-step-card"
/app/upgrade-requests|upgrade main next step title|data-testid="upgrade-main-next-step-title"
/app/upgrade-requests|upgrade main next step focus|data-testid="upgrade-main-next-step-focus"
/app/upgrade-requests|upgrade main next step copy|data-testid="upgrade-main-next-step-copy"
/app/upgrade-requests|upgrade main next step button|data-testid="upgrade-main-next-step-button"
/app/upgrade-requests|upgrade main next step copy button|data-testid="upgrade-main-next-step-copy-button"
/app/upgrade-requests|upgrade copy link button|data-testid="upgrade-copy-link-button"
/app/upgrade-requests|upgrade export button|data-testid="upgrade-export-button"
/app/upgrade-requests|upgrade audit search|data-testid="upgrade-audit-search"
/app/upgrade-requests|upgrade audit sort|data-testid="upgrade-audit-sort"
/app/upgrade-requests|upgrade audit copy link button|data-testid="upgrade-audit-copy-link-button"
/app/upgrade-requests|upgrade audit current export button|data-testid="upgrade-audit-current-export-button"
/app/upgrade-requests|upgrade audit reset button|data-testid="upgrade-audit-reset-button"
/app/upgrade-requests|upgrade save audit view button|data-testid="upgrade-save-audit-view-button"
/app/upgrade-requests|upgrade audit views list|data-testid="upgrade-audit-views-list"
/app/upgrade-requests|upgrade audit presets copy|Audit presets are stored separately from the main inbox saved views
/app/upgrade-requests|upgrade reset filters button|data-testid="upgrade-reset-filters-button"
/app/upgrade-requests|upgrade copy filter link button|data-testid="upgrade-copy-filter-link-button"
/app/upgrade-requests|upgrade save view button|data-testid="upgrade-save-view-button"
/app/upgrade-requests|upgrade update current view button|data-testid="upgrade-update-current-view-button"
/app/upgrade-requests|upgrade saved views list|data-testid="upgrade-saved-views-list"
/app/upgrade-requests|upgrade saved views search|data-testid="upgrade-saved-views-search"
/app/upgrade-requests|upgrade saved views source filter|data-testid="upgrade-saved-views-source-filter"
/app/upgrade-requests|upgrade saved views sort|data-testid="upgrade-saved-views-sort"
/app/upgrade-requests|upgrade export saved views button|data-testid="upgrade-export-saved-views-button"
/app/upgrade-requests|upgrade import saved views button|data-testid="upgrade-import-saved-views-button"
/app/upgrade-requests|upgrade clear saved views button|data-testid="upgrade-clear-saved-views-button"
/app/upgrade-requests|upgrade clear imported saved views button|data-testid="upgrade-clear-imported-saved-views-button"
/app/upgrade-requests|upgrade reset saved views tools button|data-testid="upgrade-reset-saved-views-tools-button"
/app/upgrade-requests|upgrade bulk selection summary|data-testid="upgrade-bulk-selection-summary"
/app/upgrade-requests|upgrade bulk card|data-testid="upgrade-bulk-card"
/app/upgrade-requests|upgrade bulk title|data-testid="upgrade-bulk-title"
/app/upgrade-requests|upgrade bulk stats|data-testid="upgrade-bulk-stats"
/app/upgrade-requests|upgrade bulk presets|data-testid="upgrade-bulk-presets"
/app/upgrade-requests|upgrade bulk action summary|data-testid="upgrade-bulk-action-summary"
/app/upgrade-requests|upgrade bulk select visible button|data-testid="upgrade-bulk-select-visible-button"
/app/upgrade-requests|upgrade bulk clear selection button|data-testid="upgrade-bulk-clear-selection-button"
/app/upgrade-requests|upgrade bulk export selection button|data-testid="upgrade-bulk-export-selection-button"
/app/upgrade-requests|upgrade bulk export filtered button|data-testid="upgrade-bulk-export-filtered-button"
/app/upgrade-requests|upgrade bulk select new button|data-testid="upgrade-bulk-select-new-button"
/app/upgrade-requests|upgrade bulk select review button|data-testid="upgrade-bulk-select-review-button"
/app/upgrade-requests|upgrade bulk select linked button|data-testid="upgrade-bulk-select-linked-button"
/app/upgrade-requests|upgrade bulk select current filter button|data-testid="upgrade-bulk-select-current-filter-button"
/app/upgrade-requests|upgrade bulk reset tools button|data-testid="upgrade-bulk-reset-tools-button"
/app/upgrade-requests|upgrade bulk preset review button|data-testid="upgrade-bulk-preset-review-button"
/app/upgrade-requests|upgrade bulk preset close button|data-testid="upgrade-bulk-preset-close-button"
/app/upgrade-requests|upgrade bulk preset reject button|data-testid="upgrade-bulk-preset-reject-button"
/app/upgrade-requests|upgrade bulk status select|data-testid="upgrade-bulk-status-select"
/app/upgrade-requests|upgrade bulk status apply button|data-testid="upgrade-bulk-status-apply-button"
/app/upgrade-requests|upgrade update current view copy|Update current view
/app/upgrade-requests|upgrade saved views storage copy|Loaded from local browser storage|Using local browser storage
EOF
}

automation_smoke_admin_interactions_checks() {
  cat <<'EOF'
/app/users|users saved view name|Admins only
/app/users|users active saved view badge|Current
/app/users|users saved views meta copy|Loaded from local browser storage\.
/app/users|users audit saved view|User actions
/app/users|users bulk card|data-testid="users-bulk-card"
/app/users|users bulk action summary surface|data-testid="users-bulk-action-summary"
/app/users|users current filter button|data-testid="users-bulk-select-current-filter-button"
/app/users|users update current view button|data-testid="users-update-current-view-button"
/app/upgrade-requests|upgrade saved view name|In review queue
/app/upgrade-requests|upgrade active saved view badge|Current
/app/upgrade-requests|upgrade saved views meta copy|Loaded from local browser storage\.
/app/upgrade-requests|upgrade audit saved view|Newest approvals
/app/upgrade-requests|upgrade bulk card|data-testid="upgrade-bulk-card"
/app/upgrade-requests|upgrade bulk action summary surface|data-testid="upgrade-bulk-action-summary"
/app/upgrade-requests|upgrade current filter button|data-testid="upgrade-bulk-select-current-filter-button"
/app/upgrade-requests|upgrade update current view button|data-testid="upgrade-update-current-view-button"
EOF
}

automation_smoke_restore_checks() {
  cat <<'EOF'
/app/users|restore report surface|data-testid="restore-report"
/app/users|restore summary badges|data-testid="restore-summary-badges"
/app/users|restore preparation overview|data-testid="restore-preparation-overview"
/app/users|restore readiness card|data-testid="restore-readiness-card"
/app/users|restore next step card|data-testid="restore-next-step-card"
/app/users|restore preparation mix card|data-testid="restore-preparation-mix-card"
/app/users|restore summary digest|data-testid="restore-summary-digest"
/app/users|restore preparation card|data-testid="restore-preparation-card"
/app/users|restore preparation title|data-testid="restore-preparation-title"
/app/users|restore plain language summary|data-testid="restore-plain-language-summary"
/app/users|restore next step summary|data-testid="restore-next-step-summary"
/app/users|restore preparation mix summary|data-testid="restore-preparation-mix-summary"
/app/users|restore copy preparation button|data-testid="restore-copy-preparation-button"
/app/users|restore preparation markdown button|data-testid="restore-preparation-markdown-button"
/app/users|restore visible sections csv button|data-testid="restore-visible-sections-csv-button"
/app/users|restore attention overview|data-testid="restore-attention-overview"
/app/users|restore issues csv button|data-testid="restore-report-issues-csv-button"
/app/users|restore copy summary button|data-testid="restore-copy-summary-button"
/app/users|restore import plan button|data-testid="restore-import-plan-button"
/app/users|restore import plan card|data-testid="restore-import-plan-card"
/app/users|restore import plan title|data-testid="restore-import-plan-title"
/app/users|restore import plan overview|data-testid="restore-import-plan-overview"
/app/users|restore import plan scope summary|data-testid="restore-import-plan-scope-summary"
/app/users|restore import plan reviewer guidance|data-testid="restore-import-plan-reviewer-guidance"
/app/users|restore import plan confirmation|data-testid="restore-import-plan-confirmation"
/app/users|restore import plan json button|data-testid="restore-import-plan-json-button"
/app/users|restore import plan markdown button|data-testid="restore-import-plan-markdown-button"
/app/users|restore open import review button|data-testid="restore-open-import-review-button"
/app/users|restore import review handoff note|data-testid="restore-import-review-handoff-note"
/app/users|restore import plan sections|data-testid="restore-import-plan-sections"
/app/users|restore section filter|data-testid="restore-section-filter"
/app/users|restore section search|data-testid="restore-section-search"
/app/users|restore high risk filter|data-testid="restore-high-risk-filter"
/app/users|restore visible sections summary|data-testid="restore-visible-sections-summary"
/app/users|restore manifest counts|data-testid="restore-manifest-counts"
/app/users|restore section chips|data-testid="restore-section-chips"
/app/users|restore users section|data-testid="restore-section-users"
/app/users|restore servers section|data-testid="restore-section-servers"
/app/users|restore deployments section|data-testid="restore-section-deployments"
/app/users|restore users mode|data-testid="restore-section-mode-users"
/app/users|restore deployments action|data-testid="restore-section-action-deployments"
/app/users|restore readiness copy|This backup is not ready for any real import work yet
/app/users|restore next step copy|Resolve the blocked sections first
/app/users|restore digest copy|priority: users, servers, deployment_templates
/app/users|restore issues copy|Server credentials and host trust must be reviewed before any import\.
/app/users|restore issues csv label|Issues CSV
EOF
}

automation_smoke_servers_checks() {
  cat <<'EOF'
/app/server-review|server review primary action button|data-testid="server-review-primary-action-button"
/app|servers card|data-testid="servers-card"
/app|servers title|data-testid="servers-title"
/app|servers search input|data-testid="servers-search-input"|data-testid="servers-restricted-banner"
/app|servers create form or restricted banner|data-testid="servers-create-form"|data-testid="servers-restricted-banner"
/app|servers create name input|data-testid="servers-create-name-input"|data-testid="servers-restricted-banner"
/app|servers create host input|data-testid="servers-create-host-input"|data-testid="servers-restricted-banner"
/app|servers create port input|data-testid="servers-create-port-input"|data-testid="servers-restricted-banner"
/app|servers create username input|data-testid="servers-create-username-input"|data-testid="servers-restricted-banner"
/app|servers create auth input|data-testid="servers-create-auth-type-input"|data-testid="servers-restricted-banner"
/app|servers create ssh key input|data-testid="servers-create-ssh-key-input"|data-testid="servers-restricted-banner"
/app|servers create submit button|data-testid="servers-create-submit-button"|data-testid="servers-restricted-banner"
/app|servers list|data-testid="servers-list"|data-testid="servers-restricted-banner"
/app|smoke server card or restricted banner|data-testid="server-card-smoke-server"|data-testid="servers-restricted-banner"
/app|server test button or restricted banner|data-testid="server-test-button-smoke-server"|data-testid="servers-restricted-banner"
/app|server diagnostics button or restricted banner|data-testid="server-diagnostics-button-smoke-server"|data-testid="servers-restricted-banner"
/app|server delete button or restricted banner|data-testid="server-delete-button-smoke-server"|data-testid="servers-restricted-banner"
/app|server diagnostics summary or restricted banner|data-testid="server-diagnostics-summary-smoke-server"|data-testid="servers-restricted-banner"
/app|server diagnostics meta or restricted banner|data-testid="server-diagnostics-meta-smoke-server"|data-testid="servers-restricted-banner"
/app|smoke server copy|Smoke VPS
/app|smoke server host copy|203\.0\.113\.10
EOF
}

automation_smoke_templates_checks() {
  cat <<'EOF'
/app|templates card|data-testid="templates-card"
/app|templates section title|data-testid="templates-section-title"
/app|templates filter tabs|data-testid="templates-filter-tabs"
/app|templates filter all|data-testid="templates-filter-all"
/app|templates filter unused|data-testid="templates-filter-unused"
/app|templates filter recent|data-testid="templates-filter-recent"
/app|templates filter popular|data-testid="templates-filter-popular"
/app|templates search input|data-testid="templates-search-input"
/app|templates list|data-testid="templates-list"
/app|smoke template card|data-testid="template-card-smoke-template"
/app|template preview button|data-testid="template-preview-button-smoke-template"
/app|template deploy button|data-testid="template-deploy-button-smoke-template"
/app|template edit button|data-testid="template-edit-button-smoke-template"
/app|template duplicate button|data-testid="template-duplicate-button-smoke-template"
/app|template delete button|data-testid="template-delete-button-smoke-template"
/app|smoke template copy|Smoke template
/app|smoke image copy|nginx:alpine
/app|template preview card|data-testid="template-preview-card"
/app|template preview title|data-testid="template-preview-title"
/app|template preview content|data-testid="template-preview-diff-list"|data-testid="template-preview-match-banner"
/app|template preview actions|data-testid="template-preview-actions"
/app|template preview apply button|data-testid="template-preview-apply-button"
/app|template preview edit button|data-testid="template-preview-edit-button"
/app|template preview deploy button|data-testid="template-preview-deploy-button"
/app|create deployment card|data-testid="create-deployment-card"
/app|create deployment title|data-testid="create-deployment-title"
/app|template name input|data-testid="create-template-name-input"
/app|save template button|data-testid="create-save-template-button"
/app|create deployment button|data-testid="create-deployment-submit-button"
/app|template helper copy|Save the current image, name, ports, server, and env vars as a reusable preset\.
EOF
}
