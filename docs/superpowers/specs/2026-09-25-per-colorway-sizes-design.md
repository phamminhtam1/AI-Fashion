# Per-colorway sizes

## Goal
Each product colorway has its own sellable size list. SKUs exist only for selected (colorway, size) pairs.

## Decision
- No new tables — `product_variants (product_id, colorway_id, size_id)` already encodes this.
- New color copies sizes from the **currently active** color (admin UI + API body).

## API
- `POST /products` — `size_ids` applies to the **first** colorway only.
- `POST /products/:id/colorways` — body `{ size_ids?: uuid[] }`; if provided, create variants for those sizes; if omitted, no sizes until update.
- `PATCH /products/:id` — `colorway_sizes: [{ colorway_id, size_ids }]` syncs each colorway independently (activate/create missing, deactivate extras for that colorway only). Deprecate product-level cartesian sync of shared `size_ids`.

## Admin UI
- “Size bán” sits under the active color tab (after that color’s images).
- Draft colorways carry `size_ids`; add color copies active draft’s (or active edit colorway’s) sizes.
- Save sends `colorway_sizes` when editing.

## Storefront
Unchanged — PDP already filters sizes from variants for the selected colorway.
