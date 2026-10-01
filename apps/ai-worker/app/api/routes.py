import logging
import os
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from ..config import settings
from ..classifiers.openai_classifier import OpenAIClassifier
from ..garment.kie_garment_extractor import KieGarmentExtractor
from ..models.schemas import (
    ClassifierOutput,
    GarmentExtractRequest,
    GarmentExtractResponse,
    GarmentMetadata,
    HealthResponse,
    TryOnGenerateRequest,
    TryOnGenerateResponse,
    UserClassifyRequest,
    UserClassifyResponse,
    VisibilityFlag,
)
from ..pipelines.tryon_pipeline import TryOnPipeline
from ..providers.kie_provider import KieTryOnProvider
from ..storage.storage import StorageService

logger = logging.getLogger(__name__)

router = APIRouter()
pipeline = TryOnPipeline()
classifier = OpenAIClassifier()
kie_garment_extractor = KieGarmentExtractor()
kie_tryon_provider = KieTryOnProvider()


def _clean_val(val: Optional[str]) -> Optional[str]:
    if not val:
        return None
    val = val.strip()
    if val in ("", "string", "null", "undefined"):
        return None
    return val


async def _resolve_image_bytes(
    path: Optional[str] = None,
    url: Optional[str] = None,
) -> bytes:
    """Helper to resolve image bytes from path or URL, ignoring Swagger default dummy 'string' values."""
    path = _clean_val(path)
    url = _clean_val(url)

    # 1. Prioritize HTTP/HTTPS URL
    if url and (url.startswith("http://") or url.startswith("https://")):
        return await StorageService.load_image_bytes(url=url)

    # 2. Check local file path if exists
    if path and os.path.exists(path):
        return await StorageService.load_image_bytes(file_path=path)

    # 3. Fallback via StorageService
    if path or url:
        return await StorageService.load_image_bytes(file_path=path, url=url)

    raise ValueError("Phải cung cấp ít nhất một URL ảnh (user_image_url) hoặc file path (user_image_path) hợp lệ.")


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    return HealthResponse(
        ok=True,
        mock_mode=settings.ai_mock_mode,
    )


# =====================================================================
# Stage 1: Phân loại ảnh User qua OpenAI
# =====================================================================
@router.post(
    "/v1/user/classify",
    response_model=UserClassifyResponse,
    tags=["Stage 1: User Classification"],
    summary="1. Gửi ảnh user lên OpenAI để nhận diện góc dáng người",
)
async def classify_user(req: UserClassifyRequest):
    """
    Gửi ảnh người dùng lên OpenAI Vision Model (gp-5.6-sol-max) để:
    - Nhận diện framing: FACE_ONLY, UPPER_BODY, THREE_QUARTER, FULL_BODY, INVALID
    - Đếm số người trong ảnh (person_count)
    - Kiểm tra độ che khuất (occlusion_level), độ tự tin (confidence)
    """
    logger.info(f"[routes] Incoming /v1/user/classify (url={bool(req.user_image_url)}, path={bool(req.user_image_path)})")
    try:
        image_bytes = await _resolve_image_bytes(
            path=req.user_image_path,
            url=req.user_image_url,
        )
    except Exception as e:
        logger.warning(f"[routes] Bad image input for /v1/user/classify: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể đọc ảnh người dùng: {e}",
        )

    try:
        output: ClassifierOutput = await classifier.classify(image_bytes)
        logger.info(f"[routes] /v1/user/classify completed: flag={output.visibility_flag.value}, confidence={output.confidence:.2f}, people={output.person_count}")
        return UserClassifyResponse(
            ok=output.visibility_flag != VisibilityFlag.INVALID,
            visibility_flag=output.visibility_flag,
            person_count=output.person_count,
            face_visible=output.face_visible,
            upper_body_visible=output.upper_body_visible,
            lower_body_visible=output.lower_body_visible,
            feet_visible=output.feet_visible,
            occlusion_level=output.occlusion_level,
            confidence=output.confidence,
        )
    except Exception as e:
        logger.error(f"[routes] /v1/user/classify failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi gọi OpenAI phân loại ảnh: {e}",
        )


# =====================================================================
# Stage 2: Tách nền trang phục qua Kie.ai
# =====================================================================
@router.post(
    "/v1/garment/extract",
    response_model=GarmentExtractResponse,
    tags=["Stage 2: Garment Extraction"],
    summary="2. Gửi ảnh sản phẩm lên Kie.ai để tách trang phục ra nền trong suốt",
)
async def extract_garment(req: GarmentExtractRequest):
    """
    Gửi ảnh sản phẩm lên Kie.ai (gpt-image-2-5-sunburst-image-to-image) với background='transparent':
    - Tách toàn bộ trang phục trong ảnh đặt lên nền trong suốt (PNG)
    - Xóa sạch người mẫu, phông nền, phụ kiện không liên quan
    - Lưu vào Supabase Storage bucket 'AI' và trả về public URL + Metadata
    """
    logger.info(f"[routes] Incoming /v1/garment/extract (variant_id='{req.variant_id}', url={bool(req.product_image_url)}, path={bool(req.product_image_path)})")
    variant_id = req.variant_id or "default"
    clean_url = _clean_val(req.product_image_url)
    clean_path = _clean_val(req.product_image_path)

    if not clean_url and not clean_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cần cung cấp product_image_url hoặc product_image_path",
        )

    try:
        result = await kie_garment_extractor.extract_garment(
            product_image_url=clean_url,
            product_image_path=clean_path,
            variant_id=variant_id,
        )
        logger.info(f"[routes] /v1/garment/extract completed for variant '{variant_id}' -> url: {result.image_url}")
        return GarmentExtractResponse(
            ok=True,
            variant_id=variant_id,
            garment_image_path=result.output_path,
            garment_image_url=result.image_url,
            metadata=result.metadata or GarmentMetadata(),
        )
    except Exception as e:
        logger.error(f"[routes] /v1/garment/extract failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.",
        )


# =====================================================================
# Stage 3: Ghép đồ ảo qua Kie.ai (Virtual Try-On Generation)
# =====================================================================
@router.post(
    "/v1/try-on/generate",
    response_model=TryOnGenerateResponse,
    tags=["Stage 3: Virtual Try-On Generation"],
    summary="3. Tạo ảnh Virtual Try-On qua Kie.ai (Không dùng Base64)",
)
async def run_kie_tryon(req: TryOnGenerateRequest):
    """
    Tiến hành ghép đồ ảo qua Kie.ai:
    - Nếu gửi từ Storefront (có product_image_url / product_image_path): Tự động chạy full pipeline 3 bước
      (1: OpenAI classify, 2: Kie garment extract transparent, 3: Kie try-on combine)
    - Nếu gửi trực tiếp 2 ảnh URL/path (User + Garment): Ghép ảnh trực tiếp qua Kie.ai
    - Kết quả luôn được lưu lên Supabase Storage bucket 'AI' và trả về public URL
    """
    logger.info(f"[routes] Incoming Virtual Try-On job '{req.job_id}'")

    has_product_input = bool(_clean_val(req.product_image_url) or _clean_val(req.product_image_path))
    has_garment_input = bool(_clean_val(req.garment_image_url) or _clean_val(req.garment_image_path))

    # Flow A: Storefront / Full Pipeline (User Image + Product Image)
    if has_product_input and not has_garment_input:
        logger.info(f"[routes] Running full 3-stage try-on pipeline for job '{req.job_id}'")
        resp = await pipeline.execute(req)
        if resp.status == "failed":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"error_code": resp.error_code, "error_message": resp.error_message, "job_id": req.job_id},
            )
        return resp

    # Flow B: Direct 2-Image Synthesis (User + Garment)
    user_path = _clean_val(req.user_image_path)
    user_url = _clean_val(req.user_image_url)
    if not user_path and not user_url:
        raise HTTPException(status_code=400, detail="Cần cung cấp user_image_url hoặc user_image_path")

    garment_path = _clean_val(req.garment_image_path)
    garment_url = _clean_val(req.garment_image_url)
    if not garment_path and not garment_url:
        raise HTTPException(status_code=400, detail="Cần cung cấp garment_image_url hoặc garment_image_path")

    try:
        result_path, public_url = await kie_tryon_provider.generate_tryon(
            job_id=req.job_id,
            user_image_url=user_url,
            garment_image_url=garment_url,
            user_image_path=user_path,
            garment_image_path=garment_path,
            visibility_flag=req.visibility_flag or VisibilityFlag.UPPER_BODY,
            garment_metadata=req.garment_metadata,
            custom_prompt=req.prompt,
            target_output_path=None,
        )
        logger.info(f"[routes] Try-On completed for job '{req.job_id}' -> result_path: {result_path}, url: {public_url}")
        return TryOnGenerateResponse(
            job_id=req.job_id,
            status="completed",
            visibility_flag=req.visibility_flag or VisibilityFlag.UPPER_BODY,
            result_path=result_path,
            result_url=public_url,
            prompt_used=req.prompt or f"Virtual try-on framing: {req.visibility_flag or 'UPPER_BODY'}",
            prompt_version="v3-kie-sunburst",
        )
    except Exception as e:
        logger.error(f"[routes] Try-On generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "tryon_generation_failed",
                "error_message": "Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.",
                "job_id": req.job_id,
            },
        )
