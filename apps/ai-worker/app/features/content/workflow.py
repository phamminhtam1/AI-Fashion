import time

from .agents import CopywritingAgent, ProductAgent, ReviewAgent, RevisionAgent, StrategyAgent
from .agents.base import log_step
from .schemas import ContentGenerateRequest, ContentGenerateResponse


class ContentWorkflow:
    """Orchestrates content generation and emits inspectable structured logs."""

    def __init__(self) -> None:
        self.product_agent = ProductAgent()
        self.strategy_agent = StrategyAgent()
        self.copywriting_agent = CopywritingAgent()
        self.review_agent = ReviewAgent()
        self.revision_agent = RevisionAgent()

    async def execute(self, req: ContentGenerateRequest) -> ContentGenerateResponse:
        started = time.perf_counter()
        safe_request = req.model_dump(mode="json", exclude={"openai_api_key"})
        log_step("workflow", "started", safe_request)
        try:
            brief = await self.product_agent.run(req)
            plan = await self.strategy_agent.run(req, brief)
            draft = await self.copywriting_agent.run(req, brief, plan)
            review = await self.review_agent.run(req, brief, draft)

            revision_rounds = 0
            while not review.passed and revision_rounds < req.max_revision_rounds:
                revision_rounds += 1
                log_step(
                    "workflow",
                    "revision_started",
                    {"job_id": req.job_id, "round": revision_rounds, "issues": review.issues},
                )
                draft = await self.revision_agent.run(req, brief, draft, review)
                review = await self.review_agent.run(req, brief, draft)

            response = ContentGenerateResponse(
                job_id=req.job_id,
                status="completed",
                product_brief=brief,
                content_plan=plan,
                draft=draft,
                review=review,
                revision_rounds=revision_rounds,
            )
            log_step("workflow", "result", response)
            log_step(
                "workflow",
                "completed",
                {"job_id": req.job_id, "duration_ms": round((time.perf_counter() - started) * 1000, 2)},
            )
            return response
        except Exception as exc:
            log_step(
                "workflow",
                "failed",
                {
                    "job_id": req.job_id,
                    "error_type": type(exc).__name__,
                    "error": str(exc),
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            return ContentGenerateResponse(
                job_id=req.job_id,
                status="failed",
                error_code="content_generation_failed",
                error_message=str(exc),
            )
