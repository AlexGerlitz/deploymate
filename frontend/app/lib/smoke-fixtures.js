export const smokeMode = process.env.NEXT_PUBLIC_SMOKE_TEST_MODE === "1";
const smokeUserRole = process.env.NEXT_PUBLIC_SMOKE_USER_ROLE === "member" ? "member" : "admin";

export const smokeUser =
  smokeUserRole === "member"
    ? {
        id: "smoke-member",
        username: "smoke-member",
        is_admin: false,
        role: "member",
        plan: "trial",
        limits: {
          max_servers: 1,
          max_deployments: 3,
        },
        usage: {
          servers: 0,
          deployments: 0,
        },
      }
    : {
        id: "smoke-admin",
        username: "smoke-admin",
        is_admin: true,
        role: "admin",
        plan: "team",
        limits: {
          max_servers: 10,
          max_deployments: 100,
        },
        usage: {
          servers: 1,
          deployments: 1,
        },
      };

export const smokeOverviewDeployments = [];

export const smokeOverviewServers = [];

export const smokeOverviewNotifications = [];

export const smokeOverviewTemplates = [];

export const smokeOverviewOpsOverview = {
  generated_at: "2026-04-07T00:02:00Z",
  user: {
    username: smokeUser.username,
    plan: smokeUser.plan,
    role: smokeUser.role,
  },
  deployments: {
    total: 0,
    running: 0,
    failed: 0,
    pending: 0,
    local: 0,
    remote: 0,
    exposed: 0,
    public_urls: 0,
  },
  servers: {
    total: 0,
    password_auth: 0,
    ssh_key_auth: 0,
    unused: 0,
  },
  notifications: {
    total: 0,
    success: 0,
    error: 0,
    latest_error_title: null,
    latest_error_at: null,
  },
  templates: {
    total: 0,
    unused: 0,
    recently_used: 0,
    top_template_name: null,
    top_template_use_count: 0,
  },
  capabilities: {
    local_docker_enabled: false,
    ssh_host_key_checking: "yes",
    strict_known_hosts_configured: true,
    server_credentials_key_configured: true,
    remote_only_recommended: true,
  },
  host_runtime: {
    root_disk_status: "warn",
    root_disk_usage_percent: 86,
    root_disk_free: "7G",
    root_disk_detail: "7G free on /. Clear old builder cache before the next release.",
  },
  attention_items: [
    {
      level: "info",
      title: "No server connected yet",
      detail: "Start with Step 1 and save one server target before the first deployment.",
    },
    {
      level: "warn",
      title: "DeployMate host root disk is 86% full",
      detail: "7G free on /. Clear old builder cache before the next release.",
    },
  ],
};

export const smokeDeployments = [
  {
    id: "smoke-deployment",
    owner_user_id: smokeUser.id,
    status: "running",
    image: "nginx:alpine",
    container_name: "smoke-runtime",
    container_id: "container-smoke-1",
    created_at: "2026-04-02T00:00:00Z",
    error: null,
    internal_port: 80,
    external_port: 38080,
    server_id: "smoke-server",
    server_name: "Smoke VPS",
    server_host: "smoke.example.com",
    rollback_available: true,
    rollback_summary: "nginx:1.26 via host port 38080 with 1 env var and 0 secrets",
    release_source: "webhook",
    release_ref: "refs/heads/main",
    release_commit_sha: "7d9c4a2b1f0e6d5c4b3a29181716151413121110",
    release_image_tag: "ghcr.io/deploymate/smoke-runtime:2026.04.02",
    release_triggered_at: "2026-04-02T00:05:00Z",
    release_triggered_by: "smoke-ci",
    env: {
      DEPLOYMATE_SMOKE: "1",
    },
  },
  {
    id: "smoke-stack-runtime",
    owner_user_id: smokeUser.id,
    status: "running",
    image: "ghcr.io/deploymate/customer-portal-web:2026.04.17",
    container_name: "customer-portal-web-1",
    container_id: "container-stack-1",
    created_at: "2026-04-02T00:40:00Z",
    error: null,
    internal_port: null,
    external_port: null,
    server_id: "smoke-server",
    server_name: "Smoke VPS",
    server_host: "smoke.example.com",
    runtime_shape: "stack",
    release_source: "compose",
    stack_name: "customer-portal",
    primary_service: "web",
    health_target: "https://customer-portal.example.com/health",
    env: {},
  },
  {
    id: "billing-api",
    owner_user_id: smokeUser.id,
    status: "running",
    image: "ghcr.io/deploymate/billing-api:2026.04.02",
    container_name: "billing-api",
    container_id: "container-billing-1",
    created_at: "2026-04-01T15:00:00Z",
    error: null,
    internal_port: 8080,
    external_port: 38120,
    server_id: "edge-eu-central",
    server_name: "Edge EU Central",
    server_host: "eu-central.demo.example.com",
    env: {
      APP_ENV: "production",
      REGION: "eu-central",
    },
  },
  {
    id: "review-worker",
    owner_user_id: smokeUser.id,
    status: "failed",
    image: "ghcr.io/deploymate/review-worker:2026.04.02",
    container_name: "review-worker",
    container_id: "container-review-1",
    created_at: "2026-04-02T02:10:00Z",
    error: "Container exited after readiness timeout on port 9090.",
    internal_port: 9090,
    external_port: null,
    server_id: "ops-batch",
    server_name: "Ops Batch",
    server_host: "ops-batch.demo.example.com",
    env: {
      APP_ENV: "production",
      QUEUE: "upgrade-review",
    },
  },
];

export const smokeInternalRuntimeDeployment = {
  id: "internal-runtime",
  owner_user_id: smokeUser.id,
  status: "running",
  image: "ghcr.io/deploymate/internal-api:2026.04.02",
  container_name: "internal-api",
  container_id: "container-internal-1",
  created_at: "2026-04-02T00:20:00Z",
  error: null,
  internal_port: 9000,
  external_port: null,
  server_id: "ops-batch",
  server_name: "Ops Batch",
  server_host: "ops-batch.demo.example.com",
  env: {
    APP_ENV: "production",
    SERVICE_VISIBILITY: "internal",
  },
};

export const smokeDeployment = smokeDeployments[0];

export const smokeServers = [
  {
    id: "smoke-server",
    name: "Smoke VPS",
    host: "203.0.113.10",
    port: 22,
    username: "deploy",
    auth_type: "ssh_key",
    created_at: "2026-04-02T00:00:00Z",
  },
  {
    id: "edge-eu-central",
    name: "Edge EU Central",
    host: "198.51.100.24",
    port: 22,
    username: "deploy",
    auth_type: "ssh_key",
    created_at: "2026-04-01T14:45:00Z",
  },
  {
    id: "ops-batch",
    name: "Ops Batch",
    host: "198.51.100.61",
    port: 22,
    username: "deploy",
    auth_type: "ssh_key",
    created_at: "2026-04-02T01:50:00Z",
  },
];

export const smokeServerTestResults = {
  "smoke-server": {
    status: "success",
    message: "SSH and Docker look healthy on this target.",
    tested_at: "2026-04-02T00:02:30Z",
    target: "deploy@203.0.113.10:22",
    ssh_ok: true,
    docker_ok: true,
    docker_version: "Docker 26.1.3",
  },
};

export const smokeServerDiagnostics = {
  "smoke-server": {
    checked_at: "2026-04-02T00:03:00Z",
    overall_status: "success",
    target: "deploy@203.0.113.10:22",
    deployment_count: 1,
    hostname: "smoke-vps",
    operating_system: "Ubuntu 24.04",
    uptime: "2 days",
    disk_usage: "18%",
    memory: "42%",
    docker_compose_version: "v2.29.2",
    listening_ports: [22, 80, 443, 38080],
    items: [
      {
        key: "ssh",
        label: "SSH",
        status: "success",
        summary: "SSH access is healthy.",
        details: "Accepted a key-based connection and resolved the remote hostname.",
      },
      {
        key: "docker",
        label: "Docker",
        status: "success",
        summary: "Docker engine is available.",
        details: "The daemon responded and compose support is installed.",
      },
      {
        key: "disk_usage",
        label: "Disk usage",
        status: "ok",
        summary: "Root disk has headroom: 18% used, 42G free.",
        details: "8G used of 50G on /; 42G free. Raw: /dev/sda1 50G 8G 42G 18% /",
      },
      {
        key: "ports",
        label: "Ports",
        status: "success",
        summary: "Expected service ports are reachable.",
        details: "Port 38080 is free for the smoke deployment.",
      },
    ],
  },
};

export const smokeServerDiagnosticsPressure = {
  "smoke-server": {
    checked_at: "2026-04-02T00:03:00Z",
    overall_status: "warn",
    target: "deploy@203.0.113.10:22",
    deployment_count: 1,
    hostname: "smoke-vps",
    operating_system: "Ubuntu 24.04",
    uptime: "2 days",
    disk_usage: "/dev/sda1 50G 43G 7G 86% /",
    memory: "42%",
    docker_compose_version: "v2.29.2",
    listening_ports: [22, 80, 443, 38080],
    items: [
      {
        key: "ssh",
        label: "SSH",
        status: "ok",
        summary: "SSH access is healthy.",
        details: "Accepted a key-based connection and resolved the remote hostname.",
      },
      {
        key: "docker",
        label: "Docker",
        status: "ok",
        summary: "Docker engine is available.",
        details: "The daemon responded and compose support is installed.",
      },
      {
        key: "disk_usage",
        label: "Disk usage",
        status: "warn",
        summary: "Root disk is 86% full. Clear old build cache before the next rollout.",
        details: "43G used of 50G on /; 7G free. Raw: /dev/sda1 50G 43G 7G 86% /",
      },
    ],
  },
};

export const smokeNotifications = [
  {
    id: "smoke-notification-1",
    deployment_id: "smoke-deployment",
    level: "success",
    title: "Deployment succeeded",
    message: "Deployment smoke-deployment is running in container smoke-runtime.",
    created_at: "2026-04-02T00:01:00Z",
  },
  {
    id: "smoke-notification-2",
    deployment_id: "smoke-stack-runtime",
    level: "success",
    title: "Customer portal stack deployed",
    message: "customer-portal is healthy and the web service is running as the primary stack runtime.",
    created_at: "2026-04-02T00:41:00Z",
  },
  {
    id: "smoke-notification-3",
    deployment_id: "billing-api",
    level: "success",
    title: "Billing API deployed to EU Central",
    message: "billing-api is healthy and serving traffic on port 38120.",
    created_at: "2026-04-02T00:11:00Z",
  },
  {
    id: "smoke-notification-4",
    deployment_id: "review-worker",
    level: "error",
    title: "Review worker readiness failed",
    message: "review-worker exited before health checks passed. Open deployment diagnostics before retrying.",
    created_at: "2026-04-02T02:12:00Z",
  },
];

export const smokeTemplates = [
  {
    id: "smoke-template",
    owner_user_id: "smoke-admin",
    template_name: "Smoke template",
    context_label: "Internal smoke / baseline",
    image: "nginx:alpine",
    name: "smoke-runtime",
    internal_port: 80,
    external_port: 38080,
    server_id: "smoke-server",
    server_name: "Smoke VPS",
    server_host: "smoke.example.com",
    env: {
      DEPLOYMATE_SMOKE: "1",
    },
    created_at: "2026-04-02T00:00:00Z",
    updated_at: "2026-04-02T00:00:00Z",
    last_used_at: "2026-04-02T00:00:00Z",
    use_count: 1,
  },
  {
    id: "billing-api-template",
    owner_user_id: "teammate-1",
    template_name: "Billing API rollout",
    context_label: "Billing client / production",
    image: "ghcr.io/deploymate/billing-api:stable",
    name: "billing-api",
    internal_port: 8080,
    external_port: 38120,
    server_id: "edge-eu-central",
    server_name: "Edge EU Central",
    server_host: "eu-central.demo.example.com",
    env: {
      APP_ENV: "production",
      REGION: "eu-central",
    },
    created_at: "2026-04-01T14:30:00Z",
    updated_at: "2026-04-02T00:05:00Z",
    last_used_at: "2026-04-02T00:10:00Z",
    use_count: 4,
  },
  {
    id: "review-worker-template",
    owner_user_id: "smoke-admin",
    template_name: "Upgrade review worker",
    context_label: "Internal operations / review",
    image: "ghcr.io/deploymate/review-worker:stable",
    name: "review-worker",
    internal_port: 9090,
    external_port: null,
    server_id: "ops-batch",
    server_name: "Ops Batch",
    server_host: "ops-batch.demo.example.com",
    env: {
      APP_ENV: "production",
      QUEUE: "upgrade-review",
    },
    created_at: "2026-04-01T18:00:00Z",
    updated_at: "2026-04-02T01:55:00Z",
    last_used_at: "2026-04-02T01:59:00Z",
    use_count: 2,
  },
];

export const smokeOpsOverview = {
  generated_at: "2026-04-02T00:02:00Z",
  user: {
    username: "smoke-admin",
    plan: "team",
    role: "admin",
  },
  deployments: {
    total: 4,
    running: 3,
    failed: 1,
    pending: 0,
    local: 0,
    remote: 4,
    exposed: 2,
    public_urls: 2,
  },
  servers: {
    total: 3,
    password_auth: 0,
    ssh_key_auth: 3,
    unused: 0,
  },
  notifications: {
    total: 4,
    success: 3,
    error: 1,
    latest_error_title: "Review worker readiness failed",
    latest_error_at: "2026-04-02T02:12:00Z",
  },
  templates: {
    total: 3,
    unused: 0,
    recently_used: 3,
    top_template_name: "Billing API rollout",
    top_template_use_count: 4,
  },
  capabilities: {
    local_docker_enabled: false,
    ssh_host_key_checking: "yes",
    strict_known_hosts_configured: true,
    server_credentials_key_configured: true,
    remote_only_recommended: true,
  },
  host_runtime: {
    root_disk_status: "ok",
    root_disk_usage_percent: 42,
    root_disk_free: "29G",
    root_disk_detail: "29G free on /. Root disk still has headroom for the next release.",
  },
  attention_items: [
    {
      level: "error",
      title: "1 failed deployment needs review",
      detail: "Open review-worker diagnostics before the next rollout.",
    },
    {
      level: "info",
      title: "Billing API template is the current rollout default",
      detail: "Open template preview or create flow to show the repeatable deployment path.",
    },
  ],
};

export const smokeWorkflowDiskPressureOpsOverview = {
  ...smokeOpsOverview,
  deployments: {
    total: 3,
    running: 3,
    failed: 0,
    pending: 0,
    local: 0,
    remote: 3,
    exposed: 2,
    public_urls: 2,
  },
  notifications: {
    total: 3,
    success: 3,
    error: 0,
    latest_error_title: null,
    latest_error_at: null,
  },
  host_runtime: {
    root_disk_status: "warn",
    root_disk_usage_percent: 86,
    root_disk_free: "7G",
    root_disk_detail: "7G free on /. Clear old builder cache before the next release.",
  },
  attention_items: [
    {
      level: "warn",
      title: "DeployMate host root disk is 86% full",
      detail: "7G free on /. Clear old builder cache before the next release.",
    },
  ],
};

export const smokeHealth = {
  deployment_id: "smoke-deployment",
  container_name: "smoke-runtime",
  url: "http://smoke.example.com:38080",
  status: "healthy",
  status_code: 200,
  error: null,
  checked_at: "2026-04-02T00:03:00Z",
  response_time_ms: 42,
};

export const smokeDiagnostics = {
  deployment_id: "smoke-deployment",
  container_name: "smoke-runtime",
  current_status: "running",
  server_target: "deploy@smoke.example.com:22",
  checked_at: "2026-04-02T00:03:00Z",
  url: "http://smoke.example.com:38080",
  health: smokeHealth,
  activity: {
    total_events: 2,
    success_events: 2,
    error_events: 0,
    recent_failure_count: 0,
    recent_failure_titles: [],
    last_event_title: "Health check passed",
    last_event_level: "success",
    last_event_at: "2026-04-02T00:03:00Z",
  },
  log_excerpt: "nginx entered RUNNING state",
  items: [
    {
      key: "deployment_status",
      label: "Deployment status",
      status: "ok",
      summary: "Current status is running.",
      details: null,
    },
    {
      key: "health",
      label: "HTTP health",
      status: "ok",
      summary: "Health check responded with 200 in 42 ms.",
      details: "http://smoke.example.com:38080",
    },
  ],
};

export const smokeActivity = [
  {
    id: "smoke-activity-1",
    deployment_id: "smoke-deployment",
    level: "success",
    title: "Deployment succeeded",
    message: "Deployment smoke-deployment is running in container smoke-runtime.",
    created_at: "2026-04-02T00:01:00Z",
    category: "deploy",
  },
  {
    id: "smoke-activity-2",
    deployment_id: "smoke-deployment",
    level: "success",
    title: "Health check passed",
    message: "Deployment responded with HTTP 200.",
    created_at: "2026-04-02T00:03:00Z",
    category: "health",
  },
];
