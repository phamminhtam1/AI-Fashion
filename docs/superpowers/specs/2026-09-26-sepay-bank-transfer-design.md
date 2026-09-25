# Sepay bank transfer payments

Date: 2026-09-26  
Status: approved for planning

## Goal

Thực thi thanh toán **chuyển khoản ngân hàng** qua **SePay webhook** (tự khớp CK), kèm VietQR trên màn đặt hàng thành công. Checkout chỉ còn COD + chuyển khoản.

## Locked decisions

| Topic | Choice |
|-------|--------|
| Provider | **SePay** (webhook + VietQR client-side) |
| Matching | **1** — `order_number` trong nội dung CK + `transferAmount === grand_total_vnd` |
| Checkout methods | **A** — chỉ COD + bank (ẩn card/wallet) |
| Auth webhook | HMAC-SHA256 (`X-SePay-Signature`, `X-SePay-Timestamp`, skew ≤ 300s) |
| Stock | Giữ reserve khi đặt hàng (COD và bank) như hiện tại |

## Data model

### Alter `orders`

| Column | Type | Notes |
|--------|------|--------|
| `payment_status` | text NOT NULL | `unpaid` \| `awaiting` \| `paid` \| `failed` |
| `paid_at` | timestamptz NULL | |
| `payment_ref` | text NULL | SePay transaction `id` (string) hoặc `manual` |

Defaults on place order:

| Method | `payment_method` | `payment_status` | `orders.status` |
|--------|------------------|------------------|-----------------|
| COD | `cod` | `unpaid` | `pending` |
| Bank | `bank` | `awaiting` | `pending` |

When bank payment confirmed (webhook or admin manual):

- `payment_status = paid`
- `paid_at = now()`
- `payment_ref = <sepay id | "manual">`
- `orders.status = confirmed` (only if still `pending`)

### `sepay_webhook_events`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `sepay_id` | bigint UNIQUE — dedup key from payload `id` |
| `payload` | jsonb |
| `matched_order_id` | UUID NULL FK orders |
| `created_at` | timestamptz |

## Config (env)

| Var | Purpose |
|-----|---------|
| `SEPAY_WEBHOOK_SECRET` | HMAC secret |
| `SEPAY_BANK_ACCOUNT` | Số tài khoản |
| `SEPAY_ACCOUNT_NAME` | Chủ TK |
| `SEPAY_BANK_NAME` | Tên ngân hàng (hiển thị) |
| `SEPAY_BANK_BIN` | BIN/NAPAS cho `img.vietqr.io` |

Storefront đọc thông tin bank qua endpoint public nhẹ (không lộ secret), hoặc embed từ loader đọc API config đã lọc.

## API

### `POST /api/v1/webhooks/sepay`

- Public (no session). Raw body for HMAC.
- Verify signature; reject 401 if invalid/expired timestamp.
- Parse JSON; if `transferType !== "in"` → record optional, return `{"success":true}`.
- Insert `sepay_webhook_events` by `sepay_id`; if duplicate → return success (idempotent).
- Resolve order: `payment_method = bank`, `payment_status = awaiting`, and (`code` equals `order_number` OR `content` contains `order_number`), and `transferAmount === grand_total_vnd`.
- On match: mark paid + confirm as above; set `matched_order_id`.
- Amount/code mismatch: keep event, do not change order; still `{"success":true}` when auth OK.
- Response contract: HTTP 200 + body exactly `{"success":true}`.

### Admin

- List/detail expose `payment_status`, `paid_at`, `payment_ref`.
- `POST /admin/orders/:id/mark-paid` — only when `bank` + `awaiting`; sets paid with `payment_ref=manual`.

### Public bank info

- `GET /api/v1/payments/bank-info` → `{ account_number, account_name, bank_name, bank_bin }` (no secrets).

## Storefront UX

### Checkout (`/thanh-toan`)

- Radios: COD | Chuyển khoản ngân hàng only.
- Selecting bank: show account summary from bank-info (STK, tên, ngân hàng) + note “Nội dung CK = mã đơn sau khi đặt”.

### Success state

- **COD:** keep current thank-you copy.
- **Bank:** show order number, amount, STK, account name, bank name, transfer content = `order_number`, VietQR image:

  `https://img.vietqr.io/image/{bank_bin}-{account_number}-compact2.png?amount={grand_total}&addInfo={order_number}&accountName={urlencoded name}`

  + copy buttons for account / content; text that confirmation is automatic after transfer.

### Account / history

- Show payment status label for bank orders (Chờ chuyển khoản / Đã thanh toán) if order list already surfaces method — minimal: reuse existing order list fields when API returns `payment_status`.

## Admin UX

- Orders table: payment column shows method + status (e.g. `CK · chờ` / `CK · đã TT` / `COD`).
- Action **Đánh dấu đã nhận tiền** for `awaiting` bank orders.

## SePay dashboard setup (ops, not code)

- Webhook URL: `https://<api-host>/api/v1/webhooks/sepay`
- Auth: HMAC-SHA256; paste secret into `SEPAY_WEBHOOK_SECRET`
- Event: money in
- Payment code structure: configure so SePay extracts `order_number` into payload `code` (prefix/suffix per company settings)

## Out of scope

- Card / MoMo / ZaloPay gateways  
- Virtual Account per order  
- Auto-cancel unpaid bank orders after timeout  
- Transactional email / SMS  
- Refunds / partial payments  
- Matching on amount-only  

## Error handling

- Invalid HMAC → 401, no success body  
- Duplicate `sepay_id` → success, no double-confirm  
- Already `paid` order → success, no-op  
- Wrong amount / unknown code → event stored, order unchanged  
