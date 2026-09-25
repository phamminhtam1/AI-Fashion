import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { orderItems, orders, customers } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import { markOrderPaid } from "../../lib/mark-order-paid.js";

export const adminOrderRoutes = new Hono<AppVars>();
adminOrderRoutes.use("*", requireAuth);

adminOrderRoutes.get("/", async (c) => {
  requirePerm(c.get("user")!, "order.read");
  const db = c.get("db");
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      grandTotalVnd: orders.grandTotalVnd,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      paidAt: orders.paidAt,
      paymentRef: orders.paymentRef,
      placedAt: orders.placedAt,
      customerName: customers.fullName,
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .orderBy(desc(orders.placedAt))
    .limit(100);

  return c.json({
    items: rows.map((o) => ({
      id: o.id,
      order_number: o.orderNumber,
      status: o.status,
      grand_total_vnd: o.grandTotalVnd,
      payment_method: o.paymentMethod,
      payment_status: o.paymentStatus,
      paid_at: o.paidAt,
      payment_ref: o.paymentRef,
      placed_at: o.placedAt,
      customer_name: o.customerName,
    })),
  });
});

adminOrderRoutes.get("/:id", async (c) => {
  requirePerm(c.get("user")!, "order.read");
  const id = c.req.param("id");
  const db = c.get("db");
  const order = (await db.select().from(orders).where(eq(orders.id, id)).limit(1))[0];
  if (!order) throw new ApiError(404, "not_found", "Không tìm thấy đơn hàng");
  const cust = (
    await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
  )[0];
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return c.json({
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    customer: cust
      ? { id: cust.id, full_name: cust.fullName, email: cust.email, phone: cust.phone }
      : null,
    subtotal_vnd: order.subtotalVnd,
    shipping_vnd: order.shippingVnd,
    grand_total_vnd: order.grandTotalVnd,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    paid_at: order.paidAt,
    payment_ref: order.paymentRef,
    recipient: order.recipientSnapshot,
    shipping_address: order.shippingAddressSnapshot,
    placed_at: order.placedAt,
    items: items.map((it) => ({
      sku: it.sku,
      product_name: it.productName,
      size_label: it.sizeLabel,
      qty: it.qty,
      unit_price_vnd: it.unitPriceVnd,
      line_total_vnd: it.lineTotalVnd,
    })),
  });
});

adminOrderRoutes.post("/:id/mark-paid", async (c) => {
  requirePerm(c.get("user")!, "order.read");
  const id = c.req.param("id");
  const ok = await markOrderPaid(c.get("db"), id, "manual");
  if (!ok) throw new ApiError(400, "invalid_state", "Đơn không ở trạng thái chờ chuyển khoản");
  const order = (await c.get("db").select().from(orders).where(eq(orders.id, id)).limit(1))[0]!;
  return c.json({
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    payment_status: order.paymentStatus,
  });
});

adminOrderRoutes.patch("/:id", async (c) => {
  requirePerm(c.get("user")!, "order.read");
  const id = c.req.param("id");
  const body = z
    .object({ status: z.enum(["pending", "confirmed", "cancelled"]) })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Trạng thái không hợp lệ");
  const db = c.get("db");
  const [row] = await db
    .update(orders)
    .set({ status: body.data.status, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy đơn hàng");
  return c.json({ id: row.id, order_number: row.orderNumber, status: row.status });
});
