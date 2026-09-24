# ÉLANE Phase 1 — Design

Date: 2026-09-24  
Source requirements: `ELANE_BACKEND_SPEC.md` §10 Giai đoạn 1  
Repos: storefront `hello-world-project`, admin UI `hello-hub`

## Decisions (locked)

| Topic | Choice |
|---|---|
| Scope | Phase 1 only (platform + catalog + 1 warehouse + CMS + staff auth) |
| Layout | Monorepo: `apps/storefront`, `apps/admin`, `apps/api`, `packages/db` |
| API shape | Dedicated `apps/api` serving `/api/v1` (Approach 1) |
| Data / auth | Local Postgres + Drizzle; simple cookie sessions; seed staff accounts |
| Media | Local disk `uploads/` served as `/media/...` |

Out of scope for Phase 1: cart/checkout/orders/payments, returns, multi-warehouse transfer, suppliers, lookbook/blog/newsletter campaigns, MFA, external S3, customer accounts API.

## 1. Architecture

```
apps/storefront  --HTTP-->  apps/api  -->  Postgres (Docker)
apps/admin       --HTTP-->  apps/api  -->  uploads/ (local disk)
packages/db                 Drizzle schema + migrations
```

- Storefront and admin never talk to Postgres directly.
- Staff auth: HttpOnly session cookie; `account_sessions` with hashed refresh/session token.
- Public catalog endpoints need no auth; admin routes require session + permission (+ scope when relevant).
- Dev: `docker compose` for Postgres; three app processes; `VITE_API_URL` (or equivalent) on UIs.

### Repo migration

- Copy current `frontend/` → `apps/storefront`.
- Copy current `backend-ui/` → `apps/admin`; remove Supabase/Lovable Cloud coupling not used in Phase 1; trim nav modules outside Phase 1.
- Root `docker-compose.yml`, shared tooling (pnpm/bun workspaces as fits existing Bun lockfiles).

## 2. Database (Phase 1 tables)

Conventions: UUID PKs; `timestamptz` UTC; VND as `bigint`; soft-archive for catalog; no hard-delete of posted inventory documents; append-only `audit_logs` / `stock_movements`.

### Include

**Identity / staff:** `accounts`, `account_sessions`, `departments`, `employees`, `roles`, `permissions`, `role_permissions`, `employee_role_grants`

**Catalog:** `categories`, `occasions`, `products`, `product_categories`, `product_occasions`, `colors`, `sizes`, `product_variants`, `media_assets`, `product_media`, `size_charts`, `size_chart_measurements`, `collections`, `collection_products`

**Inventory (single warehouse):** `warehouses`, `inventory_balances`, `inventory_documents`, `inventory_document_lines`, `stock_movements`

**CMS / system:** `content_pages`, `content_revisions`, `banners`, `faqs`, `settings`, `seo_redirects`, `audit_logs`, `idempotency_records`

### Defer

Carts, orders, payments, shipments, returns, customers, wishlist, promotions, coupons, suppliers, POs, stocktakes, transfers (UI hidden), stores (warehouse stands alone), staff invitations, lookbooks, blog, newsletter.

### Seed

- Roles + permissions from spec samples (subset used in Phase 1).
- One warehouse `MAIN`.
- Categories, occasions, products, variants, media derived from current storefront mocks.
- Staff: `admin@elane.local` (system owner) + optional ops account; passwords documented in `.env.example` only.

## 3. API contract (Phase 1)

Prefix `/api/v1`. Errors: `{ code, message, field_errors?, request_id }`. Lists: page + whitelisted filters/sorts.

### Public

- `GET /products`, `/products/:slug`, `/categories`, `/occasions`, `/collections/:slug`
- `GET /homepage`, `/pages/:slug`, `/faqs`
- `GET /media/:key` (or static mount)
- Published only; never expose cost or drafts.

### Staff auth

- `POST /admin/auth/login`, `POST /admin/auth/logout`, `GET /admin/auth/me`
- Locking employee revokes sessions immediately.

### Admin catalog & media

- `GET/POST /admin/products`, `GET/PATCH /admin/products/:id`, `POST /admin/products/:id/publish`
- CRUD categories, occasions, colors, sizes, variants as needed
- `POST /admin/media/upload` → disk + `media_assets` row

### Admin inventory

- `GET /admin/inventory` (balances for `MAIN`)
- `POST /admin/inventory-documents` (draft)
- `POST /admin/inventory-documents/:id/approve`
- `POST /admin/inventory-documents/:id/post` (transaction updates balances + movements; idempotency key)
- No direct `PATCH` on balances.

### Admin CMS / staff / settings / overview

- Page revisions + publish; banners; FAQs
- Staff list/create/patch; role-grants (cannot grant permissions you lack)
- Settings (brand); audit log read
- `GET /admin/overview` — product counts, low stock, pending inventory docs (no order revenue)

## 4. Admin UI & storefront

### Admin (`apps/admin`)

Keep Swiss editorial look from `hello-hub`. Split routes (`/`, `/products`, `/inventory`, …) instead of one giant mock page.

**Keep wired:** login, overview, products (+ detail), categories/occasions, inventory docs, content (home/banners, static pages, FAQ), staff/roles, brand settings, audit read.

**Hide/remove:** suppliers, shipping, returns, full marketing, deep reports, real orders/customers modules.

UI hides actions by permission; server remains the authority.

### Storefront (`apps/storefront`)

- Replace `products.ts` / content mocks with public API clients.
- Home, category, product, FAQ, policy, collection pages read API.
- Cart / wishlist / checkout / customer login stay on localStorage until Phase 2.
- Images use API media URLs; seed copies existing assets into `uploads/`.

## 5. Errors, security, acceptance

**Errors:** Zod at boundaries; transactional post for inventory; reject bad MIME/size on upload.

**Security (Phase 1 bar):** password hash (argon2 or bcrypt); session cookie HttpOnly + Secure + SameSite; RBAC (+ warehouse scope where applicable); redact secrets from logs/audit payloads; public API strips cost/draft.

**Acceptance checks:**

1. Published product appears on storefront; draft does not.
2. Posting a receipt increases `on_hand`; same idempotency key does not double-apply.
3. Posted inventory document is immutable.
4. Scoped/low-privilege staff cannot read cost or other warehouses via API.
5. Locked staff lose access even with old cookie.
6. Slug change creates `seo_redirects` and public path resolves.

## 6. Non-goals reminder

No checkout, COD, stock reservation TTL, payment webhooks, returns/refunds, multi-hop transfers, or production object storage in this phase.
