import assert from "node:assert/strict";

/** Mirror of storefront categorySubtreeSlugs — fail if tree walk breaks. */
function subtreeSlugs(
  cats: Array<{ id: string; slug: string; parent_id: string | null }>,
  slug: string,
): Set<string> {
  const root = cats.find((c) => c.slug === slug);
  if (!root) return new Set([slug]);
  const out = new Set<string>([root.slug]);
  const queue = [root.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of cats) {
      if (child.parent_id === id) {
        out.add(child.slug);
        queue.push(child.id);
      }
    }
  }
  return out;
}

const cats = [
  { id: "1", slug: "vay-dam", parent_id: null },
  { id: "2", slug: "dam-maxi", parent_id: "1" },
  { id: "3", slug: "dam-om", parent_id: "1" },
  { id: "4", slug: "ao", parent_id: null },
];

const vay = subtreeSlugs(cats, "vay-dam");
assert.equal(vay.has("vay-dam"), true);
assert.equal(vay.has("dam-maxi"), true);
assert.equal(vay.has("dam-om"), true);
assert.equal(vay.has("ao"), false);
assert.deepEqual([...subtreeSlugs(cats, "dam-maxi")], ["dam-maxi"]);
console.log("category-subtree.selfcheck: ok");
