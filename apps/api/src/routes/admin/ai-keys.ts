import { Hono } from "hono";
import { z } from "zod";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
import { AiKeyManagerService } from "../../modules/ai/keys/ai-key-manager.service.js";

export const adminAiKeyRoutes = new Hono<AppVars>();
adminAiKeyRoutes.use("*", requireAuth);

const createKeySchema = z.object({
  provider: z.string().optional().default("kie"),
  label: z.string().min(1, "Vui lòng nhập tên nhãn"),
  rawKey: z.string().min(1, "Vui lòng nhập API Key"),
  priority: z.coerce.number().optional().default(1),
});

const updateKeySchema = z.object({
  label: z.string().optional(),
  priority: z.coerce.number().optional(),
  status: z.enum(["ACTIVE", "RATE_LIMITED", "EXHAUSTED", "REVOKED", "DISABLED"]).optional(),
  rawKey: z.string().optional(),
});

const testKeySchema = z.object({
  rawKey: z.string().min(1, "Vui lòng nhập API Key"),
});

// 1. List all AI Keys
adminAiKeyRoutes.get("/", async (c) => {
  const db = c.get("db");
  const service = new AiKeyManagerService(db);
  const keys = await service.listKeys();
  return c.json({ items: keys });
});

// 2. Test a raw key against provider directly
adminAiKeyRoutes.post("/test", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = testKeySchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "invalid_input", "Vui lòng nhập API Key hợp lệ", parsed.error.flatten().fieldErrors as any);
  }

  const db = c.get("db");
  const service = new AiKeyManagerService(db);
  const result = await service.checkKieCredits(parsed.data.rawKey);

  return c.json(result);
});

// 3. Create a new key
adminAiKeyRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "invalid_input", "Dữ liệu nhập không hợp lệ", parsed.error.flatten().fieldErrors as any);
  }

  const db = c.get("db");
  const service = new AiKeyManagerService(db);
  const key = await service.createKey(parsed.data);

  return c.json(key, 201);
});

// 4. Update key
adminAiKeyRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateKeySchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "invalid_input", "Dữ liệu cập nhật không hợp lệ", parsed.error.flatten().fieldErrors as any);
  }

  const db = c.get("db");
  const service = new AiKeyManagerService(db);
  const updated = await service.updateKey(id, parsed.data);

  return c.json(updated);
});

// 5. Refresh credits for a specific key
adminAiKeyRoutes.post("/:id/refresh", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const service = new AiKeyManagerService(db);
  const result = await service.refreshKeyCredits(id);

  return c.json(result);
});

// 6. Refresh credits for all keys
adminAiKeyRoutes.post("/refresh-all", async (c) => {
  const db = c.get("db");
  const service = new AiKeyManagerService(db);
  const results = await service.refreshAllKeys();

  return c.json({ items: results });
});

// 7. Delete key
adminAiKeyRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const service = new AiKeyManagerService(db);
  const result = await service.deleteKey(id);

  return c.json(result);
});
