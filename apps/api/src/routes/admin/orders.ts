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
  productColorways,
  sizes,
  products,
  sepayWebhookEvents,
  inventoryDocuments,
} from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import { markOrderPaid } from "../../lib/mark-order-paid.js";
import { mediaPublicUrl } from "../../lib/media-storage.js";
import { checkAndExpirePendingBankOrders } from "../../workers/order-expiry.worker.js";

export const adminOrderRoutes = new Hono<AppVars>();
adminOrderRoutes.use("*", requireAuth);

adminOrderRoutes.get("/", async (c) => {
  requirePerm(c.get("user")!, "order.read");
  await checkAndExpirePendingBankOrders().catch(() => 0);
  const db = c.get("db");
  const limitParam = Math.min(1000, Math.max(1, Number(c.req.query("limit")) || 200));
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
      recipientSnapshot: orders.recipientSnapshot,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
      fulfillmentStatus: orders.fulfillmentStatus,
      fulfilledAt: orders.fulfilledAt,
      inventoryDocId: orders.inventoryDocId,
      inventoryDocCode: orders.inventoryDocCode,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .orderBy(desc(orders.placedAt))
    .limit(limitParam);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      revenueVnd: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then ${orders.grandTotalVnd} else 0 end), 0)::bigint`,
      pendingPayment: sql<number>`count(*) filter (where ${orders.status} != 'cancelled' and ${orders.paymentStatus} in ('pending', 'awaiting', 'unpaid'))::int`,
      processing: sql<number>`count(*) filter (where ${orders.status} != 'cancelled' and ${orders.fulfillmentStatus} in ('unfulfilled', 'partial', 'processing', 'picking'))::int`,
      shipping: sql<number>`count(*) filter (where ${orders.status} != 'cancelled' and ${orders.fulfillmentStatus} in ('shipping', 'fulfilled'))::int`,
      delivered: sql<number>`count(*) filter (where ${orders.status} != 'cancelled' and ${orders.fulfillmentStatus} = 'delivered')::int`,
      cancelled: sql<number>`count(*) filter (where ${orders.status} = 'cancelled')::int`,
      returned: sql<number>`count(*) filter (where ${orders.fulfillmentStatus} = 'returned' or ${orders.paymentStatus} = 'refunded')::int`,
      todayOrders: sql<number>`count(*) filter (where ${orders.placedAt} >= date_trunc('day', now()))::int`,
      todayRevenueVnd: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' and ${orders.placedAt} >= date_trunc('day', now()) then ${orders.grandTotalVnd} else 0 end), 0)::bigint`,
    })
    .from(orders);

  const orderIds = rows.map((r) => r.id);
  const itemsMap = new Map<string, Array<{ imageUrl: string | null }>>();
  const countMap = new Map<string, number>();

  if (orderIds.length > 0) {
    const rawItems = await db
      .select({
        orderId: orderItems.orderId,
        qty: orderItems.qty,
        variantId: orderItems.variantId,
        productId: orderItems.productId,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    for (const it of rawItems) {
      countMap.set(it.orderId, (countMap.get(it.orderId) ?? 0) + it.qty);
    }

    const productIds = Array.from(new Set(rawItems.map((i) => i.productId)));
    if (productIds.length > 0) {
      const mediaRows = await db
        .select({
          productId: productMedia.productId,
          objectKey: mediaAssets.objectKey,
        })
        .from(productMedia)
        .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.assetId))
        .where(inArray(productMedia.productId, productIds));

      const mediaByProduct = new Map<string, string>();
      for (const m of mediaRows) {
        if (!mediaByProduct.has(m.productId) && m.objectKey) {
          mediaByProduct.set(m.productId, mediaPublicUrl(m.objectKey));
        }
      }

      for (const it of rawItems) {
        const arr = itemsMap.get(it.orderId) ?? [];
        const img = mediaByProduct.get(it.productId) ?? null;
        if (img && !arr.some((a) => a.imageUrl === img)) {
          arr.push({ imageUrl: img });
        }
        itemsMap.set(it.orderId, arr);
      }
    }
  }

  return c.json({
    stats: {
      total: Number(stats?.total ?? 0),
      revenue_vnd: Number(stats?.revenueVnd ?? 0),
      pending_payment: Number(stats?.pendingPayment ?? 0),
      processing: Number(stats?.processing ?? 0),
      shipping: Number(stats?.shipping ?? 0),
      delivered: Number(stats?.delivered ?? 0),
      cancelled: Number(stats?.cancelled ?? 0),
      returned: Number(stats?.returned ?? 0),
      today_orders: Number(stats?.todayOrders ?? 0),
      today_revenue_vnd: Number(stats?.todayRevenueVnd ?? 0),
    },
    items: rows.map((o) => {
      const itemsList = itemsMap.get(o.id) ?? [];
      const shipSnap = o.shippingAddressSnapshot as Record<string, string> | null;
      const recSnap = o.recipientSnapshot as Record<string, string> | null;
      const location = shipSnap?.city || shipSnap?.province || recSnap?.city || "Hà Nội";

      return {
        id: o.id,
        order_number: o.orderNumber,
        status: o.status,
        grand_total_vnd: o.grandTotalVnd,
        payment_method: o.paymentMethod,
        payment_status: o.paymentStatus,
        paid_at: o.paidAt,
        payment_ref: o.paymentRef,
        placed_at: o.placedAt,
        customer_name:
          o.customerName ??
          recSnap?.full_name ??
          "Khách vãng lai",
        customer_location: location,
        items_count: countMap.get(o.id) ?? 1,
        item_images: itemsList.map((i) => i.imageUrl).filter(Boolean),
        extra_items: Math.max(0, (countMap.get(o.id) ?? 1) - itemsList.length),
        fulfillment_status: o.fulfillmentStatus ?? "unfulfilled",
        fulfilled_at: o.fulfilledAt,
        inventory_doc_id: o.inventoryDocId,
        inventory_doc_code: o.inventoryDocCode,
      };
    }),
  });
});

adminOrderRoutes.post("/", async (c) => {
  requirePerm(c.get("user")!, "order.read");
  const db = c.get("db");

  const body = z
    .object({
      customer_id: z.string().uuid().optional(),
      customer_name: z.string().min(1),
      customer_email: z.string().email().optional().nullable(),
      customer_phone: z.string().optional().nullable(),
      shipping: z.object({
        full_name: z.string(),
        phone: z.string().optional().nullable(),
        address_line: z.string(),
        city: z.string(),
        state: z.string().optional().nullable(),
        postal_code: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
      }),
      billing: z
        .object({
          full_name: z.string().optional().nullable(),
          address_line: z.string().optional().nullable(),
          city: z.string().optional().nullable(),
          country: z.string().optional().nullable(),
        })
        .optional(),
      items: z
        .array(
          z.object({
            variant_id: z.string().uuid().optional(),
            product_id: z.string().uuid().optional(),
            sku: z.string(),
            product_name: z.string(),
            size_label: z.string().optional().nullable(),
            color_label: z.string().optional().nullable(),
            unit_price_vnd: z.number().int().min(0),
            qty: z.number().int().min(1),
            image_url: z.string().optional().nullable(),
          }),
        )
        .min(1),
      payment_method: z.string().default("card"),
      payment_status: z.enum(["unpaid", "awaiting", "paid", "failed", "pending", "refunded"]).default("unpaid"),
      fulfillment_status: z.enum(["unfulfilled", "processing", "shipping", "delivered"]).default("unfulfilled"),
      fulfillment_location: z.string().optional().nullable(),
      shipping_method: z.string().optional().nullable(),
      shipping_vnd: z.number().int().default(0),
      discount_vnd: z.number().int().default(0),
      discount_code: z.string().optional().nullable(),
      status: z.enum(["pending", "confirmed", "cancelled"]).default("confirmed"),
      notes: z.string().optional().nullable(),
    })
    .safeParse(await c.req.json());

  if (!body.success) {
    throw new ApiError(400, "validation_error", "Dữ liệu tạo đơn không hợp lệ");
  }

  const data = body.data;

  // 1. Resolve or create customer
  let customerId = data.customer_id;
  if (!customerId) {
    if (data.customer_email) {
      const existing = (
        await db
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.email, data.customer_email))
          .limit(1)
      )[0];
      if (existing) customerId = existing.id;
    }
    if (!customerId && data.customer_phone) {
      const existing = (
        await db
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.phone, data.customer_phone))
          .limit(1)
      )[0];
      if (existing) customerId = existing.id;
    }

    if (!customerId) {
      const [newCust] = await db
        .insert(customers)
        .values({
          fullName: data.customer_name,
          email: data.customer_email ?? null,
          phone: data.customer_phone ?? null,
          segment: "new",
          status: "active",
        })
        .returning({ id: customers.id });
      customerId = newCust!.id;
    }
  }

  // Calculate totals
  const subtotalVnd = data.items.reduce((acc, it) => acc + it.qty * it.unit_price_vnd, 0);
  const grandTotalVnd = Math.max(0, subtotalVnd + data.shipping_vnd - data.discount_vnd);

  // Fallback variant/product if any item variant is not in DB
  const defaultVariant = (await db.select().from(productVariants).limit(1))[0];
  const defaultProduct = (await db.select().from(products).limit(1))[0];

  const orderNumber = `EL-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;

  const paymentStatusMap: Record<string, string> = {
    pending: "awaiting",
    paid: "paid",
    failed: "failed",
    refunded: "refunded",
    unpaid: "unpaid",
    awaiting: "awaiting",
  };

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber,
      customerId,
      status: data.status,
      subtotalVnd,
      shippingVnd: data.shipping_vnd,
      discountVnd: data.discount_vnd,
      discountCode: data.discount_code ?? null,
      grandTotalVnd,
      paymentMethod: data.payment_method.toLowerCase().includes("bank")
        ? "bank"
        : data.payment_method.toLowerCase().includes("cod")
          ? "cod"
          : "card",
      paymentStatus: paymentStatusMap[data.payment_status] ?? "unpaid",
      paidAt: data.payment_status === "paid" ? new Date() : null,
      recipientSnapshot: {
        full_name: data.shipping.full_name,
        phone: data.shipping.phone ?? data.customer_phone ?? "",
        email: data.customer_email ?? "",
      },
      shippingAddressSnapshot: {
        address_line: data.shipping.address_line,
        city: data.shipping.city,
        state: data.shipping.state ?? "",
        postal_code: data.shipping.postal_code ?? "",
        country: data.shipping.country ?? "United States",
        ...(data.notes ? { note: data.notes } : {}),
      },
      fulfillmentStatus: data.fulfillment_status === "delivered" ? "fulfilled" : "unfulfilled",
    })
    .returning();

  if (!order) throw new ApiError(500, "internal_error", "Không thể tạo đơn hàng");

  // Insert order items
  for (const it of data.items) {
    let resolvedVariantId = it.variant_id;
    let resolvedProductId = it.product_id;

    if (!resolvedVariantId && it.sku) {
      const v = (await db.select().from(productVariants).where(eq(productVariants.sku, it.sku)).limit(1))[0];
      if (v) {
        resolvedVariantId = v.id;
        resolvedProductId = v.productId;
      }
    }

    if (!resolvedVariantId && defaultVariant) {
      resolvedVariantId = defaultVariant.id;
      resolvedProductId = defaultVariant.productId;
    }

    if (resolvedVariantId && resolvedProductId) {
      await db.insert(orderItems).values({
        orderId: order.id,
        variantId: resolvedVariantId,
        productId: resolvedProductId,
        sku: it.sku,
        productName: it.product_name,
        sizeLabel: it.size_label ?? "Standard",
        colorLabel: it.color_label ?? null,
        unitPriceVnd: it.unit_price_vnd,
        qty: it.qty,
        lineTotalVnd: it.qty * it.unit_price_vnd,
      });
    }
  }

  return c.json({
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    grand_total_vnd: order.grandTotalVnd,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    customer_name: data.customer_name,
    customer_location: data.shipping.city,
    items_count: data.items.reduce((acc, it) => acc + it.qty, 0),
    fulfillment_status: order.fulfillmentStatus,
    placed_at: order.placedAt,
  });
});

adminOrderRoutes.get("/:id", async (c) => {
  requirePerm(c.get("user")!, "order.read");
  await checkAndExpirePendingBankOrders().catch(() => 0);
  const id = c.req.param("id");
  const db = c.get("db");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const order = (
    await db
      .select()
      .from(orders)
      .where(isUuid ? eq(orders.id, id) : sql`lower(${orders.orderNumber}) = lower(${id})`)
      .limit(1)
  )[0];
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
          colorwaySort: productColorways.sortOrder,
          sizeLabel: sizes.label,
          })
          .from(productVariants)
          .innerJoin(productColorways, eq(productColorways.id, productVariants.colorwayId))
          .innerJoin(sizes, eq(sizes.id, productVariants.sizeId))
          .where(inArray(productVariants.id, variantIds))
      : [];
  const barcodeMap = new Map(variants.map((v) => [v.id, v.barcode]));
  const variantColorwayMap = new Map(variants.map((v) => [v.id, v.colorwayId]));
  const variantColorLabelMap = new Map(variants.map((v) => [v.id, `Màu ${v.colorwaySort + 1}`]));
  const variantSizeLabelMap = new Map(variants.map((v) => [v.id, v.sizeLabel]));

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

  const sepayTx = (
    await db
      .select({
        id: sepayWebhookEvents.id,
        sepayId: sepayWebhookEvents.sepayId,
        payload: sepayWebhookEvents.payload,
        createdAt: sepayWebhookEvents.createdAt,
      })
      .from(sepayWebhookEvents)
      .where(eq(sepayWebhookEvents.matchedOrderId, order.id))
      .orderBy(desc(sepayWebhookEvents.createdAt))
      .limit(1)
  )[0] ?? null;

  let inventoryDoc = null;
  if (order.inventoryDocId) {
    inventoryDoc = (
      await db
        .select({
          id: inventoryDocuments.id,
          code: inventoryDocuments.code,
          status: inventoryDocuments.status,
          postedAt: inventoryDocuments.postedAt,
          createdAt: inventoryDocuments.createdAt,
        })
        .from(inventoryDocuments)
        .where(eq(inventoryDocuments.id, order.inventoryDocId))
        .limit(1)
    )[0] ?? null;
  }

  return c.json({
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    fulfillment_status: order.fulfillmentStatus ?? "unfulfilled",
    fulfilled_at: order.fulfilledAt,
    inventory_doc_id: order.inventoryDocId,
    inventory_doc_code: order.inventoryDocCode,
    inventory_doc: inventoryDoc,
    sepay_transaction: sepayTx,
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
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    items: items.map((it) => {
      const cwId = variantColorwayMap.get(it.variantId);
      return {
        id: it.id,
        product_id: it.productId,
        variant_id: it.variantId,
        sku: it.sku,
        barcode: barcodeMap.get(it.variantId) ?? null,
        product_name: it.productName,
        size_label: it.sizeLabel || variantSizeLabelMap.get(it.variantId) || null,
        color_label: it.colorLabel || variantColorLabelMap.get(it.variantId) || null,
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
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const condition = isUuid ? eq(orders.id, id) : sql`lower(${orders.orderNumber}) = lower(${id})`;

  const ok = await markOrderPaid(c.get("db"), id, "manual");
  if (!ok) throw new ApiError(404, "not_found", "Không tìm thấy đơn hàng");
  const order = (await c.get("db").select().from(orders).where(condition).limit(1))[0]!;
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
      fulfillment_status: z.enum(["unfulfilled", "fulfilled", "partial", "shipping", "delivered"]).optional(),
      inventory_doc_id: z.string().uuid().nullable().optional(),
      inventory_doc_code: z.string().nullable().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu không hợp lệ");
  const db = c.get("db");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const condition = isUuid ? eq(orders.id, id) : sql`lower(${orders.orderNumber}) = lower(${id})`;
  const [order] = await db.select().from(orders).where(condition).limit(1);
  if (!order) throw new ApiError(404, "not_found", "Không tìm thấy đơn hàng");

  if (body.data.fulfillment_status && ["fulfilled", "shipping", "delivered"].includes(body.data.fulfillment_status)) {
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
    if (["fulfilled", "shipping", "delivered"].includes(body.data.fulfillment_status)) {
      if (!order.fulfilledAt) updateData.fulfilledAt = new Date();
    } else if (body.data.fulfillment_status === "unfulfilled") {
      updateData.fulfilledAt = null;
    }
  }
  if (body.data.inventory_doc_id !== undefined) updateData.inventoryDocId = body.data.inventory_doc_id;
  if (body.data.inventory_doc_code !== undefined) updateData.inventoryDocCode = body.data.inventory_doc_code;

  const [row] = await db
    .update(orders)
    .set(updateData)
    .where(eq(orders.id, order.id))
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
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const condition = isUuid ? eq(orders.id, id) : sql`lower(${orders.orderNumber}) = lower(${id})`;

  const db = c.get("db");
  const [order] = await db.select().from(orders).where(condition).limit(1);
  if (!order) throw new ApiError(404, "not_found", "Không tìm thấy đơn hàng");

  const body = (await c.req.json().catch(() => ({}))) as {
    status?: "unfulfilled" | "fulfilled" | "shipping" | "delivered";
    inventory_doc_id?: string | null;
    inventory_doc_code?: string | null;
  };

  const targetStatus = body.status || "fulfilled";

  if (targetStatus !== "unfulfilled") {
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
      fulfilledAt: targetStatus !== "unfulfilled" ? (order.fulfilledAt || new Date()) : null,
      inventoryDocId: targetStatus !== "unfulfilled" ? docId : null,
      inventoryDocCode: targetStatus !== "unfulfilled" ? docCode : null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id))
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
