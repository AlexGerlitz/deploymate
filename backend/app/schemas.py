from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field


DeploymentStatus = Literal["pending", "running", "failed"]
HealthStatus = Literal["healthy", "unhealthy"]
NotificationLevel = Literal["success", "error"]
ServerAuthType = Literal["password", "ssh_key"]
UserPlan = Literal["trial", "solo", "team"]
UserRole = Literal["admin", "member"]


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


class NotificationResponse(BaseModel):
    id: str
    deployment_id: str
    level: NotificationLevel
    title: str
    message: str
    created_at: str


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
    created_at: str


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
