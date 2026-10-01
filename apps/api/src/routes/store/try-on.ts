import { Hono } from "hono";
import { ApiError } from "../../lib/errors.js";
import type { AppVars } from "../../middleware/auth.js";
import { requireCustomer } from "../../middleware/auth.js";
import { TryOnRepository } from "../../modules/ai/try-on/try-on.repository.js";
import { createTryOnSchema } from "../../modules/ai/try-on/try-on.schema.js";
import { TryOnService } from "../../modules/ai/try-on/try-on.service.js";

export const storeTryOnRoutes = new Hono<AppVars>();

storeTryOnRoutes.use("*", requireCustomer);

storeTryOnRoutes.post("/", async (c) => {
  const customer = c.get("customer")!;
  const db = c.get("db");

  const body = await c.req.parseBody();

  const variantIdRaw = typeof body["variant_id"] === "string" ? body["variant_id"] : null;
  const parsed = createTryOnSchema.safeParse({ variant_id: variantIdRaw });
  if (!parsed.success) {
    throw new ApiError(
      400,
      "validation_error",
      parsed.error.errors[0]?.message || "Thiếu hoặc sai variant_id",
    );
  }

  const file = body["image"] || body["file"];
  if (!file || typeof file === "string") {
    throw new ApiError(400, "invalid_tryon_image", "Vui lòng chọn ảnh để thử đồ (field: image)");
  }

  const mime = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());

  const idempotencyKey =
    c.req.header("idempotency-key") ||
    (typeof body["idempotency_key"] === "string" ? body["idempotency_key"] : null);

  const repo = new TryOnRepository(db);
  const service = new TryOnService(repo);

  const result = await service.createJob({
    customerId: customer.customerId,
    variantId: parsed.data.variant_id,
    imageBuffer: buffer,
    imageMime: mime,
    idempotencyKey,
  });

  return c.json(result, 202);
});

storeTryOnRoutes.get("/", async (c) => {
  const customer = c.get("customer")!;
  const db = c.get("db");

  const repo = new TryOnRepository(db);
  const service = new TryOnService(repo);

  const items = await service.listCustomerJobs(customer.customerId);
  return c.json({ items });
});

storeTryOnRoutes.get("/:id", async (c) => {
  const customer = c.get("customer")!;
  const db = c.get("db");
  const jobId = c.req.param("id");

  const repo = new TryOnRepository(db);
  const service = new TryOnService(repo);

  const result = await service.getJob(jobId, customer.customerId);
  return c.json(result);
});

storeTryOnRoutes.delete("/:id", async (c) => {
  const customer = c.get("customer")!;
  const db = c.get("db");
  const jobId = c.req.param("id");

  const repo = new TryOnRepository(db);
  const service = new TryOnService(repo);

  const deleted = await service.deleteJob(jobId, customer.customerId);
  if (!deleted) {
    throw new ApiError(404, "not_found", "Không tìm thấy ảnh thử đồ hoặc bạn không có quyền xóa");
  }

  return c.json({ ok: true });
});


