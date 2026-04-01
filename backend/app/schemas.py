from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field


DeploymentStatus = Literal["pending", "running", "failed"]
HealthStatus = Literal["healthy", "unhealthy"]
NotificationLevel = Literal["success", "error"]
ServerAuthType = Literal["password", "ssh_key"]
UserPlan = Literal["trial", "solo", "team"]
UserRole = Literal["admin", "member"]
DiagnosticStatus = Literal["ok", "warn", "error", "unknown"]
UpgradeRequestStatus = Literal["new", "in_review", "approved", "rejected", "closed"]


class DeploymentCreateRequest(BaseModel):
    image: str = Field(..., min_length=1, description="Docker image, for example nginx:latest")
    name: Optional[str] = Field(default=None, description="Optional container name")
    internal_port: Optional[int] = Field(default=None, ge=1, le=65535)
    external_port: Optional[int] = Field(default=None, ge=1, le=65535)
    server_id: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)


class DeploymentResponse(BaseModel):
    id: str
    status: DeploymentStatus
    image: str
    container_name: str
    container_id: Optional[str]
    created_at: str
    error: Optional[str]
    internal_port: Optional[int] = None
    external_port: Optional[int] = None
    server_id: Optional[str] = None
    server_name: Optional[str] = None
    server_host: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)


class DeploymentTemplateCreateRequest(BaseModel):
    template_name: str = Field(..., min_length=1)
    image: str = Field(..., min_length=1, description="Docker image, for example nginx:latest")
    name: Optional[str] = Field(default=None, description="Optional deployment name")
    internal_port: Optional[int] = Field(default=None, ge=1, le=65535)
    external_port: Optional[int] = Field(default=None, ge=1, le=65535)
    server_id: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)


class DeploymentTemplateResponse(BaseModel):
    id: str
    template_name: str
    image: str
    name: Optional[str] = None
    internal_port: Optional[int] = None
    external_port: Optional[int] = None
    server_id: Optional[str] = None
    server_name: Optional[str] = None
    server_host: Optional[str] = None
    env: Dict[str, str] = Field(default_factory=dict)
    created_at: str
    updated_at: Optional[str] = None
    last_used_at: Optional[str] = None
    use_count: int = 0


class DeploymentTemplateDuplicateRequest(BaseModel):
    template_name: Optional[str] = Field(default=None, min_length=1)


class DeploymentDeleteResponse(BaseModel):
    deployment_id: str
    status: Literal["deleted"]


class DeploymentLogsResponse(BaseModel):
    deployment_id: str
    container_name: str
    logs: str


class DeploymentHealthResponse(BaseModel):
    deployment_id: str
    container_name: str
    url: Optional[str] = None
    status: HealthStatus
    status_code: Optional[int]
    error: Optional[str]
    checked_at: Optional[str] = None
    response_time_ms: Optional[int] = None


class NotificationResponse(BaseModel):
    id: str
    deployment_id: str
    level: NotificationLevel
    title: str
    message: str
    created_at: str
    category: Optional[str] = None


class OpsAttentionItem(BaseModel):
    level: Literal["info", "warn", "error"]
    title: str
    detail: str


class OpsDeploymentsSummary(BaseModel):
    total: int = 0
    running: int = 0
    failed: int = 0
    pending: int = 0
    local: int = 0
    remote: int = 0
    exposed: int = 0
    public_urls: int = 0


class OpsServersSummary(BaseModel):
    total: int = 0
    password_auth: int = 0
    ssh_key_auth: int = 0
    unused: int = 0


class OpsNotificationsSummary(BaseModel):
    total: int = 0
    success: int = 0
    error: int = 0
    latest_error_title: Optional[str] = None
    latest_error_at: Optional[str] = None


class OpsTemplatesSummary(BaseModel):
    total: int = 0
    unused: int = 0
    recently_used: int = 0
    top_template_name: Optional[str] = None
    top_template_use_count: int = 0


class OpsUserSummary(BaseModel):
    username: str
    plan: UserPlan = "trial"
    role: UserRole = "member"


class OpsOverviewResponse(BaseModel):
    generated_at: str
    user: Optional[OpsUserSummary] = None
    deployments: OpsDeploymentsSummary = Field(default_factory=OpsDeploymentsSummary)
    servers: OpsServersSummary = Field(default_factory=OpsServersSummary)
    notifications: OpsNotificationsSummary = Field(default_factory=OpsNotificationsSummary)
    templates: OpsTemplatesSummary = Field(default_factory=OpsTemplatesSummary)
    attention_items: list[OpsAttentionItem] = Field(default_factory=list)


class DiagnosticItem(BaseModel):
    key: str
    label: str
    status: DiagnosticStatus
    summary: str
    details: Optional[str] = None


class DeploymentActivitySummaryResponse(BaseModel):
    total_events: int = 0
    success_events: int = 0
    error_events: int = 0
    recent_failure_count: int = 0
    recent_failure_titles: list[str] = Field(default_factory=list)
    last_event_title: Optional[str] = None
    last_event_level: Optional[NotificationLevel] = None
    last_event_at: Optional[str] = None


class DeploymentDiagnosticsResponse(BaseModel):
    deployment_id: str
    container_name: str
    current_status: str
    server_target: str
    checked_at: str
    url: Optional[str] = None
    health: DeploymentHealthResponse
    activity: DeploymentActivitySummaryResponse
    log_excerpt: str = ""
    items: list[DiagnosticItem] = Field(default_factory=list)


class ServerCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    host: str = Field(..., min_length=1)
    port: int = Field(default=22, ge=1, le=65535)
    username: str = Field(..., min_length=1)
    auth_type: ServerAuthType
    password: Optional[str] = None
    ssh_key: Optional[str] = None


class ServerResponse(BaseModel):
    id: str
    name: str
    host: str
    port: int
    username: str
    auth_type: ServerAuthType
    created_at: str


class ServerConnectionTestResponse(BaseModel):
    server_id: str
    status: Literal["success", "error"]
    message: str
    target: Optional[str] = None
    ssh_ok: bool = False
    docker_ok: bool = False
    docker_version: Optional[str] = None


class ServerDiagnosticsResponse(BaseModel):
    server_id: str
    target: str
    checked_at: str
    overall_status: DiagnosticStatus
    deployment_count: int = 0
    hostname: Optional[str] = None
    operating_system: Optional[str] = None
    uptime: Optional[str] = None
    disk_usage: Optional[str] = None
    memory: Optional[str] = None
    docker_version: Optional[str] = None
    docker_compose_version: Optional[str] = None
    listening_ports: list[int] = Field(default_factory=list)
    items: list[DiagnosticItem] = Field(default_factory=list)


class ServerSuggestedPortsResponse(BaseModel):
    server_id: str
    ports: list[int] = Field(default_factory=list)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: str
    username: str
    created_at: str
    plan: UserPlan = "trial"
    role: UserRole = "member"
    must_change_password: bool = False
    is_admin: bool = False
    limits: Dict[str, int] = Field(default_factory=dict)
    usage: Dict[str, int] = Field(default_factory=dict)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=1)


class UpgradeRequestCreate(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)
    company_or_team: Optional[str] = None
    use_case: Optional[str] = None
    current_plan: Optional[UserPlan] = None


class UpgradeRequestResponse(BaseModel):
    request_id: str
    status: Literal["submitted"]


class UpgradeRequestItem(BaseModel):
    id: str
    name: str
    email: str
    company_or_team: Optional[str] = None
    use_case: Optional[str] = None
    current_plan: Optional[UserPlan] = None
    status: UpgradeRequestStatus = "new"
    internal_note: Optional[str] = None
    handled_by_user_id: Optional[str] = None
    handled_by_username: Optional[str] = None
    target_user_id: Optional[str] = None
    target_username: Optional[str] = None
    reviewed_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_at: str


class UpgradeRequestUpdateRequest(BaseModel):
    status: Optional[UpgradeRequestStatus] = None
    internal_note: Optional[str] = None
    target_user_id: Optional[str] = None
    plan: Optional[UserPlan] = None


class AdminUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    role: UserRole = "member"


class AdminUserUpdateRequest(BaseModel):
    role: Optional[UserRole] = None
    plan: Optional[UserPlan] = None


class AdminUserItem(BaseModel):
    id: str
    username: str
    plan: UserPlan = "trial"
    role: UserRole
    must_change_password: bool = False
    created_at: str


class AdminUsersSummary(BaseModel):
    total: int = 0
    admins: int = 0
    members: int = 0
    trial: int = 0
    solo: int = 0
    team: int = 0
    must_change_password: int = 0


class AdminUpgradeRequestsSummary(BaseModel):
    total: int = 0
    new: int = 0
    in_review: int = 0
    approved: int = 0
    rejected: int = 0
    closed: int = 0
    linked_users: int = 0


class AdminAttentionItem(BaseModel):
    level: Literal["info", "warn", "error"]
    title: str
    detail: str


class AdminOverviewResponse(BaseModel):
    generated_at: str
    users: AdminUsersSummary = Field(default_factory=AdminUsersSummary)
    upgrade_requests: AdminUpgradeRequestsSummary = Field(default_factory=AdminUpgradeRequestsSummary)
    attention_items: list[AdminAttentionItem] = Field(default_factory=list)


class AdminAuditItem(BaseModel):
    id: str
    actor_user_id: Optional[str] = None
    actor_username: Optional[str] = None
    action_type: str
    target_type: str
    target_id: Optional[str] = None
    target_label: Optional[str] = None
    details: Optional[str] = None
    created_at: str


class AdminAuditSummary(BaseModel):
    total: int = 0
    user_actions: int = 0
    upgrade_request_actions: int = 0
    latest_action_type: Optional[str] = None
    latest_action_at: Optional[str] = None
