import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchProductsByIds, type Product } from "@/lib/products";
import { useStore } from "@/lib/store";
import { ProductCard } from "@/components/site/ProductCard";

export const Route = createFileRoute("/yeu-thich")({
  head: () => ({
    meta: [
      { title: "Danh sách yêu thích — ÉLANE" },
      { name: "description", content: "Những thiết kế ÉLANE bạn đã lưu lại." },
      { property: "og:title", content: "Danh sách yêu thích — ÉLANE" },
      { property: "og:description", content: "Những thiết kế ÉLANE bạn đã lưu lại." },
    ],
  }),
  component: Wishlist,
});

function Wishlist() {
  const { wishlist } = useStore();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (wishlist.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchProductsByIds(wishlist)
      .then((prods) => {
        if (active) setItems(prods);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wishlist]);

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-12 md:px-8">
      <div className="flex flex-col gap-2 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/75">
            Saved curation
          </p>
          <h1 className="font-serif text-[32px] font-medium tracking-[-0.025em] text-foreground sm:text-[40px]">
            Danh sách yêu thích
          </h1>
        </div>
        <p className="text-[12px] font-semibold text-foreground/75">
          {wishlist.length} thiết kế
        </p>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-foreground/70" />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/75">
            Đang tải danh sách yêu thích…
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-24 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground stroke-[1.2]" />
          <h3 className="mt-5 font-serif text-xl font-medium text-foreground">
            Bạn chưa lưu sản phẩm nào
          </h3>
          <p className="mt-2 text-[13px] font-medium text-foreground/75">
            Lưu lại những thiết kế bạn yêu thích khi duyệt bộ sưu tập của ÉLANE.
          </p>
          <Link
            to="/danh-muc/$slug"
            params={{ slug: "hang-moi" }}
            className="mt-8 inline-block bg-primary px-10 py-4 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Khám phá hàng mới
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
