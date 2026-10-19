import asyncio
import logging

import pytest

from app.features.content.schemas import ContentGenerateRequest
from app.features.content.agents.base import _extract_json_object
from app.features.content.workflow import ContentWorkflow


def content_payload() -> dict:
    return {
        "job_id": "content-job-001",
        "products": [
            {
                "id": "product-1",
                "name": "Đầm công sở cổ nơ",
                "description": "Chất liệu lụa, dáng midi.",
                "image_urls": ["https://example.com/dress.jpg"],
                "sku": "DRESS-001",
                "price": 649000,
            }
        ],
        "channels": ["facebook", "instagram", "tiktok"],
        "objective": "conversion",
        "audience": "Nữ công sở 25-35 tuổi",
        "tone": "Thanh lịch",
        "call_to_action": "Mua ngay",
        "openai_api_key": "must-never-appear-in-logs",
    }


def test_content_workflow_generates_every_requested_channel(caplog):
    caplog.set_level(logging.INFO, logger="ai_worker.content")
    response = asyncio.run(ContentWorkflow().execute(ContentGenerateRequest(**content_payload())))

    assert response.status == "completed"
    assert response.review and response.review.passed is True
    assert response.draft is not None
    assert {item.channel.value for item in response.draft.variants} == {"facebook", "instagram", "tiktok"}
    serialized = response.model_dump_json()
    assert "DRESS-001" not in serialized
    assert "649000" not in serialized
    assert "must-never-appear-in-logs" not in caplog.text

    for step in ("workflow", "product_understanding", "content_strategy", "copywriting", "quality_review"):
        assert f"[step={step}]" in caplog.text
    assert "[event=payload]" in caplog.text
    assert "[event=result]" in caplog.text


def test_content_request_requires_product_and_channel():
    payload = content_payload()
    payload["products"] = []
    with pytest.raises(ValueError):
        ContentGenerateRequest(**payload)


def test_extract_json_object_supports_gateway_markdown_and_prose():
    assert _extract_json_object('```json\n{"passed": true}\n```') == {"passed": True}
    assert _extract_json_object('Kết quả: {"score": 95}') == {"score": 95}
