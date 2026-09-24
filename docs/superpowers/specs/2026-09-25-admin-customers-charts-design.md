# Admin customers + operational charts (Phase 2 light)

Date: 2026-09-25  
Status: approved for planning

## Goal

Replace the mock **Khách hàng** admin module with real customer CRUD (profiles, manual segments, addresses). Enrich **Tổng quan** and the customers page with charts/metrics backed by catalog, inventory, and customer data — **no orders/revenue** (still deferred).

## Decisions

| Topic | Choice |
|--------|--------|
| Scope | Customers + addresses + manual segments; overview/customer charts from existing ops data |
| Out of scope | Orders, payments, customer login/accounts, wishlist, order-derived LTV/order counts |
| Segments | Manual enum: `new` \| `loyal` \| `vip` \| `care` |
| Charts | No new chart library — CSS/SVG bars (existing dashboard pattern) with real API series |
| UI pattern | `CustomersManager` list ↔ form (same as products/inventory) |

## Data model

### `customers`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `full_name` | required |
| `email` | nullable |
| `phone` | nullable |
| `segment` | `new` \| `loyal` \| `vip` \| `care`, default `new` |
| `status` | `active` \| `blocked`, default `active` |
| `internal_note` | text, default `''` |
| `created_at` / `updated_at` | timestamptz |

No `account_id` in this iteration.

### `customer_addresses`

| Column | Notes |
|--------|--------|
| `id` | UUID PK |
| `customer_id` | FK customers |
| `recipient_name` | required |
| `phone` | required |
| `address_line` | required |
| `administrative_units` | jsonb, default `{}` (e.g. province/district/ward keys) |
| `is_default` | boolean; at most one default per customer (enforce in API transaction) |
| `created_at` | timestamptz |

### Migration + seed

- Drizzle migration for both tables.
- Seed 8–12 sample customers across segments, each with 0–2 addresses.
- Permissions: `customer.read`, `customer.write`; grant to admin role in seed (and upgrade path if seed already applied).

## API

Prefix: `/api/v1/admin/customers` (auth required).

| Method | Path | Perm | Behavior |
|--------|------|------|----------|
| GET | `/` | customer.read | List; query `segment`, `status`, `q` (name/phone/email); include `address_count` |
| GET | `/:id` | customer.read | Detail + `addresses[]` |
| POST | `/` | customer.write | Create customer |
| PATCH | `/:id` | customer.write | Update fields including segment/status |
| POST | `/:id/addresses` | customer.write | Add address; if `is_default`, clear other defaults |
| PATCH | `/:id/addresses/:aid` | customer.write | Update address |
| DELETE | `/:id/addresses/:aid` | customer.write | Delete; if was default, optionally promote another (or leave none) |

No hard-delete customer endpoint in MVP (block via `status` only). Future orders will RESTRICT delete.

### Overview extension

`GET /admin/overview` adds (alongside existing product/inventory counts):

```ts
{
  // existing…
  customer_total: number;
  customers_by_segment: Array<{ segment: string; count: number }>;
  products_by_status: Array<{ status: string; count: number }>;
  low_stock_by_category: Array<{ category_name: string; sku_count: number }>; // top ~8
  inventory_docs_by_type: Array<{ type: string; count: number }>;
  recent_inventory_docs?: Array<{ id; code; type; status; created_at }>; // optional, limit 5
}
```

Requires `product.read` (current overview gate) or also allow if user has `customer.read` for customer fields — keep single gate `product.read` for overview simplicity; customer counts still returned for admin.

## Admin UI

### `CustomersManager`

- Wire `active === "customers"` (replace mock `ModulePage`).
- Metrics: total, VIP, care, blocked (or active).
- Tabs by segment + all; search.
- Form: name, phone, email, segment, status, note; address list editor (add/edit/default/delete).
- Vietnamese labels: Mới / Thân thiết / VIP / Cần chăm sóc; Đang hoạt động / Đã khóa.
- Small segment distribution chart (bar or simple proportional blocks) from list aggregates or overview payload.

### Dashboard (`Tổng quan`)

- Replace fake revenue/order KPIs with real: published products, low-stock SKUs, pending inventory docs, customer total.
- Chart: products by status (bars).
- Chart/list: low stock by category (replace mock size alerts).
- Replace recent orders table with recent inventory docs or low-stock SKUs (link to inventory/products).
- Leave promotions/lookbook mock widgets or soften copy — YAGNI: leave as decorative unless trivial to hide.

## Acceptance

1. Create customer + default address; list filters by segment; block sets status.
2. Overview KPIs match DB counts; charts change when seed/data changes.
3. Customers page shows segment distribution consistent with list totals.
4. No order/revenue numbers presented as real.

## Non-goals

Checkout, guest carts, customer auth, promotions engine, full reports module, chart.js/recharts dependency.
