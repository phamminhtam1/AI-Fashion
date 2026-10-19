"""AI content generation domain.

The domain is intentionally scaffolded separately from virtual try-on so its
agents, prompts, schemas, and workflow can evolve without coupling the two
pipelines.
"""
from .schemas import ContentGenerateRequest, ContentGenerateResponse
from .workflow import ContentWorkflow

__all__ = ["ContentWorkflow", "ContentGenerateRequest", "ContentGenerateResponse"]
