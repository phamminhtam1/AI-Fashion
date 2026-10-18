import { Hono } from "hono";
import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { accounts, auditLogs, discountCodes, employees, orders } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import { normalizeCouponCode } from "../../lib/discount-codes.js";
import { mediaPublicUrl, uploadMediaObject } from "../../lib/media-storage.js";

export const adminDiscountCodeRoutes = new Hono<AppVars>();
adminDiscountCodeRoutes.use("*", requireAuth);

const typeEnum = z.enum(["percent", "fixed", "free_shipping", "bxgy"]);
const statusEnum = z.enum(["active", "disabled", "draft", "paused"]);
const applyScopeEnum = z.enum(["all", "category", "products"]);
const customerGroupEnum = z.enum(["all", "member", "new", "selected"]);

const appliedProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().optional(),
  category: z.string().optional(),
  image_url: z.string().nullable().optional(),
});

function mapCode(
  row: typeof discountCodes.$inferSelect,
  creatorName?: string | null,
  updaterName?: string | null,
) {
  const img = row.imageUrl ?? row.bannerUrl ?? null;
  const banner = row.bannerUrl ?? row.imageUrl ?? null;
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
    description: row.description ?? null,
    image_url: img,
    banner_url: banner,
    apply_scope: row.applyScope ?? "all",
    products: row.appliedProducts ?? [],
    applied_category_ids: row.appliedCategoryIds ?? [],
    customer_group: row.customerGroup ?? "all",
    per_customer_limit: row.perCustomerLimit ?? null,
    apply_on_sale: row.applyOnSale ?? false,
    show_on_homepage: row.showOnHomepage ?? false,
    stackable: row.stackable ?? false,
    created_by_id: row.createdById ?? null,
    updated_by_id: row.updatedById ?? null,
    created_by_name: creatorName ?? null,
    updated_by_name: updaterName ?? null,
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
  value: z.number().int().min(0),
  min_order_vnd: z.number().int().min(0).optional(),
  max_discount_vnd: z.number().int().positive().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  status: statusEnum.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  image_url: z.string().trim().nullable().optional(),
  banner_url: z.string().trim().nullable().optional(),
  apply_scope: applyScopeEnum.optional(),
  products: z.array(appliedProductSchema).optional(),
  applied_category_ids: z.array(z.string()).optional(),
  customer_group: customerGroupEnum.optional(),
  per_customer_limit: z.number().int().positive().nullable().optional(),
  apply_on_sale: z.boolean().optional(),
  show_on_homepage: z.boolean().optional(),
  stackable: z.boolean().optional(),
});

/** Standalone image upload for Promotion banner / image */
adminDiscountCodeRoutes.post("/upload", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "promotion.write");

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || typeof file === "string") {
    throw new ApiError(400, "validation_error", "Thiếu file ảnh (field: file)");
  }

  const mime = file.type || "application/octet-stream";
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(mime)) {
    throw new ApiError(400, "invalid_mime", "Chỉ chấp nhận định dạng ảnh JPEG, PNG, hoặc WebP");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > 5 * 1024 * 1024) {
    throw new ApiError(400, "file_too_large", "Ảnh tối đa 5MB");
  }
  if (buf.byteLength < 32) {
    throw new ApiError(400, "validation_error", "File ảnh không hợp lệ");
  }

  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const objectKey = `promotions/${randomUUID()}.${ext}`;
  await uploadMediaObject(objectKey, buf, mime);

  const url = mediaPublicUrl(objectKey);
  return c.json({ url, object_key: objectKey }, 201);
});

async function resolveAccountNames(db: any, accountIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = Array.from(new Set(accountIds.filter(Boolean)));
  if (ids.length === 0) return map;

  const empRows = await db
    .select({ accountId: employees.accountId, name: employees.fullName })
    .from(employees)
    .where(inArray(employees.accountId, ids));
  for (const r of empRows) {
    if (r.accountId && r.name) map.set(r.accountId, r.name);
  }

  const missing = ids.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const accRows = await db
      .select({ id: accounts.id, email: accounts.email })
      .from(accounts)
      .where(inArray(accounts.id, missing));
    for (const r of accRows) {
      if (r.email) map.set(r.id, r.email);
    }
  }

  return map;
}

adminDiscountCodeRoutes.get("/", async (c) => {
  requirePerm(c.get("user")!, "promotion.read");
  const db = c.get("db");
  const status = c.req.query("status");
  const q = c.req.query("q")?.trim();
  const type = c.req.query("type");
  const timing = c.req.query("timing");
  const usage = c.req.query("usage");
  const dateFrom = c.req.query("date_from");
  const dateTo = c.req.query("date_to");
  const sortBy = c.req.query("sort_by") ?? "created_at_desc";

  const now = new Date();
  const filters = [];
  if (status && status !== "all") {
    filters.push(eq(discountCodes.status, status));
  }
  if (type) {
    filters.push(eq(discountCodes.type, type));
  }
  if (q) {
    const pattern = `%${q}%`;
    filters.push(
      or(
        ilike(discountCodes.code, pattern),
        ilike(discountCodes.name, pattern),
        ilike(discountCodes.description, pattern),
      )!,
    );
  }
  if (timing === "active_now") {
    filters.push(
      and(
        or(isNull(discountCodes.startsAt), lte(discountCodes.startsAt, now))!,
        or(isNull(discountCodes.endsAt), gte(discountCodes.endsAt, now))!,
      )!,
    );
  } else if (timing === "upcoming") {
    filters.push(and(isNotNull(discountCodes.startsAt), gte(discountCodes.startsAt, now))!);
  } else if (timing === "expired") {
    filters.push(and(isNotNull(discountCodes.endsAt), lte(discountCodes.endsAt, now))!);
  } else if (timing === "no_expiry") {
    filters.push(isNull(discountCodes.endsAt));
  }
  if (usage === "unused") {
    filters.push(eq(discountCodes.usageCount, 0));
  } else if (usage === "exhausted") {
    filters.push(
      and(
        isNotNull(discountCodes.usageLimit),
        sql`${discountCodes.usageCount} >= ${discountCodes.usageLimit}`,
      )!,
    );
  } else if (usage === "partial") {
    filters.push(
      and(
        sql`${discountCodes.usageCount} > 0`,
        or(
          isNull(discountCodes.usageLimit),
          sql`${discountCodes.usageCount} < ${discountCodes.usageLimit}`,
        )!,
      )!,
    );
  }
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!Number.isNaN(d.getTime())) filters.push(gte(discountCodes.createdAt, d));
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      filters.push(lte(discountCodes.createdAt, d));
    }
  }

  const orderExpr = (() => {
    switch (sortBy) {
      case "usage_desc": return desc(discountCodes.usageCount);
      case "usage_asc": return sql`${discountCodes.usageCount} asc`;
      case "value_desc": return desc(discountCodes.value);
      case "ends_at_asc": return sql`${discountCodes.endsAt} asc nulls last`;
      default: return desc(discountCodes.createdAt);
    }
  })();

  const where = filters.length ? and(...filters) : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(discountCodes)
    .where(where);

  // Summary stats (unfiltered by status)
  const statsRows = await db
    .select({ status: discountCodes.status, n: sql<number>`count(*)::int` })
    .from(discountCodes)
    .groupBy(discountCodes.status);
  const stats: Record<string, number> = {};
  for (const r of statsRows) stats[r.status] = r.n;

  const rows = await db
    .select()
    .from(discountCodes)
    .where(where)
    .orderBy(orderExpr)
    .limit(200);

  const accountIds: string[] = [];
  for (const r of rows) {
    if (r.createdById) accountIds.push(r.createdById);
    if (r.updatedById) accountIds.push(r.updatedById);
  }
  const nameMap = await resolveAccountNames(db, accountIds);

  return c.json({
    items: rows.map((r) =>
      mapCode(
        r,
        r.createdById ? nameMap.get(r.createdById) : null,
        r.updatedById ? nameMap.get(r.updatedById) : null,
      ),
    ),
    total: countRow?.n ?? 0,
    stats,
  });
});

adminDiscountCodeRoutes.get("/:id", async (c) => {
  requirePerm(c.get("user")!, "promotion.read");
  const db = c.get("db");
  const row = (
    await db.select().from(discountCodes).where(eq(discountCodes.id, c.req.param("id"))).limit(1)
  )[0];
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy mã giảm giá");

  const accountIds: string[] = [];
  if (row.createdById) accountIds.push(row.createdById);
  if (row.updatedById) accountIds.push(row.updatedById);
  const nameMap = await resolveAccountNames(db, accountIds);

  return c.json(
    mapCode(
      row,
      row.createdById ? nameMap.get(row.createdById) : null,
      row.updatedById ? nameMap.get(row.updatedById) : null,
    ),
  );
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

  const banner = body.data.banner_url ?? body.data.image_url ?? null;
  const image = body.data.image_url ?? body.data.banner_url ?? null;

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
      description: body.data.description ?? null,
      imageUrl: image,
      bannerUrl: banner,
      applyScope: body.data.apply_scope ?? "all",
      appliedProducts: body.data.products ?? [],
      appliedCategoryIds: body.data.applied_category_ids ?? [],
      customerGroup: body.data.customer_group ?? "all",
      perCustomerLimit: body.data.per_customer_limit ?? null,
      applyOnSale: body.data.apply_on_sale ?? false,
      showOnHomepage: body.data.show_on_homepage ?? false,
      stackable: body.data.stackable ?? false,
      createdById: user.accountId,
      updatedById: user.accountId,
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

  const nameMap = await resolveAccountNames(db, [user.accountId]);
  const creatorName = nameMap.get(user.accountId) ?? null;

  return c.json(mapCode(row!, creatorName, creatorName), 201);
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

  const nextType = patch.data.type ?? (existing.type as typeof typeEnum._type);
  const nextValue = patch.data.value !== undefined ? patch.data.value : existing.value;
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

  const nextBanner =
    patch.data.banner_url !== undefined
      ? patch.data.banner_url
      : patch.data.image_url !== undefined
        ? patch.data.image_url
        : existing.bannerUrl;

  const nextImage =
    patch.data.image_url !== undefined
      ? patch.data.image_url
      : patch.data.banner_url !== undefined
        ? patch.data.banner_url
        : existing.imageUrl;

  const [row] = await db
    .update(discountCodes)
    .set({
      code,
      name: patch.data.name ?? existing.name,
      type: nextType,
      value: nextValue,
      minOrderVnd: patch.data.min_order_vnd !== undefined ? patch.data.min_order_vnd : existing.minOrderVnd,
      maxDiscountVnd: maxDiscount,
      startsAt,
      endsAt,
      usageLimit:
        patch.data.usage_limit !== undefined ? patch.data.usage_limit : existing.usageLimit,
      status: patch.data.status ?? existing.status,
      description: patch.data.description !== undefined ? patch.data.description : existing.description,
      imageUrl: nextImage,
      bannerUrl: nextBanner,
      applyScope: patch.data.apply_scope ?? existing.applyScope,
      appliedProducts: patch.data.products !== undefined ? patch.data.products : existing.appliedProducts,
      appliedCategoryIds:
        patch.data.applied_category_ids !== undefined
          ? patch.data.applied_category_ids
          : existing.appliedCategoryIds,
      customerGroup: patch.data.customer_group ?? existing.customerGroup,
      perCustomerLimit:
        patch.data.per_customer_limit !== undefined
          ? patch.data.per_customer_limit
          : existing.perCustomerLimit,
      applyOnSale: patch.data.apply_on_sale !== undefined ? patch.data.apply_on_sale : existing.applyOnSale,
      showOnHomepage:
        patch.data.show_on_homepage !== undefined ? patch.data.show_on_homepage : existing.showOnHomepage,
      stackable: patch.data.stackable !== undefined ? patch.data.stackable : existing.stackable,
      updatedById: user.accountId,
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

  const accountIds: string[] = [];
  if (row!.createdById) accountIds.push(row!.createdById);
  accountIds.push(user.accountId);
  const nameMap = await resolveAccountNames(db, accountIds);

  return c.json(
    mapCode(
      row!,
      row!.createdById ? nameMap.get(row!.createdById) : null,
      nameMap.get(user.accountId) ?? null,
    ),
  );
});

adminDiscountCodeRoutes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "promotion.write");
  const db = c.get("db");
  const id = c.req.param("id");
  const hard = c.req.query("hard") === "1" || c.req.query("hard") === "true";

  const existing = (
    await db.select().from(discountCodes).where(eq(discountCodes.id, id)).limit(1)
  )[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy mã giảm giá");

  if (hard) {
    // Unlink orders referencing this discount code (orders keep snapshot discountCode string)
    await db
      .update(orders)
      .set({ discountCodeId: null })
      .where(eq(orders.discountCodeId, id));

    await db.delete(discountCodes).where(eq(discountCodes.id, id));

    await db.insert(auditLogs).values({
      actorAccountId: user.accountId,
      action: "discount_code.delete",
      resourceType: "discount_code",
      resourceId: existing.id,
      beforeRedacted: { code: existing.code, name: existing.name },
      requestId: requestId(c),
    });

    return c.json({ id: existing.id, success: true, deleted: true });
  }

  const [row] = await db
    .update(discountCodes)
    .set({
      status: "disabled",
      updatedById: user.accountId,
      updatedAt: new Date(),
    })
    .where(eq(discountCodes.id, id))
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "discount_code.disable",
    resourceType: "discount_code",
    resourceId: row!.id,
    afterRedacted: { status: "disabled" },
    requestId: requestId(c),
  });

  const accountIds: string[] = [];
  if (row!.createdById) accountIds.push(row!.createdById);
  accountIds.push(user.accountId);
  const nameMap = await resolveAccountNames(db, accountIds);

  return c.json(
    mapCode(
      row!,
      row!.createdById ? nameMap.get(row!.createdById) : null,
      nameMap.get(user.accountId) ?? null,
    ),
  );
});
