# Per-colorway sizes Implementation Plan

> **For agentic workers:** implement task-by-task; no commits unless asked.

**Goal:** Each colorway has its own size list; new color copies active color’s sizes.

**Files:**
- `apps/api/src/routes/admin/products.ts` — sync + create colorway body
- `apps/admin/src/components/ProductsManager.tsx` — per-tab size_ids
- `apps/admin/src/lib/api.ts` — createColorway optional size_ids
- `docs/superpowers/specs/2026-09-25-per-colorway-sizes-design.md` — done

## Task 1: API sync helper
Replace product-level cartesian `size_ids` sync with `colorway_sizes: [{ colorway_id, size_ids }]`.
`POST .../colorways` accepts `{ size_ids?: string[] }` and only creates those variants (no “all product sizes”).

## Task 2: Admin form
Draft/edit: sizes live on each colorway; Size bán under active color; add color copies active sizes; save sends `colorway_sizes` / create passes per-colorway `size_ids`.

## Task 3: Rebuild admin + smoke
Docker rebuild admin; create product with 2 colors different sizes.
