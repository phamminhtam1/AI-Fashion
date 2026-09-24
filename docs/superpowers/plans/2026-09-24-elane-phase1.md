# ÉLANE Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo with Postgres + Drizzle API (`/api/v1`), admin staff auth, catalog/inventory/CMS, and storefront reading published data from the API.

**Architecture:** `apps/api` (Hono) owns all mutations and DB access; `apps/storefront` and `apps/admin` are TanStack Start UIs calling HTTP; `packages/db` holds Drizzle schema/migrations; media on local `uploads/`.

**Tech Stack:** Node 22, npm workspaces, Hono, Drizzle ORM, Postgres 16 (Docker), Zod, bcrypt, cookie sessions, TanStack Start + React 19 (existing UIs).

## Global Constraints

- Phase 1 only per `docs/superpowers/specs/2026-09-24-elane-phase1-design.md`
- VND as `bigint`; UUID PKs; `timestamptz` UTC
- No checkout/orders; no Supabase; no direct balance PATCH
- Public API never returns cost or drafts
- Password hash with bcrypt; session cookie HttpOnly
- Prefer npm (Bun not installed on this machine)

## File map

| Path | Responsibility |
|---|---|
| `docker-compose.yml` | Postgres 16 |
| `package.json` | npm workspaces root |
| `packages/db/` | Drizzle schema, client, migrate, seed |
| `apps/api/` | Hono `/api/v1` + `/media` |
| `apps/storefront/` | ÉLANE storefront (from `frontend/`) |
| `apps/admin/` | Admin UI (from `backend-ui/`, trimmed) |
| `uploads/` | Local media (gitignored) |
| `.env.example` | DATABASE_URL, SESSION_SECRET, ports |

---

### Task 1: Monorepo scaffold + Postgres

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `docker-compose.yml`, `README.md`
- Move: `frontend/` → `apps/storefront/`, `backend-ui/` → `apps/admin/`

- [ ] **Step 1:** Create root workspace files and docker-compose
- [ ] **Step 2:** Move apps; strip admin Supabase deps from package.json later in Task 7
- [ ] **Step 3:** `docker compose up -d` and verify Postgres accepts connections
- [ ] **Step 4:** Smoke: `docker compose ps` shows healthy postgres

**Done when:** Postgres running; folders `apps/storefront`, `apps/admin` exist.

---

### Task 2: `packages/db` schema + migrate + seed

**Files:**
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/schema/*.ts`, `packages/db/src/index.ts`, `packages/db/src/client.ts`, `packages/db/drizzle.config.ts`, `packages/db/src/seed.ts`

**Produces:**
- `db` client export
- Tables listed in design §2
- `npm run db:migrate` / `npm run db:seed` from root

- [ ] **Step 1:** Define Drizzle schema for Phase 1 tables
- [ ] **Step 2:** Generate/run migration against Docker Postgres
- [ ] **Step 3:** Seed roles, permissions, warehouse MAIN, categories/occasions/products from storefront mock data, admin@elane.local / `ElaneAdmin1!`
- [ ] **Step 4:** Verify with SQL count of products > 0

**Done when:** migrate + seed succeed; admin account exists.

---

### Task 3: `apps/api` core + auth

**Files:**
- Create: `apps/api/package.json`, `apps/api/src/index.ts`, `apps/api/src/env.ts`, `apps/api/src/lib/errors.ts`, `apps/api/src/lib/session.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/admin/auth.ts`
- Test: `apps/api/src/routes/admin/auth.test.ts` (node:test or vitest)

**Produces:**
- `POST /api/v1/admin/auth/login` `{ email, password }` → Set-Cookie `elane_session`
- `POST /api/v1/admin/auth/logout`
- `GET /api/v1/admin/auth/me` → account + employee + permissions
- Error shape `{ code, message, field_errors?, request_id }`

- [ ] **Step 1:** Scaffold Hono app with CORS for storefront/admin origins
- [ ] **Step 2:** Implement session create/verify/revoke (token hash in `account_sessions`)
- [ ] **Step 3:** Login/logout/me routes + bcrypt verify
- [ ] **Step 4:** Test login success + bad password + locked account

**Done when:** curl login returns cookie; me works; logout clears session.

---

### Task 4: Public catalog + media + CMS reads

**Files:**
- Create: `apps/api/src/routes/public/products.ts`, `categories.ts`, `occasions.ts`, `collections.ts`, `homepage.ts`, `pages.ts`, `faqs.ts`, `media.ts`

**Produces:** endpoints in design §3 Public

- [ ] **Step 1:** List/detail products (published only, filter category/occasion)
- [ ] **Step 2:** Categories, occasions, collection by slug
- [ ] **Step 3:** Homepage (banners + featured), pages, faqs
- [ ] **Step 4:** Serve `/media/:key` from `uploads/`
- [ ] **Step 5:** Curl `GET /api/v1/products` returns seeded items

**Done when:** public GETs work without auth; drafts absent.

---

### Task 5: Admin catalog, inventory, CMS, staff, overview

**Files:**
- Create: `apps/api/src/routes/admin/products.ts`, `inventory.ts`, `media-upload.ts`, `content.ts`, `staff.ts`, `settings.ts`, `overview.ts`, `audit.ts`
- Create: `apps/api/src/lib/rbac.ts`, `apps/api/src/lib/inventory-post.ts`

**Produces:** admin endpoints in design §3; inventory post transactional + idempotent

- [ ] **Step 1:** RBAC helper `requirePermission(code)`
- [ ] **Step 2:** Products CRUD + publish + slug redirect
- [ ] **Step 3:** Media upload (jpeg/png/webp, max 5MB)
- [ ] **Step 4:** Inventory list + document draft/approve/post
- [ ] **Step 5:** Content pages/banners/faqs; staff; settings; overview; audit read
- [ ] **Step 6:** Test: post receipt → on_hand++; same idempotency key no double; posted immutable

**Done when:** acceptance checks 1–3 and 6 pass via curl/script.

---

### Task 6: Wire storefront to API

**Files:**
- Modify: `apps/storefront/src/lib/products.ts` → API client wrappers (keep types)
- Create: `apps/storefront/src/lib/api.ts`
- Modify: routes that import products/content to async fetch
- Create: `apps/storefront/.env.example` with `VITE_API_URL=http://localhost:3001`

- [ ] **Step 1:** Add `api.ts` fetch helper
- [ ] **Step 2:** Replace static product/category loaders with API
- [ ] **Step 3:** Homepage/FAQ/policies from API where applicable
- [ ] **Step 4:** Leave cart/wishlist/checkout on localStorage
- [ ] **Step 5:** Manual: storefront shows seeded products when API up

**Done when:** storefront product list matches API published set.

---

### Task 7: Wire admin UI (trim + API)

**Files:**
- Modify: `apps/admin` routes — split login + modules
- Create: `apps/admin/src/lib/api.ts`, auth context
- Remove: unused supabase integration imports from runtime paths
- Hide nav: suppliers, shipping, returns, marketing, deep reports, orders/customers

- [ ] **Step 1:** Login page calling API; protect routes
- [ ] **Step 2:** Overview + products list/detail wired
- [ ] **Step 3:** Inventory balances + post document flow
- [ ] **Step 4:** Content/settings/staff minimal lists
- [ ] **Step 5:** Manual smoke of login → publish → storefront

**Done when:** admin can login, edit product, post stock; storefront reflects publish.

---

### Task 8: Acceptance script + README

**Files:**
- Create: `scripts/phase1-acceptance.mjs`
- Modify: `README.md` with run instructions

- [ ] **Step 1:** Script covers design acceptance 1–6 where automatable
- [ ] **Step 2:** Document ports: API 3001, storefront 8080, admin 8081, Postgres 5432
- [ ] **Step 3:** Run script; fix failures

**Done when:** acceptance script exits 0; README accurate.
