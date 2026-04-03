import os
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.db import init_db
from app.routes.auth import router as auth_router
from app.routes.deployment_observability import router as deployment_observability_router
from app.routes.deployment_templates import router as deployment_templates_router
from app.routes.deployments import router as deployments_router
from app.routes.notifications import router as notifications_router
from app.routes.ops import router as ops_router
from app.routes.root import router as root_router
from app.routes.servers import router as servers_router
from app.routes.import_review import router as import_review_router


app = FastAPI(
    title="DeployMate API",
    version="0.1.0",
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()",
        )
        return response


class CookieOriginGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in {"POST", "PATCH", "DELETE", "PUT"}:
            origin = request.headers.get("origin", "").strip()
            cookie_header = request.headers.get("cookie", "")
            if origin and "deploymate_session=" in cookie_header and not _origin_is_allowed(origin):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Origin is not allowed for authenticated write requests."},
                )

        return await call_next(request)


def _normalize_origin(origin: str) -> str:
    parsed = urlsplit(origin.strip())
    if not parsed.scheme or not parsed.netloc:
        return origin.strip().rstrip("/")
    return f"{parsed.scheme}://{parsed.netloc}"


def _get_allowed_origins() -> list[str]:
    raw_value = os.getenv("CORS_ALLOW_ORIGINS", "")
    if raw_value.strip():
        return [_normalize_origin(origin) for origin in raw_value.split(",") if origin.strip()]
    return [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ]


def _origin_is_allowed(origin: str) -> bool:
    return _normalize_origin(origin) in _get_allowed_origins()


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CookieOriginGuardMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    init_db()

app.include_router(root_router)
app.include_router(auth_router)
app.include_router(deployments_router)
app.include_router(deployment_templates_router)
app.include_router(deployment_observability_router)
app.include_router(notifications_router)
app.include_router(ops_router)
app.include_router(servers_router)
app.include_router(import_review_router)
