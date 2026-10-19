from fastapi import APIRouter

from .content_routes import router as content_router
from .tryon_routes import router as tryon_router

router = APIRouter()
router.include_router(tryon_router)
router.include_router(content_router)

__all__ = ["router", "tryon_router", "content_router"]
