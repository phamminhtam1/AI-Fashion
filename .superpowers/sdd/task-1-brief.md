### Task 1: Category tree helpers + unit tests

**Files:**
- Create: `apps/api/src/lib/category-tree.ts`
- Create: `apps/api/src/lib/category-tree.test.ts`

**Interfaces:**
- Consumes: nothing (pure)
- Produces:
  - `type CatNode = { id: string; parentId: string | null }`
  - `function collectDescendantIds(nodes: CatNode[], rootId: string): string[]` â€” all descendants, not including root
  - `function wouldCreateCycle(nodes: CatNode[], nodeId: string, newParentId: string | null): boolean`
  - `function enrichTree<T extends CatNode>(nodes: T[]): Array<T & { depth: number; child_count: number; is_leaf: boolean }>`
  - `function sortTreeOrder<T extends CatNode & { sortOrder?: number; name?: string }>(nodes: T[]): T[]` â€” DFS, siblings by `sortOrder` then `name`

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
    if (seen.has(id)) return 0; // ponytail: broken cycle â†’ treat as root
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
