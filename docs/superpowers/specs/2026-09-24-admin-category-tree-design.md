# Admin multi-level categories (Approach A)

Date: 2026-09-24  
Status: approved for planning

## Goal

Admin category CRUD must match the storefront’s multi-level taxonomy (parent nav → children in mega menu). Today the DB/API already have `parent_id`, but admin UI is flat and seed has only roots. Storefront mega menu stays hardcoded for this scope.

## Decisions

| Topic | Choice |
|--------|--------|
| Depth | Unlimited tree via `parent_id` |
| Product attachment | Leaf nodes only |
| Scope | Admin + API + seed only (no storefront mega menu wiring) |
| Storage | Keep existing `categories` table; no path/nested-set columns |
| Archive | Cascade to entire subtree |
| Hard delete | Only if no products on any node in subtree; delete whole subtree |
| Unarchive | Selected node only (children stay archived until restored) |

## Data model

No schema migration required for hierarchy (column already exists):

- `categories.parent_id` — nullable self-reference (root = `null`)
- Existing: `slug` unique, `sort_order`, `status` (`active` \| `archived`), SEO fields

Helpers (API-side, not new columns):

- `depth` — walk parents
- `child_count` — count rows with this `parent_id`
- `is_leaf` — `child_count === 0`
- `product_count` — count rows in `product_categories` for that category (same as current admin API; primary category is always included in that join)

Cycle rule: when setting/changing `parent_id`, reject if new parent is self or any descendant.

Leaf rule for products:

- Create/update product: reject if target category has any children (any status)
- Creating a child under a category that already has products: reject until products are moved off that node

## API changes (`/api/v1/admin/categories`)

### List / get

Return for each row: existing fields plus `parent_id`, `depth`, `child_count`, `is_leaf`, `product_count`.

Order: tree order (DFS by `sort_order` within siblings) or flat list + client builds tree — prefer server returns flat list with `parent_id`/`depth`; client builds indented rows.

### Create / update

- Accept `parent_id: uuid | null`
- Validate parent exists (if set)
- Validate no cycle
- Keep current slug uniqueness and soft status behavior

### Soft delete (archive, default DELETE)

- Set `status = archived` on the target **and all descendants**
- Audit: `category.archive` (include subtree ids in redacted payload)

### Hard delete (`?hard=1`)

- If any node in subtree has `product_count > 0` → `409 in_use`
- Else delete all rows in subtree (children first or single transaction)
- Audit: `category.delete`

### Products

- Admin product create/update: `primary_category_id` must reference a leaf
- `/admin/products/meta` categories list: include `parent_id`, `is_leaf` so UI can filter leaves

### Public catalog

No required change this iteration. Optional later: expose `parent_id` on `GET /categories`.

## Admin UI (`CategoriesManager`)

- Indented table by `depth` (tree visual)
- Expand/collapse per branch (default: all expanded)
- Form: “Danh mục cha” select (tree-labeled options + “— Gốc —”); exclude self and descendants when editing
- Row action: “Thêm con” opens form with `parent_id` prefilled
- Keep separate Archive vs Hard-delete controls and bulk equivalents (cascade per rules above)
- Show product count primarily on leaves; non-leaves show “—” or child summary

### ProductsManager

- Category dropdown: **leaves only**, optionally grouped/optgroup by ancestor path label

## Seed

- Keep current root categories
- Add sample children aligned with storefront mega hardcode, e.g.:
  - under `ao`: áo sơ mi, áo kiểu, áo len, áo thun, áo croptop, áo tank top, áo vest
  - under `vay-dam` / `quan`: matching mega columns
- Re-point any seeded products that used a parent slug to an appropriate **leaf**

## Out of scope

- Wiring storefront `Header` mega menu to API
- Nested-set / materialized path columns
- Drag-and-drop reorder across parents (sort_order within siblings remains as today)
- “Nổi bật” / promo image columns in mega menu

## Test / verification

- Create root + child + grandchild; cycle attempt fails
- Archive parent → all descendants archived
- Hard-delete parent with product on leaf → 409; after moving/removing products → subtree gone
- Product create on non-leaf → rejected
- Admin list shows indentation; product form only lists leaves
- One small API-level assert or script covering cycle + leaf checks (ponytail: no heavy test framework)

## Implementation units

1. Category tree helpers + admin category route rules (archive cascade, hard subtree, cycle, list enrichments)
2. Product leaf validation + meta shape
3. `CategoriesManager` tree UI + parent picker + Thêm con
4. `ProductsManager` leaf-only category select
5. Seed children + retarget products
