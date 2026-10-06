import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, RotateCcw, Ruler, SlidersHorizontal, X } from "lucide-react";
import { categoryBreadcrumb, fetchListingPage, formatVND, isAccessory, type Product } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";

export const Route = createFileRoute("/danh-muc/$slug")({
  loader: async ({ params }) => {
    const { fetchListingPage } = await import("@/lib/products");
    const data = await fetchListingPage({ slug: params.slug, page: 1, limit: 50 });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Không tìm thấy — ÉLANE" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.title} nữ cao cấp — ÉLANE`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.description },
      ],
    };
  },
  component: Listing,
});

const sorts = { new: "Mới nhất", asc: "Giá tăng dần", desc: "Giá giảm dần", best: "Bán chạy" } as const;

function Listing() {
  const { slug } = Route.useParams();
  const loaderData = Route.useLoaderData();

  if (!loaderData) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-24 text-center">
        <h1 className="text-2xl font-serif">Danh mục không tồn tại</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Danh mục bạn đang tìm kiếm không tồn tại hoặc đã được thay đổi.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block bg-primary px-6 py-2.5 text-xs uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90"
        >
          Về trang chủ
        </Link>
      </div>
    );
  }

  return <ListingContent initialData={loaderData} slug={slug} />;
}

function ListingContent({
  initialData,
  slug,
}: {
  initialData: {
    title: string;
    description: string;
    items: Product[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
  slug: string;
}) {
  const crumbs = categoryBreadcrumb(slug);
  const [rawItems, setRawItems] = useState<Product[]>(initialData.items);
  const [page, setPage] = useState(initialData.page);
  const [total, setTotal] = useState(initialData.total);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Sync state when slug or initialData changes
  useEffect(() => {
    setRawItems(initialData.items);
    setPage(initialData.page);
    setTotal(initialData.total);
    setHasMore(initialData.hasMore);
    setIsLoadingMore(false);
  }, [slug, initialData]);

  const [sort, setSort] = useState<keyof typeof sorts>("new");
  const [size, setSize] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState(4000000);
  const [showFilterDesktop, setShowFilterDesktop] = useState(false);
  const [showFilterMobile, setShowFilterMobile] = useState(false);

  const pricePercent = useMemo(() => {
    return Math.min(100, Math.max(0, ((maxPrice - 300000) / (4000000 - 300000)) * 100));
  }, [maxPrice]);

  useEffect(() => {
    if (!showFilterMobile) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowFilterMobile(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFilterMobile]);

  const activeFilterCount = (size ? 1 : 0) + (maxPrice < 4000000 ? 1 : 0);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetchListingPage({ slug, page: nextPage, limit: 50 });
      setRawItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const added = res.items.filter((p) => !seen.has(p.id));
        return [...prev, ...added];
      });
      setPage(nextPage);
      setTotal(res.total);
      setHasMore(nextPage * 50 < res.total);
    } catch (err) {
      console.error("Lỗi tải thêm sản phẩm:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page, slug]);

  // Sentinel for automatic infinite scroll when user scrolls to bottom
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const sizeOptions = useMemo(() => {
    const standardSizes = ["XS", "S", "M", "L", "XL"];
    const hasFreeSize = rawItems.some((p) =>
      p.sizes.some((s) => s.toLowerCase().includes("free") || s.toLowerCase().includes("one"))
    );
    const list = hasFreeSize ? [...standardSizes, "Free size"] : standardSizes;
    return list.map((sz) => {
      const count = rawItems.filter((p) =>
        sz === "Free size"
          ? p.sizes.some((s) => s.toLowerCase().includes("free") || s.toLowerCase().includes("one"))
          : p.sizes.includes(sz)
      ).length;
      return { size: sz, count };
    });
  }, [rawItems]);

  const items = useMemo(() => {
    const price = (p: Product) => p.salePrice ?? p.price;
    let r = rawItems.filter((p) => {
      const matchPrice = price(p) <= maxPrice;
      if (!matchPrice) return false;
      if (!size) return true;
      if (size === "Free size") {
        return p.sizes.some((s) => s.toLowerCase().includes("free") || s.toLowerCase().includes("one"));
      }
      return p.sizes.includes(size);
    });
    if (sort === "asc") r = [...r].sort((a, b) => price(a) - price(b));
    if (sort === "desc") r = [...r].sort((a, b) => price(b) - price(a));
    if (sort === "best") r = [...r].sort((a, b) => Number(!!b.bestSeller) - Number(!!a.bestSeller) || b.reviews - a.reviews);
    if (sort === "new") {
      if (slug === "hang-moi") {
        r = [...r].sort((a, b) => Number(isAccessory(a)) - Number(isAccessory(b)));
      } else {
        r = [...r].sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));
      }
    }
    return r;
  }, [rawItems, sort, size, maxPrice, slug]);

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-10 md:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Trang chủ
        </Link>
        {crumbs.length > 0 ? (
          crumbs.map((c, i) => (
            <span key={c.slug}>
              {" / "}
              {i < crumbs.length - 1 ? (
                <Link to="/danh-muc/$slug" params={{ slug: c.slug }} className="hover:text-foreground">
                  {c.name}
                </Link>
              ) : (
                <span className="text-foreground">{c.name}</span>
              )}
            </span>
          ))
        ) : (
          <>
            {" / "}
            <span className="text-foreground">{initialData.title}</span>
          </>
        )}
      </nav>
      <header className="mt-6 max-w-2xl">
        <h1 className="text-4xl md:text-5xl">{initialData.title}</h1>
        <p className="mt-3 text-muted-foreground">{initialData.description}</p>
      </header>

      {/* Main layout: Left sidebar column ("1 dãy bên trái") + Right product list */}
      <div className="mt-8 flex items-start gap-8 lg:gap-10">
        {/* =========================================================================
            LEFT COLUMN: "1 dãy phía bên trái bên cùng luôn"
            Desktop (lg+): Sticky left column, always visible ("luôn")
            Mobile (<lg): Slide-over drawer from far left
        ========================================================================== */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-[330px] sm:w-[360px] bg-background p-7 shadow-2xl transition-transform duration-300 overflow-y-auto
            lg:static lg:z-10 lg:w-72 xl:w-80 lg:shrink-0 lg:p-0 lg:shadow-none lg:overflow-visible
            lg:sticky lg:top-[calc(var(--header-height,146px)+20px)] lg:max-h-[calc(100vh-var(--header-height,146px)-32px)] lg:overflow-y-auto lg:pr-8 lg:border-r lg:border-border/60
            ${showFilterMobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            ${!showFilterDesktop ? "lg:hidden" : ""}
          `}
        >
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border/60 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground">
                Bộ lọc
              </span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilterMobile(false)}
              className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              aria-label="Đóng bộ lọc"
            >
              <X className="size-4.5" />
            </button>
          </div>

          {/* Desktop Filter Heading */}
          <div className="hidden lg:flex items-center justify-between pb-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm font-semibold uppercase tracking-[0.22em] text-foreground">
                Bộ lọc
              </span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                  {activeFilterCount}
                </span>
              )}
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSize(null);
                  setMaxPrice(4000000);
                }}
                className="inline-flex items-center gap-1.5 text-xs normal-case text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>Đặt lại</span>
              </button>
            )}
          </div>

          <div className="space-y-8 pt-6">
            {/* 01 · KÍCH CỠ */}
            <div>
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs md:text-[13px] font-semibold uppercase tracking-[0.18em] text-foreground">
                    Kích cỡ
                  </span>
                  {size && (
                    <span className="text-xs text-muted-foreground font-medium normal-case">
                      ({size})
                    </span>
                  )}
                </div>
                <Link
                  to="/huong-dan-chon-size"
                  className="group/guide inline-flex items-center gap-1.5 text-xs normal-case tracking-normal text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Ruler className="size-3.5" />
                  <span className="underline underline-offset-2">Bảng size</span>
                </Link>
              </div>

              {/* Size Pills Grid (3 cols, enlarged) */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSize(null)}
                  className={`h-10 md:h-11 rounded-xl text-xs md:text-sm uppercase tracking-wider font-medium transition-all duration-150 cursor-pointer select-none ${size === null
                      ? "bg-foreground text-background font-semibold shadow-xs"
                      : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50"
                    }`}
                >
                  Tất cả
                </button>

                {sizeOptions.map(({ size: s, count }) => {
                  const isSelected = size === s;
                  const isOutOfStock = count === 0;

                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => setSize(isSelected ? null : s)}
                      className={`relative h-10 md:h-11 rounded-xl text-xs md:text-sm font-sans transition-all duration-150 select-none ${isOutOfStock ? "cursor-not-allowed" : "cursor-pointer"
                        } ${isSelected
                          ? "bg-foreground text-background font-semibold shadow-xs"
                          : isOutOfStock
                            ? "bg-muted/20 border border-dashed border-border/40 text-muted-foreground/30 line-through"
                            : "bg-background hover:bg-secondary border border-border/70 text-foreground hover:border-foreground/30"
                        }`}
                    >
                      <span className="tracking-wide">{s}</span>
                      <sup
                        className={`ml-1 text-[10px] md:text-[11px] font-mono ${isSelected ? "text-background/70" : "text-muted-foreground/60"
                          }`}
                      >
                        {count}
                      </sup>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 02 · KHOẢNG GIÁ */}
            <div className="border-t border-border/60 pt-6">
              <div className="mb-3.5 flex items-center justify-between">
                <span className="text-xs md:text-[13px] font-semibold uppercase tracking-[0.18em] text-foreground">
                  Khoảng giá
                </span>
                <span className="text-xs md:text-sm font-semibold text-foreground normal-case font-sans">
                  {maxPrice >= 4000000 ? "Tất cả mức giá" : `≤ ${formatVND(maxPrice)}`}
                </span>
              </div>

              {/* Slider with track black on the left of knob */}
              <input
                type="range"
                min={300000}
                max={4000000}
                step={100000}
                value={maxPrice}
                onChange={(e) => setMaxPrice(+e.target.value)}
                style={{
                  background: `linear-gradient(to right, #000000 0%, #000000 ${pricePercent}%, #e5e7eb ${pricePercent}%, #e5e7eb 100%)`,
                }}
                className="
                  h-2 w-full cursor-pointer appearance-none rounded-full accent-black
                  [&::-webkit-slider-thumb]:size-5
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-black
                  [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-white
                  [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.35)]
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:size-5
                  [&::-moz-range-thumb]:border-2
                  [&::-moz-range-thumb]:border-white
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-black
                  [&::-moz-range-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.35)]
                  [&::-moz-range-thumb]:cursor-pointer
                "
              />
              <div className="mt-1.5 flex justify-between text-[10px] md:text-xs font-mono text-muted-foreground">
                <span>300.000₫</span>
                <span>4.000.000₫+</span>
              </div>

              <div className="mt-3.5 flex flex-wrap gap-2">
                {[
                  { label: "< 1 triệu", val: 1000000 },
                  { label: "< 2 triệu", val: 2000000 },
                  { label: "Tất cả", val: 4000000 },
                ].map((p) => {
                  const selected = p.val === 4000000 ? maxPrice >= 4000000 : maxPrice === p.val;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setMaxPrice(p.val)}
                      className={`flex-1 min-w-[75px] rounded-lg py-2 text-center text-xs md:text-[13px] font-medium transition-colors cursor-pointer normal-case tracking-normal ${selected
                          ? "bg-foreground text-background font-semibold"
                          : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50"
                        }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile apply button */}
            <div className="pt-2 lg:hidden">
              <button
                type="button"
                onClick={() => setShowFilterMobile(false)}
                className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-foreground py-3 text-xs md:text-sm font-semibold uppercase tracking-wider text-background"
              >
                <span>Xem {items.length} sản phẩm</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {showFilterMobile && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
            onClick={() => setShowFilterMobile(false)}
          />
        )}

        {/* =========================================================================
            RIGHT COLUMN: List sản phẩm
        ========================================================================== */}
        <div className="flex-1 min-w-0">
          {/* Top Sticky Toolbar */}
          <div
            className="sticky z-20 border-y border-border bg-background/95 backdrop-blur-md transition-[top] duration-200"
            style={{ top: "var(--header-height, 146px)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-y-2 py-3 text-xs uppercase tracking-widest">
              {/* Left side: Desktop Toggle / Mobile Trigger + Active chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Desktop Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowFilterDesktop((s) => !s)}
                  className={`hidden lg:inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-medium transition cursor-pointer select-none text-xs tracking-wider border ${showFilterDesktop
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/80 bg-background hover:bg-secondary text-foreground"
                    }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>{showFilterDesktop ? "Ẩn bộ lọc" : "Bộ lọc"}</span>
                  {activeFilterCount > 0 && (
                    <span
                      className={`inline-flex items-center justify-center size-4.5 rounded-full text-[10px] font-bold ${showFilterDesktop
                          ? "bg-background text-foreground"
                          : "bg-foreground text-background"
                        }`}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Mobile Trigger Button */}
                <button
                  type="button"
                  onClick={() => setShowFilterMobile(true)}
                  className="lg:hidden inline-flex items-center gap-2 rounded-full border border-border/80 px-3.5 py-1.5 font-medium transition cursor-pointer select-none text-xs tracking-wider hover:bg-secondary"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Bộ lọc</span>
                  {activeFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center size-4.5 rounded-full text-[10px] font-bold bg-foreground text-background">
                      {activeFilterCount}
                    </span>
                  )}
                </button>


                {/* Active chips */}
                {size && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 text-[11px] normal-case tracking-normal text-foreground">
                    <span>
                      Size: <strong className="font-semibold">{size}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSize(null)}
                      className="hover:opacity-70 cursor-pointer ml-0.5"
                      aria-label="Xóa lọc size"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )}

                {maxPrice < 4000000 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-2.5 py-1 text-[11px] normal-case tracking-normal text-foreground">
                    <span>
                      ≤ <strong className="font-semibold">{formatVND(maxPrice)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setMaxPrice(4000000)}
                      className="hover:opacity-70 cursor-pointer ml-0.5"
                      aria-label="Xóa lọc giá"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )}

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSize(null);
                      setMaxPrice(4000000);
                    }}
                    className="text-[11px] normal-case tracking-normal text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer px-1"
                  >
                    Xóa tất cả
                  </button>
                )}
              </div>

              {/* Center: Total count */}
              <span className="hidden normal-case tracking-normal text-muted-foreground text-sm md:block">
                {activeFilterCount > 0 ? (
                  <span>
                    Tìm thấy <strong className="text-foreground font-medium">{items.length}</strong> / {total} sản phẩm
                  </span>
                ) : (
                  <span>{total} sản phẩm</span>
                )}
              </span>

              {/* Right: Sort select */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="sr-only">Sắp xếp</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as keyof typeof sorts)}
                  className="cursor-pointer bg-transparent text-xs uppercase tracking-widest outline-none py-1.5 pr-2 hover:opacity-80"
                >
                  {Object.entries(sorts).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Product Grid */}
          {items.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-serif text-2xl">Không có sản phẩm phù hợp</p>
              <p className="mt-2 text-sm text-muted-foreground">Hãy thử điều chỉnh bộ lọc của bạn.</p>
            </div>
          ) : (
            <div
              className={`mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 ${showFilterDesktop ? "lg:grid-cols-3 xl:grid-cols-3" : "lg:grid-cols-4 xl:grid-cols-4"
                }`}
            >
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* Sentinel & Infinite scroll status */}
          {hasMore && (
            <div ref={sentinelRef} className="py-10 flex flex-col items-center justify-center gap-3">
              {isLoadingMore ? (
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Đang tải thêm sản phẩm...</span>
                </div>
              ) : (
                <button
                  onClick={loadMore}
                  className="border border-border px-8 py-3 text-xs uppercase tracking-widest text-foreground transition-all hover:border-foreground hover:bg-secondary"
                >
                  Xem thêm sản phẩm ({rawItems.length}/{total})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
