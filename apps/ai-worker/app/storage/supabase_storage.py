import logging
from typing import Optional
import httpx
from ..config import settings

logger = logging.getLogger(__name__)


class SupabaseStorageService:
    @classmethod
    def is_configured(cls) -> bool:
        return bool(settings.supabase_url and settings.supabase_service_role_key)

    @classmethod
    def get_public_url(cls, object_path: str, bucket: Optional[str] = None) -> str:
        b = bucket or settings.supabase_ai_bucket or "AI"
        base = (settings.supabase_url or "").rstrip("/")
        clean_path = object_path.lstrip("/")
        return f"{base}/storage/v1/object/public/{b}/{clean_path}"

    @classmethod
    async def upload_bytes(
        cls,
        data: bytes,
        object_path: str,
        content_type: str = "image/png",
        bucket: Optional[str] = None,
    ) -> Optional[str]:
        """
        Uploads image/file bytes directly to Supabase Storage.
        Returns the public URL if successful, or None if failed or not configured.
        """
        if not cls.is_configured():
            logger.info("[supabase-storage] Supabase credentials not set, skipping remote upload")
            return None

        b = bucket or settings.supabase_ai_bucket or "AI"
        base = (settings.supabase_url or "").rstrip("/")
        clean_path = object_path.lstrip("/")
        upload_url = f"{base}/storage/v1/object/{b}/{clean_path}"

        headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(upload_url, headers=headers, content=data)
                if res.status_code in (200, 201):
                    pub_url = cls.get_public_url(clean_path, bucket=b)
                    logger.info(f"[supabase-storage] Uploaded {len(data)} bytes to Supabase bucket '{b}' -> {pub_url}")
                    return pub_url
                else:
                    logger.error(f"[supabase-storage] Upload to Supabase failed ({res.status_code}): {res.text}")
                    return None
        except Exception as e:
            logger.error(f"[supabase-storage] Upload exception: {e}", exc_info=True)
            return None
