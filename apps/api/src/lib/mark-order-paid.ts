import { and, eq } from "drizzle-orm";
import { orders } from "@elane/db";
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
    .returning({ id: orders.id });
  return Boolean(updated[0]);
}
