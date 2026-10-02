from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class VisibilityFlag(str, Enum):
    FACE_ONLY = "FACE_ONLY"
    UPPER_BODY = "UPPER_BODY"
    THREE_QUARTER = "THREE_QUARTER"
    FULL_BODY = "FULL_BODY"
    INVALID = "INVALID"


class ClassifierOutput(BaseModel):
    visibility_flag: VisibilityFlag = Field(
        ...,
        description="Framing flag: FACE_ONLY, UPPER_BODY, THREE_QUARTER, FULL_BODY, or INVALID",
    )
    person_count: int = Field(default=1, description="Number of detected people")
    face_visible: bool = Field(default=True)
    upper_body_visible: bool = Field(default=True)
    lower_body_visible: bool = Field(default=True)
    feet_visible: bool = Field(default=True)
    occlusion_level: str = Field(default="low", description="low, medium, high")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class GarmentMetadata(BaseModel):
    category: str = Field(default="tops")
    garment_type: str = Field(default="apparel")
    primary_color: str = Field(default="solid")
    sleeve_length: Optional[str] = None
    neckline: Optional[str] = None
    length: Optional[str] = None
    pattern: Optional[str] = None
    has_buttons: Optional[bool] = None
    extra: Optional[Dict[str, Any]] = None


class GarmentAssetResult(BaseModel):
    reused_cache: bool = False
    output_path: Optional[str] = None
    image_url: Optional[str] = None
    storage_key: Optional[str] = None
    sha256: Optional[str] = None
    metadata: Optional[GarmentMetadata] = None


class TryOnGenerateRequest(BaseModel):
    job_id: str
    user_image_path: Optional[str] = None
    user_image_url: Optional[str] = None
    product_image_path: Optional[str] = None
    product_image_url: Optional[str] = None
    variant_id: Optional[str] = "default"
    visibility_flag: Optional[VisibilityFlag] = None
    cached_garment_path: Optional[str] = None
    cached_garment_url: Optional[str] = None
    cached_garment_metadata: Optional[GarmentMetadata] = None
    garment_image_path: Optional[str] = None
    garment_image_url: Optional[str] = None
    garment_metadata: Optional[GarmentMetadata] = None
    prompt: Optional[str] = None
    api_key: Optional[str] = None


class TryOnGenerateResponse(BaseModel):
    job_id: str
    status: str = "completed"  # completed | failed
    visibility_flag: Optional[VisibilityFlag] = None
    classifier: Optional[ClassifierOutput] = None
    garment: Optional[GarmentAssetResult] = None
    result_storage_key: Optional[str] = None
    result_path: Optional[str] = None
    result_url: Optional[str] = None
    prompt_used: Optional[str] = None
    prompt_version: str = "v3-kie-sunburst"
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class HealthResponse(BaseModel):
    ok: bool = True
    mock_mode: bool = False


# --- 3 Separated Stage APIs ---

class UserClassifyRequest(BaseModel):
    user_image_path: Optional[str] = Field(None, description="Local path to user photo")
    user_image_url: Optional[str] = Field(None, description="Public URL of user photo")


class UserClassifyResponse(BaseModel):
    ok: bool = True
    visibility_flag: VisibilityFlag
    person_count: int = 1
    face_visible: bool = True
    upper_body_visible: bool = True
    lower_body_visible: bool = True
    feet_visible: bool = True
    occlusion_level: str = "low"
    confidence: float = 1.0
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class GarmentExtractRequest(BaseModel):
    product_image_path: Optional[str] = Field(None, description="Local path to product photo")
    product_image_url: Optional[str] = Field(None, description="Public URL of product photo")
    variant_id: Optional[str] = Field(default="default", description="Product variant identifier")


class GarmentExtractResponse(BaseModel):
    ok: bool = True
    variant_id: Optional[str] = None
    garment_image_path: Optional[str] = None
    garment_image_url: Optional[str] = None
    metadata: GarmentMetadata
    error_code: Optional[str] = None
    error_message: Optional[str] = None



