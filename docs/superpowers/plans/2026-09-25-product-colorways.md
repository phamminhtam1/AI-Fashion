# Product Colorways Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-product colorways with their own image galleries; storefront Pantio-style thumbnail color picker; variants = colorway × size (SKU); no catalog `colors` on product forms.

**Architecture:** New `product_colorways` table. Variants and media FK to `colorway_id` instead of global `colors`. Pure helper builds public `colorways[]` from media rows. Admin product form uses tabs per colorway. Storefront PDP switches gallery by selected colorway; cart lines key on `variantId`/`sku`.

**Tech Stack:** Drizzle + Postgres, Hono API, React admin (`ProductsManager`), TanStack storefront, `tsx --test` / assert self-check.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-25-product-colorways-design.md`
- No required colorway name; orders show product name; ops use SKU
- Empty colorways stay in admin; omit from public `colorways[]`
- Upload requires `colorway_id` belonging to the product
- Keep global `colors` table; stop using it on product create/edit
- Vietnamese UI copy
- Commits: only when the human explicitly asks; skip commit steps unless told
- After admin/storefront UI changes: `docker compose up --build -d admin` / `storefront` as needed so containers pick up files

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/db/src/schema.ts` | `productColorways` table; variants/media `colorwayId` |
| `packages/db/drizzle/0003_*.sql` | DDL + data remap from `color_id` |
| `packages/db/src/seed.ts` | Seed colorways instead of only catalog colors on variants |
| `apps/api/src/lib/colorways.ts` | Pure: build public colorways payload from rows |
| `apps/api/src/lib/colorways.selfcheck.ts` | Assert grouping / empty omit |
| `apps/api/src/routes/admin/products.ts` | Create default colorway; sync variants by colorway×size; colorway CRUD routes |
| `apps/api/src/routes/admin/media.ts` | Require + persist `colorway_id` |
| `apps/api/src/routes/public/catalog.ts` | `mapProduct` joins colorways; emit `colorways` + `colorway_id` on variants |
| `apps/admin/src/lib/api.ts` | Types + colorway/media client helpers |
| `apps/admin/src/components/ProductsManager.tsx` | Tabs UI; no catalog color chips |
| `apps/storefront/src/lib/api.ts` | `ApiProduct` colorways shape |
| `apps/storefront/src/lib/products.ts` | Map colorways → Product |
| `apps/storefront/src/lib/store.tsx` | Cart by `variantId` + `sku` |
| `apps/storefront/src/routes/san-pham.$slug.tsx` | Thumbnail color picker + gallery switch |
| `apps/storefront/src/components/site/ProductCard.tsx` | Add-to-cart via first colorway variant |
| Cart/checkout UIs (`gio-hang`, `thanh-toan`, `Header`) | Show name + size + SKU (drop color name) |

---

### Task 1: Schema + migration

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0003_product_colorways.sql` (name from `npm run db:generate` if preferred; must include data remap)
- Modify: `packages/db/src/seed.ts` (minimal: insert colorway per product, variants use `colorwayId`)

**Interfaces:**
- Produces:
  - `productColorways` table: `{ id, productId, sortOrder, createdAt }`
  - `productVariants.colorwayId` (uuid NOT NULL → `product_colorways.id`)
  - `productMedia.colorwayId` (uuid nullable during migrate; new uploads NOT NULL in API)
  - Drop `productVariants.colorId` / `productMedia.colorId` after remap
  - Unique index `variant_pcs_uq` on `(productId, colorwayId, sizeId)`

- [ ] **Step 1: Add `productColorways` and switch FKs in schema**

Insert after `colors` table (keep `colors`):

```ts
export const productColorways = pgTable("product_colorways", {
  id: id(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});
```

On `productVariants`: replace `colorId` with:

```ts
colorwayId: uuid("colorway_id")
  .notNull()
  .references(() => productColorways.id),
```

Unique: `uniqueIndex("variant_pcs_uq").on(t.productId, t.colorwayId, t.sizeId)`.

On `productMedia`: replace `colorId` with:

```ts
colorwayId: uuid("colorway_id").references(() => productColorways.id),
```

- [ ] **Step 2: Generate / write migration SQL with data remap**

Run: `npm run db:generate -w @elane/db`  
Then ensure the SQL (hand-edit if generate is drop-only) does in order:

1. `CREATE TABLE product_colorways (...)`
2. Insert one colorway per distinct `(product_id, color_id)` from `product_variants` (and for products that only have media):

```sql
INSERT INTO product_colorways (id, product_id, sort_order)
SELECT gen_random_uuid(), v.product_id, ROW_NUMBER() OVER (PARTITION BY v.product_id ORDER BY MIN(c.code)) - 1
FROM product_variants v
JOIN colors c ON c.id = v.color_id
GROUP BY v.product_id, v.color_id;
```

(Use a temp map table `colorway_map(product_id, color_id, colorway_id)` if cleaner.)

3. `ALTER TABLE product_variants ADD COLUMN colorway_id uuid;`
4. Update variants from map; `SET NOT NULL`; drop FK/index on `color_id`; drop column `color_id`; add FK + new unique index.
5. Same for `product_media`: add `colorway_id`, map where `color_id` matches; for `color_id IS NULL` set to the product's lowest `sort_order` colorway (create a colorway if product has media but no variants).
6. Drop `product_media.color_id`.

- [ ] **Step 3: Update seed**

Where seed inserts variants with `colorId`, first insert `productColorways` rows for that product, then `colorwayId`. Keep seeding global `colors` rows (unused by new products).

- [ ] **Step 4: Migrate locally**

Run: `npm run db:migrate`  
Expected: completes without error.

- [ ] **Step 5: Commit** (skip unless human asks)

---

### Task 2: Pure colorways helper + self-check

**Files:**
- Create: `apps/api/src/lib/colorways.ts`
- Create: `apps/api/src/lib/colorways.selfcheck.ts`

**Interfaces:**
- Consumes: nothing (pure)
- Produces:

```ts
export type MediaRow = {
  colorway_id: string | null;
  colorway_sort: number;
  url: string;
  sort_order: number;
  is_cover: boolean;
};

export type PublicColorway = {
  id: string;
  sort_order: number;
  thumbnail: string;
  images: string[];
};

/** Group media by colorway; omit colorways with zero images; sort by colorway_sort then image sort/cover. */
export function buildPublicColorways(rows: MediaRow[]): PublicColorway[];
```

- [ ] **Step 1: Write self-check (failing until impl)**

```ts
// apps/api/src/lib/colorways.selfcheck.ts
import assert from "node:assert/strict";
import { buildPublicColorways } from "./colorways.js";

const rows = [
  { colorway_id: "a", colorway_sort: 0, url: "/a1.jpg", sort_order: 1, is_cover: false },
  { colorway_id: "a", colorway_sort: 0, url: "/a0.jpg", sort_order: 0, is_cover: true },
  { colorway_id: "b", colorway_sort: 1, url: "/b0.jpg", sort_order: 0, is_cover: true },
  { colorway_id: null, colorway_sort: 99, url: "/orphan.jpg", sort_order: 0, is_cover: false },
];

const out = buildPublicColorways(rows);
assert.equal(out.length, 2);
assert.equal(out[0]!.id, "a");
assert.deepEqual(out[0]!.images, ["/a0.jpg", "/a1.jpg"]);
assert.equal(out[0]!.thumbnail, "/a0.jpg");
assert.equal(out[1]!.id, "b");
assert.equal(out[1]!.thumbnail, "/b0.jpg");
console.log("colorways self-check ok");
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx tsx apps/api/src/lib/colorways.selfcheck.ts`  
Expected: cannot find module / `buildPublicColorways` missing

- [ ] **Step 3: Implement `buildPublicColorways`**

```ts
// apps/api/src/lib/colorways.ts
export type MediaRow = { /* as above */ };
export type PublicColorway = { /* as above */ };

export function buildPublicColorways(rows: MediaRow[]): PublicColorway[] {
  const by = new Map<string, MediaRow[]>();
  for (const r of rows) {
    if (!r.colorway_id) continue;
    const list = by.get(r.colorway_id) ?? [];
    list.push(r);
    by.set(r.colorway_id, list);
  }
  const result: PublicColorway[] = [];
  for (const [id, list] of by) {
    list.sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
    const images = list.map((x) => x.url);
    if (!images.length) continue;
    result.push({
      id,
      sort_order: list[0]!.colorway_sort,
      thumbnail: images[0]!,
      images,
    });
  }
  result.sort((a, b) => a.sort_order - b.sort_order);
  return result;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx tsx apps/api/src/lib/colorways.selfcheck.ts`  
Expected: `colorways self-check ok`

- [ ] **Step 5: Commit** (skip unless human asks)

---

### Task 3: Admin colorway CRUD + media requires colorway_id

**Files:**
- Modify: `apps/api/src/routes/admin/products.ts` — add routes on same Hono (before `/:id` conflicts: register `/ :id/colorways` carefully; prefer paths like `POST /:id/colorways` after `GET /:id`)
- Modify: `apps/api/src/routes/admin/media.ts`

**Interfaces:**
- Produces:
  - `POST /api/v1/admin/products/:id/colorways` → `{ id, product_id, sort_order }` (sort = max+1)
  - `DELETE /api/v1/admin/products/:id/colorways/:colorwayId` → mapped product; deactivate variants (`status: "inactive"`); delete media links + assets for that colorway (same delete pattern as product media delete)
  - `POST .../media` body field `colorway_id` required; 400 `missing_colorway` / `invalid_colorway`

- [ ] **Step 1: Colorway create**

```ts
adminProductRoutes.post("/:id/colorways", async (c) => {
  // requirePerm product.write
  // verify product exists
  const existing = await db.select().from(productColorways).where(eq(productColorways.productId, productId));
  const sortOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1;
  const [row] = await db.insert(productColorways).values({ productId, sortOrder }).returning();
  return c.json({ id: row!.id, product_id: productId, sort_order: row!.sortOrder }, 201);
});
```

- [ ] **Step 2: Colorway delete**

For each variant with that `colorwayId`: `update status inactive` (do not hard-delete if inventory/history exists — match product delete caution; prefer deactivate).  
Delete `product_media` rows for colorway + underlying `media_assets` + storage objects.  
Do not delete the colorway row if you need history — or delete colorway after variants deactivated; if FK from inactive variants blocks delete, keep colorway row and mark by having no media (public omits). **Preferred:** deactivate variants, delete media, **keep** colorway row (admin can still see empty tab) OR delete colorway only when no inventory movements — simplest v1: deactivate variants + delete media + **delete colorway** only if no FK block; else leave inactive variants and null… Can't null NOT NULL. So: **deactivate variants, delete media, keep colorway** (empty tab) OR hard-delete variants only when never ordered. Follow existing product delete patterns in `products.ts`.

Minimal v1: deactivate variants; delete media; delete colorway row only if variants can be deleted like product destroy; else keep colorway + inactive variants.

- [ ] **Step 3: Media upload requires colorway_id**

```ts
const colorwayId = typeof body["colorway_id"] === "string" ? body["colorway_id"] : null;
if (!colorwayId) throw new ApiError(400, "missing_colorway", "Thiếu colorway_id");
const cw = await db.select().from(productColorways)
  .where(and(eq(productColorways.id, colorwayId), eq(productColorways.productId, productId)))
  .limit(1);
if (!cw[0]) throw new ApiError(400, "invalid_colorway", "Colorway không hợp lệ");
// insert productMedia with colorwayId
```

Cover flag: first image of that colorway or `is_cover` — keep existing cover logic scoped to product (product-level cover = first image of first colorway is fine).

- [ ] **Step 4: Manual smoke**

Create product in DB or via API → POST colorway → POST media with colorway_id → 201.  
POST media without colorway_id → 400.

- [ ] **Step 5: Commit** (skip unless human asks)

---

### Task 4: Product create/update sync variants by colorway × size

**Files:**
- Modify: `apps/api/src/routes/admin/products.ts`

**Interfaces:**
- Consumes: `productColorways`, `sizes`
- Produces: create/update no longer require `color_ids`; on create: insert 1 default colorway; sync active variants for all colorways × `size_ids`; SKU prefix use `CW{n}` or short colorway id slice instead of color code

- [ ] **Step 1: POST create**

Remove dependency on `body.color_ids` / `color_id` for new path:

1. Insert product  
2. Insert one `product_colorways` (`sort_order: 0`)  
3. For each `size_id` × each colorway → insert variant + inventory balance 0  
4. Return `mapProduct`

Keep accepting legacy `color_ids` only if needed for one release — **YAGNI: remove**; admin will send `size_ids` only.

- [ ] **Step 2: PATCH sync**

When `size_ids` provided (or always when sizes change):

```
wantColorways = all product_colorways for product
wantSizes = size_ids ?? current
```

Activate/create missing pairs; deactivate pairs not in want set (same structure as current color×size sync, swap `colorId` → `colorwayId`).

- [ ] **Step 3: Smoke**

Create product with 2 sizes → 1 colorway → 2 variants.  
POST second colorway → PATCH sizes unchanged → trigger sync (or sync on colorway create): after colorway create, also create variants for each size. **Do variant expand inside POST colorway** so admin doesn't need extra PATCH.

On `POST /:id/colorways`: after insert colorway, for each active size used by existing variants (or all sizes on product variants), insert new variants at same price as first sibling.

- [ ] **Step 4: Commit** (skip unless human asks)

---

### Task 5: Public `mapProduct` emits colorways

**Files:**
- Modify: `apps/api/src/routes/public/catalog.ts`

**Interfaces:**
- Consumes: `buildPublicColorways`, `productColorways`, `mediaPublicUrl`
- Produces: product JSON with:

```ts
colorways: PublicColorway[]; // only those with images
images: string[]; // flatten: first colorway images (compat) OR all thumbnails — use first public colorway's images for `images[0]` card cover
variants: Array<{ id, sku, colorway_id, size: {...}, ... }>
// Keep `colors` as derived stub for old clients: [{ name: `Màu ${i+1}`, hex: null, code: colorway.id }]` OR omit — prefer include thin compat from colorways
```

- [ ] **Step 1: Join variants to colorways + sizes (drop colors join)**

```ts
.select({
  ...,
  colorway_id: productVariants.colorwayId,
  colorway_sort: productColorways.sortOrder,
  size_code: sizes.code,
  size_label: sizes.label,
})
.innerJoin(productColorways, eq(productColorways.id, productVariants.colorwayId))
.innerJoin(sizes, eq(sizes.id, productVariants.sizeId))
```

- [ ] **Step 2: Select media with colorway_id + colorway_sort; build colorways**

```ts
const media = await db.select({
  asset_id: mediaAssets.id,
  object_key: mediaAssets.objectKey,
  alt_text: mediaAssets.altText,
  is_cover: productMedia.isCover,
  sort_order: productMedia.sortOrder,
  colorway_id: productMedia.colorwayId,
  colorway_sort: productColorways.sortOrder,
})
.from(productMedia)
.innerJoin(mediaAssets, ...)
.leftJoin(productColorways, eq(productColorways.id, productMedia.colorwayId))
.where(eq(productMedia.productId, p.id));

const colorways = buildPublicColorways(
  media.map((m) => ({
    colorway_id: m.colorway_id,
    colorway_sort: m.colorway_sort ?? 0,
    url: mediaPublicUrl(m.object_key),
    sort_order: m.sort_order,
    is_cover: m.is_cover,
  })),
);

images: colorways[0]?.images ?? [],
media: /* include colorway_id on each */,
colorways,
variants: variants.map((v) => ({
  ...,
  colorway_id: v.colorway_id,
  // remove color: {code,name,hex} or set name: `Màu ${v.colorway_sort+1}`
})),
```

- [ ] **Step 3: Verify with curl / browser**

`GET /api/v1/products/:slug` returns `colorways` array; empty-image colorways absent.

- [ ] **Step 4: Commit** (skip unless human asks)

---

### Task 6: Admin API client + ProductsManager tabs

**Files:**
- Modify: `apps/admin/src/lib/api.ts`
- Modify: `apps/admin/src/components/ProductsManager.tsx`

**Interfaces:**
- Produces:

```ts
createColorway: (productId: string) => req<{ id: string; sort_order: number }>(...)
deleteColorway: (productId: string, colorwayId: string) => req<AdminProduct>(...)
uploadProductMedia: (id, file, { colorwayId, isCover }) => FormData with colorway_id
```

`AdminProduct` adds:

```ts
colorways?: Array<{ id: string; sort_order: number }>;
media?: Array<{ asset_id: string; url: string; alt: string | null; is_cover: boolean; colorway_id: string | null }>;
variants: Array<{ ..., colorway_id?: string }>
```

- [ ] **Step 1: Update `api.ts` types + methods**

- [ ] **Step 2: Replace color checkbox UI with tabs**

Form state:

```ts
activeColorwayId: string | null  // editing only
```

On create: after product create, colorway already exists from API — upload pending files to that id; or create product → use returned colorways[0].

UI block (replace catalog color chips):

- Tabs: `Màu {i+1}` for each `editing.colorways` sorted by `sort_order`
- `+ Thêm màu` → `createColorway` → refresh editing
- Gallery filter: `media.filter(m => m.colorway_id === activeColorwayId)`
- Upload calls `uploadProductMedia(id, file, { colorwayId: activeColorwayId })`
- Remove `color_ids` from create/patch body; keep `size_ids`

- [ ] **Step 3: Rebuild admin container**

Run: `docker compose up --build -d admin`  
Manual: open product form — tabs, upload per tab, list thumbnails.

- [ ] **Step 4: Commit** (skip unless human asks)

---

### Task 7: Storefront PDP + cart by variant/SKU

**Files:**
- Modify: `apps/storefront/src/lib/api.ts`
- Modify: `apps/storefront/src/lib/products.ts`
- Modify: `apps/storefront/src/lib/store.tsx`
- Modify: `apps/storefront/src/routes/san-pham.$slug.tsx`
- Modify: `apps/storefront/src/components/site/ProductCard.tsx`
- Modify: `apps/storefront/src/components/site/Header.tsx` (cart line display)
- Modify: `apps/storefront/src/routes/gio-hang.tsx`
- Modify: `apps/storefront/src/routes/thanh-toan.tsx`

**Interfaces:**
- Produces:

```ts
// Product
colorways: Array<{ id: string; thumbnail: string; images: string[] }>
variants: Array<{ id: string; sku: string; colorwayId: string; size: string; ... }>

// CartItem
{ productId: string; variantId: string; sku: string; size: string; qty: number }
```

- [ ] **Step 1: Map API → Product**

```ts
colorways: (p.colorways ?? []).map((c) => ({
  id: c.id,
  thumbnail: mediaUrl(c.thumbnail),
  images: c.images.map(mediaUrl),
})),
images: (p.colorways?.[0]?.images ?? p.images).map(...),
```

Drop hex swatch dependency.

- [ ] **Step 2: Cart**

```ts
addToCart: (p, variantId: string, qty?: number) => {
  const v = p.variants.find((x) => x.id === variantId);
  // merge on variantId; toast with p.name · v.sku · size
}
```

Clear incompatible old localStorage cart keys on parse mismatch (empty cart if shape wrong).

- [ ] **Step 3: PDP UI**

```tsx
const [colorwayId, setColorwayId] = useState(p.colorways[0]?.id);
const cw = p.colorways.find((c) => c.id === colorwayId) ?? p.colorways[0];
const gallery = cw?.images ?? p.images;
// color row: button with <img src={c.thumbnail} />, selected border + corner check
// on color change: setColorwayId; setImg(0); reset size if not in variants for colorway
// sizes: variants.filter(v => v.colorwayId === colorwayId).map(v => v.size)
// add: resolve variant by colorwayId + size → addToCart(p, variant.id, qty)
```

- [ ] **Step 4: ProductCard / cart pages**

Use first available variant for quick-add; display `SKU` or size only in cart lines (no color name).

- [ ] **Step 5: Rebuild storefront if dockerized**

Run: `docker compose up --build -d storefront` (if applicable)

- [ ] **Step 6: Commit** (skip unless human asks)

---

### Task 8: Inventory admin label + final self-check

**Files:**
- Modify: `apps/api/src/routes/admin/inventory.ts` (and types) — `color_name` → use `Màu ${sort+1}` or leave blank; prefer show **SKU** prominently (already has sku)
- Re-run: `npx tsx apps/api/src/lib/colorways.selfcheck.ts`

- [ ] **Step 1: Inventory list join colorways instead of colors; `color_name: \`Màu ${sortOrder + 1}\``**

- [ ] **Step 2: End-to-end manual**

1. Admin: product with 2 colorways, ≥1 image each, 2 sizes → 4 SKUs  
2. Public GET product: 2 colorways, separated images  
3. PDP: switch color → gallery changes; add to cart → line has sku  

- [ ] **Step 3: Commit** (skip unless human asks)

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| `product_colorways` table | 1 |
| media/variants → colorway_id | 1, 3, 4 |
| Migration from colors | 1 |
| Upload requires colorway_id | 3 |
| Admin tabs UX | 6 |
| Public colorways payload | 2, 5 |
| Empty colorway hidden public | 2, 5 |
| Pantio PDP picker | 7 |
| Cart/SKU | 7 |
| Keep global colors unused on form | 4, 6 |
| Self-check | 2, 8 |

## Placeholder / consistency notes

- Variant field name: always `colorway_id` in JSON; storefront internal `colorwayId`.
- SKU generation: replace color `code` with `CW` + first 4 of colorway id (or sort index).
- Do not reintroduce catalog `color_ids` on admin form.
