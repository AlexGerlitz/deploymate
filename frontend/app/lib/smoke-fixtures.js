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
  attention_items: [
    {
      level: "info",
      title: "No server connected yet",
      detail: "Start with Step 1 and save one server target before the first deployment.",
    },
  ],
};

export const smokeDeployments = [
  {
    id: "smoke-deployment",
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
    env: {
      DEPLOYMATE_SMOKE: "1",
    },
  },
  {
    id: "billing-api",
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
        key: "ports",
        label: "Ports",
        status: "success",
        summary: "Expected service ports are reachable.",
        details: "Port 38080 is free for the smoke deployment.",
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
    deployment_id: "billing-api",
    level: "success",
    title: "Billing API deployed to EU Central",
    message: "billing-api is healthy and serving traffic on port 38120.",
    created_at: "2026-04-02T00:11:00Z",
  },
  {
    id: "smoke-notification-3",
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
    template_name: "Smoke template",
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
    template_name: "Billing API rollout",
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
    template_name: "Upgrade review worker",
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
    total: 3,
    running: 2,
    failed: 1,
    pending: 0,
    local: 0,
    remote: 3,
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
    total: 3,
    success: 2,
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
