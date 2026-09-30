import { Hono } from "hono";
import { asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { elaneWomanPosts, products, auditLogs } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { deleteMediaObject, mediaPublicUrl, uploadMediaObject } from "../../lib/media-storage.js";
import { requirePerm } from "../../lib/session.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export const adminElaneWomanRoutes = new Hono<AppVars>();
adminElaneWomanRoutes.use("*", requireAuth);

/** Standalone image upload for ÉLANEwoman lookbook */
adminElaneWomanRoutes.post("/upload", async (c) => {
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
  const objectKey = `elane-woman/${randomUUID()}.${ext}`;
  await uploadMediaObject(objectKey, buf, mime);

  const url = mediaPublicUrl(objectKey);
  return c.json({ url, object_key: objectKey }, 201);
});

/** Batch reorder ÉLANEwoman posts */
adminElaneWomanRoutes.post("/reorder", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");

  const body = await c.req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? (body.items as Array<{ id: string; sort_order: number }>) : [];
  if (!items.length) {
    throw new ApiError(400, "invalid_body", "Thiếu danh sách items cần sắp xếp");
  }

  for (const item of items) {
    if (item.id && typeof item.sort_order === "number") {
      await db
        .update(elaneWomanPosts)
        .set({ sortOrder: item.sort_order, updatedAt: new Date() })
        .where(eq(elaneWomanPosts.id, item.id));
    }
  }

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "elane_woman.reorder",
    resourceType: "elane_woman_post",
    resourceId: items[0]?.id ?? "batch",
    afterRedacted: { reordered_count: items.length },
    requestId: requestId(c),
  });

  return c.json({ success: true, count: items.length });
});

/** List all ÉLANEwoman posts */
adminElaneWomanRoutes.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: elaneWomanPosts.id,
      title: elaneWomanPosts.title,
      image_url: elaneWomanPosts.imageUrl,
      link_url: elaneWomanPosts.linkUrl,
      product_id: elaneWomanPosts.productId,
      instagram_url: elaneWomanPosts.instagramUrl,
      sort_order: elaneWomanPosts.sortOrder,
      status: elaneWomanPosts.status,
      created_at: elaneWomanPosts.createdAt,
      updated_at: elaneWomanPosts.updatedAt,
      product_name: products.name,
      product_slug: products.slug,
    })
    .from(elaneWomanPosts)
    .leftJoin(products, eq(products.id, elaneWomanPosts.productId))
    .orderBy(asc(elaneWomanPosts.sortOrder), desc(elaneWomanPosts.createdAt));

  return c.json({ items: rows });
});

/** Create an ÉLANEwoman post */
adminElaneWomanRoutes.post("/", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");

  let title: string | null = null;
  let imageUrl: string | null = null;
  let linkUrl: string | null = null;
  let productId: string | null = null;
  let instagramUrl: string | null = null;
  let sortOrder = 0;
  let status = "published";

  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    title = typeof body["title"] === "string" ? body["title"].trim() || null : null;
    linkUrl = typeof body["link_url"] === "string" ? body["link_url"].trim() || null : null;
    productId = typeof body["product_id"] === "string" && body["product_id"].trim() ? body["product_id"].trim() : null;
    instagramUrl = typeof body["instagram_url"] === "string" ? body["instagram_url"].trim() || null : null;
    if (body["sort_order"] != null) sortOrder = Number(body["sort_order"]) || 0;
    if (typeof body["status"] === "string" && (body["status"] === "draft" || body["status"] === "published")) {
      status = body["status"];
    }

    const file = body["file"];
    if (file && typeof file !== "string") {
      const mime = file.type || "application/octet-stream";
      if (!ALLOWED.has(mime)) {
        throw new ApiError(400, "invalid_mime", "Chỉ nhận JPEG, PNG, WebP hoặc GIF");
      }
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) {
        throw new ApiError(400, "file_too_large", "Ảnh tối đa 10MB");
      }
      const ext =
        mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
      const objectKey = `elane-woman/${randomUUID()}.${ext}`;
      await uploadMediaObject(objectKey, buf, mime);
      imageUrl = mediaPublicUrl(objectKey);
    } else if (typeof body["image_url"] === "string" && body["image_url"].trim()) {
      imageUrl = body["image_url"].trim();
    }
  } else {
    const body = await c.req.json().catch(() => ({}));
    title = body.title?.trim() || null;
    imageUrl = body.image_url?.trim() || null;
    linkUrl = body.link_url?.trim() || null;
    productId = body.product_id?.trim() || null;
    instagramUrl = body.instagram_url?.trim() || null;
    if (body.sort_order != null) sortOrder = Number(body.sort_order) || 0;
    if (body.status === "draft" || body.status === "published") status = body.status;
  }

  if (!imageUrl) {
    throw new ApiError(400, "missing_image", "Vui lòng chọn file tải lên hoặc nhập đường dẫn ảnh (image_url)");
  }

  if (productId) {
    const prodExists = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
    if (!prodExists[0]) productId = null;
  }

  const [created] = await db
    .insert(elaneWomanPosts)
    .values({
      title,
      imageUrl,
      linkUrl,
      productId,
      instagramUrl,
      sortOrder,
      status,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "elane_woman.create",
    resourceType: "elane_woman_post",
    resourceId: created!.id,
    afterRedacted: { title, image_url: imageUrl, sort_order: sortOrder, status },
    requestId: requestId(c),
  });

  return c.json(created, 201);
});

/** Update an ÉLANEwoman post */
adminElaneWomanRoutes.patch("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db.select().from(elaneWomanPosts).where(eq(elaneWomanPosts.id, id)).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy bài đăng ÉLANEwoman");

  const updates: Partial<typeof elaneWomanPosts.$inferInsert> = {
    updatedAt: new Date(),
  };

  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    if (body["title"] !== undefined) {
      updates.title = typeof body["title"] === "string" ? body["title"].trim() || null : null;
    }
    if (body["link_url"] !== undefined) {
      updates.linkUrl = typeof body["link_url"] === "string" ? body["link_url"].trim() || null : null;
    }
    if (body["product_id"] !== undefined) {
      const pid = typeof body["product_id"] === "string" ? body["product_id"].trim() : "";
      updates.productId = pid || null;
    }
    if (body["instagram_url"] !== undefined) {
      updates.instagramUrl = typeof body["instagram_url"] === "string" ? body["instagram_url"].trim() || null : null;
    }
    if (body["sort_order"] !== undefined) {
      updates.sortOrder = Number(body["sort_order"]) || 0;
    }
    if (body["status"] === "draft" || body["status"] === "published") {
      updates.status = body["status"];
    }

    const file = body["file"];
    if (file && typeof file !== "string") {
      const mime = file.type || "application/octet-stream";
      if (!ALLOWED.has(mime)) throw new ApiError(400, "invalid_mime", "Chỉ nhận JPEG, PNG, WebP hoặc GIF");
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.byteLength > MAX_BYTES) throw new ApiError(400, "file_too_large", "Ảnh tối đa 10MB");
      const ext =
        mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
      const objectKey = `elane-woman/${randomUUID()}.${ext}`;
      await uploadMediaObject(objectKey, buf, mime);
      updates.imageUrl = mediaPublicUrl(objectKey);
    } else if (typeof body["image_url"] === "string" && body["image_url"].trim()) {
      updates.imageUrl = body["image_url"].trim();
    }
  } else {
    const body = await c.req.json().catch(() => ({}));
    if (body.title !== undefined) updates.title = body.title?.trim() || null;
    if (body.image_url !== undefined && body.image_url.trim()) updates.imageUrl = body.image_url.trim();
    if (body.link_url !== undefined) updates.linkUrl = body.link_url?.trim() || null;
    if (body.product_id !== undefined) updates.productId = body.product_id?.trim() || null;
    if (body.instagram_url !== undefined) updates.instagramUrl = body.instagram_url?.trim() || null;
    if (body.sort_order !== undefined) updates.sortOrder = Number(body.sort_order) || 0;
    if (body.status === "draft" || body.status === "published") updates.status = body.status;
  }

  const [updated] = await db
    .update(elaneWomanPosts)
    .set(updates)
    .where(eq(elaneWomanPosts.id, id))
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "elane_woman.update",
    resourceType: "elane_woman_post",
    resourceId: id,
    beforeRedacted: existing[0],
    afterRedacted: updated,
    requestId: requestId(c),
  });

  return c.json(updated);
});

/** Delete an ÉLANEwoman post */
adminElaneWomanRoutes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db.select().from(elaneWomanPosts).where(eq(elaneWomanPosts.id, id)).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy bài đăng");

  await db.delete(elaneWomanPosts).where(eq(elaneWomanPosts.id, id));

  // If local object key
  if (existing[0].imageUrl.includes("/elane-woman/")) {
    const match = existing[0].imageUrl.match(/elane-woman\/[^/?#]+/);
    if (match?.[0]) {
      await deleteMediaObject(match[0]).catch(() => {});
    }
  }

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "elane_woman.delete",
    resourceType: "elane_woman_post",
    resourceId: id,
    beforeRedacted: existing[0],
    requestId: requestId(c),
  });

  return c.json({ id, success: true });
});
