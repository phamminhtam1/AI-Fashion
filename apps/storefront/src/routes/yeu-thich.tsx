import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { products } from "@/lib/products";
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
  const items = products.filter((p) => wishlist.includes(p.id));
  return (
    <div className="mx-auto max-w-[1440px] px-6 py-12 md:px-8">
      <h1 className="text-4xl">Yêu thích</h1>
      {items.length === 0 ? (
        <div className="py-24 text-center">
          <Heart className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1} />
          <p className="mt-4 text-muted-foreground">Bạn chưa lưu sản phẩm nào.</p>
          <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className="mt-8 inline-block bg-primary px-10 py-4 text-xs uppercase tracking-widest text-primary-foreground">Khám phá hàng mới</Link>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
