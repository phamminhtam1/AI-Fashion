import { Hono } from "hono";
import { and, asc, desc, eq, or, sql, isNull } from "drizzle-orm";
import { banners, contentPages, contentRevisions, elaneWomanPosts, faqs, lookbooks, lookbookItems, products, settings } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
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

publicContentRoutes.get("/lookbooks", async (c) => {
  const db = c.get("db");
  const lookbookList = await db
    .select()
    .from(lookbooks)
    .where(eq(lookbooks.status, "published"))
    .orderBy(asc(lookbooks.sortOrder), desc(lookbooks.createdAt));

  const items = await db
    .select({
      id: lookbookItems.id,
      lookbook_id: lookbookItems.lookbookId,
      title: lookbookItems.title,
      caption: lookbookItems.caption,
      image_url: lookbookItems.imageUrl,
      product_id: lookbookItems.productId,
      link_url: lookbookItems.linkUrl,
      sort_order: lookbookItems.sortOrder,
      product_slug: products.slug,
      product_name: products.name,
      product_status: products.status,
    })
    .from(lookbookItems)
    .leftJoin(products, eq(products.id, lookbookItems.productId))
    .where(eq(lookbookItems.status, "published"))
    .orderBy(asc(lookbookItems.sortOrder), asc(lookbookItems.createdAt));

  const itemsByLookbook = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemsByLookbook.get(it.lookbook_id) || [];
    list.push(it);
    itemsByLookbook.set(it.lookbook_id, list);
  }

  return c.json({
    items: lookbookList.map((lb) => ({
      id: lb.id,
      slug: lb.slug,
      title: lb.title,
      subtitle: lb.subtitle,
      description: lb.description,
      season: lb.season,
      cover_image_url: lb.coverImageUrl,
      sort_order: lb.sortOrder,
      items: (itemsByLookbook.get(lb.id) || []).map((it) => ({
        id: it.id,
        title: it.title,
        caption: it.caption,
        image_url: it.image_url,
        product_id: it.product_id,
        product_slug: it.product_slug,
        product_name: it.product_name,
        link_url: it.product_id
          ? it.product_status === "published" && it.product_slug
            ? `/san-pham/${it.product_slug}`
            : null
          : it.link_url,
        sort_order: it.sort_order,
      })),
    })),
  });
});

publicContentRoutes.get("/lookbooks/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  const [lb] = await db
    .select()
    .from(lookbooks)
    .where(and(eq(lookbooks.slug, slug), eq(lookbooks.status, "published")))
    .limit(1);

  if (!lb) {
    throw new ApiError(404, "not_found", "Không tìm thấy bộ Lookbook");
  }

  const items = await db
    .select({
      id: lookbookItems.id,
      lookbook_id: lookbookItems.lookbookId,
      title: lookbookItems.title,
      caption: lookbookItems.caption,
      image_url: lookbookItems.imageUrl,
      product_id: lookbookItems.productId,
      link_url: lookbookItems.linkUrl,
      sort_order: lookbookItems.sortOrder,
      product_slug: products.slug,
      product_name: products.name,
      product_status: products.status,
    })
    .from(lookbookItems)
    .leftJoin(products, eq(products.id, lookbookItems.productId))
    .where(and(eq(lookbookItems.lookbookId, lb.id), eq(lookbookItems.status, "published")))
    .orderBy(asc(lookbookItems.sortOrder), asc(lookbookItems.createdAt));

  return c.json({
    id: lb.id,
    slug: lb.slug,
    title: lb.title,
    subtitle: lb.subtitle,
    description: lb.description,
    season: lb.season,
    cover_image_url: lb.coverImageUrl,
    sort_order: lb.sortOrder,
    items: items.map((it) => ({
      id: it.id,
      title: it.title,
      caption: it.caption,
      image_url: it.image_url,
      product_id: it.product_id,
      product_slug: it.product_slug,
      product_name: it.product_name,
      link_url: it.product_id
        ? it.product_status === "published" && it.product_slug
          ? `/san-pham/${it.product_slug}`
          : null
        : it.link_url,
      sort_order: it.sort_order,
    })),
  });
});


