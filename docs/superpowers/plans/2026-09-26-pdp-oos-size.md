# PDP Out-of-Stock Sizes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the storefront PDP, mark sizes with `available <= 0` for the selected colorway with an X, disable selection, and block add-to-cart; when the colorway has no in-stock sizes, show CTA “Sản phẩm tạm hết hàng”.

**Architecture:** Public API already returns `available` per variant. Storefront maps it into `Product.variants`, a tiny pure helper decides stock per size, and `san-pham.$slug.tsx` wires disabled size buttons + CTA copy/guards. No API or listing changes.

**Tech Stack:** TanStack Router storefront, existing catalog types in `api.ts` / `products.ts`, assert-based `*.selfcheck.ts` (no new test framework).

## Global Constraints

- Scope: PDP only; do not disable colorways, ProductCard, cart drawer, or checkout stock UI.
- OOS definition: missing variant for (colorway, size) OR `available <= 0`.
- Interaction: OOS sizes are `disabled` (not selectable).
- CTA: colorway with zero in-stock sizes → label exactly `Sản phẩm tạm hết hàng`, button `disabled`.
- Do not cap qty by stock.
- Do not change public catalog API.

## File map

| File | Role |
|------|------|
| `apps/storefront/src/lib/api.ts` | Add `available` on `ApiProduct.variants` |
| `apps/storefront/src/lib/products.ts` | Add `available` on `Product.variants`; map from API |
| `apps/storefront/src/lib/variant-stock.ts` | Pure helpers: stock lookup / in-stock checks |
| `apps/storefront/src/lib/variant-stock.selfcheck.ts` | Assert-based checks for helpers |
| `apps/storefront/src/routes/san-pham.$slug.tsx` | Size UI (X + disabled), clear size on colorway change, CTA + `add()` guard |

---

### Task 1: Map `available` + stock helpers

**Files:**
- Modify: `apps/storefront/src/lib/api.ts` (`ApiProduct.variants`)
- Modify: `apps/storefront/src/lib/products.ts` (`Product.variants`, `mapApiProduct`)
- Create: `apps/storefront/src/lib/variant-stock.ts`
- Create: `apps/storefront/src/lib/variant-stock.selfcheck.ts`

**Interfaces:**
- Consumes: API field `available` already returned by `apps/api/src/routes/public/catalog.ts`
- Produces:
  - `Product.variants[].available: number`
  - `findVariant(variants, colorwayId, size): { id; available; ... } | undefined`
  - `isSizeInStock(variants, colorwayId, size): boolean`
  - `colorwayHasStock(variants, colorwayId, sizes: string[]): boolean`

- [ ] **Step 1: Write failing selfcheck**

Create `apps/storefront/src/lib/variant-stock.selfcheck.ts`:

```ts
import { colorwayHasStock, isSizeInStock } from "./variant-stock";

type V = { id: string; colorwayId: string; size: string; available: number };

const variants: V[] = [
  { id: "1", colorwayId: "cwA", size: "M", available: 2 },
  { id: "2", colorwayId: "cwA", size: "L", available: 0 },
  { id: "3", colorwayId: "cwB", size: "M", available: 0 },
];

console.assert(isSizeInStock(variants, "cwA", "M") === true, "M in stock");
console.assert(isSizeInStock(variants, "cwA", "L") === false, "L OOS");
console.assert(isSizeInStock(variants, "cwA", "S") === false, "missing size OOS");
console.assert(isSizeInStock(variants, "cwB", "M") === false, "zero available OOS");
console.assert(colorwayHasStock(variants, "cwA", ["M", "L"]) === true, "cwA has stock");
console.assert(colorwayHasStock(variants, "cwB", ["M", "L"]) === false, "cwB empty");
console.log("variant-stock.selfcheck: ok");
```

- [ ] **Step 2: Run selfcheck — expect fail (module missing)**

Run:

```bash
cd "apps/storefront" && npx tsx src/lib/variant-stock.selfcheck.ts
```

Expected: fail resolving `./variant-stock`.

- [ ] **Step 3: Implement helpers + types**

`apps/storefront/src/lib/variant-stock.ts`:

```ts
export type StockVariant = {
  id: string;
  colorwayId: string;
  size: string;
  available: number;
};

export function findVariant(
  variants: StockVariant[],
  colorwayId: string,
  size: string,
): StockVariant | undefined {
  return variants.find(
    (v) => v.size === size && (!colorwayId || v.colorwayId === colorwayId),
  );
}

export function isSizeInStock(
  variants: StockVariant[],
  colorwayId: string,
  size: string,
): boolean {
  const v = findVariant(variants, colorwayId, size);
  return (v?.available ?? 0) > 0;
}

export function colorwayHasStock(
  variants: StockVariant[],
  colorwayId: string,
  sizes: string[],
): boolean {
  return sizes.some((s) => isSizeInStock(variants, colorwayId, s));
}
```

In `apps/storefront/src/lib/api.ts`, extend each variant with:

```ts
available: number;
```

In `apps/storefront/src/lib/products.ts`:

- Change variants type to include `available: number`
- In `mapApiProduct`:

```ts
variants: (p.variants ?? []).map((v) => ({
  id: v.id,
  sku: v.sku,
  colorwayId: v.colorway_id ?? v.color?.code ?? "",
  size: v.size.label,
  available: v.available ?? 0,
})),
```

- [ ] **Step 4: Re-run selfcheck — expect pass**

```bash
cd "apps/storefront" && npx tsx src/lib/variant-stock.selfcheck.ts
```

Expected: `variant-stock.selfcheck: ok`

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/lib/api.ts apps/storefront/src/lib/products.ts apps/storefront/src/lib/variant-stock.ts apps/storefront/src/lib/variant-stock.selfcheck.ts
git commit -m "Map variant available stock for PDP OOS checks."
```

---

### Task 2: PDP size X + CTA + add guard

**Files:**
- Modify: `apps/storefront/src/routes/san-pham.$slug.tsx`

**Interfaces:**
- Consumes: `isSizeInStock`, `colorwayHasStock`, `findVariant` from `variant-stock.ts`; `Product.variants[].available`
- Produces: disabled OOS size buttons with X overlay; CTA label switch; `add()` stock guard

- [ ] **Step 1: Wire stock helpers into ProductPage**

Near existing size derivation (`uniqueSizes`), add:

```ts
import { colorwayHasStock, findVariant, isSizeInStock } from "@/lib/variant-stock";

const hasStock = colorwayHasStock(p.variants, colorwayId, uniqueSizes);
```

In `handleColorwayChange`, after `setColorwayId(nextId)`, keep `setSize(null)` (already present) — that satisfies “clear selection when colorway changes / previous size may be OOS”.

If a single-size product auto-selects size on mount, only keep auto-select when in stock:

```ts
const [size, setSize] = useState<string | null>(() => {
  if (uniqueSizes.length !== 1) return null;
  const only = uniqueSizes[0]!;
  return isSizeInStock(p.variants, colorwayId, only) ? only : null;
});
```

(Note: `uniqueSizes` / `colorwayId` at first render come from `initialCw` — same as today.)

- [ ] **Step 2: Replace size button row**

Replace the `uniqueSizes.map` buttons with:

```tsx
{uniqueSizes.map((s) => {
  const inStock = isSizeInStock(p.variants, colorwayId, s);
  const selected = size === s;
  return (
    <button
      key={s}
      type="button"
      disabled={!inStock}
      onClick={() => inStock && setSize(s)}
      aria-label={inStock ? undefined : `Size ${s} hết hàng`}
      aria-disabled={!inStock ? true : undefined}
      className={cn(
        "relative h-11 min-w-14 border px-3 text-sm transition",
        !inStock && "cursor-not-allowed opacity-40",
        inStock && selected && "border-foreground bg-primary text-primary-foreground",
        inStock && !selected && "border-border hover:border-foreground",
        !inStock && "border-border text-muted-foreground",
      )}
    >
      <span className={cn(!inStock && "opacity-70")}>{s}</span>
      {!inStock && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-2 top-1/2 h-px origin-center -rotate-45 bg-foreground/50"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-2 top-1/2 h-px origin-center rotate-45 bg-foreground/50"
          />
        </>
      )}
    </button>
  );
})}
```

- [ ] **Step 3: Update CTA + `add()`**

Replace add-to-cart button + harden `add`:

```ts
const add = () => {
  if (!hasStock) return;
  if (!size) {
    toast.error("Vui lòng chọn kích cỡ");
    return;
  }
  const variant = findVariant(p.variants, colorwayId, size);
  if (!variant) {
    toast.error("Không tìm thấy SKU");
    return;
  }
  if (variant.available <= 0) {
    toast.error("Size này tạm hết hàng");
    return;
  }
  addToCart(p, variant.id, qty);
};
```

```tsx
<button
  type="button"
  onClick={add}
  disabled={!hasStock}
  className={cn(
    "flex-1 bg-primary text-xs uppercase tracking-widest text-primary-foreground transition",
    hasStock ? "hover:opacity-90" : "cursor-not-allowed opacity-50",
  )}
>
  {hasStock ? "Thêm vào giỏ hàng" : "Sản phẩm tạm hết hàng"}
</button>
```

- [ ] **Step 4: Manual verify**

1. Open a PDP with mixed stock (some sizes `available > 0`, some `0`) for a colorway → OOS sizes show X, cannot select; CTA still “Thêm vào giỏ hàng”; selecting in-stock size adds to cart.
2. Switch to a colorway with all sizes OOS (or zero `available`) → all sizes X’d; CTA reads **Sản phẩm tạm hết hàng** and is disabled.
3. Switch back to a colorway with stock → size selection cleared; CTA label restores.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/routes/san-pham.$slug.tsx
git commit -m "Disable out-of-stock sizes on PDP and update CTA."
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Map `available` into storefront types | Task 1 |
| OOS = missing variant or `available <= 0` | Task 1 helpers |
| Size disabled + X, not selectable | Task 2 Step 2 |
| Clear size on colorway change | Task 2 Step 1 (existing `setSize(null)`) |
| CTA “Sản phẩm tạm hết hàng” when colorway empty | Task 2 Step 3 |
| `add()` guard | Task 2 Step 3 |
| No colorway disable / qty cap / listing | Out of scope — no tasks |
