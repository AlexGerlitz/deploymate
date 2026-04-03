from pydantic import BaseModel


class HealthResponse(BaseModel):
    ok: bool
    service: str


class AuthSessionResponse(BaseModel):
    authenticated: bool
    user: str | None = None


class AdminOverviewResponse(BaseModel):
    product: str
    status: str
