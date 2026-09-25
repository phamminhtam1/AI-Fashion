/**
 * One-shot: dồn sort_order mọi nhóm anh/em về 0..n-1.
 * Run: npx tsx apps/api/src/scripts/repack-category-sort.ts
 */
import { config } from "dotenv";
import path from "node:path";
import { asc, eq, isNull } from "drizzle-orm";
import { categories, createDb } from "@elane/db";

config({ path: path.resolve(process.cwd(), ".env") });

const db = createDb(process.env.DATABASE_URL ?? "postgres://elane:elane@localhost:5432/elane");

const all = await db.select({ id: categories.id, parentId: categories.parentId }).from(categories);
const parents = new Set<string | null>();
for (const r of all) parents.add(r.parentId);

for (const parentId of parents) {
  const filter = parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId);
  const siblings = await db
    .select({ id: categories.id, sortOrder: categories.sortOrder, name: categories.name })
    .from(categories)
    .where(filter)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i]!.sortOrder !== i) {
      await db.update(categories).set({ sortOrder: i, updatedAt: new Date() }).where(eq(categories.id, siblings[i]!.id));
      console.log(`  ${siblings[i]!.name}: ${siblings[i]!.sortOrder} → ${i}`);
    }
  }
  console.log(`parent=${parentId ?? "root"}: ${siblings.length} siblings packed`);
}

console.log("done");
process.exit(0);
