# Admin Category Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin can CRUD an unlimited-depth category tree (parent picker, indented list, cascade archive/hard-delete subtree); products may only attach to leaf categories; seed includes mega-menu-like children.

**Architecture:** Pure tree helpers in `apps/api/src/lib/category-tree.ts` (cycle detection, subtree ids, depth/leaf enrichment). Admin category routes use them for list enrichment and delete/archive cascade. Product create/update rejects non-leaf `primary_category_id`. Admin UI builds indented rows client-side from flat `parent_id` list. Storefront mega menu stays hardcoded.

**Tech Stack:** Hono + Drizzle (`categories.parent_id`), React admin (`CategoriesManager`, `ProductsManager`), Node `tsx --test` for helper unit tests, existing seed script.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-24-admin-category-tree-design.md`
- Depth: unlimited via `parent_id`; no path/nested-set columns
- Products: leaf-only (`child_count === 0` for any-status children)
- Archive: cascade entire subtree; unarchive: selected node only
- Hard delete: reject if any node in subtree has `product_categories` rows; else delete whole subtree
- Scope: admin + API + seed only — do **not** change storefront `Header` mega hardcode
- Commits: only when the human explicitly asks; skip commit steps unless told

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/src/lib/category-tree.ts` | Pure helpers: depths, descendants, cycle check, DFS order |
| `apps/api/src/lib/category-tree.test.ts` | Unit tests for helpers |
| `apps/api/src/routes/admin/categories.ts` | Enrich list; validate parent; cascade archive/delete |
| `apps/api/src/routes/admin/products.ts` | Leaf check on create/update; meta includes `parent_id`/`is_leaf` |
| `apps/admin/src/lib/api.ts` | Category + ProductMeta types; `parent_id` on create/update |
| `apps/admin/src/components/CategoriesManager.tsx` | Tree UI, parent select, Thêm con, cascade copy |
| `apps/admin/src/components/ProductsManager.tsx` | Leaf-only category `<select>` |
| `packages/db/src/seed.ts` | Child categories + retarget products to leaves |

---

### Task 1: Category tree helpers + unit tests

**Files:**
- Create: `apps/api/src/lib/category-tree.ts`
- Create: `apps/api/src/lib/category-tree.test.ts`

**Interfaces:**
- Consumes: nothing (pure)
- Produces:
  - `type CatNode = { id: string; parentId: string | null }`
  - `function collectDescendantIds(nodes: CatNode[], rootId: string): string[]` — all descendants, not including root
  - `function wouldCreateCycle(nodes: CatNode[], nodeId: string, newParentId: string | null): boolean`
  - `function enrichTree<T extends CatNode>(nodes: T[]): Array<T & { depth: number; child_count: number; is_leaf: boolean }>`
  - `function sortTreeOrder<T extends CatNode & { sortOrder?: number; name?: string }>(nodes: T[]): T[]` — DFS, siblings by `sortOrder` then `name`

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/lib/category-tree.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectDescendantIds,
  wouldCreateCycle,
  enrichTree,
  sortTreeOrder,
} from "./category-tree.js";

const nodes = [
  { id: "a", parentId: null, sortOrder: 0, name: "A" },
  { id: "b", parentId: "a", sortOrder: 0, name: "B" },
  { id: "c", parentId: "b", sortOrder: 0, name: "C" },
  { id: "d", parentId: null, sortOrder: 1, name: "D" },
];

describe("category-tree", () => {
  it("collectDescendantIds", () => {
    assert.deepEqual(collectDescendantIds(nodes, "a").sort(), ["b", "c"]);
    assert.deepEqual(collectDescendantIds(nodes, "b"), ["c"]);
    assert.deepEqual(collectDescendantIds(nodes, "c"), []);
  });

  it("wouldCreateCycle", () => {
    assert.equal(wouldCreateCycle(nodes, "a", "c"), true);
    assert.equal(wouldCreateCycle(nodes, "a", "d"), false);
    assert.equal(wouldCreateCycle(nodes, "a", null), false);
    assert.equal(wouldCreateCycle(nodes, "a", "a"), true);
  });

  it("enrichTree depths and leaves", () => {
    const e = enrichTree(nodes);
    const byId = Object.fromEntries(e.map((x) => [x.id, x]));
    assert.equal(byId.a!.depth, 0);
    assert.equal(byId.b!.depth, 1);
    assert.equal(byId.c!.depth, 2);
    assert.equal(byId.a!.is_leaf, false);
    assert.equal(byId.c!.is_leaf, true);
    assert.equal(byId.d!.is_leaf, true);
    assert.equal(byId.a!.child_count, 1);
  });

  it("sortTreeOrder DFS", () => {
    assert.deepEqual(
      sortTreeOrder(nodes).map((n) => n.id),
      ["a", "b", "c", "d"],
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "c:\AI-enabled fashion\apps\api" && npx tsx --test src/lib/category-tree.test.ts`

Expected: FAIL (module not found / export missing)

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/api/src/lib/category-tree.ts
export type CatNode = { id: string; parentId: string | null };

export function collectDescendantIds(nodes: CatNode[], rootId: string): string[] {
  const byParent = new Map<string | null, string[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n.id);
    byParent.set(n.parentId, list);
  }
  const out: string[] = [];
  const stack = [...(byParent.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const child of byParent.get(id) ?? []) stack.push(child);
  }
  return out;
}

export function wouldCreateCycle(nodes: CatNode[], nodeId: string, newParentId: string | null): boolean {
  if (newParentId === null) return false;
  if (newParentId === nodeId) return true;
  const descendants = new Set(collectDescendantIds(nodes, nodeId));
  return descendants.has(newParentId);
}

export function enrichTree<T extends CatNode>(
  nodes: T[],
): Array<T & { depth: number; child_count: number; is_leaf: boolean }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childCount = new Map<string, number>();
  for (const n of nodes) {
    if (n.parentId) childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1);
  }
  function depthOf(id: string, seen = new Set<string>()): number {
    const n = byId.get(id);
    if (!n?.parentId) return 0;
    if (seen.has(id)) return 0; // ponytail: broken cycle → treat as root
    seen.add(id);
    return 1 + depthOf(n.parentId, seen);
  }
  return nodes.map((n) => {
    const cc = childCount.get(n.id) ?? 0;
    return { ...n, depth: depthOf(n.id), child_count: cc, is_leaf: cc === 0 };
  });
}

export function sortTreeOrder<T extends CatNode & { sortOrder?: number; name?: string }>(nodes: T[]): T[] {
  const byParent = new Map<string | null, T[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? [];
    list.push(n);
    byParent.set(n.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        (a.name ?? "").localeCompare(b.name ?? "", "vi"),
    );
  }
  const out: T[] = [];
  function walk(parentId: string | null) {
    for (const n of byParent.get(parentId) ?? []) {
      out.push(n);
      walk(n.id);
    }
  }
  walk(null);
  return out;
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `cd "c:\AI-enabled fashion\apps\api" && npx tsx --test src/lib/category-tree.test.ts`

Expected: PASS (4 tests)

- [ ] **Step 5: Commit** (only if human asked)

```bash
git add apps/api/src/lib/category-tree.ts apps/api/src/lib/category-tree.test.ts
git commit -m "feat(api): add category tree helpers"
```

---

### Task 2: Admin categories API — enrich, parent validation, cascade

**Files:**
- Modify: `apps/api/src/routes/admin/categories.ts`

**Interfaces:**
- Consumes: helpers from Task 1; existing `upsertSchema` with `parent_id`
- Produces: list/get JSON fields `depth`, `child_count`, `is_leaf` (plus existing); cascade archive/delete behavior

- [ ] **Step 1: Add shared mapper + load-all helper at top of routes file (after imports)**

```ts
import {
  collectDescendantIds,
  enrichTree,
  sortTreeOrder,
  wouldCreateCycle,
} from "../../lib/category-tree.js";

async function loadCategoryGraph(db: AppVars["Variables"]["db"] extends infer D ? D : never) {
  const rows = await db.select().from(categories);
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    sortOrder: r.sortOrder,
    name: r.name,
    raw: r,
  }));
}

async function assertValidParent(
  db: Parameters<typeof loadCategoryGraph>[0],
  nodeId: string | null,
  parentId: string | null,
) {
  if (parentId === null) return;
  const parent = await db.select().from(categories).where(eq(categories.id, parentId)).limit(1);
  if (!parent[0]) throw new ApiError(400, "invalid_parent", "Danh mục cha không tồn tại");
  if (!nodeId) return;
  const graph = await loadCategoryGraph(db);
  if (wouldCreateCycle(graph, nodeId, parentId)) {
    throw new ApiError(400, "cycle", "Không thể chọn danh mục con làm cha (tạo chu kỳ)");
  }
}

async function assertCanAddChild(
  db: Parameters<typeof loadCategoryGraph>[0],
  parentId: string,
) {
  const [pc] = await db
    .select({ n: count() })
    .from(productCategories)
    .where(eq(productCategories.categoryId, parentId));
  if (Number(pc?.n ?? 0) > 0) {
    throw new ApiError(
      409,
      "parent_has_products",
      "Danh mục cha đang gắn sản phẩm — chuyển SP sang lá khác trước khi thêm con",
    );
  }
}
```

Use the project’s actual `db` type from `c.get("db")` — if `AppVars` typing is awkward, type as `ReturnType` / inline without the conditional type (ponytail: `db: any` is worse; prefer inferring from Hono context or import `Db` from `@elane/db` if exported). Prefer:

```ts
type Db = ReturnType<typeof createDb>; // only if createDb is importable; else leave untyped param as typeof c.get("db")
```

Simplest acceptable: inline the checks in handlers without a fancy Db alias.

- [ ] **Step 2: Update GET `/` to enrich + tree-sort**

After loading `rows` (keep status filter), build:

```ts
const graph = rows.map((r) => ({
  id: r.id,
  parentId: r.parentId,
  sortOrder: r.sortOrder,
  name: r.name,
}));
const enriched = enrichTree(graph);
const ordered = sortTreeOrder(enriched);
const childIdsPresent = new Set(rows.map((r) => r.id));
// Note: child_count from enrichTree only counts nodes in `rows`.
// When status filter hides children, is_leaf may be wrong.
// Spec: leaf = any-status children. So always load full graph for enrich counts:
```

**Required behavior:** even when `?status=active`, compute `child_count` / `is_leaf` / `depth` from **all** categories in DB, then filter the response list by status (and still DFS-order the filtered set by walking full tree and skipping non-matching).

Implementation sketch:

```ts
const all = await db.select().from(categories);
const enrichedAll = enrichTree(
  all.map((r) => ({ id: r.id, parentId: r.parentId, sortOrder: r.sortOrder, name: r.name })),
);
const enrichById = Object.fromEntries(enrichedAll.map((e) => [e.id, e]));
const orderedAll = sortTreeOrder(enrichedAll);
const filteredOrdered = orderedAll.filter((n) => {
  const row = all.find((r) => r.id === n.id)!;
  if (status && status !== "all" && row.status !== status) return false;
  return true;
});

const items = [];
for (const n of filteredOrdered) {
  const row = all.find((r) => r.id === n.id)!;
  const meta = enrichById[n.id]!;
  const [pc] = await db
    .select({ n: count() })
    .from(productCategories)
    .where(eq(productCategories.categoryId, row.id));
  items.push({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sort_order: row.sortOrder,
    status: row.status,
    parent_id: row.parentId,
    seo_title: row.seoTitle,
    seo_description: row.seoDescription,
    product_count: Number(pc?.n ?? 0),
    depth: meta.depth,
    child_count: meta.child_count,
    is_leaf: meta.is_leaf,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  });
}
return c.json({ items });
```

(Optional ponytail: batch product counts in one query grouped by category_id instead of N+1.)

- [ ] **Step 3: GET `/:id` — add same enrichment fields**

- [ ] **Step 4: POST `/` — validate parent + parent_has_products**

Before insert:

```ts
const parentId = body.data.parent_id ?? null;
if (parentId) {
  await assertValidParent(db, null, parentId);
  await assertCanAddChild(db, parentId);
}
```

Return JSON in the same shape as list item (or existing returning row + enrich) — keep 201.

- [ ] **Step 5: PATCH `/:id` — validate parent change + parent_has_products when moving under a parent**

```ts
const nextParent =
  body.data.parent_id !== undefined ? body.data.parent_id : existing[0].parentId;
if (body.data.parent_id !== undefined) {
  await assertValidParent(db, existing[0].id, nextParent);
  if (nextParent) await assertCanAddChild(db, nextParent);
}
```

Also: if PATCH sets `parent_id` on a node that has products and somehow… no, moving a leaf with products under a parent is fine. Adding a **new child** is what `assertCanAddChild` covers on POST; on PATCH when changing X’s parent to P, check P has no products.

- [ ] **Step 6: DELETE — cascade archive / subtree hard delete**

Replace single-row logic:

```ts
const all = await db.select().from(categories);
const graph = all.map((r) => ({ id: r.id, parentId: r.parentId }));
const subtreeIds = [existing[0].id, ...collectDescendantIds(graph, existing[0].id)];

// product counts for subtree
let subtreeProductCount = 0;
for (const id of subtreeIds) {
  const [pc] = await db
    .select({ n: count() })
    .from(productCategories)
    .where(eq(productCategories.categoryId, id));
  subtreeProductCount += Number(pc?.n ?? 0);
}

if (hard) {
  if (subtreeProductCount > 0) {
    throw new ApiError(
      409,
      "in_use",
      `Nhánh danh mục đang gắn ${subtreeProductCount} sản phẩm — hãy ẩn hoặc chuyển SP trước khi xóa`,
    );
  }
  // children first: delete by depth desc
  const enriched = enrichTree(all.map((r) => ({ id: r.id, parentId: r.parentId })));
  const toDelete = enriched
    .filter((e) => subtreeIds.includes(e.id))
    .sort((a, b) => b.depth - a.depth);
  for (const n of toDelete) {
    await db.delete(categories).where(eq(categories.id, n.id));
  }
  // audit once on root
  ...
  return c.json({ id: existing[0].id, deleted: true, deleted_ids: subtreeIds });
}

// soft archive cascade
await db
  .update(categories)
  .set({ status: "archived", updatedAt: new Date() })
  .where(inArray(categories.id, subtreeIds));
// import inArray from drizzle-orm
```

Update archive confirm messaging later in UI to mention subtree.

- [ ] **Step 7: Manual smoke (API running)**

```bash
# login cookie then:
# POST child under ao, POST grandchild, PATCH parent to self → 400 cycle
# DELETE soft parent → children archived
```

- [ ] **Step 8: Commit** (only if human asked)

---

### Task 3: Product leaf validation + meta shape

**Files:**
- Modify: `apps/api/src/routes/admin/products.ts` (meta ~113–129, POST ~177, PATCH ~328–358)

**Interfaces:**
- Consumes: `enrichTree` / or inline child existence check
- Produces: meta.categories include `parent_id`, `is_leaf`; create/update reject non-leaf

- [ ] **Step 1: Add leaf guard helper in products.ts**

```ts
import { enrichTree } from "../../lib/category-tree.js";

async function assertLeafCategory(db: /* same as routes */, categoryId: string) {
  const all = await db.select().from(categories);
  const meta = enrichTree(all.map((r) => ({ id: r.id, parentId: r.parentId })));
  const node = meta.find((m) => m.id === categoryId);
  if (!node) throw new ApiError(400, "invalid_category", "Danh mục không hợp lệ");
  if (!node.is_leaf) {
    throw new ApiError(
      400,
      "not_leaf",
      "Chỉ gắn sản phẩm vào danh mục lá (không còn danh mục con)",
    );
  }
}
```

- [ ] **Step 2: Call `assertLeafCategory` after category exists check on POST and when PATCH includes `primary_category_id`**

- [ ] **Step 3: Update `/meta` categories mapping**

```ts
categories: (() => {
  const enriched = enrichTree(cats.map((r) => ({ id: r.id, parentId: r.parentId, name: r.name, sortOrder: r.sortOrder })));
  const byId = Object.fromEntries(enriched.map((e) => [e.id, e]));
  return cats.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    parent_id: r.parentId,
    is_leaf: byId[r.id]!.is_leaf,
  }));
})(),
```

- [ ] **Step 4: Smoke** — create product with parent category id → 400 `not_leaf`

- [ ] **Step 5: Commit** (only if human asked)

---

### Task 4: Admin API client types

**Files:**
- Modify: `apps/admin/src/lib/api.ts`

- [ ] **Step 1: Extend `Category`**

```ts
export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  status: string;
  parent_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  product_count: number;
  depth?: number;
  child_count?: number;
  is_leaf?: boolean;
};
```

- [ ] **Step 2: Extend `ProductMeta.categories`**

```ts
categories: Array<{
  id: string;
  name: string;
  slug: string;
  status: string;
  parent_id?: string | null;
  is_leaf?: boolean;
}>;
```

- [ ] **Step 3: Add `parent_id` to `createCategory` / `updateCategory` body types**

```ts
parent_id?: string | null;
```

- [ ] **Step 4: Commit** (only if human asked)

---

### Task 5: CategoriesManager tree UI

**Files:**
- Modify: `apps/admin/src/components/CategoriesManager.tsx`

**Interfaces:**
- Consumes: `Category` with `depth`, `parent_id`, `is_leaf`, `child_count`
- Produces: indented table, parent select, Thêm con

- [ ] **Step 1: Extend `FormState`**

```ts
type FormState = {
  name: string;
  slug: string;
  description: string;
  sort_order: string;
  status: "active" | "archived";
  parent_id: string; // "" = root
};
const emptyForm: FormState = { ..., parent_id: "" };
```

- [ ] **Step 2: Client-side tree for parent options**

```ts
function descendantIds(items: Category[], rootId: string): Set<string> {
  const out = new Set<string>();
  const walk = (id: string) => {
    for (const c of items.filter((x) => x.parent_id === id)) {
      out.add(c.id);
      walk(c.id);
    }
  };
  walk(rootId);
  return out;
}

function parentOptions(items: Category[], editingId: string | null) {
  const blocked = editingId ? descendantIds(items, editingId) : new Set<string>();
  if (editingId) blocked.add(editingId);
  return items
    .filter((c) => !blocked.has(c.id))
    .map((c) => ({
      id: c.id,
      label: `${"— ".repeat(c.depth ?? 0)}${c.name}`,
    }));
}
```

(If `depth` missing, compute locally with a small walk.)

- [ ] **Step 3: `openCreate(parentId?: string | null)` / `openEdit` set `parent_id`; `save` send `parent_id: form.parent_id || null`**

- [ ] **Step 4: Sheet field — select Danh mục cha**

```tsx
<label className="block text-sm">
  <span className="text-muted-foreground">Danh mục cha</span>
  <select
    className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
    value={form.parent_id}
    onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
  >
    <option value="">— Gốc —</option>
    {parentOptions(items, editing?.id ?? null).map((o) => (
      <option key={o.id} value={o.id}>{o.label}</option>
    ))}
  </select>
</label>
```

- [ ] **Step 5: Table name cell — indent + Thêm con**

```tsx
<td style={{ paddingLeft: 12 + (cat.depth ?? 0) * 16 }}>
  <button type="button" className="text-left hover:underline" onClick={() => openEdit(cat)}>
    {cat.name}
  </button>
  {!cat.is_leaf && (
    <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">nhóm</span>
  )}
</td>
```

Add row action button (Plus icon) calling `openCreate(cat.id)` with confirm labels unchanged but archive/destroy descriptions mention: “cùng toàn bộ danh mục con”.

- [ ] **Step 6: Expand/collapse (minimal)**

```ts
const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
// visible = filtered where no ancestor is in collapsed
function isHidden(cat: Category): boolean {
  let pid = cat.parent_id;
  while (pid) {
    if (collapsed.has(pid)) return true;
    pid = items.find((x) => x.id === pid)?.parent_id ?? null;
  }
  return false;
}
```

Toggle chevron on non-leaves. Default: all expanded (`collapsed` empty).

- [ ] **Step 7: Product count column** — show count if `is_leaf`, else `—`

- [ ] **Step 8: Manual UI check in admin** — create Áo → Áo sơ mi indented; archive Áo archives children

- [ ] **Step 9: Commit** (only if human asked)

---

### Task 6: ProductsManager leaf-only category select

**Files:**
- Modify: `apps/admin/src/components/ProductsManager.tsx` (category `<select>` ~686–695)

- [ ] **Step 1: Build leaf options from meta**

```ts
const leafCategories = useMemo(() => {
  const cats = meta?.categories ?? [];
  return cats.filter((c) => c.is_leaf !== false && c.status === "active");
  // if is_leaf undefined (old API), fall back to all — but after Task 3 always present
}, [meta]);
```

Prefer: `cats.filter((c) => c.is_leaf && c.status !== "archived")`.

Optional label with parent name:

```ts
function catLabel(c: { id: string; name: string; parent_id?: string | null }) {
  const parent = meta?.categories.find((p) => p.id === c.parent_id);
  return parent ? `${parent.name} / ${c.name}` : c.name;
}
```

- [ ] **Step 2: Map `leafCategories` in the select instead of `meta?.categories`

- [ ] **Step 3: When opening edit, if current category is non-leaf (legacy data), still include that one option so save isn’t forced blank — or show toast to pick a leaf. Prefer include current id even if not leaf until user changes.

```ts
const categoryOptions = useMemo(() => {
  const leaves = (meta?.categories ?? []).filter((c) => c.is_leaf);
  const currentId = form.primary_category_id;
  const current = meta?.categories.find((c) => c.id === currentId);
  if (current && !leaves.some((l) => l.id === current.id)) return [current, ...leaves];
  return leaves;
}, [meta, form.primary_category_id]);
```

- [ ] **Step 4: Manual check** — dropdown only shows lá; saving non-leaf blocked by API

- [ ] **Step 5: Commit** (only if human asked)

---

### Task 7: Seed children + retarget products

**Files:**
- Modify: `packages/db/src/seed.ts`

- [ ] **Step 1: Replace flat `CATEGORIES` insert with roots + children**

Keep root tuples; after inserting roots, insert children:

```ts
const CATEGORY_CHILDREN: Record<string, [string, string][]> = {
  "vay-dam": [
    ["dam-cong-so", "Đầm công sở"],
    ["dam-du-tiec", "Đầm dự tiệc"],
    ["dam-maxi", "Đầm maxi"],
    ["dam-midi", "Đầm midi"],
    ["dam-mini", "Đầm mini"],
    ["dam-chu-a", "Đầm chữ A"],
    ["dam-om", "Đầm ôm"],
    ["dam-xoe", "Đầm xòe"],
    ["dam-suong", "Đầm suông"],
  ],
  ao: [
    ["ao-so-mi", "Áo sơ mi"],
    ["ao-kieu", "Áo kiểu"],
    ["ao-len", "Áo len"],
    ["ao-thun", "Áo thun"],
    ["ao-croptop", "Áo croptop"],
    ["ao-tank-top", "Áo tank top"],
    ["ao-vest", "Áo vest"],
  ],
  quan: [
    ["quan-ong-rong", "Quần ống rộng"],
    ["quan-au", "Quần âu"],
    ["quan-jeans", "Quần jeans"],
    ["quan-short", "Quần short"],
    ["quan-culottes", "Quần culottes"],
  ],
};

// After catBySlug from roots:
for (const [parentSlug, kids] of Object.entries(CATEGORY_CHILDREN)) {
  const parent = catBySlug[parentSlug]!;
  const childRows = await db
    .insert(s.categories)
    .values(
      kids.map(([slug, name], i) => ({
        slug,
        name,
        parentId: parent.id,
        sortOrder: i,
        status: "active",
        description: null,
      })),
    )
    .returning();
  for (const c of childRows) catBySlug[c.slug] = c;
}
```

- [ ] **Step 2: Map product `catSlug` roots → default leaf**

```ts
const LEAF_FOR_ROOT: Record<string, string> = {
  "vay-dam": "dam-suong",
  ao: "ao-so-mi",
  quan: "quan-ong-rong",
  "chan-vay": "chan-vay", // still leaf (no children)
  "set-bo": "set-bo",
  "ao-khoac": "ao-khoac",
  "phu-kien": "phu-kien",
};

// in product loop:
const leafSlug = LEAF_FOR_ROOT[catSlug] ?? catSlug;
const cat = catBySlug[leafSlug]!;
```

Same for draft product using `vay-dam` → `dam-suong`.

- [ ] **Step 3: Re-seed DB**

```bash
# from repo root, using existing docker/npm seed command in README
```

Document the exact command from README (e.g. `npm run db:seed` or `docker compose exec api ...`). Read `README.md` and use that command.

- [ ] **Step 4: Verify admin** — roots have children; products on leaves; cannot attach SP to `ao`

- [ ] **Step 5: Commit** (only if human asked)

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Unlimited `parent_id` tree, no new columns | 1–2 |
| Cycle forbidden | 1–2 |
| Leaf-only products | 3, 6 |
| Block add child if parent has products | 2 |
| Archive cascade | 2, 5 copy |
| Hard delete subtree / 409 if products | 2 |
| Unarchive = single node (no cascade restore) | unchanged PATCH status; no new restore cascade |
| List: depth, child_count, is_leaf, product_count | 2 |
| Admin indented UI + parent select + Thêm con | 5 |
| ProductsManager leaves only | 6 |
| Seed children + retarget | 7 |
| Storefront mega unchanged | (explicit non-goal) |
| Helper unit test | 1 |

## Plan self-review

- No TBD placeholders in steps.
- Types: `parent_id` / `is_leaf` / `depth` consistent across API → `api.ts` → UI.
- `child_count` for leaf check always from full DB graph (Task 2 Step 2).
