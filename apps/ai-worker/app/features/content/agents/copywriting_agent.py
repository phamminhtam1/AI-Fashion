from ..prompts.templates import COPY_SYSTEM_PROMPT
from ..schemas import ChannelContent, ContentDraft, ContentGenerateRequest, ContentPlan, ProductBrief
from .base import StructuredAgent, log_step
from ....config import settings


class CopywritingAgent(StructuredAgent):
    def __init__(self):
        super().__init__("copywriting", COPY_SYSTEM_PROMPT, ContentDraft)

    async def run(self, req: ContentGenerateRequest, brief: ProductBrief, plan: ContentPlan) -> ContentDraft:
        payload = {
            "request": req.model_dump(
                mode="json",
                exclude={"openai_api_key": True, "products": {"__all__": {"sku", "price"}}},
            ),
            "product_brief": brief.model_dump(mode="json"),
            "content_plan": plan.model_dump(mode="json"),
        }
        if not settings.ai_mock_mode:
            return await self.run_live(payload, req.openai_api_key)
        log_step(self.step, "payload", payload)
        variants = []
        for item in plan.channel_plans:
            promotion = f" {req.promotion}" if req.promotion else ""
            variants.append(ChannelContent(channel=item.channel, headline=brief.product_summary, caption=f"{brief.product_summary}.{promotion} {plan.call_to_action}", call_to_action=plan.call_to_action, hashtags=["ELANE", "Thoitrangnu"], visual_brief="Giữ nguyên sản phẩm, ánh sáng studio thanh lịch" if req.generate_visual_brief else None))
        result = ContentDraft(master_message=plan.key_message, variants=variants)
        log_step(self.step, "result", result)
        return result
