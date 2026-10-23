import json

from ..prompts.templates import COPY_SYSTEM_PROMPT
from ..schemas import ChannelContent, ContentDraft, ContentGenerateRequest
from .base import StructuredAgent, log_step
from ....config import settings


class CopywritingAgent(StructuredAgent):
    def __init__(self):
        super().__init__("copywriting", COPY_SYSTEM_PROMPT, ContentDraft)

    async def run(self, req: ContentGenerateRequest) -> ContentDraft:
        payload = {
            "user_prompt": req.custom_instructions or "Viết caption giới thiệu sản phẩm.",
            "channels": [channel.value for channel in req.channels],
            "products": [
                {"name": product.name, "description": product.description, "category": product.category}
                for product in req.products
            ],
            "call_to_action": req.call_to_action,
            "promotion": req.promotion,
            "brand_context": req.brand_context,
            "language": req.language,
            "length": req.length,
        }

        if not settings.ai_mock_mode:
            try:
                user_content: list[dict] = [
                    {
                        "type": "text",
                        "text": (
                            "Tạo caption trực tiếp từ prompt người dùng và dữ liệu sản phẩm dưới đây. "
                            "Ảnh đính kèm là ảnh tham chiếu của sản phẩm. Không mô tả các bước phân tích trung gian. "
                            "Không bịa thông tin không có trong tên, mô tả hoặc ảnh.\n\n"
                            + json.dumps(payload, ensure_ascii=False)
                        ),
                    }
                ]
                for product in req.products:
                    for image_url in product.image_urls:
                        user_content.append({"type": "image_url", "image_url": {"url": image_url}})

                vision_messages = [
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_content},
                ]
                try:
                    return await self.run_live(payload, req.openai_api_key, messages=vision_messages)
                except Exception as vision_exc:
                    log_step(self.step, "vision_retry", {"error": str(vision_exc), "action": "retry_without_images"})
                    text_only_messages = [
                        {"role": "system", "content": self.system_prompt},
                        {
                            "role": "user",
                            "content": (
                                "Tạo caption trực tiếp từ dữ liệu chữ dưới đây. Gateway không hỗ trợ ảnh ở lần trước, "
                                "nên chỉ dùng tên, mô tả và các lựa chọn của người dùng.\n\n"
                                + json.dumps(payload, ensure_ascii=False)
                            ),
                        },
                    ]
                    return await self.run_live(payload, req.openai_api_key, messages=text_only_messages)
            except Exception as exc:
                log_step(self.step, "copywriting_fallback_used", {"error": str(exc)})

        log_step(self.step, "payload", payload)
        product_names = ", ".join(product.name for product in req.products)
        descriptions = " ".join(product.description for product in req.products if product.description)
        variants = [
            ChannelContent(
                channel=channel,
                headline=product_names[:100],
                caption=(
                    f"{product_names} ✨\n\n{descriptions}"
                    f"{' Ưu đãi: ' + req.promotion if req.promotion else ''}\n\n"
                    f"{req.call_to_action or 'Khám phá sản phẩm ngay'}."
                ),
                call_to_action=req.call_to_action or "Khám phá sản phẩm ngay",
                hashtags=["#ELANE", "#ThoiTrangNu", "#ThanhLich", "#OOTDVietnam"],
                visual_brief=None,
            )
            for channel in req.channels
        ]
        result = ContentDraft(master_message=product_names, variants=variants)
        log_step(self.step, "result", result)
        return result
