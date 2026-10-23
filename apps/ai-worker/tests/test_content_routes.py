from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_generate_content_endpoint():
    response = client.post(
        "/v1/content/generate",
        json={
            "job_id": "api-content-001",
            "products": [
                {
                    "id": "p-1",
                    "name": "Áo sơ mi lụa",
                    "description": "Form suông, màu kem",
                    "image_urls": ["https://example.com/shirt.jpg"],
                }
            ],
            "channels": ["facebook", "instagram"],
            "objective": "engagement",
            "tone": "Tinh tế",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == "api-content-001"
    assert data["status"] == "completed"
    assert len(data["draft"]["variants"]) == 2


def test_generate_content_rejects_empty_products():
    response = client.post(
        "/v1/content/generate",
        json={"job_id": "invalid", "products": [], "channels": ["facebook"]},
    )
    assert response.status_code == 422
