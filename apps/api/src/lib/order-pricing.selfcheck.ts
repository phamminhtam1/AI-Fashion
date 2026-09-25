// ponytail: assert order pricing / stock helpers
import assert from "node:assert/strict";
import { availableQty, newOrderNumber, shippingFeeVnd } from "./order-pricing.js";

assert.equal(availableQty(5, 2), 3);
assert.equal(availableQty(2, 5), 0);
assert.equal(shippingFeeVnd(999_999), 30_000);
assert.equal(shippingFeeVnd(1_000_000), 0);
assert.ok(newOrderNumber().startsWith("ELN"));
assert.match(newOrderNumber(), /^ELN\d{6}$/);

console.log("order-pricing.selfcheck: ok");
