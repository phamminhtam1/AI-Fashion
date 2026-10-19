from ..prompts.templates import STRATEGY_SYSTEM_PROMPT
from ..schemas import ChannelPlan, ContentGenerateRequest, ContentPlan, ProductBrief
from .base import StructuredAgent, log_step
from ....config import settings


class StrategyAgent(StructuredAgent):
    def __init__(self):
        super().__init__("content_strategy", STRATEGY_SYSTEM_PROMPT, ContentPlan)

    async def run(self, req: ContentGenerateRequest, brief: ProductBrief) -> ContentPlan:
        payload = {
            "request": req.model_dump(
                mode="json",
                exclude={"openai_api_key": True, "products": {"__all__": {"sku", "price"}}},
            ),
            "product_brief": brief.model_dump(mode="json"),
        }
        if not settings.ai_mock_mode:
            return await self.run_live(payload, req.openai_api_key)
        log_step(self.step, "payload", payload)
        result = ContentPlan(key_message=brief.product_summary, audience_insight=req.audience, content_angle=f"{req.objective.value}: {brief.selling_points[0]}", call_to_action=req.call_to_action or "Khám phá sản phẩm ngay", channel_plans=[ChannelPlan(channel=c, format="social_post", hook_direction="Nêu điểm nổi bật của sản phẩm", structure=["Hook", "Lợi ích", "CTA"], target_length=req.length) for c in req.channels])
        log_step(self.step, "result", result)
        return result
