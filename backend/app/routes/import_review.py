from fastapi import APIRouter, Depends

from app.services.auth import require_admin
from app.schemas import (
    ImportReviewWorkspaceResponse,
)
from app.services.import_review import build_import_review_workspace


router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/import-review", response_model=ImportReviewWorkspaceResponse)
def get_import_review() -> ImportReviewWorkspaceResponse:
    return ImportReviewWorkspaceResponse(**build_import_review_workspace())
