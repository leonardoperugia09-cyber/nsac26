from fastapi import APIRouter

from halo_backend.api.v1.endpoints.assistant import router as assistant_router

router = APIRouter()
router.include_router(assistant_router)
