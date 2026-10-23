import time

from .agents import CopywritingAgent
from .agents.base import log_step
from .schemas import ContentGenerateRequest, ContentGenerateResponse


class ContentWorkflow:
    """Generate publishable content with a single model call."""

    def __init__(self) -> None:
        self.copywriting_agent = CopywritingAgent()

    async def execute(self, req: ContentGenerateRequest) -> ContentGenerateResponse:
        started = time.perf_counter()
        safe_request = req.model_dump(mode="json", exclude={"openai_api_key"})
        log_step("workflow", "started", safe_request)
        try:
            draft = await self.copywriting_agent.run(req)
            response = ContentGenerateResponse(
                job_id=req.job_id,
                status="completed",
                draft=draft,
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
