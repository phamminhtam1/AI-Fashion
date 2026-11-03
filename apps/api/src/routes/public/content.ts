import { Hono } from "hono";
import { and, asc, desc, eq, or, sql, isNull } from "drizzle-orm";
import { banners, contentPages, contentRevisions, elaneWomanPosts, faqs, products, settings } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { env } from "../../env.js";
import { readStoreSettings, toPublicStoreSettings } from "../../lib/store-settings.js";

export const publicContentRoutes = new Hono<AppVars>();

publicContentRoutes.get("/homepage", async (c) => {
  const db = c.get("db");
  const now = new Date();
  const brand = await db.select().from(settings).where(eq(settings.key, "brand")).limit(1);
  const activeBanners = await db
    .select()
    .from(banners)
    .where(
      and(
        eq(banners.status, "published"),
        or(isNull(banners.startsAt), sql`${banners.startsAt} <= ${now}`),
        or(isNull(banners.endsAt), sql`${banners.endsAt} >= ${now}`),
      ),
    )
    .orderBy(banners.sortOrder);

  const page = await db.select().from(contentPages).where(eq(contentPages.slug, "home")).limit(1);
  let blocks: unknown = {};
  if (page[0]?.publishedRevisionId) {
    const rev = await db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.id, page[0].publishedRevisionId))
      .limit(1);
    blocks = rev[0]?.blocks ?? {};
  }

  return c.json({
    brand: brand[0]?.value ?? { name: "ÉLANE" },
    blocks,
    banners: activeBanners.map((b) => ({
      id: b.id,
      title: b.title,
      cta_label: b.ctaLabel,
      target_url: b.targetUrl,
      placement: b.placement,
    })),
  });
});

publicContentRoutes.get("/storefront-settings", async (c) => {
  const value = await readStoreSettings(
    c.get("db"),
    Boolean(env.sepayBankAccount && env.sepayBankBin),
  );
  return c.json(toPublicStoreSettings(value));
});

publicContentRoutes.get("/faqs", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(faqs)
    .where(eq(faqs.status, "published"))
    .orderBy(faqs.groupName, faqs.sortOrder);
  return c.json({
    items: rows.map((f) => ({
      id: f.id,
      group: f.groupName,
      question: f.question,
      answer: f.answer,
    })),
  });
});

publicContentRoutes.get("/elane-woman", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: elaneWomanPosts.id,
      title: elaneWomanPosts.title,
      image_url: elaneWomanPosts.imageUrl,
      link_url: elaneWomanPosts.linkUrl,
      product_id: elaneWomanPosts.productId,
      instagram_url: elaneWomanPosts.instagramUrl,
      sort_order: elaneWomanPosts.sortOrder,
      product_slug: products.slug,
      product_name: products.name,
    })
    .from(elaneWomanPosts)
    .leftJoin(products, eq(products.id, elaneWomanPosts.productId))
    .where(eq(elaneWomanPosts.status, "published"))
    .orderBy(asc(elaneWomanPosts.sortOrder), desc(elaneWomanPosts.createdAt));

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      image_url: r.image_url,
      link_url: r.link_url || (r.product_slug ? `/san-pham/${r.product_slug}` : null),
      product_id: r.product_id,
      product_slug: r.product_slug,
      product_name: r.product_name,
      instagram_url: r.instagram_url,
      sort_order: r.sort_order,
    })),
  });
});
