/**
 * ponytail: parsers for pantio import (no network).
 * Run: npx tsx apps/api/src/scripts/import-pantio.selfcheck.ts
 */
import { groupImagesByColor, pickRandomSizes, splitMaterial, slugify } from "./import-pantio.js";

const sm = splitMaterial("Hello world. Chất liệu:Vải thô mỏng");
if (sm.description !== "Hello world." || sm.material !== "Vải thô mỏng") {
  console.error("splitMaterial fail", sm);
  process.exit(1);
}

const g = groupImagesByColor([
  "https://cdn.example/fas54304__w__1198k__1__abc_grande.jpg",
  "https://cdn.example/fas54304__w__1198k__1__abc_master.jpg",
  "https://cdn.example/fas54304__w__1198k__2__def_master.jpg",
  "https://cdn.example/fas54304__x__1198k__1__ghi_master.jpg",
]);
if (!g.has("w") || g.get("w")!.length !== 2 || !g.has("x")) {
  console.error("groupImages fail", g);
  process.exit(1);
}

for (let i = 0; i < 20; i++) {
  const s = pickRandomSizes(["XS", "S", "M", "L", "XL"]);
  if (s.length < 2 || s.length > 4) {
    console.error("pickRandomSizes fail", s);
    process.exit(1);
  }
}

if (slugify("Áo sơ mi") !== "ao-so-mi") {
  console.error("slugify fail", slugify("Áo sơ mi"));
  process.exit(1);
}

console.log("import-pantio.selfcheck: ok");
