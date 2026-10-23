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
    openai_api_key: Optional[str] = None


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


class ContentGenerateResponse(BaseModel):
    job_id: str
    status: Literal["completed", "failed"]
    draft: Optional[ContentDraft] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
