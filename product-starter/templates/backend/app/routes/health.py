from fastapi import APIRouter

from ..schemas import HealthResponse


router = APIRouter(tags=["health"])


@router.get("/api/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    return HealthResponse(ok=True, service="{{APP_SLUG}}")
