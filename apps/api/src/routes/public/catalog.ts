import { Hono } from "hono";
import { and, desc, eq, sql, inArray } from "drizzle-orm";
import {
  categories,
  occasions,
  productCategories,
  productColorways,
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
import { mediaPublicUrl } from "../../lib/media-storage.js";
import { buildPublicColorways } from "../../lib/colorways.js";
import { isAutoNew, weeklyTopSellerIds } from "../../lib/product-flags.js";
import { ApiError } from "../../lib/errors.js";

export const publicCatalogRoutes = new Hono<AppVars>();

async function mapProduct(db: AppVars["Variables"]["db"], p: typeof products.$inferSelect, includeCost = false) {
  const topSellers = await weeklyTopSellerIds(db);
  const variants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      price_vnd: productVariants.priceVnd,
      compare_at_price_vnd: productVariants.compareAtPriceVnd,
      cost_vnd: productVariants.costVnd,
      status: productVariants.status,
      colorway_id: productVariants.colorwayId,
      colorway_sort: productColorways.sortOrder,
      size_id: productVariants.sizeId,
      size_code: sizes.code,
      size_label: sizes.label,
    })
    .from(productVariants)
    .innerJoin(productColorways, eq(productColorways.id, productVariants.colorwayId))
    .innerJoin(sizes, eq(sizes.id, productVariants.sizeId))
    .where(eq(productVariants.productId, p.id));

  const activeVariants = variants.filter((v) => v.status === "active");
  const sizeSource = activeVariants.length ? activeVariants : variants;

  const allColorways = await db
    .select()
    .from(productColorways)
    .where(eq(productColorways.productId, p.id))
    .orderBy(productColorways.sortOrder);

  const media = await db
    .select({
      asset_id: mediaAssets.id,
      object_key: mediaAssets.objectKey,
      alt_text: mediaAssets.altText,
      is_cover: productMedia.isCover,
      sort_order: productMedia.sortOrder,
      colorway_id: productMedia.colorwayId,
      colorway_sort: productColorways.sortOrder,
    })
    .from(productMedia)
    .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.assetId))
    .leftJoin(productColorways, eq(productColorways.id, productMedia.colorwayId))
    .where(eq(productMedia.productId, p.id))
    .orderBy(productMedia.sortOrder);

  media.sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);

  const publicCws = buildPublicColorways(
    media.map((m) => ({
      colorway_id: m.colorway_id,
      colorway_sort: m.colorway_sort ?? 0,
      url: mediaPublicUrl(m.object_key),
      sort_order: m.sort_order,
      is_cover: m.is_cover,
    })),
  );
  const publicById = new Map(publicCws.map((c) => [c.id, c]));

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

  const sizeStockMap = new Map<string, number>();
  const variantStockMap = new Map<
    string,
    { on_hand: number; reserved: number; available: number; reorder_point: number }
  >();
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

  const images = publicCws[0]?.images ?? media.map((m) => mediaPublicUrl(m.object_key));

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
    is_new: isAutoNew(p.publishedAt, p.createdAt),
    best_seller: topSellers.has(p.id),
    price_vnd: minPrice,
    sale_compare_vnd: maxCompare && maxCompare > minPrice ? maxCompare : null,
    images,
    media: media.map((m) => ({
      asset_id: m.asset_id,
      url: mediaPublicUrl(m.object_key),
      alt: m.alt_text,
      is_cover: m.is_cover,
      colorway_id: m.colorway_id,
    })),
    // Admin gets all colorways (incl. empty); public list still has empty ones for admin mapProduct
    colorways: allColorways.map((cw) => {
      const pub = publicById.get(cw.id);
      return {
        id: cw.id,
        sort_order: cw.sortOrder,
        thumbnail: pub?.thumbnail ?? null,
        images: pub?.images ?? [],
      };
    }),
    colors: publicCws.map((c, i) => ({
      name: `Màu ${i + 1}`,
      hex: null as string | null,
      code: c.id,
    })),
    sizes: [...new Map(sizeSource.map((v) => [v.size_code, { code: v.size_code, label: v.size_label }])).values()],
    size_stocks: sizeStocks,
    stock_total: sizeStocks.reduce((n, s) => n + s.qty, 0),
    variants: variants.map((v) => {
      const stock = variantStockMap.get(v.id);
      const label = `Màu ${v.colorway_sort + 1}`;
      return {
        id: v.id,
        sku: v.sku,
        price_vnd: v.price_vnd,
        compare_at_price_vnd: v.compare_at_price_vnd,
        ...(includeCost ? { cost_vnd: v.cost_vnd } : {}),
        status: v.status,
        colorway_id: v.colorway_id,
        size_id: v.size_id,
        color: { code: v.colorway_id, name: label, hex: null as string | null },
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
    const allCats = await db.select().from(categories);
    const cat = allCats.find((r) => r.slug === category);
    if (!cat) return c.json({ items: [], page, limit, total: 0 });
    const catIds = [cat.id];
    const queue = [cat.id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const child of allCats) {
        if (child.parentId === id) {
          catIds.push(child.id);
          queue.push(child.id);
        }
      }
    }
    const [links, primary] = await Promise.all([
      db.select().from(productCategories).where(inArray(productCategories.categoryId, catIds)),
      db
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.primaryCategoryId, catIds)),
    ]);
    ids = [...new Set([...links.map((l) => l.productId), ...primary.map((p) => p.id)])];
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
    conditions.push(
      sql`coalesce(${products.publishedAt}, ${products.createdAt}) >= now() - interval '3 days'`,
    );
  }
  if (listing === "ban-chay") {
    const top = await weeklyTopSellerIds(db);
    if (!top.size) return c.json({ items: [], page, limit, total: 0 });
    conditions.push(inArray(products.id, [...top]));
  }

  const rows = await db
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
  const mapped = await mapProduct(db, rows[0]);
  // Public PDP: only colorways with images
  return c.json({
    ...mapped,
    colorways: mapped.colorways.filter((c) => c.images.length > 0),
  });
});

publicCatalogRoutes.get("/categories", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(categories).where(eq(categories.status, "active")).orderBy(categories.sortOrder);
  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      parent_id: r.parentId,
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
