import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["mock_mode"] is True


def test_stage1_user_classify(tmp_path):
    user_file = tmp_path / "user.png"
    user_file.write_bytes(b"dummy user photo bytes")

    res = client.post(
        "/v1/user/classify",
        json={"user_image_path": str(user_file)},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert "visibility_flag" in data
    assert data["confidence"] >= 0.0


def test_stage2_garment_extract_direct(tmp_path):
    img_file = tmp_path / "shirt.png"
    img_file.write_bytes(b"dummy image bytes")

    res = client.post(
        "/v1/garment/extract",
        json={
            "product_image_path": str(img_file),
            "variant_id": "test-var-456",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["variant_id"] == "test-var-456"
    assert "metadata" in data
    assert data["metadata"]["category"] == "tops"
    assert "garment_image_path" in data


def test_stage3_kie_tryon(tmp_path):
    user_file = tmp_path / "user.png"
    user_file.write_bytes(b"dummy user")
    garment_file = tmp_path / "garment.png"
    garment_file.write_bytes(b"dummy garment")

    res = client.post(
        "/v1/try-on/generate",
        json={
            "job_id": "test-kie-job-1",
            "user_image_path": str(user_file),
            "garment_image_path": str(garment_file),
            "visibility_flag": "UPPER_BODY",
            "garment_metadata": {
                "category": "tops",
                "garment_type": "shirt",
                "primary_color": "white",
            },
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["job_id"] == "test-kie-job-1"
    assert data["status"] == "completed"
    assert data["result_url"] is not None
    assert data["prompt_version"] == "v3-kie-sunburst"
