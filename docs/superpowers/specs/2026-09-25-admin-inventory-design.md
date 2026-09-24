# Admin inventory (Kho hàng) — Phase 1

Date: 2026-09-25  
Status: approved for planning

## Goal

Replace the admin mock “Kho hàng” section with a real inventory workspace: stock balances for warehouse `MAIN`, plus inventory documents (receipt / issue / adjustment) with draft → approve → post. Product forms no longer write stock; they only display balances.

## Decisions

| Topic | Choice |
|--------|--------|
| Scope | Stock list + document UI + API list/detail enrich; single warehouse `MAIN` |
| UI shape | One `InventoryManager` (list ↔ form), same pattern as categories/products |
| Product stock | View-only on product form; all qty changes via documents |
| Document workflow | Draft → Approve → Post (three steps) |
| Document types | `receipt`, `issue`, `adjustment` |
| Direct balance PATCH | Forbidden (already absent); remove product `size_stocks` write path |
| Out of scope | Transfer, stocktake, multi-warehouse, barcode scan, void UI, reorder_point editor |

## Screens

### List

- Metrics: SKU count · low stock · pending docs (draft + approved)
- Tabs: `Tất cả` | `Sắp hết` | `Hết hàng` | `Phiếu`
- Stock tabs: searchable table — product name, color/size, SKU, on_hand, reserved, available, reorder_point
- Filters: low = `available <= reorder_point`; out = `available === 0`
- Phiếu tab: document list (code, type, status, reason, dates) → open detail form
- CTA: **Tạo phiếu** → form (type picker)

### Document form

- Breadcrumb + full-width two-column layout (match category form)
- Left: type, reason, line editor (variant picker + qty; direction in/out for adjustment; issue forced out; receipt forced in)
- Right: status summary + actions by state:
  - **Compose (new):** fill lines → **Tạo phiếu** → creates `draft` in one shot (no PATCH draft in MVP; wrong draft → create a corrective document later)
  - `draft` (opened): lines read-only → **Duyệt**
  - `approved`: **Ghi sổ** (sends `Idempotency-Key`)
  - `posted`: read-only
- Posted documents are immutable (no edit lines; no PATCH endpoint)

### Product form change

- Remove editable qty inputs / bulk apply
- Show per-size on_hand (and available if useful) as read-only
- Link/CTA: “Điều chỉnh qua phiếu kho” → navigate to inventory create form (optional deep-link with product filter later; MVP can just switch section)

## API

Prefix: `/api/v1/admin/inventory` (existing mount).

### Extend

- `GET /` — join product + color + size labels on each balance row (today only SKU)
- `GET /documents` — **new**; list docs with optional `status`, `type` query; newest first; include line_count
- `GET /documents/:id` — **new**; header + lines with variant sku / product name / color / size

### Keep

- `POST /documents` — create draft; permission gate stays `inventory.receive` for all types (matches current API; split by type later if needed)
- No `PATCH` documents/lines in this iteration
- `POST /documents/:id/approve` — requires `inventory.adjust.approve`; draft → approved
- `POST /documents/:id/post` — requires `inventory.adjust.approve` + `Idempotency-Key`; updates balances + `stock_movements` in one transaction

### Products

- Stop applying `size_stocks` on create/update (delete or no-op `applySizeStocks`)
- New variants still get `inventory_balances` row with `on_hand = 0`
- GET product still returns `size_stocks` / `stock_total` for display

## Admin wiring

- New `apps/admin/src/components/InventoryManager.tsx`
- Wire `section === "inventory"` in `routes/index.tsx` (replace mock table)
- Extend `adminApi` with documents list/get; ensure post sends idempotency header
- Permissions: hide approve/post buttons without perm; server remains authority

## Errors (UI)

| Code / case | UX |
|-------------|-----|
| `insufficient_stock` | Toast; keep form open |
| `invalid_state` / `already_posted` | Toast; reload document |
| `idempotency_required` / conflict | Toast; regenerate key only on new post attempt |
| Validation (empty lines, qty ≤ 0) | Inline / toast before submit |

## Acceptance

1. Receipt draft → approve → post increases `available` by line qty.
2. Same `Idempotency-Key` on post does not double-apply.
3. Product form cannot change on_hand.
4. Low / out tabs filter correctly.
5. Posted document UI is read-only; API rejects line edits (no PATCH).

## Non-goals reminder

No checkout reservations UI, transfers, stocktakes, cost reporting, or warehouse switcher.
