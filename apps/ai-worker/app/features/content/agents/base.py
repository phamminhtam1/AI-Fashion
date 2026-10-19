import json
import logging
import time
from typing import Any, Optional, TypeVar, Type

from openai import AsyncOpenAI
from pydantic import BaseModel

from ....config import settings

logger = logging.getLogger("ai_worker.content")
T = TypeVar("T", bound=BaseModel)


def log_step(step: str, event: str, payload: object) -> None:
    if isinstance(payload, BaseModel):
        value = payload.model_dump(mode="json", exclude={"openai_api_key"})
    else:
        value = payload
    value = _redact_secrets(value)
    logger.info("[content][step=%s][event=%s] %s", step, event, json.dumps(value, ensure_ascii=False, default=str))


def _redact_secrets(value: object) -> object:
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if key.lower() in {"openai_api_key", "api_key", "authorization"} else _redact_secrets(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_secrets(item) for item in value]
    return value


class StructuredAgent:
    def __init__(self, step: str, system_prompt: str, response_model: Type[T]):
        self.step = step
        self.system_prompt = system_prompt
        self.response_model = response_model

    async def run_live(
        self,
        payload: dict,
        api_key: Optional[str] = None,
        messages: Optional[list[dict[str, Any]]] = None,
    ) -> T:
        key = api_key or settings.openai_api_key
        if not key:
            raise RuntimeError("OpenAI API key is required when AI_MOCK_MODE is false")
        started = time.perf_counter()
        log_step(self.step, "payload", payload)
        client = AsyncOpenAI(api_key=key, base_url=settings.openai_base_url or None)
        schema = self.response_model.model_json_schema()
        schema_instruction = (
            "\nReturn ONLY one JSON object matching this JSON Schema exactly. "
            "Do not wrap it in markdown and do not reuse the input shape:\n"
            f"{json.dumps(schema, ensure_ascii=False)}"
        )
        effective_messages = list(messages or [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ])
        if effective_messages and effective_messages[0].get("role") == "system":
            effective_messages[0] = {
                **effective_messages[0],
                "content": f"{effective_messages[0].get('content', '')}{schema_instruction}",
            }

        # Native structured output works with OpenAI. Custom compatible
        # gateways often accept the request but ignore its JSON schema, so go
        # straight to the explicit JSON path for those providers.
        is_native_openai = not settings.openai_base_url or "api.openai.com" in settings.openai_base_url
        if is_native_openai:
            try:
                completion = await client.beta.chat.completions.parse(
                    model=settings.openai_content_model,
                    messages=effective_messages,
                    response_format=self.response_model,
                )
                result = completion.choices[0].message.parsed
                if result is not None:
                    log_step(self.step, "result", result)
                    log_step(self.step, "completed", {"duration_ms": round((time.perf_counter() - started) * 1000, 2), "parse_mode": "structured"})
                    return result
                log_step(self.step, "structured_parse_failed", {"error": "empty parsed response"})
            except Exception as exc:
                log_step(self.step, "structured_parse_failed", {"error_type": type(exc).__name__, "error": str(exc)})
        else:
            log_step(self.step, "parse_mode", {"mode": "json_fallback", "reason": "custom_openai_compatible_gateway"})

        # Some OpenAI-compatible gateways return HTTP 200 but ignore the
        # response schema. Retry through the broadly supported JSON endpoint.
        try:
            completion = await client.chat.completions.create(
                model=settings.openai_content_model,
                messages=effective_messages,
                response_format={"type": "json_object"},
            )
            raw_content = completion.choices[0].message.content or ""
            log_step(self.step, "raw_result", {"content": raw_content})
            result = self.response_model.model_validate(_extract_json_object(raw_content))
            log_step(self.step, "result", result)
            log_step(self.step, "completed", {"duration_ms": round((time.perf_counter() - started) * 1000, 2), "parse_mode": "json_fallback"})
            return result
        except Exception as exc:
            log_step(
                self.step,
                "failed",
                {
                    "error_type": type(exc).__name__,
                    "error": str(exc),
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            raise


def _extract_json_object(content: str) -> dict[str, Any]:
    clean = content.strip()
    if clean.startswith("```"):
        lines = clean.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        clean = "\n".join(lines).strip()
    try:
        value = json.loads(clean)
    except json.JSONDecodeError:
        start, end = clean.find("{"), clean.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("Model response does not contain a JSON object")
        value = json.loads(clean[start : end + 1])
    if not isinstance(value, dict):
        raise ValueError("Model response must be a JSON object")
    return value
