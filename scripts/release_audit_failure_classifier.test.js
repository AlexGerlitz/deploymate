#!/usr/bin/env node

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyReleaseAuditFailure,
  renderResult,
} = require("./release_audit_failure_classifier.js");

test("classifies a successful audit", () => {
  assert.deepEqual(classifyReleaseAuditFailure({ exitCode: 0, logText: "" }), {
    audit_status: "success",
    failure_category: "none",
    operator_hint: "Release secret contract audit passed.",
  });
});

test("classifies SSH host key drift", () => {
  const result = classifyReleaseAuditFailure({
    exitCode: 255,
    logText: "WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!\nHost key verification failed.",
  });

  assert.equal(result.audit_status, "failure");
  assert.equal(result.failure_category, "ssh_host_key_changed");
  assert.match(result.operator_hint, /refresh the pinned DEPLOY_SSH_KNOWN_HOSTS secret/);
});

test("classifies SSH auth denial after trust succeeds", () => {
  const result = classifyReleaseAuditFailure({
    exitCode: 255,
    logText: "Permission denied, please try again.\nroot@host: Permission denied (publickey,password).",
  });

  assert.equal(result.failure_category, "ssh_auth_denied");
  assert.match(result.operator_hint, /authorized_keys/);
});

test("classifies runtime credential drift", () => {
  const result = classifyReleaseAuditFailure({
    exitCode: 1,
    logText: "[release-secret-contract] target admin password does not match provided smoke credentials",
  });

  assert.equal(result.failure_category, "runtime_admin_password_mismatch");
});

test("renders GitHub output without multiline values", () => {
  const output = renderResult({
    audit_status: "failure",
    failure_category: "unknown_failure",
    operator_hint: "line one\nline two",
  }, "github-output");

  assert.match(output, /^audit_status=failure$/m);
  assert.match(output, /^failure_category=unknown_failure$/m);
  assert.match(output, /^operator_hint=line one line two$/m);
});
