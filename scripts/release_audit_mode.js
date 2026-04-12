#!/usr/bin/env node

"use strict";

function normalizeSelfTestAction(action) {
  return action && action !== "" ? action : "none";
}

function deriveSelfTestAuditMode({ eventName, selfTestAction, jobStatus }) {
  const normalizedSelfTestAction = normalizeSelfTestAction(selfTestAction);
  const isSelfTest = eventName === "workflow_dispatch" && normalizedSelfTestAction !== "none";
  let effectiveStatus = jobStatus;

  if (isSelfTest && normalizedSelfTestAction === "resolve") {
    effectiveStatus = "success";
  } else if (isSelfTest) {
    effectiveStatus = "failure";
  }

  return {
    self_test_action: normalizedSelfTestAction,
    effective_status: effectiveStatus,
    run_triage: String(isSelfTest),
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
  deriveSelfTestAuditMode,
};

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  printOutputs(deriveSelfTestAuditMode({
    eventName: options["event-name"],
    selfTestAction: options["self-test-action"],
    jobStatus: options["job-status"],
  }));

  process.exit(0);
}
