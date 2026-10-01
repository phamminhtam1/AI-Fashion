import os
import pytest
from app.classifiers.base import BaseClassifier
from app.models.schemas import (
    ClassifierOutput,
    TryOnGenerateRequest,
    VisibilityFlag,
)
from app.pipelines.tryon_pipeline import TryOnPipeline


class MockInvalidClassifier(BaseClassifier):
    async def classify(self, image_bytes: bytes) -> ClassifierOutput:
        return ClassifierOutput(
            visibility_flag=VisibilityFlag.INVALID,
            person_count=0,
            confidence=0.3,
        )


def test_pipeline_success(tmp_path):
    import asyncio
    user_file = tmp_path / "user.jpg"
    user_file.write_bytes(b"dummy user content")

    prod_file = tmp_path / "product.jpg"
    prod_file.write_bytes(b"dummy product content")

    pipeline = TryOnPipeline()

    req = TryOnGenerateRequest(
        job_id="pipeline-success-job",
        user_image_path=str(user_file),
        product_image_path=str(prod_file),
        variant_id="variant-uuid-123",
        visibility_flag=VisibilityFlag.FULL_BODY,
    )

    res = asyncio.run(pipeline.execute(req))

    assert res.status == "completed"
    assert res.visibility_flag == VisibilityFlag.FULL_BODY
    assert res.result_url is not None
    assert res.prompt_version == "v3-kie-sunburst"


def test_pipeline_invalid_user_image(tmp_path):
    import asyncio
    user_file = tmp_path / "user.jpg"
    user_file.write_bytes(b"dummy user content")

    prod_file = tmp_path / "product.jpg"
    prod_file.write_bytes(b"dummy product content")

    # Inject invalid classifier
    pipeline = TryOnPipeline(classifier=MockInvalidClassifier())

    req = TryOnGenerateRequest(
        job_id="pipeline-fail-job",
        user_image_path=str(user_file),
        product_image_path=str(prod_file),
        variant_id="variant-uuid-123",
    )

    res = asyncio.run(pipeline.execute(req))

    assert res.status == "failed"
    assert res.visibility_flag == VisibilityFlag.INVALID
    assert res.error_code == "invalid_tryon_image"
