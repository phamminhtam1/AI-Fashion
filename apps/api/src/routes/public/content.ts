import { Hono } from "hono";
import { and, eq, or, sql, isNull } from "drizzle-orm";
import { banners, contentPages, contentRevisions, faqs, settings } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";

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

publicContentRoutes.get("/pages/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");
  const page = await db
    .select()
    .from(contentPages)
    .where(and(eq(contentPages.slug, slug), eq(contentPages.status, "published")))
    .limit(1);
  if (!page[0]?.publishedRevisionId) throw new ApiError(404, "not_found", "Không tìm thấy trang");
  const rev = await db
    .select()
    .from(contentRevisions)
    .where(eq(contentRevisions.id, page[0].publishedRevisionId))
    .limit(1);
  return c.json({
    slug: page[0].slug,
    title: page[0].title,
    type: page[0].type,
    seo_title: page[0].seoTitle,
    seo_description: page[0].seoDescription,
    blocks: rev[0]?.blocks ?? {},
  });
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
