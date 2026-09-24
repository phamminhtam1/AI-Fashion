import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  products,
  productCategories,
  productOccasions,
  productVariants,
  productMedia,
  mediaAssets,
  collectionProducts,
  categories,
  colors,
  sizes,
  sizeCharts,
  occasions,
  seoRedirects,
  auditLogs,
  inventoryBalances,
  inventoryDocumentLines,
  stockMovements,
  warehouses,
} from "@elane/db";
import fs from "node:fs";
import path from "node:path";
import type { Db } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import { enrichTree } from "../../lib/category-tree.js";
import { mapProduct } from "../public/catalog.js";
import { env } from "../../env.js";

async function assertLeafCategory(db: Db, categoryId: string) {
  const all = await db.select().from(categories);
  const meta = enrichTree(all.map((r) => ({ id: r.id, parentId: r.parentId })));
  const node = meta.find((m) => m.id === categoryId);
  if (!node) throw new ApiError(400, "invalid_category", "Danh mục không hợp lệ");
  if (!node.is_leaf) {
    throw new ApiError(
      400,
      "not_leaf",
      "Chỉ gắn sản phẩm vào danh mục lá (không còn danh mục con)",
    );
  }
}

export const adminProductRoutes = new Hono<AppVars>();
adminProductRoutes.use("*", requireAuth);

const sizeStockSchema = z.array(
  z.object({
    size_id: z.string().uuid(),
    qty: z.number().int().nonnegative(),
  }),
);

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

adminProductRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.read");
  const db = c.get("db");
  const status = c.req.query("status");
  const rows = status
    ? await db.select().from(products).where(eq(products.status, status)).orderBy(desc(products.updatedAt)).limit(200)
    : await db.select().from(products).orderBy(desc(products.updatedAt)).limit(200);
  const items = [];
  for (const p of rows) items.push(await mapProduct(db, p, user.permissions.includes("cost.read")));
  return c.json({ items });
});

adminProductRoutes.get("/meta", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const [cats, cols, szs, charts, occs] = await Promise.all([
    db.select().from(categories).orderBy(categories.sortOrder),
    db.select().from(colors),
    db.select().from(sizes).orderBy(sizes.sortOrder),
    db.select().from(sizeCharts).orderBy(sizeCharts.name),
    db.select().from(occasions),
  ]);
  const catEnriched = enrichTree(
    cats.map((r) => ({ id: r.id, parentId: r.parentId, name: r.name, sortOrder: r.sortOrder })),
  );
  const catById = Object.fromEntries(catEnriched.map((e) => [e.id, e]));
  return c.json({
    categories: cats.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      status: r.status,
      parent_id: r.parentId,
      is_leaf: catById[r.id]!.is_leaf,
    })),
    colors: cols.map((r) => ({ id: r.id, code: r.code, name: r.name, hex: r.hex })),
    sizes: szs.map((r) => ({ id: r.id, code: r.code, label: r.label })),
    size_charts: charts.map((r) => ({ id: r.id, name: r.name, unit: r.unit })),
    occasions: occs.map((r) => ({ id: r.id, code: r.code, name: r.name, slug: r.slug })),
  });
});

adminProductRoutes.get("/meta/categories", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const rows = await c.get("db").select().from(categories);
  return c.json({ items: rows });
});

adminProductRoutes.get("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.read");
  const db = c.get("db");
  const rows = await db.select().from(products).where(eq(products.id, c.req.param("id"))).limit(1);
  if (!rows[0]) throw new ApiError(404, "not_found", "Không tìm thấy");
  return c.json(await mapProduct(db, rows[0], user.permissions.includes("cost.read")));
});

adminProductRoutes.post("/", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const body = z
    .object({
      name: z.string().min(1),
      slug: z.string().optional(),
      description: z.string().default(""),
      material: z.string().optional(),
      primary_category_id: z.string().uuid(),
      occasion_id: z.string().uuid().optional(),
      size_chart_id: z.string().uuid().nullable().optional(),
      status: z.enum(["draft", "published", "archived"]).default("draft"),
      price_vnd: z.number().int().nonnegative().optional(),
      compare_at_price_vnd: z.number().int().nonnegative().nullable().optional(),
      color_id: z.string().uuid().optional(),
      color_ids: z.array(z.string().uuid()).optional(),
      size_id: z.string().uuid().optional(),
      size_ids: z.array(z.string().uuid()).optional(),
      size_stocks: sizeStockSchema.optional(),
      is_best_seller: z.boolean().optional(),
      is_new: z.boolean().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu không hợp lệ");

  const db = c.get("db");
  const slug = body.data.slug?.trim() || slugify(body.data.name);
  const clash = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (clash[0]) throw new ApiError(409, "slug_taken", "Slug đã tồn tại");

  await assertLeafCategory(db, body.data.primary_category_id);

  if (body.data.size_chart_id) {
    const chart = await db.select().from(sizeCharts).where(eq(sizeCharts.id, body.data.size_chart_id)).limit(1);
    if (!chart[0]) throw new ApiError(400, "invalid_size_chart", "Bảng size không hợp lệ");
  }

  const [row] = await db
    .insert(products)
    .values({
      name: body.data.name.trim(),
      slug,
      description: body.data.description,
      material: body.data.material,
      primaryCategoryId: body.data.primary_category_id,
      sizeChartId: body.data.size_chart_id ?? null,
      status: body.data.status,
      publishedAt: body.data.status === "published" ? new Date() : null,
      isBestSeller: body.data.is_best_seller ?? false,
      newUntil: body.data.is_new ? new Date(Date.now() + 90 * 86400000) : null,
    })
    .returning();

  await db.insert(productCategories).values({ productId: row!.id, categoryId: body.data.primary_category_id });
  if (body.data.occasion_id) {
    await db.insert(productOccasions).values({ productId: row!.id, occasionId: body.data.occasion_id });
  }

  const price = body.data.price_vnd ?? 0;
  const wantsVariants =
    price > 0 ||
    body.data.color_id ||
    body.data.color_ids?.length ||
    body.data.size_id ||
    body.data.size_ids?.length ||
    body.data.size_stocks?.length;
  if (wantsVariants) {
    const allColors = await db.select().from(colors);
    const allSizes = await db.select().from(sizes).orderBy(sizes.sortOrder);
    let colorIds =
      body.data.color_ids?.length
        ? body.data.color_ids
        : body.data.color_id
          ? [body.data.color_id]
          : allColors.slice(0, 1).map((c) => c.id);
    for (const cid of colorIds) {
      if (!allColors.some((c) => c.id === cid)) throw new ApiError(400, "invalid_color", "Màu không hợp lệ");
    }
    const cat = await db
      .select()
      .from(categories)
      .where(eq(categories.id, body.data.primary_category_id))
      .limit(1);
    const isAccessory = cat[0]?.slug === "phu-kien";
    let sizeIds = body.data.size_ids ?? body.data.size_stocks?.map((s) => s.size_id);
    if (!sizeIds?.length) {
      if (body.data.size_id) sizeIds = [body.data.size_id];
      else if (isAccessory) {
        const one = allSizes.find((s) => s.code === "ONE_SIZE");
        sizeIds = one ? [one.id] : allSizes.slice(0, 1).map((s) => s.id);
      } else {
        sizeIds = allSizes.filter((s) => s.code !== "ONE_SIZE").map((s) => s.id);
        if (!sizeIds.length) sizeIds = allSizes.slice(0, 1).map((s) => s.id);
      }
    }
    const wh = await db.select().from(warehouses).where(eq(warehouses.code, "MAIN")).limit(1);
    if (colorIds.length && sizeIds.length) {
      let i = 0;
      for (const colorId of colorIds) {
        const color = allColors.find((c) => c.id === colorId);
        for (const sizeId of sizeIds) {
          i += 1;
          const size = allSizes.find((s) => s.id === sizeId);
          const sku =
            `${slug.toUpperCase().slice(0, 8)}-${(color?.code ?? "CL").slice(0, 4)}-${(size?.code ?? "SZ").slice(0, 4)}-${Date.now().toString(36).toUpperCase()}${i}`.replace(
              /[^A-Z0-9-]/g,
              "",
            );
          const [variant] = await db
            .insert(productVariants)
            .values({
              productId: row!.id,
              sku,
              colorId,
              sizeId,
              priceVnd: price,
              compareAtPriceVnd: body.data.compare_at_price_vnd ?? null,
              status: "active",
            })
            .returning();
          if (wh[0] && variant) {
            await db.insert(inventoryBalances).values({
              warehouseId: wh[0].id,
              variantId: variant.id,
              onHand: 0,
              reserved: 0,
              reorderPoint: 3,
            });
          }
        }
      }
    }
  }

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "product.create",
    resourceType: "product",
    resourceId: row!.id,
    afterRedacted: { name: row!.name, slug: row!.slug, status: row!.status },
    requestId: requestId(c),
  });
  return c.json(await mapProduct(db, row!, user.permissions.includes("cost.read")), 201);
});

adminProductRoutes.patch("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const body = z
    .object({
      name: z.string().optional(),
      slug: z.string().optional(),
      description: z.string().optional(),
      material: z.string().nullable().optional(),
      seo_title: z.string().nullable().optional(),
      seo_description: z.string().nullable().optional(),
      is_best_seller: z.boolean().optional(),
      is_new: z.boolean().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
      primary_category_id: z.string().uuid().optional(),
      occasion_id: z.string().uuid().nullable().optional(),
      size_chart_id: z.string().uuid().nullable().optional(),
      size_ids: z.array(z.string().uuid()).optional(),
      color_ids: z.array(z.string().uuid()).optional(),
      size_stocks: sizeStockSchema.optional(),
      price_vnd: z.number().int().nonnegative().optional(),
      compare_at_price_vnd: z.number().int().nonnegative().nullable().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu không hợp lệ");

  const db = c.get("db");
  const existing = await db.select().from(products).where(eq(products.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy");

  if (body.data.size_chart_id) {
    const chart = await db.select().from(sizeCharts).where(eq(sizeCharts.id, body.data.size_chart_id)).limit(1);
    if (!chart[0]) throw new ApiError(400, "invalid_size_chart", "Bảng size không hợp lệ");
  }

  const sizeIdsForCheck = body.data.size_ids ?? body.data.size_stocks?.map((s) => s.size_id);
  if (sizeIdsForCheck?.length) {
    const allSizes = await db.select().from(sizes);
    for (const sid of sizeIdsForCheck) {
      if (!allSizes.some((s) => s.id === sid)) throw new ApiError(400, "invalid_size", "Size không hợp lệ");
    }
  }
  if (body.data.color_ids?.length) {
    const allColors = await db.select().from(colors);
    for (const cid of body.data.color_ids) {
      if (!allColors.some((c) => c.id === cid)) throw new ApiError(400, "invalid_color", "Màu không hợp lệ");
    }
  }

  let nextSlug = existing[0].slug;
  if (body.data.slug && body.data.slug !== existing[0].slug) {
    nextSlug = body.data.slug.trim();
    const clash = await db.select().from(products).where(eq(products.slug, nextSlug)).limit(1);
    if (clash[0] && clash[0].id !== existing[0].id) throw new ApiError(409, "slug_taken", "Slug đã tồn tại");
    await db.insert(seoRedirects).values({
      oldPath: `/san-pham/${existing[0].slug}`,
      newPath: `/san-pham/${nextSlug}`,
      statusCode: 301,
    });
  }

  const status = body.data.status ?? existing[0].status;
  let publishedAt = existing[0].publishedAt;
  if (status === "published" && !publishedAt) publishedAt = new Date();

  const primaryCategoryId = body.data.primary_category_id ?? existing[0].primaryCategoryId;
  if (body.data.primary_category_id) {
    await assertLeafCategory(db, body.data.primary_category_id);
  }

  const [row] = await db
    .update(products)
    .set({
      name: body.data.name?.trim() ?? existing[0].name,
      slug: nextSlug,
      description: body.data.description ?? existing[0].description,
      material: body.data.material !== undefined ? body.data.material : existing[0].material,
      seoTitle: body.data.seo_title !== undefined ? body.data.seo_title : existing[0].seoTitle,
      seoDescription: body.data.seo_description !== undefined ? body.data.seo_description : existing[0].seoDescription,
      isBestSeller: body.data.is_best_seller ?? existing[0].isBestSeller,
      newUntil:
        body.data.is_new === undefined
          ? existing[0].newUntil
          : body.data.is_new
            ? (existing[0].newUntil ?? new Date(Date.now() + 90 * 86400000))
            : null,
      status,
      publishedAt: status === "published" ? (publishedAt ?? new Date()) : publishedAt,
      primaryCategoryId,
      sizeChartId:
        body.data.size_chart_id !== undefined ? body.data.size_chart_id : existing[0].sizeChartId,
      updatedAt: new Date(),
    })
    .where(eq(products.id, existing[0].id))
    .returning();

  if (body.data.primary_category_id) {
    await db.delete(productCategories).where(eq(productCategories.productId, existing[0].id));
    await db.insert(productCategories).values({ productId: existing[0].id, categoryId: body.data.primary_category_id });
  }

  if (body.data.occasion_id !== undefined) {
    await db.delete(productOccasions).where(eq(productOccasions.productId, existing[0].id));
    if (body.data.occasion_id) {
      await db.insert(productOccasions).values({ productId: existing[0].id, occasionId: body.data.occasion_id });
    }
  }

  if (body.data.price_vnd !== undefined || body.data.compare_at_price_vnd !== undefined) {
    const variants = await db.select().from(productVariants).where(eq(productVariants.productId, existing[0].id));
    for (const v of variants) {
      await db
        .update(productVariants)
        .set({
          priceVnd: body.data.price_vnd ?? v.priceVnd,
          compareAtPriceVnd:
            body.data.compare_at_price_vnd !== undefined ? body.data.compare_at_price_vnd : v.compareAtPriceVnd,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, v.id));
    }
  }

  // Sync color×size matrix → create missing variants, deactivate removed
  const syncSizeIds = body.data.size_ids ?? body.data.size_stocks?.map((s) => s.size_id);
  const syncColorIds = body.data.color_ids;
  if (syncSizeIds || syncColorIds) {
    const variants = await db.select().from(productVariants).where(eq(productVariants.productId, existing[0].id));
    const allSizes = await db.select().from(sizes);
    const allColors = await db.select().from(colors);
    const active = variants.filter((v) => v.status === "active");
    const wantSizes = new Set(
      syncSizeIds ?? [...new Set(active.map((v) => v.sizeId))],
    );
    let wantColors = new Set(
      syncColorIds ?? [...new Set(active.map((v) => v.colorId))],
    );
    if (!wantColors.size) {
      const fallback = allColors[0]?.id;
      if (fallback) wantColors = new Set([fallback]);
    }
    const price = body.data.price_vnd ?? variants[0]?.priceVnd ?? 0;
    const compare =
      body.data.compare_at_price_vnd !== undefined
        ? body.data.compare_at_price_vnd
        : (variants[0]?.compareAtPriceVnd ?? null);
    const wh = await db.select().from(warehouses).where(eq(warehouses.code, "MAIN")).limit(1);

    for (const v of variants) {
      const keep = wantSizes.has(v.sizeId) && wantColors.has(v.colorId);
      if (!keep && v.status === "active") {
        await db
          .update(productVariants)
          .set({ status: "inactive", updatedAt: new Date() })
          .where(eq(productVariants.id, v.id));
      }
    }

    for (const sizeId of wantSizes) {
      for (const colorId of wantColors) {
        const found = variants.find((v) => v.sizeId === sizeId && v.colorId === colorId);
        if (found) {
          if (found.status !== "active") {
            await db
              .update(productVariants)
              .set({ status: "active", updatedAt: new Date() })
              .where(eq(productVariants.id, found.id));
          }
          continue;
        }
        const size = allSizes.find((s) => s.id === sizeId);
        const color = allColors.find((c) => c.id === colorId);
        const sku =
          `${existing[0].slug.toUpperCase().slice(0, 8)}-${(color?.code ?? "CL").slice(0, 4)}-${(size?.code ?? "SZ").slice(0, 4)}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`.replace(
            /[^A-Z0-9-]/g,
            "",
          );
        const [variant] = await db
          .insert(productVariants)
          .values({
            productId: existing[0].id,
            sku,
            colorId,
            sizeId,
            priceVnd: price,
            compareAtPriceVnd: compare,
            status: "active",
          })
          .returning();
        if (wh[0] && variant) {
          await db.insert(inventoryBalances).values({
            warehouseId: wh[0].id,
            variantId: variant.id,
            onHand: 0,
            reserved: 0,
            reorderPoint: 3,
          });
          variants.push(variant);
        }
      }
    }
  }

  // size_stocks ignored — tồn chỉ đổi qua phiếu kho

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "product.update",
    resourceType: "product",
    resourceId: row!.id,
    beforeRedacted: { slug: existing[0].slug, name: existing[0].name, status: existing[0].status },
    afterRedacted: { slug: row!.slug, name: row!.name, status: row!.status },
    requestId: requestId(c),
  });
  return c.json(await mapProduct(db, row!, user.permissions.includes("cost.read")));
});

adminProductRoutes.post("/:id/publish", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.publish");
  const db = c.get("db");
  const existing = await db.select().from(products).where(eq(products.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy");
  const [row] = await db
    .update(products)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(products.id, existing[0].id))
    .returning();
  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "product.publish",
    resourceType: "product",
    resourceId: row!.id,
    requestId: requestId(c),
  });
  return c.json(await mapProduct(db, row!, user.permissions.includes("cost.read")));
});

adminProductRoutes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const existing = await db.select().from(products).where(eq(products.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy");

  const hard = c.req.query("hard") === "1" || c.req.query("hard") === "true";

  if (!hard) {
    const [row] = await db
      .update(products)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(products.id, existing[0].id))
      .returning();

    await db.insert(auditLogs).values({
      actorAccountId: user.accountId,
      action: "product.archive",
      resourceType: "product",
      resourceId: row!.id,
      beforeRedacted: { status: existing[0].status },
      afterRedacted: { status: "archived" },
      requestId: requestId(c),
    });
    return c.json({ id: row!.id, status: "archived", archived: true });
  }

  // Hard delete — gỡ hết quan hệ rồi xóa SP
  const productId = existing[0].id;
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  const variantIds = variants.map((v) => v.id);

  for (const vid of variantIds) {
    await db.delete(stockMovements).where(eq(stockMovements.variantId, vid));
    await db.delete(inventoryDocumentLines).where(eq(inventoryDocumentLines.variantId, vid));
    await db.delete(inventoryBalances).where(eq(inventoryBalances.variantId, vid));
  }

  const mediaLinks = await db.select().from(productMedia).where(eq(productMedia.productId, productId));
  await db.delete(productMedia).where(eq(productMedia.productId, productId));
  for (const link of mediaLinks) {
    const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.id, link.assetId)).limit(1);
    await db.delete(mediaAssets).where(eq(mediaAssets.id, link.assetId));
    if (assets[0]) {
      try {
        fs.unlinkSync(path.join(env.uploadDir, assets[0].objectKey));
      } catch {
        /* ignore */
      }
    }
  }

  await db.delete(productVariants).where(eq(productVariants.productId, productId));
  await db.delete(productCategories).where(eq(productCategories.productId, productId));
  await db.delete(productOccasions).where(eq(productOccasions.productId, productId));
  await db.delete(collectionProducts).where(eq(collectionProducts.productId, productId));
  await db.delete(products).where(eq(products.id, productId));

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "product.delete",
    resourceType: "product",
    resourceId: productId,
    beforeRedacted: { slug: existing[0].slug, name: existing[0].name, status: existing[0].status },
    requestId: requestId(c),
  });

  return c.json({ id: productId, deleted: true });
});
