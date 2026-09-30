import { and, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { orderItems, orders, productVariants, stockMovements } from "@elane/db";
import type { Db } from "@elane/db";

const NEW_DAYS = 3;
const TOP_N = 20;

/** True if product went live within the last `NEW_DAYS` days. */
export function isAutoNew(publishedAt: Date | null, createdAt: Date, now = new Date()): boolean {
  const anchor = publishedAt ?? createdAt;
  const ms = now.getTime() - anchor.getTime();
  return ms >= 0 && ms <= NEW_DAYS * 24 * 60 * 60 * 1000;
}

let topSellerCache: { at: number; ids: Set<string> } | null = null;

export async function weeklyTopSellerIds(db: Db, now = new Date()): Promise<Set<string>> {
  if (topSellerCache && now.getTime() - topSellerCache.at < 60_000) {
    return topSellerCache.ids;
  }

  // 1. Ưu tiên: Lấy theo số lượng bán thực tế từ bảng order_items (đơn không bị hủy)
  try {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const orderRows = await db
      .select({
        product_id: orderItems.productId,
        sold: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(ne(orders.status, "cancelled"), gte(orders.createdAt, thirtyDaysAgo)))
      .groupBy(orderItems.productId)
      .orderBy(desc(sql`sum(${orderItems.qty})`))
      .limit(TOP_N);

    if (orderRows.length > 0) {
      const ids = new Set(orderRows.map((r) => r.product_id));
      topSellerCache = { at: now.getTime(), ids };
      return ids;
    }
  } catch (err) {
    console.warn("Could not query orderItems for top sellers:", err);
  }

  // 2. Dự phòng: Lấy theo lượng xuất kho gần nhất (stockMovements)
  try {
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

    if (rows.length > 0) {
      const ids = new Set(rows.map((r) => r.product_id));
      topSellerCache = { at: now.getTime(), ids };
      return ids;
    }
  } catch (err) {
    console.warn("Could not query stockMovements for top sellers:", err);
  }

  topSellerCache = { at: now.getTime(), ids: new Set() };
  return topSellerCache.ids;
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
