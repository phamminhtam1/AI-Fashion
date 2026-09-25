import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { productVariants, stockMovements } from "@elane/db";
import type { Db } from "@elane/db";

const NEW_DAYS = 3;
const TOP_N = 5;

/** True if product went live within the last `NEW_DAYS` days. */
export function isAutoNew(publishedAt: Date | null, createdAt: Date, now = new Date()): boolean {
  const anchor = publishedAt ?? createdAt;
  const ms = now.getTime() - anchor.getTime();
  return ms >= 0 && ms <= NEW_DAYS * 24 * 60 * 60 * 1000;
}

// ponytail: no orders table yet — outbound stock (delta < 0) this calendar week ≈ sales; replace with order lines later
let topSellerCache: { at: number; ids: Set<string> } | null = null;

export async function weeklyTopSellerIds(db: Db, now = new Date()): Promise<Set<string>> {
  if (topSellerCache && now.getTime() - topSellerCache.at < 60_000) {
    return topSellerCache.ids;
  }

  const weekStart = startOfWeek(now);
  const rows = await db
    .select({
      product_id: productVariants.productId,
      sold: sql<number>`coalesce(sum(-${stockMovements.deltaQty}), 0)::int`,
    })
    .from(stockMovements)
    .innerJoin(productVariants, eq(productVariants.id, stockMovements.variantId))
    .where(and(lt(stockMovements.deltaQty, 0), gte(stockMovements.createdAt, weekStart)))
    .groupBy(productVariants.productId)
    .orderBy(desc(sql`sum(-${stockMovements.deltaQty})`))
    .limit(TOP_N);

  const ids = new Set(rows.map((r) => r.product_id));
  topSellerCache = { at: now.getTime(), ids };
  return ids;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0 (ISO week)
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export function clearTopSellerCache() {
  topSellerCache = null;
}
