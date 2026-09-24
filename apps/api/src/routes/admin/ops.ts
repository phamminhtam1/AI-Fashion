import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  products,
  inventoryBalances,
  inventoryDocuments,
  employees,
  accounts,
  employeeRoleGrants,
  roles,
  auditLogs,
  settings,
  warehouses,
  customers,
  productVariants,
  categories,
} from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
import { requirePerm, revokeAllSessions } from "../../lib/session.js";
import { normalizeCountSeries } from "../../lib/customer-labels.js";
import { z } from "zod";

export const adminOpsRoutes = new Hono<AppVars>();
adminOpsRoutes.use("*", requireAuth);

adminOpsRoutes.get("/overview", async (c) => {
  requirePerm(c.get("user")!, "product.read");
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

  return c.json({
    published_products: pub?.count ?? 0,
    draft_products: draft?.count ?? 0,
    low_stock_skus: low?.count ?? 0,
    pending_inventory_docs: pending?.count ?? 0,
    customer_total: custTotal?.count ?? 0,
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

adminOpsRoutes.get("/staff", async (c) => {
  requirePerm(c.get("user")!, "staff.manage");
  const db = c.get("db");
  const rows = await db
    .select({
      id: employees.id,
      employee_code: employees.employeeCode,
      full_name: employees.fullName,
      work_email: employees.workEmail,
      status: employees.status,
      account_id: employees.accountId,
      account_status: accounts.status,
    })
    .from(employees)
    .leftJoin(accounts, eq(accounts.id, employees.accountId));
  return c.json({ items: rows });
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
  }
  return c.json({ ok: true });
});

adminOpsRoutes.get("/settings/brand", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const rows = await c.get("db").select().from(settings).where(eq(settings.key, "brand")).limit(1);
  return c.json({ value: rows[0]?.value ?? {} });
});

adminOpsRoutes.patch("/settings/brand", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "content.publish");
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
