import pytest
from unittest.mock import patch, AsyncMock
from app.storage.supabase_storage import SupabaseStorageService
from app.config import settings


def test_supabase_storage_is_configured():
    with patch.object(settings, "supabase_url", "https://xyz.supabase.co"), \
         patch.object(settings, "supabase_service_role_key", "secret-key"):
        assert SupabaseStorageService.is_configured() is True

    with patch.object(settings, "supabase_url", ""):
        assert SupabaseStorageService.is_configured() is False


def test_supabase_storage_get_public_url():
    with patch.object(settings, "supabase_url", "https://xyz.supabase.co"), \
         patch.object(settings, "supabase_ai_bucket", "AI"):
        url = SupabaseStorageService.get_public_url("garments/shirt_1.png")
        assert url == "https://xyz.supabase.co/storage/v1/object/public/AI/garments/shirt_1.png"


@pytest.mark.anyio
async def test_supabase_storage_upload_bytes_mock():
    with patch.object(settings, "supabase_url", "https://xyz.supabase.co"), \
         patch.object(settings, "supabase_service_role_key", "secret-key"), \
         patch.object(settings, "supabase_ai_bucket", "AI"):
        
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.text = '{"Key": "AI/garments/shirt_1.png"}'

        with patch("httpx.AsyncClient.post", return_value=mock_response):
            result = await SupabaseStorageService.upload_bytes(
                data=b"dummy-image",
                object_path="garments/shirt_1.png",
                content_type="image/png",
            )
            assert result == "https://xyz.supabase.co/storage/v1/object/public/AI/garments/shirt_1.png"
