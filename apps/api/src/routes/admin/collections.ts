import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  auditLogs,
  collections,
  collectionProducts,
  mediaAssets,
  products,
} from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { mediaPublicUrl, uploadMediaObject } from "../../lib/media-storage.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 10 * 1024 * 1024;
export const COLLECTION_CATEGORIES = [
  "ÁO",
  "ĐẦM",
  "CHÂN VÁY",
  "QUẦN",
  "SPECIAL RUNWAY COLLECTION",
  "PHỤ KIỆN",
] as const;

export const adminCollectionRoutes = new Hono<AppVars>();
adminCollectionRoutes.use("*", requireAuth);

function requireCollectionRead(
  user: NonNullable<AppVars["Variables"]["user"]>,
) {
  if (
    !user.permissions.includes("*") &&
    !user.permissions.includes("content.read") &&
    !user.permissions.includes("product.read")
  ) {
    throw new ApiError(403, "forbidden", "Bạn không có quyền xem bộ sưu tập");
  }
}

function requireCollectionWrite(
  user: NonNullable<AppVars["Variables"]["user"]>,
) {
  if (
    !user.permissions.includes("*") &&
    !user.permissions.includes("content.write") &&
    !user.permissions.includes("product.write")
  ) {
    throw new ApiError(
      403,
      "forbidden",
      "Bạn không có quyền quản lý bộ sưu tập",
    );
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseGalleryImages(
  value: unknown,
): Array<{ url: string; layout: "half" | "wide" }> {
  if (value === undefined) return [] as Array<{ url: string; layout: "half" | "wide" }>;
  if (!Array.isArray(value) || value.length > 40)
    throw new ApiError(400, "invalid_gallery", "Album có thể chứa tối đa 40 ảnh");
  return value.map((image: unknown) => {
    if (!image || typeof image !== "object")
      throw new ApiError(400, "invalid_gallery", "Danh sách ảnh album không hợp lệ");
    const url = String((image as { url?: unknown }).url ?? "").trim();
    const layout = (image as { layout?: unknown }).layout;
    const isLocalPath = url.startsWith("/") && !url.startsWith("//");
    let isWebUrl = false;
    try {
      const parsed = new URL(url);
      isWebUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      // Local app paths are accepted below.
    }
    if (
      !url ||
      url.length > 2048 ||
      (!isLocalPath && !isWebUrl) ||
      (layout !== "half" && layout !== "wide")
    )
      throw new ApiError(400, "invalid_gallery", "Danh sách ảnh album không hợp lệ");
    return { url, layout: layout as "half" | "wide" };
  });
}

async function toApiCollection(
  db: AppVars["Variables"]["db"],
  row: typeof collections.$inferSelect,
) {
  let coverImageUrl = row.coverImageUrl;
  if (!coverImageUrl && row.coverAssetId) {
    const [asset] = await db
      .select({ objectKey: mediaAssets.objectKey })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, row.coverAssetId))
      .limit(1);
    if (asset) coverImageUrl = mediaPublicUrl(asset.objectKey);
  }
  const productLinks = await db
    .select({ count: collectionProducts.productId })
    .from(collectionProducts)
    .where(eq(collectionProducts.collectionId, row.id));
  const linkedProducts = await db
    .select({ productId: collectionProducts.productId })
    .from(collectionProducts)
    .where(eq(collectionProducts.collectionId, row.id))
    .orderBy(asc(collectionProducts.sortOrder));
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    category: row.category,
    description: row.description,
    cover_image_url: coverImageUrl,
    hero_image_url: row.heroImageUrl,
    gallery_images: row.galleryImages ?? [],
    sort_order: row.sortOrder,
    is_featured: row.isFeatured,
    status: row.status,
    product_count: productLinks.length,
    product_ids: linkedProducts.map((link) => link.productId),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

adminCollectionRoutes.post("/upload", async (c) => {
  requireCollectionWrite(c.get("user")!);
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || typeof file === "string")
    throw new ApiError(400, "validation_error", "Vui lòng chọn ảnh");
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime))
    throw new ApiError(
      400,
      "invalid_mime",
      "Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF",
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_BYTES)
    throw new ApiError(400, "file_too_large", "Ảnh tối đa 10MB");
  if (bytes.length < 32)
    throw new ApiError(400, "validation_error", "File ảnh không hợp lệ");
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : "jpg";
  const objectKey = `collections/${randomUUID()}.${ext}`;
  await uploadMediaObject(objectKey, bytes, mime);
  return c.json({ url: mediaPublicUrl(objectKey), object_key: objectKey }, 201);
});

adminCollectionRoutes.get("/", async (c) => {
  requireCollectionRead(c.get("user")!);
  const db = c.get("db");
  const rows = await db
    .select()
    .from(collections)
    .orderBy(asc(collections.sortOrder), asc(collections.createdAt));
  const items = await Promise.all(rows.map((row) => toApiCollection(db, row)));
  return c.json({ items, categories: COLLECTION_CATEGORIES });
});

adminCollectionRoutes.post("/", async (c) => {
  const user = c.get("user")!;
  requireCollectionWrite(user);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const slug = slugify(String(body.slug ?? name));
  const coverImageUrl = String(body.cover_image_url ?? "").trim();
  if (!name || !slug || !coverImageUrl)
    throw new ApiError(
      400,
      "validation_error",
      "Tên, đường dẫn và ảnh poster là bắt buộc",
    );
  if (body.category && !COLLECTION_CATEGORIES.includes(body.category))
    throw new ApiError(400, "invalid_category", "Nhóm bộ sưu tập không hợp lệ");
  const [slugExists] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);
  if (slugExists)
    throw new ApiError(409, "slug_exists", "Đường dẫn này đã được dùng");
  const isFeatured = Boolean(body.is_featured);
  const [created] = await db.transaction(async (tx) => {
    if (isFeatured)
      await tx
        .update(collections)
        .set({ isFeatured: false, updatedAt: new Date() })
        .where(eq(collections.isFeatured, true));
    return tx
      .insert(collections)
      .values({
        name,
        slug,
        tagline: String(body.tagline ?? "").trim() || null,
        category: String(body.category ?? COLLECTION_CATEGORIES[4]),
        description: String(body.description ?? "").trim() || null,
        coverImageUrl,
        heroImageUrl: String(body.hero_image_url ?? "").trim() || null,
        galleryImages: parseGalleryImages(body.gallery_images),
        sortOrder: Number.isFinite(Number(body.sort_order))
          ? Number(body.sort_order)
          : 0,
        isFeatured,
        status:
          body.status === "published"
            ? "published"
            : body.status === "archived"
              ? "archived"
              : "draft",
      })
      .returning();
  });
  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "collection.create",
    resourceType: "collection",
    resourceId: created!.id,
    afterRedacted: created,
    requestId: requestId(c),
  });
  return c.json(await toApiCollection(db, created!), 201);
});

adminCollectionRoutes.patch("/:id", async (c) => {
  const user = c.get("user")!;
  requireCollectionWrite(user);
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  if (!existing)
    throw new ApiError(404, "not_found", "Không tìm thấy bộ sưu tập");
  const body = await c.req.json().catch(() => ({}));
  const productIds: string[] | undefined = Array.isArray(body.product_ids)
    ? [...new Set<string>(body.product_ids.map((id: unknown) => String(id)))]
    : undefined;
  if (productIds) {
    const validProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.status, "published"));
    const validIds = new Set(validProducts.map((product) => product.id));
    if (productIds.some((productId) => !validIds.has(productId)))
      throw new ApiError(
        400,
        "invalid_products",
        "Danh sách sản phẩm không hợp lệ",
      );
  }
  const patch: Partial<typeof collections.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name)
      throw new ApiError(
        400,
        "validation_error",
        "Tên bộ sưu tập không được để trống",
      );
    patch.name = name;
  }
  if (body.slug !== undefined) {
    const slug = slugify(String(body.slug));
    if (!slug)
      throw new ApiError(400, "validation_error", "Đường dẫn không hợp lệ");
    const [slugExists] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.slug, slug))
      .limit(1);
    if (slugExists && slugExists.id !== id)
      throw new ApiError(409, "slug_exists", "Đường dẫn này đã được dùng");
    patch.slug = slug;
  }
  if (body.tagline !== undefined)
    patch.tagline = String(body.tagline).trim() || null;
  if (body.category !== undefined) {
    const category = String(body.category);
    if (
      !COLLECTION_CATEGORIES.includes(
        category as (typeof COLLECTION_CATEGORIES)[number],
      )
    )
      throw new ApiError(
        400,
        "invalid_category",
        "Nhóm bộ sưu tập không hợp lệ",
      );
    patch.category = category;
  }
  if (body.description !== undefined)
    patch.description = String(body.description).trim() || null;
  if (body.cover_image_url !== undefined)
    patch.coverImageUrl = String(body.cover_image_url).trim() || null;
  if (body.hero_image_url !== undefined)
    patch.heroImageUrl = String(body.hero_image_url).trim() || null;
  if (body.gallery_images !== undefined)
    patch.galleryImages = parseGalleryImages(body.gallery_images);
  if (body.sort_order !== undefined)
    patch.sortOrder = Number(body.sort_order) || 0;
  if (body.status !== undefined) {
    if (!["draft", "published", "archived"].includes(body.status))
      throw new ApiError(400, "invalid_status", "Trạng thái không hợp lệ");
    patch.status = body.status;
  }
  if (body.is_featured !== undefined)
    patch.isFeatured = Boolean(body.is_featured);
  const updated = await db.transaction(async (tx) => {
    if (patch.isFeatured)
      await tx
        .update(collections)
        .set({ isFeatured: false, updatedAt: new Date() })
        .where(eq(collections.isFeatured, true));
    const [saved] = await tx
      .update(collections)
      .set(patch)
      .where(eq(collections.id, id))
      .returning();
    if (productIds) {
      await tx
        .delete(collectionProducts)
        .where(eq(collectionProducts.collectionId, id));
      if (productIds.length)
        await tx.insert(collectionProducts).values(
          productIds.map((productId, sortOrder) => ({
            collectionId: id,
            productId,
            sortOrder,
          })),
        );
    }
    return saved!;
  });
  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "collection.update",
    resourceType: "collection",
    resourceId: id,
    beforeRedacted: existing,
    afterRedacted: updated,
    requestId: requestId(c),
  });
  return c.json(await toApiCollection(db, updated!));
});

adminCollectionRoutes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  requireCollectionWrite(user);
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  if (!existing)
    throw new ApiError(404, "not_found", "Không tìm thấy bộ sưu tập");
  await db.transaction(async (tx) => {
    await tx
      .update(collections)
      .set({ status: "archived", isFeatured: false, updatedAt: new Date() })
      .where(eq(collections.id, id));
    const remaining = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.isFeatured, true))
      .limit(1);
    if (remaining.length === 0) {
      const [next] = await tx
        .select({ id: collections.id })
        .from(collections)
        .where(eq(collections.status, "published"))
        .orderBy(asc(collections.sortOrder))
        .limit(1);
      if (next)
        await tx
          .update(collections)
          .set({ isFeatured: true, updatedAt: new Date() })
          .where(eq(collections.id, next.id));
    }
  });
  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "collection.archive",
    resourceType: "collection",
    resourceId: id,
    beforeRedacted: existing,
    requestId: requestId(c),
  });
  return c.json({ id, success: true });
});

adminCollectionRoutes.post("/reorder", async (c) => {
  const user = c.get("user")!;
  requireCollectionWrite(user);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const items = Array.isArray(body.items)
    ? (body.items as Array<{ id: string; sort_order: number }>)
    : [];
  if (!items.length)
    throw new ApiError(400, "invalid_body", "Chưa có thứ tự cần lưu");
  await db.transaction(async (tx) => {
    for (const item of items)
      await tx
        .update(collections)
        .set({ sortOrder: Number(item.sort_order) || 0, updatedAt: new Date() })
        .where(eq(collections.id, item.id));
  });
  return c.json({ success: true, count: items.length });
});
