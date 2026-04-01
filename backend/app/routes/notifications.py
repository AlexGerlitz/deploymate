from typing import List

from fastapi import APIRouter, Depends, Query

from app.db import list_notifications
from app.schemas import NotificationResponse
from app.services.auth import require_auth


router = APIRouter(dependencies=[Depends(require_auth)])


@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(limit: int = Query(default=20, ge=1, le=100)) -> List[NotificationResponse]:
    notifications = list_notifications(limit=limit)
    return [NotificationResponse(**item) for item in notifications]
