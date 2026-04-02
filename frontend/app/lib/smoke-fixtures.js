export const smokeMode = process.env.NEXT_PUBLIC_SMOKE_TEST_MODE === "1";

export const smokeUser = {
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
];

export const smokeOpsOverview = {
  generated_at: "2026-04-02T00:02:00Z",
  user: {
    username: "smoke-admin",
    plan: "team",
    role: "admin",
  },
  deployments: {
    total: 1,
    running: 1,
    failed: 0,
    pending: 0,
    local: 0,
    remote: 1,
    exposed: 1,
    public_urls: 1,
  },
  servers: {
    total: 1,
    password_auth: 0,
    ssh_key_auth: 1,
    unused: 0,
  },
  notifications: {
    total: 1,
    success: 1,
    error: 0,
    latest_error_title: null,
    latest_error_at: null,
  },
  templates: {
    total: 1,
    unused: 0,
    recently_used: 1,
    top_template_name: "Smoke template",
    top_template_use_count: 1,
  },
  capabilities: {
    local_docker_enabled: false,
    ssh_host_key_checking: "yes",
    strict_known_hosts_configured: true,
    server_credentials_key_configured: true,
    remote_only_recommended: true,
  },
  attention_items: [],
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
