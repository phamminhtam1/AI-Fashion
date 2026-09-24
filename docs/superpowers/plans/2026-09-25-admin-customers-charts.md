# Admin Customers + Operational Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real admin Khách hàng (CRUD + addresses + manual segments) and Tổng quan/customer charts fed by catalog, inventory, and customer counts — no orders/revenue.

**Architecture:** Add `customers` / `customer_addresses` to Drizzle schema + migration. Admin Hono routes for CRUD. Extend `GET /admin/overview` with series for charts. `CustomersManager` replaces mock ModulePage; Dashboard swaps fake KPIs/charts for API data. Pure helpers for segment labels + chart normalization with unit tests.

**Tech Stack:** Drizzle + Postgres, Hono, React admin (existing UI primitives), CSS/SVG bars (no new chart lib), `tsx --test`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-25-admin-customers-charts-design.md`
- Segments: `new` | `loyal` | `vip` | `care` only (manual)
- Status: `active` | `blocked`; no hard-delete customer
- No orders, revenue, customer auth, wishlist
- Charts: no recharts/chart.js — CSS bars / simple SVG
- Vietnamese UI copy
- Commits: only when human asks; skip commit steps unless told
- After UI/API changes: `docker compose up --build -d api admin`

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/db/src/schema.ts` | `customers`, `customer_addresses` tables |
| `packages/db/drizzle/0001_*.sql` | Generated migration |
| `packages/db/src/seed.ts` | PERMS + sample customers; ensure helpers when seed already applied |
| `apps/api/src/lib/customer-labels.ts` | Segment/status Vietnamese labels + chart normalize |
| `apps/api/src/lib/customer-labels.test.ts` | Unit tests |
| `apps/api/src/routes/admin/customers.ts` | Customer + address CRUD |
| `apps/api/src/index.ts` | Mount routes |
| `apps/api/src/routes/admin/ops.ts` | Extended overview payload |
| `apps/admin/src/lib/api.ts` | Types + client methods |
| `apps/admin/src/components/CustomersManager.tsx` | List/form + segment chart |
| `apps/admin/src/routes/index.tsx` | Wire customers; real Dashboard metrics/charts |

---

### Task 1: Schema + migration

**Files:**
- Modify: `packages/db/src/schema.ts`
- Generate: `packages/db/drizzle/0001_*.sql` via drizzle-kit

**Interfaces:**
- Produces Drizzle tables:

```ts
export const customers = pgTable("customers", {
  id: id(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  segment: text("segment").notNull().default("new"), // new|loyal|vip|care
  status: text("status").notNull().default("active"), // active|blocked
  internalNote: text("internal_note").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const customerAddresses = pgTable("customer_addresses", {
  id: id(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  recipientName: text("recipient_name").notNull(),
  phone: text("phone").notNull(),
  addressLine: text("address_line").notNull(),
  administrativeUnits: jsonb("administrative_units").$type<Record<string, string>>().notNull().default({}),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
});
```

- [ ] **Step 1: Append tables to `schema.ts`** (after inventory / before CMS section is fine)

- [ ] **Step 2: Generate migration**

Run from repo root:

```bash
npm run generate -w @elane/db
```

Expected: new file under `packages/db/drizzle/` and journal update.

- [ ] **Step 3: Apply migration**

```bash
docker compose up --build -d api
# or: npm run migrate -w @elane/db with DATABASE_URL
```

Expected: migrate log shows new migration applied; no error on API start.

- [ ] **Step 4: Commit** (skip unless user asks)

---

### Task 2: Permissions + seed customers

**Files:**
- Modify: `packages/db/src/seed.ts`

**Interfaces:**
- Consumes: `customers`, `customerAddresses` from schema
- Produces: perms `customer.read`, `customer.write`; sample customers when DB empty or via ensure helpers

- [ ] **Step 1: Add to `PERMS` array**

```ts
["customer.read", "Xem khách hàng"],
["customer.write", "Sửa khách hàng"],
```

- [ ] **Step 2: Add `ensureCustomerModule()` called when admin already exists**

```ts
async function ensureCustomerModule() {
  // insert permissions if missing
  for (const [code, description] of [
    ["customer.read", "Xem khách hàng"],
    ["customer.write", "Sửa khách hàng"],
  ] as const) {
    const found = await db.select().from(s.permissions).where(eq(s.permissions.code, code)).limit(1);
    if (!found[0]) {
      const [p] = await db.insert(s.permissions).values({ code, description }).returning();
      const roles = await db.select().from(s.roles);
      for (const r of roles) {
        await db.insert(s.rolePermissions).values({ roleId: r.id, permissionId: p!.id }).onConflictDoNothing?.();
        // if no onConflict: check existing grant first
      }
    } else {
      // ensure all roles have grant
      const roles = await db.select().from(s.roles);
      for (const r of roles) {
        const g = await db.select().from(s.rolePermissions).where(and(
          eq(s.rolePermissions.roleId, r.id),
          eq(s.rolePermissions.permissionId, found[0].id),
        )).limit(1);
        if (!g[0]) await db.insert(s.rolePermissions).values({ roleId: r.id, permissionId: found[0].id });
      }
    }
  }
  const any = await db.select().from(s.customers).limit(1);
  if (any[0]) return;
  // insert ~10 sample customers + addresses
}
```

Call `ensureCustomerModule()` in the early-exit branch and at end of full seed.

Sample data (illustrative — include all segments):

```ts
const SAMPLES = [
  { fullName: "Trần Mai Anh", phone: "0901234567", email: "maianh@example.com", segment: "vip" },
  { fullName: "Ngọc Diễm", phone: "0912345678", email: null, segment: "loyal" },
  // … 8–12 total covering new/loyal/vip/care
];
```

- [ ] **Step 3: Re-run seed in container / locally**

```bash
docker compose exec api npm run seed -w @elane/db
```

Expected: perms exist; customers count > 0.

- [ ] **Step 4: Commit** (skip unless asked)

---

### Task 3: Customer label helpers + tests

**Files:**
- Create: `apps/api/src/lib/customer-labels.ts`
- Create: `apps/api/src/lib/customer-labels.test.ts`

**Interfaces:**
- Produces:

```ts
export type CustomerSegment = "new" | "loyal" | "vip" | "care";
export function segmentLabelVi(seg: string): string; // Mới, Thân thiết, VIP, Cần chăm sóc
export function statusLabelVi(status: string): string; // Đang hoạt động, Đã khóa
export function normalizeCountSeries(
  rows: Array<{ key: string; count: number }>,
  keys: string[],
): Array<{ key: string; count: number }>; // fill missing keys with 0, preserve key order
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { segmentLabelVi, statusLabelVi, normalizeCountSeries } from "./customer-labels.js";

describe("customer-labels", () => {
  it("segmentLabelVi", () => {
    assert.equal(segmentLabelVi("new"), "Mới");
    assert.equal(segmentLabelVi("loyal"), "Thân thiết");
    assert.equal(segmentLabelVi("vip"), "VIP");
    assert.equal(segmentLabelVi("care"), "Cần chăm sóc");
  });
  it("normalizeCountSeries fills zeros", () => {
    assert.deepEqual(
      normalizeCountSeries([{ key: "vip", count: 2 }], ["new", "loyal", "vip", "care"]),
      [
        { key: "new", count: 0 },
        { key: "loyal", count: 0 },
        { key: "vip", count: 2 },
        { key: "care", count: 0 },
      ],
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npm run test -w @elane/api -- src/lib/customer-labels.test.ts`

- [ ] **Step 3: Implement helpers**

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 4: Admin customers API

**Files:**
- Create: `apps/api/src/routes/admin/customers.ts`
- Modify: `apps/api/src/index.ts` — `app.route("/api/v1/admin/customers", adminCustomerRoutes)`

**Interfaces:**
- JSON shapes (snake_case):

```ts
// list item
{ id, full_name, email, phone, segment, status, address_count, created_at, updated_at }
// detail
{ …list fields without address_count, internal_note, addresses: Address[] }
// Address
{ id, recipient_name, phone, address_line, administrative_units, is_default, created_at }
```

- [ ] **Step 1: Implement GET `/` with filters**

```ts
adminCustomerRoutes.get("/", async (c) => {
  requirePerm(c.get("user")!, "customer.read");
  // optional: segment, status, q
  // join/count addresses via sql subquery or two queries
});
```

- [ ] **Step 2: GET `/:id`, POST `/`, PATCH `/:id`**

Validate segment/status enums with Zod. Audit `customer.create` / `customer.update`.

- [ ] **Step 3: Address nested routes**

On create/update with `is_default: true`, in a transaction set all other addresses for that customer to `is_default: false`.

- [ ] **Step 4: Smoke**

Login + `GET /api/v1/admin/customers` → items length ≥ 1; create one customer; add address.

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 5: Extend overview API

**Files:**
- Modify: `apps/api/src/routes/admin/ops.ts`

**Interfaces:**
- Extends existing overview JSON with fields from spec.

- [ ] **Step 1: Query aggregates**

```ts
// customer_total, customers_by_segment (group by segment)
// products_by_status (group by status)
// low_stock_by_category: join balances → variants → products → categories, filter low stock, group by category name, order by count desc limit 8
// inventory_docs_by_type: group by type
// recent_inventory_docs: order by created_at desc limit 5
```

Use `normalizeCountSeries` for segments and product statuses so UI always gets full keys.

- [ ] **Step 2: Smoke**

`GET /admin/overview` includes `customer_total` and chart arrays.

- [ ] **Step 3: Commit** (skip unless asked)

---

### Task 6: Admin API client

**Files:**
- Modify: `apps/admin/src/lib/api.ts`

**Interfaces:**

```ts
export type CustomerSegment = "new" | "loyal" | "vip" | "care";
export type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  segment: CustomerSegment;
  status: "active" | "blocked";
  internal_note?: string;
  address_count?: number;
  addresses?: CustomerAddress[];
  created_at: string;
  updated_at: string;
};
export type CustomerAddress = {
  id: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  administrative_units: Record<string, string>;
  is_default: boolean;
  created_at: string;
};
export type Overview = {
  published_products: number;
  draft_products: number;
  low_stock_skus: number;
  pending_inventory_docs: number;
  customer_total: number;
  customers_by_segment: Array<{ key: string; count: number }>;
  products_by_status: Array<{ key: string; count: number }>;
  low_stock_by_category: Array<{ category_name: string; sku_count: number }>;
  inventory_docs_by_type: Array<{ key: string; count: number }>;
  recent_inventory_docs: Array<{
    id: string;
    code: string;
    type: string;
    status: string;
    created_at: string;
  }>;
};
```

Methods: `customers`, `customer`, `createCustomer`, `updateCustomer`, `createAddress`, `updateAddress`, `deleteAddress`; type `overview()` return as `Overview`.

- [ ] **Step 1: Apply types + methods**
- [ ] **Step 2: Fix any TS breaks at call sites of `overview()`**
- [ ] **Step 3: Commit** (skip unless asked)

---

### Task 7: `CustomersManager` UI

**Files:**
- Create: `apps/admin/src/components/CustomersManager.tsx`
- Modify: `apps/admin/src/routes/index.tsx` — branch `active === "customers"`

**Interfaces:**
- Consumes adminApi customers + overview segment series (optional; can compute from list)

- [ ] **Step 1: Scaffold list** — metrics, tabs (all + 4 segments), search, table columns per spec

- [ ] **Step 2: Form** — fields + address editor (list of drafts; save customer first then addresses on create, or create customer then loop addresses)

Recommended create flow:

1. POST customer  
2. For each address POST  
3. Toast + back to list  

Edit: PATCH customer; address mutations immediate with reload detail.

- [ ] **Step 3: Segment chart** — horizontal bars from counts; max bar = max count

- [ ] **Step 4: Wire route + rebuild admin**

- [ ] **Step 5: Manual check** — filter VIP, create customer, add default address

- [ ] **Step 6: Commit** (skip unless asked)

---

### Task 8: Dashboard real metrics + charts

**Files:**
- Modify: `apps/admin/src/routes/index.tsx` — `Dashboard` component

**Interfaces:**
- Consumes `adminApi.overview()` on mount

- [ ] **Step 1: Load overview in Dashboard**

```tsx
const [ov, setOv] = useState<Overview | null>(null);
useEffect(() => {
  adminApi.overview().then(setOv).catch(...);
}, []);
```

- [ ] **Step 2: Replace KPI strip**

Four KPIs: SP đang bán · SKU sắp hết · Phiếu kho chờ · Tổng khách — values from `ov`, notes from related fields.

- [ ] **Step 3: Replace “Doanh thu theo ngày” chart**

Title: “Sản phẩm theo trạng thái”. Bars from `products_by_status` (normalize heights by max count).

- [ ] **Step 4: Replace kho cảnh báo mock**

Use `low_stock_by_category` with Progress bars (`sku_count`).

- [ ] **Step 5: Replace “Đơn hàng gần đây”**

Table of `recent_inventory_docs` (mã, loại, trạng thái, ngày) + link `onNavigate("inventory")`.

- [ ] **Step 6: Soften/remove fake “Tạo đơn” primary CTA** → “Tạo phiếu kho” navigating to inventory, or hide.

- [ ] **Step 7: Rebuild admin + hard refresh Tổng quan**

- [ ] **Step 8: Commit** (skip unless asked)

---

## Acceptance checklist

1. Customers CRUD + addresses + segment filter works.  
2. Overview KPIs match DB; charts update when data changes.  
3. Customers page segment chart matches list totals.  
4. No fake revenue/order numbers presented as live.

## Self-review vs spec

| Spec | Task |
|------|------|
| Schema customers/addresses | 1 |
| Seed + perms | 2 |
| Customers API | 4 |
| Overview extension | 5 |
| CustomersManager | 7 |
| Dashboard charts | 8 |
| No chart lib / no orders | Global + Task 8 |
| Label helpers testable | 3 |
