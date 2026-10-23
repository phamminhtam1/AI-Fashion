import asyncio
import base64
import json
import logging
import time
from typing import Any, Optional, TypeVar, Type

from openai import AsyncOpenAI
import httpx
from pydantic import BaseModel

from ....config import settings

logger = logging.getLogger("ai_worker.content")
T = TypeVar("T", bound=BaseModel)


async def _image_url_to_data_uri(url: str) -> str:
    """Inline a remote product image for gateways that cannot fetch image URLs."""
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as http_client:
        response = await http_client.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "image/jpeg").split(";", 1)[0]
        encoded = base64.b64encode(response.content).decode("ascii")
        return f"data:{content_type};base64,{encoded}"


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
            key: "[IMAGE_DATA_URI]" if key.lower() == "url" and isinstance(item, str) and item.startswith("data:")
            else ("[REDACTED]" if key.lower() in {"openai_api_key", "api_key", "authorization"} else _redact_secrets(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_secrets(item) for item in value]
    return value


def _generate_json_example(model_cls: Type[BaseModel]) -> dict[str, Any]:
    schema = model_cls.model_json_schema()
    defs = schema.get("$defs", {}) or schema.get("definitions", {})

    def resolve(prop: dict[str, Any]) -> Any:
        if "$ref" in prop:
            ref_name = prop["$ref"].split("/")[-1]
            ref_schema = defs.get(ref_name, {})
            return resolve(ref_schema)
        if "anyOf" in prop:
            non_null = [p for p in prop["anyOf"] if p.get("type") != "null"]
            return resolve(non_null[0]) if non_null else "string"
        if "allOf" in prop:
            return resolve(prop["allOf"][0])
        p_type = prop.get("type")
        if p_type == "object" or "properties" in prop:
            return {k: resolve(v) for k, v in prop.get("properties", {}).items()}
        if p_type == "array":
            items = prop.get("items", {})
            return [resolve(items)]
        if "enum" in prop:
            return prop["enum"][0] if prop["enum"] else "string"
        if p_type == "string":
            return "string"
        if p_type == "integer":
            return 0
        if p_type == "number":
            return 0.0
        if p_type == "boolean":
            return True
        return "value"

    return {k: resolve(v) for k, v in schema.get("properties", {}).items()}


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
        is_native_openai = not settings.openai_base_url or "api.openai.com" in settings.openai_base_url
        if is_native_openai:
            schema = self.response_model.model_json_schema()
            schema_instruction = (
                "\nReturn ONLY one JSON object matching this JSON Schema exactly. "
                "Do not wrap it in markdown and do not reuse the input shape:\n"
                f"{json.dumps(schema, ensure_ascii=False)}"
            )
        else:
            example = _generate_json_example(self.response_model)
            schema_instruction = (
                "\nReturn ONLY a single valid JSON object matching this exact structure and field names. "
                "Do not wrap it in markdown code blocks and do not add conversational preamble:\n"
                f"{json.dumps(example, ensure_ascii=False, indent=2)}"
            )

        effective_messages = list(messages or [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ])
        # The intermediary gateway cannot reliably fetch public image URLs. Convert
        # image parts to data URIs before sending so the model receives the bytes.
        for message in effective_messages:
            content = message.get("content")
            if not isinstance(content, list):
                continue
            for part in content:
                if not isinstance(part, dict) or part.get("type") != "image_url":
                    continue
                image_url = part.get("image_url")
                if not isinstance(image_url, dict):
                    continue
                url = image_url.get("url")
                if not isinstance(url, str) or url.startswith("data:"):
                    continue
                try:
                    image_url["url"] = await _image_url_to_data_uri(url)
                except Exception as exc:
                    log_step(self.step, "image_inline_failed", {"error_type": type(exc).__name__})
        if effective_messages and effective_messages[0].get("role") == "system":
            effective_messages[0] = {
                **effective_messages[0],
                "content": f"{effective_messages[0].get('content', '')}{schema_instruction}",
            }
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

        # Some OpenAI-compatible gateways (e.g. Codex/Claude bridges) return HTTP 200 with
        # empty assistant content if role: "system" is passed alongside json_object response format.
        # Merging system instructions into the user prompt ensures 100% gateway compatibility.
        gateway_messages = effective_messages
        if not is_native_openai:
            system_texts = []
            non_system_messages = []
            for m in effective_messages:
                if m.get("role") == "system":
                    content = m.get("content", "")
                    if isinstance(content, str):
                        system_texts.append(content)
                else:
                    non_system_messages.append(m)

            if system_texts:
                combined_system = "\n\n".join(system_texts)
                if not non_system_messages:
                    gateway_messages = [{"role": "user", "content": combined_system}]
                else:
                    gateway_messages = []
                    merged_first = False
                    for m in non_system_messages:
                        if not merged_first and m.get("role") == "user":
                            user_c = m.get("content")
                            if isinstance(user_c, str):
                                gateway_messages.append({"role": "user", "content": f"{combined_system}\n\n{user_c}"})
                            elif isinstance(user_c, list):
                                gateway_messages.append({
                                    "role": "user",
                                    "content": [{"type": "text", "text": f"{combined_system}\n\n"}] + user_c
                                })
                            else:
                                gateway_messages.append(m)
                            merged_first = True
                        else:
                            gateway_messages.append(m)

        # KIE DeepSeek Responses API is used for content generation. It accepts
        # multimodal input, but its response text is nested under output[].content[].
        if settings.kie_content_model and settings.kie_base_url:
            max_attempts = 2
            for attempt in range(1, max_attempts + 1):
                try:
                    log_step(self.step, "kie_gateway_messages", gateway_messages)
                    raw_content = await _call_kie_responses(key, gateway_messages)
                    log_step(self.step, "raw_result", {"attempt": attempt, "content": raw_content, "finish_reason": "stop"})
                    result = self.response_model.model_validate(_extract_json_object(raw_content))
                    log_step(self.step, "result", result)
                    log_step(self.step, "completed", {"duration_ms": round((time.perf_counter() - started) * 1000, 2), "parse_mode": "kie_responses"})
                    return result
                except Exception as exc:
                    if attempt < max_attempts:
                        await asyncio.sleep(2.0)
                        continue
                    log_step(self.step, "failed", {"error_type": type(exc).__name__, "error": str(exc), "duration_ms": round((time.perf_counter() - started) * 1000, 2)})
                    raise

        max_attempts = 2
        for attempt in range(1, max_attempts + 1):
            try:
                log_step(self.step, "gateway_messages", gateway_messages)
                call_kwargs = {
                    "model": settings.openai_content_model,
                    "messages": gateway_messages,
                }
                if attempt == 1:
                    call_kwargs["response_format"] = {"type": "json_object"}

                completion = await client.chat.completions.create(**call_kwargs)
                choice = completion.choices[0] if completion.choices else None
                raw_content = (choice.message.content or "") if choice and choice.message else ""
                finish_reason = getattr(choice, "finish_reason", None)
                log_step(self.step, "raw_result", {"attempt": attempt, "content": raw_content, "finish_reason": finish_reason})
                if finish_reason == "failed" or not raw_content.strip():
                    if attempt < max_attempts:
                        await asyncio.sleep(2.0)
                        continue
                    raise ValueError(f"Gateway returned empty response (finish_reason={finish_reason})")
                result = self.response_model.model_validate(_extract_json_object(raw_content))
                log_step(self.step, "result", result)
                log_step(self.step, "completed", {"duration_ms": round((time.perf_counter() - started) * 1000, 2), "parse_mode": "json_fallback"})
                return result
            except Exception as exc:
                if attempt < max_attempts:
                    await asyncio.sleep(2.0)
                    continue
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


async def _call_kie_responses(api_key: str, messages: list[dict[str, Any]]) -> str:
    """Call KIE's Responses-compatible DeepSeek endpoint and extract output text."""
    input_messages: list[dict[str, Any]] = []
    for message in messages:
        role = message.get("role", "user")
        content = message.get("content", "")
        if isinstance(content, str):
            parts: list[dict[str, Any]] = [{"type": "input_text", "text": content}]
        elif isinstance(content, list):
            parts = []
            for part in content:
                if not isinstance(part, dict):
                    continue
                if part.get("type") in {"text", "input_text"}:
                    parts.append({"type": "input_text", "text": str(part.get("text", ""))})
                elif part.get("type") == "image_url":
                    image_url = part.get("image_url")
                    url = image_url.get("url") if isinstance(image_url, dict) else image_url
                    if isinstance(url, str) and url:
                        parts.append({"type": "input_image", "image_url": url})
            if not parts:
                parts = [{"type": "input_text", "text": ""}]
        else:
            parts = [{"type": "input_text", "text": str(content)}]
        input_messages.append({"role": role if role in {"user", "assistant", "system"} else "user", "content": parts})

    endpoint = f"{settings.kie_base_url.rstrip('/')}/openai/v1/responses"
    body = {
        "model": settings.kie_content_model,
        "input": input_messages,
        "stream": False,
        "reasoning": {"effort": "none"},
        "text": {"format": {"type": "json_object"}},
    }
    async with httpx.AsyncClient(timeout=90.0) as http_client:
        response = await http_client.post(endpoint, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=body)
    data = response.json()
    if response.status_code >= 400:
        error = data.get("error") if isinstance(data, dict) else None
        raise RuntimeError(str(error or f"KIE API HTTP {response.status_code}"))
    output_parts: list[str] = []
    for item in data.get("output", []) if isinstance(data, dict) else []:
        for part in item.get("content", []) if isinstance(item, dict) else []:
            if isinstance(part, dict) and part.get("type") in {"output_text", "text"}:
                text = part.get("text")
                if isinstance(text, str):
                    output_parts.append(text)
    content = "".join(output_parts).strip()
    if not content:
        raise ValueError(f"KIE returned empty response (status={data.get('status') if isinstance(data, dict) else None})")
    return content


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
