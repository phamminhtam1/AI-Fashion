import hashlib
import io
import logging
import os
from pathlib import Path
from typing import Optional
import httpx
from PIL import Image

from ..config import settings
from ..models.schemas import GarmentAssetResult, GarmentMetadata
from ..providers.kie_provider import KieTryOnProvider
from ..storage.storage import StorageService
from ..storage.supabase_storage import SupabaseStorageService
from .metadata import GarmentMetadataExtractor

logger = logging.getLogger(__name__)

KIE_GARMENT_PROMPT = (
    "Extract only the clothing and apparel items from this product image. "
    "Completely remove the human model, mannequin, face, limbs, skin, and all background environment. "
    "Isolate the garment on a transparent background. "
    "Preserve exact fabric texture, colors, pattern, neckline, collar, buttons, and silhouette details accurately."
)


class KieGarmentExtractor:
    """
    Step 2: Isolates garments and removes backgrounds using Kie.ai GPT Image 2.5 API
    with background='transparent'.
    """

    def __init__(
        self,
        kie_provider: Optional[KieTryOnProvider] = None,
        metadata_extractor: Optional[GarmentMetadataExtractor] = None,
    ):
        self.kie_provider = kie_provider or KieTryOnProvider()
        self.metadata_extractor = metadata_extractor or GarmentMetadataExtractor()

    async def _resolve_product_url(
        self,
        product_image_url: Optional[str] = None,
        product_image_path: Optional[str] = None,
        variant_id: str = "default",
    ) -> Optional[str]:
        """Ensures the product image has a public URL for Kie.ai."""
        if product_image_url:
            clean = product_image_url.strip()
            if (clean.startswith("http://") or clean.startswith("https://")) and clean not in (
                "string",
                "null",
                "undefined",
            ):
                return clean

        if product_image_path and os.path.exists(product_image_path):
            with open(product_image_path, "rb") as f:
                img_bytes = f.read()

            if SupabaseStorageService.is_configured():
                object_path = f"temp_inputs/prod_{variant_id}.png"
                pub_url = await SupabaseStorageService.upload_bytes(
                    data=img_bytes,
                    object_path=object_path,
                    content_type="image/png",
                )
                if pub_url:
                    logger.info(f"[kie-garment] Staged product image to Supabase: {pub_url}")
                    return pub_url

        return None

    async def extract_garment(
        self,
        product_image_url: Optional[str] = None,
        product_image_path: Optional[str] = None,
        variant_id: str = "default",
        api_key: Optional[str] = None,
    ) -> GarmentAssetResult:
        """
        Submits product image to Kie.ai to extract the isolated garment with transparent background.
        Returns GarmentAssetResult with output_path, image_url, and metadata.
        """
        active_key = api_key or self.kie_provider.api_key
        # Mock Mode
        if settings.ai_mock_mode or not active_key:
            logger.info(f"[kie-garment] Running in MOCK mode for variant '{variant_id}'")
            return await self._mock_extraction(
                product_image_path=product_image_path,
                target_file=None,
                variant_id=variant_id,
            )

        # 1. Resolve public product image URL
        prod_url = await self._resolve_product_url(
            product_image_url=product_image_url,
            product_image_path=product_image_path,
            variant_id=variant_id,
        )
        if not prod_url:
            raise ValueError(
                f"Kie.ai requires a public URL for product image. "
                f"Resolved: {prod_url}. Ensure Supabase credentials or public URL are provided."
            )

        # 2. Submit task to Kie.ai with background='transparent'
        logger.info(f"[kie-garment] Submitting background extraction task to Kie.ai for variant '{variant_id}'")
        task_id = await self.kie_provider.create_task(
            prompt=KIE_GARMENT_PROMPT,
            input_urls=[prod_url],
            aspect_ratio="auto",
            resolution="1K",
            background="transparent",
            api_key=active_key,
        )

        # 3. Poll until completed
        data = await self.kie_provider.poll_task(task_id, api_key=active_key)
        result_img_url = self.kie_provider._extract_output_image_url(data)
        logger.info(f"[kie-garment] Extraction succeeded -> {result_img_url}")

        # 4. Download isolated garment bytes
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(result_img_url)
            resp.raise_for_status()
            garment_bytes = resp.content

        # 5. Upload directly to Supabase Storage (no local disk save)
        storage_key = f"garments/{variant_id}.png"
        public_url = await SupabaseStorageService.upload_bytes(
            data=garment_bytes,
            object_path=storage_key,
            content_type="image/png",
        )
        if not public_url:
            public_url = result_img_url

        # 6. Extract structured metadata using OpenAI catalog analyzer
        metadata = await self.metadata_extractor.extract_metadata(garment_bytes)
        sha256_hash = hashlib.sha256(garment_bytes).hexdigest()

        logger.info(f"[kie-garment] Garment extracted for variant '{variant_id}': category={metadata.category}, url={public_url}")
        return GarmentAssetResult(
            reused_cache=False,
            output_path=None,
            image_url=public_url,
            storage_key=storage_key,
            sha256=sha256_hash,
            metadata=metadata,
        )

    async def _mock_extraction(
        self,
        product_image_path: Optional[str],
        target_file: str,
        variant_id: str,
    ) -> GarmentAssetResult:
        """Fallback mock garment generator for unit testing."""
        garment_bytes: Optional[bytes] = None
        if product_image_path and os.path.exists(product_image_path):
            try:
                with open(product_image_path, "rb") as f:
                    garment_bytes = f.read()
            except Exception:
                pass

        if not garment_bytes:
            blank = Image.new("RGBA", (512, 512), color=(255, 255, 255, 0))
            buf = io.BytesIO()
            blank.save(buf, format="PNG")
            garment_bytes = buf.getvalue()

        if target_file:
            with open(target_file, "wb") as f:
                f.write(garment_bytes)

        storage_key = f"garments/{variant_id}.png"
        pub_url = await SupabaseStorageService.upload_bytes(
            data=garment_bytes,
            object_path=storage_key,
            content_type="image/png",
        )
        metadata = await self.metadata_extractor.extract_metadata(garment_bytes)

        return GarmentAssetResult(
            reused_cache=False,
            output_path=target_file,
            image_url=pub_url or f"file://{target_file}",
            storage_key=storage_key,
            sha256=hashlib.sha256(garment_bytes).hexdigest(),
            metadata=metadata,
        )
