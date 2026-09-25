import assert from "node:assert/strict";
import { isAutoNew } from "./product-flags.js";

const now = new Date("2026-09-25T12:00:00Z");
assert.equal(isAutoNew(new Date("2026-09-24T12:00:00Z"), new Date("2026-01-01"), now), true);
assert.equal(isAutoNew(new Date("2026-09-22T12:00:00Z"), new Date("2026-01-01"), now), true);
assert.equal(isAutoNew(new Date("2026-09-21T11:00:00Z"), new Date("2026-01-01"), now), false);
assert.equal(isAutoNew(null, new Date("2026-09-25T10:00:00Z"), now), true);
assert.equal(isAutoNew(null, new Date("2026-09-01T10:00:00Z"), now), false);
console.log("product-flags self-check ok");
