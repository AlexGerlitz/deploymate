#!/usr/bin/env node

"use strict";

function normalizeSelfTestAction(action) {
  return action && action !== "" ? action : "none";
}

function deriveInitialAuditMode({ eventName, matrixTargetEnvironment, selectedTargetEnvironment, incidentSelfTestAction }) {
  const selfTestAction = normalizeSelfTestAction(incidentSelfTestAction);
  const isSchedule = eventName === "schedule";
  const selectedTarget = isSchedule || matrixTargetEnvironment === selectedTargetEnvironment;
  const selfTestEnabled = eventName === "workflow_dispatch" && selfTestAction !== "none";

  return {
    selected_target: String(selectedTarget),
    self_test_action: selfTestAction,
    self_test_enabled: String(selfTestEnabled),
    run_remote_audit: String(selectedTarget && !selfTestEnabled),
    run_notify: String(selectedTarget && !selfTestEnabled),
  };
}

function deriveFinalAuditMode({ eventName, selectedTarget, selfTestAction, jobStatus }) {
  const normalizedSelfTestAction = normalizeSelfTestAction(selfTestAction);
  const isSelfTest = eventName === "workflow_dispatch" && normalizedSelfTestAction !== "none";
  let effectiveStatus = jobStatus;

  if (isSelfTest && normalizedSelfTestAction === "resolve") {
    effectiveStatus = "success";
  } else if (isSelfTest) {
    effectiveStatus = "failure";
  }

  return {
    selected_target: String(selectedTarget === true || selectedTarget === "true"),
    self_test_action: normalizedSelfTestAction,
    effective_status: effectiveStatus,
    run_triage: String((selectedTarget === true || selectedTarget === "true") && (eventName === "schedule" || isSelfTest)),
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !key.startsWith("--") || typeof value === "undefined") {
      throw new Error(`Invalid arguments near ${key || "<end>"}`);
    }
    options[key.slice(2)] = value;
  }
  return options;
}

function printOutputs(outputs) {
  for (const [key, value] of Object.entries(outputs)) {
    process.stdout.write(`${key}=${value}\n`);
  }
}

module.exports = {
  deriveInitialAuditMode,
  deriveFinalAuditMode,
};

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  if (options.phase === "initial") {
    printOutputs(deriveInitialAuditMode({
      eventName: options["event-name"],
      matrixTargetEnvironment: options["matrix-target-environment"],
      selectedTargetEnvironment: options["selected-target-environment"],
      incidentSelfTestAction: options["incident-self-test-action"],
    }));
    process.exit(0);
  }

  if (options.phase === "final") {
    printOutputs(deriveFinalAuditMode({
      eventName: options["event-name"],
      selectedTarget: options["selected-target"],
      selfTestAction: options["self-test-action"],
      jobStatus: options["job-status"],
    }));
    process.exit(0);
  }

  console.error("Usage: node scripts/release_audit_mode.js --phase <initial|final> ...");
  process.exit(1);
}
