# Admin Inventory (Kho hàng) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real admin Kho hàng: stock balances for warehouse MAIN, inventory documents (receipt/issue/adjustment) with draft → approve → post, and product forms that only display stock.

**Architecture:** Extend existing Hono `admin/inventory` routes (enrich balances; list/get documents). Stop product routes from writing `on_hand` via `size_stocks`. New `InventoryManager` replaces the mock inventory `ModulePage`. Pure helpers for stock tab filters + document line direction live in `apps/api/src/lib/inventory-doc.ts` (shared rules) with Node tests.

**Tech Stack:** Hono + Drizzle, React admin (same patterns as `CategoriesManager`), `tsx --test`, existing `adminApi` + toast + Button/Input.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-25-admin-inventory-design.md`
- Single warehouse `MAIN` only
- Document flow: draft → approve → post; no PATCH draft; no void UI
- Types: `receipt` | `issue` | `adjustment`
- Product form: stock read-only; no `applySizeStocks` writes
- Vietnamese UI copy; no English “mega menu” leftovers
- Commits: only when the human explicitly asks; skip commit steps unless told
- After UI changes: `docker compose up --build -d admin` so container picks up files

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/src/lib/inventory-doc.ts` | Pure: default line direction; stock filter predicates |
| `apps/api/src/lib/inventory-doc.test.ts` | Unit tests for helpers |
| `apps/api/src/routes/admin/inventory.ts` | Enrich GET `/`; add GET `/documents`, GET `/documents/:id` |
| `apps/api/src/routes/admin/products.ts` | Remove `setVariantOnHand` / `applySizeStocks` write path; create balances at 0 |
| `apps/admin/src/lib/api.ts` | Typed inventory + documents clients |
| `apps/admin/src/components/InventoryManager.tsx` | List/form UI for stock + documents |
| `apps/admin/src/components/ProductsManager.tsx` | Read-only size stock display + CTA |
| `apps/admin/src/routes/index.tsx` | Wire `InventoryManager` for `active === "inventory"` |

---

### Task 1: Inventory helpers + unit tests

**Files:**
- Create: `apps/api/src/lib/inventory-doc.ts`
- Create: `apps/api/src/lib/inventory-doc.test.ts`

**Interfaces:**
- Consumes: nothing (pure)
- Produces:
  - `type DocType = "receipt" | "issue" | "adjustment"`
  - `function defaultDirection(type: DocType, lineDirection?: "in" | "out"): "in" | "out"`
  - `type StockRow = { available: number; reorder_point: number }`
  - `function isLowStock(row: StockRow): boolean` — `available <= reorder_point`
  - `function isOutOfStock(row: StockRow): boolean` — `available === 0`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/lib/inventory-doc.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultDirection, isLowStock, isOutOfStock } from "./inventory-doc.js";

describe("inventory-doc", () => {
  it("defaultDirection", () => {
    assert.equal(defaultDirection("receipt"), "in");
    assert.equal(defaultDirection("issue"), "out");
    assert.equal(defaultDirection("adjustment", "out"), "out");
    assert.equal(defaultDirection("adjustment", "in"), "in");
    assert.equal(defaultDirection("adjustment"), "in");
  });

  it("stock filters", () => {
    assert.equal(isLowStock({ available: 3, reorder_point: 5 }), true);
    assert.equal(isLowStock({ available: 5, reorder_point: 5 }), true);
    assert.equal(isLowStock({ available: 6, reorder_point: 5 }), false);
    assert.equal(isOutOfStock({ available: 0, reorder_point: 5 }), true);
    assert.equal(isOutOfStock({ available: 1, reorder_point: 5 }), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @elane/api -- src/lib/inventory-doc.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/api/src/lib/inventory-doc.ts
export type DocType = "receipt" | "issue" | "adjustment";

export function defaultDirection(
  type: DocType,
  lineDirection?: "in" | "out",
): "in" | "out" {
  if (type === "receipt") return "in";
  if (type === "issue") return "out";
  return lineDirection ?? "in";
}

export type StockRow = { available: number; reorder_point: number };

export function isLowStock(row: StockRow): boolean {
  return row.available <= row.reorder_point;
}

export function isOutOfStock(row: StockRow): boolean {
  return row.available === 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w @elane/api -- src/lib/inventory-doc.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** (skip unless user asks)

---

### Task 2: Enrich inventory GET + documents list/get

**Files:**
- Modify: `apps/api/src/routes/admin/inventory.ts`
- Use: `defaultDirection` from `../lib/inventory-doc.js` inside `POST /documents` when inserting lines (replace inline ternary so direction rules stay one place)

**Interfaces:**
- Consumes: `defaultDirection`
- Produces JSON shapes (snake_case):

```ts
// GET /
{
  warehouse: { id, code, name, ... },
  items: Array<{
    warehouse_id: string;
    variant_id: string;
    sku: string;
    product_id: string;
    product_name: string;
    color_name: string;
    size_code: string;
    size_label: string;
    on_hand: number;
    reserved: number;
    available: number;
    reorder_point: number;
  }>;
}

// GET /documents?status=&type=
{
  items: Array<{
    id: string;
    code: string;
    type: string;
    status: string;
    reason: string;
    line_count: number;
    created_at: string;
    posted_at: string | null;
  }>;
}

// GET /documents/:id
{
  id, code, type, status, reason, created_at, posted_at, approved_by, requested_by,
  lines: Array<{
    id: string;
    variant_id: string;
    qty: number;
    direction: string;
    unit_cost_vnd: number | null;
    sku: string;
    product_name: string;
    color_name: string;
    size_label: string;
  }>;
}
```

- [ ] **Step 1: Expand `GET /` select/joins**

Import `products`, `colors`, `sizes` from `@elane/db`. Change the balances query to:

```ts
.select({
  warehouse_id: inventoryBalances.warehouseId,
  variant_id: inventoryBalances.variantId,
  sku: productVariants.sku,
  product_id: products.id,
  product_name: products.name,
  color_name: colors.name,
  size_code: sizes.code,
  size_label: sizes.label,
  on_hand: inventoryBalances.onHand,
  reserved: inventoryBalances.reserved,
  available: sql<number>`${inventoryBalances.onHand} - ${inventoryBalances.reserved}`,
  reorder_point: inventoryBalances.reorderPoint,
})
.from(inventoryBalances)
.innerJoin(productVariants, eq(productVariants.id, inventoryBalances.variantId))
.innerJoin(products, eq(products.id, productVariants.productId))
.innerJoin(colors, eq(colors.id, productVariants.colorId))
.innerJoin(sizes, eq(sizes.id, productVariants.sizeId))
.where(eq(inventoryBalances.warehouseId, wh[0].id))
.orderBy(products.name, productVariants.sku)
.limit(500);
```

- [ ] **Step 2: Add `GET /documents` before `POST /documents`**

```ts
adminInventoryRoutes.get("/documents", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const status = c.req.query("status");
  const type = c.req.query("type");
  const conds = [];
  if (status) conds.push(eq(inventoryDocuments.status, status));
  if (type) conds.push(eq(inventoryDocuments.type, type));
  const rows = await db
    .select({
      id: inventoryDocuments.id,
      code: inventoryDocuments.code,
      type: inventoryDocuments.type,
      status: inventoryDocuments.status,
      reason: inventoryDocuments.reason,
      created_at: inventoryDocuments.createdAt,
      posted_at: inventoryDocuments.postedAt,
      line_count: sql<number>`(select count(*)::int from inventory_document_lines l where l.document_id = ${inventoryDocuments.id})`,
    })
    .from(inventoryDocuments)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(inventoryDocuments.createdAt))
    .limit(200);
  return c.json({ items: rows });
});
```

Import `desc` from `drizzle-orm` if missing.

- [ ] **Step 3: Add `GET /documents/:id`**

```ts
adminInventoryRoutes.get("/documents/:id", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const docs = await db
    .select()
    .from(inventoryDocuments)
    .where(eq(inventoryDocuments.id, c.req.param("id")))
    .limit(1);
  if (!docs[0]) throw new ApiError(404, "not_found", "Không tìm thấy phiếu");
  const lines = await db
    .select({
      id: inventoryDocumentLines.id,
      variant_id: inventoryDocumentLines.variantId,
      qty: inventoryDocumentLines.qty,
      direction: inventoryDocumentLines.direction,
      unit_cost_vnd: inventoryDocumentLines.unitCostVnd,
      sku: productVariants.sku,
      product_name: products.name,
      color_name: colors.name,
      size_label: sizes.label,
    })
    .from(inventoryDocumentLines)
    .innerJoin(productVariants, eq(productVariants.id, inventoryDocumentLines.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(colors, eq(colors.id, productVariants.colorId))
    .innerJoin(sizes, eq(sizes.id, productVariants.sizeId))
    .where(eq(inventoryDocumentLines.documentId, docs[0].id));
  const d = docs[0];
  return c.json({
    id: d.id,
    code: d.code,
    type: d.type,
    status: d.status,
    reason: d.reason,
    created_at: d.createdAt,
    posted_at: d.postedAt,
    requested_by: d.requestedBy,
    approved_by: d.approvedBy,
    lines,
  });
});
```

- [ ] **Step 4: Use `defaultDirection` in POST create lines**

When inserting lines:

```ts
direction: defaultDirection(body.data.type, line.direction),
```

Remove the old `body.data.type === "issue" ? "out" : line.direction` ternary.

- [ ] **Step 5: Manual smoke (API up)**

```bash
# login cookie then:
curl -s http://localhost:3001/api/v1/admin/inventory -H "Cookie: ..." | head
curl -s http://localhost:3001/api/v1/admin/inventory/documents -H "Cookie: ..."
```

Expected: items include `product_name`; documents returns `{ items: [...] }`.

- [ ] **Step 6: Commit** (skip unless user asks)

---

### Task 3: Stop product routes from writing stock qty

**Files:**
- Modify: `apps/api/src/routes/admin/products.ts`

**Interfaces:**
- Consumes: none new
- Produces: create/update never call `setVariantOnHand`; new balances always `onHand: 0`; `size_stocks` in body ignored for qty (may still drive which sizes get variants via `size_ids`)

- [ ] **Step 1: Delete helpers**

Remove functions `setVariantOnHand` and `applySizeStocks` entirely.

- [ ] **Step 2: Create path — balances at 0**

Wherever create inserts `inventoryBalances`, set `onHand: 0` (not `stockMap.get(sizeId)`). Remove `stockMap` / `body.data.size_stocks` usage for qty. Keep using `size_ids` or `size_stocks.map(s => s.size_id)` only as a source of size ids for variant creation if that path already exists.

- [ ] **Step 3: Update path — remove applySizeStocks call**

Delete the block:

```ts
if (body.data.size_stocks) {
  await applySizeStocks(db, existing[0].id, body.data.size_stocks);
}
```

Keep schema field optional so old clients don’t 400; ignore it.

- [ ] **Step 4: Smoke**

Create/update a product with `size_stocks` in body → balances stay 0 / unchanged; GET still returns `size_stocks` for display.

- [ ] **Step 5: Commit** (skip unless user asks)

---

### Task 4: Admin API client types

**Files:**
- Modify: `apps/admin/src/lib/api.ts`

**Interfaces:**
- Produces:

```ts
export type InventoryItem = {
  warehouse_id: string;
  variant_id: string;
  sku: string;
  product_id: string;
  product_name: string;
  color_name: string;
  size_code: string;
  size_label: string;
  on_hand: number;
  reserved: number;
  available: number;
  reorder_point: number;
};

export type InventoryDocumentListItem = {
  id: string;
  code: string;
  type: string;
  status: string;
  reason: string;
  line_count: number;
  created_at: string;
  posted_at: string | null;
};

export type InventoryDocumentDetail = {
  id: string;
  code: string;
  type: string;
  status: string;
  reason: string;
  created_at: string;
  posted_at: string | null;
  requested_by: string;
  approved_by: string | null;
  lines: Array<{
    id: string;
    variant_id: string;
    qty: number;
    direction: string;
    unit_cost_vnd: number | null;
    sku: string;
    product_name: string;
    color_name: string;
    size_label: string;
  }>;
};
```

Update methods:

```ts
inventory: () =>
  req<{ warehouse: { id: string; code: string; name: string }; items: InventoryItem[] }>(
    "/admin/inventory",
  ),
inventoryDocuments: (params?: { status?: string; type?: string }) => {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.type) q.set("type", params.type);
  const qs = q.toString();
  return req<{ items: InventoryDocumentListItem[] }>(
    `/admin/inventory/documents${qs ? `?${qs}` : ""}`,
  );
},
inventoryDocument: (id: string) =>
  req<InventoryDocumentDetail>(`/admin/inventory/documents/${id}`),
createDoc: (body: {
  type: "receipt" | "issue" | "adjustment";
  reason?: string;
  lines: Array<{ variant_id: string; qty: number; direction?: "in" | "out" }>;
}) =>
  req<{ id: string; code: string; status: string }>("/admin/inventory/documents", {
    method: "POST",
    body: JSON.stringify(body),
  }),
approveDoc: (id: string) =>
  req<{ id: string; status: string }>(`/admin/inventory/documents/${id}/approve`, {
    method: "POST",
  }),
postDoc: (id: string, key: string) =>
  req<{ id: string; status: string }>(`/admin/inventory/documents/${id}/post`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
  }),
```

Also widen `AdminProduct.variants` type so the document form can pick variants from `products()`:

```ts
variants: Array<{
  id: string;
  sku: string;
  price_vnd: number;
  color_name?: string;
  size_label?: string;
  status?: string;
}>;
```

- [ ] **Step 1: Apply the type + method changes above**
- [ ] **Step 2: Typecheck admin** — `npx tsc -p apps/admin --noEmit` (or project’s usual check). Fix only errors from this change.
- [ ] **Step 3: Commit** (skip unless user asks)

---

### Task 5: `InventoryManager` list + document form

**Files:**
- Create: `apps/admin/src/components/InventoryManager.tsx`
- Modify: `apps/admin/src/routes/index.tsx`

**Interfaces:**
- Consumes: `adminApi.inventory`, `inventoryDocuments`, `inventoryDocument`, `createDoc`, `approveDoc`, `postDoc`, `products` (for variant picker on compose)
- Produces: `<InventoryManager />` with internal `view: "list" | "form"`

Mirror structure of `CategoriesManager` (breadcrumb, metrics, tabs, footer). Duplicate filter helpers client-side (same rules as API helpers) inline or copy tiny functions — do **not** import from `apps/api` into admin.

- [ ] **Step 1: Scaffold component**

```tsx
// apps/admin/src/components/InventoryManager.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminApi,
  type InventoryDocumentDetail,
  type InventoryDocumentListItem,
  type InventoryItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "all" | "low" | "out" | "docs";
type View = "list" | "form";
type DocType = "receipt" | "issue" | "adjustment";

function isLow(row: InventoryItem) {
  return row.available <= row.reorder_point;
}
function isOut(row: InventoryItem) {
  return row.available === 0;
}

export function InventoryManager() {
  const [view, setView] = useState<View>("list");
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [docs, setDocs] = useState<InventoryDocumentListItem[]>([]);
  const [warehouseLabel, setWarehouseLabel] = useState("MAIN");
  const [loading, setLoading] = useState(true);
  // form state…
  return null; // fill in steps below
}
```

- [ ] **Step 2: Loaders**

```ts
const loadStock = useCallback(async () => {
  const res = await adminApi.inventory();
  setItems(res.items);
  setWarehouseLabel(res.warehouse.code);
}, []);

const loadDocs = useCallback(async () => {
  const res = await adminApi.inventoryDocuments();
  setDocs(res.items);
}, []);

useEffect(() => {
  setLoading(true);
  Promise.all([loadStock(), loadDocs()])
    .catch((e) => toast.error(e instanceof Error ? e.message : "Tải kho thất bại"))
    .finally(() => setLoading(false));
}, [loadStock, loadDocs]);
```

- [ ] **Step 3: List UI**

Metrics:

- SKU theo dõi = `items.length`
- Sắp hết = `items.filter(isLow).length`
- Phiếu chờ = `docs.filter(d => d.status === "draft" || d.status === "approved").length`

Tabs: Tất cả / Sắp hết / Hết hàng / Phiếu.

Stock table columns: Sản phẩm | Biến thể (color / size) | SKU | Thực có | Đã giữ | Khả dụng | Mức.

Filter + search on `product_name`, `sku`, `color_name`, `size_label`.

Phiếu table: Mã | Loại | Trạng thái | Số dòng | Ngày | click row → `openDoc(id)`.

CTA button **Tạo phiếu** → `openCreate()`.

Type labels (Vietnamese): nhập / xuất / điều chỉnh. Status: nháp / đã duyệt / đã ghi sổ.

- [ ] **Step 4: Compose form (new document)**

State:

```ts
const [editingDoc, setEditingDoc] = useState<InventoryDocumentDetail | null>(null);
const [compose, setCompose] = useState(true);
const [formType, setFormType] = useState<DocType>("receipt");
const [reason, setReason] = useState("");
const [lines, setLines] = useState<Array<{ variant_id: string; qty: string; direction: "in" | "out" }>>([
  { variant_id: "", qty: "1", direction: "in" },
]);
const [variantOptions, setVariantOptions] = useState<
  Array<{ id: string; label: string }>
>([]);
const [saving, setSaving] = useState(false);
```

On `openCreate`: `setCompose(true); setEditingDoc(null); setView("form");` load products:

```ts
const prods = await adminApi.products();
setVariantOptions(
  prods.items.flatMap((p) =>
    (p.variants ?? [])
      .filter((v) => v.status !== "archived")
      .map((v) => ({
        id: v.id,
        label: `${p.name} · ${v.color_name ?? "—"} / ${v.size_label ?? "—"} · ${v.sku}`,
      })),
  ),
);
```

Layout: `lg:grid-cols-2` — left fields + line rows (add/remove line); right: summary + **Tạo phiếu**.

Submit:

```ts
const body = {
  type: formType,
  reason,
  lines: lines
    .filter((l) => l.variant_id && Number(l.qty) > 0)
    .map((l) => ({
      variant_id: l.variant_id,
      qty: Number(l.qty),
      direction:
        formType === "receipt" ? ("in" as const) : formType === "issue" ? ("out" as const) : l.direction,
    })),
};
if (!body.lines.length) {
  toast.error("Cần ít nhất một dòng hợp lệ");
  return;
}
const created = await adminApi.createDoc(body);
toast.success(`Đã tạo ${created.code}`);
const detail = await adminApi.inventoryDocument(created.id);
setCompose(false);
setEditingDoc(detail);
await loadDocs();
await loadStock();
```

- [ ] **Step 5: Detail form (approve / post)**

`openDoc(id)`: fetch detail, `setCompose(false)`, `setView("form")`.

Show lines read-only. Actions:

- status `draft` → Button **Duyệt** → `approveDoc` → reload detail
- status `approved` → Button **Ghi sổ** → `postDoc(id, crypto.randomUUID())` → reload detail + stock
- status `posted` → no mutation buttons

Handle errors with `toast.error(err.message)`.

Breadcrumb: `Kho hàng › {compose ? "Tạo phiếu" : editingDoc.code}`.

- [ ] **Step 6: Wire route**

In `apps/admin/src/routes/index.tsx`:

```tsx
import { InventoryManager } from "@/components/InventoryManager";
// …
) : active === "inventory" ? (
  <InventoryManager />
) : active === "sizes" ? (
```

Remove reliance on mock `ModulePage` for inventory (leave `configs.inventory` unused or delete later — YAGNI: just branch first).

Optional: stop hydrating `next.inventory` in the overview `useEffect` (dead code once branched).

- [ ] **Step 7: Rebuild admin**

`docker compose up --build -d admin`  
Hard-refresh `http://localhost:8081` → Kho hàng shows live table.

- [ ] **Step 8: Commit** (skip unless user asks)

---

### Task 6: Product form stock read-only

**Files:**
- Modify: `apps/admin/src/components/ProductsManager.tsx`
- Modify: `apps/admin/src/routes/index.tsx` (pass navigate callback)

**Interfaces:**
- Consumes: `AdminProduct.size_stocks` (display only)
- Produces: `ProductsManager({ onNavigate?: (section: string) => void })`

- [ ] **Step 1: Accept optional navigate prop**

```tsx
export function ProductsManager({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
```

In `index.tsx`: `<ProductsManager onNavigate={choose} />` (use the existing `choose` / `setActive` helper already used by sidebar).

- [ ] **Step 2: Replace editable size & tồn UI**

Remove: bulk qty input, per-size number inputs, `buildSizeStocks`, sending `size_stocks` in create/update payloads.

Keep size **checkboxes** (which sizes the product sells) if that still drives `size_ids` — only remove qty fields.

Display block:

```tsx
<fieldset className="block space-y-3">
  <legend className="text-xs font-medium">Size & tồn kho</legend>
  <p className="text-[11px] text-muted-foreground">
    Tồn chỉ đổi qua phiếu kho. Chọn size bán bên dưới; số lượng xem tại Kho hàng.
  </p>
  {/* size tickboxes for size_ids — unchanged except no qty Input */}
  {editing?.size_stocks?.length ? (
    <ul className="mt-2 space-y-1 text-sm">
      {editing.size_stocks.map((s) => (
        <li key={s.size_id} className="flex justify-between border-b border-border/60 py-1.5">
          <span>{s.size_label}</span>
          <span className="font-mono text-muted-foreground">{s.qty}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">Chưa có số tồn (0).</p>
  )}
  <Button type="button" variant="outline" size="sm" onClick={() => onNavigate?.("inventory")}>
    Điều chỉnh qua phiếu kho
  </Button>
</fieldset>
```

- [ ] **Step 3: Strip `size_stocks` from save()**

Create/update body: send `size_ids` only, never `size_stocks`.

- [ ] **Step 4: Rebuild admin + smoke**

Open product → no qty inputs; CTA jumps to Kho hàng; create receipt → post → product stock numbers update on reload.

- [ ] **Step 5: Commit** (skip unless user asks)

---

## Acceptance checklist (manual)

1. Receipt: create draft → Duyệt → Ghi sổ → `available` increases by qty.
2. Re-post same Idempotency-Key → no double increase (API returns replay).
3. Product form cannot change on_hand.
4. Tabs Sắp hết / Hết hàng filter correctly.
5. Posted document is read-only in UI.

---

## Self-review vs spec

| Spec item | Task |
|-----------|------|
| Enrich GET inventory | Task 2 |
| GET documents list/detail | Task 2 |
| Keep create/approve/post | Task 2 (direction helper) + Task 5 UI |
| No PATCH draft | Task 5 compose-once |
| Product stop writing stock | Task 3 + Task 6 |
| InventoryManager list/form | Task 5 |
| Wire index inventory | Task 5 |
| Low/out filters | Task 1 helpers + Task 5 |
| Idempotency on post | Task 5 (`crypto.randomUUID`) |
| CTA from product | Task 6 |
| Out of scope (transfer/stocktake/…) | Not planned |
