import { Hono } from "hono";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { customers, customerAddresses, auditLogs } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";

export const adminCustomerRoutes = new Hono<AppVars>();
adminCustomerRoutes.use("*", requireAuth);

const statusEnum = z.enum(["active", "blocked"]);

function mapCustomer(
  row: typeof customers.$inferSelect,
  extras?: { address_count?: number; default_address?: string | null },
) {
  return {
    id: row.id,
    full_name: row.fullName,
    email: row.email,
    phone: row.phone,
    segment: row.segment,
    status: row.status,
    total_spent_vnd: row.totalSpentVnd ?? 0,
    internal_note: row.internalNote,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    ...(extras?.address_count !== undefined ? { address_count: extras.address_count } : {}),
    ...(extras?.default_address !== undefined ? { default_address: extras.default_address } : {}),
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

  const conds = [];
  if (segment) conds.push(eq(customers.segment, segment));
  if (status) conds.push(eq(customers.status, status));
  if (q) {
    const like = `%${q}%`;
    conds.push(
      or(ilike(customers.fullName, like), ilike(customers.phone, like), ilike(customers.email, like))!,
    );
  }

  const rows = await db
    .select({
      customer: customers,
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
    })
    .from(customers)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(customers.createdAt))
    .limit(500);

  return c.json({
    items: rows.map((r) =>
      mapCustomer(r.customer, {
        address_count: Number(r.address_count ?? 0),
        default_address: r.default_address || null,
      }),
    ),
  });
});

adminCustomerRoutes.get("/:id", async (c) => {
  requirePerm(c.get("user")!, "customer.read");
  const db = c.get("db");
  const row = (await db.select().from(customers).where(eq(customers.id, c.req.param("id"))).limit(1))[0];
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy khách hàng");
  const addresses = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, row.id))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));
  return c.json({
    ...mapCustomer(row),
    addresses: addresses.map(mapAddress),
    // Module đơn hàng chưa có schema — trả mảng rỗng để admin UI sẵn chỗ hiển thị.
    orders: [] as Array<{
      id: string;
      order_number: string;
      status: string;
      grand_total_vnd: number;
      placed_at: string;
    }>,
  });
});

adminCustomerRoutes.patch("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "customer.write");
  // Admin chỉ khóa / mở hoạt động; hồ sơ & địa chỉ do phía khách quản lý.
  const body = z.object({ status: statusEnum }).safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Chỉ được cập nhật trạng thái");

  const db = c.get("db");
  const existing = (await db.select().from(customers).where(eq(customers.id, c.req.param("id"))).limit(1))[0];
  if (!existing) throw new ApiError(404, "not_found", "Không tìm thấy khách hàng");

  const [row] = await db
    .update(customers)
    .set({ status: body.data.status, updatedAt: new Date() })
    .where(eq(customers.id, existing.id))
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "customer.update",
    resourceType: "customer",
    resourceId: row!.id,
    beforeRedacted: { status: existing.status },
    afterRedacted: { status: row!.status },
    requestId: requestId(c),
  });

  return c.json(mapCustomer(row!));
});

adminCustomerRoutes.post("/", async (c) => {
  throw new ApiError(403, "forbidden", "Không thể tạo khách hàng từ admin — dữ liệu đến từ phía khách");
});

adminCustomerRoutes.post("/:id/addresses", async (c) => {
  throw new ApiError(403, "forbidden", "Không thể thêm địa chỉ từ admin");
});

adminCustomerRoutes.patch("/:id/addresses/:aid", async (c) => {
  throw new ApiError(403, "forbidden", "Không thể sửa địa chỉ từ admin");
});

adminCustomerRoutes.delete("/:id/addresses/:aid", async (c) => {
  throw new ApiError(403, "forbidden", "Không thể xóa địa chỉ từ admin");
});
