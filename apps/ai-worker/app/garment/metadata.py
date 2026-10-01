import base64
import logging
from typing import Optional
from openai import AsyncOpenAI
from ..config import settings
from ..models.schemas import GarmentMetadata

logger = logging.getLogger(__name__)

METADATA_SYSTEM_PROMPT = """You are a fashion catalog analyzer.
Examine the clothing product image and return structured garment metadata:
- category (tops, bottoms, dresses, outerwear, etc.)
- garment_type (blazer, t-shirt, trousers, midi dress, etc.)
- primary_color
- sleeve_length (sleeveless, short, three-quarter, long)
- neckline (v-neck, round, collar, lapel, off-shoulder, etc.)
- length (crop, waist, hip, knee, maxi)
- pattern (solid, floral, striped, plaid, etc.)
- has_buttons (boolean)

Return JSON only conforming to the schema.
"""


class GarmentMetadataExtractor:
    def __init__(self, client: Optional[AsyncOpenAI] = None):
        base_url = settings.openai_base_url or None
        self.client = client
        if self.client is None and settings.openai_api_key:
            self.client = AsyncOpenAI(api_key=settings.openai_api_key, base_url=base_url)

    async def extract_metadata(self, image_bytes: bytes) -> GarmentMetadata:
        if settings.ai_mock_mode or not self.client:
            reason = "ai_mock_mode=True" if settings.ai_mock_mode else "API key missing/empty"
            logger.warning(f"[garment-metadata] Running in MOCK mode ({reason}) -> returning default blazer metadata")
            return GarmentMetadata(
                category="tops",
                garment_type="blazer",
                primary_color="navy blue",
                sleeve_length="long",
                neckline="lapel",
                length="hip",
                pattern="solid",
                has_buttons=True,
            )

        logger.info(f"[garment-metadata] Analyzing garment image ({len(image_bytes):,} bytes)")
        logger.info(f"[garment-metadata] Dispatching prompt to {settings.openai_base_url or 'https://api.openai.com/v1'} (model: {settings.openai_vision_model})")

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        messages = [
            {"role": "system", "content": METADATA_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Analyze the garment attributes in this product image."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64_image}",
                            "detail": "high",
                        },
                    },
                ],
            },
        ]

        # 1. Attempt structured output parse
        try:
            logger.info("[garment-metadata] Awaiting OpenAI beta parse for GarmentMetadata...")
            completion = await self.client.beta.chat.completions.parse(
                model=settings.openai_vision_model,
                messages=messages,
                response_format=GarmentMetadata,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is not None:
                logger.info(f"[garment-metadata] Extracted successfully: category={parsed.category}, type={parsed.garment_type}, color={parsed.primary_color}, sleeve={parsed.sleeve_length}, neck={parsed.neckline}, buttons={parsed.has_buttons}")
                return parsed
        except Exception as e:
            logger.warning(f"[garment-metadata] Beta parse failed ({e}), trying standard JSON completion...")

        # 2. Fallback to standard json_object
        try:
            logger.info("[garment-metadata] Awaiting OpenAI chat completion with json_object...")
            completion = await self.client.chat.completions.create(
                model=settings.openai_vision_model,
                messages=messages,
                response_format={"type": "json_object"},
            )
            content = completion.choices[0].message.content or "{}"
            clean_content = content.strip()
            if clean_content.startswith("```"):
                clean_content = clean_content.strip("`")
                if clean_content.startswith("json"):
                    clean_content = clean_content[4:].strip()
            parsed = GarmentMetadata.model_validate_json(clean_content)
            logger.info(f"[garment-metadata] Extracted via JSON: category={parsed.category}, type={parsed.garment_type}, color={parsed.primary_color}, sleeve={parsed.sleeve_length}, neck={parsed.neckline}, buttons={parsed.has_buttons}")
            return parsed
        except Exception as e:
            logger.error(f"[garment-metadata] Extraction failed, using default: {e}", exc_info=True)
            return GarmentMetadata()


