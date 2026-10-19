import logging

from fastapi import APIRouter, HTTPException, status

from ..features.content.schemas import ContentGenerateRequest, ContentGenerateResponse
from ..features.content.workflow import ContentWorkflow

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/content", tags=["AI Content Generation"])
workflow = ContentWorkflow()


@router.post(
    "/generate",
    response_model=ContentGenerateResponse,
    summary="Tạo content đa kênh từ ảnh, dữ liệu sản phẩm và lựa chọn của user",
)
async def generate_content(req: ContentGenerateRequest) -> ContentGenerateResponse:
    logger.info("[content-api] received job_id=%s products=%s channels=%s", req.job_id, len(req.products), [c.value for c in req.channels])
    response = await workflow.execute(req)
    if response.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "job_id": response.job_id,
                "error_code": response.error_code,
                "error_message": response.error_message,
            },
        )
    return response
