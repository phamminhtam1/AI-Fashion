import { and, eq, sql } from "drizzle-orm";
import { orders, customers } from "@elane/db";
import type { AppVars } from "../middleware/auth.js";

type Db = AppVars["Variables"]["db"];

/** Marks bank+awaiting order paid+confirmed. Returns false if nothing updated. */
export async function markOrderPaid(db: Db, orderId: string, paymentRef: string) {
  const updated = await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      paidAt: new Date(),
      paymentRef,
      status: "confirmed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.paymentMethod, "bank"),
        eq(orders.paymentStatus, "awaiting"),
      ),
    )
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
