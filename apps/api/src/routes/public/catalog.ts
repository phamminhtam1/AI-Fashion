import { Hono } from "hono";
import { and, desc, eq, sql, inArray } from "drizzle-orm";
import {
  categories,
  colors,
  occasions,
  productCategories,
  productMedia,
  productOccasions,
  productVariants,
  products,
  sizes,
  sizeCharts,
  mediaAssets,
  collections,
  collectionProducts,
  inventoryBalances,
  warehouses,
} from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";

export const publicCatalogRoutes = new Hono<AppVars>();

async function mapProduct(db: AppVars["Variables"]["db"], p: typeof products.$inferSelect, includeCost = false) {
  const variants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      price_vnd: productVariants.priceVnd,
      compare_at_price_vnd: productVariants.compareAtPriceVnd,
      cost_vnd: productVariants.costVnd,
      status: productVariants.status,
      color_id: productVariants.colorId,
      size_id: productVariants.sizeId,
      color_name: colors.name,
      color_hex: colors.hex,
      color_code: colors.code,
      size_code: sizes.code,
      size_label: sizes.label,
    })
    .from(productVariants)
    .innerJoin(colors, eq(colors.id, productVariants.colorId))
    .innerJoin(sizes, eq(sizes.id, productVariants.sizeId))
    .where(eq(productVariants.productId, p.id));

  const activeVariants = variants.filter((v) => v.status === "active");
  const sizeSource = activeVariants.length ? activeVariants : variants;

  const media = await db
    .select({
      asset_id: mediaAssets.id,
      object_key: mediaAssets.objectKey,
      alt_text: mediaAssets.altText,
      is_cover: productMedia.isCover,
      sort_order: productMedia.sortOrder,
    })
    .from(productMedia)
    .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.assetId))
    .where(eq(productMedia.productId, p.id))
    .orderBy(productMedia.sortOrder);

  // Cover lên đầu
  media.sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);

  const cat = await db.select().from(categories).where(eq(categories.id, p.primaryCategoryId)).limit(1);
  const occIds = await db.select().from(productOccasions).where(eq(productOccasions.productId, p.id));
  let occasionSlug: string | null = null;
  if (occIds[0]) {
    const occ = await db.select().from(occasions).where(eq(occasions.id, occIds[0].occasionId)).limit(1);
    occasionSlug = occ[0]?.slug ?? null;
  }

  const prices = sizeSource.map((v) => v.price_vnd);
  const compare = sizeSource.map((v) => v.compare_at_price_vnd).filter((x): x is number => x != null);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxCompare = compare.length ? Math.max(...compare) : null;

  let sizeChart: { id: string; name: string; unit: string } | null = null;
  if (p.sizeChartId) {
    const charts = await db.select().from(sizeCharts).where(eq(sizeCharts.id, p.sizeChartId)).limit(1);
    if (charts[0]) sizeChart = { id: charts[0].id, name: charts[0].name, unit: charts[0].unit };
  }

  // Tồn theo variant + gom theo size (kho MAIN)
  const sizeStockMap = new Map<string, number>();
  const variantStockMap = new Map<string, { on_hand: number; reserved: number; available: number; reorder_point: number }>();
  if (variants.length) {
    const wh = await db.select().from(warehouses).where(eq(warehouses.code, "MAIN")).limit(1);
    if (wh[0]) {
      const bals = await db
        .select({
          variant_id: inventoryBalances.variantId,
          on_hand: inventoryBalances.onHand,
          reserved: inventoryBalances.reserved,
          reorder_point: inventoryBalances.reorderPoint,
        })
        .from(inventoryBalances)
        .where(eq(inventoryBalances.warehouseId, wh[0].id));
      for (const b of bals) {
        const available = b.on_hand - b.reserved;
        variantStockMap.set(b.variant_id, {
          on_hand: b.on_hand,
          reserved: b.reserved,
          available,
          reorder_point: b.reorder_point,
        });
      }
      for (const v of sizeSource) {
        const q = variantStockMap.get(v.id)?.on_hand ?? 0;
        sizeStockMap.set(v.size_id, (sizeStockMap.get(v.size_id) ?? 0) + q);
      }
    }
  }

  const sizeStocks = [...new Map(sizeSource.map((v) => [v.size_id, v])).values()].map((v) => ({
    size_id: v.size_id,
    size_code: v.size_code,
    size_label: v.size_label,
    qty: sizeStockMap.get(v.size_id) ?? 0,
  }));

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    material: p.material,
    status: p.status,
    category: cat[0] ? { slug: cat[0].slug, name: cat[0].name } : null,
    occasion: occasionSlug,
    size_chart: sizeChart,
    is_new: p.newUntil ? p.newUntil.getTime() > Date.now() : false,
    best_seller: p.isBestSeller,
    price_vnd: minPrice,
    sale_compare_vnd: maxCompare && maxCompare > minPrice ? maxCompare : null,
    images: media.map((m) => `/media/${m.object_key}`),
    media: media.map((m) => ({
      asset_id: m.asset_id,
      url: `/media/${m.object_key}`,
      alt: m.alt_text,
      is_cover: m.is_cover,
    })),
    colors: [...new Map(sizeSource.map((v) => [v.color_code, { name: v.color_name, hex: v.color_hex, code: v.color_code }])).values()],
    sizes: [...new Map(sizeSource.map((v) => [v.size_code, { code: v.size_code, label: v.size_label }])).values()],
    size_stocks: sizeStocks,
    stock_total: sizeStocks.reduce((n, s) => n + s.qty, 0),
    variants: variants.map((v) => {
      const stock = variantStockMap.get(v.id);
      return {
        id: v.id,
        sku: v.sku,
        price_vnd: v.price_vnd,
        compare_at_price_vnd: v.compare_at_price_vnd,
        ...(includeCost ? { cost_vnd: v.cost_vnd } : {}),
        status: v.status,
        color: { code: v.color_code, name: v.color_name, hex: v.color_hex },
        size: { code: v.size_code, label: v.size_label },
        on_hand: stock?.on_hand ?? 0,
        reserved: stock?.reserved ?? 0,
        available: stock?.available ?? 0,
        reorder_point: stock?.reorder_point ?? 0,
      };
    }),
  };
}

publicCatalogRoutes.get("/products", async (c) => {
  const db = c.get("db");
  const category = c.req.query("category");
  const occasion = c.req.query("occasion");
  const listing = c.req.query("listing"); // hang-moi|sale|ban-chay
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 24)));
  const offset = (page - 1) * limit;

  let ids: string[] | null = null;
  if (category) {
    const cat = await db.select().from(categories).where(eq(categories.slug, category)).limit(1);
    if (!cat[0]) return c.json({ items: [], page, limit, total: 0 });
    const links = await db.select().from(productCategories).where(eq(productCategories.categoryId, cat[0].id));
    ids = links.map((l) => l.productId);
  }
  if (occasion) {
    const occ = await db.select().from(occasions).where(eq(occasions.slug, occasion)).limit(1);
    if (!occ[0]) return c.json({ items: [], page, limit, total: 0 });
    const links = await db.select().from(productOccasions).where(eq(productOccasions.occasionId, occ[0].id));
    const set = new Set(links.map((l) => l.productId));
    ids = ids ? ids.filter((id) => set.has(id)) : [...set];
  }

  const conditions = [eq(products.status, "published")];
  if (ids) {
    if (!ids.length) return c.json({ items: [], page, limit, total: 0 });
    conditions.push(inArray(products.id, ids));
  }
  if (listing === "hang-moi") {
    conditions.push(sql`${products.newUntil} IS NOT NULL AND ${products.newUntil} > now()`);
  }
  if (listing === "ban-chay") {
    conditions.push(eq(products.isBestSeller, true));
  }

  let rows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.publishedAt))
    .limit(listing === "sale" ? 200 : limit)
    .offset(listing === "sale" ? 0 : offset);

  if (listing === "sale") {
    const mapped = [];
    for (const p of rows) {
      const m = await mapProduct(db, p);
      if (m.sale_compare_vnd) mapped.push(m);
    }
    const total = mapped.length;
    const slice = mapped.slice(offset, offset + limit);
    return c.json({ items: slice, page, limit, total });
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(...conditions));
  const items = [];
  for (const p of rows) items.push(await mapProduct(db, p));
  return c.json({ items, page, limit, total: countRows[0]?.count ?? 0 });
});

publicCatalogRoutes.get("/products/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.status, "published")))
    .limit(1);
  if (!rows[0]) throw new ApiError(404, "not_found", "Không tìm thấy sản phẩm");
  return c.json(await mapProduct(db, rows[0]));
});

publicCatalogRoutes.get("/categories", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(categories).where(eq(categories.status, "active")).orderBy(categories.sortOrder);
  return c.json({
    items: rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      description: r.description,
    })),
  });
});

publicCatalogRoutes.get("/occasions", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(occasions);
  return c.json({ items: rows.map((r) => ({ code: r.code, slug: r.slug, name: r.name })) });
});

publicCatalogRoutes.get("/collections/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");
  const rows = await db
    .select()
    .from(collections)
    .where(and(eq(collections.slug, slug), eq(collections.status, "published")))
    .limit(1);
  if (!rows[0]) throw new ApiError(404, "not_found", "Không tìm thấy bộ sưu tập");
  const links = await db
    .select()
    .from(collectionProducts)
    .where(eq(collectionProducts.collectionId, rows[0].id))
    .orderBy(collectionProducts.sortOrder);
  const items = [];
  for (const link of links) {
    const p = await db
      .select()
      .from(products)
      .where(and(eq(products.id, link.productId), eq(products.status, "published")))
      .limit(1);
    if (p[0]) items.push(await mapProduct(db, p[0]));
  }
  return c.json({
    slug: rows[0].slug,
    name: rows[0].name,
    description: rows[0].description,
    items,
  });
});

export { mapProduct };
