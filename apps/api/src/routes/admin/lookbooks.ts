import { Hono } from "hono";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { auditLogs, lookbooks, lookbookItems, products } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { deleteMediaObject, mediaPublicUrl, uploadMediaObject } from "../../lib/media-storage.js";
import { requirePerm } from "../../lib/session.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const adminLookbookRoutes = new Hono<AppVars>();
adminLookbookRoutes.use("*", requireAuth);

/** 1. Standalone image upload for Lookbook cover & items */
adminLookbookRoutes.post("/upload", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || typeof file === "string") {
    throw new ApiError(400, "validation_error", "Thiếu file ảnh (field: file)");
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    throw new ApiError(400, "invalid_mime", "Chỉ chấp nhận định dạng ảnh JPEG, PNG, WebP hoặc GIF");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new ApiError(400, "file_too_large", "Ảnh tối đa 10MB");
  }
  if (buf.byteLength < 32) {
    throw new ApiError(400, "validation_error", "File ảnh không hợp lệ");
  }

  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const objectKey = `lookbooks/${randomUUID()}.${ext}`;
  await uploadMediaObject(objectKey, buf, mime);

  const url = mediaPublicUrl(objectKey);
  return c.json({ url, object_key: objectKey }, 201);
});

/** 2. List all lookbooks with item count and product count */
adminLookbookRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.read");
  const db = c.get("db");

  const rows = await db
    .select({
      id: lookbooks.id,
      slug: lookbooks.slug,
      title: lookbooks.title,
      subtitle: lookbooks.subtitle,
      description: lookbooks.description,
      season: lookbooks.season,
      year: lookbooks.year,
      cover_image_url: lookbooks.coverImageUrl,
      sort_order: lookbooks.sortOrder,
      status: lookbooks.status,
      intro_content: lookbooks.introContent,
      published_at: lookbooks.publishedAt,
      unpublish_at: lookbooks.unpublishAt,
      unpublish_enabled: lookbooks.unpublishEnabled,
      show_on_home: lookbooks.showOnHome,
      allow_products: lookbooks.allowProducts,
      view_count: lookbooks.viewCount,
      attached_products: lookbooks.attachedProducts,
      attached_product_ids: lookbooks.attachedProductIds,
      created_at: lookbooks.createdAt,
      updated_at: lookbooks.updatedAt,
      item_count: sql<number>`(SELECT count(*)::int FROM lookbook_items WHERE lookbook_items.lookbook_id = lookbooks.id)`,
      product_count: sql<number>`(
        SELECT count(DISTINCT pid)::int FROM (
          SELECT product_id::text AS pid FROM lookbook_items WHERE lookbook_items.lookbook_id = lookbooks.id AND product_id IS NOT NULL
          UNION
          SELECT elem->>'id' AS pid FROM jsonb_array_elements(COALESCE(lookbooks.attached_products, '[]'::jsonb)) AS elem WHERE elem->>'id' IS NOT NULL
        ) t
      )`,
    })
    .from(lookbooks)
    .orderBy(asc(lookbooks.sortOrder), desc(lookbooks.createdAt));

  return c.json({ items: rows });
});

/** 3. Reorder lookbooks */
adminLookbookRoutes.post("/reorder", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");

  const body = await c.req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? (body.items as Array<{ id: string; sort_order: number }>) : [];
  if (!items.length) {
    throw new ApiError(400, "invalid_body", "Thiếu danh sách items cần sắp xếp");
  }

  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(lookbooks)
        .set({ sortOrder: item.sort_order, updatedAt: new Date() })
        .where(eq(lookbooks.id, item.id));
    }
  });

  return c.json({ success: true, count: items.length });
});

/** 4. Bulk delete lookbooks */
adminLookbookRoutes.post("/bulk-delete", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");

  const body = await c.req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  if (!ids.length) {
    throw new ApiError(400, "invalid_body", "Thiếu danh sách lookbook IDs");
  }

  await db.delete(lookbooks).where(inArray(lookbooks.id, ids));

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "lookbook.bulk_delete",
    resourceType: "lookbook",
    resourceId: ids[0] || "bulk",
    beforeRedacted: { ids },
    requestId: requestId(c),
  });

  return c.json({ success: true, count: ids.length });
});

/** 5. Get single lookbook by ID or SLUG with all its items */
adminLookbookRoutes.get("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.read");
  const db = c.get("db");
  const param = c.req.param("id");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
  const [lb] = await db
    .select({
      id: lookbooks.id,
      slug: lookbooks.slug,
      title: lookbooks.title,
      subtitle: lookbooks.subtitle,
      description: lookbooks.description,
      season: lookbooks.season,
      year: lookbooks.year,
      cover_image_url: lookbooks.coverImageUrl,
      sort_order: lookbooks.sortOrder,
      status: lookbooks.status,
      intro_content: lookbooks.introContent,
      published_at: lookbooks.publishedAt,
      unpublish_at: lookbooks.unpublishAt,
      unpublish_enabled: lookbooks.unpublishEnabled,
      show_on_home: lookbooks.showOnHome,
      allow_products: lookbooks.allowProducts,
      view_count: lookbooks.viewCount,
      attached_products: lookbooks.attachedProducts,
      attached_product_ids: lookbooks.attachedProductIds,
      created_at: lookbooks.createdAt,
      updated_at: lookbooks.updatedAt,
      item_count: sql<number>`(SELECT count(*)::int FROM lookbook_items WHERE lookbook_items.lookbook_id = lookbooks.id)`,
      product_count: sql<number>`(
        SELECT count(DISTINCT pid)::int FROM (
          SELECT product_id::text AS pid FROM lookbook_items WHERE lookbook_items.lookbook_id = lookbooks.id AND product_id IS NOT NULL
          UNION
          SELECT elem->>'id' AS pid FROM jsonb_array_elements(COALESCE(lookbooks.attached_products, '[]'::jsonb)) AS elem WHERE elem->>'id' IS NOT NULL
        ) t
      )`,
    })
    .from(lookbooks)
    .where(isUuid ? or(eq(lookbooks.id, param), eq(lookbooks.slug, param)) : eq(lookbooks.slug, param))
    .limit(1);

  if (!lb) {
    throw new ApiError(404, "not_found", "Không tìm thấy bộ Lookbook");
  }

  const items = await db
    .select({
      id: lookbookItems.id,
      lookbook_id: lookbookItems.lookbookId,
      title: lookbookItems.title,
      caption: lookbookItems.caption,
      image_url: lookbookItems.imageUrl,
      product_id: lookbookItems.productId,
      link_url: lookbookItems.linkUrl,
      sort_order: lookbookItems.sortOrder,
      status: lookbookItems.status,
      created_at: lookbookItems.createdAt,
      updated_at: lookbookItems.updatedAt,
      product_name: products.name,
      product_slug: products.slug,
    })
    .from(lookbookItems)
    .leftJoin(products, eq(products.id, lookbookItems.productId))
    .where(eq(lookbookItems.lookbookId, lb.id))
    .orderBy(asc(lookbookItems.sortOrder), asc(lookbookItems.createdAt));

  return c.json({
    ...lb,
    items: items.map((it) => ({
      ...it,
      link_url: it.link_url || (it.product_slug ? `/san-pham/${it.product_slug}` : null),
    })),
  });
});

/** 6. Create new lookbook */
adminLookbookRoutes.post("/", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");

  const body = await c.req.json().catch(() => ({}));
  const title = (body.title || "").trim();
  if (!title) {
    throw new ApiError(400, "validation_error", "Tiêu đề bộ Lookbook không được để trống");
  }

  const coverImageUrl = (body.cover_image_url || body.coverImageUrl || "").trim();
  if (!coverImageUrl) {
    throw new ApiError(400, "validation_error", "Ảnh bìa bộ Lookbook không được để trống");
  }

  let slug = (body.slug || "").trim();
  if (!slug) {
    slug = slugify(title);
  }
  // Ensure uniqueness
  const existingSlug = await db.select().from(lookbooks).where(eq(lookbooks.slug, slug)).limit(1);
  if (existingSlug.length > 0) {
    slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
  }

  const status =
    body.status === "draft" || body.status === "archived" || body.status === "scheduled" ? body.status : "published";

  let publishedAt: Date | null = null;
  if (body.published_at || body.publishedAt) {
    publishedAt = new Date(body.published_at || body.publishedAt);
  } else if (status === "published") {
    publishedAt = new Date();
  }

  let unpublishAt: Date | null = null;
  if (body.unpublish_at || body.unpublishAt) {
    unpublishAt = new Date(body.unpublish_at || body.unpublishAt);
  }

  const attachedProducts = Array.isArray(body.attached_products)
    ? body.attached_products
    : Array.isArray(body.products)
      ? body.products
      : [];

  const attachedProductIds = Array.isArray(body.attached_product_ids)
    ? body.attached_product_ids
    : attachedProducts.map((p: any) => p.id).filter(Boolean);

  const [created] = await db
    .insert(lookbooks)
    .values({
      title,
      slug,
      subtitle: (body.subtitle || "").trim() || null,
      description: (body.description || "").trim() || null,
      season: (body.season || "").trim() || null,
      year: typeof body.year === "number" ? body.year : Number(body.year) || null,
      coverImageUrl,
      sortOrder: typeof body.sort_order === "number" ? body.sort_order : Number(body.sort_order) || 0,
      status,
      introContent: (body.intro_content || body.introContent || "").trim() || null,
      publishedAt,
      unpublishAt,
      unpublishEnabled: body.unpublish_enabled ?? Boolean(unpublishAt),
      showOnHome: body.show_on_home ?? true,
      allowProducts: body.allow_products ?? true,
      viewCount: typeof body.view_count === "number" ? body.view_count : 0,
      attachedProducts,
      attachedProductIds,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "lookbook.create",
    resourceType: "lookbook",
    resourceId: created.id,
    afterRedacted: created,
    requestId: requestId(c),
  });

  return c.json(created, 201);
});

/** 7. Update lookbook */
adminLookbookRoutes.patch("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const id = c.req.param("id");

  const [existing] = await db.select().from(lookbooks).where(eq(lookbooks.id, id)).limit(1);
  if (!existing) {
    throw new ApiError(404, "not_found", "Không tìm thấy bộ Lookbook");
  }

  const body = await c.req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw new ApiError(400, "validation_error", "Tiêu đề không được để trống");
    patch.title = title;
  }
  if (body.slug !== undefined) {
    const slug = slugify(String(body.slug).trim());
    if (slug && slug !== existing.slug) {
      const clash = await db.select().from(lookbooks).where(eq(lookbooks.slug, slug)).limit(1);
      if (clash.length > 0) {
        throw new ApiError(400, "slug_exists", "Đường dẫn slug này đã tồn tại");
      }
      patch.slug = slug;
    }
  }
  if (body.subtitle !== undefined) patch.subtitle = String(body.subtitle).trim() || null;
  if (body.description !== undefined) patch.description = String(body.description).trim() || null;
  if (body.season !== undefined) patch.season = String(body.season).trim() || null;
  if (body.year !== undefined) patch.year = typeof body.year === "number" ? body.year : Number(body.year) || null;
  if (body.cover_image_url !== undefined || body.coverImageUrl !== undefined) {
    const url = String(body.cover_image_url || body.coverImageUrl).trim();
    if (url) patch.coverImageUrl = url;
  }
  if (typeof body.sort_order === "number") patch.sortOrder = body.sort_order;
  if (body.status !== undefined) {
    patch.status =
      body.status === "draft" || body.status === "archived" || body.status === "scheduled"
        ? body.status
        : "published";
  }
  if (body.intro_content !== undefined || body.introContent !== undefined) {
    patch.introContent = String(body.intro_content || body.introContent).trim() || null;
  }
  if (body.published_at !== undefined || body.publishedAt !== undefined) {
    const val = body.published_at || body.publishedAt;
    patch.publishedAt = val ? new Date(val) : null;
  } else if (patch.status === "published" && !existing.publishedAt) {
    patch.publishedAt = new Date();
  }
  if (body.unpublish_at !== undefined || body.unpublishAt !== undefined) {
    const val = body.unpublish_at || body.unpublishAt;
    patch.unpublishAt = val ? new Date(val) : null;
  }
  if (body.unpublish_enabled !== undefined || body.unpublishEnabled !== undefined) {
    patch.unpublishEnabled = Boolean(body.unpublish_enabled ?? body.unpublishEnabled);
  }
  if (body.show_on_home !== undefined || body.showOnHome !== undefined) {
    patch.showOnHome = Boolean(body.show_on_home ?? body.showOnHome);
  }
  if (body.allow_products !== undefined || body.allowProducts !== undefined) {
    patch.allowProducts = Boolean(body.allow_products ?? body.allowProducts);
  }
  if (body.view_count !== undefined || body.viewCount !== undefined) {
    patch.viewCount = Number(body.view_count ?? body.viewCount) || 0;
  }
  if (body.attached_products !== undefined || body.products !== undefined) {
    const prods = Array.isArray(body.attached_products)
      ? body.attached_products
      : Array.isArray(body.products)
        ? body.products
        : [];
    patch.attachedProducts = prods;
    patch.attachedProductIds = prods.map((p: any) => p.id).filter(Boolean);
  }
  if (body.attached_product_ids !== undefined) {
    patch.attachedProductIds = Array.isArray(body.attached_product_ids) ? body.attached_product_ids : [];
  }

  const [updated] = await db.update(lookbooks).set(patch).where(eq(lookbooks.id, id)).returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "lookbook.update",
    resourceType: "lookbook",
    resourceId: id,
    beforeRedacted: existing,
    afterRedacted: updated,
    requestId: requestId(c),
  });

  return c.json(updated);
});

/** 8. Delete lookbook */
adminLookbookRoutes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const id = c.req.param("id");

  const [existing] = await db.select().from(lookbooks).where(eq(lookbooks.id, id)).limit(1);
  if (!existing) {
    throw new ApiError(404, "not_found", "Không tìm thấy bộ Lookbook");
  }

  await db.delete(lookbooks).where(eq(lookbooks.id, id));

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "lookbook.delete",
    resourceType: "lookbook",
    resourceId: id,
    beforeRedacted: existing,
    requestId: requestId(c),
  });

  return c.json({ id, success: true });
});


/** 8. Add item to lookbook */
adminLookbookRoutes.post("/:id/items", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const lookbookId = c.req.param("id");

  const [lb] = await db.select().from(lookbooks).where(eq(lookbooks.id, lookbookId)).limit(1);
  if (!lb) {
    throw new ApiError(404, "not_found", "Không tìm thấy bộ Lookbook");
  }

  const body = await c.req.json().catch(() => ({}));
  const imageUrl = (body.image_url || body.imageUrl || "").trim();
  if (!imageUrl) {
    throw new ApiError(400, "validation_error", "Thiếu ảnh cho khung hình lookbook");
  }

  let productId: string | null = null;
  if (body.product_id || body.productId) {
    const pid = body.product_id || body.productId;
    const [p] = await db.select().from(products).where(eq(products.id, pid)).limit(1);
    if (p) productId = p.id;
  }

  const [created] = await db
    .insert(lookbookItems)
    .values({
      lookbookId,
      title: (body.title || "").trim() || null,
      caption: (body.caption || "").trim() || null,
      imageUrl,
      productId,
      linkUrl: (body.link_url || body.linkUrl || "").trim() || null,
      sortOrder: typeof body.sort_order === "number" ? body.sort_order : 0,
      status: body.status === "draft" ? "draft" : "published",
    })
    .returning();

  return c.json(created, 201);
});

/** 9. Update lookbook item */
adminLookbookRoutes.patch("/items/:itemId", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const itemId = c.req.param("itemId");

  const [existing] = await db.select().from(lookbookItems).where(eq(lookbookItems.id, itemId)).limit(1);
  if (!existing) {
    throw new ApiError(404, "not_found", "Không tìm thấy khung hình lookbook");
  }

  const body = await c.req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) patch.title = String(body.title).trim() || null;
  if (body.caption !== undefined) patch.caption = String(body.caption).trim() || null;
  if (body.image_url !== undefined || body.imageUrl !== undefined) {
    const img = String(body.image_url || body.imageUrl).trim();
    if (img) patch.imageUrl = img;
  }
  if (body.product_id !== undefined || body.productId !== undefined) {
    const pid = body.product_id ?? body.productId;
    if (pid) {
      const [p] = await db.select().from(products).where(eq(products.id, pid)).limit(1);
      patch.productId = p ? p.id : null;
    } else {
      patch.productId = null;
    }
  }
  if (body.link_url !== undefined || body.linkUrl !== undefined) {
    patch.linkUrl = String(body.link_url || body.linkUrl).trim() || null;
  }
  if (typeof body.sort_order === "number") patch.sortOrder = body.sort_order;
  if (body.status !== undefined) patch.status = body.status === "draft" ? "draft" : "published";

  const [updated] = await db.update(lookbookItems).set(patch).where(eq(lookbookItems.id, itemId)).returning();

  return c.json(updated);
});

/** 10. Delete lookbook item */
adminLookbookRoutes.delete("/items/:itemId", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const itemId = c.req.param("itemId");

  const [existing] = await db.select().from(lookbookItems).where(eq(lookbookItems.id, itemId)).limit(1);
  if (!existing) {
    throw new ApiError(404, "not_found", "Không tìm thấy khung hình lookbook");
  }

  await db.delete(lookbookItems).where(eq(lookbookItems.id, itemId));
  return c.json({ id: itemId, success: true });
});

/** 11. Reorder items within a lookbook */
adminLookbookRoutes.post("/:id/items/reorder", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const lookbookId = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? (body.items as Array<{ id: string; sort_order: number }>) : [];
  if (!items.length) {
    throw new ApiError(400, "invalid_body", "Thiếu danh sách items cần sắp xếp");
  }

  await db.transaction(async (tx) => {
    for (const it of items) {
      await tx
        .update(lookbookItems)
        .set({ sortOrder: it.sort_order, updatedAt: new Date() })
        .where(and(eq(lookbookItems.id, it.id), eq(lookbookItems.lookbookId, lookbookId)));
    }
  });

  return c.json({ success: true, count: items.length });
});
