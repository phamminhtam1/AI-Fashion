import { z } from "zod";

export const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const MAX_TRYON_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const MIN_TRYON_IMAGE_BYTES = 32;

export const createTryOnSchema = z.object({
  variant_id: z.string().uuid("variant_id không hợp lệ (cần định dạng UUID)"),
  idempotency_key: z.string().max(128).optional(),
});
