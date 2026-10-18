/**
 * Rebuild Pantio product media without recreating products, variants or stock.
 *
 * Dry-run (default): npm run repair:pantio-images -w @elane/api
 * Apply:             npm run repair:pantio-images:apply -w @elane/api
 * Filters:           REPAIR_SKUS=FAS54304,FJS3191 and REPAIR_MAX=10
 * Force re-repair:   REPAIR_FORCE=1
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import {
  createDb,
  mediaAssets,
  productColorways,
  productMedia,
  products,
  productVariants,
} from "@elane/db";
import { env } from "../env.js";
import { deleteMediaObjects, uploadMediaObject } from "../lib/media-storage.js";

const PANTIO_PRODUCTS_URL = "https://www.pantio.vn/collections/nu/products.json";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const snapshotPath = path.join(root, "pantio_products.json");

type PantioVariant = {
  id: number;
  sku?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  image_id?: number;
};

type PantioImage = {
  id: number;
  src: string;
  alt?: string;
  variant_ids?: number[];
};

type PantioProduct = {
  title: string;
  options?: Array<{ name?: string; position?: number }>;
  variants?: PantioVariant[];
  images?: PantioImage[];
};

type SourceGroup = { color: string; token: string; urls: string[] };
type SourceProduct = { sku: string; title: string; groups: SourceGroup[]; source: "live" | "snapshot" };

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function colorToken(value: string): string {
  return normalize(value).replace(/\s+/g, "").slice(0, 8);
}

export function baseSkuFromText(value: string): string | null {
  return value.toUpperCase().match(/^([A-Z0-9]+)/)?.[1] ?? null;
}

function optionPosition(product: PantioProduct): number | null {
  const option = (product.options ?? []).find((item) => {
    const name = normalize(item.name ?? "");
    return name.includes("mau") || name.includes("color");
  });
  return option?.position ?? null;
}

function variantOption(variant: PantioVariant, position: number | null): string {
  if (position === 1) return variant.option1?.trim() || "Mặc định";
  if (position === 2) return variant.option2?.trim() || "Mặc định";
  if (position === 3) return variant.option3?.trim() || "Mặc định";
  return "Mặc định";
}

function uniqueMasterUrls(urls: string[]): string[] {
  const normalized = urls.map((url) => url.replace(/^http:\/\//i, "https://"));
  const masters = normalized.filter((url) => /_master\./i.test(url));
  return [...new Set(masters.length ? masters : normalized)];
}

/** Resolve live Pantio image ownership using explicit relationships before filename heuristics. */
export function groupLiveImages(product: PantioProduct, sku: string): SourceGroup[] {
  const position = optionPosition(product);
  const colors = [...new Set((product.variants ?? []).map((v) => variantOption(v, position)))];
  const groups = new Map(colors.map((color) => [color, [] as string[]]));
  const variantColors = new Map<number, string>();
  const imageColors = new Map<number, string>();
  const filenameTokens = new Map<string, string>();

  for (const variant of product.variants ?? []) {
    const color = variantOption(variant, position);
    variantColors.set(variant.id, color);
    if (variant.image_id) imageColors.set(variant.image_id, color);
  }
  for (const image of product.images ?? []) {
    const color = imageColors.get(image.id);
    const match = image.src.match(new RegExp(`${sku}__([a-z0-9]+)__`, "i"));
    if (color && match) filenameTokens.set(match[1]!.toLowerCase(), color);
  }
  for (const image of product.images ?? []) {
    let color: string | undefined;
    const linkedColors = new Set(
      (image.variant_ids ?? []).map((id) => variantColors.get(id)).filter((v): v is string => Boolean(v)),
    );
    if (linkedColors.size === 1) color = [...linkedColors][0];
    if (!color && image.alt) color = colors.find((candidate) => normalize(candidate) === normalize(image.alt!));
    if (!color) color = imageColors.get(image.id);
    if (!color) {
      const match = image.src.match(new RegExp(`${sku}__([a-z0-9]+)__`, "i"));
      if (match) color = filenameTokens.get(match[1]!.toLowerCase());
    }
    if (!color && colors.length === 1) color = colors[0];
    if (color) groups.get(color)?.push(image.src);
  }

  return colors.map((color) => ({ color, token: colorToken(color), urls: uniqueMasterUrls(groups.get(color) ?? []) }));
}

function loadSnapshot(): Map<string, SourceProduct> {
  const result = new Map<string, SourceProduct>();
  if (!fs.existsSync(snapshotPath)) return result;
  const data = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as {
    categories?: Array<unknown>;
  };
  const walk = (categories: Array<any>) => {
    for (const category of categories ?? []) {
      for (const product of category.products ?? []) {
        const sku = String(product.sku ?? "").toUpperCase();
        if (!sku) continue;
        const urls = uniqueMasterUrls(product.images ?? []);
        const grouped = new Map<string, string[]>();
        for (const url of urls) {
          const match = url.match(new RegExp(`${sku}__([a-z0-9]+)__`, "i"));
          const token = match?.[1]?.toLowerCase() ?? "default";
          const list = grouped.get(token) ?? [];
          list.push(url);
          grouped.set(token, list);
        }
        result.set(sku, {
          sku,
          title: product.name ?? sku,
          source: "snapshot",
          groups: [...grouped].map(([token, imageUrls]) => ({ color: token, token, urls: imageUrls })),
        });
      }
      walk(category.children ?? []);
    }
  };
  walk(data.categories as Array<any>);
  return result;
}

async function fetchLiveProducts(): Promise<Map<string, SourceProduct>> {
  const result = new Map<string, SourceProduct>();
  for (let page = 1; ; page += 1) {
    const response = await fetch(`${PANTIO_PRODUCTS_URL}?limit=50&page=${page}`, {
      headers: { "User-Agent": "ElanePantioImageRepair/1.0" },
    });
    if (!response.ok) throw new Error(`Pantio HTTP ${response.status} (page ${page})`);
    const rows = ((await response.json()) as { products?: PantioProduct[] }).products ?? [];
    for (const product of rows) {
      const sku =
        baseSkuFromText(product.title) ??
        (product.variants ?? []).map((variant) => baseSkuFromText(variant.sku ?? "")).find(Boolean) ??
        null;
      if (!sku || result.has(sku)) continue;
      result.set(sku, { sku, title: product.title, source: "live", groups: groupLiveImages(product, sku) });
    }
    if (rows.length < 50) break;
  }
  return result;
}

async function downloadImage(url: string): Promise<{ body: Buffer; mimeType: string; extension: string }> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "ElanePantioImageRepair/1.0" },
  });
  if (!response.ok) throw new Error(`Image HTTP ${response.status}: ${url}`);
  const mimeType = (response.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim();
  if (!mimeType.startsWith("image/")) throw new Error(`Not an image (${mimeType}): ${url}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength < 1024) throw new Error(`Image too small (${body.byteLength} bytes): ${url}`);
  const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  return { body, mimeType, extension };
}

function localColorToken(sku: string, baseSku: string): string | null {
  const remainder = sku.toUpperCase().slice(baseSku.length + 1);
  if (!remainder || remainder === sku.toUpperCase()) return null;
  return remainder.split("-")[0]?.toLowerCase() || null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const onlyValue =
    process.env.REPAIR_SKUS ??
    process.argv.find((arg) => arg.startsWith("--skus="))?.slice("--skus=".length);
  const only = onlyValue
    ? new Set(onlyValue.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))
    : null;
  const limitValue =
    process.env.REPAIR_MAX ??
    process.argv.find((arg) => arg.startsWith("--max="))?.slice("--max=".length);
  const limit = limitValue ? Math.max(1, Number(limitValue)) : Number.POSITIVE_INFINITY;

  if (apply && env.mediaStorageProvider.toLowerCase() !== "r2") {
    throw new Error("Apply bị chặn: đặt MEDIA_STORAGE_PROVIDER=r2 trước khi sửa ảnh");
  }

  const snapshot = loadSnapshot();
  let live = new Map<string, SourceProduct>();
  try {
    live = await fetchLiveProducts();
  } catch (error) {
    console.warn("Không đọc được Pantio live, dùng snapshot:", error instanceof Error ? error.message : error);
  }
  const sources = new Map(snapshot);
  for (const [sku, product] of live) sources.set(sku, product);

  const db = createDb(env.databaseUrl);
  const [productRows, colorwayRows, variantRows, mediaRows, assetRows] = await Promise.all([
    db.select({ id: products.id, name: products.name }).from(products),
    db.select().from(productColorways),
    db.select().from(productVariants),
    db.select().from(productMedia),
    db.select({ id: mediaAssets.id, objectKey: mediaAssets.objectKey }).from(mediaAssets),
  ]);

  const objectKeyByAssetId = new Map(assetRows.map((asset) => [asset.id, asset.objectKey]));

  const colorwaysByProduct = new Map<string, typeof colorwayRows>();
  for (const row of colorwayRows) {
    const list = colorwaysByProduct.get(row.productId) ?? [];
    list.push(row);
    colorwaysByProduct.set(row.productId, list);
  }
  for (const rows of colorwaysByProduct.values()) rows.sort((a, b) => a.sortOrder - b.sortOrder);

  const variantsByProduct = new Map<string, typeof variantRows>();
  for (const row of variantRows) {
    const list = variantsByProduct.get(row.productId) ?? [];
    list.push(row);
    variantsByProduct.set(row.productId, list);
  }

  const mediaByProduct = new Map<string, typeof mediaRows>();
  for (const row of mediaRows) {
    const list = mediaByProduct.get(row.productId) ?? [];
    list.push(row);
    mediaByProduct.set(row.productId, list);
  }

  let exact = 0;
  let ambiguous = 0;
  let missing = 0;
  let repaired = 0;
  let alreadyRepaired = 0;
  let inspected = 0;
  const force = process.env.REPAIR_FORCE === "1";

  for (const product of productRows) {
    if (inspected >= limit) break;
    const localVariants = variantsByProduct.get(product.id) ?? [];
    const baseSku = localVariants.map((variant) => baseSkuFromText(variant.sku)).find(Boolean) ?? null;
    if (!baseSku || (only && !only.has(baseSku))) continue;
    inspected += 1;

    const existingLinks = mediaByProduct.get(product.id) ?? [];
    const repairedPrefix = `products/${product.id}/`;
    const isAlreadyRepaired =
      existingLinks.length > 0 &&
      existingLinks.every((link) => objectKeyByAssetId.get(link.assetId)?.startsWith(repairedPrefix));
    if (isAlreadyRepaired && !force) {
      alreadyRepaired += 1;
      console.log("ALREADY_REPAIRED", baseSku, product.name, `images=${existingLinks.length}`);
      continue;
    }

    const source = sources.get(baseSku);
    const localColorways = colorwaysByProduct.get(product.id) ?? [];
    if (!source) {
      missing += 1;
      console.log("MISSING", baseSku, product.name, "không có dữ liệu nguồn");
      continue;
    }
    if (!localColorways.length || source.groups.some((group) => !group.urls.length)) {
      ambiguous += 1;
      console.log("AMBIGUOUS", baseSku, product.name, "thiếu colorway hoặc ảnh nguồn");
      continue;
    }

    const groupByToken = new Map<string, SourceGroup[]>();
    for (const group of source.groups) {
      const list = groupByToken.get(group.token) ?? [];
      list.push(group);
      groupByToken.set(group.token, list);
    }

    const assignments: Array<{ colorwayId: string; group: SourceGroup }> = [];
    const usedGroups = new Set<SourceGroup>();
    for (const colorway of localColorways) {
      const tokens = new Set(
        localVariants
          .filter((variant) => variant.colorwayId === colorway.id)
          .map((variant) => localColorToken(variant.sku, baseSku))
          .filter((token): token is string => Boolean(token)),
      );
      const candidates = [...tokens]
        .flatMap((token) => groupByToken.get(token) ?? [])
        .filter((group) => !usedGroups.has(group));
      const uniqueCandidates = [...new Set(candidates)];
      if (uniqueCandidates.length === 1) {
        assignments.push({ colorwayId: colorway.id, group: uniqueCandidates[0]! });
        usedGroups.add(uniqueCandidates[0]!);
      }
    }

    if (localColorways.length === 1 && source.groups.length === 1 && assignments.length === 0) {
      assignments.push({ colorwayId: localColorways[0]!.id, group: source.groups[0]! });
    }

    if (assignments.length !== localColorways.length || usedGroups.size !== source.groups.length) {
      ambiguous += 1;
      console.log(
        "AMBIGUOUS",
        baseSku,
        product.name,
        `matched=${assignments.length}/${localColorways.length}`,
        `source=${source.source}`,
      );
      continue;
    }

    exact += 1;
    const imageCount = assignments.reduce((sum, item) => sum + item.group.urls.length, 0);
    console.log("EXACT", baseSku, product.name, `colors=${assignments.length}`, `images=${imageCount}`, source.source);
    if (!apply) continue;

    const uploadedKeys: string[] = [];
    const newAssets: Array<{
      objectKey: string;
      mimeType: string;
      bytes: number;
      altText: string;
      colorwayId: string;
      sortOrder: number;
      isCover: boolean;
    }> = [];
    try {
      let sortOrder = 0;
      for (const assignment of assignments) {
        for (let index = 0; index < assignment.group.urls.length; index += 1) {
          const image = await downloadImage(assignment.group.urls[index]!);
          const objectKey = `products/${product.id}/${assignment.colorwayId}/${randomUUID()}.${image.extension}`;
          await uploadMediaObject(objectKey, image.body, image.mimeType);
          uploadedKeys.push(objectKey);
          newAssets.push({
            objectKey,
            mimeType: image.mimeType,
            bytes: image.body.byteLength,
            altText: `${product.name} · ${assignment.group.color}`,
            colorwayId: assignment.colorwayId,
            sortOrder,
            isCover: sortOrder === 0,
          });
          sortOrder += 1;
        }
      }

      const oldLinks = mediaByProduct.get(product.id) ?? [];
      await db.transaction(async (tx) => {
        await tx.delete(productMedia).where(eq(productMedia.productId, product.id));
        for (const asset of newAssets) {
          const [created] = await tx
            .insert(mediaAssets)
            .values({
              objectKey: asset.objectKey,
              mimeType: asset.mimeType,
              bytes: asset.bytes,
              altText: asset.altText,
            })
            .returning({ id: mediaAssets.id });
          await tx.insert(productMedia).values({
            productId: product.id,
            assetId: created!.id,
            colorwayId: asset.colorwayId,
            sortOrder: asset.sortOrder,
            isCover: asset.isCover,
          });
        }
      });
      repaired += 1;
      console.log("REPAIRED", baseSku, `oldLinks=${oldLinks.length}`, `newLinks=${newAssets.length}`);
    } catch (error) {
      await deleteMediaObjects(uploadedKeys);
      console.error("FAILED", baseSku, error instanceof Error ? error.message : error);
    }
  }

  console.log({
    mode: apply ? "APPLY" : "DRY_RUN",
    inspected,
    exact,
    ambiguous,
    missing,
    alreadyRepaired,
    repaired,
  });
  if (!apply) console.log("Dry-run hoàn tất; database và storage chưa thay đổi.");
}

const entry = process.argv[1] ? path.basename(process.argv[1]).replace(/\.(ts|js)$/, "") : "";
if (entry === "repair-pantio-images") {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
