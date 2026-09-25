import { Hono } from "hono";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, discountCodes } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import { normalizeCouponCode } from "../../lib/discount-codes.js";

export const adminDiscountCodeRoutes = new Hono<AppVars>();
adminDiscountCodeRoutes.use("*", requireAuth);

const typeEnum = z.enum(["percent", "fixed"]);
const statusEnum = z.enum(["active", "disabled"]);

function mapCode(row: typeof discountCodes.$inferSelect) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    value: row.value,
    min_order_vnd: row.minOrderVnd,
    max_discount_vnd: row.maxDiscountVnd,
    starts_at: row.startsAt,
    ends_at: row.endsAt,
    usage_limit: row.usageLimit,
    usage_count: row.usageCount,
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function parseOptionalDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, "validation_error", "Ngày không hợp lệ");
  return d;
}

const createBody = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  type: typeEnum,
  value: z.number().int().positive(),
  min_order_vnd: z.number().int().min(0).optional(),
  max_discount_vnd: z.number().int().positive().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  status: statusEnum.optional(),
});

adminDiscountCodeRoutes.get("/", async (c) => {
  requirePerm(c.get("user")!, "promotion.read");
  const db = c.get("db");
  const status = c.req.query("status");
  const q = c.req.query("q")?.trim();

  const filters = [];
  if (status === "active" || status === "disabled") filters.push(eq(discountCodes.status, status));
  if (q) {
    const pattern = `%${q}%`;
    filters.push(or(ilike(discountCodes.code, pattern), ilike(discountCodes.name, pattern)));
  }

  const rows = await db
    .select()
    .from(discountCodes)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(discountCodes.createdAt))
    .limit(200);

  return c.json({ items: rows.map(mapCode) });
});

adminDiscountCodeRoutes.get("/:id", async (c) => {
  requirePerm(c.get("user")!, "promotion.read");
  const row = (
    await c.get("db").select().from(discountCodes).where(eq(discountCodes.id, c.req.param("id"))).limit(1)
  )[0];
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy mã giảm giá");
  return c.json(mapCode(row));
});

adminDiscountCodeRoutes.post("/", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "promotion.write");
  const body = createBody.safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu mã giảm giá không hợp lệ");

  if (body.data.type === "percent" && (body.data.value < 1 || body.data.value > 100)) {
    throw new ApiError(400, "validation_error", "Phần trăm phải từ 1 đến 100");
  }

  const code = normalizeCouponCode(body.data.code);
  const db = c.get("db");
  const dup = (await db.select().from(discountCodes).where(eq(discountCodes.code, code)).limit(1))[0];
  if (dup) throw new ApiError(409, "conflict", "Mã đã tồn tại");

  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  try {
    startsAt = parseOptionalDate(body.data.starts_at) ?? null;
    endsAt = parseOptionalDate(body.data.ends_at) ?? null;
  } catch (e) {
    throw e;
  }
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new ApiError(400, "validation_error", "Ngày kết thúc phải sau ngày bắt đầu");
  }

  const [row] = await db
    .insert(discountCodes)
    .values({
      code,
      name: body.data.name,
      type: body.data.type,
      value: body.data.value,
      minOrderVnd: body.data.min_order_vnd ?? 0,
      maxDiscountVnd: body.data.type === "percent" ? (body.data.max_discount_vnd ?? null) : null,
      startsAt,
      endsAt,
      usageLimit: body.data.usage_limit ?? null,
      status: body.data.status ?? "active",
    })
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "discount_code.create",
    resourceType: "discount_code",
    resourceId: row!.id,
    afterRedacted: { code: row!.code, type: row!.type, value: row!.value },
    requestId: requestId(c),
  });

  return c.json(mapCode(row!), 201);
});

adminDiscountCodeRoutes.patch("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "promotion.write");
  const patch = createBody.partial().safeParse(await c.req.json());
  if (!patch.success) throw new ApiError(400, "validation_error", "Dữ liệu không hợp lệ");

  const db = c.get("db");
  const existing = (
    await db.select().from(discountCodes).where(eq(discountCodes.id, c.req.param("id"))).limit(1)
  )[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy mã giảm giá");

  const nextType = patch.data.type ?? (existing.type as "percent" | "fixed");
  const nextValue = patch.data.value ?? existing.value;
  if (nextType === "percent" && (nextValue < 1 || nextValue > 100)) {
    throw new ApiError(400, "validation_error", "Phần trăm phải từ 1 đến 100");
  }

  let code = existing.code;
  if (patch.data.code !== undefined) {
    code = normalizeCouponCode(patch.data.code);
    if (code !== existing.code) {
      const dup = (await db.select().from(discountCodes).where(eq(discountCodes.code, code)).limit(1))[0];
      if (dup) throw new ApiError(409, "conflict", "Mã đã tồn tại");
    }
  }

  const startsAt =
    patch.data.starts_at !== undefined ? (parseOptionalDate(patch.data.starts_at) ?? null) : existing.startsAt;
  const endsAt =
    patch.data.ends_at !== undefined ? (parseOptionalDate(patch.data.ends_at) ?? null) : existing.endsAt;
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new ApiError(400, "validation_error", "Ngày kết thúc phải sau ngày bắt đầu");
  }

  const maxDiscount =
    nextType === "percent"
      ? patch.data.max_discount_vnd !== undefined
        ? patch.data.max_discount_vnd
        : existing.maxDiscountVnd
      : null;

  const [row] = await db
    .update(discountCodes)
    .set({
      code,
      name: patch.data.name ?? existing.name,
      type: nextType,
      value: nextValue,
      minOrderVnd: patch.data.min_order_vnd ?? existing.minOrderVnd,
      maxDiscountVnd: maxDiscount,
      startsAt,
      endsAt,
      usageLimit:
        patch.data.usage_limit !== undefined ? patch.data.usage_limit : existing.usageLimit,
      status: patch.data.status ?? existing.status,
      updatedAt: new Date(),
    })
    .where(eq(discountCodes.id, existing.id))
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "discount_code.update",
    resourceType: "discount_code",
    resourceId: row!.id,
    beforeRedacted: { code: existing.code, status: existing.status },
    afterRedacted: { code: row!.code, status: row!.status },
    requestId: requestId(c),
  });

  return c.json(mapCode(row!));
});

adminDiscountCodeRoutes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "promotion.write");
  const db = c.get("db");
  const [row] = await db
    .update(discountCodes)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(eq(discountCodes.id, c.req.param("id")))
    .returning();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy mã giảm giá");

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "discount_code.disable",
    resourceType: "discount_code",
    resourceId: row.id,
    afterRedacted: { status: "disabled" },
    requestId: requestId(c),
  });

  return c.json(mapCode(row));
});
