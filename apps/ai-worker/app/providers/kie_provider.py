import asyncio
import io
import json
import logging
import os
from pathlib import Path
from typing import List, Optional, Tuple
import httpx
from PIL import Image

from ..config import settings
from ..models.schemas import GarmentMetadata, VisibilityFlag
from ..prompts.tryon_prompt_builder import TryOnPromptBuilder
from ..storage.supabase_storage import SupabaseStorageService
from .base import TryOnProvider

logger = logging.getLogger(__name__)


class KieTryOnProvider(TryOnProvider):
    """
    Virtual Try-On Provider using Kie.ai GPT Image 2.5 API
    (Model: gpt-image-2-5-sunburst-image-to-image).
    Operates strictly with public image URLs, without Base64.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key or settings.kie_api_key
        self.base_url = (base_url or settings.kie_base_url or "https://api.kie.ai").rstrip("/")
        self.model = model or settings.kie_model or "gpt-image-2-5-sunburst-image-to-image"
        self.timeout_seconds = settings.kie_timeout_seconds
        self.poll_interval = settings.kie_polling_interval_seconds

    async def _resolve_public_url(
        self,
        raw_url: Optional[str] = None,
        raw_path: Optional[str] = None,
        job_id: str = "temp",
        tag: str = "img",
    ) -> Optional[str]:
        """
        Ensures the image is accessible via a public HTTP/HTTPS URL for Kie.ai.
        If only local path is provided, stages it to Supabase Storage.
        """
        # 1. Clean and check existing HTTP URL
        if raw_url:
            clean_url = raw_url.strip()
            if (
                clean_url.startswith("http://") or clean_url.startswith("https://")
            ) and clean_url not in ("string", "null", "undefined"):
                return clean_url

        # 2. If disk path exists, read bytes and upload to Supabase Storage
        if raw_path and os.path.exists(raw_path):
            try:
                with open(raw_path, "rb") as f:
                    image_bytes = f.read()
                if SupabaseStorageService.is_configured():
                    object_path = f"temp_inputs/{job_id}_{tag}.png"
                    pub_url = await SupabaseStorageService.upload_bytes(
                        data=image_bytes,
                        object_path=object_path,
                        content_type="image/png",
                    )
                    if pub_url:
                        logger.info(f"[kie-provider] Staged {tag} image to Supabase: {pub_url}")
                        return pub_url
            except Exception as e:
                logger.warning(f"[kie-provider] Failed staging disk file {raw_path}: {e}")

        return None

    async def create_task(
        self,
        prompt: str,
        input_urls: List[str],
        aspect_ratio: str = "auto",
        resolution: str = "1K",
        background: str = "auto",
    ) -> str:
        """Submits a new generation task to Kie.ai."""
        endpoint = f"{self.base_url}/api/v1/jobs/createTask"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "input": {
                "prompt": prompt,
                "input_urls": input_urls,
                "aspect_ratio": aspect_ratio,
                "resolution": resolution,
                "background": background,
            },
        }

        logger.info(f"[kie-provider] Submitting task to Kie.ai ({self.model}) with {len(input_urls)} reference URLs")
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Kie.ai createTask HTTP {resp.status_code}: {resp.text}")

            res_json = resp.json()
            if res_json.get("code") != 200:
                raise RuntimeError(f"Kie.ai createTask returned error: {res_json.get('msg')} ({res_json})")

            data = res_json.get("data", {})
            task_id = data.get("taskId") or data.get("recordId")
            if not task_id:
                raise RuntimeError(f"Kie.ai response missing taskId: {res_json}")

            logger.info(f"[kie-provider] Task created successfully. Task ID: {task_id}")
            return task_id

    async def poll_task(self, task_id: str) -> dict:
        """Polls Kie.ai /api/v1/jobs/recordInfo until task completes or fails."""
        endpoint = f"{self.base_url}/api/v1/jobs/recordInfo"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }
        params = {"taskId": task_id}

        start_time = asyncio.get_event_loop().time()
        poll_count = 0

        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                poll_count += 1
                elapsed = asyncio.get_event_loop().time() - start_time
                if self.timeout_seconds and self.timeout_seconds > 0 and elapsed > self.timeout_seconds:
                    raise TimeoutError(f"Kie.ai task {task_id} timed out after {int(elapsed)}s")

                try:
                    resp = await client.get(endpoint, headers=headers, params=params)
                    if resp.status_code == 200:
                        body = resp.json()
                        data = body.get("data", {})
                        state = data.get("state")
                        logger.info(f"[kie-provider] Poll #{poll_count} ({int(elapsed)}s) for {task_id}: state='{state}'")

                        if state == "success":
                            return data
                        elif state == "fail":
                            fail_msg = data.get("failMsg") or "Unknown failure"
                            fail_code = data.get("failCode") or "FAIL"
                            raise RuntimeError(f"Kie.ai generation failed: {fail_msg} (code: {fail_code})")
                    else:
                        logger.warning(f"[kie-provider] Poll #{poll_count} received HTTP {resp.status_code}")
                except (httpx.RequestError, httpx.TimeoutException) as req_err:
                    logger.warning(f"[kie-provider] Poll #{poll_count} request error: {req_err}")

                await asyncio.sleep(self.poll_interval)

    @staticmethod
    def _extract_output_image_url(data: dict) -> str:
        """Extracts the generated image URL from Kie.ai resultJson response."""
        result_json = data.get("resultJson") or ""
        if isinstance(result_json, str):
            try:
                result_obj = json.loads(result_json) if result_json.strip() else {}
            except Exception:
                result_obj = {}
        else:
            result_obj = result_json

        if isinstance(result_obj, dict):
            urls = result_obj.get("resultUrls") or result_obj.get("images") or result_obj.get("image_urls")
            if urls and isinstance(urls, list) and len(urls) > 0:
                return str(urls[0])
            if result_obj.get("url"):
                return str(result_obj["url"])
            if result_obj.get("output"):
                out = result_obj["output"]
                return str(out[0]) if isinstance(out, list) and len(out) > 0 else str(out)

        raise ValueError(f"Could not parse valid image URL from Kie.ai result: {data}")

    async def generate_tryon(
        self,
        job_id: str,
        user_image_url: Optional[str] = None,
        garment_image_url: Optional[str] = None,
        user_image_path: Optional[str] = None,
        garment_image_path: Optional[str] = None,
        visibility_flag: VisibilityFlag = VisibilityFlag.UPPER_BODY,
        garment_metadata: Optional[GarmentMetadata] = None,
        custom_prompt: Optional[str] = None,
        target_output_path: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Executes virtual try-on using Kie.ai GPT Image 2.5 Sunburst.
        Returns: (target_output_path, public_url)
        """
        # Mock Mode handling
        if settings.ai_mock_mode or not self.api_key:
            logger.info(f"[kie-provider] Running in MOCK mode for job '{job_id}'")
            return await self._generate_mock_fallback(
                job_id=job_id,
                target_output_path=target_output_path,
                user_image_path=user_image_path,
            )

        # 1. Resolve public reference URLs for User and Garment
        u_url = await self._resolve_public_url(
            raw_url=user_image_url,
            raw_path=user_image_path,
            job_id=job_id,
            tag="user",
        )
        g_url = await self._resolve_public_url(
            raw_url=garment_image_url,
            raw_path=garment_image_path,
            job_id=job_id,
            tag="garment",
        )

        if not u_url or not g_url:
            raise ValueError(
                f"Kie.ai requires public URLs for both images. "
                f"Resolved: user_url={bool(u_url)}, garment_url={bool(g_url)}. "
                "Ensure Supabase Storage credentials are configured if providing local paths."
            )

        # 2. Build synthesis prompt for GPT Image 2.5 Sunburst
        prompt = custom_prompt or TryOnPromptBuilder.build_prompt(
            visibility_flag=visibility_flag,
            metadata=garment_metadata,
        )

        # 3. Create task on Kie.ai
        input_urls = [u_url, g_url]
        task_id = await self.create_task(
            prompt=prompt,
            input_urls=input_urls,
            aspect_ratio="auto",
            resolution="1K",
            background="auto",
        )

        # 4. Poll until completed
        data = await self.poll_task(task_id)
        result_img_url = self._extract_output_image_url(data)
        logger.info(f"[kie-provider] Received generated image URL: {result_img_url}")

        # 5. Download result image bytes
        async with httpx.AsyncClient(timeout=60.0) as client:
            img_resp = await client.get(result_img_url)
            img_resp.raise_for_status()
            result_bytes = img_resp.content

        # 6. Upload directly to Supabase Storage for permanent persistence (no local disk save)
        object_key = f"results/tryon_{job_id}.png"
        public_url = await SupabaseStorageService.upload_bytes(
            data=result_bytes,
            object_path=object_key,
            content_type="image/png",
        )
        if not public_url:
            public_url = result_img_url

        logger.info(f"[kie-provider] Virtual Try-On completed successfully for job '{job_id}' -> {public_url}")
        return None, public_url

    async def generate(
        self,
        job_id: str,
        user_image_path: str,
        garment_image_path: str,
        prompt: str,
        metadata: Optional[GarmentMetadata] = None,
        target_output_path: Optional[str] = None,
    ) -> str:
        """Implements base TryOnProvider interface."""
        path, pub_url = await self.generate_tryon(
            job_id=job_id,
            user_image_path=user_image_path,
            garment_image_path=garment_image_path,
            custom_prompt=prompt,
            garment_metadata=metadata,
            target_output_path=target_output_path,
        )
        return pub_url or path

    async def _generate_mock_fallback(
        self,
        job_id: str,
        target_output_path: str,
        user_image_path: Optional[str] = None,
    ) -> Tuple[str, str]:
        """Generates mock try-on image for unit tests or mock environment."""
        result_bytes: Optional[bytes] = None
        if user_image_path and os.path.exists(user_image_path):
            try:
                with open(user_image_path, "rb") as f:
                    result_bytes = f.read()
            except Exception:
                pass

        if not result_bytes:
            blank = Image.new("RGBA", (768, 1024), color=(240, 245, 250, 255))
            buf = io.BytesIO()
            blank.save(buf, format="PNG")
            result_bytes = buf.getvalue()

        if target_output_path:
            Path(os.path.dirname(target_output_path)).mkdir(parents=True, exist_ok=True)
            with open(target_output_path, "wb") as f:
                f.write(result_bytes)

        pub_url = await SupabaseStorageService.upload_bytes(
            data=result_bytes,
            object_path=f"results/tryon_{job_id}.png",
            content_type="image/png",
        )
        return target_output_path, pub_url or f"file://{target_output_path}"
