import { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { mediaAssets, productMedia, products, auditLogs } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import { env } from "../../env.js";
import { mapProduct } from "../public/catalog.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export const adminMediaRoutes = new Hono<AppVars>();
adminMediaRoutes.use("*", requireAuth);

adminMediaRoutes.post("/products/:id/media", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const productId = c.req.param("id");

  const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!rows[0]) throw new ApiError(404, "not_found", "Không tìm thấy sản phẩm");

  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || typeof file === "string") {
    throw new ApiError(400, "validation_error", "Thiếu file ảnh (field: file)");
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    throw new ApiError(400, "invalid_mime", "Chỉ nhận JPEG/PNG/WebP/GIF");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new ApiError(400, "file_too_large", "Ảnh tối đa 5MB");
  }
  if (buf.byteLength < 32) {
    throw new ApiError(400, "validation_error", "File ảnh không hợp lệ");
  }

  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const objectKey = `products/${productId}/${randomUUID()}.${ext}`;
  const abs = path.join(env.uploadDir, objectKey);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);

  const existingMedia = await db
    .select()
    .from(productMedia)
    .where(eq(productMedia.productId, productId))
    .orderBy(asc(productMedia.sortOrder));
  const isCover = existingMedia.length === 0 || body["is_cover"] === "true" || body["is_cover"] === "1";

  if (isCover && existingMedia.length) {
    await db
      .update(productMedia)
      .set({ isCover: false })
      .where(and(eq(productMedia.productId, productId), eq(productMedia.isCover, true)));
  }

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      objectKey,
      mimeType: mime,
      bytes: buf.byteLength,
      altText: typeof body["alt"] === "string" ? body["alt"] : rows[0].name,
      uploadedBy: user.accountId,
    })
    .returning();

  const [link] = await db
    .insert(productMedia)
    .values({
      productId,
      assetId: asset!.id,
      sortOrder: existingMedia.length,
      isCover,
    })
    .returning();

  // Cover luôn sort 0
  if (isCover) {
    await db.update(productMedia).set({ sortOrder: 0 }).where(eq(productMedia.id, link!.id));
  }

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "product.media.upload",
    resourceType: "product",
    resourceId: productId,
    afterRedacted: { asset_id: asset!.id, object_key: objectKey, is_cover: isCover },
    requestId: requestId(c),
  });

  return c.json(await mapProduct(db, rows[0], user.permissions.includes("cost.read")), 201);
});

adminMediaRoutes.delete("/products/:id/media/:assetId", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const productId = c.req.param("id");
  const assetId = c.req.param("assetId");

  const links = await db
    .select()
    .from(productMedia)
    .where(and(eq(productMedia.productId, productId), eq(productMedia.assetId, assetId)))
    .limit(1);
  if (!links[0]) throw new ApiError(404, "not_found", "Không tìm thấy ảnh");

  const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1);
  await db.delete(productMedia).where(eq(productMedia.id, links[0].id));
  await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId));

  if (assets[0]) {
    const abs = path.join(env.uploadDir, assets[0].objectKey);
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore missing file */
    }
  }

  // Nếu xóa cover, promote ảnh đầu còn lại
  if (links[0].isCover) {
    const rest = await db
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, productId))
      .orderBy(asc(productMedia.sortOrder))
      .limit(1);
    if (rest[0]) {
      await db.update(productMedia).set({ isCover: true }).where(eq(productMedia.id, rest[0].id));
    }
  }

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "product.media.delete",
    resourceType: "product",
    resourceId: productId,
    beforeRedacted: { asset_id: assetId },
    requestId: requestId(c),
  });

  const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  return c.json(await mapProduct(db, rows[0]!, user.permissions.includes("cost.read")));
});
