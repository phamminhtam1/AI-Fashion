from ..prompts.templates import REVIEW_SYSTEM_PROMPT
from ..schemas import ContentDraft, ContentGenerateRequest, ProductBrief, ReviewResult
from .base import StructuredAgent, log_step
from ....config import settings


class ReviewAgent(StructuredAgent):
    def __init__(self):
        super().__init__("quality_review", REVIEW_SYSTEM_PROMPT, ReviewResult)

    async def run(self, req: ContentGenerateRequest, brief: ProductBrief, draft: ContentDraft) -> ReviewResult:
        payload = {"requested_channels": [c.value for c in req.channels], "product_brief": brief.model_dump(mode="json"), "draft": draft.model_dump(mode="json")}
        if not settings.ai_mock_mode:
            return await self.run_live(payload, req.openai_api_key)
        log_step(self.step, "payload", payload)
        actual = {v.channel for v in draft.variants}
        missing = [c.value for c in req.channels if c not in actual]
        result = ReviewResult(passed=not missing, score=95 if not missing else 60, issues=[f"Thiếu nội dung cho {c}" for c in missing], revision_instructions=[f"Bổ sung phiên bản {c}" for c in missing])
        log_step(self.step, "result", result)
        return result
