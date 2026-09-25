import { Hono } from "hono";
import { and, desc, eq, inArray, sql, or, ilike, gte, lte, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  products,
  productCategories,
  productColorways,
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
} from "@elane/db";
import type { Db } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import { enrichTree } from "../../lib/category-tree.js";
import { deleteMediaObjects } from "../../lib/media-storage.js";
import { mapProduct } from "../public/catalog.js";

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

function makeSku(slug: string, colorwayId: string, sizeCode: string, n: number) {
  return `${slug.toUpperCase().slice(0, 8)}-CW${colorwayId.slice(0, 4).toUpperCase()}-${(sizeCode ?? "SZ").slice(0, 4)}-${Date.now().toString(36).toUpperCase()}${n}`.replace(
    /[^A-Z0-9-]/g,
    "",
  );
}

async function ensureVariantsForColorway(
  db: Db,
  productId: string,
  slug: string,
  colorwayId: string,
  sizeIds: string[],
  price: number,
  compareAt: number | null,
) {
  const allSizes = await db.select().from(sizes);
  const existing = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.colorwayId, colorwayId)));
  let i = 0;
  for (const sizeId of sizeIds) {
    const found = existing.find((v) => v.sizeId === sizeId);
    if (found) {
      if (found.status !== "active") {
        await db
          .update(productVariants)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(productVariants.id, found.id));
      }
      continue;
    }
    i += 1;
    const size = allSizes.find((s) => s.id === sizeId);
    await db.insert(productVariants).values({
      productId,
      sku: makeSku(slug, colorwayId, size?.code ?? "SZ", i),
      colorwayId,
      sizeId,
      priceVnd: price,
      compareAtPriceVnd: compareAt,
      status: "active",
    });
  }
}

/** Activate/create wanted sizes; deactivate extras for this colorway only. */
async function syncColorwaySizes(
  db: Db,
  productId: string,
  slug: string,
  colorwayId: string,
  wantSizeIds: string[],
  price: number,
  compareAt: number | null,
) {
  const want = new Set(wantSizeIds);
  const existing = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.colorwayId, colorwayId)));
  for (const v of existing) {
    if (!want.has(v.sizeId) && v.status === "active") {
      await db
        .update(productVariants)
        .set({ status: "inactive", updatedAt: new Date() })
        .where(eq(productVariants.id, v.id));
    }
  }
  if (wantSizeIds.length) {
    await ensureVariantsForColorway(db, productId, slug, colorwayId, wantSizeIds, price, compareAt);
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

adminProductRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.read");
  const db = c.get("db");

  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const rawLimit = Number(c.req.query("limit") ?? 20) || 20;
  const limit = ([20, 50, 100] as number[]).includes(rawLimit) ? rawLimit : 20;
  const offset = (page - 1) * limit;

  const status = c.req.query("status") || undefined;
  const q = (c.req.query("q") ?? "").trim();
  const categoryId = c.req.query("category_id") || undefined;
  const priceMin = c.req.query("price_min") ? Number(c.req.query("price_min")) : undefined;
  const priceMax = c.req.query("price_max") ? Number(c.req.query("price_max")) : undefined;
  const stock = c.req.query("stock") as "in" | "out" | "none" | undefined;

  const conds = [];
  if (status && ["draft", "published", "archived"].includes(status)) {
    conds.push(eq(products.status, status));
  }
  if (q) {
    const like = `%${q}%`;
    conds.push(
      or(
        ilike(products.name, like),
        ilike(products.slug, like),
        sql`exists (
          select 1 from product_variants v
          where v.product_id = ${products.id} and v.sku ilike ${like}
        )`,
      )!,
    );
  }
  if (categoryId) {
    const cats = await db.select({ id: categories.id, parentId: categories.parentId }).from(categories);
    const byParent = new Map<string | null, string[]>();
    for (const cat of cats) {
      const p = cat.parentId;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(cat.id);
    }
    const ids = [categoryId];
    const queue = [categoryId];
    while (queue.length) {
      const id = queue.shift()!;
      for (const child of byParent.get(id) ?? []) {
        ids.push(child);
        queue.push(child);
      }
    }
    conds.push(inArray(products.primaryCategoryId, ids));
  }

  const priceSq = db
    .select({
      productId: productVariants.productId,
      minPrice: sql<number>`min(${productVariants.priceVnd})::int`.as("min_price"),
    })
    .from(productVariants)
    .where(eq(productVariants.status, "active"))
    .groupBy(productVariants.productId)
    .as("price_sq");

  const stockSq = db
    .select({
      productId: productVariants.productId,
      stock: sql<number>`coalesce(sum(${inventoryBalances.onHand}), 0)::int`.as("stock"),
      balCount: sql<number>`count(${inventoryBalances.variantId})::int`.as("bal_count"),
    })
    .from(productVariants)
    .leftJoin(inventoryBalances, eq(inventoryBalances.variantId, productVariants.id))
    .groupBy(productVariants.productId)
    .as("stock_sq");

  if (priceMin != null && Number.isFinite(priceMin)) {
    conds.push(gte(priceSq.minPrice, priceMin));
  }
  if (priceMax != null && Number.isFinite(priceMax)) {
    conds.push(lte(priceSq.minPrice, priceMax));
  }
  if (stock === "in") {
    conds.push(sql`${stockSq.stock} > 0`);
  } else if (stock === "out") {
    conds.push(sql`${stockSq.balCount} > 0 and ${stockSq.stock} = 0`);
  } else if (stock === "none") {
    conds.push(or(isNull(stockSq.balCount), sql`${stockSq.balCount} = 0`)!);
  }

  const where = conds.length ? and(...conds) : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .leftJoin(priceSq, eq(priceSq.productId, products.id))
    .leftJoin(stockSq, eq(stockSq.productId, products.id))
    .where(where);

  const total = countRow?.n ?? 0;

  const rows = await db
    .select({ product: products })
    .from(products)
    .leftJoin(priceSq, eq(priceSq.productId, products.id))
    .leftJoin(stockSq, eq(stockSq.productId, products.id))
    .where(where)
    .orderBy(desc(products.updatedAt))
    .limit(limit)
    .offset(offset);

  const includeCost = user.permissions.includes("cost.read");
  const items = [];
  for (const r of rows) items.push(await mapProduct(db, r.product, includeCost));

  const statusRows = await db
    .select({ status: products.status, n: sql<number>`count(*)::int` })
    .from(products)
    .groupBy(products.status);
  const status_counts = { all: 0, published: 0, draft: 0, archived: 0 };
  for (const r of statusRows) {
    status_counts.all += r.n;
    if (r.status === "published" || r.status === "draft" || r.status === "archived") {
      status_counts[r.status] = r.n;
    }
  }

  return c.json({ items, total, page, limit, status_counts });
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

adminProductRoutes.post("/:id/colorways", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const raw = await c.req.json().catch(() => ({}));
  const body = z
    .object({
      size_ids: z.array(z.string().uuid()).optional(),
    })
    .safeParse(raw);
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu không hợp lệ");

  const db = c.get("db");
  const productId = c.req.param("id");
  const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!rows[0]) throw new ApiError(404, "not_found", "Không tìm thấy sản phẩm");

  const existing = await db.select().from(productColorways).where(eq(productColorways.productId, productId));
  const sortOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1;
  const [row] = await db.insert(productColorways).values({ productId, sortOrder }).returning();

  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  const active = variants.filter((v) => v.status === "active");
  const price = active[0]?.priceVnd ?? variants[0]?.priceVnd ?? 0;
  const compare = active[0]?.compareAtPriceVnd ?? variants[0]?.compareAtPriceVnd ?? null;
  const sizeIds = body.data.size_ids ?? [];
  if (sizeIds.length && row) {
    await ensureVariantsForColorway(db, productId, rows[0].slug, row.id, sizeIds, price, compare);
  }

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "product.colorway.create",
    resourceType: "product",
    resourceId: productId,
    afterRedacted: { colorway_id: row!.id, sort_order: sortOrder, size_ids: sizeIds },
    requestId: requestId(c),
  });

  return c.json(await mapProduct(db, rows[0], user.permissions.includes("cost.read")), 201);
});

adminProductRoutes.delete("/:id/colorways/:colorwayId", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const productId = c.req.param("id");
  const colorwayId = c.req.param("colorwayId");

  const rows = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!rows[0]) throw new ApiError(404, "not_found", "Không tìm thấy sản phẩm");

  const cw = await db
    .select()
    .from(productColorways)
    .where(and(eq(productColorways.id, colorwayId), eq(productColorways.productId, productId)))
    .limit(1);
  if (!cw[0]) throw new ApiError(404, "not_found", "Không tìm thấy màu");

  const allCw = await db.select().from(productColorways).where(eq(productColorways.productId, productId));
  if (allCw.length <= 1) {
    throw new ApiError(400, "last_colorway", "Cần giữ ít nhất một màu");
  }

  const variants = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.colorwayId, colorwayId)));

  const mediaLinks = await db
    .select()
    .from(productMedia)
    .where(and(eq(productMedia.productId, productId), eq(productMedia.colorwayId, colorwayId)));
  const assetIds = mediaLinks.map((l) => l.assetId);
  if (mediaLinks.length) {
    await db.delete(productMedia).where(inArray(productMedia.id, mediaLinks.map((l) => l.id)));
  }
  let objectKeys: string[] = [];
  if (assetIds.length) {
    const assets = await db.select().from(mediaAssets).where(inArray(mediaAssets.id, assetIds));
    objectKeys = assets.map((a) => a.objectKey);
    await db.delete(mediaAssets).where(inArray(mediaAssets.id, assetIds));
  }

  const variantIds = variants.map((v) => v.id);
  if (variantIds.length) {
    await db.delete(stockMovements).where(inArray(stockMovements.variantId, variantIds));
    await db.delete(inventoryDocumentLines).where(inArray(inventoryDocumentLines.variantId, variantIds));
    await db.delete(inventoryBalances).where(inArray(inventoryBalances.variantId, variantIds));
  }
  await db
    .delete(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.colorwayId, colorwayId)));
  await db.delete(productColorways).where(eq(productColorways.id, colorwayId));

  await deleteMediaObjects(objectKeys);

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "product.colorway.delete",
    resourceType: "product",
    resourceId: productId,
    beforeRedacted: { colorway_id: colorwayId },
    requestId: requestId(c),
  });

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
      size_id: z.string().uuid().optional(),
      size_ids: z.array(z.string().uuid()).optional(),
      size_stocks: sizeStockSchema.optional(),
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
      isBestSeller: false,
      newUntil: null,
    })
    .returning();

  await db.insert(productCategories).values({ productId: row!.id, categoryId: body.data.primary_category_id });
  if (body.data.occasion_id) {
    await db.insert(productOccasions).values({ productId: row!.id, occasionId: body.data.occasion_id });
  }

  const [colorway] = await db
    .insert(productColorways)
    .values({ productId: row!.id, sortOrder: 0 })
    .returning();

  const price = body.data.price_vnd ?? 0;
  const wantsVariants = price > 0 || body.data.size_id || body.data.size_ids?.length || body.data.size_stocks?.length;
  if (wantsVariants && colorway) {
    const allSizes = await db.select().from(sizes).orderBy(sizes.sortOrder);
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
    await ensureVariantsForColorway(
      db,
      row!.id,
      slug,
      colorway.id,
      sizeIds,
      price,
      body.data.compare_at_price_vnd ?? null,
    );
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
      status: z.enum(["draft", "published", "archived"]).optional(),
      primary_category_id: z.string().uuid().optional(),
      occasion_id: z.string().uuid().nullable().optional(),
      size_chart_id: z.string().uuid().nullable().optional(),
      size_ids: z.array(z.string().uuid()).optional(),
      size_stocks: sizeStockSchema.optional(),
      colorway_sizes: z
        .array(
          z.object({
            colorway_id: z.string().uuid(),
            size_ids: z.array(z.string().uuid()),
          }),
        )
        .optional(),
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

  const sizeIdsForCheck = [
    ...(body.data.size_ids ?? []),
    ...(body.data.size_stocks?.map((s) => s.size_id) ?? []),
    ...(body.data.colorway_sizes?.flatMap((c) => c.size_ids) ?? []),
  ];
  if (sizeIdsForCheck.length) {
    const allSizes = await db.select().from(sizes);
    for (const sid of sizeIdsForCheck) {
      if (!allSizes.some((s) => s.id === sid)) throw new ApiError(400, "invalid_size", "Size không hợp lệ");
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

  const variantsForPrice = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, existing[0].id));
  const price =
    body.data.price_vnd ?? variantsForPrice.find((v) => v.status === "active")?.priceVnd ?? variantsForPrice[0]?.priceVnd ?? 0;
  const compare =
    body.data.compare_at_price_vnd !== undefined
      ? body.data.compare_at_price_vnd
      : (variantsForPrice.find((v) => v.status === "active")?.compareAtPriceVnd ??
        variantsForPrice[0]?.compareAtPriceVnd ??
        null);

  if (body.data.colorway_sizes) {
    for (const entry of body.data.colorway_sizes) {
      const cw = await db
        .select()
        .from(productColorways)
        .where(and(eq(productColorways.id, entry.colorway_id), eq(productColorways.productId, existing[0].id)))
        .limit(1);
      if (!cw[0]) throw new ApiError(400, "invalid_colorway", "Màu không thuộc sản phẩm này");
      await syncColorwaySizes(
        db,
        existing[0].id,
        row!.slug,
        entry.colorway_id,
        entry.size_ids,
        price,
        compare,
      );
    }
  } else {
    // Legacy: shared size_ids → apply same list to every colorway
    const syncSizeIds = body.data.size_ids ?? body.data.size_stocks?.map((s) => s.size_id);
    if (syncSizeIds) {
      const colorways = await db
        .select()
        .from(productColorways)
        .where(eq(productColorways.productId, existing[0].id));
      for (const cw of colorways) {
        await syncColorwaySizes(db, existing[0].id, row!.slug, cw.id, syncSizeIds, price, compare);
      }
    }
  }

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

  const productId = existing[0].id;
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  const variantIds = variants.map((v) => v.id);

  if (variantIds.length) {
    await db.delete(stockMovements).where(inArray(stockMovements.variantId, variantIds));
    await db.delete(inventoryDocumentLines).where(inArray(inventoryDocumentLines.variantId, variantIds));
    await db.delete(inventoryBalances).where(inArray(inventoryBalances.variantId, variantIds));
  }

  const mediaLinks = await db.select().from(productMedia).where(eq(productMedia.productId, productId));
  const assetIds = mediaLinks.map((l) => l.assetId);
  await db.delete(productMedia).where(eq(productMedia.productId, productId));

  let objectKeys: string[] = [];
  if (assetIds.length) {
    const assets = await db.select().from(mediaAssets).where(inArray(mediaAssets.id, assetIds));
    objectKeys = assets.map((a) => a.objectKey);
    await db.delete(mediaAssets).where(inArray(mediaAssets.id, assetIds));
  }

  await db.delete(productVariants).where(eq(productVariants.productId, productId));
  await db.delete(productColorways).where(eq(productColorways.productId, productId));
  await db.delete(productCategories).where(eq(productCategories.productId, productId));
  await db.delete(productOccasions).where(eq(productOccasions.productId, productId));
  await db.delete(collectionProducts).where(eq(collectionProducts.productId, productId));
  await db.delete(products).where(eq(products.id, productId));

  // Storage after DB commit path — one batch round-trip (was N sequential ~4s)
  await deleteMediaObjects(objectKeys);

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
