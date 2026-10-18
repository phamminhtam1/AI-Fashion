import { Hono } from "hono";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  customers,
  customerAddresses,
  auditLogs,
  orders,
  orderItems,
  productMedia,
  mediaAssets,
} from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import { mediaPublicUrl } from "../../lib/media-storage.js";

export const adminCustomerRoutes = new Hono<AppVars>();
adminCustomerRoutes.use("*", requireAuth);

const statusEnum = z.enum(["active", "blocked"]);

function mapCustomer(
  row: typeof customers.$inferSelect,
  extras?: {
    total_spent_vnd?: number;
    address_count?: number;
    default_address?: string | null;
    city?: string | null;
    order_count?: number;
    last_order_at?: string | null;
  },
) {
  return {
    id: row.id,
    full_name: row.fullName,
    email: row.email,
    phone: row.phone,
    segment: row.segment,
    status: row.status,
    total_spent_vnd: extras?.total_spent_vnd !== undefined ? extras.total_spent_vnd : (row.totalSpentVnd ?? 0),
    internal_note: row.internalNote,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    ...(extras?.address_count !== undefined ? { address_count: extras.address_count } : {}),
    ...(extras?.default_address !== undefined ? { default_address: extras.default_address } : {}),
    ...(extras?.city !== undefined ? { city: extras.city } : {}),
    ...(extras?.order_count !== undefined ? { order_count: extras.order_count } : {}),
    ...(extras?.last_order_at !== undefined ? { last_order_at: extras.last_order_at } : {}),
  };
}

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

adminCustomerRoutes.get("/", async (c) => {
  requirePerm(c.get("user")!, "customer.read");
  const db = c.get("db");
  const segment = c.req.query("segment");
  const status = c.req.query("status");
  const q = c.req.query("q")?.trim();
  const spentMin = c.req.query("spent_min") ? Number(c.req.query("spent_min")) : undefined;
  const spentMax = c.req.query("spent_max") ? Number(c.req.query("spent_max")) : undefined;
  const dateFrom = c.req.query("date_from");
  const dateTo = c.req.query("date_to");
  const city = c.req.query("city")?.trim();
  const sortBy = c.req.query("sort_by") ?? "created_at_desc";
  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const rawLimit = Number(c.req.query("limit") ?? 50) || 50;
  const limit = Math.min(200, Math.max(1, rawLimit));
  const offset = (page - 1) * limit;

  const conds = [];
  if (segment) conds.push(eq(customers.segment, segment));
  if (status) conds.push(eq(customers.status, status));
  if (q) {
    const like = `%${q}%`;
    conds.push(
      or(ilike(customers.fullName, like), ilike(customers.phone, like), ilike(customers.email, like))!,
    );
  }
  if (spentMin != null && Number.isFinite(spentMin)) {
    conds.push(gte(customers.totalSpentVnd, spentMin));
  }
  if (spentMax != null && Number.isFinite(spentMax)) {
    conds.push(lte(customers.totalSpentVnd, spentMax));
  }
  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!Number.isNaN(d.getTime())) conds.push(gte(customers.createdAt, d));
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      conds.push(lte(customers.createdAt, d));
    }
  }
  if (city) {
    conds.push(sql`exists (
      select 1 from customer_addresses a
      where a.customer_id = customers.id
        and a.administrative_units->>'city' ilike ${`%${city}%`}
    )`);
  }

  const orderExpr = (() => {
    switch (sortBy) {
      case "spent_desc": return desc(customers.totalSpentVnd);
      case "spent_asc": return asc(customers.totalSpentVnd);
      case "name_asc": return asc(customers.fullName);
      case "name_desc": return desc(customers.fullName);
      case "created_at_asc": return asc(customers.createdAt);
      default: return desc(customers.createdAt);
    }
  })();

  const where = conds.length ? and(...conds) : undefined;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customers)
    .where(where);
  const total = countRow?.n ?? 0;

  const rows = await db
    .select({
      customer: customers,
      computed_spent: sql<number>`(
        select coalesce(sum(o.grand_total_vnd), 0)::bigint
        from orders o
        where o.customer_id = customers.id
          and o.status != 'cancelled'
          and (o.payment_status = 'paid' or (o.payment_method = 'cod' and (o.status = 'confirmed' or o.fulfillment_status = 'fulfilled')))
      )`,
      address_count: sql<number>`(
        select count(*)::int from customer_addresses a
        where a.customer_id = customers.id
      )`,
      default_address: sql<string | null>`(
        select trim(both ' · ' from concat_ws(' · ',
          nullif(a.address_line, ''),
          nullif(a.administrative_units->>'city', '')
        ))
        from customer_addresses a
        where a.customer_id = customers.id
        order by a.is_default desc, a.created_at desc
        limit 1
      )`,
      city: sql<string | null>`(
        select a.administrative_units->>'city'
        from customer_addresses a
        where a.customer_id = customers.id
        order by a.is_default desc, a.created_at desc
        limit 1
      )`,
      order_count: sql<number>`(
        select count(*)::int
        from orders o
        where o.customer_id = customers.id
      )`,
      last_order_at: sql<string | null>`(
        select max(o.placed_at)::text
        from orders o
        where o.customer_id = customers.id
      )`,
    })
    .from(customers)
    .where(where)
    .orderBy(orderExpr)
    .limit(limit)
    .offset(offset);

  // segment distribution for the current filter set
  const segmentCounts = await db
    .select({ segment: customers.segment, n: sql<number>`count(*)::int` })
    .from(customers)
    .where(where)
    .groupBy(customers.segment);
  const segDist: Record<string, number> = {};
  for (const r of segmentCounts) segDist[r.segment] = r.n;

  // Global overview metrics for metric cards
  const [metricsRow] = await db.select({
    total_customers: sql<number>`count(*)::int`,
    active_customers: sql<number>`count(*) filter (
      where status = 'active' and (
        created_at >= now() - interval '1 year' or
        exists (select 1 from orders o where o.customer_id = customers.id and o.placed_at >= now() - interval '1 year')
      )
    )::int`,
    customers_with_multiple_orders: sql<number>`count(*) filter (
      where (select count(*) from orders o where o.customer_id = customers.id and o.status != 'cancelled') >= 2
    )::int`,
  }).from(customers);

  const [ordersMetricRow] = await db.select({
    total_orders: sql<number>`count(*)::int`,
    avg_order_value: sql<number>`coalesce(avg(grand_total_vnd), 0)::bigint`,
  }).from(orders).where(sql`status != 'cancelled'`);

  const totalCust = metricsRow?.total_customers ?? 0;
  const activeCust = metricsRow?.active_customers ?? 0;
  const totalOrd = ordersMetricRow?.total_orders ?? 0;
  const avgAov = Number(ordersMetricRow?.avg_order_value ?? 0);
  const repeatCust = metricsRow?.customers_with_multiple_orders ?? 0;

  const overviewMetrics = {
    total_customers: totalCust,
    active_customers: activeCust,
    avg_orders_per_customer: totalCust > 0 ? Number((totalOrd / totalCust).toFixed(1)) : 0,
    avg_order_value_vnd: avgAov,
    repeat_customer_rate: totalCust > 0 ? Math.round((repeatCust / totalCust) * 100) : 0,
  };

  return c.json({
    items: rows.map((r) =>
      mapCustomer(r.customer, {
        total_spent_vnd: Number(r.computed_spent ?? r.customer.totalSpentVnd ?? 0),
        address_count: Number(r.address_count ?? 0),
        default_address: r.default_address || null,
        city: r.city || null,
        order_count: Number(r.order_count ?? 0),
        last_order_at: r.last_order_at || null,
      }),
    ),
    total,
    page,
    limit,
    segment_distribution: segDist,
    overview_metrics: overviewMetrics,
  });
});


adminCustomerRoutes.get("/:id", async (c) => {
  requirePerm(c.get("user")!, "customer.read");
  const db = c.get("db");
  const customerId = c.req.param("id");
  const row = (await db.select().from(customers).where(eq(customers.id, customerId)).limit(1))[0];
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy khách hàng");

  const addresses = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, row.id))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));

  // Fetch all orders placed by this customer
  const customerOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerId, row.id))
    .orderBy(desc(orders.placedAt));

  // Fetch items for all customer orders
  const orderIds = customerOrders.map((o) => o.id);
  const items =
    orderIds.length > 0
      ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
      : [];

  // Fetch cover images for products in these orders
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const covers =
    productIds.length > 0
      ? await db
          .select({
            productId: productMedia.productId,
            objectKey: mediaAssets.objectKey,
          })
          .from(productMedia)
          .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.assetId))
          .where(inArray(productMedia.productId, productIds))
          .orderBy(desc(productMedia.isCover), productMedia.sortOrder)
      : [];

  const coverMap = new Map<string, string>();
  for (const cov of covers) {
    if (!coverMap.has(cov.productId)) {
      coverMap.set(cov.productId, mediaPublicUrl(cov.objectKey));
    }
  }

  // Group items by orderId
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  const mappedOrders = customerOrders.map((o) => {
    const orderItemRows = itemsByOrder.get(o.id) ?? [];
    return {
      id: o.id,
      order_number: o.orderNumber,
      status: o.status,
      grand_total_vnd: o.grandTotalVnd,
      subtotal_vnd: o.subtotalVnd,
      shipping_vnd: o.shippingVnd,
      discount_vnd: o.discountVnd,
      discount_code: o.discountCode,
      payment_method: o.paymentMethod,
      payment_status: o.paymentStatus,
      paid_at: o.paidAt ? o.paidAt.toISOString() : null,
      payment_ref: o.paymentRef,
      placed_at: o.placedAt.toISOString(),
      fulfillment_status: o.fulfillmentStatus ?? "unfulfilled",
      fulfilled_at: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
      inventory_doc_code: o.inventoryDocCode,
      items: orderItemRows.map((it) => ({
        id: it.id,
        product_id: it.productId,
        variant_id: it.variantId,
        sku: it.sku,
        product_name: it.productName,
        size_label: it.sizeLabel,
        color_label: it.colorLabel,
        unit_price_vnd: it.unitPriceVnd,
        qty: it.qty,
        line_total_vnd: it.lineTotalVnd,
        image_url: coverMap.get(it.productId) ?? null,
      })),
    };
  });

  // Calculate RFM / Behavior CRM Analytics:
  // ONLY count orders that are legitimately paid/fulfilled as completed & total spent!
  const isPaidOrder = (o: typeof customerOrders[number]) =>
    o.status !== "cancelled" &&
    (o.paymentStatus === "paid" ||
      (o.paymentMethod === "cod" && (o.status === "confirmed" || o.fulfillmentStatus === "fulfilled")));

  const totalOrders = customerOrders.length;
  const paidOrders = customerOrders.filter(isPaidOrder);
  const completedOrders = paidOrders.length;
  const cancelledOrders = customerOrders.filter((o) => o.status === "cancelled").length;
  const pendingOrders = customerOrders.filter(
    (o) => o.status === "pending" || o.paymentStatus === "awaiting"
  ).length;

  // True total spent: ONLY from paid / confirmed completed orders
  const totalSpent = paidOrders.reduce((sum, o) => sum + (o.grandTotalVnd || 0), 0);
  const pendingSpent = customerOrders
    .filter((o) => o.status === "pending" || o.paymentStatus === "awaiting")
    .reduce((sum, o) => sum + (o.grandTotalVnd || 0), 0);
  const cancelledSpent = customerOrders
    .filter((o) => o.status === "cancelled")
    .reduce((sum, o) => sum + (o.grandTotalVnd || 0), 0);

  const aov = completedOrders > 0 ? Math.round(totalSpent / completedOrders) : 0;

  const paidPlacedDates = paidOrders.map((o) => new Date(o.placedAt).getTime()).sort((a, b) => a - b);
  const firstOrderAt = paidPlacedDates.length > 0 ? new Date(paidPlacedDates[0]).toISOString() : null;
  const lastOrderAt = paidPlacedDates.length > 0 ? new Date(paidPlacedDates[paidPlacedDates.length - 1]).toISOString() : null;
  const daysSinceLastOrder = lastOrderAt
    ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Size preferences tally - ONLY from paid / completed orders
  const paidOrderIds = new Set(paidOrders.map((o) => o.id));
  const paidItems = items.filter((it) => paidOrderIds.has(it.orderId));

  const sizeMap = new Map<string, number>();
  for (const it of paidItems) {
    if (it.sizeLabel) {
      sizeMap.set(it.sizeLabel, (sizeMap.get(it.sizeLabel) ?? 0) + it.qty);
    }
  }
  const topSizes = Array.from(sizeMap.entries())
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.count - a.count);

  // Top products purchased - ONLY from paid / completed orders
  const prodMap = new Map<string, { name: string; count: number; total_vnd: number; image_url?: string | null }>();
  for (const it of paidItems) {
    const existing = prodMap.get(it.productId) ?? {
      name: it.productName,
      count: 0,
      total_vnd: 0,
      image_url: coverMap.get(it.productId) ?? null,
    };
    existing.count += it.qty;
    existing.total_vnd += it.lineTotalVnd;
    prodMap.set(it.productId, existing);
  }
  const topProducts = Array.from(prodMap.values()).sort((a, b) => b.count - a.count);

  return c.json({
    ...mapCustomer(row, { total_spent_vnd: totalSpent }),
    addresses: addresses.map(mapAddress),
    orders: mappedOrders,
    analytics: {
      total_orders: totalOrders,
      completed_orders: completedOrders,
      cancelled_orders: cancelledOrders,
      pending_orders: pendingOrders,
      total_spent_vnd: totalSpent,
      pending_spent_vnd: pendingSpent,
      cancelled_spent_vnd: cancelledSpent,
      aov_vnd: aov,
      first_order_at: firstOrderAt,
      last_order_at: lastOrderAt,
      days_since_last_order: daysSinceLastOrder,
      top_sizes: topSizes,
      top_products: topProducts,
    },
  });
});

adminCustomerRoutes.patch("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "customer.write");
  const body = z
    .object({
      full_name: z.string().min(1).optional(),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      segment: z.enum(["new", "loyal", "vip"]).optional(),
      status: statusEnum.optional(),
      internal_note: z.string().optional().nullable(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu cập nhật không hợp lệ");

  const db = c.get("db");
  const existing = (await db.select().from(customers).where(eq(customers.id, c.req.param("id"))).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy khách hàng");

  // Check email uniqueness if changing email
  if (body.data.email && body.data.email !== existing.email) {
    const [conflict] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, body.data.email))
      .limit(1);
    if (conflict) {
      throw new ApiError(409, "email_conflict", "Email này đã được sử dụng bởi một khách hàng khác");
    }
  }

  const updateData: Partial<typeof customers.$inferInsert> = { updatedAt: new Date() };
  if (body.data.full_name !== undefined) updateData.fullName = body.data.full_name;
  if (body.data.email !== undefined) updateData.email = body.data.email;
  if (body.data.phone !== undefined) updateData.phone = body.data.phone;
  if (body.data.segment !== undefined) updateData.segment = body.data.segment;
  if (body.data.status !== undefined) updateData.status = body.data.status;
  if (body.data.internal_note !== undefined) updateData.internalNote = body.data.internal_note ?? "";

  const [row] = await db
    .update(customers)
    .set(updateData)
    .where(eq(customers.id, existing.id))
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "customer.update",
    resourceType: "customer",
    resourceId: row!.id,
    beforeRedacted: {
      fullName: existing.fullName,
      email: existing.email,
      phone: existing.phone,
      segment: existing.segment,
      status: existing.status,
      internalNote: existing.internalNote,
    },
    afterRedacted: {
      fullName: row!.fullName,
      email: row!.email,
      phone: row!.phone,
      segment: row!.segment,
      status: row!.status,
      internalNote: row!.internalNote,
    },
    requestId: requestId(c),
  });

  return c.json(mapCustomer(row!));
});

adminCustomerRoutes.post("/", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "customer.write");
  const body = z
    .object({
      full_name: z.string().min(1, "Họ và tên là bắt buộc"),
      email: z.string().email("Email không hợp lệ").optional().nullable(),
      phone: z.string().optional().nullable(),
      segment: z.enum(["new", "loyal", "vip"]).optional().default("new"),
      status: statusEnum.optional().default("active"),
      internal_note: z.string().optional().default(""),
      address: z
        .object({
          recipient_name: z.string().optional(),
          phone: z.string().optional(),
          address_line: z.string(),
          city: z.string().optional(),
          province: z.string().optional(),
          postal_code: z.string().optional(),
          country: z.string().optional(),
          is_default: z.boolean().optional().default(true),
        })
        .optional(),
    })
    .safeParse(await c.req.json());

  if (!body.success) {
    throw new ApiError(400, "validation_error", body.error.errors[0]?.message ?? "Dữ liệu không hợp lệ");
  }

  const db = c.get("db");

  // Check email uniqueness if provided
  if (body.data.email) {
    const [existing] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.email, body.data.email))
      .limit(1);
    if (existing) {
      throw new ApiError(409, "email_conflict", "Email này đã được sử dụng bởi một khách hàng khác");
    }
  }

  const [row] = await db
    .insert(customers)
    .values({
      fullName: body.data.full_name,
      email: body.data.email ?? null,
      phone: body.data.phone ?? null,
      segment: body.data.segment,
      status: body.data.status,
      internalNote: body.data.internal_note ?? "",
      totalSpentVnd: 0,
    })
    .returning();

  if (body.data.address && body.data.address.address_line) {
    await db.insert(customerAddresses).values({
      customerId: row!.id,
      recipientName: body.data.address.recipient_name || body.data.full_name,
      phone: body.data.address.phone || body.data.phone || "",
      addressLine: body.data.address.address_line,
      administrativeUnits: {
        city: body.data.address.city ?? "",
        province: body.data.address.province ?? "",
        postal_code: body.data.address.postal_code ?? "",
        country: body.data.address.country ?? "Việt Nam",
      },
      isDefault: body.data.address.is_default ?? true,
    });
  }

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "customer.create",
    resourceType: "customer",
    resourceId: row!.id,
    afterRedacted: {
      fullName: row!.fullName,
      email: row!.email,
      phone: row!.phone,
      segment: row!.segment,
      status: row!.status,
    },
    requestId: requestId(c),
  });

  return c.json(mapCustomer(row!), 201);
});

adminCustomerRoutes.post("/:id/addresses", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "customer.write");
  const customerId = c.req.param("id");
  const body = z
    .object({
      recipient_name: z.string().min(1),
      phone: z.string().min(1),
      address_line: z.string().min(1),
      administrative_units: z.record(z.string()).optional().default({}),
      is_default: z.boolean().optional().default(false),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu địa chỉ không hợp lệ");

  const db = c.get("db");
  const customer = (await db.select().from(customers).where(eq(customers.id, customerId)).limit(1))[0];
  if (!customer) throw new ApiError(404, "not_found", "Không tìm thấy khách hàng");

  if (body.data.is_default) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, customerId));
  }

  const [addr] = await db
    .insert(customerAddresses)
    .values({
      customerId,
      recipientName: body.data.recipient_name,
      phone: body.data.phone,
      addressLine: body.data.address_line,
      administrativeUnits: body.data.administrative_units,
      isDefault: body.data.is_default,
    })
    .returning();

  return c.json(mapAddress(addr!), 201);
});

adminCustomerRoutes.patch("/:id/addresses/:aid", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "customer.write");
  const customerId = c.req.param("id");
  const addressId = c.req.param("aid");
  const body = z
    .object({
      recipient_name: z.string().optional(),
      phone: z.string().optional(),
      address_line: z.string().optional(),
      administrative_units: z.record(z.string()).optional(),
      is_default: z.boolean().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu địa chỉ không hợp lệ");

  const db = c.get("db");
  const existing = (
    await db
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId)))
      .limit(1)
  )[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy địa chỉ");

  if (body.data.is_default) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, customerId));
  }

  const updateData: Partial<typeof customerAddresses.$inferInsert> = {};
  if (body.data.recipient_name !== undefined) updateData.recipientName = body.data.recipient_name;
  if (body.data.phone !== undefined) updateData.phone = body.data.phone;
  if (body.data.address_line !== undefined) updateData.addressLine = body.data.address_line;
  if (body.data.administrative_units !== undefined) updateData.administrativeUnits = body.data.administrative_units;
  if (body.data.is_default !== undefined) updateData.isDefault = body.data.is_default;

  const [addr] = await db
    .update(customerAddresses)
    .set(updateData)
    .where(eq(customerAddresses.id, addressId))
    .returning();

  return c.json(mapAddress(addr!));
});

adminCustomerRoutes.delete("/:id/addresses/:aid", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "customer.write");
  const customerId = c.req.param("id");
  const addressId = c.req.param("aid");
  const db = c.get("db");

  const deleted = await db
    .delete(customerAddresses)
    .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId)))
    .returning();

  if (!deleted.length) throw new ApiError(404, "not_found", "Không tìm thấy địa chỉ");
  return c.json({ ok: true });
});
