#!/usr/bin/env node

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { triageReleaseAuditIncident } = require("./release_audit_incident.js");

function createHarness({ openIssues = [], workflowRuns = [], jobsByRunId = {} } = {}) {
  const state = {
    openIssues: openIssues.map((issue) => ({
      ...issue,
      assignees: issue.assignees || [],
      labels: issue.labels || [],
      state: issue.state || "open",
    })),
    workflowRuns,
    jobsByRunId,
    labels: new Set(["ci", "release"]),
    createdLabels: [],
    updatedIssues: [],
    comments: [],
    notices: [],
    createdIssues: [],
  };

  const github = {
    rest: {
      issues: {
        getLabel: async ({ name }) => {
          if (!state.labels.has(name)) {
            const error = new Error(`Label ${name} not found`);
            error.status = 404;
            throw error;
          }
          return { data: { name } };
        },
        createLabel: async ({ name, color, description }) => {
          state.labels.add(name);
          state.createdLabels.push({ name, color, description });
          return { data: { name } };
        },
        update: async (payload) => {
          state.updatedIssues.push(payload);
          return { data: payload };
        },
        createComment: async (payload) => {
          state.comments.push(payload);
          return { data: payload };
        },
        create: async (payload) => {
          const data = { number: 100 + state.createdIssues.length, ...payload };
          state.createdIssues.push(payload);
          return { data };
        },
        listForRepo: Symbol("listForRepo"),
      },
      actions: {
        listWorkflowRuns: Symbol("listWorkflowRuns"),
        listJobsForWorkflowRun: Symbol("listJobsForWorkflowRun"),
      },
    },
    paginate: async (method, params) => {
      if (method === github.rest.issues.listForRepo) {
        const wanted = (params.labels || "").split(",").filter(Boolean);
        return state.openIssues.filter((issue) => {
          const issueLabels = issue.labels.map((label) => typeof label === "string" ? label : label.name);
          return issue.state === "open" && wanted.every((label) => issueLabels.includes(label));
        });
      }

      if (method === github.rest.actions.listWorkflowRuns) {
        return state.workflowRuns;
      }

      if (method === github.rest.actions.listJobsForWorkflowRun) {
        return state.jobsByRunId[params.run_id] || [];
      }

      throw new Error("Unexpected paginate target");
    },
  };

  const context = {
    repo: { owner: "AlexGerlitz", repo: "deploymate" },
    ref: "refs/heads/develop",
    runId: 999,
  };

  const core = {
    notice(message) {
      state.notices.push(message);
    },
  };

  return { github, context, core, state };
}

test("opens a new self-test incident issue", async () => {
  const harness = createHarness();

  await triageReleaseAuditIncident({
    github: harness.github,
    context: harness.context,
    core: harness.core,
    env: {
      TARGET_ENVIRONMENT: "production",
      RUN_URL: "https://github.com/AlexGerlitz/deploymate/actions/runs/1",
      COMMIT_SHA: "abcdef1234567890",
      REF_NAME: "develop",
      JOB_STATUS: "failure",
      INCIDENT_SELF_TEST_ACTION: "open",
      INCIDENT_FAILURE_THRESHOLD: "3",
    },
  });

  assert.equal(harness.state.createdIssues.length, 1);
  assert.equal(
    harness.state.createdIssues[0].title,
    "[release-secrets-audit:self-test] production scheduled audit incident flow"
  );
  assert.deepEqual(harness.state.createdIssues[0].labels, [
    "ci",
    "release",
    "incident",
    "incident:test",
    "severity:medium",
  ]);
});

test("updates existing self-test issue and escalates severity", async () => {
  const harness = createHarness({
    openIssues: [
      {
        number: 14,
        title: "[release-secrets-audit:self-test] production scheduled audit incident flow",
        labels: ["ci", "release", "incident", "incident:test", "severity:medium"],
        assignees: [],
      },
    ],
  });

  await triageReleaseAuditIncident({
    github: harness.github,
    context: harness.context,
    core: harness.core,
    env: {
      TARGET_ENVIRONMENT: "production",
      RUN_URL: "https://github.com/AlexGerlitz/deploymate/actions/runs/2",
      COMMIT_SHA: "abcdef1234567890",
      REF_NAME: "develop",
      JOB_STATUS: "failure",
      INCIDENT_SELF_TEST_ACTION: "update",
      INCIDENT_FAILURE_THRESHOLD: "3",
    },
  });

  assert.equal(harness.state.updatedIssues.length, 1);
  assert.deepEqual(harness.state.updatedIssues[0].labels, [
    "ci",
    "release",
    "incident",
    "incident:test",
    "severity:high",
  ]);
  assert.equal(harness.state.comments.length, 1);
  assert.match(harness.state.comments[0].body, /Self-test action: `update`/);
});

test("closes an existing self-test incident issue on resolve", async () => {
  const harness = createHarness({
    openIssues: [
      {
        number: 14,
        title: "[release-secrets-audit:self-test] production scheduled audit incident flow",
        labels: ["ci", "release", "incident", "incident:test", "severity:high"],
        assignees: [],
      },
    ],
  });

  await triageReleaseAuditIncident({
    github: harness.github,
    context: harness.context,
    core: harness.core,
    env: {
      TARGET_ENVIRONMENT: "production",
      RUN_URL: "https://github.com/AlexGerlitz/deploymate/actions/runs/3",
      COMMIT_SHA: "abcdef1234567890",
      REF_NAME: "develop",
      JOB_STATUS: "success",
      INCIDENT_SELF_TEST_ACTION: "resolve",
      INCIDENT_FAILURE_THRESHOLD: "3",
    },
  });

  assert.equal(harness.state.comments.length, 1);
  assert.match(harness.state.comments[0].body, /resolved successfully/);
  assert.equal(harness.state.updatedIssues.length, 1);
  assert.equal(harness.state.updatedIssues[0].state, "closed");
});

test("opens a scheduled incident using the observed failure streak", async () => {
  const harness = createHarness({
    workflowRuns: [
      { id: 999 },
      { id: 1001 },
      { id: 1002 },
    ],
    jobsByRunId: {
      1001: [{ name: "audit (production)", status: "completed", conclusion: "failure" }],
      1002: [{ name: "audit (production)", status: "completed", conclusion: "success" }],
    },
  });

  await triageReleaseAuditIncident({
    github: harness.github,
    context: harness.context,
    core: harness.core,
    env: {
      TARGET_ENVIRONMENT: "production",
      RUN_URL: "https://github.com/AlexGerlitz/deploymate/actions/runs/4",
      COMMIT_SHA: "abcdef1234567890",
      REF_NAME: "develop",
      JOB_STATUS: "failure",
      INCIDENT_SELF_TEST_ACTION: "none",
      INCIDENT_FAILURE_THRESHOLD: "3",
    },
  });

  assert.equal(harness.state.createdIssues.length, 1);
  assert.match(harness.state.createdIssues[0].body, /Consecutive scheduled failures: `2`/);
  assert.deepEqual(harness.state.createdIssues[0].labels, [
    "ci",
    "release",
    "incident",
    "severity:medium",
  ]);
});
