from ..prompts.templates import REVISION_SYSTEM_PROMPT
from ..schemas import ContentDraft, ContentGenerateRequest, ProductBrief, ReviewResult
from .base import StructuredAgent, log_step
from ....config import settings


class RevisionAgent(StructuredAgent):
    def __init__(self):
        super().__init__("content_revision", REVISION_SYSTEM_PROMPT, ContentDraft)

    async def run(self, req: ContentGenerateRequest, brief: ProductBrief, draft: ContentDraft, review: ReviewResult) -> ContentDraft:
        payload = {
            "request": req.model_dump(
                mode="json",
                exclude={"openai_api_key": True, "products": {"__all__": {"sku", "price"}}},
            ),
            "product_brief": brief.model_dump(mode="json"),
            "draft": draft.model_dump(mode="json"),
            "review": review.model_dump(mode="json"),
        }
        if not settings.ai_mock_mode:
            return await self.run_live(payload, req.openai_api_key)
        log_step(self.step, "payload", payload)
        log_step(self.step, "result", draft)
        return draft
