import { Hono } from "hono";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  products,
  inventoryBalances,
  inventoryDocuments,
  employees,
  accounts,
  employeeRoleGrants,
  roles,
  rolePermissions,
  permissions,
  auditLogs,
  settings,
  warehouses,
  customers,
  productVariants,
  categories,
  orders,
  orderItems,
  discountCodes,
  elaneWomanPosts,
  lookbooks,
  productMedia,
  mediaAssets,
} from "@elane/db";
import { mediaPublicUrl, uploadMediaObject } from "../../lib/media-storage.js";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requireAnyPerm, requirePerm, revokeAllSessions } from "../../lib/session.js";
import { normalizeCountSeries } from "../../lib/customer-labels.js";
import { readStoreSettings, writeStoreSettings, type StoreSettingsInput } from "../../lib/store-settings.js";
import { env } from "../../env.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

export const adminOpsRoutes = new Hono<AppVars>();
adminOpsRoutes.use("/overview", requireAuth);
adminOpsRoutes.use("/staff", requireAuth);
adminOpsRoutes.use("/staff/*", requireAuth);
adminOpsRoutes.use("/roles", requireAuth);
adminOpsRoutes.use("/roles/*", requireAuth);
adminOpsRoutes.use("/permissions", requireAuth);
adminOpsRoutes.use("/settings/*", requireAuth);
adminOpsRoutes.use("/audit-logs", requireAuth);
adminOpsRoutes.use("/warehouses", requireAuth);

adminOpsRoutes.get("/overview", async (c) => {
  requireAnyPerm(c.get("user")!, ["dashboard.read", "product.read"]);
  const db = c.get("db");
  const [pub] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.status, "published"));
  const [draft] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.status, "draft"));
  const [low] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryBalances)
    .where(sql`${inventoryBalances.onHand} - ${inventoryBalances.reserved} <= ${inventoryBalances.reorderPoint}`);
  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryDocuments)
    .where(eq(inventoryDocuments.status, "draft"));
  const [custTotal] = await db.select({ count: sql<number>`count(*)::int` }).from(customers);

  const segRows = await db
    .select({ key: customers.segment, count: sql<number>`count(*)::int` })
    .from(customers)
    .groupBy(customers.segment);
  const statusRows = await db
    .select({ key: products.status, count: sql<number>`count(*)::int` })
    .from(products)
    .groupBy(products.status);
  const docTypeRows = await db
    .select({ key: inventoryDocuments.type, count: sql<number>`count(*)::int` })
    .from(inventoryDocuments)
    .groupBy(inventoryDocuments.type);

  const lowByCat = await db
    .select({
      category_name: categories.name,
      sku_count: sql<number>`count(*)::int`,
    })
    .from(inventoryBalances)
    .innerJoin(productVariants, eq(productVariants.id, inventoryBalances.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(categories, eq(categories.id, products.primaryCategoryId))
    .where(sql`${inventoryBalances.onHand} - ${inventoryBalances.reserved} <= ${inventoryBalances.reorderPoint}`)
    .groupBy(categories.id, categories.name)
    .orderBy(sql`count(*) desc`)
    .limit(8);

  const recentDocs = await db
    .select({
      id: inventoryDocuments.id,
      code: inventoryDocuments.code,
      type: inventoryDocuments.type,
      status: inventoryDocuments.status,
      created_at: inventoryDocuments.createdAt,
    })
    .from(inventoryDocuments)
    .orderBy(desc(inventoryDocuments.createdAt))
    .limit(5);

  // Orders, revenue & trends
  let totalRevenueVnd = 0;
  let totalOrders = 0;
  let pendingOrders = 0;
  let confirmedOrders = 0;
  let cancelledOrders = 0;
  let todayRevenueVnd = 0;
  let todayOrders = 0;
  let ordersByStatus: Array<{ status: string; count: number }> = [];
  let revenueByDay: Array<{ date: string; revenue: number; orders: number }> = [];
  let recentOrders: Array<{
    id: string;
    order_number: string;
    status: string;
    grand_total_vnd: number;
    payment_method: string;
    payment_status: string;
    fulfillment_status: string;
    placed_at: string;
    customer_name: string;
  }> = [];
  let topSellingProducts: Array<{ product_name: string; total_qty: number; total_amount: number }> = [];

  try {
    const [orderAgg] = await db
      .select({
        total_orders: sql<number>`count(*)::int`,
        total_revenue: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then ${orders.grandTotalVnd} else 0 end), 0)::bigint`,
        pending_orders: sql<number>`count(case when ${orders.status} = 'pending' then 1 end)::int`,
        confirmed_orders: sql<number>`count(case when ${orders.status} = 'confirmed' then 1 end)::int`,
        cancelled_orders: sql<number>`count(case when ${orders.status} = 'cancelled' then 1 end)::int`,
      })
      .from(orders);

    if (orderAgg) {
      totalOrders = Number(orderAgg.total_orders ?? 0);
      totalRevenueVnd = Number(orderAgg.total_revenue ?? 0);
      pendingOrders = Number(orderAgg.pending_orders ?? 0);
      confirmedOrders = Number(orderAgg.confirmed_orders ?? 0);
      cancelledOrders = Number(orderAgg.cancelled_orders ?? 0);
    }

    const [todayAgg] = await db
      .select({
        today_orders: sql<number>`count(*)::int`,
        today_revenue: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then ${orders.grandTotalVnd} else 0 end), 0)::bigint`,
      })
      .from(orders)
      .where(sql`${orders.placedAt} >= date_trunc('day', now())`);

    if (todayAgg) {
      todayOrders = Number(todayAgg.today_orders ?? 0);
      todayRevenueVnd = Number(todayAgg.today_revenue ?? 0);
    }

    const orderStatusAgg = await db
      .select({ key: orders.status, count: sql<number>`count(*)::int` })
      .from(orders)
      .groupBy(orders.status);
    ordersByStatus = orderStatusAgg.map((r) => ({ status: r.key, count: Number(r.count) }));

    const fromDate = c.req.query("from");
    const toDate = c.req.query("to");

    const dateCondition =
      fromDate && toDate
        ? sql`${orders.placedAt} >= ${fromDate}::date and ${orders.placedAt} <= (${toDate}::date + interval '1 day')`
        : sql`${orders.placedAt} >= now() - interval '30 days'`;

    const dailyAgg = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orders.placedAt}), 'YYYY-MM-DD')`,
        revenue: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then ${orders.grandTotalVnd} else 0 end), 0)::bigint`,
        orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(dateCondition)
      .groupBy(sql`date_trunc('day', ${orders.placedAt})`)
      .orderBy(sql`date_trunc('day', ${orders.placedAt}) asc`);

    revenueByDay = dailyAgg.map((r) => ({
      date: r.day,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
    }));

    const recentOrderRows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        grandTotalVnd: orders.grandTotalVnd,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        placedAt: orders.placedAt,
        customerName: sql<string>`coalesce(${customers.fullName}, ${orders.recipientSnapshot}->>'full_name', 'Khách vãng lai')`,
      })
      .from(orders)
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .orderBy(desc(orders.placedAt))
      .limit(6);

    recentOrders = recentOrderRows.map((r) => ({
      id: r.id,
      order_number: r.orderNumber,
      status: r.status,
      grand_total_vnd: Number(r.grandTotalVnd),
      payment_method: r.paymentMethod,
      payment_status: r.paymentStatus,
      fulfillment_status: r.fulfillmentStatus ?? "unfulfilled",
      placed_at: String(r.placedAt),
      customer_name: r.customerName,
    }));

    const topProductRows = await db
      .select({
        productName: orderItems.productName,
        totalQty: sql<number>`sum(${orderItems.qty})::int`,
        totalAmount: sql<number>`sum(${orderItems.lineTotalVnd})::bigint`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(sql`${orders.status} != 'cancelled'`)
      .groupBy(orderItems.productName)
      .orderBy(sql`sum(${orderItems.qty}) desc`)
      .limit(5);

    topSellingProducts = topProductRows.map((r) => ({
      product_name: r.productName,
      total_qty: Number(r.totalQty),
      total_amount: Number(r.totalAmount),
    }));
  } catch (err) {
    console.error("Failed to query order aggregates for overview:", err);
  }

  // 1. Total items sold
  let totalItemsSold = 0;
  try {
    const [itemSoldAgg] = await db
      .select({
        total_qty: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(sql`${orders.status} != 'cancelled'`);
    if (itemSoldAgg) totalItemsSold = Number(itemSoldAgg.total_qty ?? 0);
  } catch {
    // fallback
  }

  // 2. New customers in last 30 days
  let newCustomers = 0;
  try {
    const [newCustAgg] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(sql`${customers.createdAt} >= now() - interval '30 days'`);
    if (newCustAgg) newCustomers = Number(newCustAgg.count ?? 0);
  } catch {
    // fallback
  }

  // 3. Trends compared to prior 30 days
  let trends = { revenue: 0, orders: 0, customers: 0, items: 0 };
  try {
    const [priorPeriodAgg] = await db
      .select({
        prior_revenue: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then ${orders.grandTotalVnd} else 0 end), 0)::bigint`,
        prior_orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(sql`${orders.placedAt} >= now() - interval '60 days' and ${orders.placedAt} < now() - interval '30 days'`);

    const [currPeriodAgg] = await db
      .select({
        curr_revenue: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then ${orders.grandTotalVnd} else 0 end), 0)::bigint`,
        curr_orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(sql`${orders.placedAt} >= now() - interval '30 days'`);

    const [priorCustAgg] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(sql`${customers.createdAt} >= now() - interval '60 days' and ${customers.createdAt} < now() - interval '30 days'`);

    const [currItemsAgg] = await db
      .select({ total: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(sql`${orders.status} != 'cancelled' and ${orders.placedAt} >= now() - interval '30 days'`);

    const [priorItemsAgg] = await db
      .select({ total: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(sql`${orders.status} != 'cancelled' and ${orders.placedAt} >= now() - interval '60 days' and ${orders.placedAt} < now() - interval '30 days'`);

    const calcTrend = (curr: number, prior: number, fallback: number) => {
      if (prior > 0) return Math.round(((curr - prior) / prior) * 1000) / 10;
      if (curr > 0) return 100.0;
      return fallback;
    };

    trends = {
      revenue: calcTrend(Number(currPeriodAgg?.curr_revenue ?? 0), Number(priorPeriodAgg?.prior_revenue ?? 0), 0),
      orders: calcTrend(Number(currPeriodAgg?.curr_orders ?? 0), Number(priorPeriodAgg?.prior_orders ?? 0), 0),
      customers: calcTrend(newCustomers, Number(priorCustAgg?.count ?? 0), 0),
      items: calcTrend(Number(currItemsAgg?.total ?? 0), Number(priorItemsAgg?.total ?? 0), 0),
    };
  } catch {
    // fallback
  }

  // 4. Revenue by category
  let revenueByCategory: Array<{ name: string; percent: number }> = [];
  try {
    const catRevRows = await db
      .select({
        name: categories.name,
        total: sql<number>`coalesce(sum(${orderItems.lineTotalVnd}), 0)::bigint`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .innerJoin(categories, eq(categories.id, products.primaryCategoryId))
      .where(sql`${orders.status} != 'cancelled'`)
      .groupBy(categories.id, categories.name)
      .orderBy(sql`sum(${orderItems.lineTotalVnd}) desc`);

    const catTotalSum = catRevRows.reduce((acc, r) => acc + Number(r.total), 0);
    if (catTotalSum > 0) {
      revenueByCategory = catRevRows.map((r) => ({
        name: r.name,
        percent: Math.round((Number(r.total) / catTotalSum) * 1000) / 10,
      }));
    }
  } catch {
    // fallback
  }

  // 5. Top products
  let topProducts: Array<{
    id: string;
    name: string;
    sku: string;
    category: string;
    sold: number;
    revenue_vnd: number;
    image_url?: string | null;
  }> = [];
  try {
    const topDetailRows = await db
      .select({
        id: products.id,
        name: products.name,
        sku: sql<string>`coalesce(min(${productVariants.sku}), '')`,
        category: sql<string>`coalesce(${categories.name}, 'Khác')`,
        sold: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int`,
        revenue_vnd: sql<number>`coalesce(sum(${orderItems.lineTotalVnd}), 0)::bigint`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .leftJoin(categories, eq(categories.id, products.primaryCategoryId))
      .where(sql`${orders.status} != 'cancelled'`)
      .groupBy(products.id, products.name, categories.name)
      .orderBy(sql`sum(${orderItems.qty}) desc`)
      .limit(5);

    let productList = topDetailRows;

    if (productList.length === 0) {
      const publishedRows = await db
        .select({
          id: products.id,
          name: products.name,
          sku: sql<string>`coalesce(min(${productVariants.sku}), '')`,
          category: sql<string>`coalesce(${categories.name}, 'Khác')`,
          sold: sql<number>`0::int`,
          revenue_vnd: sql<number>`0::bigint`,
        })
        .from(products)
        .leftJoin(productVariants, eq(productVariants.productId, products.id))
        .leftJoin(categories, eq(categories.id, products.primaryCategoryId))
        .where(eq(products.status, "published"))
        .groupBy(products.id, products.name, categories.name)
        .limit(5);

      productList = publishedRows;
    }

    const pids = productList.map((p) => p.id);
    const coverMap = new Map<string, string>();
    if (pids.length > 0) {
      const covers = await db
        .select({
          productId: productMedia.productId,
          objectKey: mediaAssets.objectKey,
        })
        .from(productMedia)
        .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.assetId))
        .where(inArray(productMedia.productId, pids))
        .orderBy(desc(productMedia.isCover), productMedia.sortOrder);

      for (const cov of covers) {
        if (!coverMap.has(cov.productId)) {
          coverMap.set(cov.productId, mediaPublicUrl(cov.objectKey));
        }
      }
    }

    topProducts = productList.map((p, idx) => ({
      id: p.id,
      name: p.name,
      sku: p.sku || `ELN-${100 + idx}`,
      category: p.category,
      sold: Number(p.sold),
      revenue_vnd: Number(p.revenue_vnd),
      image_url: coverMap.get(p.id) ?? null,
    }));
  } catch (err) {
    console.error("Top products query failed:", err);
  }

  // Chưa có trường nguồn bán trong đơn hàng, vì vậy không suy đoán tỷ lệ kênh.
  const salesChannels: Array<{ key: string; name: string; percent: number; orders: number }> = [];

  // 7. Active promotions
  let activePromotions: Array<{
    id: string;
    name: string;
    description?: string | null;
    discount_label: string;
    start_at: string;
    end_at: string;
    status: string;
    image_url?: string | null;
  }> = [];
  try {
    const promoRows = await db
      .select({
        id: discountCodes.id,
        name: discountCodes.name,
        description: discountCodes.description,
        type: discountCodes.type,
        value: discountCodes.value,
        startsAt: discountCodes.startsAt,
        endsAt: discountCodes.endsAt,
        status: discountCodes.status,
        imageUrl: discountCodes.imageUrl,
      })
      .from(discountCodes)
      .where(eq(discountCodes.status, "active"))
      .orderBy(desc(discountCodes.createdAt))
      .limit(5);

    activePromotions = promoRows.map((p) => {
      let discount_label = `${p.value}%`;
      if (p.type === "fixed") discount_label = `${Number(p.value).toLocaleString("vi-VN")}₫`;
      else if (p.type === "free_shipping") discount_label = "Freeship";
      else if (p.type === "bxgy") discount_label = "Mua X tặng Y";

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        discount_label,
        start_at: p.startsAt ? p.startsAt.toISOString().slice(0, 10) : "",
        end_at: p.endsAt ? p.endsAt.toISOString().slice(0, 10) : "",
        status: p.status,
        image_url: p.imageUrl,
      };
    });
  } catch {
    // fallback
  }

  // 8. Recent ÉLANEwoman posts
  let recentPosts: Array<{ id: string; title: string; image_url?: string | null; views: number; status: string }> = [];
  try {
    const postRows = await db
      .select({
        id: elaneWomanPosts.id,
        title: elaneWomanPosts.title,
        imageUrl: elaneWomanPosts.imageUrl,
        status: elaneWomanPosts.status,
      })
      .from(elaneWomanPosts)
      .orderBy(desc(elaneWomanPosts.createdAt))
      .limit(5);

    recentPosts = postRows.map((p) => ({
      id: p.id,
      title: p.title || "Bài đăng ÉLANEwoman",
      image_url: p.imageUrl,
      views: 0,
      status: p.status,
    }));
  } catch {
    // fallback
  }

  // 9. Recent Lookbooks
  let recentLookbooks: Array<{
    id: string;
    title: string;
    season?: string | null;
    views: number;
    status: string;
    cover_image_url?: string | null;
  }> = [];
  try {
    const lbRows = await db
      .select({
        id: lookbooks.id,
        title: lookbooks.title,
        season: lookbooks.season,
        coverImageUrl: lookbooks.coverImageUrl,
        viewCount: lookbooks.viewCount,
        status: lookbooks.status,
      })
      .from(lookbooks)
      .orderBy(desc(lookbooks.createdAt))
      .limit(5);

    recentLookbooks = lbRows.map((l) => ({
      id: l.id,
      title: l.title,
      season: l.season,
      views: l.viewCount,
      status: l.status,
      cover_image_url: l.coverImageUrl,
    }));
  } catch {
    // fallback
  }

  return c.json({
    published_products: pub?.count ?? 0,
    draft_products: draft?.count ?? 0,
    low_stock_skus: low?.count ?? 0,
    pending_inventory_docs: pending?.count ?? 0,
    customer_total: custTotal?.count ?? 0,
    total_revenue_vnd: totalRevenueVnd,
    total_orders: totalOrders,
    pending_orders: pendingOrders,
    confirmed_orders: confirmedOrders,
    cancelled_orders: cancelledOrders,
    today_revenue_vnd: todayRevenueVnd,
    today_orders: todayOrders,
    orders_by_status: ordersByStatus,
    revenue_by_day: revenueByDay,
    recent_orders: recentOrders,
    top_selling_products: topSellingProducts,
    total_items_sold: totalItemsSold,
    new_customers: newCustomers,
    trends,
    revenue_by_category: revenueByCategory,
    top_products: topProducts,
    sales_channels: salesChannels,
    active_promotions: activePromotions,
    recent_posts: recentPosts,
    recent_lookbooks: recentLookbooks,
    customers_by_segment: normalizeCountSeries(
      segRows.map((r) => ({ key: r.key, count: Number(r.count) })),
      ["new", "loyal", "vip"],
    ).map(({ key, count }) => ({ segment: key, count })),
    products_by_status: normalizeCountSeries(
      statusRows.map((r) => ({ key: r.key, count: Number(r.count) })),
      ["draft", "published", "archived"],
    ).map(({ key, count }) => ({ status: key, count })),
    low_stock_by_category: lowByCat.map((r) => ({
      category_name: r.category_name,
      sku_count: Number(r.sku_count),
    })),
    inventory_docs_by_type: docTypeRows.map((r) => ({ type: r.key, count: Number(r.count) })),
    recent_inventory_docs: recentDocs,
  });
});

function validatePermissionDependencies(permissionCodes: string[]) {
  if (permissionCodes.includes("order.write") && !permissionCodes.includes("order.customer.read")) {
    throw new ApiError(
      400,
      "permission_dependency",
      "Quyền Tạo đơn hàng cần thêm quyền Tìm và chọn khách hàng khi tạo đơn",
    );
  }
}

adminOpsRoutes.get("/permissions", async (c) => {
  requirePerm(c.get("user")!, "role.manage");
  const rows = await c.get("db").select().from(permissions).orderBy(permissions.code);
  return c.json({ items: rows });
});

adminOpsRoutes.get("/roles", async (c) => {
  requireAnyPerm(c.get("user")!, ["role.manage", "staff.manage"]);
  const db = c.get("db");
  const [roleRows, memberRows, permissionRows] = await Promise.all([
    db.select().from(roles).orderBy(roles.name),
    db.select({ roleId: employeeRoleGrants.roleId, count: sql<number>`count(*)::int` }).from(employeeRoleGrants).groupBy(employeeRoleGrants.roleId),
    db.select({ roleId: rolePermissions.roleId, count: sql<number>`count(*)::int` }).from(rolePermissions).groupBy(rolePermissions.roleId),
  ]);
  const memberCount = new Map(memberRows.map((row) => [row.roleId, Number(row.count)]));
  const permissionCount = new Map(permissionRows.map((row) => [row.roleId, Number(row.count)]));
  return c.json({
    items: roleRows.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      is_system: role.isSystem,
      members: memberCount.get(role.id) ?? 0,
      permission_count: permissionCount.get(role.id) ?? 0,
      created_at: role.createdAt,
      updated_at: role.updatedAt,
    })),
  });
});

adminOpsRoutes.get("/roles/:id", async (c) => {
  requirePerm(c.get("user")!, "role.manage");
  const db = c.get("db");
  const role = (await db.select().from(roles).where(eq(roles.id, c.req.param("id"))).limit(1))[0];
  if (!role) throw new ApiError(404, "not_found", "Không tìm thấy vai trò");
  const [permissionRows, memberRows] = await Promise.all([
    db.select({ id: permissions.id, code: permissions.code, description: permissions.description }).from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId)).where(eq(rolePermissions.roleId, role.id)).orderBy(permissions.code),
    db.select({ id: employees.id, employee_code: employees.employeeCode, full_name: employees.fullName, avatar_url: employees.avatarUrl, work_email: employees.workEmail, status: employees.status, scope_type: employeeRoleGrants.scopeType, expires_at: employeeRoleGrants.expiresAt })
      .from(employeeRoleGrants).innerJoin(employees, eq(employees.id, employeeRoleGrants.employeeId)).where(eq(employeeRoleGrants.roleId, role.id)).orderBy(employees.fullName),
  ]);
  return c.json({
    role: { id: role.id, code: role.code, name: role.name, description: role.description, is_system: role.isSystem, created_at: role.createdAt, updated_at: role.updatedAt },
    permissions: permissionRows,
    members: memberRows,
  });
});

adminOpsRoutes.get("/roles/:id/available-members", async (c) => {
  requirePerm(c.get("user")!, "role.manage");
  const db = c.get("db");
  const role = (await db.select({ id: roles.id }).from(roles).where(eq(roles.id, c.req.param("id"))).limit(1))[0];
  if (!role) throw new ApiError(404, "not_found", "Không tìm thấy vai trò");

  const employeeRows = await db
    .select({ id: employees.id, full_name: employees.fullName, avatar_url: employees.avatarUrl, work_email: employees.workEmail, status: employees.status })
    .from(employees)
    .where(eq(employees.status, "active"))
    .orderBy(employees.fullName);
  const employeeIds = employeeRows.map((employee) => employee.id);
  if (!employeeIds.length) return c.json({ items: [] });

  const grantRows = await db
    .select({ employee_id: employeeRoleGrants.employeeId, role_id: roles.id, role_code: roles.code, role_name: roles.name })
    .from(employeeRoleGrants)
    .innerJoin(roles, eq(roles.id, employeeRoleGrants.roleId))
    .where(inArray(employeeRoleGrants.employeeId, employeeIds));
  const grantsByEmployee = new Map<string, typeof grantRows>();
  for (const grant of grantRows) {
    const current = grantsByEmployee.get(grant.employee_id) ?? [];
    current.push(grant);
    grantsByEmployee.set(grant.employee_id, current);
  }

  return c.json({
    items: employeeRows
      .filter((employee) => !(grantsByEmployee.get(employee.id) ?? []).some((grant) => grant.role_id === role.id))
      .map((employee) => ({
        ...employee,
        roles: (grantsByEmployee.get(employee.id) ?? []).map((grant) => ({ role_id: grant.role_id, role_code: grant.role_code, role_name: grant.role_name })),
      })),
  });
});

adminOpsRoutes.post("/roles/:id/members", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "role.manage");
  const body = z.object({ employee_ids: z.array(z.string().uuid()).min(1).max(100), scope_type: z.enum(["all", "warehouse", "store", "assigned"]).default("all") }).safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Danh sách nhân viên không hợp lệ");
  const db = c.get("db");
  const role = (await db.select({ id: roles.id, code: roles.code, name: roles.name }).from(roles).where(eq(roles.id, c.req.param("id"))).limit(1))[0];
  if (!role) throw new ApiError(404, "not_found", "Không tìm thấy vai trò");

  const employeeRows = await db
    .select({ id: employees.id, status: employees.status })
    .from(employees)
    .where(inArray(employees.id, body.data.employee_ids));
  if (employeeRows.length !== body.data.employee_ids.length) throw new ApiError(400, "validation_error", "Một hoặc nhiều nhân viên không tồn tại");
  if (employeeRows.some((employee) => employee.status !== "active")) throw new ApiError(400, "validation_error", "Chỉ có thể thêm nhân viên đang hoạt động");

  const existingRows = await db
    .select({ employee_id: employeeRoleGrants.employeeId })
    .from(employeeRoleGrants)
    .where(and(eq(employeeRoleGrants.roleId, role.id), inArray(employeeRoleGrants.employeeId, body.data.employee_ids)));
  const existingIds = new Set(existingRows.map((row) => row.employee_id));
  const addedIds = body.data.employee_ids.filter((employeeId) => !existingIds.has(employeeId));
  if (addedIds.length) {
    await db.transaction(async (tx) => {
      await tx.insert(employeeRoleGrants).values(addedIds.map((employeeId) => ({ employeeId, roleId: role.id, scopeType: body.data.scope_type })));
    });
  }
  await db.insert(auditLogs).values({ actorAccountId: user.accountId, action: "role.members.add", resourceType: "role", resourceId: role.id, beforeRedacted: { employee_ids: Array.from(existingIds) }, afterRedacted: { employee_ids: addedIds, scope_type: body.data.scope_type }, requestId: requestId(c) });
  return c.json({ ok: true, role_id: role.id, employee_ids: addedIds, added_count: addedIds.length });
});

adminOpsRoutes.post("/roles", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "role.manage");
  const body = z.object({
    code: z.string().trim().regex(/^[a-z][a-z0-9_]{2,48}$/),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(240).default(""),
    permission_codes: z.array(z.string()).default([]),
  }).safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu vai trò không hợp lệ");
  validatePermissionDependencies(body.data.permission_codes);
  const db = c.get("db");
  const duplicate = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, body.data.code)).limit(1);
  if (duplicate[0]) throw new ApiError(409, "conflict", "Mã vai trò đã tồn tại");
  const permissionRows = body.data.permission_codes.length
    ? await db.select({ id: permissions.id, code: permissions.code }).from(permissions).where(inArray(permissions.code, body.data.permission_codes))
    : [];
  if (permissionRows.length !== body.data.permission_codes.length) throw new ApiError(400, "validation_error", "Một hoặc nhiều quyền không tồn tại");
  const [role] = await db.insert(roles).values({ code: body.data.code, name: body.data.name, description: body.data.description, isSystem: false }).returning();
  if (!role) throw new ApiError(500, "create_failed", "Không tạo được vai trò");
  if (permissionRows.length) await db.insert(rolePermissions).values(permissionRows.map((permission) => ({ roleId: role.id, permissionId: permission.id })));
  await db.insert(auditLogs).values({ actorAccountId: user.accountId, action: "role.create", resourceType: "role", resourceId: role.id, afterRedacted: { code: role.code, name: role.name, description: role.description, permission_codes: body.data.permission_codes }, requestId: requestId(c) });
  return c.json({ id: role.id, code: role.code, name: role.name, description: role.description, is_system: role.isSystem, created_at: role.createdAt, updated_at: role.updatedAt }, 201);
});

adminOpsRoutes.patch("/roles/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "role.manage");
  const body = z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(240),
  }).safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Tên hoặc mô tả vai trò không hợp lệ");

  const db = c.get("db");
  const role = (await db.select().from(roles).where(eq(roles.id, c.req.param("id"))).limit(1))[0];
  if (!role) throw new ApiError(404, "not_found", "Không tìm thấy vai trò");

  const [updatedRole] = await db.update(roles)
    .set({ name: body.data.name, description: body.data.description, updatedAt: new Date() })
    .where(eq(roles.id, role.id))
    .returning();
  if (!updatedRole) throw new ApiError(500, "update_failed", "Không cập nhật được vai trò");

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "role.update",
    resourceType: "role",
    resourceId: role.id,
    beforeRedacted: { name: role.name, description: role.description },
    afterRedacted: { name: updatedRole.name, description: updatedRole.description },
    requestId: requestId(c),
  });

  return c.json({
    ok: true,
    role: {
      id: updatedRole.id,
      code: updatedRole.code,
      name: updatedRole.name,
      description: updatedRole.description,
      is_system: updatedRole.isSystem,
      created_at: updatedRole.createdAt,
      updated_at: updatedRole.updatedAt,
    },
  });
});

adminOpsRoutes.delete("/roles/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "role.manage");
  const roleId = c.req.param("id");
  const db = c.get("db");

  await db.transaction(async (tx) => {
    const role = (await tx.select().from(roles).where(eq(roles.id, roleId)).limit(1).for("update"))[0];
    if (!role) throw new ApiError(404, "not_found", "Không tìm thấy vai trò");
    if (role.isSystem) throw new ApiError(409, "system_role", "Không thể xóa vai trò hệ thống");

    const [memberCountRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(employeeRoleGrants)
      .where(eq(employeeRoleGrants.roleId, role.id));
    const memberCount = Number(memberCountRow?.count ?? 0);
    if (memberCount > 0) {
      throw new ApiError(409, "role_has_members", "Hãy gỡ tất cả nhân viên khỏi vai trò trước khi xóa");
    }

    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    await tx.delete(roles).where(eq(roles.id, role.id));
    await tx.insert(auditLogs).values({
      actorAccountId: user.accountId,
      action: "role.delete",
      resourceType: "role",
      resourceId: role.id,
      beforeRedacted: { code: role.code, name: role.name, description: role.description },
      afterRedacted: null,
      requestId: requestId(c),
    });
  });

  return c.json({ ok: true, role_id: roleId });
});

adminOpsRoutes.patch("/roles/:id/permissions", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "role.manage");
  const body = z.object({ permission_codes: z.array(z.string()).max(200) }).safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Danh sách quyền không hợp lệ");
  validatePermissionDependencies(body.data.permission_codes);
  const db = c.get("db");
  const role = (await db.select().from(roles).where(eq(roles.id, c.req.param("id"))).limit(1))[0];
  if (!role) throw new ApiError(404, "not_found", "Không tìm thấy vai trò");
  const permissionRows = body.data.permission_codes.length
    ? await db.select({ id: permissions.id, code: permissions.code }).from(permissions).where(inArray(permissions.code, body.data.permission_codes))
    : [];
  if (permissionRows.length !== body.data.permission_codes.length) throw new ApiError(400, "validation_error", "Một hoặc nhiều quyền không tồn tại");
  const previous = await db.select({ code: permissions.code }).from(rolePermissions).innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId)).where(eq(rolePermissions.roleId, role.id));
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    if (permissionRows.length) await tx.insert(rolePermissions).values(permissionRows.map((permission) => ({ roleId: role.id, permissionId: permission.id })));
  });
  await db.insert(auditLogs).values({ actorAccountId: user.accountId, action: "role.permissions.update", resourceType: "role", resourceId: role.id, beforeRedacted: { permission_codes: previous.map((item) => item.code) }, afterRedacted: { permission_codes: body.data.permission_codes }, requestId: requestId(c) });
  return c.json({ ok: true, role_id: role.id, permission_codes: body.data.permission_codes });
});

adminOpsRoutes.patch("/staff/:id/roles", async (c) => {
  const user = c.get("user")!;
  requireAnyPerm(user, ["role.manage", "staff.manage"]);
  const body = z.object({ role_codes: z.array(z.string()).min(1).max(20), scope_type: z.enum(["all", "warehouse", "store", "assigned"]).default("all") }).safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu phân vai trò không hợp lệ");
  const db = c.get("db");
  const employee = (await db.select().from(employees).where(eq(employees.id, c.req.param("id"))).limit(1))[0];
  if (!employee) throw new ApiError(404, "not_found", "Không tìm thấy nhân viên");
  const roleRows = await db.select({ id: roles.id, code: roles.code }).from(roles).where(inArray(roles.code, body.data.role_codes));
  if (roleRows.length !== body.data.role_codes.length) throw new ApiError(400, "validation_error", "Một hoặc nhiều vai trò không tồn tại");
  const previous = await db.select({ code: roles.code }).from(employeeRoleGrants).innerJoin(roles, eq(roles.id, employeeRoleGrants.roleId)).where(eq(employeeRoleGrants.employeeId, employee.id));
  await db.transaction(async (tx) => {
    await tx.delete(employeeRoleGrants).where(eq(employeeRoleGrants.employeeId, employee.id));
    await tx.insert(employeeRoleGrants).values(roleRows.map((role) => ({ employeeId: employee.id, roleId: role.id, scopeType: body.data.scope_type })));
  });
  await db.insert(auditLogs).values({ actorAccountId: user.accountId, action: "staff.roles.update", resourceType: "employee", resourceId: employee.id, beforeRedacted: { role_codes: previous.map((item) => item.code) }, afterRedacted: { role_codes: body.data.role_codes, scope_type: body.data.scope_type }, requestId: requestId(c) });
  return c.json({ ok: true, employee_id: employee.id, role_codes: body.data.role_codes, scope_type: body.data.scope_type });
});

adminOpsRoutes.get("/staff", async (c) => {
  requirePerm(c.get("user")!, "staff.manage");
  const db = c.get("db");
  const rows = await db
    .select({
      id: employees.id,
      employee_code: employees.employeeCode,
      full_name: employees.fullName,
      avatar_url: employees.avatarUrl,
      work_email: employees.workEmail,
      phone: employees.phone,
      job_title: employees.jobTitle,
      notes: employees.notes,
      joined_on: employees.joinedOn,
      status: employees.status,
      account_id: employees.accountId,
      account_status: accounts.status,
      last_login_at: accounts.lastLoginAt,
    })
    .from(employees)
    .leftJoin(accounts, eq(accounts.id, employees.accountId));
  const employeeIds = rows.map((row) => row.id);
  const grantRows = employeeIds.length
    ? await db
        .select({ employee_id: employeeRoleGrants.employeeId, role_id: roles.id, role_code: roles.code, role_name: roles.name, scope_type: employeeRoleGrants.scopeType })
        .from(employeeRoleGrants)
        .innerJoin(roles, eq(roles.id, employeeRoleGrants.roleId))
        .where(inArray(employeeRoleGrants.employeeId, employeeIds))
    : [];
  const grantsByEmployee = new Map<string, typeof grantRows>();
  for (const grant of grantRows) {
    const current = grantsByEmployee.get(grant.employee_id) ?? [];
    current.push(grant);
    grantsByEmployee.set(grant.employee_id, current);
  }
  return c.json({
    items: rows.map((row) => ({
      ...row,
      roles: grantsByEmployee.get(row.id) ?? [],
      role: grantsByEmployee.get(row.id)?.[0] ?? null,
    })),
  });
});

adminOpsRoutes.post("/staff/avatar-upload", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "staff.manage");
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!file || typeof file === "string") throw new ApiError(400, "validation_error", "Thiếu file ảnh (field: file)");
  const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const mime = file.type || "application/octet-stream";
  if (!allowedMime.has(mime)) throw new ApiError(400, "invalid_mime", "Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > 2 * 1024 * 1024) throw new ApiError(400, "file_too_large", "Ảnh tối đa 2MB");
  if (buffer.byteLength < 32) throw new ApiError(400, "validation_error", "File ảnh không hợp lệ");
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const objectKey = `staff-avatars/${randomUUID()}.${ext}`;
  await uploadMediaObject(objectKey, buffer, mime);
  return c.json({ url: mediaPublicUrl(objectKey), object_key: objectKey }, 201);
});

adminOpsRoutes.post("/staff", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "staff.manage");
  const body = z.object({
    full_name: z.string().trim().min(2).max(120),
    work_email: z.string().trim().email().max(160),
    phone: z.string().trim().max(30).optional(),
    job_title: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional(),
    avatar_url: z.string().trim().min(1).nullable().optional(),
    role_code: z.string().trim().min(1).max(80),
    password: z.string().min(8).max(120).default("Trang1234@"),
  }).safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Thông tin nhân viên không hợp lệ");
  const db = c.get("db");
  const email = body.data.work_email.toLowerCase();
  const [existingAccount] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, email)).limit(1);
  if (existingAccount) throw new ApiError(409, "conflict", "Email nhân viên đã tồn tại");
  const [role] = await db.select({ id: roles.id, code: roles.code }).from(roles).where(eq(roles.code, body.data.role_code)).limit(1);
  if (!role) throw new ApiError(400, "validation_error", "Vai trò không tồn tại");

  const [lastEmployee] = await db.select({ employeeCode: employees.employeeCode }).from(employees).orderBy(desc(employees.createdAt)).limit(1);
  const lastNumber = Number(lastEmployee?.employeeCode?.match(/(\d+)$/)?.[1] ?? 0);
  const employeeCode = `ELN${String(lastNumber + 1).padStart(3, "0")}`;
  const passwordHash = await bcrypt.hash(body.data.password, 10);
  const created = await db.transaction(async (tx) => {
    const [account] = await tx.insert(accounts).values({ authSubject: `email:${email}`, email, passwordHash, status: "active" }).returning({ id: accounts.id });
    if (!account) throw new ApiError(500, "create_failed", "Không thể tạo tài khoản nhân viên");
    const [employee] = await tx.insert(employees).values({ accountId: account.id, employeeCode, fullName: body.data.full_name, avatarUrl: body.data.avatar_url ?? null, workEmail: email, phone: body.data.phone ?? null, jobTitle: body.data.job_title ?? null, notes: body.data.notes ?? null, status: "active" }).returning({ id: employees.id, employeeCode: employees.employeeCode });
    if (!employee) throw new ApiError(500, "create_failed", "Không thể tạo hồ sơ nhân viên");
    await tx.insert(employeeRoleGrants).values({ employeeId: employee.id, roleId: role.id, scopeType: "all" });
    return employee;
  });
  await db.insert(auditLogs).values({ actorAccountId: user.accountId, action: "staff.create", resourceType: "employee", resourceId: created.id, beforeRedacted: null, afterRedacted: { employee_code: created.employeeCode, work_email: email, role_code: role.code }, requestId: requestId(c) });
  return c.json({ id: created.id, employee_code: created.employeeCode }, 201);
});

adminOpsRoutes.patch("/staff/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "staff.manage");
  const body = z.object({ status: z.enum(["active", "locked", "left"]) }).safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "status không hợp lệ");
  const db = c.get("db");
  const emp = await db.select().from(employees).where(eq(employees.id, c.req.param("id"))).limit(1);
  if (!emp[0]) throw new ApiError(404, "not_found", "Không tìm thấy nhân viên");
  await db.update(employees).set({ status: body.data.status, updatedAt: new Date() }).where(eq(employees.id, emp[0].id));
  if (emp[0].accountId && (body.data.status === "locked" || body.data.status === "left")) {
    await db.update(accounts).set({ status: "locked", updatedAt: new Date() }).where(eq(accounts.id, emp[0].accountId));
    await revokeAllSessions(db, emp[0].accountId);
  } else if (emp[0].accountId && body.data.status === "active") {
    await db.update(accounts).set({ status: "active", updatedAt: new Date() }).where(eq(accounts.id, emp[0].accountId));
  }
  await db.insert(auditLogs).values({ actorAccountId: user.accountId, action: "staff.status.update", resourceType: "employee", resourceId: emp[0].id, beforeRedacted: { status: emp[0].status }, afterRedacted: { status: body.data.status }, requestId: requestId(c) });
  return c.json({ ok: true });
});

adminOpsRoutes.patch("/staff/:id/profile", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "staff.manage");
  const body = z.object({
    full_name: z.string().trim().min(2).max(120),
    work_email: z.string().trim().email().max(160),
    phone: z.string().trim().max(30).nullable().optional(),
    job_title: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    avatar_url: z.string().trim().min(1).nullable().optional(),
  }).safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Thông tin nhân viên không hợp lệ");
  const db = c.get("db");
  const employee = (await db.select().from(employees).where(eq(employees.id, c.req.param("id"))).limit(1))[0];
  if (!employee) throw new ApiError(404, "not_found", "Không tìm thấy nhân viên");
  const email = body.data.work_email.toLowerCase();
  if (employee.accountId) {
    const duplicate = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.email, email), sql`${accounts.id} <> ${employee.accountId}`)).limit(1);
    if (duplicate[0]) throw new ApiError(409, "conflict", "Email nhân viên đã tồn tại");
  }
  const previous = { full_name: employee.fullName, work_email: employee.workEmail, phone: employee.phone, job_title: employee.jobTitle, notes: employee.notes, avatar_url: employee.avatarUrl };
  await db.transaction(async (tx) => {
    await tx.update(employees).set({ fullName: body.data.full_name, workEmail: email, phone: body.data.phone ?? null, jobTitle: body.data.job_title ?? null, notes: body.data.notes ?? null, avatarUrl: body.data.avatar_url === undefined ? employee.avatarUrl : body.data.avatar_url, updatedAt: new Date() }).where(eq(employees.id, employee.id));
    if (employee.accountId) await tx.update(accounts).set({ email, updatedAt: new Date() }).where(eq(accounts.id, employee.accountId));
  });
  await db.insert(auditLogs).values({ actorAccountId: user.accountId, action: "staff.profile.update", resourceType: "employee", resourceId: employee.id, beforeRedacted: previous, afterRedacted: { full_name: body.data.full_name, work_email: email, phone: body.data.phone ?? null, job_title: body.data.job_title ?? null, notes: body.data.notes ?? null, avatar_url: body.data.avatar_url ?? employee.avatarUrl }, requestId: requestId(c) });
  return c.json({ ok: true, employee_id: employee.id });
});

adminOpsRoutes.post("/staff/:id/reset-password", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "staff.manage");
  const body = z.object({ password: z.string().min(8).max(120).default("Trang1234@") }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw new ApiError(400, "validation_error", "Mật khẩu không hợp lệ");
  const db = c.get("db");
  const employee = (await db.select({ id: employees.id, accountId: employees.accountId }).from(employees).where(eq(employees.id, c.req.param("id"))).limit(1))[0];
  if (!employee) throw new ApiError(404, "not_found", "Không tìm thấy nhân viên");
  if (!employee.accountId) throw new ApiError(400, "validation_error", "Nhân viên chưa có tài khoản đăng nhập");
  await db.update(accounts).set({ passwordHash: await bcrypt.hash(body.data.password, 10), updatedAt: new Date() }).where(eq(accounts.id, employee.accountId));
  await revokeAllSessions(db, employee.accountId);
  await db.insert(auditLogs).values({ actorAccountId: user.accountId, action: "staff.password.reset", resourceType: "employee", resourceId: employee.id, beforeRedacted: null, afterRedacted: { reset: true }, requestId: requestId(c) });
  return c.json({ ok: true, employee_id: employee.id });
});

adminOpsRoutes.get("/settings/brand", async (c) => {
  requirePerm(c.get("user")!, "settings.read");
  const rows = await c.get("db").select().from(settings).where(eq(settings.key, "brand")).limit(1);
  return c.json({ value: rows[0]?.value ?? {} });
});

adminOpsRoutes.patch("/settings/brand", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "settings.write");
  const body = z.record(z.unknown()).safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "JSON không hợp lệ");
  const db = c.get("db");
  const existing = await db.select().from(settings).where(eq(settings.key, "brand")).limit(1);
  if (existing[0]) {
    await db
      .update(settings)
      .set({ value: body.data, updatedBy: user.accountId, updatedAt: new Date() })
      .where(eq(settings.key, "brand"));
  } else {
    await db.insert(settings).values({ key: "brand", value: body.data, visibility: "public", updatedBy: user.accountId });
  }
  return c.json({ ok: true });
});

const storeSettingsSchema = z.object({
  brand: z.object({
    name: z.string().trim().min(1).max(80),
    tagline: z.string().trim().max(160),
    supportEmail: z.string().trim().email().max(254),
    supportPhone: z.string().trim().min(6).max(30),
  }),
  payments: z.object({ codEnabled: z.boolean(), bankEnabled: z.boolean() })
    .refine((value) => value.codEnabled || value.bankEnabled, "Cần bật ít nhất một phương thức thanh toán"),
  shipping: z.object({
    freeShippingFromVnd: z.number().int().min(0).max(100_000_000),
    feeVnd: z.number().int().min(0).max(5_000_000),
    cityDeliveryDays: z.string().trim().min(1).max(100),
    otherDeliveryDays: z.string().trim().min(1).max(100),
  }),
  returns: z.object({
    returnWindowDays: z.number().int().min(1).max(180),
    refundWindow: z.string().trim().min(1).max(100),
    conditions: z.string().trim().min(10).max(3000),
  }),
  notifications: z.object({ newOrder: z.boolean(), paymentSuccess: z.boolean(), lowStock: z.boolean() }),
});

adminOpsRoutes.get("/settings/storefront", async (c) => {
  requirePerm(c.get("user")!, "settings.read");
  const value = await readStoreSettings(
    c.get("db"),
    Boolean(env.sepayBankAccount && env.sepayBankBin),
  );
  return c.json({ value });
});

adminOpsRoutes.patch("/settings/storefront", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "settings.write");
  const body = storeSettingsSchema.safeParse(await c.req.json());
  if (!body.success) {
    throw new ApiError(400, "validation_error", body.error.issues[0]?.message ?? "Cấu hình cửa hàng không hợp lệ");
  }

  const db = c.get("db");
  const bankTransferConfigured = Boolean(env.sepayBankAccount && env.sepayBankBin);
  const before = await readStoreSettings(db, bankTransferConfigured);
  if (!bankTransferConfigured && !before.payments.bankEnabled && body.data.payments.bankEnabled) {
    throw new ApiError(400, "payment_not_configured", "Cần cấu hình tài khoản SePay trên máy chủ trước khi bật VietQR");
  }

  const value = body.data as StoreSettingsInput;
  await writeStoreSettings(db, user.accountId, value);
  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "settings.storefront.update",
    resourceType: "settings",
    resourceId: "storefront",
    beforeRedacted: before,
    afterRedacted: { ...value, bankTransferConfigured },
    requestId: requestId(c),
  });

  const saved = await readStoreSettings(db, bankTransferConfigured);
  return c.json({ ok: true, value: saved });
});

adminOpsRoutes.get("/notifications", async (c) => {
  const user = c.get("user")!;
  const canReadOrders = user.permissions.includes("*") || user.permissions.includes("order.read");
  const canReadInventory = user.permissions.includes("*") || user.permissions.includes("inventory.read");
  if (!canReadOrders && !canReadInventory) {
    throw new ApiError(403, "forbidden", "Bạn không có quyền xem thông báo vận hành");
  }

  const db = c.get("db");
  const config = await readStoreSettings(db, Boolean(env.sepayBankAccount && env.sepayBankBin));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const items: Array<{ id: string; kind: "new_order" | "payment_success" | "low_stock"; title: string; message: string; created_at: string; order_number?: string }> = [];

  if (canReadOrders && config.notifications.newOrder) {
    const recentOrders = await db.select({ id: orders.id, orderNumber: orders.orderNumber, placedAt: orders.placedAt, paidAt: orders.paidAt })
      .from(orders).where(gte(orders.placedAt, since)).orderBy(desc(orders.placedAt)).limit(12);
    for (const order of recentOrders) {
      items.push({ id: `order:${order.id}`, kind: "new_order", title: "Đơn hàng mới", message: `Đơn #${order.orderNumber} vừa được tạo.`, created_at: order.placedAt.toISOString(), order_number: order.orderNumber });
    }
  }

  if (canReadOrders && config.notifications.paymentSuccess) {
    const recentPayments = await db.select({ id: orders.id, orderNumber: orders.orderNumber, paidAt: orders.paidAt })
      .from(orders).where(gte(orders.paidAt, since)).orderBy(desc(orders.paidAt)).limit(12);
    for (const order of recentPayments) {
      if (!order.paidAt) continue;
      items.push({ id: `payment:${order.id}`, kind: "payment_success", title: "Đã nhận thanh toán", message: `Đơn #${order.orderNumber} đã được xác nhận thanh toán.`, created_at: order.paidAt.toISOString(), order_number: order.orderNumber });
    }
  }

  if (canReadInventory && config.notifications.lowStock) {
    const lowStock = await db.select({ variantId: inventoryBalances.variantId, available: sql<number>`${inventoryBalances.onHand} - ${inventoryBalances.reserved}`, sku: productVariants.sku, productName: products.name, updatedAt: inventoryBalances.updatedAt })
      .from(inventoryBalances)
      .innerJoin(productVariants, eq(productVariants.id, inventoryBalances.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(sql`${inventoryBalances.onHand} - ${inventoryBalances.reserved} <= ${inventoryBalances.reorderPoint}`)
      .orderBy(desc(inventoryBalances.updatedAt)).limit(12);
    for (const item of lowStock) {
      items.push({ id: `stock:${item.variantId}:${item.available}`, kind: "low_stock", title: "SKU sắp hết hàng", message: `${item.productName} · ${item.sku} còn ${Math.max(0, Number(item.available))} sản phẩm.`, created_at: item.updatedAt.toISOString() });
    }
  }

  items.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return c.json({ items: items.slice(0, 20) });
});

adminOpsRoutes.get("/audit-logs", async (c) => {
  requirePerm(c.get("user")!, "audit.read");
  const rows = await c
    .get("db")
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.occurredAt))
    .limit(100);
  return c.json({ items: rows });
});

adminOpsRoutes.get("/warehouses", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const rows = await c.get("db").select().from(warehouses);
  return c.json({ items: rows });
});

