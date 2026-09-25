/**
 * ponytail: self-check for per-colorway size sync rules (no DB).
 * Run: npx tsx apps/api/src/lib/colorway-sizes.selfcheck.ts
 */
function wantedPairs(
  colorwaySizes: Array<{ colorway_id: string; size_ids: string[] }>,
): Set<string> {
  const out = new Set<string>();
  for (const e of colorwaySizes) {
    for (const s of e.size_ids) out.add(`${e.colorway_id}:${s}`);
  }
  return out;
}

function shouldKeep(variantKey: string, want: Set<string>) {
  return want.has(variantKey);
}

const want = wantedPairs([
  { colorway_id: "cw1", size_ids: ["s", "m"] },
  { colorway_id: "cw2", size_ids: ["m"] },
]);

const cases: Array<[string, boolean]> = [
  ["cw1:s", true],
  ["cw1:m", true],
  ["cw1:l", false],
  ["cw2:m", true],
  ["cw2:s", false],
];

for (const [key, expect] of cases) {
  const got = shouldKeep(key, want);
  if (got !== expect) {
    console.error(`FAIL ${key}: expected ${expect}, got ${got}`);
    process.exit(1);
  }
}

console.log("colorway-sizes.selfcheck: ok");
