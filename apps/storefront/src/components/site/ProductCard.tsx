import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useState } from "react";
import { formatVND, type Product } from "@/lib/products";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function ProductCard({ product: p }: { product: Product }) {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const [selectedCwId, setSelectedCwId] = useState<string>(p.colorways[0]?.id ?? "");

  const liked = wishlist.includes(p.id);
  const discount = p.salePrice
    ? Math.round((1 - p.salePrice / p.price) * 100)
    : 0;

  const activeCw =
    p.colorways.find((c) => c.id === selectedCwId) ?? p.colorways[0];

  const primaryImg =
    activeCw?.images?.[0] ?? activeCw?.thumbnail ?? p.images[0];

  const hoverImg =
    activeCw?.images?.[1] ?? p.images[1] ?? primaryImg;

  return (
    <article className="group flex h-full flex-col">
      {/* IMAGE AREA — GIỮ NGUYÊN */}
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        <Link
          to="/san-pham/$slug"
          params={{ slug: p.slug }}
          aria-label={p.name}
        >
          <img
            src={primaryImg}
            alt={p.name}
            loading="lazy"
            width={768}
            height={1024}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 group-hover:opacity-0"
          />

          <img
            src={hoverImg}
            alt=""
            loading="lazy"
            width={768}
            height={1024}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100"
          />
        </Link>

        {/* Badges — GIỮ NGUYÊN */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          {p.isNew && (
            <span className="bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-widest">
              Mới
            </span>
          )}

          {p.bestSeller && !p.isNew && (
            <span className="bg-foreground px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-background">
              Bán chạy
            </span>
          )}

          {discount > 0 && (
            <span className="bg-sale px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
              -{discount}%
            </span>
          )}
        </div>

        {/* Wishlist — GIỮ NGUYÊN */}
        <button
          onClick={() => toggleWishlist(p.id)}
          aria-label={liked ? "Bỏ yêu thích" : "Yêu thích"}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center bg-background/80 backdrop-blur transition hover:bg-background"
        >
          <Heart
            className={`h-4 w-4 ${liked ? "fill-foreground" : ""}`}
            strokeWidth={1.5}
          />
        </button>

        {/* Quick size — GIỮ NGUYÊN */}
        <div className="absolute inset-x-0 bottom-0 hidden translate-y-full p-3 transition-transform duration-300 group-hover:translate-y-0 md:block">
          <div className="flex flex-wrap justify-center gap-1 bg-background/95 p-2 backdrop-blur">
            {p.sizes.map((s) => {
              const v =
                p.variants.find(
                  (x) =>
                    x.size === s &&
                    (!selectedCwId || x.colorwayId === selectedCwId),
                ) ?? p.variants.find((x) => x.size === s);

              const inStock = v && v.available > 0;

              return (
                <button
                  key={s}
                  type="button"
                  disabled={!inStock}
                  onClick={() => {
                    if (v && inStock) addToCart(p, v.id);
                  }}
                  className="min-w-9 cursor-pointer px-2 py-1 text-xs hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  title={
                    !inStock
                      ? `Size ${s} hết hàng`
                      : `Chọn size ${s}`
                  }
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* PRODUCT INFO — REDESIGN STYLE 2 */}
      <div className="flex flex-1 flex-col border-x border-b border-border/70 bg-background px-3.5 pb-3.5 pt-3.5 sm:px-4 sm:pb-4 sm:pt-4">
        <div className="flex flex-1 flex-col">
          {/* Product name */}
          <Link
            to="/san-pham/$slug"
            params={{ slug: p.slug }}
            className="line-clamp-2 min-h-[2.6em] font-serif text-[16px] font-medium leading-[1.3] tracking-[-0.015em] text-foreground transition-opacity hover:opacity-70" title={p.name}
          >
            {p.name}
          </Link>

          {/* Price */}
          <div className="mt-2.5 flex items-baseline gap-x-2 whitespace-nowrap leading-tight">
            {p.salePrice ? (
              <>
                <span className="text-[13px] font-semibold text-sale sm:text-[14.5px]">
                  {formatVND(p.salePrice)}
                </span>

                <span className="text-[10.5px] text-muted-foreground line-through sm:text-[12px]">
                  {formatVND(p.price)}
                </span>
              </>
            ) : (
              <span className="text-[13px] font-semibold text-foreground sm:text-[14.5px]">
                {formatVND(p.price)}
              </span>
            )}
          </div>

          {/* Color count - separate row */}
          <div className="mt-0.5 flex items-center justify-end leading-none">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {Math.max(1, p.colorways?.length ?? 1)} màu
            </span>
          </div>

          {/* Colorways */}
          <div className="mt-1 flex min-h-[36px] sm:min-h-[38px] items-center gap-1.5 sm:gap-2">
            {p.colorways.map((c) => {
              const isSelected =
                c.id === (activeCw?.id ?? selectedCwId);

              return (
                <button
                  key={c.id}
                  type="button"
                  onMouseEnter={() => setSelectedCwId(c.id)}
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedCwId(c.id);
                  }}
                  className={cn(
                    "relative h-[34px] w-[26px] overflow-hidden rounded-[3px] transition-all duration-200",
                    isSelected
                      ? "z-10 -translate-y-1 scale-110 opacity-100 shadow-[0_4px_12px_rgba(0,0,0,0.28)]"
                      : "opacity-50 hover:-translate-y-0.5 hover:opacity-85 hover:shadow-sm",
                  )}
                  title={c.name}
                >
                  <img
                    src={c.thumbnail}
                    alt={c.name ?? ""}
                    className="h-full w-full object-cover"
                  />
                </button>
              );
            })}
          </div>

          {/* Secondary metadata */}
          <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2.5">
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              ÉLANE
            </span>

            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {p.isNew ? "New arrival" : "Collection"}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}