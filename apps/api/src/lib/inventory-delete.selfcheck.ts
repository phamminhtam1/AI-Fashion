/**
 * ponytail: reverse-delta rules for deleting a posted inventory doc.
 * Run: npx tsx apps/api/src/lib/inventory-delete.selfcheck.ts
 */
function nextOnHand(onHand: number, reserved: number, postedDelta: number): number | "reject" {
  const next = onHand + -postedDelta;
  if (next < 0 || reserved > next) return "reject";
  return next;
}

const cases: Array<[number, number, number, number | "reject"]> = [
  [10, 0, 5, 5], // reverse receipt +5
  [5, 0, -3, 8], // reverse issue -3
  [2, 0, 5, "reject"], // can't reverse receipt if stock already sold down
  [5, 3, 3, "reject"], // would leave less than reserved
  [5, 0, 5, 0], // back to zero
];

for (const [onHand, reserved, delta, expect] of cases) {
  const got = nextOnHand(onHand, reserved, delta);
  if (got !== expect) {
    console.error(`FAIL onHand=${onHand} reserved=${reserved} delta=${delta}: expected ${expect}, got ${got}`);
    process.exit(1);
  }
}
console.log("inventory-delete.selfcheck: ok");
