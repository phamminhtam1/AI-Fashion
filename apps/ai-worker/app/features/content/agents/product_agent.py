import json

from ..prompts.templates import PRODUCT_SYSTEM_PROMPT
from ..schemas import ContentGenerateRequest, ProductBrief
from .base import StructuredAgent, log_step
from ....config import settings


class ProductAgent(StructuredAgent):
    def __init__(self):
        super().__init__("product_understanding", PRODUCT_SYSTEM_PROMPT, ProductBrief)

    async def run(self, req: ContentGenerateRequest) -> ProductBrief:
        payload = {
            "products": [
                p.model_dump(mode="json", exclude={"sku", "price"})
                for p in req.products
            ]
        }
        if not settings.ai_mock_mode:
            user_content = [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}]
            for product in req.products:
                for image_url in product.image_urls:
                    user_content.append({"type": "image_url", "image_url": {"url": image_url, "detail": "high"}})
            return await self.run_live(
                payload,
                req.openai_api_key,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_content},
                ],
            )
        log_step(self.step, "payload", payload)
        facts, selling, observations = [], [], []
        for product in req.products:
            facts.extend(filter(None, [product.name, product.description]))
            selling.append(product.name)
            observations.extend([f"Ảnh tham chiếu: {url}" for url in product.image_urls])
        result = ProductBrief(product_summary="; ".join(p.name for p in req.products), visual_observations=observations, verified_facts=facts, selling_points=selling, unknown_or_risky_claims=[])
        log_step(self.step, "result", result)
        return result

