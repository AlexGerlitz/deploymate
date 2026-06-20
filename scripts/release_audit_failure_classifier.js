#!/usr/bin/env node

"use strict";

const fs = require("node:fs");

const CLASSIFIERS = [
  {
    category: "ssh_host_key_changed",
    matches: ["remote host identification has changed"],
    hint: "Confirm the target host rebuild or rotation, refresh the pinned DEPLOY_SSH_KNOWN_HOSTS secret, then rerun the audit.",
  },
  {
    category: "ssh_host_key_verification_failed",
    matches: ["host key verification failed"],
    hint: "Refresh the pinned known_hosts entry for the deploy host after confirming the fingerprint through an owner-controlled path.",
  },
  {
    category: "ssh_auth_denied",
    matches: ["permission denied (publickey,password)", "permission denied, please try again"],
    hint: "The deploy host accepted the SSH trust anchor but rejected the deploy key; restore the matching public key in authorized_keys or rotate DEPLOY_SSH_PRIVATE_KEY.",
  },
  {
    category: "ssh_connectivity_timeout",
    matches: ["operation timed out", "connection timed out"],
    hint: "The runner could not reach SSH on the deploy host; check host, firewall, provider network, and port 22 reachability.",
  },
  {
    category: "ssh_connectivity_refused",
    matches: ["connection refused"],
    hint: "The deploy host is reachable but SSH refused the connection; check sshd status, port, firewall, and provider security rules.",
  },
  {
    category: "ssh_dns_failed",
    matches: ["could not resolve hostname", "name or service not known", "temporary failure in name resolution"],
    hint: "The deploy host name does not resolve from GitHub Actions; check DEPLOY_HOST and DNS.",
  },
  {
    category: "missing_runtime_env_file",
    matches: ["missing env file:"],
    hint: "The target runtime env file is missing at the configured DEPLOY_ENV_FILE path on the deploy host.",
  },
  {
    category: "runtime_admin_password_missing",
    matches: ["target env file is missing deploymate_admin_password"],
    hint: "Set DEPLOYMATE_ADMIN_PASSWORD in the target runtime env file before running release smoke checks.",
  },
  {
    category: "runtime_admin_username_mismatch",
    matches: ["target admin username does not match provided smoke credentials"],
    hint: "Align DEPLOYMATE_ADMIN_USERNAME in the runtime env file with the GitHub environment smoke credential secret.",
  },
  {
    category: "runtime_admin_password_mismatch",
    matches: ["target admin password does not match provided smoke credentials"],
    hint: "Align DEPLOYMATE_ADMIN_PASSWORD in the runtime env file with the GitHub environment smoke credential secret.",
  },
  {
    category: "missing_workflow_input",
    matches: ["missing required value:", "missing deploy_ssh_private_key", "missing deploy_ssh_known_hosts"],
    hint: "One required release audit input or GitHub environment secret is missing.",
  },
];

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function sanitizeOutputValue(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function classifyReleaseAuditFailure({ exitCode, logText }) {
  const numericExitCode = Number(exitCode);
  if (numericExitCode === 0) {
    return {
      audit_status: "success",
      failure_category: "none",
      operator_hint: "Release secret contract audit passed.",
    };
  }

  const normalizedLog = normalizeText(logText);
  const matched = CLASSIFIERS.find((classifier) =>
    classifier.matches.some((pattern) => normalizedLog.includes(pattern))
  );

  if (matched) {
    return {
      audit_status: "failure",
      failure_category: matched.category,
      operator_hint: matched.hint,
    };
  }

  return {
    audit_status: "failure",
    failure_category: "unknown_failure",
    operator_hint: "Open the failed audit step log and classify the release secret contract failure manually.",
  };
}

function parseArgs(argv) {
  const options = {
    format: "github-output",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key || !key.startsWith("--")) {
      throw new Error(`Invalid argument near ${key || "<end>"}`);
    }

    const optionName = key.slice(2);
    const nextValue = argv[index + 1];
    if (typeof nextValue === "undefined" || nextValue.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }

    options[optionName] = nextValue;
    index += 1;
  }

  if (typeof options["exit-code"] === "undefined") {
    throw new Error("--exit-code is required");
  }

  return options;
}

function renderResult(result, format) {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  if (format === "human") {
    return [
      `[release-audit-classifier] audit_status=${result.audit_status}`,
      `[release-audit-classifier] failure_category=${result.failure_category}`,
      `[release-audit-classifier] operator_hint=${result.operator_hint}`,
      "",
    ].join("\n");
  }

  if (format === "github-output" || format === "shell") {
    return Object.entries(result)
      .map(([key, value]) => `${key}=${sanitizeOutputValue(value)}`)
      .join("\n") + "\n";
  }

  throw new Error(`Unsupported format: ${format}`);
}

module.exports = {
  classifyReleaseAuditFailure,
  renderResult,
};

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const logFile = options["log-file"];
    const logText = logFile ? fs.readFileSync(logFile, "utf8") : "";
    const result = classifyReleaseAuditFailure({
      exitCode: options["exit-code"],
      logText,
    });
    process.stdout.write(renderResult(result, options.format));
  } catch (error) {
    console.error(`[release-audit-classifier] ${error.message}`);
    process.exit(2);
  }
}
