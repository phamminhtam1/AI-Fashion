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
