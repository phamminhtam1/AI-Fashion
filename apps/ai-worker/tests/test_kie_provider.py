import pytest
import os
from unittest.mock import AsyncMock, patch, MagicMock
from app.config import settings
from app.models.schemas import VisibilityFlag, GarmentMetadata
from app.providers.kie_provider import KieTryOnProvider


def test_kie_provider_init():
    provider = KieTryOnProvider()
    assert provider.api_key == settings.kie_api_key
    assert "kie.ai" in provider.base_url
    assert provider.model == settings.kie_model


def test_kie_extract_output_image_url():
    # Test resultUrls array
    data1 = {"resultJson": '{"resultUrls": ["https://tempfile.aiquickdraw.com/test1.png"]}'}
    assert KieTryOnProvider._extract_output_image_url(data1) == "https://tempfile.aiquickdraw.com/test1.png"

    # Test images array
    data2 = {"resultJson": '{"images": ["https://tempfile.aiquickdraw.com/test2.png"]}'}
    assert KieTryOnProvider._extract_output_image_url(data2) == "https://tempfile.aiquickdraw.com/test2.png"

    # Test dict format with url
    data3 = {"resultJson": {"url": "https://tempfile.aiquickdraw.com/test3.png"}}
    assert KieTryOnProvider._extract_output_image_url(data3) == "https://tempfile.aiquickdraw.com/test3.png"

    # Test failure case
    with pytest.raises(ValueError):
        KieTryOnProvider._extract_output_image_url({"resultJson": "{}"})


@pytest.mark.anyio
async def test_kie_mock_generation(tmp_path):
    provider = KieTryOnProvider()
    target_path = str(tmp_path / "result.png")
    user_file = tmp_path / "user.png"
    user_file.write_bytes(b"dummy user")

    path, pub_url = await provider.generate_tryon(
        job_id="test-mock-job",
        user_image_path=str(user_file),
        visibility_flag=VisibilityFlag.UPPER_BODY,
        target_output_path=target_path,
    )

    assert os.path.exists(path)
    assert pub_url is not None


@pytest.mark.anyio
async def test_kie_create_task_live_mocked():
    provider = KieTryOnProvider(api_key="test-key")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "code": 200,
        "msg": "success",
        "data": {"taskId": "task-abc-123"}
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        task_id = await provider.create_task(
            prompt="Dress the person in the shirt",
            input_urls=["https://example.com/u.png", "https://example.com/g.png"],
        )
        assert task_id == "task-abc-123"
        mock_post.assert_called_once()
