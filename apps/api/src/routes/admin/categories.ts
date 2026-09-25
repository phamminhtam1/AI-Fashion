import { Hono } from "hono";
import { and, asc, count, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { categories, productCategories, auditLogs, type Db } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import {
  collectDescendantIds,
  enrichTree,
  sortTreeOrder,
  wouldCreateCycle,
} from "../../lib/category-tree.js";

export const adminCategoryRoutes = new Hono<AppVars>();
adminCategoryRoutes.use("*", requireAuth);

function siblingParentFilter(parentId: string | null) {
  return parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId);
}

/** Dồn sort_order anh/em cùng cha về 0..n-1 (theo thứ tự hiện tại). */
async function repackSiblingSortOrders(db: Db, parentId: string | null) {
  const siblings = await db
    .select({ id: categories.id, sortOrder: categories.sortOrder, name: categories.name })
    .from(categories)
    .where(siblingParentFilter(parentId))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i]!.sortOrder !== i) {
      await db.update(categories).set({ sortOrder: i, updatedAt: new Date() }).where(eq(categories.id, siblings[i]!.id));
    }
  }
  return siblings.length;
}

/** STT tiếp theo trong nhóm anh/em — luôn dồn lại trước để tái sử dụng số đã xóa. */
async function nextSiblingSortOrder(db: Db, parentId: string | null) {
  const n = await repackSiblingSortOrders(db, parentId);
  return n;
}

function slugify(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const upsertSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  status: z.enum(["active", "archived"]).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
});

async function assertValidParent(db: Db, nodeId: string | null, parentId: string | null) {
  if (parentId === null) return;
  const parent = await db.select().from(categories).where(eq(categories.id, parentId)).limit(1);
  if (!parent[0]) throw new ApiError(400, "invalid_parent", "Danh mục cha không tồn tại");
  if (!nodeId) return;
  const all = await db.select().from(categories);
  const graph = all.map((r) => ({ id: r.id, parentId: r.parentId }));
  if (wouldCreateCycle(graph, nodeId, parentId)) {
    throw new ApiError(400, "cycle", "Không thể chọn danh mục con làm cha (tạo chu kỳ)");
  }
}

async function assertCanAddChild(db: Db, parentId: string) {
  const [pc] = await db
    .select({ n: count() })
    .from(productCategories)
    .where(eq(productCategories.categoryId, parentId));
  if (Number(pc?.n ?? 0) > 0) {
    throw new ApiError(
      409,
      "parent_has_products",
      "Danh mục cha đang gắn sản phẩm — chuyển SP sang lá khác trước khi thêm con",
    );
  }
}

async function productCountFor(db: Db, categoryId: string) {
  const [pc] = await db
    .select({ n: count() })
    .from(productCategories)
    .where(eq(productCategories.categoryId, categoryId));
  return Number(pc?.n ?? 0);
}

function mapCategory(
  row: typeof categories.$inferSelect,
  meta: { depth: number; child_count: number; is_leaf: boolean },
  productCount: number,
) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sort_order: row.sortOrder,
    status: row.status,
    parent_id: row.parentId,
    seo_title: row.seoTitle,
    seo_description: row.seoDescription,
    product_count: productCount,
    depth: meta.depth,
    child_count: meta.child_count,
    is_leaf: meta.is_leaf,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

adminCategoryRoutes.get("/", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const status = c.req.query("status"); // active|archived|all
  const all = await db.select().from(categories);
  const enrichedAll = enrichTree(
    all.map((r) => ({ id: r.id, parentId: r.parentId, sortOrder: r.sortOrder, name: r.name })),
  );
  const enrichById = Object.fromEntries(enrichedAll.map((e) => [e.id, e]));
  const orderedAll = sortTreeOrder(enrichedAll);
  const filteredOrdered = orderedAll.filter((n) => {
    const row = all.find((r) => r.id === n.id)!;
    if (status && status !== "all" && row.status !== status) return false;
    return true;
  });

  const items = [];
  for (const n of filteredOrdered) {
    const row = all.find((r) => r.id === n.id)!;
    const meta = enrichById[n.id]!;
    items.push(mapCategory(row, meta, await productCountFor(db, row.id)));
  }
  return c.json({ items });
});

adminCategoryRoutes.get("/:id", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const rows = await db.select().from(categories).where(eq(categories.id, c.req.param("id"))).limit(1);
  if (!rows[0]) throw new ApiError(404, "not_found", "Không tìm thấy danh mục");
  const all = await db.select().from(categories);
  const enriched = enrichTree(all.map((r) => ({ id: r.id, parentId: r.parentId })));
  const meta = enriched.find((e) => e.id === rows[0]!.id)!;
  return c.json(mapCategory(rows[0], meta, await productCountFor(db, rows[0].id)));
});

adminCategoryRoutes.post("/", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const body = upsertSchema.safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu không hợp lệ");

  const db = c.get("db");
  const slug = body.data.slug?.trim() || slugify(body.data.name);
  const existing = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  if (existing[0]) throw new ApiError(409, "slug_taken", "Slug đã tồn tại");

  const parentId = body.data.parent_id ?? null;
  if (parentId) {
    await assertValidParent(db, null, parentId);
    await assertCanAddChild(db, parentId);
  }

  const sortOrder = body.data.sort_order ?? (await nextSiblingSortOrder(db, parentId));

  const [row] = await db
    .insert(categories)
    .values({
      name: body.data.name.trim(),
      slug,
      description: body.data.description ?? null,
      sortOrder,
      status: body.data.status ?? "active",
      parentId,
      seoTitle: body.data.seo_title ?? null,
      seoDescription: body.data.seo_description ?? null,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "category.create",
    resourceType: "category",
    resourceId: row!.id,
    afterRedacted: { name: row!.name, slug: row!.slug, parent_id: parentId },
    requestId: requestId(c),
  });

  const all = await db.select().from(categories);
  const enriched = enrichTree(all.map((r) => ({ id: r.id, parentId: r.parentId })));
  const meta = enriched.find((e) => e.id === row!.id)!;
  return c.json(mapCategory(row!, meta, 0), 201);
});

adminCategoryRoutes.patch("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const body = upsertSchema.partial().safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu không hợp lệ");

  const db = c.get("db");
  const existing = await db.select().from(categories).where(eq(categories.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy danh mục");

  let slug = existing[0].slug;
  if (body.data.slug !== undefined || body.data.name !== undefined) {
    slug = (body.data.slug?.trim() || (body.data.name ? slugify(body.data.name) : existing[0].slug)).trim();
    const clash = await db
      .select()
      .from(categories)
      .where(and(eq(categories.slug, slug), ne(categories.id, existing[0].id)))
      .limit(1);
    if (clash[0]) throw new ApiError(409, "slug_taken", "Slug đã tồn tại");
  }

  const nextParent =
    body.data.parent_id !== undefined ? body.data.parent_id : existing[0].parentId;
  if (body.data.parent_id !== undefined) {
    await assertValidParent(db, existing[0].id, nextParent);
    if (nextParent) await assertCanAddChild(db, nextParent);
  }

  const [row] = await db
    .update(categories)
    .set({
      name: body.data.name?.trim() ?? existing[0].name,
      slug,
      description: body.data.description !== undefined ? body.data.description : existing[0].description,
      sortOrder: body.data.sort_order ?? existing[0].sortOrder,
      status: body.data.status ?? existing[0].status,
      parentId: nextParent,
      seoTitle: body.data.seo_title !== undefined ? body.data.seo_title : existing[0].seoTitle,
      seoDescription: body.data.seo_description !== undefined ? body.data.seo_description : existing[0].seoDescription,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, existing[0].id))
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "category.update",
    resourceType: "category",
    resourceId: row!.id,
    beforeRedacted: { name: existing[0].name, slug: existing[0].slug, parent_id: existing[0].parentId },
    afterRedacted: { name: row!.name, slug: row!.slug, parent_id: row!.parentId },
    requestId: requestId(c),
  });

  const all = await db.select().from(categories);
  const enriched = enrichTree(all.map((r) => ({ id: r.id, parentId: r.parentId })));
  const meta = enriched.find((e) => e.id === row!.id)!;
  return c.json(mapCategory(row!, meta, await productCountFor(db, row!.id)));
});

adminCategoryRoutes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const existing = await db.select().from(categories).where(eq(categories.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy danh mục");

  const hard = c.req.query("hard") === "1" || c.req.query("hard") === "true";

  const all = await db.select().from(categories);
  const graph = all.map((r) => ({ id: r.id, parentId: r.parentId }));
  const subtreeIds = [existing[0].id, ...collectDescendantIds(graph, existing[0].id)];

  let subtreeProductCount = 0;
  for (const id of subtreeIds) {
    subtreeProductCount += await productCountFor(db, id);
  }

  if (hard) {
    if (subtreeProductCount > 0) {
      throw new ApiError(
        409,
        "in_use",
        `Nhánh danh mục đang gắn ${subtreeProductCount} sản phẩm — hãy ẩn hoặc chuyển SP trước khi xóa`,
      );
    }
    const enriched = enrichTree(all.map((r) => ({ id: r.id, parentId: r.parentId })));
    const toDelete = enriched
      .filter((e) => subtreeIds.includes(e.id))
      .sort((a, b) => b.depth - a.depth);
    for (const n of toDelete) {
      await db.delete(categories).where(eq(categories.id, n.id));
    }
    // Dồn lại STT anh/em còn lại cùng cấp với mục vừa xóa
    await repackSiblingSortOrders(db, existing[0].parentId);
    await db.insert(auditLogs).values({
      actorAccountId: user.accountId,
      action: "category.delete",
      resourceType: "category",
      resourceId: existing[0].id,
      beforeRedacted: { name: existing[0].name, slug: existing[0].slug, deleted_ids: subtreeIds },
      requestId: requestId(c),
    });
    return c.json({ id: existing[0].id, deleted: true, deleted_ids: subtreeIds });
  }

  // Soft archive cascade
  await db
    .update(categories)
    .set({ status: "archived", updatedAt: new Date() })
    .where(inArray(categories.id, subtreeIds));

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "category.archive",
    resourceType: "category",
    resourceId: existing[0].id,
    afterRedacted: { status: "archived", product_count: subtreeProductCount, archived_ids: subtreeIds },
    requestId: requestId(c),
  });
  return c.json({
    id: existing[0].id,
    status: "archived",
    archived: true,
    product_count: subtreeProductCount,
    archived_ids: subtreeIds,
  });
});
