import base64
import json
import logging
from typing import Optional
from openai import AsyncOpenAI
from ..config import settings
from ..models.schemas import ClassifierOutput, VisibilityFlag
from .base import BaseClassifier

logger = logging.getLogger(__name__)

CLASSIFIER_SYSTEM_PROMPT = """You are an image classifier for a fashion virtual try-on system.

Analyze only the visibility and framing of the primary person.

Return exactly one visibility_flag:
- FACE_ONLY
- UPPER_BODY
- THREE_QUARTER
- FULL_BODY
- INVALID

Definitions:
FACE_ONLY: mostly head/face visible. Torso not sufficiently visible.
UPPER_BODY: head and torso visible, legs not sufficiently visible.
THREE_QUARTER: head, torso, hips and most legs visible, but full body is incomplete (e.g. cropped feet).
FULL_BODY: head to feet are clearly visible.
INVALID: no clear single person, severe occlusion, very blurry image, unsuitable framing or ambiguous multiple people.

Return:
person_count
face_visible
upper_body_visible
lower_body_visible
feet_visible
occlusion_level (low, medium, high)
confidence (0.0 to 1.0)

Return JSON only. Do not analyze age, race, gender, or unrelated traits.
"""


class OpenAIClassifier(BaseClassifier):
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.api_key = settings.openai_api_key if api_key is None else api_key
        self.base_url = settings.openai_base_url if base_url is None else base_url
        self.model = model or settings.openai_vision_model
        self.client = (
            AsyncOpenAI(api_key=self.api_key, base_url=self.base_url or None)
            if self.api_key
            else None
        )
        if not self.api_key:
            logger.warning("[classifier] OpenAI API key is missing or empty. Classifier will operate in MOCK mode.")
        else:
            logger.info(f"[classifier] Initialized OpenAI client -> base_url={self.base_url or 'https://api.openai.com/v1'}, model={self.model}")

    async def classify(self, image_bytes: bytes) -> ClassifierOutput:
        # Mock mode fallback
        if settings.ai_mock_mode or not self.client:
            reason = "ai_mock_mode=True" if settings.ai_mock_mode else "API key missing/empty"
            logger.warning(f"[classifier] Running in MOCK mode ({reason}) -> returning default FULL_BODY")
            return ClassifierOutput(
                visibility_flag=VisibilityFlag.FULL_BODY,
                person_count=1,
                face_visible=True,
                upper_body_visible=True,
                lower_body_visible=True,
                feet_visible=True,
                occlusion_level="low",
                confidence=0.98,
            )

        logger.info(f"[classifier] Starting classification for user image ({len(image_bytes):,} bytes)")
        logger.info(f"[classifier] Dispatching vision prompt to: {self.base_url or 'https://api.openai.com/v1'} (model: {self.model})")

        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        messages = [
            {"role": "system", "content": CLASSIFIER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Analyze the framing and person visibility in this image for virtual try-on.",
                    },
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
            logger.info("[classifier] Awaiting OpenAI beta.chat.completions.parse...")
            completion = await self.client.beta.chat.completions.parse(
                model=self.model,
                messages=messages,
                response_format=ClassifierOutput,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is not None:
                logger.info(f"[classifier] Succeeded via structured parse: framing={parsed.visibility_flag.value}, confidence={parsed.confidence:.2f}, people={parsed.person_count}, face={parsed.face_visible}, upper={parsed.upper_body_visible}, lower={parsed.lower_body_visible}, feet={parsed.feet_visible}")
                return parsed
        except Exception as e:
            logger.warning(f"[classifier] Beta parse failed ({e}), falling back to standard JSON completion...")

        # 2. Resilient fallback for custom OpenAI-compatible gateways
        try:
            logger.info("[classifier] Awaiting OpenAI chat.completions.create with json_object...")
            completion = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                response_format={"type": "json_object"},
            )
            content = completion.choices[0].message.content or "{}"
            clean_content = content.strip()
            if clean_content.startswith("```"):
                clean_content = clean_content.strip("`")
                if clean_content.startswith("json"):
                    clean_content = clean_content[4:].strip()
            parsed = ClassifierOutput.model_validate_json(clean_content)
            logger.info(f"[classifier] Succeeded via JSON parse: framing={parsed.visibility_flag.value}, confidence={parsed.confidence:.2f}, people={parsed.person_count}, face={parsed.face_visible}, upper={parsed.upper_body_visible}, lower={parsed.lower_body_visible}, feet={parsed.feet_visible}")
            return parsed
        except Exception as e:
            logger.error(f"[classifier] OpenAI vision call failed: {e}", exc_info=True)
            raise


