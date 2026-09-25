# Sepay Bank Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SePay webhook bank-transfer confirmation with VietQR checkout UX, COD+bank only on storefront, and admin manual mark-paid.

**Architecture:** Extend `orders` with `payment_status` / `paid_at` / `payment_ref`. Public HMAC webhook matches SePay `code`/`content` to `order_number` and amount, deduped in `sepay_webhook_events`. Storefront shows bank info + VietQR after bank orders; admin can mark paid manually.

**Tech Stack:** Hono API, Drizzle/`@elane/db`, Zod, img.vietqr.io (no new npm deps), existing admin/storefront React apps.

## Global Constraints

- Provider: SePay webhook + VietQR client-side only.
- Match: `order_number` in transfer content/`code` AND `transferAmount === grand_total_vnd`.
- Checkout methods: only `cod` | `bank` (hide card/wallet).
- Webhook auth: HMAC-SHA256; timestamp skew ≤ 300s.
- Stock: keep reserve-on-place for both methods.
- No VA, auto-cancel, email, refunds, amount-only matching.

## File map

| File | Role |
|------|------|
| `packages/db/src/schema.ts` | `orders` payment cols + `sepay_webhook_events` |
| `packages/db/drizzle/0005_sepay_bank_transfer.sql` | Migration |
| `apps/api/src/env.ts` | SePay/bank env |
| `apps/api/src/lib/sepay.ts` | HMAC verify + match helpers |
| `apps/api/src/lib/sepay.selfcheck.ts` | Assert checks |
| `apps/api/src/lib/mark-order-paid.ts` | Shared paid transition |
| `apps/api/src/routes/webhooks/sepay.ts` | Webhook route |
| `apps/api/src/routes/public/payments.ts` | `GET /payments/bank-info` |
| `apps/api/src/index.ts` | Mount routes |
| `apps/api/src/routes/me/index.ts` | Set `payment_status` on place; expose on list/detail; narrow pay enum |
| `apps/api/src/routes/admin/orders.ts` | Expose payment fields + mark-paid |
| `apps/storefront/src/lib/api.ts` + `store.tsx` | Bank info + placeOrder return extras |
| `apps/storefront/src/routes/thanh-toan.tsx` | COD/bank UI + bank success + QR |
| `apps/admin/src/lib/api.ts` + `routes/index.tsx` | Payment column + mark-paid action |
| `.env.example` (repo root if present) | Document new env vars |

---

### Task 1: Schema + migration

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0005_sepay_bank_transfer.sql`
- Modify: `packages/db/drizzle/meta/_journal.json` (append entry if that is how prior migrations were registered — mirror `0004` pattern)

**Interfaces:**
- Produces: `orders.paymentStatus`, `orders.paidAt`, `orders.paymentRef`; table `sepayWebhookEvents`

- [ ] **Step 1: Update schema**

In `orders` table (after `paymentMethod`):

```ts
paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid|awaiting|paid|failed
paidAt: ts("paid_at"),
paymentRef: text("payment_ref"),
```

Add table (near orders):

```ts
export const sepayWebhookEvents = pgTable("sepay_webhook_events", {
  id: id(),
  sepayId: bigint("sepay_id", { mode: "number" }).notNull().unique(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  matchedOrderId: uuid("matched_order_id").references(() => orders.id),
  createdAt: createdAt(),
});
```

(Use the same `id` / `ts` / `createdAt` helpers as other tables. If `bigint` import missing, add from `drizzle-orm/pg-core`.)

- [ ] **Step 2: Write SQL migration `0005_sepay_bank_transfer.sql`**

```sql
ALTER TABLE "orders" ADD COLUMN "payment_status" text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_ref" text;--> statement-breakpoint
CREATE TABLE "sepay_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sepay_id" bigint NOT NULL,
	"payload" jsonb NOT NULL,
	"matched_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sepay_webhook_events_sepay_id_unique" UNIQUE("sepay_id")
);--> statement-breakpoint
ALTER TABLE "sepay_webhook_events" ADD CONSTRAINT "sepay_webhook_events_matched_order_id_orders_id_fk" FOREIGN KEY ("matched_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
```

Register in drizzle journal the same way as `0004`.

- [ ] **Step 3: Apply migration**

Run the project's usual migrate command (e.g. from repo root):

```bash
pnpm --filter @elane/db exec drizzle-kit migrate
```

If TTY/CI issues like before, apply SQL manually then insert hash into `__drizzle_migrations` as done for `0004`.

Expected: columns and table exist; no error.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/0005_sepay_bank_transfer.sql packages/db/drizzle/meta
git commit -m "Add order payment_status and sepay_webhook_events."
```

---

### Task 2: SePay helpers + mark-paid

**Files:**
- Create: `apps/api/src/lib/sepay.ts`
- Create: `apps/api/src/lib/sepay.selfcheck.ts`
- Create: `apps/api/src/lib/mark-order-paid.ts`
- Modify: `apps/api/src/env.ts`

**Interfaces:**
- Consumes: Node `crypto`
- Produces:
  - `verifySepayHmac(rawBody: string, signatureHeader: string, timestampHeader: string, secret: string, nowSec?: number): boolean`
  - `extractOrderNumber(code: string | null | undefined, content: string): string | null`
  - `shouldConfirmBankPayment(input: { transferType: string; transferAmount: number; orderGrandTotal: number; orderNumber: string; code: string | null; content: string }): boolean`
  - `markOrderPaid(db, orderId, paymentRef: string): Promise<boolean>` — returns false if not awaiting bank / already paid

- [ ] **Step 1: Failing selfcheck**

`apps/api/src/lib/sepay.selfcheck.ts`:

```ts
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { extractOrderNumber, shouldConfirmBankPayment, verifySepayHmac } from "./sepay.js";

const secret = "test-secret";
const body = JSON.stringify({ id: 1 });
const ts = Math.floor(Date.now() / 1000);
const sig =
  "sha256=" +
  crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

assert.equal(verifySepayHmac(body, sig, String(ts), secret), true);
assert.equal(verifySepayHmac(body, "sha256=dead", String(ts), secret), false);
assert.equal(verifySepayHmac(body, sig, String(ts - 400), secret), false);

assert.equal(extractOrderNumber("ELN123", "foo ELN123 bar"), "ELN123");
assert.equal(extractOrderNumber(null, "CK ELN999 xyz"), "ELN999");
assert.equal(extractOrderNumber(null, "no code here"), null);

assert.equal(
  shouldConfirmBankPayment({
    transferType: "in",
    transferAmount: 500000,
    orderGrandTotal: 500000,
    orderNumber: "ELN1",
    code: "ELN1",
    content: "ELN1",
  }),
  true,
);
assert.equal(
  shouldConfirmBankPayment({
    transferType: "in",
    transferAmount: 1,
    orderGrandTotal: 500000,
    orderNumber: "ELN1",
    code: "ELN1",
    content: "ELN1",
  }),
  false,
);

console.log("sepay.selfcheck: ok");
```

- [ ] **Step 2: Run — expect fail**

```bash
cd apps/api && npx tsx src/lib/sepay.selfcheck.ts
```

Expected: cannot find `./sepay.js`.

- [ ] **Step 3: Implement helpers + env**

`apps/api/src/lib/sepay.ts`:

```ts
import crypto from "node:crypto";

const ORDER_RE = /\b(ELN\d+)\b/i;

export function verifySepayHmac(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  const timestamp = Number(timestampHeader);
  if (!secret || !Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSec - timestamp) > 300) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function extractOrderNumber(
  code: string | null | undefined,
  content: string,
): string | null {
  if (code && /^ELN\d+$/i.test(code.trim())) return code.trim().toUpperCase();
  const m = content.match(ORDER_RE);
  return m?.[1]?.toUpperCase() ?? null;
}

export function shouldConfirmBankPayment(input: {
  transferType: string;
  transferAmount: number;
  orderGrandTotal: number;
  orderNumber: string;
  code: string | null;
  content: string;
}): boolean {
  if (input.transferType !== "in") return false;
  if (input.transferAmount !== input.orderGrandTotal) return false;
  const found = extractOrderNumber(input.code, input.content);
  return found === input.orderNumber.toUpperCase();
}
```

`apps/api/src/lib/mark-order-paid.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { orders } from "@elane/db";
import type { AppVars } from "../middleware/auth.js";

type Db = AppVars["Variables"]["db"];

/** Marks bank+awaiting order paid+confirmed. Returns false if nothing updated. */
export async function markOrderPaid(db: Db, orderId: string, paymentRef: string) {
  const updated = await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      paidAt: new Date(),
      paymentRef,
      status: "confirmed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.paymentMethod, "bank"),
        eq(orders.paymentStatus, "awaiting"),
      ),
    )
    .returning({ id: orders.id });
  return Boolean(updated[0]);
}
```

Extend `env` in `apps/api/src/env.ts`:

```ts
  sepayWebhookSecret: process.env.SEPAY_WEBHOOK_SECRET ?? "",
  sepayBankAccount: process.env.SEPAY_BANK_ACCOUNT ?? "",
  sepayAccountName: process.env.SEPAY_ACCOUNT_NAME ?? "",
  sepayBankName: process.env.SEPAY_BANK_NAME ?? "",
  sepayBankBin: process.env.SEPAY_BANK_BIN ?? "",
```

If `.env.example` exists at repo root, append the five vars with empty placeholders.

- [ ] **Step 4: Re-run selfcheck — expect pass**

```bash
cd apps/api && npx tsx src/lib/sepay.selfcheck.ts
```

Expected: `sepay.selfcheck: ok`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/sepay.ts apps/api/src/lib/sepay.selfcheck.ts apps/api/src/lib/mark-order-paid.ts apps/api/src/env.ts .env.example
git commit -m "Add SePay HMAC helpers and mark-order-paid."
```

---

### Task 3: Webhook + bank-info + place-order status + admin mark-paid

**Files:**
- Create: `apps/api/src/routes/webhooks/sepay.ts`
- Create: `apps/api/src/routes/public/payments.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/routes/me/index.ts`
- Modify: `apps/api/src/routes/admin/orders.ts`

**Interfaces:**
- Consumes: `verifySepayHmac`, `extractOrderNumber`, `shouldConfirmBankPayment`, `markOrderPaid`, `env`
- Produces:
  - `POST /api/v1/webhooks/sepay` → `{ success: true }`
  - `GET /api/v1/payments/bank-info` → `{ account_number, account_name, bank_name, bank_bin }`
  - `POST /api/v1/admin/orders/:id/mark-paid`
  - Place order sets `paymentStatus` `awaiting`|`unpaid`; list/detail include `payment_status`

- [ ] **Step 1: Public bank-info route**

`apps/api/src/routes/public/payments.ts`:

```ts
import { Hono } from "hono";
import { env } from "../../env.js";
import { ApiError } from "../../lib/errors.js";
import type { AppVars } from "../../middleware/auth.js";

export const publicPaymentRoutes = new Hono<AppVars>();

publicPaymentRoutes.get("/payments/bank-info", (c) => {
  if (!env.sepayBankAccount || !env.sepayBankBin) {
    throw new ApiError(503, "not_configured", "Chưa cấu hình tài khoản ngân hàng");
  }
  return c.json({
    account_number: env.sepayBankAccount,
    account_name: env.sepayAccountName,
    bank_name: env.sepayBankName,
    bank_bin: env.sepayBankBin,
  });
});
```

- [ ] **Step 2: Webhook route**

`apps/api/src/routes/webhooks/sepay.ts`:

```ts
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { orders, sepayWebhookEvents } from "@elane/db";
import { env } from "../../env.js";
import { markOrderPaid } from "../../lib/mark-order-paid.js";
import {
  extractOrderNumber,
  shouldConfirmBankPayment,
  verifySepayHmac,
} from "../../lib/sepay.js";
import type { AppVars } from "../../middleware/auth.js";

export const sepayWebhookRoutes = new Hono<AppVars>();

sepayWebhookRoutes.post("/webhooks/sepay", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-sepay-signature") ?? "";
  const timestamp = c.req.header("x-sepay-timestamp") ?? "";
  if (!verifySepayHmac(rawBody, signature, timestamp, env.sepayWebhookSecret)) {
    return c.json({ success: false, message: "Invalid signature" }, 401);
  }

  let data: {
    id?: number;
    transferType?: string;
    transferAmount?: number;
    code?: string | null;
    content?: string;
  };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    return c.json({ success: false, message: "Invalid JSON" }, 400);
  }
  if (typeof data.id !== "number") {
    return c.json({ success: false, message: "Invalid payload" }, 400);
  }

  const db = c.get("db");
  const inserted = await db
    .insert(sepayWebhookEvents)
    .values({
      sepayId: data.id,
      payload: data as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: sepayWebhookEvents.id });

  if (!inserted[0]) {
    return c.json({ success: true });
  }

  const content = data.content ?? "";
  const code = data.code ?? null;
  const orderNumber = extractOrderNumber(code, content);
  if (
    data.transferType === "in" &&
    orderNumber &&
    typeof data.transferAmount === "number"
  ) {
    const order = (
      await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1)
    )[0];
    if (
      order &&
      order.paymentMethod === "bank" &&
      order.paymentStatus === "awaiting" &&
      shouldConfirmBankPayment({
        transferType: data.transferType,
        transferAmount: data.transferAmount,
        orderGrandTotal: order.grandTotalVnd,
        orderNumber: order.orderNumber,
        code,
        content,
      })
    ) {
      const ok = await markOrderPaid(db, order.id, String(data.id));
      if (ok) {
        await db
          .update(sepayWebhookEvents)
          .set({ matchedOrderId: order.id })
          .where(eq(sepayWebhookEvents.id, inserted[0].id));
      }
    }
  }

  return c.json({ success: true });
});
```

(If drizzle `onConflictDoNothing` needs target: `.onConflictDoNothing({ target: sepayWebhookEvents.sepayId })`.)

- [ ] **Step 3: Mount routes in `apps/api/src/index.ts`**

```ts
import { sepayWebhookRoutes } from "./routes/webhooks/sepay.js";
import { publicPaymentRoutes } from "./routes/public/payments.js";
// ...
app.route("/api/v1", publicPaymentRoutes);
app.route("/api/v1", sepayWebhookRoutes);
```

- [ ] **Step 4: Place order + me list/detail**

In `me/index.ts`:

- Change `payEnum` to `z.enum(["cod", "bank"])`.
- On insert orders values, add:

```ts
paymentStatus: body.data.payment_method === "bank" ? "awaiting" : "unpaid",
```

- Add `payment_status`, `paid_at`, `payment_ref` to GET list/detail JSON.

- [ ] **Step 5: Admin list + mark-paid**

In `admin/orders.ts` select/map include `payment_status`, `paid_at`, `payment_ref`.

Add:

```ts
adminOrderRoutes.post("/:id/mark-paid", async (c) => {
  requirePerm(c.get("user")!, "order.write"); // if only order.read exists, use order.read and note; prefer order.write if present
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
```

Check existing permission codes used by PATCH — reuse the same perm as status update.

- [ ] **Step 6: Smoke HMAC locally**

```bash
cd apps/api && npx tsx src/lib/sepay.selfcheck.ts
```

Optional: with API up, POST signed fixture to `/api/v1/webhooks/sepay` and expect `{"success":true}`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/webhooks/sepay.ts apps/api/src/routes/public/payments.ts apps/api/src/index.ts apps/api/src/routes/me/index.ts apps/api/src/routes/admin/orders.ts
git commit -m "Wire SePay webhook, bank-info, and mark-paid APIs."
```

---

### Task 4: Storefront checkout + VietQR success

**Files:**
- Modify: `apps/storefront/src/lib/api.ts`
- Modify: `apps/storefront/src/lib/store.tsx`
- Modify: `apps/storefront/src/routes/thanh-toan.tsx`

**Interfaces:**
- Consumes: `GET /payments/bank-info`; place order response already has `order_number` (+ ensure `grand_total_vnd` returned)
- Produces: COD|bank radios; bank success panel with QR

- [ ] **Step 1: API + store types**

Add to `api.ts`:

```ts
export type BankInfo = {
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_bin: string;
};

export function fetchBankInfo() {
  return get<BankInfo>("/payments/bank-info");
}
```

Narrow `paymentMethod` in store/`PlaceOrderInput` to `"cod" | "bank"`.

Ensure `placeOrder` / `POST /me/orders` response used by UI includes `order_number` and `grand_total_vnd` (add to API response if missing).

Change `placeOrder` return type to `{ orderNumber: string; grandTotalVnd: number; paymentMethod: "cod" | "bank" }` (or keep string and fetch bank panel from local state — preferred: return object).

- [ ] **Step 2: Checkout UI**

In `thanh-toan.tsx`:

- `pay` state: `"cod" | "bank"`.
- Radios only those two.
- `useEffect` load `fetchBankInfo()` when `pay === "bank"` (ignore 503 with toast).
- When `pay === "bank"` and bankInfo loaded, show STK / name / bank + note nội dung = mã đơn sau khi đặt.
- `done` state becomes object:

```ts
type Done = {
  orderNumber: string;
  grandTotalVnd: number;
  paymentMethod: "cod" | "bank";
} | null;
```

- COD success: existing thank-you.
- Bank success: QR

```ts
const qr = `https://img.vietqr.io/image/${bankInfo.bank_bin}-${bankInfo.account_number}-compact2.png?amount=${done.grandTotalVnd}&addInfo=${encodeURIComponent(done.orderNumber)}&accountName=${encodeURIComponent(bankInfo.account_name)}`;
```

Show amount, content = orderNumber, copy buttons (`navigator.clipboard.writeText`), text chờ xác nhận tự động.

- [ ] **Step 3: Manual verify**

1. Checkout shows only COD + CK.
2. Select CK → bank details appear (with env set).
3. Place bank order → success shows QR + order number as nội dung.
4. Place COD → old thank-you.

- [ ] **Step 4: Commit**

```bash
git add apps/storefront/src/lib/api.ts apps/storefront/src/lib/store.tsx apps/storefront/src/routes/thanh-toan.tsx
git commit -m "Show VietQR bank transfer instructions on checkout."
```

---

### Task 5: Admin payment column + mark paid

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/routes/index.tsx` (orders hydrate section)

**Interfaces:**
- Consumes: admin orders list fields + `POST /admin/orders/:id/mark-paid`
- Produces: payment badge text; button for awaiting bank rows

- [ ] **Step 1: API client**

Extend order item type with `payment_status`, `paid_at`, `payment_ref`.

```ts
markOrderPaid: (id: string) =>
  req<{ id: string; order_number: string; status: string; payment_status: string }>(
    `/admin/orders/${id}/mark-paid`,
    { method: "POST" },
  ),
```

- [ ] **Step 2: Orders table UI**

Where payment column is built (payLabel map), show e.g.:

- `cod` → `COD`
- `bank` + `awaiting` → `CK · chờ`
- `bank` + `paid` → `CK · đã TT`

Add per-row action when `payment_method === "bank" && payment_status === "awaiting"`: button calling `markOrderPaid`, then refresh list.

- [ ] **Step 3: Manual verify**

Create awaiting bank order in DB or via storefront → admin shows `CK · chờ` → mark paid → `CK · đã TT` + status confirmed.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/lib/api.ts apps/admin/src/routes/index.tsx
git commit -m "Show bank payment status and manual mark-paid in admin."
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| `payment_status` / `paid_at` / `payment_ref` | 1 |
| `sepay_webhook_events` | 1 |
| Env bank + secret | 2 |
| HMAC + match helpers | 2 |
| Webhook endpoint + dedup + confirm | 3 |
| Bank-info public | 3 |
| Place order awaiting/unpaid | 3 |
| Admin mark-paid API | 3 |
| Checkout COD+bank only + VietQR success | 4 |
| Admin UI badges + button | 5 |
| Out of scope (VA, email, card) | — no tasks |
