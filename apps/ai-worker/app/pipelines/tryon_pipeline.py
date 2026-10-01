import logging
import os
from typing import Any, Optional

from ..classifiers.base import BaseClassifier
from ..classifiers.openai_classifier import OpenAIClassifier
from ..config import settings
from ..garment.kie_garment_extractor import KieGarmentExtractor
from ..models.schemas import (
    ClassifierOutput,
    GarmentAssetResult,
    TryOnGenerateRequest,
    TryOnGenerateResponse,
    VisibilityFlag,
)
from ..providers.kie_provider import KieTryOnProvider
from ..storage.storage import StorageService

logger = logging.getLogger(__name__)


class TryOnPipeline:
    def __init__(
        self,
        classifier: Optional[BaseClassifier] = None,
        garment_extractor: Optional[Any] = None,
        provider: Optional[Any] = None,
    ):
        # Step 1: OpenAI Classifier as before
        self.classifier = classifier or OpenAIClassifier()
        # Step 2: Kie Garment Extractor (transparent background isolation)
        self.garment_extractor = garment_extractor or KieGarmentExtractor()
        # Step 3: Kie Try-On Provider (combines user and isolated garment)
        self.provider = provider or KieTryOnProvider()

    async def execute(self, req: TryOnGenerateRequest) -> TryOnGenerateResponse:
        logger.info(f"[pipeline] Starting 3-stage try-on pipeline for job {req.job_id}")

        # 1. Step 1: User Image Classification via OpenAI
        classifier_output: Optional[ClassifierOutput] = None
        visibility_flag = req.visibility_flag

        if not visibility_flag:
            try:
                # Load user image bytes for OpenAI vision classification
                user_image_bytes = await StorageService.load_image_bytes(
                    file_path=req.user_image_path,
                    url=req.user_image_url,
                )
                classifier_output = await self.classifier.classify(user_image_bytes)
                visibility_flag = classifier_output.visibility_flag
            except Exception as e:
                logger.error(f"[pipeline] Step 1 Classifier failed: {e}")
                return TryOnGenerateResponse(
                    job_id=req.job_id,
                    status="failed",
                    visibility_flag=VisibilityFlag.INVALID,
                    error_code="classifier_failed",
                    error_message=f"Lỗi khi phân loại ảnh người dùng: {e}",
                )

        if visibility_flag == VisibilityFlag.INVALID:
            logger.warning(f"[pipeline] Image classified as INVALID for job {req.job_id}")
            return TryOnGenerateResponse(
                job_id=req.job_id,
                status="failed",
                visibility_flag=VisibilityFlag.INVALID,
                classifier=classifier_output,
                error_code="invalid_tryon_image",
                error_message="Ảnh không hợp lệ. Vui lòng chụp rõ một người chính diện và đủ ánh sáng.",
            )

        # 2. Step 2: Garment Preparation via Kie.ai (Transparent Background Extraction)
        garment_result: Optional[GarmentAssetResult] = None

        if req.garment_image_url or req.garment_image_path:
            garment_result = GarmentAssetResult(
                reused_cache=False,
                output_path=req.garment_image_path,
                image_url=req.garment_image_url,
                metadata=req.garment_metadata,
            )
        elif req.cached_garment_url or req.cached_garment_path:
            garment_result = GarmentAssetResult(
                reused_cache=True,
                output_path=req.cached_garment_path,
                image_url=req.cached_garment_url,
                metadata=req.cached_garment_metadata,
            )

        if not garment_result:
            if not req.product_image_url and not req.product_image_path:
                return TryOnGenerateResponse(
                    job_id=req.job_id,
                    status="failed",
                    visibility_flag=visibility_flag,
                    classifier=classifier_output,
                    error_code="tryon_variant_not_found",
                    error_message="Thiếu thông tin ảnh sản phẩm (product_image_url / product_image_path)",
                )

            try:
                logger.info(f"[pipeline] Step 2: Extracting garment with transparent background via Kie.ai")
                garment_result = await self.garment_extractor.extract_garment(
                    product_image_url=req.product_image_url,
                    product_image_path=req.product_image_path,
                    variant_id=req.variant_id or "default",
                )
            except Exception as e:
                logger.error(f"[pipeline] Step 2 Garment extraction failed: {e}")
                return TryOnGenerateResponse(
                    job_id=req.job_id,
                    status="failed",
                    visibility_flag=visibility_flag,
                    classifier=classifier_output,
                    error_code="garment_extraction_failed",
                    error_message="Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.",
                )

        # 3. Step 3: Virtual Try-On Generation via Kie.ai
        logger.info(f"[pipeline] Step 3: Combining user and extracted garment via Kie.ai")
        try:
            result_path, public_url = await self.provider.generate_tryon(
                job_id=req.job_id,
                user_image_url=req.user_image_url,
                garment_image_url=garment_result.image_url if garment_result else None,
                user_image_path=req.user_image_path,
                garment_image_path=garment_result.output_path if garment_result else None,
                visibility_flag=visibility_flag or VisibilityFlag.UPPER_BODY,
                garment_metadata=garment_result.metadata if garment_result else None,
                custom_prompt=req.prompt,
                target_output_path=None,
            )
        except Exception as e:
            logger.error(f"[pipeline] Step 3 Generation provider failed: {e}")
            return TryOnGenerateResponse(
                job_id=req.job_id,
                status="failed",
                visibility_flag=visibility_flag,
                classifier=classifier_output,
                garment=garment_result,
                error_code="generation_failed",
                error_message="Hệ thống AI hiện đang quá tải hoặc bận xử lý. Quý khách vui lòng thử lại sau ít phút.",
            )

        logger.info(f"[pipeline] Successfully completed try-on job {req.job_id} -> {public_url}")
        return TryOnGenerateResponse(
            job_id=req.job_id,
            status="completed",
            visibility_flag=visibility_flag,
            classifier=classifier_output,
            garment=garment_result,
            result_path=result_path,
            result_url=public_url,
            prompt_used=req.prompt,
            prompt_version="v3-kie-sunburst",
        )
