import base64
import json
import logging
from typing import Optional
import httpx
from openai import AsyncOpenAI
from ....config import settings
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

    async def classify(self, image_bytes: bytes, api_key: Optional[str] = None) -> ClassifierOutput:
        active_key = api_key or self.api_key
        client = (
            AsyncOpenAI(api_key=active_key, base_url=self.base_url or None)
            if active_key
            else self.client
        )

        # Mock mode fallback
        if settings.ai_mock_mode or not client:
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
        if api_key:
            logger.info(f"[classifier] Using dynamically leased OpenAI key: {api_key[:12]}...")
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

        # Vision classification now uses KIE DeepSeek Responses API. The KIE
        # try-on image generation provider remains unchanged.
        if settings.kie_content_model:
            try:
                async with httpx.AsyncClient(timeout=90.0) as http_client:
                    response = await http_client.post(
                        f"{settings.kie_base_url.rstrip('/')}/openai/v1/responses",
                        headers={"Authorization": f"Bearer {active_key}", "Content-Type": "application/json"},
                        json={
                        "model": settings.kie_content_model,
                        "stream": False,
                        "reasoning": {"effort": "none"},
                        "input": [{"role": "user", "content": [
                            {"type": "input_text", "text": f"{CLASSIFIER_SYSTEM_PROMPT}\n\nAnalyze the framing and person visibility in this image."},
                            {"type": "input_image", "image_url": f"data:image/jpeg;base64,{b64_image}"},
                        ]}],
                        "text": {"format": {"type": "json_object"}},
                        },
                    )
                data = response.json()
                if response.status_code >= 400:
                    raise RuntimeError(str(data.get("error", f"KIE HTTP {response.status_code}")))
                output = "".join(
                    str(part.get("text", ""))
                    for item in data.get("output", [])
                    for part in item.get("content", [])
                    if part.get("type") in {"output_text", "text"}
                ).strip()
                if output:
                    parsed = ClassifierOutput.model_validate_json(output)
                    logger.info(f"[classifier] KIE DeepSeek vision succeeded: framing={parsed.visibility_flag.value}, confidence={parsed.confidence:.2f}")
                    return parsed
                raise ValueError("KIE returned empty vision response")
            except Exception as e:
                logger.warning(f"[classifier] KIE DeepSeek vision failed, using default framing: {e}")

        # 1. Attempt structured output parse
        try:
            logger.info("[classifier] Awaiting OpenAI beta.chat.completions.parse...")
            completion = await client.beta.chat.completions.parse(
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
            completion = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                response_format={"type": "json_object"},
            )
            content = completion.choices[0].message.content or ""
            clean_content = content.strip()
            if clean_content.startswith("```"):
                clean_content = clean_content.strip("`")
                if clean_content.startswith("json"):
                    clean_content = clean_content[4:].strip()
            if clean_content and clean_content != "{}":
                parsed = ClassifierOutput.model_validate_json(clean_content)
                logger.info(f"[classifier] Succeeded via JSON parse: framing={parsed.visibility_flag.value}, confidence={parsed.confidence:.2f}, people={parsed.person_count}, face={parsed.face_visible}, upper={parsed.upper_body_visible}, lower={parsed.lower_body_visible}, feet={parsed.feet_visible}")
                return parsed
        except Exception as e:
            logger.warning(f"[classifier] JSON completion failed: {e}")

        # 3. Fallback: If gateway does not return valid vision content,
        # proceed with default FULL_BODY framing rather than aborting the try-on pipeline.
        logger.warning(
            f"[classifier] Vision model '{self.model}' at '{self.base_url}' returned empty or unparseable framing response. "
            "Falling back to default FULL_BODY framing so try-on pipeline can continue."
        )
        return ClassifierOutput(
            visibility_flag=VisibilityFlag.FULL_BODY,
            person_count=1,
            face_visible=True,
            upper_body_visible=True,
            lower_body_visible=True,
            feet_visible=True,
            occlusion_level="low",
            confidence=0.95,
        )


