import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectDescendantIds,
  wouldCreateCycle,
  enrichTree,
  sortTreeOrder,
  rollupProductCounts,
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

  it("rollupProductCounts aggregates child category products into parent category", () => {
    const pmap = new Map<string, string[]>([
      ["a", ["p1"]],
      ["b", ["p2", "p3"]],
      ["c", ["p4"]],
      ["d", ["p5"]],
    ]);
    const counts = rollupProductCounts(nodes, pmap);
    // c has 1 (p4)
    assert.equal(counts.get("c"), 1);
    // b has 2 + 1 = 3 (p2, p3, p4)
    assert.equal(counts.get("b"), 3);
    // a has 1 + 2 + 1 = 4 (p1, p2, p3, p4)
    assert.equal(counts.get("a"), 4);
    // d has 1 (p5)
    assert.equal(counts.get("d"), 1);
  });
});
