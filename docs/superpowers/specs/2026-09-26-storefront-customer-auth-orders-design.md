# Storefront customer auth + wishlist + orders

Date: 2026-09-26  
Status: approved for planning

## Goal

Replace fake storefront login/register (`localStorage`) with real session auth. Sync wishlist and order history to the server. Checkout requires login; payment method is recorded only (no payment gateway). Admin Đơn hàng reads real orders (list + status), not mock rows.

## Decisions

| Topic | Choice |
|--------|--------|
| Scope | Auth + profile, addresses, wishlist, place/list orders; admin order list |
| Phases (one delivery) | (1) auth+profile (2) addresses+wishlist (3) orders+admin list |
| Checkout | **Must be logged in** (no guest checkout) |
| Payment | Keep UI options; persist `payment_method` only (`cod` \| `bank` \| `card` \| `wallet`) |
| Auth model | Reuse `accounts` + `account_sessions`; separate cookie from staff |
| Cart | Stay in browser `localStorage` until `POST /me/orders` |
| Inventory on place order | Increase `inventory_balances.reserved` when available (`on_hand - reserved`) is enough; reject otherwise |

## Out of scope

- Password reset / OTP / OAuth  
- Real payment capture  
- Guest checkout or server-side cart merge  
- Full admin order state machine (confirm/ship/cancel/refund)  
- Transactional email  

## Architecture

- **Staff** = `accounts` row + `employees` row; cookie `elane_session`.  
- **Customer** = `accounts` row + `customers` row (`account_id`); cookie `elane_customer_session`.  
- Same `account_sessions` table; resolve by cookie name + join shape (customer vs employee).  
- Storefront calls API with `credentials: "include"` (CORS already allows `STOREFRONT_ORIGIN`).

## Data model

### Alter `customers`

| Column | Notes |
|--------|--------|
| `account_id` | UUID NULL UNIQUE → `accounts.id` (required for registered storefront users) |

Existing CRM-only customers may remain without account until linked later (not in this scope).

### `wishlist_items`

| Column | Notes |
|--------|--------|
| `customer_id` | FK customers |
| `product_id` | FK products |
| PK | `(customer_id, product_id)` |
| `created_at` | timestamptz |

### `orders`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `order_number` | text UNIQUE (e.g. `ELN` + digits) |
| `customer_id` | FK customers NOT NULL (login required) |
| `status` | `pending` \| `confirmed` \| `cancelled` (default `pending`; admin may PATCH later) |
| `currency` | default `VND` |
| `subtotal_vnd` / `shipping_vnd` / `discount_vnd` / `grand_total_vnd` | integers |
| `payment_method` | `cod` \| `bank` \| `card` \| `wallet` |
| `recipient_snapshot` | jsonb `{ full_name, phone, email }` |
| `shipping_address_snapshot` | jsonb `{ address_line, city, district, note? }` |
| `placed_at` | timestamptz |
| `created_at` / `updated_at` | timestamptz |

### `order_items`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `order_id` | FK orders |
| `variant_id` | FK product_variants (keep reference) |
| `product_id` | FK products |
| `sku` / `product_name` / `size_label` / `color_label?` | snapshot text |
| `unit_price_vnd` | integer (sale or list at place time) |
| `qty` | integer > 0 |
| `line_total_vnd` | integer |

No payments/shipments tables in this iteration.

## API

### Store auth — `/api/v1/store/auth`

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/register` | Create account (bcrypt) + customer + session cookie |
| POST | `/login` | Verify password; require linked customer; set cookie |
| POST | `/logout` | Revoke session; clear cookie |
| GET | `/me` | Current customer profile (`customer_id`, `full_name`, `email`, `phone`) |
| PATCH | `/me` | Update `full_name`, `phone` (email immutable in v1) |

Reject staff-only accounts on store login (403). Duplicate email → 409.

### Authenticated customer — `/api/v1/me`

Requires `elane_customer_session`.

| Method | Path | Behavior |
|--------|------|----------|
| GET/POST | `/addresses` | List / create |
| PATCH/DELETE | `/addresses/:id` | Own addresses only |
| GET | `/wishlist` | Product ids (+ optional light product cards) |
| PUT | `/wishlist/:productId` | Idempotent add |
| DELETE | `/wishlist/:productId` | Idempotent remove |
| GET | `/orders` | List own orders |
| GET | `/orders/:id` | Detail + items |
| POST | `/orders` | Place order from cart payload |

`POST /orders` body:

```json
{
  "items": [{ "variant_id": "uuid", "qty": 1 }],
  "shipping": {
    "full_name": "...",
    "phone": "...",
    "email": "...",
    "address_line": "...",
    "city": "...",
    "district": "...",
    "note": "..."
  },
  "payment_method": "cod",
  "note": "optional order note"
}
```

Server loads prices from catalog; computes subtotal; shipping = `0` if subtotal ≥ 1_000_000 else `30000` (match storefront `FREE_SHIP`); validates stock; transaction: insert order + items, bump `reserved`.

### Admin — `/api/v1/admin/orders`

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/` | List orders (newest first); require auth + new perm `order.read` |
| GET | `/:id` | Detail |
| PATCH | `/:id` | Optional status update `pending`↔`confirmed`/`cancelled` (minimal) |

Wire admin Đơn hàng module to this API; empty state when none.

## Storefront UX

- `/dang-ky`, `/dang-nhap`: call store auth; remove fake `login({…})` only-local path.  
- Session: hydrate user via `GET /store/auth/me` on app load; drop `elane-user` as source of truth (may clear on migrate).  
- Wishlist heart: if logged out → toast + link login; if logged in → PUT/DELETE.  
- `/thanh-toan`: if no session → redirect `/dang-nhap?next=/thanh-toan`; submit → `POST /me/orders` then clear cart.  
- `/tai-khoan`: profile, addresses CRUD, wishlist, order list/detail from API.  
- Keep local cart + optimistic UI where useful; orders/wishlist authoritative from server when logged in.

## Error handling

| Case | Response |
|------|----------|
| Validation | 400 `validation_error` |
| Bad credentials | 401 `invalid_credentials` |
| No / invalid customer session | 401 `unauthorized` |
| Staff on store login | 403 `forbidden` |
| Email taken | 409 `conflict` |
| Insufficient stock | 400 `insufficient_stock` (include variant_id) |

## Testing

- Pure helpers: available qty (`on_hand - reserved`), order number format, shipping fee rule.  
- Selfchecks for cookie name constants and stock gate (no full e2e required in v1).

## Migration notes

- Drizzle migration: `customers.account_id`, `wishlist_items`, `orders`, `order_items`, perm `order.read` (+ grant to system roles in seed ensure).  
- Do not re-seed fake customers.
