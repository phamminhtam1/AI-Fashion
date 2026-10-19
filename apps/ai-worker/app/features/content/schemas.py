from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ContentChannel(str, Enum):
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"


class ContentObjective(str, Enum):
    AWARENESS = "awareness"
    ENGAGEMENT = "engagement"
    CONVERSION = "conversion"
    LAUNCH = "launch"


class ProductInput(BaseModel):
    id: str
    name: str
    description: str = ""
    image_urls: list[str] = Field(default_factory=list)
    sku: Optional[str] = None
    price: Optional[int] = None
    category: Optional[str] = None
    attributes: dict[str, Any] = Field(default_factory=dict)


class ContentGenerateRequest(BaseModel):
    job_id: str
    products: list[ProductInput] = Field(min_length=1)
    channels: list[ContentChannel] = Field(min_length=1)
    objective: ContentObjective = ContentObjective.ENGAGEMENT
    audience: str = "Nữ công sở 25-35 tuổi"
    tone: str = "Thanh lịch, hiện đại và truyền cảm hứng"
    language: str = "vi"
    length: Literal["short", "medium", "long"] = "medium"
    call_to_action: Optional[str] = None
    promotion: Optional[str] = None
    custom_instructions: Optional[str] = None
    brand_context: Optional[str] = None
    generate_visual_brief: bool = True
    max_revision_rounds: int = Field(default=1, ge=0, le=3)
    openai_api_key: Optional[str] = None


class ProductBrief(BaseModel):
    product_summary: str
    visual_observations: list[str] = Field(default_factory=list)
    verified_facts: list[str] = Field(default_factory=list)
    selling_points: list[str] = Field(default_factory=list)
    unknown_or_risky_claims: list[str] = Field(default_factory=list)


class ChannelPlan(BaseModel):
    channel: ContentChannel
    format: str
    hook_direction: str
    structure: list[str] = Field(default_factory=list)
    target_length: str


class ContentPlan(BaseModel):
    key_message: str
    audience_insight: str
    content_angle: str
    call_to_action: str
    channel_plans: list[ChannelPlan]


class ChannelContent(BaseModel):
    channel: ContentChannel
    headline: str
    caption: str
    call_to_action: str
    hashtags: list[str] = Field(default_factory=list)
    visual_brief: Optional[str] = None


class ContentDraft(BaseModel):
    master_message: str
    variants: list[ChannelContent]


class ReviewResult(BaseModel):
    passed: bool
    score: int = Field(ge=0, le=100)
    issues: list[str] = Field(default_factory=list)
    revision_instructions: list[str] = Field(default_factory=list)


class ContentGenerateResponse(BaseModel):
    job_id: str
    status: Literal["completed", "failed"]
    product_brief: Optional[ProductBrief] = None
    content_plan: Optional[ContentPlan] = None
    draft: Optional[ContentDraft] = None
    review: Optional[ReviewResult] = None
    revision_rounds: int = 0
    error_code: Optional[str] = None
    error_message: Optional[str] = None
