/**
 * Import pantio_products.json → DB + Supabase media.
 * Run from repo root (loads .env):
 *   npx tsx apps/api/src/scripts/import-pantio.ts
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq, inArray } from "drizzle-orm";
import {
  createDb,
  categories,
  occasions,
  products,
  productCategories,
  productOccasions,
  productColorways,
  productVariants,
  productMedia,
  mediaAssets,
  sizes,
  sizeCharts,
  inventoryBalances,
  inventoryDocumentLines,
  stockMovements,
  collectionProducts,
} from "@elane/db";
import { env } from "../env.js";
import { deleteMediaObject, uploadMediaObject } from "../lib/media-storage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const JSON_PATH = path.join(root, "pantio_products.json");
const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL"] as const;
const ACCESSORY_ROOT = /phụ\s*kiện|phu\s*kien/i;

type PantioProduct = {
  name: string;
  price: number;
  compare_at_price: number | null;
  sku?: string;
  description?: string;
  images?: string[];
};

type PantioCat = {
  name: string;
  children?: PantioCat[];
  products?: PantioProduct[];
};

type PantioFile = { categories: PantioCat[] };

export function slugify(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Split trailing "Chất liệu:…" from description. */
export function splitMaterial(description: string): { description: string; material: string | null } {
  const raw = description?.trim() ?? "";
  const m = raw.match(/^(.*?)(?:\s*Chất liệu\s*:\s*)(.+)$/is);
  if (!m) return { description: raw, material: null };
  return { description: m[1]!.trim(), material: m[2]!.trim() || null };
}

/** Prefer `_master` URLs; group by color token in filename (`sku__w__…`). */
export function groupImagesByColor(urls: string[]): Map<string, string[]> {
  const masters = urls.filter((u) => /_master\./i.test(u));
  const pool = masters.length ? masters : urls.filter((u) => !/_small\./i.test(u) && !/_grande\./i.test(u));
  const map = new Map<string, string[]>();
  for (const url of pool) {
    const file = url.split("/").pop() ?? url;
    const m = file.match(/^[a-z0-9]+__([a-z0-9]+)__/i);
    const key = (m?.[1] ?? "default").toLowerCase();
    const list = map.get(key) ?? [];
    if (!list.includes(url)) list.push(url);
    map.set(key, list);
  }
  if (!map.size && urls[0]) map.set("default", [urls[0]]);
  return map;
}

export function pickRandomSizes(pool: string[]): string[] {
  if (pool.length <= 2) return [...pool];
  const count = Math.min(4, Math.max(2, 2 + Math.floor(Math.random() * 3)));
  const n = Math.min(count, pool.length);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = new Set(shuffled.slice(0, n));
  return pool.filter((c) => picked.has(c));
}

async function ensureCategory(
  db: ReturnType<typeof createDb>,
  name: string,
  parentId: string | null,
  sortOrder: number,
) {
  const slug = slugify(name);
  const existing = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  if (existing[0]) {
    if (existing[0].parentId !== parentId) {
      await db
        .update(categories)
        .set({ parentId, name, updatedAt: new Date() })
        .where(eq(categories.id, existing[0].id));
    }
    return existing[0].id;
  }
  const [row] = await db
    .insert(categories)
    .values({
      name,
      slug,
      parentId,
      sortOrder,
      status: "active",
      description: null,
    })
    .returning();
  return row!.id;
}

async function downloadImage(url: string): Promise<{ buf: Buffer; mime: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "ElanePantioImport/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 32) throw new Error(`tiny file ${url}`);
  return { buf, mime };
}

function extForMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

async function hardDeleteProduct(db: ReturnType<typeof createDb>, productId: string) {
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  for (const v of variants) {
    await db.delete(stockMovements).where(eq(stockMovements.variantId, v.id));
    await db.delete(inventoryDocumentLines).where(eq(inventoryDocumentLines.variantId, v.id));
    await db.delete(inventoryBalances).where(eq(inventoryBalances.variantId, v.id));
  }
  const mediaLinks = await db.select().from(productMedia).where(eq(productMedia.productId, productId));
  await db.delete(productMedia).where(eq(productMedia.productId, productId));
  for (const link of mediaLinks) {
    const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.id, link.assetId)).limit(1);
    await db.delete(mediaAssets).where(eq(mediaAssets.id, link.assetId));
    if (assets[0]) await deleteMediaObject(assets[0].objectKey);
  }
  await db.delete(productVariants).where(eq(productVariants.productId, productId));
  await db.delete(productColorways).where(eq(productColorways.productId, productId));
  await db.delete(productCategories).where(eq(productCategories.productId, productId));
  await db.delete(productOccasions).where(eq(productOccasions.productId, productId));
  await db.delete(collectionProducts).where(eq(collectionProducts.productId, productId));
  await db.delete(products).where(eq(products.id, productId));
}

async function main() {
  const fresh = process.argv.includes("--fresh");
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY trong .env");
  }
  if (!fs.existsSync(JSON_PATH)) throw new Error(`Missing ${JSON_PATH}`);

  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) as PantioFile;
  const db = createDb(env.databaseUrl);

  const allSizes = await db.select().from(sizes);
  const sizeByCode = Object.fromEntries(allSizes.map((r) => [r.code, r]));
  for (const code of CLOTHING_SIZES) {
    if (!sizeByCode[code]) throw new Error(`Missing size ${code} — chạy seed trước`);
  }
  const oneSize = sizeByCode["ONE_SIZE"];
  const charts = await db.select().from(sizeCharts).limit(1);
  const defaultChartId = charts[0]?.id ?? null;
  const occs = await db.select().from(occasions).limit(1);
  const occasionId = occs[0]?.id ?? null;

  type Job = { parentPath: string[]; leafName: string; product: PantioProduct; isAccessory: boolean };
  const jobs: Job[] = [];

  function walk(cats: PantioCat[], pathNames: string[], underAccessory: boolean) {
    cats.forEach((c, i) => {
      const nextAcc = underAccessory || ACCESSORY_ROOT.test(c.name);
      if (c.products?.length) {
        for (const p of c.products) {
          jobs.push({
            parentPath: pathNames,
            leafName: c.name,
            product: p,
            isAccessory: nextAcc,
          });
        }
      }
      if (c.children?.length) walk(c.children, [...pathNames, c.name], nextAcc);
      void i;
    });
  }
  walk(data.categories, [], false);

  console.log(`Pantio import: ${jobs.length} products${fresh ? " (--fresh)" : ""}`);

  if (fresh) {
    const slugs = [
      ...new Set(
        jobs.map((j) => {
          let slug = slugify(j.product.name);
          if (!slug) slug = slugify(j.product.sku ?? "x");
          return slug;
        }),
      ),
    ];
    console.log(`Fresh: removing up to ${slugs.length} existing pantio slugs…`);
    // chunk inArray
    let removed = 0;
    for (let i = 0; i < slugs.length; i += 50) {
      const chunk = slugs.slice(i, i + 50);
      const rows = await db.select({ id: products.id, slug: products.slug }).from(products).where(inArray(products.slug, chunk));
      for (const row of rows) {
        await hardDeleteProduct(db, row.id);
        removed += 1;
        console.log(`  deleted ${row.slug}`);
      }
    }
    console.log(`Fresh: removed ${removed} products`);
  }

  const catCache = new Map<string, string>(); // slug -> id
  async function resolveLeaf(parentPath: string[], leafName: string) {
    let parentId: string | null = null;
    for (let i = 0; i < parentPath.length; i++) {
      const name = parentPath[i]!;
      const key = `${parentId ?? "root"}:${slugify(name)}`;
      if (!catCache.has(key)) {
        const id = await ensureCategory(db, name, parentId, i);
        catCache.set(key, id);
      }
      parentId = catCache.get(key)!;
    }
    const leafKey = `${parentId ?? "root"}:${slugify(leafName)}`;
    if (!catCache.has(leafKey)) {
      const id = await ensureCategory(db, leafName, parentId, 0);
      catCache.set(leafKey, id);
    }
    return catCache.get(leafKey)!;
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let ji = 0; ji < jobs.length; ji++) {
    const job = jobs[ji]!;
    const p = job.product;
    const label = `[${ji + 1}/${jobs.length}] ${p.name.slice(0, 60)}`;
    try {
      let slug = slugify(p.name);
      if (!slug) slug = slugify(p.sku ?? randomUUID());
      const clash = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
      if (clash[0]) {
        skipped += 1;
        console.log(`${label} — skip (slug exists)`);
        continue;
      }

      const categoryId = await resolveLeaf(job.parentPath, job.leafName);
      const { description, material } = splitMaterial(p.description ?? "");
      const groups = groupImagesByColor(p.images ?? []);
      if (!groups.size) {
        console.warn(`${label} — no images, skip`);
        skipped += 1;
        continue;
      }

      const [product] = await db
        .insert(products)
        .values({
          name: p.name.trim(),
          slug,
          description,
          material,
          primaryCategoryId: categoryId,
          sizeChartId: job.isAccessory ? null : defaultChartId,
          status: "published",
          publishedAt: new Date(),
          isBestSeller: false,
          newUntil: null,
        })
        .returning();

      await db.insert(productCategories).values({ productId: product!.id, categoryId });
      if (occasionId) {
        await db.insert(productOccasions).values({ productId: product!.id, occasionId });
      }

      const colorEntries = [...groups.entries()];
      let mediaSort = 0;
      let coverSet = false;

      for (let ci = 0; ci < colorEntries.length; ci++) {
        const [colorCode, urls] = colorEntries[ci]!;
        const [cw] = await db
          .insert(productColorways)
          .values({ productId: product!.id, sortOrder: ci })
          .returning();

        const sizeCodes = job.isAccessory
          ? oneSize
            ? ["ONE_SIZE"]
            : CLOTHING_SIZES.slice(0, 1)
          : pickRandomSizes([...CLOTHING_SIZES]);

        for (const sc of sizeCodes) {
          const size = sizeByCode[sc];
          if (!size) continue;
          const baseSku = (p.sku ?? slug).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10);
          const sku = `${baseSku}-${colorCode.toUpperCase().slice(0, 6)}-${sc}-${product!.id.slice(0, 4).toUpperCase()}`.replace(
            /[^A-Z0-9-]/g,
            "",
          );
          await db.insert(productVariants).values({
            productId: product!.id,
            sku,
            colorwayId: cw!.id,
            sizeId: size.id,
            priceVnd: p.price,
            compareAtPriceVnd: p.compare_at_price,
            status: "active",
          });
        }

        for (let ui = 0; ui < urls.length; ui++) {
          const url = urls[ui]!;
          try {
            const { buf, mime } = await downloadImage(url);
            const ext = extForMime(mime);
            const objectKey = `${product!.id}/${cw!.id}/${randomUUID()}.${ext}`;
            await uploadMediaObject(objectKey, buf, mime);
            const [asset] = await db
              .insert(mediaAssets)
              .values({
                objectKey,
                mimeType: mime,
                bytes: buf.byteLength,
                altText: `${p.name} · màu ${ci + 1}`,
              })
              .returning();
            const isCover = !coverSet && ui === 0 && ci === 0;
            if (isCover) coverSet = true;
            await db.insert(productMedia).values({
              productId: product!.id,
              assetId: asset!.id,
              colorwayId: cw!.id,
              sortOrder: mediaSort++,
              isCover,
            });
          } catch (e) {
            console.warn(`  image fail ${url}:`, e instanceof Error ? e.message : e);
          }
        }
      }

      created += 1;
      console.log(
        `${label} — ok (${colorEntries.length} màu, ${[...groups.values()].reduce((n, u) => n + u.length, 0)} ảnh)`,
      );
    } catch (e) {
      failed += 1;
      console.error(`${label} — FAIL`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`Done. created=${created} skipped=${skipped} failed=${failed}`);
  process.exit(failed ? 1 : 0);
}

const entry = process.argv[1] ? path.basename(process.argv[1]).replace(/\.(ts|js)$/, "") : "";
if (entry === "import-pantio") {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
