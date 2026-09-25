// ponytail: assert filmstrip loop math (selected always leads the 4-slot window)
import assert from "node:assert/strict";

const ADJACENT_MS = 800;
const JUMP_MS = 1000;

function filmDurationForSteps(steps: number) {
  return Math.abs(steps) <= 1 ? ADJACENT_MS : JUMP_MS;
}

function loopDelta(from: number, to: number, n: number) {
  if (n <= 0 || from === to) return 0;
  const forward = (to - from + n) % n;
  const backward = (from - to + n) % n;
  return forward <= backward ? forward : -backward;
}

function normalizeStripIndex(index: number, n: number) {
  return ((index % n) + n) % n + n;
}

assert.equal(filmDurationForSteps(1), 800);
assert.equal(filmDurationForSteps(3), 1000);

// 1→4 continues forward on the circle (not sticky)
assert.equal(loopDelta(0, 3, 7), 3);
// last→first / first→last wrap
assert.equal(loopDelta(6, 0, 7), 1);
assert.equal(loopDelta(0, 6, 7), -1);

assert.equal(normalizeStripIndex(7 + 3, 7), 7 + 3);
assert.equal(normalizeStripIndex(7 + 6 + 1, 7), 7);

console.log("film-duration.selfcheck: ok");
