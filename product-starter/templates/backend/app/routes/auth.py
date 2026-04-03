from fastapi import APIRouter

from ..schemas import AuthSessionResponse
from ..services.auth import get_demo_session


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/session", response_model=AuthSessionResponse)
def get_session() -> AuthSessionResponse:
    return get_demo_session()
