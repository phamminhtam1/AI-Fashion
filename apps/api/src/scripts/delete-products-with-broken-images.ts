/**
 * Permanently delete products whose current media was not fully repaired to R2.
 *
 * Dry-run (default): npm run delete:broken-image-products
 * Apply:             DELETE_BROKEN_PRODUCTS_CONFIRM=DELETE npm run delete:broken-image-products:apply
 * Optional filter:   DELETE_PRODUCT_SKUS=BAS33029,ABC123
 *
 * Orders containing a target product and AI try-on history for that product are
 * intentionally deleted too. Apply therefore requires an explicit confirmation.
 */
import {
  aiTryonJobs,
  aiAssets,
  banners,
  collectionProducts,
  collections,
  createDb,
  inventoryBalances,
  inventoryDocumentLines,
  inventoryDocuments,
  mediaAssets,
  orderItems,
  orders,
  productCategories,
  productColorways,
  productMedia,
  productOccasions,
  products,
  productVariants,
  stockMovements,
  sepayWebhookEvents,
  wishlistItems,
} from "@elane/db";
import { eq, inArray, or } from "drizzle-orm";
import { env } from "../env.js";
import { deleteMediaObjects } from "../lib/media-storage.js";

type ProductRow = { id: string; name: string };

function baseSku(value: string): string | null {
  return value.toUpperCase().match(/^([A-Z0-9]+)/)?.[1] ?? null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const confirmation = process.env.DELETE_BROKEN_PRODUCTS_CONFIRM;
  if (apply && confirmation !== "DELETE") {
    throw new Error(
      "Apply bị chặn. Chỉ tiếp tục khi đặt DELETE_BROKEN_PRODUCTS_CONFIRM=DELETE",
    );
  }

  const skuFilterValue = process.env.DELETE_PRODUCT_SKUS;
  const skuFilter = skuFilterValue
    ? new Set(skuFilterValue.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))
    : null;

  const db = createDb(env.databaseUrl);
  const [productRows, variantRows, mediaRows, assetRows, orderItemRows, orderRows, tryonRows] = await Promise.all([
    db.select({ id: products.id, name: products.name }).from(products),
    db.select({
      id: productVariants.id,
      productId: productVariants.productId,
      sku: productVariants.sku,
      tryonAssetId: productVariants.tryonAssetId,
    }).from(productVariants),
    db.select({ productId: productMedia.productId, assetId: productMedia.assetId }).from(productMedia),
    db.select({ id: mediaAssets.id, objectKey: mediaAssets.objectKey }).from(mediaAssets),
    db.select({ productId: orderItems.productId, orderId: orderItems.orderId }).from(orderItems),
    db.select({ id: orders.id, inventoryDocId: orders.inventoryDocId }).from(orders),
    db.select({
      id: aiTryonJobs.id,
      productId: aiTryonJobs.productId,
      userImageAssetId: aiTryonJobs.userImageAssetId,
      garmentAssetId: aiTryonJobs.garmentAssetId,
      resultAssetId: aiTryonJobs.resultAssetId,
    }).from(aiTryonJobs),
  ]);

  const variantsByProduct = new Map<string, typeof variantRows>();
  for (const row of variantRows) {
    const rows = variantsByProduct.get(row.productId) ?? [];
    rows.push(row);
    variantsByProduct.set(row.productId, rows);
  }
  const mediaByProduct = new Map<string, typeof mediaRows>();
  for (const row of mediaRows) {
    const rows = mediaByProduct.get(row.productId) ?? [];
    rows.push(row);
    mediaByProduct.set(row.productId, rows);
  }
  const objectKeyByAsset = new Map(assetRows.map((row) => [row.id, row.objectKey]));
  const orderIdsByProduct = new Map<string, Set<string>>();
  for (const row of orderItemRows) {
    const ids = orderIdsByProduct.get(row.productId) ?? new Set<string>();
    ids.add(row.orderId);
    orderIdsByProduct.set(row.productId, ids);
  }
  const orderById = new Map(orderRows.map((row) => [row.id, row]));
  const tryonByProduct = new Map<string, typeof tryonRows>();
  for (const row of tryonRows) {
    const rows = tryonByProduct.get(row.productId) ?? [];
    rows.push(row);
    tryonByProduct.set(row.productId, rows);
  }

  const targets: Array<ProductRow & { sku: string; reason: string; orderCount: number; tryonCount: number }> = [];
  for (const product of productRows) {
    const variants = variantsByProduct.get(product.id) ?? [];
    const sku = variants.map((row) => baseSku(row.sku)).find(Boolean) ?? "NO-SKU";
    if (skuFilter && !skuFilter.has(sku)) continue;

    const links = mediaByProduct.get(product.id) ?? [];
    const expectedPrefix = `products/${product.id}/`;
    const keys = links.map((row) => objectKeyByAsset.get(row.assetId)).filter(Boolean) as string[];
    const missingAsset = keys.length !== links.length;
    const legacyCount = keys.filter((key) => !key.startsWith(expectedPrefix)).length;
    if (links.length > 0 && !missingAsset && legacyCount === 0) continue;

    const reason = links.length === 0
      ? "NO_MEDIA"
      : missingAsset
        ? "MISSING_MEDIA_ASSET"
        : `LEGACY_MEDIA:${legacyCount}/${links.length}`;
    targets.push({
      ...product,
      sku,
      reason,
      orderCount: orderIdsByProduct.get(product.id)?.size ?? 0,
      tryonCount: tryonByProduct.get(product.id)?.length ?? 0,
    });
  }

  let deleted = 0;
  let ordersDeleted = 0;
  let tryonJobsDeleted = 0;
  let storageDeleteFailures = 0;
  const processedOrderIds = new Set<string>();

  for (const target of targets) {
    if (!apply) {
      console.log(
        `WOULD_DELETE ${target.sku} ${target.reason} orders=${target.orderCount} tryon=${target.tryonCount} ${target.name}`,
      );
      continue;
    }

    const orderIds = [...(orderIdsByProduct.get(target.id) ?? [])].filter(
      (id) => !processedOrderIds.has(id),
    );
    const objectKeys = await db.transaction(async (tx) => {
      const variants = variantsByProduct.get(target.id) ?? [];
      const variantIds = variants.map((row) => row.id);

      // Delete entire orders containing this product. Keeping a partial order would
      // leave totals, payments and fulfillment history internally inconsistent.
      const inventoryDocIds = orderIds
        .map((id) => orderById.get(id)?.inventoryDocId)
        .filter(Boolean) as string[];
      if (orderIds.length) {
        await tx.delete(sepayWebhookEvents).where(inArray(sepayWebhookEvents.matchedOrderId, orderIds));
        await tx.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
        await tx.delete(orders).where(inArray(orders.id, orderIds));
      }
      const deletableInventoryDocIds: string[] = [];
      for (const documentId of inventoryDocIds) {
        const [remainingOrder] = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.inventoryDocId, documentId))
          .limit(1);
        if (!remainingOrder) deletableInventoryDocIds.push(documentId);
      }
      if (deletableInventoryDocIds.length) {
        const documentLines = await tx
          .select({ id: inventoryDocumentLines.id })
          .from(inventoryDocumentLines)
          .where(inArray(inventoryDocumentLines.documentId, deletableInventoryDocIds));
        const documentLineIds = documentLines.map((row) => row.id);
        if (documentLineIds.length) {
          await tx.delete(stockMovements).where(inArray(stockMovements.documentLineId, documentLineIds));
        }
        await tx.delete(inventoryDocumentLines).where(inArray(inventoryDocumentLines.documentId, deletableInventoryDocIds));
        await tx.delete(inventoryDocuments).where(inArray(inventoryDocuments.id, deletableInventoryDocIds));
      }

      const tryonJobs = tryonByProduct.get(target.id) ?? [];
      const aiAssetIds = new Set<string>();
      for (const job of tryonJobs) {
        if (job.userImageAssetId) aiAssetIds.add(job.userImageAssetId);
        if (job.garmentAssetId) aiAssetIds.add(job.garmentAssetId);
        if (job.resultAssetId) aiAssetIds.add(job.resultAssetId);
      }
      for (const variant of variants) {
        if (variant.tryonAssetId) aiAssetIds.add(variant.tryonAssetId);
      }
      await tx.delete(aiTryonJobs).where(eq(aiTryonJobs.productId, target.id));

      if (variantIds.length) {
        await tx.delete(stockMovements).where(inArray(stockMovements.variantId, variantIds));
        await tx.delete(inventoryDocumentLines).where(inArray(inventoryDocumentLines.variantId, variantIds));
        await tx.delete(inventoryBalances).where(inArray(inventoryBalances.variantId, variantIds));
      }

      const links = mediaByProduct.get(target.id) ?? [];
      const assetIds = [...new Set(links.map((row) => row.assetId))];
      const keys = assetIds.map((id) => objectKeyByAsset.get(id)).filter(Boolean) as string[];

      await tx.delete(wishlistItems).where(eq(wishlistItems.productId, target.id));
      await tx.delete(productMedia).where(eq(productMedia.productId, target.id));
      await tx.delete(productVariants).where(eq(productVariants.productId, target.id));
      await tx.delete(productColorways).where(eq(productColorways.productId, target.id));
      await tx.delete(productCategories).where(eq(productCategories.productId, target.id));
      await tx.delete(productOccasions).where(eq(productOccasions.productId, target.id));
      await tx.delete(collectionProducts).where(eq(collectionProducts.productId, target.id));
      await tx.delete(products).where(eq(products.id, target.id));

      const aiStorageKeys: string[] = [];
      for (const assetId of aiAssetIds) {
        const [jobReference] = await tx
          .select({ id: aiTryonJobs.id })
          .from(aiTryonJobs)
          .where(or(
            eq(aiTryonJobs.userImageAssetId, assetId),
            eq(aiTryonJobs.garmentAssetId, assetId),
            eq(aiTryonJobs.resultAssetId, assetId),
          ))
          .limit(1);
        const [variantReference] = await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(eq(productVariants.tryonAssetId, assetId))
          .limit(1);
        if (!jobReference && !variantReference) {
          const [asset] = await tx
            .select({ storageKey: aiAssets.storageKey })
            .from(aiAssets)
            .where(eq(aiAssets.id, assetId))
            .limit(1);
          if (asset) aiStorageKeys.push(asset.storageKey);
          await tx.delete(aiAssets).where(eq(aiAssets.id, assetId));
        }
      }

      // Delete only media rows that became unreferenced. Assets reused by another
      // product or a collection remain intact.
      for (const assetId of assetIds) {
        const [remainingProductLink] = await tx
          .select({ id: productMedia.id })
          .from(productMedia)
          .where(eq(productMedia.assetId, assetId))
          .limit(1);
        const [collectionLink] = await tx
          .select({ id: collections.id })
          .from(collections)
          .where(eq(collections.coverAssetId, assetId))
          .limit(1);
        const [bannerLink] = await tx
          .select({ id: banners.id })
          .from(banners)
          .where(or(eq(banners.desktopAssetId, assetId), eq(banners.mobileAssetId, assetId)))
          .limit(1);
        if (!remainingProductLink && !collectionLink && !bannerLink) {
          await tx.delete(mediaAssets).where(eq(mediaAssets.id, assetId));
        }
      }
      return [...keys, ...aiStorageKeys];
    });

    for (const orderId of orderIdsByProduct.get(target.id) ?? []) processedOrderIds.add(orderId);
    ordersDeleted += orderIds.length;
    tryonJobsDeleted += target.tryonCount;

    try {
      await deleteMediaObjects(objectKeys);
    } catch (error) {
      storageDeleteFailures += 1;
      console.warn(
        `STORAGE_WARNING ${target.sku}`,
        error instanceof Error ? error.message : error,
      );
    }
    deleted += 1;
    console.log(
      `DELETED ${target.sku} ${target.reason} orders=${target.orderCount} tryon=${target.tryonCount} ${target.name}`,
    );
  }

  console.log({
    mode: apply ? "APPLY" : "DRY_RUN",
    inspected: productRows.length,
    targets: targets.length,
    ordersAffected: new Set(targets.flatMap((target) => [...(orderIdsByProduct.get(target.id) ?? [])])).size,
    tryonJobsAffected: targets.reduce((sum, target) => sum + target.tryonCount, 0),
    deleted,
    ordersDeleted,
    tryonJobsDeleted,
    storageDeleteFailures,
  });
  if (!apply) console.log("Dry-run hoàn tất; database và storage chưa thay đổi.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
