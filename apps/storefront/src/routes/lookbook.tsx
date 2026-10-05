import { useState, useMemo, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  Sparkles,
  ShoppingBag,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ZoomIn,
} from "lucide-react";
import { seo } from "@/components/site/PageHeader";
import { ensureCatalog, allProductsList, formatVND, getCategory, type Product } from "@/lib/products";
import { fetchLookbooks, type StoreLookbook, type StoreLookbookItem } from "@/lib/api";
import { VirtualTryOnDialog } from "@/components/tryon/VirtualTryOnDialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const lookbookSearchSchema = z.object({
  collection: z.string().optional(),
});

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

export const Route = createFileRoute("/lookbook")({
  validateSearch: lookbookSearchSchema,
  loader: async () => {
    const [_, lookbooksRes] = await Promise.all([
      ensureCatalog(),
      fetchLookbooks(),
    ]);
    return {
      lookbooks: lookbooksRes.items,
      products: allProductsList(),
    };
  },
  head: () =>
    seo(
      "Lookbook Thời Trang ÉLANE — Bộ Sưu Tập Thu Đông 2026",
      "Khám phá các khung hình thời trang cao cấp từ Lookbook ÉLANE với hiệu ứng Masonry Runway chuyển động sống động. Cảm hứng phối đồ thanh lịch, mua sắm outfit và trải nghiệm Thử đồ ảo AI.",
    ),
  component: LookbookPage,
});

type LookbookCardItem = StoreLookbookItem & {
  lookbookTitle: string;
  lookbookSlug: string;
  season: string | null;
};

function LookbookPage() {
  const { lookbooks: initialLookbooks, products } = Route.useLoaderData();
  const { collection } = Route.useSearch();

  // Matched active lookbook based on search param or null ("all")
  const activeLookbook = useMemo(() => {
    if (!collection || collection === "all") return null;
    return initialLookbooks.find((lb) => matchLookbookSlug(lb.slug, collection)) || null;
  }, [collection, initialLookbooks]);

  const selectedSlug = activeLookbook ? activeLookbook.slug : "all";

  // Lightbox Modal state
  const [activeItem, setActiveItem] = useState<{
    item: StoreLookbookItem;
    lookbookTitle: string;
    lookbookSlug?: string;
    season: string | null;
  } | null>(null);

  // Virtual Try-on dialog state
  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);

  // Active look index for interactive collection editorial viewer
  const [activeLookIndex, setActiveLookIndex] = useState(0);

  // Reset active look index when collection changes
  useEffect(() => {
    setActiveLookIndex(0);
  }, [selectedSlug]);

  // Map products by id and by slug for fast matching
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
      map.set(p.slug, p);
    }
    return map;
  }, [products]);

  const displayItems = useMemo(() => {
    if (activeLookbook) {
      return activeLookbook.items.map((it) => ({
        ...it,
        lookbookTitle: activeLookbook.title,
        lookbookSlug: activeLookbook.slug,
        season: activeLookbook.season,
      }));
    }
    // "all" collection: flatten all items
    const list: LookbookCardItem[] = [];
    for (const lb of initialLookbooks) {
      for (const it of lb.items) {
        list.push({
          ...it,
          lookbookTitle: lb.title,
          lookbookSlug: lb.slug,
          season: lb.season,
        });
      }
    }
    return list;
  }, [activeLookbook, initialLookbooks]);

  // Matched products in active lookbook for wardrobe selection
  const collectionProducts = useMemo(() => {
    if (!activeLookbook) return [];
    const prods: Product[] = [];
    const seenIds = new Set<string>();
    for (const it of activeLookbook.items) {
      const p =
        (it.product_id && productMap.get(it.product_id)) ||
        (it.product_slug && productMap.get(it.product_slug));
      if (p && !seenIds.has(p.id)) {
        seenIds.add(p.id);
        prods.push(p);
      }
    }
    return prods;
  }, [activeLookbook, productMap]);

  // Previous & next lookbook for collection navigation
  const activeLookbookIndex = useMemo(() => {
    if (!activeLookbook) return -1;
    return initialLookbooks.findIndex((lb) => lb.slug === selectedSlug);
  }, [activeLookbook, initialLookbooks, selectedSlug]);

  const prevLookbook = useMemo(() => {
    if (activeLookbookIndex === -1) return null;
    return activeLookbookIndex > 0
      ? initialLookbooks[activeLookbookIndex - 1]
      : initialLookbooks[initialLookbooks.length - 1];
  }, [activeLookbookIndex, initialLookbooks]);

  const nextLookbook = useMemo(() => {
    if (activeLookbookIndex === -1) return null;
    return activeLookbookIndex < initialLookbooks.length - 1
      ? initialLookbooks[activeLookbookIndex + 1]
      : initialLookbooks[0];
  }, [activeLookbookIndex, initialLookbooks]);

  // Distribute items into 4 distinct vertical columns for runway animation
  const runwayColumns = useMemo(() => {
    if (displayItems.length === 0) return [[], [], [], []];

    const cols: LookbookCardItem[][] = [[], [], [], []];
    displayItems.forEach((item, idx) => {
      cols[idx % 4].push(item);
    });

    // Ensure each column has sufficient height to scroll infinitely
    return cols.map((col) => {
      if (col.length === 0) return [];
      let expanded = [...col];
      while (expanded.length < 4) {
        expanded = [...expanded, ...col];
      }
      // Duplicate once for seamless -50% translation loop
      return [...expanded, ...expanded];
    });
  }, [displayItems]);

  // Current item index in the active list for lightbox navigation
  const activeIndex = useMemo(() => {
    if (!activeItem) return -1;
    return displayItems.findIndex((d) => d.id === activeItem.item.id);
  }, [activeItem, displayItems]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      const prev = displayItems[activeIndex - 1];
      setActiveItem({
        item: prev,
        lookbookTitle: prev.lookbookTitle,
        lookbookSlug: prev.lookbookSlug,
        season: prev.season,
      });
    } else if (displayItems.length > 0) {
      const last = displayItems[displayItems.length - 1];
      setActiveItem({
        item: last,
        lookbookTitle: last.lookbookTitle,
        lookbookSlug: last.lookbookSlug,
        season: last.season,
      });
    }
  }, [activeIndex, displayItems]);

  const handleNext = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < displayItems.length - 1) {
      const next = displayItems[activeIndex + 1];
      setActiveItem({
        item: next,
        lookbookTitle: next.lookbookTitle,
        lookbookSlug: next.lookbookSlug,
        season: next.season,
      });
    } else if (displayItems.length > 0) {
      const first = displayItems[0];
      setActiveItem({
        item: first,
        lookbookTitle: first.lookbookTitle,
        lookbookSlug: first.lookbookSlug,
        season: first.season,
      });
    }
  }, [activeIndex, displayItems]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!activeItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") setActiveItem(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeItem, handlePrev, handleNext]);

  // Get matched product for active item
  const matchedProduct = useMemo(() => {
    if (!activeItem) return null;
    const { item } = activeItem;
    if (item.product_id && productMap.has(item.product_id)) {
      return productMap.get(item.product_id)!;
    }
    if (item.product_slug && productMap.has(item.product_slug)) {
      return productMap.get(item.product_slug)!;
    }
    return null;
  }, [activeItem, productMap]);

  const handleOpenTryOn = (prod: Product) => {
    setTryOnProduct(prod);
    setTryOnOpen(true);
  };

  // Reusable card renderer
  const renderLookbookCard = (item: LookbookCardItem, idx: number, isRunway = false) => {
    const matchedProd =
      (item.product_id && productMap.get(item.product_id)) ||
      (item.product_slug && productMap.get(item.product_slug));

    return (
      <figure
        key={`${item.id}-${idx}`}
        className="group relative mb-5 break-inside-avoid overflow-hidden rounded-xl border border-border/70 bg-card transition-all duration-300 hover:shadow-2xl hover:border-primary/50 cursor-pointer select-none"
        onClick={() =>
          setActiveItem({
            item,
            lookbookTitle: item.lookbookTitle,
            lookbookSlug: item.lookbookSlug,
            season: item.season,
          })
        }
      >
        {/* Photo Container */}
        <div className="relative overflow-hidden bg-secondary">
          <img
            src={item.image_url}
            alt={item.title || "ÉLANE Lookbook"}
            loading="lazy"
            className={`w-full object-cover transition-transform duration-700 group-hover:scale-105 ${idx % 3 === 0
              ? "aspect-[3/4]"
              : idx % 3 === 1
                ? "aspect-[4/5]"
                : "aspect-[3/4]"
              }`}
          />

          {/* Gradient Overlay & Hover Actions */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-between p-3.5">
            {/* Top Badges */}
            <div className="flex items-center justify-between gap-1.5">
              <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-medium tracking-wider text-white backdrop-blur-md">
                {item.season || "EDITORIAL"}
              </span>
              <div className="flex items-center gap-1.5">
                {isRunway && item.lookbookSlug && (
                  <Link
                    to="/lookbook"
                    search={{ collection: item.lookbookSlug }}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer rounded-full bg-black/60 hover:bg-black/90 border border-white/20 hover:border-white/50 px-2.5 py-0.5 text-[10px] font-medium tracking-wider text-white backdrop-blur-md transition-all inline-flex items-center gap-1 hover:scale-105"
                    title={`Chuyển đến BST ${item.lookbookTitle}`}
                  >
                    <span>BST {item.lookbookTitle}</span>
                    <ArrowRight className="size-2.5" />
                  </Link>
                )}
                <div className="size-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-transform hover:scale-110">
                  <ZoomIn className="size-3.5" />
                </div>
              </div>
            </div>

            {/* Bottom Info on Hover */}
            <div className="space-y-1.5">
              {matchedProd && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold text-black backdrop-blur-sm shadow">
                  <ShoppingBag className="size-2.5" />
                  <span>Shop The Look</span>
                </div>
              )}
              <p className="text-[11px] text-white font-medium line-clamp-1">
                {item.title || item.lookbookTitle}
              </p>
              {item.caption && (
                <p className="text-[10px] text-white/80 font-light line-clamp-2 leading-snug">
                  {item.caption}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Caption Footer */}
        <figcaption className="p-3">
          <div className="flex items-baseline justify-between gap-1.5">
            <h3 className="font-serif text-xs md:text-sm text-foreground font-medium truncate">
              {item.title || item.lookbookTitle}
            </h3>
            {matchedProd && (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-primary shrink-0 bg-primary/10 px-1.5 py-0.5 rounded">
                Shoppable
              </span>
            )}
          </div>
          {isRunway && item.lookbookSlug && (
            <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center justify-between">
              <Link
                to="/lookbook"
                search={{ collection: item.lookbookSlug }}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-muted-foreground hover:text-primary font-medium transition inline-flex items-center gap-1 group/b"
              >
                <span>BST {item.lookbookTitle}</span>
                <ArrowRight className="size-2.5 transition-transform group-hover/b:translate-x-0.5" />
              </Link>
            </div>
          )}
          {item.caption && !isRunway && (
            <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
              {item.caption}
            </p>
          )}
        </figcaption>
      </figure>
    );
  };

  return (
    <>
      {/* Standard Breadcrumb matching other pages */}
      <div className="mx-auto max-w-[1440px] px-6 pt-6 pb-2 md:px-8 md:pt-8">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
          <Link to="/" className="hover:text-foreground transition-colors">
            Trang chủ
          </Link>
          <span className="opacity-40">/</span>
          {activeLookbook ? (
            <>
              <Link
                to="/lookbook"
                search={{ collection: undefined }}
                className="hover:text-foreground transition-colors"
              >
                Lookbook
              </Link>
              <span className="opacity-40">/</span>
              <span className="text-foreground font-medium">{activeLookbook.title}</span>
            </>
          ) : (
            <span className="text-foreground font-medium">Lookbook</span>
          )}
        </nav>
      </div>

      {/* Hero Editorial Masthead */}
      <section className="relative overflow-hidden bg-gradient-to-b from-secondary/25 via-background to-background pt-8 pb-6 md:pt-12 md:pb-10 text-center">
        {/* Decorative Background Watermark */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.03] text-foreground font-serif text-[130px] sm:text-[190px] md:text-[250px] font-bold tracking-widest leading-none"
        >
          {activeLookbook ? activeLookbook.season || "ÉLANE" : "ÉLANE"}
        </div>

        <div className="relative mx-auto max-w-4xl px-6 space-y-4">
          {/* Grand Main Title */}
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-normal tracking-tight text-foreground">
            {activeLookbook ? activeLookbook.title : "ÉLANE Lookbook"}
          </h1>

          {/* Poetic Subtitle / Quote */}
          {(activeLookbook?.subtitle || !activeLookbook) && (
            <p className="font-serif italic text-base sm:text-lg md:text-xl text-foreground/80 font-light max-w-2xl mx-auto">
              "{activeLookbook?.subtitle || "Đối thoại thị giác giữa tinh thần thanh lịch Paris và phom dáng đương đại"}"
            </p>
          )}

          {/* Commercial Collection link if matched */}
          {activeLookbook && getCommercialCollectionSlug(activeLookbook.slug) && (
            <div className="pt-1">
              <Link
                to="/bo-suu-tap/$slug"
                params={{ slug: getCommercialCollectionSlug(activeLookbook.slug)! }}
                className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/50 transition shadow-xs backdrop-blur-md"
              >
                <ShoppingBag className="size-3 text-primary" />
                <span>Xem các sản phẩm thương mại của BST {activeLookbook.title} tại Cửa hàng</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          )}

          {/* Refined Description */}
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto pt-1 font-light">
            {activeLookbook?.description ||
              "Khám phá thế giới thời trang quý cô thanh lịch qua dòng thác ảnh chuyển động vô tận. Cảm hứng phối đồ, câu chuyện phong cách và trải nghiệm Thử đồ ảo AI trực tiếp trên từng bộ trang phục."}
          </p>
        </div>
      </section>

      {/* Sticky Editorial Collection Switcher Tabs */}
      <div className="sticky top-0 z-30 backdrop-blur-md py-3 shadow-xs">
        <div className="mx-auto max-w-[1440px] px-4 md:px-8">
          <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <Link
              to="/lookbook"
              search={{ collection: undefined }}
              className={`cursor-pointer group relative shrink-0 overflow-hidden rounded-full px-4 py-2 sm:px-5 sm:py-2.5 text-xs uppercase transition-all duration-300 flex items-center gap-2.5 ${selectedSlug === "all"
                ? "bg-foreground text-background font-semibold shadow-md ring-1 ring-foreground"
                : "bg-background/60 text-muted-foreground hover:text-foreground hover:bg-secondary/70 border border-border/70 hover:border-foreground/40"
                }`}
            >
              <span
                className={`relative z-10 font-medium transition-all duration-300 ${selectedSlug === "all"
                  ? "tracking-[0.20em]"
                  : "tracking-[0.16em] group-hover:tracking-[0.20em]"
                  }`}
              >
                Tất cả bộ ảnh
              </span>

              <span
                className={`relative z-10 rounded-full px-2 py-0.5 text-[10px] font-sans font-medium transition-all duration-300 ${selectedSlug === "all"
                  ? "bg-background/20 text-background"
                  : "bg-secondary text-muted-foreground group-hover:text-foreground group-hover:scale-105"
                  }`}
              >
                {initialLookbooks.reduce((acc, lb) => acc + lb.items.length, 0)}
              </span>

              <span className="absolute bottom-1.5 left-1/2 h-px w-0 -translate-x-1/2 bg-current transition-all duration-300 group-hover:w-1/2" />

              {selectedSlug === "all" && (
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2.4s_infinite]" />
              )}
            </Link>

            {initialLookbooks.map((lb) => {
              const isSelected = selectedSlug === lb.slug;

              return (
                <Link
                  key={lb.id}
                  to="/lookbook"
                  search={{ collection: lb.slug }}
                  className={`cursor-pointer group relative shrink-0 overflow-hidden rounded-full px-4 py-2 sm:px-5 sm:py-2.5 text-xs uppercase transition-all duration-300 flex items-center gap-2.5 ${isSelected
                    ? "bg-foreground text-background font-semibold shadow-md ring-1 ring-foreground"
                    : "bg-background/60 text-muted-foreground hover:text-foreground hover:bg-secondary/70 border border-border/70 hover:border-foreground/40"
                    }`}
                >
                  <span
                    className={`relative z-10 font-medium transition-all duration-300 ${isSelected
                      ? "tracking-[0.20em]"
                      : "tracking-[0.16em] group-hover:tracking-[0.20em]"
                      }`}
                  >
                    {lb.title}
                  </span>

                  {lb.season && (
                    <span
                      className={`relative z-10 rounded-full px-2 py-0.5 text-[9px] font-sans font-medium tracking-wider transition-all duration-300 ${isSelected
                        ? "bg-background/20 text-background"
                        : "bg-secondary/90 text-muted-foreground group-hover:text-foreground group-hover:scale-105"
                        }`}
                    >
                      {lb.season}
                    </span>
                  )}

                  <span className="absolute bottom-1.5 left-1/2 h-px w-0 -translate-x-1/2 bg-current transition-all duration-300 group-hover:w-1/2" />

                  {isSelected && (
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2.4s_infinite]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-6 py-4 md:px-8">
        {/* EMPTY STATE */}
        {displayItems.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-muted-foreground font-light">
              Chưa có hình ảnh nào trong bộ sưu tập này.
            </p>
          </div>
        ) : selectedSlug === "all" ? (
          /* MODE 1: DYNAMIC INFINITE AUTO-SCROLL MASONRY RUNWAY */
          <div className="relative mt-8">
            <div
              className={`h-[740px] md:h-[880px] overflow-hidden mask-gradient-y ${activeItem || tryOnOpen ? "animation-paused" : ""
                }`}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 h-full">
                {/* Column 0: Scroll Up Slow */}
                <div className="runway-column relative">
                  <div className="animate-masonry-up-slow">
                    {runwayColumns[0].map((item, idx) =>
                      renderLookbookCard(item, idx, true),
                    )}
                  </div>
                </div>

                {/* Column 1: Scroll Down Slow */}
                <div className="runway-column relative">
                  <div className="animate-masonry-down-slow">
                    {runwayColumns[1].map((item, idx) =>
                      renderLookbookCard(item, idx, true),
                    )}
                  </div>
                </div>

                {/* Column 2: Scroll Up Fast (hidden on mobile, visible on md+) */}
                <div className="runway-column relative hidden md:block">
                  <div className="animate-masonry-up-fast">
                    {runwayColumns[2].map((item, idx) =>
                      renderLookbookCard(item, idx, true),
                    )}
                  </div>
                </div>

                {/* Column 3: Scroll Down Fast (hidden on mobile/tablet, visible on xl+) */}
                <div className="runway-column relative hidden xl:block">
                  <div className="animate-masonry-down-fast">
                    {runwayColumns[3].map((item, idx) =>
                      renderLookbookCard(item, idx, true),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* MODE 2: HAUTE COUTURE COLLECTION EDITORIAL EXPERIENCE */
          <div className="mt-8 space-y-20">
            {/* 1. HERO RUNWAY SHOWCASE: INTERACTIVE EDITORIAL STAGE */}
            {displayItems.length > 0 && (() => {
              const safeHeroIndex = Math.min(activeLookIndex, Math.max(0, displayItems.length - 1));
              const currentHeroItem = displayItems[safeHeroIndex] || displayItems[0];
              const currentHeroIndex = safeHeroIndex;
              const matchedProd =
                (currentHeroItem.product_id && productMap.get(currentHeroItem.product_id)) ||
                (currentHeroItem.product_slug && productMap.get(currentHeroItem.product_slug));

              return (
                <div
                  id="lookbook-hero-stage"
                  className="relative rounded-3xl bg-secondary/30 border border-border/70 p-4 sm:p-6 lg:p-8 overflow-hidden shadow-xs backdrop-blur-xs scroll-mt-24"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                    {/* Left: Large Portrait Editorial Image */}
                    <div className="lg:col-span-7 relative group overflow-hidden rounded-2xl bg-neutral-950 aspect-[3/4] min-h-[480px] md:min-h-[620px]">
                      <img
                        key={currentHeroItem.id}
                        src={currentHeroItem.image_url}
                        alt={currentHeroItem.title || `Look 0${currentHeroIndex + 1}`}
                        className="w-full h-full object-cover object-center transition-all duration-700 ease-out group-hover:scale-105"
                      />

                      {/* Top Bar Badges */}
                      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                        <span className="rounded-full bg-black/65 px-3.5 py-1 text-[11px] font-sans font-medium tracking-[0.2em] uppercase text-white backdrop-blur-md border border-white/10">
                          LOOK 0{currentHeroIndex + 1} / 0{displayItems.length} · {currentHeroItem.season || activeLookbook?.season || "2026 ARCHIVE"}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveItem({
                              item: currentHeroItem,
                              lookbookTitle: currentHeroItem.lookbookTitle,
                              lookbookSlug: currentHeroItem.lookbookSlug,
                              season: currentHeroItem.season,
                            })
                          }
                          className="pointer-events-auto size-9 rounded-full bg-black/40 text-white backdrop-blur-md flex items-center justify-center transition-all hover:bg-black/80 hover:scale-105 border border-white/10"
                          title="Phóng to toàn màn hình"
                        >
                          <ZoomIn className="size-4" />
                        </button>
                      </div>

                      {/* Interactive Arrow Navigators over photo */}
                      {displayItems.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveLookIndex((prev) => (prev > 0 ? prev - 1 : displayItems.length - 1));
                            }}
                            className="cursor-pointer absolute left-3.5 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/80 hover:scale-110 shadow-lg"
                            aria-label="Xem look trước"
                          >
                            <ChevronLeft className="size-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveLookIndex((prev) => (prev < displayItems.length - 1 ? prev + 1 : 0));
                            }}
                            className="cursor-pointer absolute right-3.5 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/50 text-white backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/80 hover:scale-110 shadow-lg"
                            aria-label="Xem look tiếp theo"
                          >
                            <ChevronRight className="size-5" />
                          </button>
                        </>
                      )}

                      {/* Bottom Floating Action Bar on photo */}
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3.5 py-1.5 text-xs text-white backdrop-blur-md border border-white/10 font-sans tracking-wide">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                          <span>{currentHeroItem.title || `Look 0${currentHeroIndex + 1}`}</span>
                        </div>

                        <div className="flex items-center gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              setActiveItem({
                                item: currentHeroItem,
                                lookbookTitle: currentHeroItem.lookbookTitle,
                                lookbookSlug: currentHeroItem.lookbookSlug,
                                season: currentHeroItem.season,
                              })
                            }
                            className="cursor-pointer inline-flex items-center gap-1.5 rounded-full bg-white/90 text-black px-3.5 py-1.5 text-xs font-medium hover:bg-white shadow transition"
                          >
                            <ZoomIn className="size-3.5" />
                            <span className="hidden sm:inline">Phóng to</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Editorial Narrative, Outfit Module, Styling & Look Filmstrip */}
                    <div className="lg:col-span-5 flex flex-col justify-between gap-5 py-1">
                      {/* Top Editorial Story */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-sans font-medium uppercase tracking-[0.22em] text-primary">
                          <span>LOOK 0{currentHeroIndex + 1} / 0{displayItems.length}</span>
                          <span className="h-1 w-1 rounded-full bg-primary/40" />
                          <span>{activeLookbook?.title}</span>
                          <span className="h-1 w-1 rounded-full bg-primary/40" />
                          <span>{activeLookbook?.season || "2026"}</span>
                        </div>

                        <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-foreground font-normal tracking-tight leading-tight">
                          {currentHeroItem.title || `Look 0${currentHeroIndex + 1}`}
                        </h3>

                        <p className="text-sm md:text-[15px] text-muted-foreground font-light leading-relaxed">
                          {currentHeroItem.caption ||
                            `Khung hình tiêu điểm trong bộ sưu tập ${activeLookbook?.title}, tôn vinh nét đẹp đương đại cùng tinh thần tối giản sang trọng.`}
                        </p>
                      </div>

                      {/* Shoppable Outfit Module */}
                      <div className="space-y-3">
                        {matchedProd ? (() => {
                          const hasStock = Boolean(
                            matchedProd.variants &&
                            matchedProd.variants.length > 0 &&
                            matchedProd.variants.some((v) => (v.available ?? 0) > 0)
                          );

                          return (
                            <div className="rounded-2xl border border-border/80 bg-background/95 p-4 sm:p-4.5 space-y-3.5 shadow-xs">
                              <div className="flex gap-4 items-start">
                                {/* Prominent Portrait Image */}
                                <Link
                                  to="/san-pham/$slug"
                                  params={{ slug: matchedProd.slug }}
                                  className="relative w-28 sm:w-32 md:w-36 aspect-[3/4] rounded-xl overflow-hidden bg-secondary shrink-0 border border-border/60 block group/prod"
                                >
                                  <img
                                    src={matchedProd.images[0] || currentHeroItem.image_url}
                                    alt={matchedProd.name}
                                    className="size-full object-cover object-top transition-transform duration-500 group-hover/prod:scale-105"
                                  />
                                  {matchedProd.salePrice && matchedProd.price > matchedProd.salePrice && (
                                    <span className="absolute top-2 left-2 rounded-md bg-[#8B1E2D] text-white text-[10px] font-sans font-semibold tracking-wider px-1.5 py-0.5 shadow-xs uppercase">
                                      -{Math.round(((matchedProd.price - matchedProd.salePrice) / matchedProd.price) * 100)}%
                                    </span>
                                  )}
                                  <div className="absolute inset-x-0 bottom-0 py-1 bg-black/60 backdrop-blur-xs text-white text-[10px] font-sans font-medium text-center opacity-0 group-hover/prod:opacity-100 transition-opacity uppercase tracking-wider">
                                    Xem sản phẩm
                                  </div>
                                </Link>

                                {/* Product Info Beside Image */}
                                <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                                  <div>
                                    {/* Name + price */}
                                    <div className="flex items-start justify-between gap-5">
                                      <div className="min-w-0 flex-1">
                                        <Link
                                          to="/san-pham/$slug"
                                          params={{ slug: matchedProd.slug }}
                                          className="block"
                                        >
                                          <h3 className="font-serif text-[18px] sm:text-[19px] font-medium leading-[1.28] tracking-[-0.01em] text-foreground line-clamp-2 hover:opacity-70 transition-opacity duration-200">
                                            {matchedProd.name}
                                          </h3>
                                        </Link>

                                        <p className="mt-1.5 text-[11.5px] font-sans font-medium tracking-[0.06em] text-muted-foreground/80">
                                          Mã sản phẩm: {matchedProd.sku || matchedProd.id.slice(0, 8).toUpperCase()}
                                        </p>
                                      </div>

                                      <div className="shrink-0 text-right">
                                        {matchedProd.salePrice ? (
                                          <>
                                            <div className="text-[16px] font-semibold text-foreground">
                                              {formatVND(matchedProd.salePrice)}
                                            </div>

                                            <div className="mt-0.5 text-[11.5px] font-medium text-muted-foreground/55 line-through">
                                              {formatVND(matchedProd.price)}
                                            </div>
                                          </>
                                        ) : (
                                          <div className="text-[16px] font-semibold text-foreground">
                                            {formatVND(matchedProd.price)}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Material */}
                                    {matchedProd.material && (
                                      <p className="mt-4 text-[13px] leading-5 text-muted-foreground/90 line-clamp-2">
                                        {matchedProd.material}
                                      </p>
                                    )}
                                  </div>

                                  {/* Bottom */}
                                  <div className="mt-4 border-t border-border/40 pt-3">
                                    <div className="flex items-center justify-between gap-4">
                                      {/* Stock */}
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`size-2 rounded-full ${hasStock ? "bg-emerald-500" : "bg-neutral-400"
                                            }`}
                                        />

                                        <span
                                          className={`text-[11px] font-semibold tracking-[0.08em] ${hasStock
                                              ? "text-emerald-700 dark:text-emerald-400"
                                              : "text-muted-foreground"
                                            }`}
                                        >
                                          {hasStock ? "Sẵn hàng" : "Hết hàng"}
                                        </span>
                                      </div>

                                      {/* Sizes */}
                                      {matchedProd.sizes && matchedProd.sizes.length > 0 && (
                                        <div className="flex items-center gap-2.5">
                                          {matchedProd.sizes.slice(0, 5).map((s) => {
                                            const sizeInStock = matchedProd.variants?.some(
                                              (v) => v.size === s && (v.available ?? 0) > 0
                                            );

                                            return (
                                              <span
                                                key={s}
                                                className={`text-[11.5px] font-medium transition-opacity ${sizeInStock
                                                    ? "text-foreground"
                                                    : "text-muted-foreground/40 line-through"
                                                  }`}
                                              >
                                                {s}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenTryOn(matchedProd)}
                                  className="group/tryon relative overflow-hidden cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-black via-neutral-800 to-neutral-500 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-white shadow-sm hover:shadow-lg hover:shadow-black/25 transition-all duration-300 active:scale-[0.98]"
                                >
                                  <span
                                    aria-hidden="true"
                                    className="absolute inset-0 bg-gradient-to-r from-black via-neutral-700 to-neutral-200 opacity-0 transition-opacity duration-300 ease-out group-hover/tryon:opacity-100 pointer-events-none"
                                  />
                                  <Sparkles className="relative z-10 size-3.5 text-neutral-200 transition-transform duration-300 group-hover/tryon:scale-110 group-hover/tryon:rotate-12 group-hover/tryon:text-white" />
                                  <span className="relative z-10">Thử đồ AI</span>
                                </button>
                                <Link
                                  to="/san-pham/$slug"
                                  params={{ slug: matchedProd.slug }}
                                  className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-background hover:bg-secondary/60 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-foreground transition duration-200"
                                >
                                  <span>Xem sản phẩm</span>
                                  <ArrowRight className="size-3.5" />
                                </Link>
                              </div>
                            </div>
                          );
                        })() : currentHeroItem.link_url ? (
                          <div className="rounded-2xl border border-border bg-background/80 p-4">
                            <Link
                              to={currentHeroItem.link_url}
                              className="cursor-pointer inline-flex items-center gap-2 text-xs text-primary font-medium hover:underline"
                            >
                              <span>Xem chi tiết dòng sản phẩm tương ứng</span>
                              <ExternalLink className="size-3.5" />
                            </Link>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-border/80 bg-background/50 p-4 text-xs text-muted-foreground font-light">
                            Trang phục độc quyền biểu diễn sàn diễn thời trang ÉLANE.
                          </div>
                        )}
                      </div>

                      {/* Product & Design Description: Haute Couture Editorial Note */}
                      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] via-secondary/25 to-background p-4 sm:p-5 space-y-3 shadow-xs">
                        {/* Decorative watermark quote mark in background */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute -top-4 right-4 font-serif text-6xl font-normal italic text-primary/10 select-none"
                        >
                          “
                        </span>

                        {/* Editorial Header */}
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2">
                            <span className="h-px w-5 bg-primary/40" />
                            <span className="text-[13px] font-sans font-semibold uppercase tracking-[0.28em] text-primary">
                              ÉLANE EDITORIAL NOTE
                            </span>
                          </div>
                          <span className="text-[10px] font-sans uppercase tracking-[0.25em] text-muted-foreground/80">
                            LOOK {String(currentHeroIndex + 1).padStart(2, "0")}
                          </span>
                        </div>

                        {/* Stylized Fashion Editorial Quote */}
                        <div className="relative z-10 pl-3.5 border-l-2 border-primary/30">
                          <p className="font-serif text-[15.5px] sm:text-[17px] font-normal italic leading-[1.8] text-foreground/90 tracking-normal">
                            “{matchedProd?.description ||
                              activeLookbook?.description ||
                              currentHeroItem.caption ||
                              `Khung hình nằm trong bộ sưu tập ${activeLookbook?.title}, kết hợp tinh thần tối giản hiện đại cùng đường may đo chuẩn xác mang lại phong thái sang trọng tự nhiên.`}”
                          </p>
                        </div>

                        {/* Signature Footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground font-sans relative z-10">
                          <span className="font-serif italic text-xl text-muted-foreground">
                            Atelier ÉLANE, Paris & Sài Gòn —
                          </span>
                          <span className="uppercase tracking-[0.2em] font-medium text-primary/80">
                            {activeLookbook?.season || "HAUTE COUTURE 2026"}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Look Filmstrip */}
                      {displayItems.length > 1 && (
                        <div className="space-y-3 pt-3 border-t border-border/60">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-sans uppercase tracking-[0.2em] text-muted-foreground font-medium">
                              Khám phá toàn bộ {displayItems.length} Looks
                            </span>
                            <span className="text-xs font-sans text-primary font-semibold tracking-wider">
                              {currentHeroIndex + 1} of {displayItems.length}
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-2.5">
                            {displayItems.map((item, idx) => {
                              const isSelected = idx === currentHeroIndex;
                              return (
                                <button
                                  key={`filmstrip-${item.id}-${idx}`}
                                  type="button"
                                  onClick={() => setActiveLookIndex(idx)}
                                  className={`cursor-pointer group relative overflow-hidden rounded-xl aspect-[3/4] transition-all duration-300 text-left ${isSelected
                                    ? "shadow-md scale-[1.03]"
                                    : "opacity-60 hover:opacity-100"
                                    }`}
                                >
                                  <img
                                    src={item.image_url}
                                    alt={item.title || `Look 0${idx + 1}`}
                                    className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                                    <span className="font-sans text-[10px] font-bold text-white tracking-widest block">
                                      0{idx + 1}
                                    </span>
                                    <p className="text-[10px] text-white/90 font-sans font-medium truncate leading-tight hidden sm:block">
                                      {item.title}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 2. THE RUNWAY GALLERY: MAGAZINE EDITORIAL SPREAD */}
            <div className="space-y-8 pt-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/60">
                <div>
                  <span className="text-[10.5px] font-sans uppercase tracking-[0.25em] text-primary font-medium">
                    RUNWAY ARCHIVE · THE GALLERY
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl text-foreground mt-1 tracking-tight">
                    Khung hình sàn diễn {activeLookbook?.title}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground font-light max-w-md">
                  Tuyển tập {displayItems.length} khung hình thời trang cao cấp. Nhấp vào ảnh để xem chi tiết độ nét cao hoặc trải nghiệm Thử đồ ảo AI.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
                {displayItems.map((item, idx) => {
                  const lookNumber = idx + 1;
                  const matchedProd =
                    (item.product_id && productMap.get(item.product_id)) ||
                    (item.product_slug && productMap.get(item.product_slug));
                  const isCurrentHero = idx === Math.min(activeLookIndex, Math.max(0, displayItems.length - 1));

                  return (
                    <article
                      key={`gallery-${item.id}-${idx}`}
                      className="group relative flex flex-col justify-between"
                    >
                      {/* Photo */}
                      <div
                        className="relative overflow-hidden aspect-[3/4] bg-neutral-900 cursor-pointer rounded-2xl"
                        onClick={() =>
                          setActiveItem({
                            item,
                            lookbookTitle: item.lookbookTitle,
                            lookbookSlug: item.lookbookSlug,
                            season: item.season,
                          })
                        }
                      >
                        <img
                          src={item.image_url}
                          alt={item.title || `Look 0${lookNumber}`}
                          loading="lazy"
                          className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                        />

                        {/* Top Badges */}
                        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-sans font-medium tracking-[0.16em] backdrop-blur-md ${isCurrentHero
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "bg-black/60 text-white"
                              }`}
                          >
                            LOOK 0{lookNumber} {isCurrentHero && "• ĐANG XEM"}
                          </span>
                          <div className="size-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-transform group-hover:scale-110">
                            <ZoomIn className="size-4" />
                          </div>
                        </div>

                        {/* Hover Action Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-end p-4 sm:p-5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveLookIndex(idx);
                                document
                                  .getElementById("lookbook-hero-stage")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="cursor-pointer flex-1 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-black hover:bg-white transition shadow text-center"
                            >
                              Xem trên sân khấu
                            </button>
                            {matchedProd && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenTryOn(matchedProd);
                                }}
                                className="group/rwy relative overflow-hidden cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-black via-neutral-800 to-neutral-500 px-3 py-2 text-xs font-medium text-white shadow-sm hover:shadow-lg hover:shadow-black/25 transition-all duration-300"
                                title="Thử đồ ảo AI"
                              >
                                <span
                                  aria-hidden="true"
                                  className="absolute inset-0 bg-gradient-to-r from-black via-neutral-700 to-neutral-200 opacity-0 transition-opacity duration-300 ease-out group-hover/rwy:opacity-100 pointer-events-none"
                                />
                                <Sparkles className="relative z-10 size-3 text-neutral-200 transition-transform duration-300 group-hover/rwy:scale-110 group-hover/rwy:rotate-12 group-hover/rwy:text-white" />
                                <span className="relative z-10">Thử AI</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Caption & Look Info */}
                      <div className="pt-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-serif text-lg sm:text-[19px] text-foreground font-normal tracking-tight">
                            <span className="italic text-primary/70 font-light mr-1.5">0{lookNumber} —</span>
                            {item.title || `Look 0${lookNumber}`}
                          </h4>
                          {matchedProd && (
                            <span className="text-[9px] font-sans uppercase tracking-[0.2em] text-[#8B1E2D] font-medium bg-[#8B1E2D]/10 px-2.5 py-0.5 rounded-full shrink-0">
                              Shoppable
                            </span>
                          )}
                        </div>

                        {item.caption && (
                          <p className="text-xs sm:text-[13px] text-muted-foreground font-light leading-relaxed">
                            {item.caption}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* 3. WARDROBE SELECTION: CURATED RUNWAY CAPSULE */}
            {collectionProducts.length > 0 && (
              <div className="space-y-8 pt-8 border-t border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border/60">
                  <div>
                    <span className="text-[10.5px] font-sans uppercase tracking-[0.25em] text-primary font-medium">
                      THE RUNWAY CAPSULE
                    </span>
                    <h3 className="font-serif text-2xl sm:text-3xl text-foreground mt-1 tracking-tight">
                      Trang phục trong bộ sưu tập này
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground font-light max-w-md">
                    Khám phá các thiết kế xuất hiện trong các khung hình thời trang của bộ sưu tập {activeLookbook?.title}. Mua sắm và trải nghiệm Thử đồ ảo AI tức thì.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                  {collectionProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="group relative flex flex-col justify-between"
                    >
                      {/* Product Image */}
                      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-secondary cursor-pointer">
                        <Link
                          to="/san-pham/$slug"
                          params={{ slug: prod.slug }}
                          className="block size-full"
                        >
                          <img
                            src={prod.images[0]}
                            alt={prod.name}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          />
                        </Link>

                        {prod.salePrice && (
                          <span className="absolute top-3 left-3 rounded-full bg-[#8B1E2D] px-2 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wider shadow-sm">
                            Sale
                          </span>
                        )}

                        {/* Quick action bar on image hover */}
                        <div className="absolute inset-x-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTryOn(prod);
                            }}
                            className="group/cap relative overflow-hidden cursor-pointer flex-1 rounded-xl bg-gradient-to-r from-black via-neutral-800 to-neutral-500 py-2 text-[11px] font-medium text-white shadow-md hover:shadow-lg hover:shadow-black/25 transition-all duration-300 flex items-center justify-center gap-1.5"
                          >
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 bg-gradient-to-r from-black via-neutral-700 to-neutral-200 opacity-0 transition-opacity duration-300 ease-out group-hover/cap:opacity-100 pointer-events-none"
                            />
                            <Sparkles className="relative z-10 size-3 text-neutral-200 transition-transform duration-300 group-hover/cap:scale-110 group-hover/cap:rotate-12 group-hover/cap:text-white" />
                            <span className="relative z-10">Thử AI</span>
                          </button>
                          <Link
                            to="/san-pham/$slug"
                            params={{ slug: prod.slug }}
                            className="cursor-pointer size-8 rounded-xl bg-white/95 text-black hover:bg-white flex items-center justify-center shadow-md transition"
                            title="Chi tiết sản phẩm"
                          >
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </div>
                      </div>

                      {/* Product Meta */}
                      <div className="pt-3 space-y-1.5">
                        <p className="text-[10px] font-sans font-medium text-muted-foreground uppercase tracking-[0.16em]">
                          {getCategory(prod.category)?.name || prod.category || "ÉLANE"}
                        </p>
                        <Link
                          to="/san-pham/$slug"
                          params={{ slug: prod.slug }}
                          className="font-medium text-xs sm:text-sm text-foreground line-clamp-1 hover:text-primary transition"
                        >
                          {prod.name}
                        </Link>
                        <div className="flex items-baseline gap-2 pt-0.5">
                          <span className="text-xs sm:text-sm font-semibold text-foreground">
                            {formatVND(prod.price)}
                          </span>
                          {prod.salePrice && (
                            <span className="text-[11px] text-muted-foreground line-through">
                              {formatVND(prod.salePrice)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. NEXT / PREVIOUS COLLECTION NAVIGATOR */}
            <div className="pt-12 border-t border-border/60">
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
                {prevLookbook ? (
                  <Link
                    to="/lookbook"
                    search={{ collection: prevLookbook.slug }}
                    className="cursor-pointer group flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 transition"
                  >
                    <div className="size-12 rounded-xl overflow-hidden bg-neutral-900 shrink-0">
                      <img
                        src={prevLookbook.cover_image || prevLookbook.items[0]?.image_url}
                        alt={prevLookbook.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9.5px] font-sans uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1 font-medium">
                        <ChevronLeft className="size-3 group-hover:-translate-x-0.5 transition-transform" />
                        <span>BST Trước</span>
                      </span>
                      <p className="text-xs font-serif text-foreground truncate mt-0.5">
                        {prevLookbook.title}
                      </p>
                    </div>
                  </Link>
                ) : <div />}

                <div className="text-center">
                  <Link
                    to="/lookbook"
                    search={{ collection: undefined }}
                    className="cursor-pointer inline-flex items-center justify-center rounded-full border border-border/80 px-6 py-2.5 text-xs uppercase tracking-widest text-foreground hover:bg-foreground hover:text-background transition-all shadow-xs"
                  >
                    Tất cả Runway (Thác ảnh)
                  </Link>
                </div>

                {nextLookbook ? (
                  <Link
                    to="/lookbook"
                    search={{ collection: nextLookbook.slug }}
                    className="cursor-pointer group flex items-center justify-end gap-3 p-3 rounded-2xl border border-border/60 bg-secondary/30 hover:bg-secondary/60 transition text-right"
                  >
                    <div className="min-w-0">
                      <span className="text-[9.5px] font-sans uppercase tracking-[0.2em] text-muted-foreground flex items-center justify-end gap-1 font-medium">
                        <span>BST Tiếp theo</span>
                        <ChevronRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                      <p className="text-xs font-serif text-foreground truncate mt-0.5">
                        {nextLookbook.title}
                      </p>
                    </div>
                    <div className="size-12 rounded-xl overflow-hidden bg-neutral-900 shrink-0">
                      <img
                        src={nextLookbook.cover_image || nextLookbook.items[0]?.image_url}
                        alt={nextLookbook.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  </Link>
                ) : <div />}
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 pb-20 text-center border-t border-border/60 pt-12">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">
            Trải nghiệm thời trang ÉLANE
          </p>
          <h3 className="font-serif text-2xl md:text-3xl mb-6">
            Khám phá trọn vẹn bộ sưu tập Thu Đông
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/danh-muc/$slug"
              params={{ slug: "hang-moi" }}
              className="cursor-pointer bg-primary px-8 py-3.5 text-xs uppercase tracking-widest text-primary-foreground transition hover:opacity-90 shadow-sm"
            >
              Mua sắm hàng mới về
            </Link>
            <Link
              to="/danh-muc/$slug"
              params={{ slug: "dam" }}
              className="cursor-pointer border border-border bg-background px-8 py-3.5 text-xs uppercase tracking-widest text-foreground transition hover:bg-muted"
            >
              Xem Váy & Đầm
            </Link>
          </div>
        </div>
      </div>

      {/* Interactive Lookbook Lightbox Modal */}
      <Dialog
        open={!!activeItem}
        onOpenChange={(open) => {
          if (!open) setActiveItem(null);
        }}
      >
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-background border-border sm:rounded-2xl gap-0 shadow-2xl">
          <DialogTitle className="sr-only">
            {activeItem?.item.title || "Chi tiết Lookbook ÉLANE"}
          </DialogTitle>

          {activeItem && (
            <div className="relative grid grid-cols-1 md:grid-cols-12 max-h-[90vh] overflow-y-auto md:overflow-hidden">
              {/* Left/Center: High-res Photo Display with Next/Prev Controls */}
              <div className="relative md:col-span-7 bg-neutral-950 flex items-center justify-center min-h-[420px] md:min-h-[620px] select-none">
                <img
                  src={activeItem.item.image_url}
                  alt={activeItem.item.title || "ÉLANE Lookbook"}
                  className="max-h-[85vh] w-full object-contain"
                />

                {/* Left/Right Floating Arrows */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrev();
                  }}
                  className="cursor-pointer absolute left-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/60 text-white backdrop-blur-md flex items-center justify-center transition-all hover:bg-black/90 hover:scale-110"
                  aria-label="Previous frame"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 size-10 rounded-full bg-black/60 text-white backdrop-blur-md flex items-center justify-center transition-all hover:bg-black/90 hover:scale-110"
                  aria-label="Next frame"
                >
                  <ChevronRight className="size-5" />
                </button>

                {/* Counter indicator */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md">
                  {activeIndex + 1} / {displayItems.length}
                </div>
              </div>

              {/* Right Side: Editorial Information & Shop the Look Card */}
              <div className="md:col-span-5 p-6 md:p-8 flex flex-col justify-between overflow-y-auto bg-card">
                <div className="space-y-6">
                  {/* Top Metadata */}
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium uppercase tracking-[0.25em] text-primary">
                        {activeItem.season || "ÉLANE LOOKBOOK"}
                      </span>
                      <div>
                        {activeItem.lookbookSlug ? (
                          <Link
                            to="/lookbook"
                            search={{ collection: activeItem.lookbookSlug }}
                            onClick={() => setActiveItem(null)}
                            className="text-xs text-muted-foreground hover:text-foreground font-medium underline underline-offset-4 transition inline-flex items-center gap-1"
                          >
                            <span>Bộ sưu tập: {activeItem.lookbookTitle}</span>
                            <ArrowRight className="size-3" />
                          </Link>
                        ) : (
                          <p className="text-xs text-muted-foreground">{activeItem.lookbookTitle}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title & Caption */}
                  <div>
                    <h3 className="font-serif text-2xl font-normal text-foreground">
                      {activeItem.item.title || "Khung hình thời trang"}
                    </h3>
                    {activeItem.item.caption && (
                      <p className="mt-2 text-xs md:text-sm text-muted-foreground leading-relaxed">
                        {activeItem.item.caption}
                      </p>
                    )}
                  </div>

                  {/* Shoppable Product Card */}
                  {matchedProduct ? (() => {
                    const modalHasStock = Boolean(
                      matchedProduct.variants &&
                      matchedProduct.variants.length > 0 &&
                      matchedProduct.variants.some((v) => (v.available ?? 0) > 0)
                    );

                    return (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                            <ShoppingBag className="size-3.5" />
                            <span>Sản phẩm trong khung hình</span>
                          </div>
                          {modalHasStock ? (
                            <span className="inline-flex items-center gap-1.5 text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium tracking-wider uppercase">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sẵn hàng
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[10.5px] text-amber-600 dark:text-amber-400 font-medium tracking-wider uppercase">
                              <span className="size-1.5 rounded-full bg-amber-500" /> Tạm hết hàng
                            </span>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <img
                            src={matchedProduct.images[0] || activeItem.item.image_url}
                            alt={matchedProduct.name}
                            className="size-20 rounded-lg object-cover border border-border shrink-0 bg-background"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <h4 className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                              {matchedProduct.name}
                            </h4>
                            <div className="flex items-baseline gap-2 pt-1">
                              <span className="text-sm font-semibold text-foreground">
                                {formatVND(matchedProduct.price)}
                              </span>
                              {matchedProduct.salePrice && (
                                <span className="text-xs text-muted-foreground line-through">
                                  {formatVND(matchedProduct.salePrice)}
                                </span>
                              )}
                            </div>
                            {matchedProduct.category && (
                              <p className="text-[11px] text-muted-foreground">
                                {getCategory(matchedProduct.category)?.name || matchedProduct.category}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {/* Virtual Try-On Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenTryOn(matchedProduct)}
                            className="group/modal relative overflow-hidden cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-black via-neutral-800 to-neutral-500 px-3 py-2 text-xs font-medium text-white shadow-sm hover:shadow-lg hover:shadow-black/25 transition-all duration-300"
                          >
                            <span
                              aria-hidden="true"
                              className="absolute inset-0 bg-gradient-to-r from-black via-neutral-700 to-neutral-200 opacity-0 transition-opacity duration-300 ease-out group-hover/modal:opacity-100 pointer-events-none"
                            />
                            <Sparkles className="relative z-10 size-3.5 text-neutral-200 transition-transform duration-300 group-hover/modal:scale-110 group-hover/modal:rotate-12 group-hover/modal:text-white" />
                            <span className="relative z-10">Thử đồ AI</span>
                          </button>

                          {/* View Product Details */}
                          <Link
                            to="/san-pham/$slug"
                            params={{ slug: matchedProduct.slug }}
                            className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                          >
                            <span>Xem sản phẩm</span>
                            <ArrowRight className="size-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })() : activeItem.item.link_url ? (
                    <div className="rounded-xl border border-border bg-secondary/30 p-4">
                      <p className="text-xs text-muted-foreground mb-2">Liên kết thời trang:</p>
                      <Link
                        to={activeItem.item.link_url}
                        className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                      >
                        <span>Xem chi tiết thiết kế này</span>
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Virtual Try-On Dialog Integration */}
      {tryOnProduct && (
        <VirtualTryOnDialog
          open={tryOnOpen}
          onOpenChange={setTryOnOpen}
          product={tryOnProduct}
        />
      )}
    </>
  );
}
