# Discount Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin CRUD for coupon codes; storefront checkout preview + apply; server recomputes `discount_vnd` and bumps usage on place order.

**Architecture:** Flat `discount_codes` table. Pure helper `computeDiscountVnd` + `assertCouponApplicable`. Preview route read-only; place-order locks row and increments `usage_count`. Admin nav `promotions` becomes real list UI.

**Tech Stack:** Hono, Drizzle/`@elane/db`, Zod, existing admin/storefront React (no new deps).

## Global Constraints

- Types: `percent` | `fixed` only.
- One code per order; no stacking, freeship, product targeting, per-customer limits.
- Code stored uppercase; match case-insensitive.
- Client preview is UX only; place-order always recalculates.
- DELETE = soft-disable (`status=disabled`).
- Perms: `promotion.read` / `promotion.write`.

## File map

| File | Role |
|------|------|
| `packages/db/src/schema.ts` | `discountCodes` + order coupon cols |
| `packages/db/drizzle/0006_discount_codes.sql` | Migration |
| `packages/db/drizzle/meta/_journal.json` | Register 0006 |
| `packages/db/src/seed.ts` | Ensure promotion perms |
| `apps/api/src/lib/discount-codes.ts` | Pure compute + validate |
| `apps/api/src/lib/discount-codes.selfcheck.ts` | Assert checks |
| `apps/api/src/routes/admin/discount-codes.ts` | Admin CRUD |
| `apps/api/src/routes/store/coupons.ts` | Preview |
| `apps/api/src/routes/me/index.ts` | Apply coupon on place order |
| `apps/api/src/index.ts` | Mount routes |
| `apps/admin/src/lib/api.ts` | Client API |
| `apps/admin/src/components/DiscountCodesManager.tsx` | Admin UI |
| `apps/admin/src/routes/index.tsx` | Wire promotions section |
| `apps/storefront/src/lib/api.ts` + `store.tsx` | Preview + placeOrder `coupon_code` |
| `apps/storefront/src/routes/thanh-toan.tsx` | Coupon UI |

---

### Task 1: Schema + migration + seed perms

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0006_discount_codes.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`
- Modify: `packages/db/src/seed.ts`

**Interfaces:**
- Produces: `discountCodes` table export; `orders.discountCodeId`, `orders.discountCode`

- [ ] **Step 1: Add schema**

After `wishlistItems` (before `orders`), add:

```ts
export const discountCodes = pgTable("discount_codes", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(), // percent|fixed
  value: integer("value").notNull(),
  minOrderVnd: integer("min_order_vnd").notNull().default(0),
  maxDiscountVnd: integer("max_discount_vnd"),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").notNull().default(0),
  status: text("status").notNull().default("active"), // active|disabled
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
```

On `orders`, after `discountVnd`:

```ts
discountCodeId: uuid("discount_code_id").references(() => discountCodes.id),
discountCode: text("discount_code"),
```

Export `discountCodes` from package index if there is a barrel re-export (mirror other tables).

- [ ] **Step 2: Migration SQL `0006_discount_codes.sql`**

```sql
CREATE TABLE "discount_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"value" integer NOT NULL,
	"min_order_vnd" integer DEFAULT 0 NOT NULL,
	"max_discount_vnd" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_code_unique" UNIQUE("code")
);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_code_id_discount_codes_id_fk" FOREIGN KEY ("discount_code_id") REFERENCES "public"."discount_codes"("id") ON DELETE no action ON UPDATE no action;
```

Append journal entry idx 6, tag `0006_discount_codes`, when ≈ `1790380000000`.

- [ ] **Step 3: Seed perms**

In `ensureCustomerModule` (or rename to `ensureModulePerms`), also ensure:

```ts
["promotion.read", "Xem mã giảm giá"],
["promotion.write", "Sửa mã giảm giá"],
```

Call from both early-exit and full seed paths (same as customer perms).

- [ ] **Step 4: Apply migration**

```bash
pnpm --filter @elane/db exec drizzle-kit migrate
```

If that fails, apply SQL manually against the running Postgres (docker-compose) like prior migrations.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "Add discount_codes schema and promotion permissions."
```

---

### Task 2: Discount helper + selfcheck

**Files:**
- Create: `apps/api/src/lib/discount-codes.ts`
- Create: `apps/api/src/lib/discount-codes.selfcheck.ts`

**Interfaces:**
- Produces:
  - `computeDiscountVnd(args: { type: "percent"|"fixed"; value: number; subtotalVnd: number; maxDiscountVnd: number | null }): number`
  - `CouponFailCode = "coupon_not_found"|"coupon_inactive"|"coupon_not_started"|"coupon_expired"|"coupon_min_order"|"coupon_exhausted"`
  - `assertCouponApplicable(row, subtotalVnd, now): void` throws `{ code: CouponFailCode; message: string }` or returns void
  - `normalizeCouponCode(code: string): string` → trim + uppercase

- [ ] **Step 1: Write selfcheck first**

```ts
// apps/api/src/lib/discount-codes.selfcheck.ts
import assert from "node:assert/strict";
import { computeDiscountVnd, normalizeCouponCode } from "./discount-codes.js";

assert.equal(normalizeCouponCode("  welcome10 "), "WELCOME10");
assert.equal(computeDiscountVnd({ type: "percent", value: 10, subtotalVnd: 1_000_000, maxDiscountVnd: null }), 100_000);
assert.equal(computeDiscountVnd({ type: "percent", value: 50, subtotalVnd: 1_000_000, maxDiscountVnd: 200_000 }), 200_000);
assert.equal(computeDiscountVnd({ type: "fixed", value: 50_000, subtotalVnd: 40_000, maxDiscountVnd: null }), 40_000);
assert.equal(computeDiscountVnd({ type: "fixed", value: 50_000, subtotalVnd: 100_000, maxDiscountVnd: null }), 50_000);

console.log("discount-codes.selfcheck: ok");
```

- [ ] **Step 2: Implement helper**

```ts
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export function computeDiscountVnd(args: {
  type: "percent" | "fixed";
  value: number;
  subtotalVnd: number;
  maxDiscountVnd: number | null;
}): number {
  const { type, value, subtotalVnd, maxDiscountVnd } = args;
  let raw = type === "percent" ? Math.floor((subtotalVnd * value) / 100) : value;
  if (type === "percent" && maxDiscountVnd != null) raw = Math.min(raw, maxDiscountVnd);
  return Math.max(0, Math.min(raw, subtotalVnd));
}

export type CouponRow = {
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  minOrderVnd: number;
  usageLimit: number | null;
  usageCount: number;
  type: string;
  value: number;
  maxDiscountVnd: number | null;
};

export type CouponFailCode =
  | "coupon_not_found"
  | "coupon_inactive"
  | "coupon_not_started"
  | "coupon_expired"
  | "coupon_min_order"
  | "coupon_exhausted";

export class CouponError extends Error {
  constructor(
    public code: CouponFailCode,
    message: string,
  ) {
    super(message);
  }
}

export function assertCouponApplicable(row: CouponRow, subtotalVnd: number, now = new Date()): void {
  if (row.status !== "active") throw new CouponError("coupon_inactive", "Mã giảm giá không còn hiệu lực");
  if (row.startsAt && now < row.startsAt) throw new CouponError("coupon_not_started", "Mã giảm giá chưa bắt đầu");
  if (row.endsAt && now > row.endsAt) throw new CouponError("coupon_expired", "Mã giảm giá đã hết hạn");
  if (subtotalVnd < row.minOrderVnd)
    throw new CouponError("coupon_min_order", `Đơn tối thiểu ${row.minOrderVnd.toLocaleString("vi-VN")}₫`);
  if (row.usageLimit != null && row.usageCount >= row.usageLimit)
    throw new CouponError("coupon_exhausted", "Mã giảm giá đã hết lượt dùng");
}
```

- [ ] **Step 3: Run selfcheck**

```bash
pnpm --filter api exec tsx src/lib/discount-codes.selfcheck.ts
```

Expected: `discount-codes.selfcheck: ok`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/discount-codes.ts apps/api/src/lib/discount-codes.selfcheck.ts
git commit -m "Add discount code compute and validation helpers."
```

---

### Task 3: Admin + store coupon API + place-order apply

**Files:**
- Create: `apps/api/src/routes/admin/discount-codes.ts`
- Create: `apps/api/src/routes/store/coupons.ts`
- Modify: `apps/api/src/routes/me/index.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/routes/admin/orders.ts` (expose `discount_code` / ensure `discount_vnd` already returned)
- Modify: me order detail to include `discount_code`

**Interfaces:**
- Consumes: helpers from Task 2; `discountCodes` from schema
- Produces: routes mounted at `/api/v1/admin/discount-codes` and `/api/v1/store/coupons`

- [ ] **Step 1: Admin CRUD** — mirror `customers.ts` style

`mapCode(row)` → snake_case JSON.  
GET `/` with `status`, `q`.  
POST/PATCH: zod validate `type` enum, percent value 1–100, fixed value > 0, normalize code.  
DELETE → `status=disabled`.  
409 on unique code conflict (catch PG unique or pre-check).

- [ ] **Step 2: Store preview**

`POST /` on Hono app mounted at `/api/v1/store/coupons` with path `/preview`:

- `requireCustomer`
- body `{ code, subtotal_vnd }`
- lookup by normalized code; missing → `CouponError("coupon_not_found", ...)`
- `assertCouponApplicable` + `computeDiscountVnd`
- return `{ code, type, value, discount_vnd }`

- [ ] **Step 3: Place order**

Extend zod body with `coupon_code: z.string().optional()`.  
After computing `subtotal` / `shipping`, if `coupon_code` present:

```ts
const codeNorm = normalizeCouponCode(body.data.coupon_code);
const [locked] = await tx
  .select()
  .from(discountCodes)
  .where(eq(discountCodes.code, codeNorm))
  .for("update") // or raw SQL FOR UPDATE if drizzle version needs it
  .limit(1);
// assert + compute; bump usage_count with WHERE usage_limit IS NULL OR usage_count < usage_limit
```

Set `discountVnd`, `discountCodeId`, `discountCode` on insert; `grand = subtotal + shipping - discount`.

Map `CouponError` → `ApiError(400, err.code, err.message)`.

If drizzle `.for("update")` unavailable, use:

```ts
await tx.execute(sql`SELECT id FROM discount_codes WHERE code = ${codeNorm} FOR UPDATE`);
```

then re-select.

- [ ] **Step 4: Mount in `index.ts`**

```ts
app.route("/api/v1/admin/discount-codes", adminDiscountCodeRoutes);
app.route("/api/v1/store/coupons", storeCouponRoutes);
```

- [ ] **Step 5: Expose discount fields on me order detail + admin order if missing**

Add `discount_code: order.discountCode` alongside existing `discount_vnd`.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "Wire discount code admin CRUD, preview, and place-order apply."
```

---

### Task 4: Admin UI

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/components/DiscountCodesManager.tsx`
- Modify: `apps/admin/src/routes/index.tsx`

- [ ] **Step 1: API client**

Types + methods: `discountCodes`, `discountCode`, `createDiscountCode`, `patchDiscountCode`, `deleteDiscountCode` under `/admin/discount-codes`.

- [ ] **Step 2: Manager UI**

List table + create/edit dialog (fields from spec). Pattern after `CustomersManager` but simpler (no metrics). Status filter tabs: Tất cả / Active / Disabled. Disable via DELETE or status toggle.

- [ ] **Step 3: Wire nav**

When `active === "promotions"`, render `<DiscountCodesManager />` instead of mock `ModulePage`. Remove or ignore fake `configs.promotions` rows for that branch.

- [ ] **Step 4: Commit**

```bash
git add apps/admin
git commit -m "Replace mock promotions with discount codes manager."
```

---

### Task 5: Storefront checkout UI

**Files:**
- Modify: `apps/storefront/src/lib/api.ts`
- Modify: `apps/storefront/src/lib/store.tsx`
- Modify: `apps/storefront/src/routes/thanh-toan.tsx`
- Modify order detail route if it shows totals (add discount line when > 0)

- [ ] **Step 1: API**

```ts
previewCoupon: (body: { code: string; subtotal_vnd: number }) =>
  storeReq<{ code: string; type: string; value: number; discount_vnd: number }>(
    "/store/coupons/preview",
    { method: "POST", body: JSON.stringify(body) },
  ),
```

Extend `placeOrder` body with optional `coupon_code`.

- [ ] **Step 2: store.tsx**

Pass `coupon_code` from `PlaceOrderInput` through to API.

- [ ] **Step 3: thanh-toan.tsx**

State: `couponInput`, `applied: { code, discount_vnd } | null`, `couponError`.  
Apply button → `previewCoupon`.  
Summary: show Giảm giá line; grand = subtotal + shipping - discount.  
Submit includes `coupon_code: applied?.code`.

- [ ] **Step 4: Commit**

```bash
git add apps/storefront
git commit -m "Add checkout coupon preview and apply."
```

---

### Task 6: Smoke verify

- [ ] Run `discount-codes.selfcheck`
- [ ] Manual or scripted: create code via admin API, preview, place order, confirm `usage_count` and `discount_vnd`
- [ ] Fix any breakage

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| `discount_codes` + order cols | 1 |
| Formula + errors | 2 |
| Admin CRUD + soft delete | 3 |
| Preview + place apply + usage bump | 3 |
| Admin UI | 4 |
| Checkout UI | 5 |
| Helper selfcheck | 2 |
| Perms seed | 1 |
