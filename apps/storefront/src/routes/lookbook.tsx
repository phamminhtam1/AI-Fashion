import { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ZoomIn,
} from "lucide-react";
import { seo } from "@/components/site/PageHeader";
import {
  ensureCategories,
  allProductsList,
  registerProducts,
  mapApiProduct,
  formatVND,
  type Product,
} from "@/lib/products";
import { fetchLookbooks, fetchProducts, fetchProduct, type StoreLookbookItem } from "@/lib/api";
import { VirtualTryOnDialog } from "@/components/tryon/VirtualTryOnDialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const lookbookSearchSchema = z.object({
  collection: z.string().optional(),
});

function getMatchedProduct(
  item: { product_id?: string | null; product_slug?: string | null; link_url?: string | null },
  map: Map<string, Product>,
): Product | undefined {
  if (item.product_id) return map.get(item.product_id);
  if (item.product_slug) return map.get(item.product_slug);
  if (item.link_url) {
    const match = item.link_url.match(/\/san-pham\/([a-zA-Z0-9_-]+)/);
    if (match && match[1] && map.has(match[1])) return map.get(match[1]);
  }
  return undefined;
}

function matchLookbookSlug(itemSlug: string, querySlug?: string): boolean {
  if (!querySlug || querySlug === "all") return false;
  if (itemSlug === querySlug) return true;
  const aliases: Record<string, string[]> = {
    "autumn-winter-2026": ["thu-dong-2026", "thu-dong", "aw26", "autumn-winter"],
    "the-office-edit": ["the-office", "cong-so", "office-edit"],
    "la-parisienne": ["parisienne", "phap"],
    "evening-noir": ["noir", "du-tiec", "evening"],
  };
  for (const [canonical, aliasList] of Object.entries(aliases)) {
    if (
      (itemSlug === canonical && aliasList.includes(querySlug)) ||
      (querySlug === canonical && aliasList.includes(itemSlug)) ||
      (aliasList.includes(itemSlug) && aliasList.includes(querySlug))
    ) {
      return true;
    }
  }
  return false;
}

function getCommercialCollectionSlug(lookbookSlug?: string | null): string | null {
  if (!lookbookSlug) return null;
  if (lookbookSlug === "autumn-winter-2026" || lookbookSlug === "thu-dong-2026") {
    return "thu-dong-2026";
  }
  if (lookbookSlug === "the-office-edit" || lookbookSlug === "the-office") {
    return "the-office";
  }
  if (lookbookSlug === "la-parisienne") {
    return "la-parisienne";
  }
  if (lookbookSlug === "evening-noir") {
    return "evening-noir";
  }
  return null;
}

function normalizeLookbookSeason(season?: string | null): string | null {
  if (!season) return null;
  return season.trim().replace(/\b(\d{4})(?:\s+\1)+\b/g, "$1");
}

export const Route = createFileRoute("/lookbook")({
  validateSearch: lookbookSearchSchema,
  loader: async () => {
    const [_, lookbooksRes] = await Promise.all([ensureCategories(), fetchLookbooks()]);

    // Extract all product IDs and slugs referenced by lookbook items
    const productSlugs = new Set<string>();
    const productIds = new Set<string>();
    for (const lb of lookbooksRes.items) {
      for (const it of lb.items) {
        if (it.product_slug) productSlugs.add(it.product_slug);
        if (it.product_id) productIds.add(it.product_id);
        if (it.link_url) {
          const match = it.link_url.match(/\/san-pham\/([a-zA-Z0-9_-]+)/);
          if (match && match[1]) productSlugs.add(match[1]);
        }
      }
    }

    let attachedProducts: Product[] = [];
    if (productIds.size > 0 || productSlugs.size > 0) {
      try {
        const idList = Array.from(productIds);
        const slugList = Array.from(productSlugs);
        const res = await fetchProducts(
          {
            ids: idList.length > 0 ? idList.join(",") : undefined,
            slugs: slugList.length > 0 ? slugList.join(",") : undefined,
            limit: "100",
          },
          { cache: "no-store" },
        );
        attachedProducts = (res.items ?? []).map(mapApiProduct);
      } catch (err) {
        console.warn(
          "Batch fetch lookbook products failed, falling back to individual fetches:",
          err,
        );
      }

      // Check for any missing products and fetch individually if needed
      const fetchedIds = new Set(attachedProducts.map((p) => p.id));
      const fetchedSlugs = new Set(attachedProducts.map((p) => p.slug));

      const missingSlugs = Array.from(productSlugs).filter((s) => !fetchedSlugs.has(s));
      const missingIds = Array.from(productIds).filter((id) => !fetchedIds.has(id));
      const missingIdentifiers = [
        ...missingSlugs,
        ...missingIds.filter((id) => !missingSlugs.includes(id)),
      ];

      if (missingIdentifiers.length > 0) {
        const fallbackRes = await Promise.all(
          missingIdentifiers.map((ident) =>
            fetchProduct(ident, { cache: "no-store" })
              .then(mapApiProduct)
              .catch(() => null),
          ),
        );
        for (const p of fallbackRes) {
          if (p && !fetchedIds.has(p.id)) {
            attachedProducts.push(p);
            fetchedIds.add(p.id);
          }
        }
      }
    }

    if (attachedProducts.length > 0) {
      registerProducts(attachedProducts);
    }

    const combinedProducts = [...attachedProducts];
    const seenMap = new Set(combinedProducts.map((p) => p.id));
    for (const p of allProductsList()) {
      if (!seenMap.has(p.id)) {
        seenMap.add(p.id);
        combinedProducts.push(p);
      }
    }

    return {
      lookbooks: lookbooksRes.items,
      products: combinedProducts,
    };
  },
  head: () =>
    seo(
      "Lookbook — Những câu chuyện phong cách từ ÉLANE",
      "Khám phá các bộ ảnh thời trang ÉLANE, xem từng look và tìm sản phẩm xuất hiện trong khung hình.",
    ),
  component: LookbookPage,
});

type LookbookCardItem = StoreLookbookItem & {
  lookbookTitle: string;
  lookbookSlug: string;
  season: string | null;
};

function LookbookPage() {
  const { lookbooks, products } = Route.useLoaderData();
  const { collection } = Route.useSearch();
  const [lookIndex, setLookIndex] = useState(0);
  const [lightboxItem, setLightboxItem] = useState<StoreLookbookItem | null>(null);
  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);

  const activeLookbook = useMemo(() => {
    if (!collection || collection === "all") return null;
    return lookbooks.find((entry) => matchLookbookSlug(entry.slug, collection)) ?? null;
  }, [collection, lookbooks]);
  const isOverview = !activeLookbook;

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products) {
      map.set(product.id, product);
      map.set(product.slug, product);
    }
    return map;
  }, [products]);

  const lookItems = useMemo<LookbookCardItem[]>(() => {
    if (!activeLookbook) return [];
    return activeLookbook.items.map((item) => ({
      ...item,
      lookbookTitle: activeLookbook.title,
      lookbookSlug: activeLookbook.slug,
      season: activeLookbook.season,
    }));
  }, [activeLookbook]);

  useEffect(() => setLookIndex(0), [activeLookbook?.id]);

  const safeLookIndex = Math.min(lookIndex, Math.max(lookItems.length - 1, 0));
  const currentItem = lookItems[safeLookIndex];
  const currentProduct = currentItem ? getMatchedProduct(currentItem, productMap) : undefined;
  const productsInCollection = useMemo(() => {
    const uniqueProducts = new Map<string, Product>();
    for (const item of lookItems) {
      const product = getMatchedProduct(item, productMap);
      if (product) uniqueProducts.set(product.id, product);
    }
    return [...uniqueProducts.values()];
  }, [lookItems, productMap]);

  const moveLook = (direction: -1 | 1) => {
    setLookIndex((index) => {
      if (lookItems.length < 2) return 0;
      return (index + direction + lookItems.length) % lookItems.length;
    });
  };

  const openTryOn = (product: Product) => {
    setTryOnProduct(product);
    setTryOnOpen(true);
  };

  const featuredLookbook = lookbooks.find((entry) => entry.items.length > 0) ?? lookbooks[0];
  const featuredImage = featuredLookbook?.cover_image_url || featuredLookbook?.items[0]?.image_url;

  return (
    <>
      <main className="lookbook-page mx-auto w-full max-w-[1600px] px-4 pb-20 pt-6 md:px-8 md:pt-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex flex-wrap items-center gap-2 text-base font-medium text-muted-foreground md:mb-10"
        >
          <Link to="/" className="transition-colors hover:text-foreground">
            Trang chủ
          </Link>
          <span aria-hidden="true" className="opacity-40">
            /
          </span>
          {activeLookbook ? (
            <>
              <Link
                to="/lookbook"
                search={{ collection: undefined }}
                className="transition-colors hover:text-foreground"
              >
                Lookbook
              </Link>
              <span aria-hidden="true" className="opacity-40">
                /
              </span>
              <span aria-current="page" className="text-foreground">
                {activeLookbook.title}
              </span>
            </>
          ) : (
            <span aria-current="page" className="text-foreground">
              Lookbook
            </span>
          )}
        </nav>

        {isOverview ? (
          <>
            <section className="lookbook-overview-hero grid items-start gap-8 pb-10 md:grid-cols-[0.8fr_1.2fr] md:gap-14 md:pb-14">
              <div className="order-2 max-w-xl md:order-1">
                <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  ÉLANE · Visual stories
                </p>
                <h1 className="max-w-lg font-serif text-4xl leading-[1.08] text-foreground sm:text-5xl lg:text-6xl">
                  Phong cách, qua từng khung hình.
                </h1>
                <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
                  Khám phá những câu chuyện thời trang của ÉLANE. Chọn một bộ ảnh để xem từng look
                  và tìm thiết kế xuất hiện trong khung hình.
                </p>
                {lookbooks.length > 0 && (
                  <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
                    {lookbooks.map((entry, index) => (
                      <Link
                        key={entry.id}
                        to="/lookbook"
                        search={{ collection: entry.slug }}
                        className="group inline-flex items-center gap-2 text-sm text-foreground transition-colors hover:text-muted-foreground"
                      >
                        <span className="text-[10px] text-muted-foreground">{index + 1}</span>
                        <span className="pb-1 underline decoration-transparent underline-offset-4 group-hover:decoration-current">
                          {entry.title}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {featuredLookbook && featuredImage ? (
                <Link
                  to="/lookbook"
                  search={{ collection: featuredLookbook.slug }}
                  className="lookbook-featured-image group relative order-1 block overflow-hidden bg-secondary md:order-2"
                >
                  <img
                    src={featuredImage}
                    alt={featuredLookbook.title}
                    className="aspect-square w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.025] xl:aspect-[1.08/1]"
                  />
                  <span className="absolute bottom-4 left-4 bg-background px-4 py-3 text-xs font-medium tracking-wide text-foreground sm:bottom-6 sm:left-6 sm:px-5">
                    {normalizeLookbookSeason(featuredLookbook.season) || "ÉLANE LOOKBOOK"}
                    <span className="mx-2 text-muted-foreground">/</span>
                    {featuredLookbook.title}
                    <ArrowRight className="ml-3 inline size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ) : (
                <div className="flex aspect-[1.45/1] items-center justify-center bg-secondary text-sm text-muted-foreground">
                  Lookbook đang được cập nhật.
                </div>
              )}
            </section>

            <section className="pt-10 sm:pt-14">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Stories by ÉLANE
                  </p>
                  <h2 className="font-serif text-2xl text-foreground sm:text-3xl">Các bộ ảnh</h2>
                </div>
                <span className="pb-1 text-xs text-muted-foreground">
                  {lookbooks.length} bộ sưu tập
                </span>
              </div>

              {lookbooks.length ? (
                <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
                  {lookbooks.map((entry, index) => {
                    const image = entry.cover_image_url || entry.items[0]?.image_url;
                    return (
                      <Link
                        key={entry.id}
                        to="/lookbook"
                        search={{ collection: entry.slug }}
                        className="lookbook-collection-card group block"
                      >
                        <div className="relative overflow-hidden bg-secondary">
                          {image ? (
                            <img
                              src={image}
                              alt={entry.title}
                              loading="lazy"
                              className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
                            />
                          ) : (
                            <div className="aspect-[4/5]" />
                          )}
                          <span className="absolute left-3 top-3 bg-background px-2.5 py-1 text-[10px] text-foreground">
                            {index + 1}
                          </span>
                          <span className="absolute bottom-3 right-3 inline-flex size-9 items-center justify-center rounded-full bg-background text-foreground transition-transform group-hover:translate-x-0.5">
                            <ArrowRight className="size-4" />
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-3 pt-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                              {normalizeLookbookSeason(entry.season) || "ÉLANE"}
                            </p>
                            <h3 className="mt-1 font-serif text-xl text-foreground">
                              {entry.title}
                            </h3>
                            {entry.subtitle && (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {entry.subtitle}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 pt-1 text-xs text-muted-foreground">
                            {entry.items.length} looks
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="bg-secondary/50 px-5 py-8 text-sm text-muted-foreground">
                  Chưa có bộ ảnh nào được xuất bản.
                </p>
              )}
            </section>
          </>
        ) : activeLookbook ? (
          <>
            <header className="mb-8 flex flex-col justify-between gap-5 pb-7 sm:mb-10 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="mb-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  {normalizeLookbookSeason(activeLookbook.season) || "ÉLANE · LOOKBOOK"}
                </p>
                <h1 className="font-serif text-4xl leading-tight text-foreground sm:text-5xl">
                  {activeLookbook.title}
                </h1>
                {activeLookbook.subtitle && (
                  <p className="mt-3 text-sm text-foreground">{activeLookbook.subtitle}</p>
                )}
                {activeLookbook.description && (
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    {activeLookbook.description}
                  </p>
                )}
              </div>
              <Link
                to="/lookbook"
                search={{ collection: undefined }}
                className="inline-flex w-fit items-center gap-2 pb-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="size-3.5" /> Tất cả bộ ảnh
              </Link>
            </header>

            {currentItem ? (
              <section className="lookbook-detail-layout grid items-start gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] lg:gap-12">
                <div className="lookbook-sticky-photo">
                  <div className="lookbook-stage relative overflow-hidden bg-secondary">
                    <img
                      key={currentItem.id}
                      src={currentItem.image_url}
                      alt={currentItem.title || `Look ${safeLookIndex + 1}`}
                      className="lookbook-stage-image aspect-[4/5] w-full object-cover"
                    />
                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-5">
                      <span className="bg-background px-3 py-2 text-[10px] tracking-wide text-foreground">
                        LOOK {safeLookIndex + 1} / {lookItems.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLightboxItem(currentItem)}
                        aria-label="Phóng to ảnh"
                        className="inline-flex size-9 cursor-pointer items-center justify-center bg-background text-foreground transition-colors hover:bg-foreground hover:text-background"
                      >
                        <ZoomIn className="size-4" />
                      </button>
                    </div>
                    {lookItems.length > 1 && (
                      <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3 sm:px-5">
                        <button
                          type="button"
                          onClick={() => moveLook(-1)}
                          aria-label="Look trước"
                          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-background"
                        >
                          <ChevronLeft className="size-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLook(1)}
                          aria-label="Look tiếp theo"
                          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-background"
                        >
                          <ChevronRight className="size-5" />
                        </button>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-black/50 px-4 py-4 text-white sm:px-6 sm:py-5">
                      <p className="max-w-[80%] text-sm font-medium">
                        {currentItem.title || activeLookbook.title}
                      </p>
                      <span className="text-[10px]">{safeLookIndex + 1}</span>
                    </div>
                  </div>
                  {lookItems.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Chọn look">
                      {lookItems.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setLookIndex(index)}
                          aria-label={`Chọn look ${index + 1}`}
                          aria-pressed={index === safeLookIndex}
                          className={`lookbook-thumb relative w-16 shrink-0 cursor-pointer overflow-hidden sm:w-[76px] ${index === safeLookIndex ? "is-active" : ""}`}
                        >
                          <img
                            src={item.image_url}
                            alt=""
                            loading="lazy"
                            className="aspect-[4/5] w-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 bg-background px-1.5 py-0.5 text-[9px] text-foreground">
                            {index + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lookbook-detail-copy lg:pt-2">
                  <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <span>ÉLANE Editorial</span>
                    <span aria-hidden="true">·</span>
                    <span>{normalizeLookbookSeason(activeLookbook.season) || "Lookbook"}</span>
                  </div>
                  <h2 className="mt-4 font-serif text-3xl leading-tight text-foreground sm:text-4xl">
                    {currentItem.title || `Look ${safeLookIndex + 1}`}
                  </h2>
                  {currentItem.caption && (
                    <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                      {currentItem.caption}
                    </p>
                  )}

                  {currentProduct ? (
                    <div className="mt-8 bg-secondary/45 p-5">
                      <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Sản phẩm trong look
                      </p>
                      <div className="flex gap-4">
                        <Link
                          to="/san-pham/$slug"
                          params={{ slug: currentProduct.slug }}
                          className="w-20 shrink-0 overflow-hidden bg-secondary sm:w-24"
                        >
                          <img
                            src={currentProduct.images[0] || currentItem.image_url}
                            alt={currentProduct.name}
                            className="aspect-[3/4] w-full object-cover"
                          />
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/san-pham/$slug"
                            params={{ slug: currentProduct.slug }}
                            className="line-clamp-2 text-sm leading-5 text-foreground transition-colors hover:text-muted-foreground"
                          >
                            {currentProduct.name}
                          </Link>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {formatVND(currentProduct.salePrice || currentProduct.price)}
                          </p>
                          {currentProduct.salePrice && (
                            <p className="mt-1 text-xs text-muted-foreground line-through">
                              {formatVND(currentProduct.price)}
                            </p>
                          )}
                          <Link
                            to="/san-pham/$slug"
                            params={{ slug: currentProduct.slug }}
                            className="mt-3 inline-flex items-center gap-2 text-xs text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
                          >
                            Xem sản phẩm <ArrowRight className="size-3" />
                          </Link>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openTryOn(currentProduct)}
                        className="mt-5 inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 bg-foreground px-4 text-xs font-medium text-background transition-colors hover:bg-foreground/85"
                      >
                        <Sparkles className="size-3.5" /> Thử đồ AI
                      </button>
                    </div>
                  ) : currentItem.link_url ? (
                    <a
                      href={currentItem.link_url}
                      className="mt-7 inline-flex items-center gap-2 bg-secondary/50 px-4 py-3 text-sm text-foreground hover:underline"
                    >
                      Khám phá thiết kế <ExternalLink className="size-3.5" />
                    </a>
                  ) : null}

                  {productsInCollection.length > 1 && (
                    <div className="mt-8">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          Sản phẩm trong bộ ảnh
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {productsInCollection.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                        {productsInCollection.map((product) => (
                          <Link
                            key={product.id}
                            to="/san-pham/$slug"
                            params={{ slug: product.slug }}
                            className="group block"
                          >
                            <div className="overflow-hidden bg-secondary">
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                loading="lazy"
                                className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              />
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-foreground">
                              {product.name}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatVND(product.salePrice || product.price)}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {getCommercialCollectionSlug(activeLookbook.slug) && (
                    <Link
                      to="/bo-suu-tap/$slug"
                      params={{ slug: getCommercialCollectionSlug(activeLookbook.slug)! }}
                      className="mt-8 flex min-h-14 items-center justify-between border border-border px-4 text-xs text-foreground transition-colors hover:bg-secondary sm:px-5"
                    >
                      <span>Xem bộ sưu tập tại cửa hàng</span>
                      <ArrowRight className="size-4" />
                    </Link>
                  )}
                </div>
              </section>
            ) : (
              <div className="bg-secondary/50 px-5 py-14 text-center text-sm text-muted-foreground">
                Bộ ảnh này chưa có look nào được xuất bản.
              </div>
            )}

            {lookbooks.length > 1 && (
              <section className="mt-16 pt-8">
                <div className="mb-5 flex items-end justify-between">
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Keep exploring
                    </p>
                    <h2 className="font-serif text-2xl text-foreground">Câu chuyện tiếp theo</h2>
                  </div>
                  <Link
                    to="/lookbook"
                    search={{ collection: undefined }}
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Tất cả bộ ảnh
                  </Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {lookbooks
                    .filter((entry) => entry.id !== activeLookbook.id)
                    .slice(0, 3)
                    .map((entry) => {
                      const image = entry.cover_image_url || entry.items[0]?.image_url;
                      return (
                        <Link
                          key={entry.id}
                          to="/lookbook"
                          search={{ collection: entry.slug }}
                          className="group flex items-center gap-4 bg-secondary/40 p-3"
                        >
                          {image && (
                            <img
                              src={image}
                              alt=""
                              loading="lazy"
                              className="size-16 object-cover sm:size-20"
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                              {normalizeLookbookSeason(entry.season) || "ÉLANE"}
                            </span>
                            <span className="mt-1 block truncate font-serif text-lg text-foreground">
                              {entry.title}
                            </span>
                          </span>
                          <ArrowRight className="mr-1 size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                        </Link>
                      );
                    })}
                </div>
              </section>
            )}
          </>
        ) : null}
      </main>

      <Dialog
        open={!!lightboxItem}
        onOpenChange={(open) => {
          if (!open) setLightboxItem(null);
        }}
      >
        <DialogContent className="max-w-5xl overflow-hidden rounded-none border-0 bg-black p-0">
          <DialogTitle className="sr-only">
            {lightboxItem?.title || activeLookbook?.title || "Lookbook ÉLANE"}
          </DialogTitle>
          {lightboxItem && (
            <img
              src={lightboxItem.image_url}
              alt={lightboxItem.title || "Lookbook ÉLANE"}
              className="max-h-[90vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {tryOnProduct && (
        <VirtualTryOnDialog
          open={tryOnOpen}
          onOpenChange={setTryOnOpen}
          product={tryOnProduct}
          selectedColorwayId={tryOnProduct.colorways[0]?.id ?? ""}
          selectedSize={null}
        />
      )}
    </>
  );
}
