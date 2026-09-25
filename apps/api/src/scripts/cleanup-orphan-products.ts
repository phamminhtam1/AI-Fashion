/** Delete products that have zero variants (failed mid-import). */
import {
  createDb,
  products,
  productVariants,
  productMedia,
  mediaAssets,
  productColorways,
  productCategories,
  productOccasions,
  collectionProducts,
  inventoryBalances,
  inventoryDocumentLines,
  stockMovements,
} from "@elane/db";
import { eq } from "drizzle-orm";
import { env } from "../env.js";
import { deleteMediaObject } from "../lib/media-storage.js";

async function hardDelete(db: ReturnType<typeof createDb>, productId: string) {
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
  const db = createDb(env.databaseUrl);
  const all = await db.select({ id: products.id, name: products.name, slug: products.slug }).from(products);
  const variants = await db.select({ pid: productVariants.productId }).from(productVariants);
  const withV = new Set(variants.map((r) => r.pid));
  const orphans = all.filter((p) => !withV.has(p.id));
  console.log(`orphans=${orphans.length} / products=${all.length}`);
  for (const o of orphans) {
    console.log(`delete ${o.slug}`);
    await hardDelete(db, o.id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
