import { and, eq, sql } from "drizzle-orm";
import { orders, customers } from "@elane/db";
import type { AppVars } from "../middleware/auth.js";

type Db = AppVars["Variables"]["db"];

/** Marks bank+awaiting order paid+confirmed. Returns false if nothing updated. */
export async function markOrderPaid(db: Db, orderIdOrNumber: string, paymentRef: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrNumber);
  const condition = isUuid
    ? eq(orders.id, orderIdOrNumber)
    : sql`lower(${orders.orderNumber}) = lower(${orderIdOrNumber})`;

  const [existing] = await db
    .select({
      id: orders.id,
      paymentStatus: orders.paymentStatus,
      customerId: orders.customerId,
      grandTotalVnd: orders.grandTotalVnd,
    })
    .from(orders)
    .where(condition)
    .limit(1);

  if (!existing) {
    return false;
  }

  if (existing.paymentStatus === "paid") {
    return true;
  }

  const updated = await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      paidAt: new Date(),
      paymentRef,
      status: "confirmed",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, existing.id))
    .returning({ id: orders.id, customerId: orders.customerId, grandTotalVnd: orders.grandTotalVnd });

  if (updated[0]?.customerId) {
    await db
      .update(customers)
      .set({
        totalSpentVnd: sql`(
          select coalesce(sum(o.grand_total_vnd), 0)::bigint
          from orders o
          where o.customer_id = ${updated[0].customerId}
            and o.status != 'cancelled'
            and (o.payment_status = 'paid' or (o.payment_method = 'cod' and (o.status = 'confirmed' or o.fulfillment_status = 'fulfilled')))
        )`,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, updated[0].customerId));
  }

  return Boolean(updated[0]);
}
