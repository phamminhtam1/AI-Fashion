import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  customerAddresses,
  customers,
  discountCodes,
  inventoryBalances,
  orderItems,
  orders,
  products,
  productVariants,
  sizes,
  warehouses,
  wishlistItems,
} from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireCustomer } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
import { availableQty, newOrderNumber, shippingFeeVnd } from "../../lib/order-pricing.js";
import {
  assertCouponApplicable,
  computeDiscountVnd,
  CouponError,
  normalizeCouponCode,
} from "../../lib/discount-codes.js";

export const meRoutes = new Hono<AppVars>();
meRoutes.use("*", requireCustomer);

function mapAddress(row: typeof customerAddresses.$inferSelect) {
  return {
    id: row.id,
    recipient_name: row.recipientName,
    phone: row.phone,
    address_line: row.addressLine,
    administrative_units: row.administrativeUnits ?? {},
    is_default: row.isDefault,
    created_at: row.createdAt,
  };
}

meRoutes.get("/addresses", async (c) => {
  const db = c.get("db");
  const customerId = c.get("customer")!.customerId;
  const rows = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customerId))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));
  return c.json({ items: rows.map(mapAddress) });
});

meRoutes.post("/addresses", async (c) => {
  const body = z
    .object({
      recipient_name: z.string().trim().min(1),
      phone: z.string().trim().min(1),
      address_line: z.string().trim().min(1),
      administrative_units: z.record(z.string(), z.string()).optional(),
      is_default: z.boolean().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Địa chỉ không hợp lệ");

  const db = c.get("db");
  const customerId = c.get("customer")!.customerId;
  const isDefault = body.data.is_default ?? false;
  if (isDefault) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, customerId));
  }
  const [row] = await db
    .insert(customerAddresses)
    .values({
      customerId,
      recipientName: body.data.recipient_name,
      phone: body.data.phone,
      addressLine: body.data.address_line,
      administrativeUnits: body.data.administrative_units ?? {},
      isDefault,
    })
    .returning();
  return c.json(mapAddress(row!), 201);
});

meRoutes.patch("/addresses/:id", async (c) => {
  const id = c.req.param("id");
  const body = z
    .object({
      recipient_name: z.string().trim().min(1).optional(),
      phone: z.string().trim().min(1).optional(),
      address_line: z.string().trim().min(1).optional(),
      administrative_units: z.record(z.string(), z.string()).optional(),
      is_default: z.boolean().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Địa chỉ không hợp lệ");

  const db = c.get("db");
  const customerId = c.get("customer")!.customerId;
  const existing = (
    await db
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)))
      .limit(1)
  )[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy địa chỉ");

  if (body.data.is_default) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, customerId));
  }

  const [row] = await db
    .update(customerAddresses)
    .set({
      ...(body.data.recipient_name !== undefined ? { recipientName: body.data.recipient_name } : {}),
      ...(body.data.phone !== undefined ? { phone: body.data.phone } : {}),
      ...(body.data.address_line !== undefined ? { addressLine: body.data.address_line } : {}),
      ...(body.data.administrative_units !== undefined
        ? { administrativeUnits: body.data.administrative_units }
        : {}),
      ...(body.data.is_default !== undefined ? { isDefault: body.data.is_default } : {}),
    })
    .where(eq(customerAddresses.id, id))
    .returning();
  return c.json(mapAddress(row!));
});

meRoutes.delete("/addresses/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const customerId = c.get("customer")!.customerId;
  const deleted = await db
    .delete(customerAddresses)
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customerId)))
    .returning({ id: customerAddresses.id });
  if (!deleted[0]) throw new ApiError(404, "not_found", "Không tìm thấy địa chỉ");
  return c.json({ ok: true });
});

meRoutes.get("/wishlist", async (c) => {
  const db = c.get("db");
  const customerId = c.get("customer")!.customerId;
  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.customerId, customerId));
  return c.json({ items: rows.map((r) => ({ product_id: r.productId })) });
});

meRoutes.put("/wishlist/:productId", async (c) => {
  const productId = c.req.param("productId");
  const db = c.get("db");
  const customerId = c.get("customer")!.customerId;
  const product = (await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1))[0];
  if (!product) throw new ApiError(404, "not_found", "Không tìm thấy sản phẩm");
  await db
    .insert(wishlistItems)
    .values({ customerId, productId })
    .onConflictDoNothing();
  return c.json({ ok: true });
});

meRoutes.delete("/wishlist/:productId", async (c) => {
  const productId = c.req.param("productId");
  const db = c.get("db");
  const customerId = c.get("customer")!.customerId;
  await db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.customerId, customerId), eq(wishlistItems.productId, productId)));
  return c.json({ ok: true });
});

const payEnum = z.enum(["cod", "bank"]);

meRoutes.get("/orders", async (c) => {
  const db = c.get("db");
  const customerId = c.get("customer")!.customerId;
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.placedAt))
    .limit(50);
  return c.json({
    items: rows.map((o) => ({
      id: o.id,
      order_number: o.orderNumber,
      status: o.status,
      grand_total_vnd: o.grandTotalVnd,
      payment_method: o.paymentMethod,
      payment_status: o.paymentStatus,
      paid_at: o.paidAt,
      placed_at: o.placedAt,
    })),
  });
});

meRoutes.get("/orders/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const customerId = c.get("customer")!.customerId;
  const order = (
    await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.customerId, customerId)))
      .limit(1)
  )[0];
  if (!order) throw new ApiError(404, "not_found", "Không tìm thấy đơn hàng");
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return c.json({
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    currency: order.currency,
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
    items: items.map((it) => ({
      id: it.id,
      variant_id: it.variantId,
      product_id: it.productId,
      sku: it.sku,
      product_name: it.productName,
      size_label: it.sizeLabel,
      color_label: it.colorLabel,
      unit_price_vnd: it.unitPriceVnd,
      qty: it.qty,
      line_total_vnd: it.lineTotalVnd,
    })),
  });
});

meRoutes.post("/orders", async (c) => {
  const body = z
    .object({
      items: z
        .array(z.object({ variant_id: z.string().uuid(), qty: z.number().int().positive() }))
        .min(1),
      shipping: z.object({
        full_name: z.string().trim().min(1),
        phone: z.string().trim().min(1),
        email: z.string().email(),
        address_line: z.string().trim().min(1),
        city: z.string().trim().min(1),
        district: z.string().trim().min(1),
        note: z.string().optional(),
      }),
      payment_method: payEnum,
      note: z.string().optional(),
      coupon_code: z.string().trim().min(1).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Đơn hàng không hợp lệ");

  const db = c.get("db");
  const customerId = c.get("customer")!.customerId;
  const wh = (await db.select().from(warehouses).where(eq(warehouses.code, "MAIN")).limit(1))[0];
  if (!wh) throw new ApiError(500, "internal_error", "Chưa cấu hình kho");

  const lineInputs = body.data.items;
  type Line = {
    variantId: string;
    productId: string;
    sku: string;
    productName: string;
    sizeLabel: string;
    colorLabel: string | null;
    unitPrice: number;
    qty: number;
    lineTotal: number;
  };
  const lines: Line[] = [];

  for (const it of lineInputs) {
    const row = (
      await db
        .select({
          variantId: productVariants.id,
          productId: products.id,
          sku: productVariants.sku,
          productName: products.name,
          priceVnd: productVariants.priceVnd,
          sizeLabel: sizes.label,
          onHand: inventoryBalances.onHand,
          reserved: inventoryBalances.reserved,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .innerJoin(sizes, eq(sizes.id, productVariants.sizeId))
        .leftJoin(
          inventoryBalances,
          and(
            eq(inventoryBalances.variantId, productVariants.id),
            eq(inventoryBalances.warehouseId, wh.id),
          ),
        )
        .where(eq(productVariants.id, it.variant_id))
        .limit(1)
    )[0];

    if (!row) throw new ApiError(400, "validation_error", `SKU không tồn tại: ${it.variant_id}`);

    const onHand = row.onHand ?? 0;
    const reserved = row.reserved ?? 0;
    if (availableQty(onHand, reserved) < it.qty) {
      throw new ApiError(400, "insufficient_stock", "Không đủ tồn kho", {
        variant_id: it.variant_id,
      });
    }

    const unitPrice = Number(row.priceVnd);
    lines.push({
      variantId: row.variantId,
      productId: row.productId,
      sku: row.sku,
      productName: row.productName,
      sizeLabel: row.sizeLabel,
      colorLabel: null,
      unitPrice,
      qty: it.qty,
      lineTotal: unitPrice * it.qty,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const shipping = shippingFeeVnd(subtotal);
  const note = body.data.note ?? body.data.shipping.note ?? "";
  const couponRaw = body.data.coupon_code;

  const created = await db.transaction(async (tx) => {
    let discountVnd = 0;
    let discountCodeId: string | null = null;
    let discountCodeSnap: string | null = null;

    if (couponRaw) {
      const codeNorm = normalizeCouponCode(couponRaw);
      // ponytail: raw FOR UPDATE — drizzle .for("update") not used elsewhere yet
      await tx.execute(sql`SELECT id FROM discount_codes WHERE code = ${codeNorm} FOR UPDATE`);
      const locked = (
        await tx.select().from(discountCodes).where(eq(discountCodes.code, codeNorm)).limit(1)
      )[0];
      if (!locked) throw new ApiError(400, "coupon_not_found", "Không tìm thấy mã giảm giá");
      try {
        assertCouponApplicable(locked, subtotal);
      } catch (e) {
        if (e instanceof CouponError) throw new ApiError(400, e.code, e.message);
        throw e;
      }
      if (locked.type !== "percent" && locked.type !== "fixed") {
        throw new ApiError(400, "coupon_inactive", "Mã giảm giá không hợp lệ");
      }
      discountVnd = computeDiscountVnd({
        type: locked.type,
        value: locked.value,
        subtotalVnd: subtotal,
        maxDiscountVnd: locked.maxDiscountVnd,
      });
      const bumped = await tx
        .update(discountCodes)
        .set({
          usageCount: sql`${discountCodes.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(discountCodes.id, locked.id),
            sql`(${discountCodes.usageLimit} IS NULL OR ${discountCodes.usageCount} < ${discountCodes.usageLimit})`,
          ),
        )
        .returning({ id: discountCodes.id });
      if (!bumped[0]) throw new ApiError(400, "coupon_exhausted", "Mã giảm giá đã hết lượt dùng");
      discountCodeId = locked.id;
      discountCodeSnap = locked.code;
    }

    const grand = subtotal + shipping - discountVnd;

    for (const line of lines) {
      const bal = (
        await tx
          .select()
          .from(inventoryBalances)
          .where(
            and(
              eq(inventoryBalances.warehouseId, wh.id),
              eq(inventoryBalances.variantId, line.variantId),
            ),
          )
          .limit(1)
      )[0];
      if (!bal || availableQty(bal.onHand, bal.reserved) < line.qty) {
        throw new ApiError(400, "insufficient_stock", "Không đủ tồn kho", {
          variant_id: line.variantId,
        });
      }
      const updated = await tx
        .update(inventoryBalances)
        .set({
          reserved: sql`${inventoryBalances.reserved} + ${line.qty}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventoryBalances.warehouseId, wh.id),
            eq(inventoryBalances.variantId, line.variantId),
            sql`${inventoryBalances.onHand} - ${inventoryBalances.reserved} >= ${line.qty}`,
          ),
        )
        .returning({ variantId: inventoryBalances.variantId });
      if (!updated[0]) {
        throw new ApiError(400, "insufficient_stock", "Không đủ tồn kho", {
          variant_id: line.variantId,
        });
      }
    }

    let orderNumber = newOrderNumber();
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [order] = await tx
          .insert(orders)
          .values({
            orderNumber,
            customerId,
            status: "pending",
            subtotalVnd: subtotal,
            shippingVnd: shipping,
            discountVnd,
            discountCodeId,
            discountCode: discountCodeSnap,
            grandTotalVnd: grand,
            paymentMethod: body.data.payment_method,
            paymentStatus: body.data.payment_method === "bank" ? "awaiting" : "unpaid",
            recipientSnapshot: {
              full_name: body.data.shipping.full_name,
              phone: body.data.shipping.phone,
              email: body.data.shipping.email,
            },
            shippingAddressSnapshot: {
              address_line: body.data.shipping.address_line,
              city: body.data.shipping.city,
              district: body.data.shipping.district,
              ...(note ? { note } : {}),
            },
          })
          .returning();
        if (!order) throw new ApiError(500, "internal_error", "Không tạo được đơn");

        await tx.insert(orderItems).values(
          lines.map((l) => ({
            orderId: order.id,
            variantId: l.variantId,
            productId: l.productId,
            sku: l.sku,
            productName: l.productName,
            sizeLabel: l.sizeLabel,
            colorLabel: l.colorLabel,
            unitPriceVnd: l.unitPrice,
            qty: l.qty,
            lineTotalVnd: l.lineTotal,
          })),
        );

        // bump customer spend lightly for segment later
        await tx
          .update(customers)
          .set({
            totalSpentVnd: sql`${customers.totalSpentVnd} + ${grand}`,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, customerId));

        return order;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("orders_order_number_unique") || msg.includes("unique")) {
          orderNumber = newOrderNumber();
          continue;
        }
        throw e;
      }
    }
    throw new ApiError(500, "internal_error", "Không tạo được mã đơn");
  });

  return c.json(
    {
      id: created.id,
      order_number: created.orderNumber,
      status: created.status,
      grand_total_vnd: created.grandTotalVnd,
      payment_method: created.paymentMethod,
      payment_status: created.paymentStatus,
    },
    201,
  );
});
