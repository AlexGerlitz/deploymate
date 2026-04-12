#!/usr/bin/env node

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { deriveSelfTestAuditMode } = require("./release_audit_mode.js");

test("self-test mode converts resolve into success triage", () => {
  const mode = deriveSelfTestAuditMode({
    eventName: "workflow_dispatch",
    selfTestAction: "resolve",
    jobStatus: "success",
  });

  assert.deepEqual(mode, {
    self_test_action: "resolve",
    effective_status: "success",
    run_triage: "true",
  });
});

test("self-test mode converts open into failure triage", () => {
  const mode = deriveSelfTestAuditMode({
    eventName: "workflow_dispatch",
    selfTestAction: "open",
    jobStatus: "success",
  });

  assert.deepEqual(mode, {
    self_test_action: "open",
    effective_status: "failure",
    run_triage: "true",
  });
});

test("self-test mode skips triage for regular manual audits", () => {
  const mode = deriveSelfTestAuditMode({
    eventName: "workflow_dispatch",
    selfTestAction: "none",
    jobStatus: "success",
  });

  assert.deepEqual(mode, {
    self_test_action: "none",
    effective_status: "success",
    run_triage: "false",
  });
});
