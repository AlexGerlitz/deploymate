import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routes.auth import router as auth_router
from app.routes.deployments import router as deployments_router
from app.routes.notifications import router as notifications_router
from app.routes.root import router as root_router
from app.routes.servers import router as servers_router


app = FastAPI(
    title="DeployMate API",
    version="0.1.0",
)


def _get_allowed_origins() -> list[str]:
    raw_value = os.getenv("CORS_ALLOW_ORIGINS", "")
    if raw_value.strip():
        return [origin.strip() for origin in raw_value.split(",") if origin.strip()]
    return [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    init_db()

app.include_router(root_router)
app.include_router(auth_router)
app.include_router(deployments_router)
app.include_router(notifications_router)
app.include_router(servers_router)
