from fastapi import APIRouter

from ..schemas import AdminOverviewResponse


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview() -> AdminOverviewResponse:
    return AdminOverviewResponse(product="{{PROJECT_NAME}}", status="starter")
