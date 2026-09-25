# Storefront Customer Auth + Wishlist + Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real storefront register/login (httpOnly cookie), server wishlist + addresses, login-required checkout that creates orders and reserves stock; admin Đơn hàng reads real data.

**Architecture:** Extend `accounts`/`account_sessions` with customer cookie `elane_customer_session` and `customers.account_id`. New `wishlist_items`, `orders`, `order_items`. Hono routes under `/api/v1/store/auth` and `/api/v1/me`; admin `/api/v1/admin/orders`. Storefront uses `credentials: "include"`; cart stays in `localStorage` until `POST /me/orders`.

**Tech Stack:** Drizzle + Postgres, Hono, bcryptjs (existing), React storefront/admin, `tsx` selfchecks (no new deps).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-26-storefront-customer-auth-orders-design.md`
- Checkout requires customer session (no guest)
- Payment: persist method only (`cod|bank|card|wallet`)
- Shipping fee: `0` if subtotal ≥ `1_000_000` else `30000`
- Stock: reject if `on_hand - reserved < qty`; on success bump `reserved`
- Cookie staff = `elane_session`; customer = `elane_customer_session`
- Vietnamese API/UI messages
- Commits: only when human asks — skip commit steps unless told
- After API/DB: `docker compose exec api` migrate/seed as needed; rebuild api if image not volume-mounted for src

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/db/src/schema.ts` | `accountId` on customers; wishlist; orders; order_items |
| `packages/db/drizzle/0004_*.sql` | Migration |
| `packages/db/src/seed.ts` | Ensure `order.read` perm (no sample customers) |
| `apps/api/src/lib/order-pricing.ts` | `availableQty`, `shippingFeeVnd`, `newOrderNumber` |
| `apps/api/src/lib/order-pricing.selfcheck.ts` | Asserts for helpers |
| `apps/api/src/lib/session.ts` | `CUSTOMER_SESSION_COOKIE`, `resolveCustomerSession`, keep staff resolve |
| `apps/api/src/middleware/auth.ts` | `attachCustomer`, `requireCustomer`, `CustomerUser` on vars |
| `apps/api/src/routes/store/auth.ts` | register/login/logout/me/PATCH me |
| `apps/api/src/routes/me/index.ts` | addresses, wishlist, orders |
| `apps/api/src/routes/admin/orders.ts` | list/get/patch status |
| `apps/api/src/index.ts` | Mount routes |
| `apps/storefront/src/lib/api.ts` | `credentials: "include"` + store/me client |
| `apps/storefront/src/lib/store.tsx` | Session hydrate; wishlist API; placeOrder → API |
| `apps/storefront/src/routes/dang-nhap.tsx` / `dang-ky.tsx` | Real forms |
| `apps/storefront/src/routes/thanh-toan.tsx` | Auth gate + POST order |
| `apps/storefront/src/routes/tai-khoan.tsx` | Profile/orders/addresses from API |
| `apps/admin/src/lib/api.ts` + `routes/index.tsx` | Real orders module |

---

### Task 1: Schema + pricing helpers

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: migration via drizzle-kit
- Create: `apps/api/src/lib/order-pricing.ts`
- Create: `apps/api/src/lib/order-pricing.selfcheck.ts`

**Interfaces:**
- Produces:

```ts
// customers — add:
accountId: uuid("account_id").references(() => accounts.id), // unique index

export const wishlistItems = pgTable("wishlist_items", {
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.customerId, t.productId] })]);

export const orders = pgTable("orders", {
  id: id(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  status: text("status").notNull().default("pending"), // pending|confirmed|cancelled
  currency: text("currency").notNull().default("VND"),
  subtotalVnd: integer("subtotal_vnd").notNull(),
  shippingVnd: integer("shipping_vnd").notNull().default(0),
  discountVnd: integer("discount_vnd").notNull().default(0),
  grandTotalVnd: integer("grand_total_vnd").notNull(),
  paymentMethod: text("payment_method").notNull(), // cod|bank|card|wallet
  recipientSnapshot: jsonb("recipient_snapshot").$type<Record<string, string>>().notNull(),
  shippingAddressSnapshot: jsonb("shipping_address_snapshot").$type<Record<string, string>>().notNull(),
  placedAt: ts("placed_at").notNull().defaultNow(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  variantId: uuid("variant_id").notNull().references(() => productVariants.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  sku: text("sku").notNull(),
  productName: text("product_name").notNull(),
  sizeLabel: text("size_label").notNull(),
  colorLabel: text("color_label"),
  unitPriceVnd: integer("unit_price_vnd").notNull(),
  qty: integer("qty").notNull(),
  lineTotalVnd: integer("line_total_vnd").notNull(),
});

export function availableQty(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}
export function shippingFeeVnd(subtotalVnd: number, freeShipAt = 1_000_000, fee = 30_000): number {
  return subtotalVnd >= freeShipAt ? 0 : fee;
}
export function newOrderNumber(now = new Date()): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `ELN${n}`;
}
```

- [ ] **Step 1: Write `order-pricing.selfcheck.ts`** asserting `availableQty(5,2)===3`, `shippingFeeVnd(999_999)===30000`, `shippingFeeVnd(1_000_000)===0`, `newOrderNumber().startsWith("ELN")`

- [ ] **Step 2: Run selfcheck — expect FAIL** (module missing)

```bash
npx tsx apps/api/src/lib/order-pricing.selfcheck.ts
```

- [ ] **Step 3: Implement `order-pricing.ts` + schema changes**

- [ ] **Step 4: Generate + apply migration**

```bash
npm run db:generate -w @elane/db
# apply via project’s usual migrate path (docker compose exec api …)
```

- [ ] **Step 5: Re-run selfcheck — expect `ok`**

---

### Task 2: Customer session resolve + middleware

**Files:**
- Modify: `apps/api/src/lib/session.ts`
- Modify: `apps/api/src/middleware/auth.ts`

**Interfaces:**
- Consumes: `accountSessions`, `accounts`, `customers`
- Produces:

```ts
export const CUSTOMER_SESSION_COOKIE = "elane_customer_session";

export type CustomerUser = {
  accountId: string;
  customerId: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  status: string; // account status
};

export async function resolveCustomerSession(db: Db, token: string | undefined): Promise<CustomerUser | null>;
// Join sessions → accounts → customers WHERE customers.account_id = accounts.id
// Same expiry/revoke/active checks as staff; NO employees join
```

- Extend `AppVars.Variables` with `customer: CustomerUser | null`
- `attachCustomer` middleware reads `CUSTOMER_SESSION_COOKIE`
- `requireCustomer` throws 401 if missing
- Keep existing `attachUser` / `requireAuth` for admin unchanged

- [ ] **Step 1: Add `resolveCustomerSession` + cookie constant**

- [ ] **Step 2: Wire `attachCustomer` on all routes (after `attachUser`)** in `index.ts` when mounting (Task 3 will mount; do middleware here)

- [ ] **Step 3: Manual sanity** — unit-style: call resolve with undefined → null (optional tiny selfcheck file `customer-session.selfcheck.ts` exporting cookie name assert ≠ `SESSION_COOKIE`)

---

### Task 3: Store auth routes

**Files:**
- Create: `apps/api/src/routes/store/auth.ts`
- Modify: `apps/api/src/index.ts` — `app.route("/api/v1/store/auth", storeAuthRoutes)`
- Modify: `packages/db/src/seed.ts` — ensure `order.read` (used later; can land here)

**Interfaces:**
- Produces endpoints:

| Method | Path | Body / result |
|--------|------|----------------|
| POST | `/register` | `{ full_name, email, phone?, password min 6 }` → `{ ok: true }` + set cookie |
| POST | `/login` | `{ email, password }` → `{ ok: true }` + cookie; 403 if no customer row |
| POST | `/logout` | clear cookie |
| GET | `/me` | `{ customer_id, full_name, email, phone }` |
| PATCH | `/me` | `{ full_name?, phone? }` |

Register transaction:
1. Normalize email lower/trim  
2. Insert `accounts` (`authSubject: \`email:${email}\``, passwordHash bcrypt 10)  
3. Insert `customers` (`accountId`, `fullName`, `email`, `phone`, `segment: "new"`)  
4. `createSession` + `setCookie(CUSTOMER_SESSION_COOKIE, …)`

Login: find account by email; bcrypt compare; load customer by `account_id`; if missing → 403; create session.

- [ ] **Step 1: Implement routes mirroring `admin/auth.ts` patterns** (`ApiError`, zod)

- [ ] **Step 2: Mount + smoke with curl**

```bash
curl -i -c /tmp/elane-c.txt -H "Content-Type: application/json" \
  -d "{\"full_name\":\"Test\",\"email\":\"t$(date +%s)@ex.com\",\"password\":\"secret1\"}" \
  http://localhost:3001/api/v1/store/auth/register
# Expect 200 Set-Cookie: elane_customer_session=
curl -s -b /tmp/elane-c.txt http://localhost:3001/api/v1/store/auth/me
# Expect JSON with customer_id
```

---

### Task 4: `/me` addresses + wishlist

**Files:**
- Create: `apps/api/src/routes/me/index.ts` (or split `addresses.ts` / `wishlist.ts` if preferred — one file OK if &lt;300 lines)
- Modify: `apps/api/src/index.ts` — `app.route("/api/v1/me", meRoutes)` with `requireCustomer` on the router

**Interfaces:**
- Addresses: same shape as admin customer addresses CRUD but scoped to `c.get("customer").customerId`
- Wishlist:

```ts
GET /wishlist → { items: [{ product_id: string }] }
PUT /wishlist/:productId → { ok: true }  // verify product exists
DELETE /wishlist/:productId → { ok: true }
```

- [ ] **Step 1: Implement address list/create/patch/delete** (forbid cross-customer id)

- [ ] **Step 2: Implement wishlist put/delete/get**

- [ ] **Step 3: Curl smoke** with cookie from Task 3

---

### Task 5: Place + list orders (reserve stock)

**Files:**
- Modify: `apps/api/src/routes/me/index.ts` (orders section)
- Uses: `order-pricing.ts`, `inventoryBalances`, single warehouse (select first active warehouse like inventory routes)

**Interfaces:**
- `POST /orders` body per spec
- Algorithm inside `db.transaction`:
  1. For each item load variant+product+price (`sale` = variant price or product)  
  2. Sum available across warehouse row (create balance 0/0 if missing → insufficient)  
  3. If any short → throw `ApiError(400, "insufficient_stock", …)`  
  4. Insert order + items  
  5. `UPDATE inventory_balances SET reserved = reserved + qty WHERE … AND on_hand - reserved >= qty` — if rowCount 0 rollback  

- `GET /orders` → summary list  
- `GET /orders/:id` → detail + items (404 if not owner)

- [ ] **Step 1: Implement POST with reservation**

- [ ] **Step 2: Implement GET list/detail**

- [ ] **Step 3: Curl place order** with a known in-stock `variant_id` from DB; second oversell should 400

---

### Task 6: Admin orders API + empty UI wiring

**Files:**
- Create: `apps/api/src/routes/admin/orders.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `packages/db/src/seed.ts` — `order.read` (+ `order.write` optional for PATCH) on all roles like other perms
- Modify: `apps/admin/src/lib/api.ts` — `orders()`, `order(id)`, `patchOrder(id, { status })`
- Modify: `apps/admin/src/routes/index.tsx` — when `active === "orders"`, either hydrate `liveConfigs.orders` from API (like products) or small `OrdersManager`; metrics from counts; `rows` from API; empty `rows: []` already

**Interfaces:**
- `GET /admin/orders` requires `requireAuth` + `order.read`
- `PATCH /admin/orders/:id` body `{ status: "pending"|"confirmed"|"cancelled" }` requires `order.read` (or `order.write` if added)

- [ ] **Step 1: Admin routes**

- [ ] **Step 2: Admin client + hydrate orders module from API in `useEffect`**

- [ ] **Step 3: Verify admin Đơn hàng shows empty or real rows after placing store order**

---

### Task 7: Storefront API client + auth pages + session store

**Files:**
- Modify: `apps/storefront/src/lib/api.ts` — helper `storeFetch(path, init)` with `credentials: "include"`
- Modify: `apps/storefront/src/lib/store.tsx`
- Modify: `apps/storefront/src/routes/dang-nhap.tsx`, `dang-ky.tsx`
- Modify: `apps/storefront/src/routes/__root.tsx` if needed to call `refreshSession()` once

**Interfaces:**
```ts
// api.ts
storeAuth: {
  register(body): Promise<void>;
  login(body): Promise<void>;
  logout(): Promise<void>;
  me(): Promise<{ customer_id; full_name; email; phone } | null>; // 401 → null
}
```

Store changes:
- `user` shape `{ id: customer_id, name, email, phone? }` from `/me`
- On mount: `me()` hydrate; remove trusting `elane-user` as auth (clear key or ignore)
- `login`/`logout` become API wrappers
- `toggleWishlist`: if !user toast+return; else PUT/DELETE then update local ids
- On login success: `GET /wishlist` replace local wish ids (optional merge: server wins)

- [ ] **Step 1: Client methods**

- [ ] **Step 2: Wire dang-ky / dang-nhap** (show API error toast; support `?next=` redirect)

- [ ] **Step 3: Hydrate session in StoreProvider**

---

### Task 8: Checkout gate + account page

**Files:**
- Modify: `apps/storefront/src/routes/thanh-toan.tsx`
- Modify: `apps/storefront/src/routes/tai-khoan.tsx`
- Modify: `apps/storefront/src/lib/store.tsx` — `placeOrder` async → API; clear cart on success; keep local order list optional cache from `GET /me/orders`

**Behavior:**
- Checkout: if `!user` → `navigate({ to: "/dang-nhap", search: { next: "/thanh-toan" } })` (add search param to dang-nhap route if missing)
- Submit: `POST /me/orders` with cart variant ids + form shipping + `payment_method`
- Account: fetch orders from API; profile PATCH; simple address list (minimal UI: list + add one form)

- [ ] **Step 1: Checkout auth gate + POST**

- [ ] **Step 2: Account orders/profile from API**

- [ ] **Step 3: Manual E2E** — register → add to cart → checkout → see order on `/tai-khoan` and admin

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| `customers.account_id`, wishlist, orders tables | 1 |
| Customer cookie + resolve | 2 |
| register/login/logout/me | 3 |
| addresses + wishlist API | 4 |
| POST/GET orders + reserved | 5 |
| Admin orders + UI | 6 |
| Storefront auth UX | 7 |
| Checkout require login + account | 8 |
| No guest / payment record-only / free ship rule | 5, 8 |
| No sample customer re-seed | seed already cleared; Task 3 only adds `order.read` |

## Placeholder scan

None intentional. Commit steps omitted per Global Constraints.
