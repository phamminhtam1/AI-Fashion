import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatVND, type Product } from "@/lib/products";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

function getInvertedTitleLines(
  name: string,
  availableWidth: number,
  font: string,
  letterSpacing: number,
) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [name];

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return [name];
  context.font = font;

  let firstEnd = 0;
  for (let end = 1; end <= words.length; end++) {
    const candidate = words.slice(0, end).join(" ").toLocaleUpperCase("vi-VN");
    const measuredWidth =
      context.measureText(candidate).width + Math.max(0, candidate.length - 1) * letterSpacing;
    if (measuredWidth > availableWidth) break;
    firstEnd = end;
  }

  if (firstEnd === words.length) return [name];
  if (firstEnd === 0) firstEnd = 1;
  return [words.slice(0, firstEnd).join(" "), words.slice(firstEnd).join(" ")];
}

export function ProductCard({
  product: p,
  imageRevealOnScroll = false,
}: {
  product: Product;
  imageRevealOnScroll?: boolean;
}) {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const [selectedCwId, setSelectedCwId] = useState<string>(p.colorways[0]?.id ?? "");
  const titleRef = useRef<HTMLAnchorElement>(null);
  const [invertedTitleLines, setInvertedTitleLines] = useState([p.name]);

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

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;

    const updateTitleLines = () => {
      const style = window.getComputedStyle(title);
      const canvasFont = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      setInvertedTitleLines(
        getInvertedTitleLines(
          p.name,
          title.clientWidth,
          canvasFont,
          Number.parseFloat(style.letterSpacing) || 0,
        ),
      );
    };

    updateTitleLines();
    const observer = new ResizeObserver(updateTitleLines);
    observer.observe(title);
    return () => observer.disconnect();
  }, [p.name]);

  return (
    <article className="group flex h-full min-w-0 flex-col">
      <div
        data-category-image-reveal={imageRevealOnScroll ? "" : undefined}
        className="relative aspect-[5/8] overflow-hidden bg-[#f4f3f1]"
      >
        <Link
          to="/san-pham/$slug"
          params={{ slug: p.slug }}
          aria-label={p.name}
        >
          <img
            data-category-reveal-image={imageRevealOnScroll ? "" : undefined}
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
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
          />
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {p.isNew && (
            <span className="bg-background/95 px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-foreground">
              Mới
            </span>
          )}

          {p.bestSeller && !p.isNew && (
            <span className="bg-foreground px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-background">
              Bán chạy
            </span>
          )}

          {discount > 0 && (
            <span className="bg-sale px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.13em] text-primary-foreground">
              -{discount}%
            </span>
          )}
        </div>

        <button
          onClick={() => toggleWishlist(p.id)}
          aria-label={liked ? "Bỏ yêu thích" : "Yêu thích"}
          className="absolute right-3 top-3 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-background/90 text-foreground/75 opacity-100 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-background hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        >
          <Heart
            className={`h-[17px] w-[17px] ${liked ? "fill-current" : ""}`}
            strokeWidth={1.5}
          />
        </button>

        <div className="absolute inset-x-0 bottom-0 hidden translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
          <div className="flex flex-wrap items-center justify-center gap-1.5 bg-background/95 px-3 py-3 backdrop-blur-sm">
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
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (v && inStock) addToCart(p, v.id);
                  }}
                  className="min-w-9 cursor-pointer border border-border/80 bg-background px-2 py-1.5 text-[11px] text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-35"
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

      <div className="flex flex-1 flex-col bg-background pt-3 sm:pt-3.5">
        <div className="flex flex-1 flex-col">
          <Link
            to="/san-pham/$slug"
            params={{ slug: p.slug }}
            ref={titleRef}
            className="mx-0 text-center text-[14px] font-normal uppercase leading-[1.35] tracking-[0.025em] text-foreground transition-colors hover:text-foreground/70 xl:mx-8 xl:text-left xl:text-[15px]"
            title={p.name}
          >
            <span className="flex min-h-[2.7em] flex-col items-center xl:hidden">
              {invertedTitleLines.map((line, index) => (
                <span
                  key={`${index}-${line}`}
                  className={cn(
                    "block max-w-full",
                    index === 0
                      ? "overflow-hidden text-clip whitespace-nowrap"
                      : "truncate",
                    index === 0 && "w-full",
                    index === 1 && "w-[82%]",
                  )}
                >
                  {line}
                </span>
              ))}
            </span>
            <span className="hidden truncate xl:block">{p.name}</span>
          </Link>

          <div className="mt-2 flex min-h-5 items-baseline justify-center gap-x-2 whitespace-nowrap leading-tight">
            {p.salePrice ? (
              <>
                <span className="text-[15px] font-semibold tabular-nums text-sale sm:text-base">
                  {formatVND(p.salePrice)}
                </span>

                <span className="text-[10px] tabular-nums text-muted-foreground/80 line-through sm:text-[11px]">
                  {formatVND(p.price)}
                </span>
              </>
            ) : (
              <span className="text-[15px] font-medium tabular-nums text-foreground sm:text-base">
                {formatVND(p.price)}
              </span>
            )}
          </div>

          <div className="mt-2.5 flex min-h-7 items-center justify-center gap-1.5">
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
                    "relative h-7 w-6 overflow-hidden border border-transparent bg-secondary transition-all duration-200",
                    isSelected
                      ? "opacity-100 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground/65"
                      : "opacity-55 hover:opacity-90",
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

        </div>
      </div>
    </article>
  );
}
