#!/usr/bin/env node

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { deriveInitialAuditMode, deriveFinalAuditMode } = require("./release_audit_mode.js");

test("initial mode selects scheduled runs for every matrix target", () => {
  const mode = deriveInitialAuditMode({
    eventName: "schedule",
    matrixTargetEnvironment: "staging",
    selectedTargetEnvironment: "production",
    incidentSelfTestAction: "none",
  });

  assert.deepEqual(mode, {
    selected_target: "true",
    self_test_action: "none",
    self_test_enabled: "false",
    run_remote_audit: "true",
    run_notify: "true",
  });
});

test("initial mode disables remote audit during manual self-test", () => {
  const mode = deriveInitialAuditMode({
    eventName: "workflow_dispatch",
    matrixTargetEnvironment: "production",
    selectedTargetEnvironment: "production",
    incidentSelfTestAction: "open",
  });

  assert.deepEqual(mode, {
    selected_target: "true",
    self_test_action: "open",
    self_test_enabled: "true",
    run_remote_audit: "false",
    run_notify: "false",
  });
});

test("initial mode skips non-selected matrix targets for manual audit", () => {
  const mode = deriveInitialAuditMode({
    eventName: "workflow_dispatch",
    matrixTargetEnvironment: "staging",
    selectedTargetEnvironment: "production",
    incidentSelfTestAction: "none",
  });

  assert.deepEqual(mode, {
    selected_target: "false",
    self_test_action: "none",
    self_test_enabled: "false",
    run_remote_audit: "false",
    run_notify: "false",
  });
});

test("final mode converts self-test resolve into success triage", () => {
  const mode = deriveFinalAuditMode({
    eventName: "workflow_dispatch",
    selectedTarget: "true",
    selfTestAction: "resolve",
    jobStatus: "success",
  });

  assert.deepEqual(mode, {
    selected_target: "true",
    self_test_action: "resolve",
    effective_status: "success",
    run_triage: "true",
  });
});

test("final mode converts self-test open into failure triage", () => {
  const mode = deriveFinalAuditMode({
    eventName: "workflow_dispatch",
    selectedTarget: "true",
    selfTestAction: "open",
    jobStatus: "success",
  });

  assert.deepEqual(mode, {
    selected_target: "true",
    self_test_action: "open",
    effective_status: "failure",
    run_triage: "true",
  });
});

test("final mode skips triage for non-selected manual matrix targets", () => {
  const mode = deriveFinalAuditMode({
    eventName: "workflow_dispatch",
    selectedTarget: "false",
    selfTestAction: "none",
    jobStatus: "success",
  });

  assert.deepEqual(mode, {
    selected_target: "false",
    self_test_action: "none",
    effective_status: "success",
    run_triage: "false",
  });
});
