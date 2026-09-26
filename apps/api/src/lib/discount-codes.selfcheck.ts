// ponytail: assert discount compute helpers
import assert from "node:assert/strict";
import { computeDiscountVnd, normalizeCouponCode } from "./discount-codes.js";

assert.equal(normalizeCouponCode("  welcome10 "), "WELCOME10");
assert.equal(
  computeDiscountVnd({ type: "percent", value: 10, baseVnd: 1_000_000, maxDiscountVnd: null }),
  100_000,
);
assert.equal(
  computeDiscountVnd({ type: "percent", value: 50, baseVnd: 1_000_000, maxDiscountVnd: 200_000 }),
  200_000,
);
assert.equal(
  computeDiscountVnd({ type: "fixed", value: 50_000, baseVnd: 40_000, maxDiscountVnd: null }),
  40_000,
);
assert.equal(
  computeDiscountVnd({ type: "fixed", value: 50_000, baseVnd: 100_000, maxDiscountVnd: null }),
  50_000,
);
// fixed can eat into shipping (2k goods + 30k ship)
assert.equal(
  computeDiscountVnd({ type: "fixed", value: 30_000, baseVnd: 32_000, maxDiscountVnd: null }),
  30_000,
);

console.log("discount-codes.selfcheck: ok");
