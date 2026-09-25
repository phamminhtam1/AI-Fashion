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
