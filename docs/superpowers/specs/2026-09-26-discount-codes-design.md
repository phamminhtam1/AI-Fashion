# Discount codes (admin + storefront checkout)

Date: 2026-09-26  
Status: approved for planning

## Goal

Ship real coupon codes: admin CRUD replaces the mock “Khuyến mãi” section; storefront applies one code on checkout with a preview; server recomputes `discount_vnd` when placing the order and increments usage atomically.

## Decisions

| Topic | Choice |
|--------|--------|
| Scope | Coupon codes only (no auto sale by product/category) |
| Discount types | `percent` and `fixed` (VND) |
| Limits | Schedule (`starts_at`/`ends_at`), `min_order_vnd`, `max_discount_vnd` (percent), global `usage_limit` + `usage_count` |
| Storefront UX | Checkout page only — preview then place order with `coupon_code` |
| Data shape | Flat `discount_codes` table (not full promotions + coupons + redemptions) |
| Stacking | One code per order |
| Trust | Client preview is UX only; place-order recalculates and validates under row lock |

## Out of scope

- Automatic catalog/sale promotions  
- Free-shipping coupons  
- Product/category targeting  
- Per-customer or first-order-only limits  
- Stackable codes / redemption reserve-commit lifecycle  
- Cart-page coupon UI  
- Fake marketing metrics on the admin promotions screen  

## Architecture

- Shared helper (API): validate code against now + subtotal → `{ discount_vnd }` or typed error.  
- Preview endpoint calls helper read-only.  
- `POST /me/orders` calls helper inside the existing place-order transaction, locks the code row, bumps `usage_count` when a code is applied.  
- Admin nav id `promotions` stays; content becomes the real discount-code list (no mock campaign rows).

## Data model

### `discount_codes`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `code` | text UNIQUE; stored uppercase; match case-insensitive |
| `name` | admin display label |
| `type` | `percent` \| `fixed` |
| `value` | integer; percent 1–100 or fixed VND > 0 |
| `min_order_vnd` | integer, default 0 |
| `max_discount_vnd` | integer nullable; used when `type=percent` |
| `starts_at` / `ends_at` | timestamptz nullable (null = open-ended on that side) |
| `usage_limit` | integer nullable (null = unlimited) |
| `usage_count` | integer default 0 |
| `status` | `active` \| `disabled` |
| `created_at` / `updated_at` | timestamptz |

### Alter `orders`

| Column | Notes |
|--------|--------|
| `discount_code_id` | UUID nullable FK → `discount_codes.id` |
| `discount_code` | text nullable snapshot of code at place time |

Existing `discount_vnd` remains the monetary amount applied.

### Formula

```
base = subtotal + shipping_vnd
raw = type === "percent"
  ? floor(base * value / 100)
  : value
if percent && max_discount_vnd != null: raw = min(raw, max_discount_vnd)
discount_vnd = clamp(raw, 0, base)
grand_total_vnd = base - discount_vnd
```

Discount may cover merchandise and shipping. `min_order_vnd` still checks merchandise subtotal only.

## API

### Permissions

Seed `promotion.read` and `promotion.write`; attach to admin role (same pattern as customer perms).

### Admin — `/api/v1/admin/discount-codes`

| Method | Path | Perm | Behavior |
|--------|------|------|----------|
| GET | `/` | `promotion.read` | List; query `status`, `q` (code/name ilike) |
| GET | `/:id` | `promotion.read` | Detail |
| POST | `/` | `promotion.write` | Create; normalize code uppercase; 409 on duplicate |
| PATCH | `/:id` | `promotion.write` | Update fields; unique check on code change |
| DELETE | `/:id` | `promotion.write` | Soft-disable (`status=disabled`); do not hard-delete rows referenced by orders |

### Storefront

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| POST | `/api/v1/store/coupons/preview` | customer session | Body `{ code, subtotal_vnd }` → `{ code, type, value, discount_vnd }` |
| POST | `/api/v1/me/orders` | customer (existing) | Optional `coupon_code`; revalidate + apply in place-order transaction |

Stable error codes: `coupon_not_found`, `coupon_inactive`, `coupon_not_started`, `coupon_expired`, `coupon_min_order`, `coupon_exhausted`.

Usage bump: only on successful order insert, with `usage_count < usage_limit` (or unlimited) checked in the same update.

## UI

### Admin

- Replace mock promotions panel with discount-code table + create/edit dialog.  
- Columns: code, name, type/value, min order, usage (`count`/`limit` or ∞), schedule, status.  
- Actions: create, edit, disable.  
- No fake metric cards or campaign tabs.

### Storefront checkout (`thanh-toan`)

- Coupon input + Apply in order summary aside.  
- On success: show discount line; allow clear.  
- Totals use previewed `discount_vnd` until place; place sends `coupon_code`.  
- On place rejection for coupon: show error; keep cart.

### Order displays

- When `discount_vnd > 0`, show discount (and code snapshot if present) on storefront order detail and admin order views that already show totals.

## Testing

- Helper unit/assert: percent + cap, fixed, clamp to subtotal, min-order reject.  
- One integration-style check: valid code on place order → correct `discount_vnd` and `usage_count++`; exhausted code → 400.

## Migration notes

- Drizzle migration for `discount_codes` + order columns.  
- Seed promotion permissions for existing admin (idempotent ensure like customer perms).
