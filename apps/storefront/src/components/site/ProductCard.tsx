import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { formatVND, type Product } from "@/lib/products";
import { useStore } from "@/lib/store";

export function ProductCard({ product: p }: { product: Product }) {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const liked = wishlist.includes(p.id);
  const discount = p.salePrice ? Math.round((1 - p.salePrice / p.price) * 100) : 0;
  return (
    <article className="group">
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
        <Link to="/san-pham/$slug" params={{ slug: p.slug }} aria-label={p.name}>
          <img src={p.images[0]} alt={p.name} loading="lazy" width={768} height={1024} className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 group-hover:opacity-0" />
          <img src={p.images[1]} alt="" loading="lazy" width={768} height={1024} className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100" />
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
          {p.isNew && <span className="bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-widest">Mới</span>}
          {discount > 0 && <span className="bg-sale px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">-{discount}%</span>}
        </div>
        <button
          onClick={() => toggleWishlist(p.id)}
          aria-label={liked ? "Bỏ yêu thích" : "Yêu thích"}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center bg-background/80 backdrop-blur transition hover:bg-background"
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-foreground" : ""}`} strokeWidth={1.5} />
        </button>
        <div className="absolute inset-x-0 bottom-0 hidden translate-y-full p-3 transition-transform duration-300 group-hover:translate-y-0 md:block">
          <div className="flex flex-wrap justify-center gap-1 bg-background/95 p-2 backdrop-blur">
            {p.sizes.map((s) => {
              const v =
                p.variants.find((x) => x.size === s && (!p.colorways[0] || x.colorwayId === p.colorways[0].id)) ??
                p.variants.find((x) => x.size === s);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!v}
                  onClick={() => {
                    if (v) addToCart(p, v.id);
                  }}
                  className="min-w-9 px-2 py-1 text-xs hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <Link to="/san-pham/$slug" params={{ slug: p.slug }} className="block truncate text-sm leading-snug hover:underline" title={p.name}>
          {p.name}
        </Link>
        <div className="flex items-baseline gap-2 text-sm">
          {p.salePrice ? (
            <>
              <span className="font-medium text-sale">{formatVND(p.salePrice)}</span>
              <span className="text-xs text-muted-foreground line-through">{formatVND(p.price)}</span>
            </>
          ) : (
            <span className="font-medium">{formatVND(p.price)}</span>
          )}
        </div>
        <div className="flex gap-1.5 pt-1">
          {p.colorways.map((c) => (
            <span key={c.id} className="h-8 w-6 overflow-hidden border border-border">
              <img src={c.thumbnail} alt="" className="h-full w-full object-cover" />
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
