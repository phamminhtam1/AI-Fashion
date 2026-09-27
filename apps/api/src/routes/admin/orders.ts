import { Hono } from "hono";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  inventoryBalances,
  orderItems,
  orders,
  customers,
  productMedia,
  mediaAssets,
  productVariants,
} from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import { markOrderPaid } from "../../lib/mark-order-paid.js";
import { mediaPublicUrl } from "../../lib/media-storage.js";

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
      fulfillmentStatus: orders.fulfillmentStatus,
      fulfilledAt: orders.fulfilledAt,
      inventoryDocId: orders.inventoryDocId,
      inventoryDocCode: orders.inventoryDocCode,
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
      fulfillment_status: o.fulfillmentStatus ?? "unfulfilled",
      fulfilled_at: o.fulfilledAt,
      inventory_doc_id: o.inventoryDocId,
      inventory_doc_code: o.inventoryDocCode,
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

  // Fetch variant barcode & colorway
  const variantIds = Array.from(new Set(items.map((i) => i.variantId)));
  const variants =
    variantIds.length > 0
      ? await db
          .select({
            id: productVariants.id,
            barcode: productVariants.barcode,
            colorwayId: productVariants.colorwayId,
          })
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds))
      : [];
  const barcodeMap = new Map(variants.map((v) => [v.id, v.barcode]));
  const variantColorwayMap = new Map(variants.map((v) => [v.id, v.colorwayId]));

  // Fetch cover & colorway images for products
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const covers =
    productIds.length > 0
      ? await db
          .select({
            productId: productMedia.productId,
            colorwayId: productMedia.colorwayId,
            objectKey: mediaAssets.objectKey,
          })
          .from(productMedia)
          .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.assetId))
          .where(inArray(productMedia.productId, productIds))
          .orderBy(desc(productMedia.isCover), productMedia.sortOrder)
      : [];

  const colorwayMap = new Map<string, string>();
  const coverMap = new Map<string, string>();
  for (const cov of covers) {
    const url = mediaPublicUrl(cov.objectKey);
    if (cov.colorwayId && !colorwayMap.has(cov.colorwayId)) {
      colorwayMap.set(cov.colorwayId, url);
    }
    if (!coverMap.has(cov.productId)) {
      coverMap.set(cov.productId, url);
    }
  }

  return c.json({
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    fulfillment_status: order.fulfillmentStatus ?? "unfulfilled",
    fulfilled_at: order.fulfilledAt,
    inventory_doc_id: order.inventoryDocId,
    inventory_doc_code: order.inventoryDocCode,
    customer: cust
      ? { id: cust.id, full_name: cust.fullName, email: cust.email, phone: cust.phone }
      : null,
    subtotal_vnd: order.subtotalVnd,
    shipping_vnd: order.shippingVnd,
    discount_vnd: order.discountVnd,
    discount_code: order.discountCode,
    grand_total_vnd: order.grandTotalVnd,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    paid_at: order.paidAt,
    payment_ref: order.paymentRef,
    recipient: order.recipientSnapshot,
    shipping_address: order.shippingAddressSnapshot,
    placed_at: order.placedAt,
    items: items.map((it) => {
      const cwId = variantColorwayMap.get(it.variantId);
      return {
        id: it.id,
        product_id: it.productId,
        variant_id: it.variantId,
        sku: it.sku,
        barcode: barcodeMap.get(it.variantId) ?? null,
        product_name: it.productName,
        size_label: it.sizeLabel,
        color_label: it.colorLabel ?? null,
        image_url: (cwId ? colorwayMap.get(cwId) : null) ?? coverMap.get(it.productId) ?? null,
        qty: it.qty,
        unit_price_vnd: it.unitPriceVnd,
        line_total_vnd: it.lineTotalVnd,
      };
    }),
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
    .object({
      status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
      fulfillment_status: z.enum(["unfulfilled", "fulfilled", "partial"]).optional(),
      inventory_doc_id: z.string().uuid().nullable().optional(),
      inventory_doc_code: z.string().nullable().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu không hợp lệ");
  const db = c.get("db");
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) throw new ApiError(404, "not_found", "Không tìm thấy đơn hàng");

  if (body.data.fulfillment_status === "fulfilled") {
    if (order.status === "cancelled" || body.data.status === "cancelled") {
      throw new ApiError(400, "invalid_state", "Không thể xuất kho đơn hàng đã bị hủy");
    }
    const isPaidOrCod = order.paymentStatus === "paid" || order.paymentMethod === "cod";
    if (!isPaidOrCod) {
      throw new ApiError(400, "unpaid_order", "Chỉ những đơn hàng thanh toán thành công hoặc COD mới được xuất kho");
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.status !== undefined) {
    updateData.status = body.data.status;
    if (body.data.status === "cancelled" && order.status !== "cancelled" && order.fulfillmentStatus !== "fulfilled") {
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      for (const it of items) {
        await db
          .update(inventoryBalances)
          .set({
            reserved: sql`GREATEST(0, ${inventoryBalances.reserved} - ${it.qty})`,
            updatedAt: new Date(),
          })
          .where(eq(inventoryBalances.variantId, it.variantId));
      }
    }
  }
  if (body.data.fulfillment_status !== undefined) {
    updateData.fulfillmentStatus = body.data.fulfillment_status;
    if (body.data.fulfillment_status === "fulfilled") {
      updateData.fulfilledAt = new Date();
    } else if (body.data.fulfillment_status === "unfulfilled") {
      updateData.fulfilledAt = null;
    }
  }
  if (body.data.inventory_doc_id !== undefined) updateData.inventoryDocId = body.data.inventory_doc_id;
  if (body.data.inventory_doc_code !== undefined) updateData.inventoryDocCode = body.data.inventory_doc_code;

  const [row] = await db
    .update(orders)
    .set(updateData)
    .where(eq(orders.id, id))
    .returning();
  return c.json({
    id: row!.id,
    order_number: row!.orderNumber,
    status: row!.status,
    fulfillment_status: row!.fulfillmentStatus,
    fulfilled_at: row!.fulfilledAt,
    inventory_doc_id: row!.inventoryDocId,
    inventory_doc_code: row!.inventoryDocCode,
  });
});

adminOrderRoutes.post("/:id/fulfill", async (c) => {
  requirePerm(c.get("user")!, "order.read");
  const id = c.req.param("id");
  const db = c.get("db");
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) throw new ApiError(404, "not_found", "Không tìm thấy đơn hàng");

  const body = (await c.req.json().catch(() => ({}))) as {
    status?: "unfulfilled" | "fulfilled";
    inventory_doc_id?: string | null;
    inventory_doc_code?: string | null;
  };

  const targetStatus = body.status === "unfulfilled" ? "unfulfilled" : "fulfilled";

  if (targetStatus === "fulfilled") {
    if (order.status === "cancelled") {
      throw new ApiError(400, "invalid_state", "Không thể xuất kho đơn hàng đã bị hủy");
    }
    const isPaidOrCod = order.paymentStatus === "paid" || order.paymentMethod === "cod";
    if (!isPaidOrCod) {
      throw new ApiError(400, "unpaid_order", "Chỉ những đơn hàng thanh toán thành công hoặc COD mới được xuất kho");
    }
  }

  const docId = body.inventory_doc_id !== undefined ? body.inventory_doc_id : order.inventoryDocId;
  const docCode = body.inventory_doc_code !== undefined ? body.inventory_doc_code : order.inventoryDocCode;

  const [row] = await db
    .update(orders)
    .set({
      fulfillmentStatus: targetStatus,
      fulfilledAt: targetStatus === "fulfilled" ? new Date() : null,
      inventoryDocId: targetStatus === "fulfilled" ? docId : null,
      inventoryDocCode: targetStatus === "fulfilled" ? docCode : null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id))
    .returning();

  return c.json({
    id: row!.id,
    order_number: row!.orderNumber,
    status: row!.status,
    fulfillment_status: row!.fulfillmentStatus,
    fulfilled_at: row!.fulfilledAt,
    inventory_doc_id: row!.inventoryDocId,
    inventory_doc_code: row!.inventoryDocCode,
  });
});
