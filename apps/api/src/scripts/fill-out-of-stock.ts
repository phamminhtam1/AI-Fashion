/**
 * Fill stock for all currently out-of-stock published variants.
 *
 * Default: dry-run only.
 *
 * Examples:
 *   npx tsx apps/api/src/scripts/fill-out-of-stock.ts
 *   npx tsx apps/api/src/scripts/fill-out-of-stock.ts --apply
 *   npx tsx apps/api/src/scripts/fill-out-of-stock.ts --apply --min=15 --max=50
 *   npx tsx apps/api/src/scripts/fill-out-of-stock.ts --apply --limit=100
 *   npx tsx apps/api/src/scripts/fill-out-of-stock.ts --apply --only=BJD93857
 */
import { and, eq, sql } from "drizzle-orm";
import {
  accounts,
  createDb,
  inventoryBalances,
  inventoryDocumentLines,
  inventoryDocuments,
  products,
  productVariants,
  sizes,
  stockMovements,
  warehouses,
} from "@elane/db";
import { env } from "../env.js";

const DEFAULT_MIN = 15;
const DEFAULT_MAX = 50;
const DOC_CHUNK_SIZE = 500;

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : null;
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = argValue(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} phải là số nguyên dương`);
  }
  return value;
}

function baseSku(sku: string): string {
  return sku.toUpperCase().split("-")[0] ?? sku.toUpperCase();
}

/**
 * Stable pseudo-random quantity so a dry-run and a later --apply produce
 * the same quantity for the same variant/range.
 */
function stableQty(variantId: string, min: number, max: number): number {
  let hash = 2166136261;
  for (const ch of variantId) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const span = max - min + 1;
  return min + ((hash >>> 0) % span);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const min = parsePositiveInt("min", DEFAULT_MIN);
  const max = parsePositiveInt("max", DEFAULT_MAX);
  const limit = parsePositiveInt("limit", Number.MAX_SAFE_INTEGER);

  if (min > max) throw new Error("--min không được lớn hơn --max");

  const onlyArg = argValue("only");
  const only = onlyArg
    ? new Set(
        onlyArg
          .split(",")
          .map((value) => value.trim().toUpperCase())
          .filter(Boolean),
      )
    : null;

  const db = createDb(env.databaseUrl);

  const [warehouse] = await db
    .select()
    .from(warehouses)
    .where(eq(warehouses.code, "MAIN"))
    .limit(1);

  if (!warehouse) throw new Error("Không tìm thấy kho MAIN");

  let [actor] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.email, "admin@elane.local"), eq(accounts.status, "active")))
    .limit(1);

  if (!actor) {
    [actor] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.status, "active"))
      .limit(1);
  }

  if (!actor) throw new Error("Không tìm thấy account active để ghi nhận phiếu nhập kho");

  let candidates = await db
    .select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      productId: products.id,
      productName: products.name,
      sizeCode: sizes.code,
      sizeLabel: sizes.label,
      onHand: inventoryBalances.onHand,
      reserved: inventoryBalances.reserved,
      available: sql<number>`coalesce(${inventoryBalances.onHand}, 0) - coalesce(${inventoryBalances.reserved}, 0)`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(sizes, eq(sizes.id, productVariants.sizeId))
    .leftJoin(
      inventoryBalances,
      and(
        eq(inventoryBalances.variantId, productVariants.id),
        eq(inventoryBalances.warehouseId, warehouse.id),
      ),
    )
    .where(
      and(
        eq(products.status, "published"),
        eq(productVariants.status, "active"),
        sql`coalesce(${inventoryBalances.onHand}, 0) - coalesce(${inventoryBalances.reserved}, 0) <= 0`,
      ),
    )
    .orderBy(products.name, productVariants.sku);

  if (only) {
    candidates = candidates.filter((row) => only.has(baseSku(row.sku)));
  }

  candidates = candidates.slice(0, limit);

  const productCount = new Set(candidates.map((row) => row.productId)).size;

  console.log({
    mode: apply ? "APPLY" : "DRY-RUN",
    warehouse: warehouse.code,
    products_out_of_stock: productCount,
    variants_out_of_stock: candidates.length,
    random_range: `${min}-${max}`,
  });

  for (const row of candidates.slice(0, 100)) {
    console.log(
      `${row.sku} | ${row.productName} | size=${row.sizeLabel} | available=${row.available ?? 0} -> +${stableQty(row.variantId, min, max)}`,
    );
  }

  if (candidates.length > 100) {
    console.log(`... +${candidates.length - 100} variants khác`);
  }

  if (!apply) {
    console.log("DRY-RUN: chưa thay đổi tồn kho. Thêm --apply để ghi thật.");
    return;
  }

  if (!candidates.length) {
    console.log("Không có variant hết hàng cần nhập thêm.");
    return;
  }

  let appliedVariants = 0;
  let skippedNowInStock = 0;
  let totalQtyAdded = 0;
  let documentCount = 0;

  for (let offset = 0; offset < candidates.length; offset += DOC_CHUNK_SIZE) {
    const chunk = candidates.slice(offset, offset + DOC_CHUNK_SIZE);

    const result = await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(inventoryDocuments)
        .values({
          code: `AUTO-STOCK-${Date.now()}-${String(offset / DOC_CHUNK_SIZE + 1).padStart(3, "0")}`,
          type: "receipt",
          status: "posted",
          sourceWarehouseId: null,
          targetWarehouseId: warehouse.id,
          reason: `Auto fill out-of-stock variants ${min}-${max} units/size`,
          requestedBy: actor!.id,
          approvedBy: actor!.id,
          postedAt: new Date(),
        })
        .returning();

      let chunkApplied = 0;
      let chunkSkipped = 0;
      let chunkQty = 0;

      for (const row of chunk) {
        const qty = stableQty(row.variantId, min, max);

        const [balance] = await tx
          .select()
          .from(inventoryBalances)
          .where(
            and(
              eq(inventoryBalances.warehouseId, warehouse.id),
              eq(inventoryBalances.variantId, row.variantId),
            ),
          )
          .limit(1)
          .for("update");

        if (balance) {
          const available = balance.onHand - balance.reserved;
          if (available > 0) {
            chunkSkipped += 1;
            continue;
          }

          await tx
            .update(inventoryBalances)
            .set({
              onHand: balance.onHand + qty,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(inventoryBalances.warehouseId, warehouse.id),
                eq(inventoryBalances.variantId, row.variantId),
              ),
            );
        } else {
          await tx.insert(inventoryBalances).values({
            warehouseId: warehouse.id,
            variantId: row.variantId,
            onHand: qty,
            reserved: 0,
            reorderPoint: 5,
          });
        }

        const [line] = await tx
          .insert(inventoryDocumentLines)
          .values({
            documentId: doc!.id,
            variantId: row.variantId,
            qty,
            unitCostVnd: null,
            direction: "in",
          })
          .returning();

        await tx.insert(stockMovements).values({
          documentLineId: line!.id,
          warehouseId: warehouse.id,
          variantId: row.variantId,
          deltaQty: qty,
          unitCostVnd: null,
          operationKey: `auto-stock:${doc!.id}:${row.variantId}`,
        });

        chunkApplied += 1;
        chunkQty += qty;
      }

      if (chunkApplied === 0) {
        await tx
          .delete(inventoryDocuments)
          .where(eq(inventoryDocuments.id, doc!.id));
        return { applied: 0, skipped: chunkSkipped, qty: 0, documentCreated: false };
      }

      return {
        applied: chunkApplied,
        skipped: chunkSkipped,
        qty: chunkQty,
        documentCreated: true,
      };
    });

    appliedVariants += result.applied;
    skippedNowInStock += result.skipped;
    totalQtyAdded += result.qty;
    if (result.documentCreated) documentCount += 1;

    console.log(
      `Batch ${Math.floor(offset / DOC_CHUNK_SIZE) + 1}: applied=${result.applied}, skipped=${result.skipped}, qty_added=${result.qty}`,
    );
  }

  console.log({
    done: true,
    documents_created: documentCount,
    variants_filled: appliedVariants,
    skipped_already_in_stock: skippedNowInStock,
    total_qty_added: totalQtyAdded,
    range_per_variant: `${min}-${max}`,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
