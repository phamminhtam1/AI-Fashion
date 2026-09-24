/**
 * One-shot: add mega-menu children + retarget products off roots that gained kids.
 * Safe to re-run (skips existing slugs).
 */
import { eq } from "drizzle-orm";
import { createDb } from "./client.js";
import * as s from "./schema.js";

const db = createDb(process.env.DATABASE_URL ?? "postgres://elane:elane@localhost:5432/elane");

const CATEGORY_CHILDREN: Record<string, [string, string][]> = {
  "vay-dam": [
    ["dam-cong-so", "Đầm công sở"],
    ["dam-du-tiec", "Đầm dự tiệc"],
    ["dam-maxi", "Đầm maxi"],
    ["dam-midi", "Đầm midi"],
    ["dam-mini", "Đầm mini"],
    ["dam-chu-a", "Đầm chữ A"],
    ["dam-om", "Đầm ôm"],
    ["dam-xoe", "Đầm xòe"],
    ["dam-suong", "Đầm suông"],
  ],
  ao: [
    ["ao-so-mi", "Áo sơ mi"],
    ["ao-kieu", "Áo kiểu"],
    ["ao-len", "Áo len"],
    ["ao-thun", "Áo thun"],
    ["ao-croptop", "Áo croptop"],
    ["ao-tank-top", "Áo tank top"],
    ["ao-vest", "Áo vest"],
  ],
  quan: [
    ["quan-ong-rong", "Quần ống rộng"],
    ["quan-au", "Quần âu"],
    ["quan-jeans", "Quần jeans"],
    ["quan-short", "Quần short"],
    ["quan-culottes", "Quần culottes"],
  ],
};

const LEAF_FOR_ROOT: Record<string, string> = {
  "vay-dam": "dam-suong",
  ao: "ao-so-mi",
  quan: "quan-ong-rong",
};

async function main() {
  const all = await db.select().from(s.categories);
  const bySlug = Object.fromEntries(all.map((c) => [c.slug, c]));

  for (const [parentSlug, kids] of Object.entries(CATEGORY_CHILDREN)) {
    const parent = bySlug[parentSlug];
    if (!parent) {
      console.warn("skip missing parent", parentSlug);
      continue;
    }
    for (let i = 0; i < kids.length; i++) {
      const [slug, name] = kids[i]!;
      if (bySlug[slug]) continue;
      const [row] = await db
        .insert(s.categories)
        .values({
          slug,
          name,
          parentId: parent.id,
          sortOrder: i,
          status: "active",
        })
        .returning();
      bySlug[slug] = row!;
      console.log("created", slug);
    }
  }

  for (const [rootSlug, leafSlug] of Object.entries(LEAF_FOR_ROOT)) {
    const root = bySlug[rootSlug];
    const leaf = bySlug[leafSlug];
    if (!root || !leaf) continue;

    const productsOnRoot = await db
      .select()
      .from(s.products)
      .where(eq(s.products.primaryCategoryId, root.id));
    for (const p of productsOnRoot) {
      await db.update(s.products).set({ primaryCategoryId: leaf.id, updatedAt: new Date() }).where(eq(s.products.id, p.id));
      await db.delete(s.productCategories).where(eq(s.productCategories.productId, p.id));
      await db.insert(s.productCategories).values({ productId: p.id, categoryId: leaf.id });
      console.log("moved product", p.slug, "→", leafSlug);
    }
  }

  console.log("category tree upgrade done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
