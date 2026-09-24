import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { products } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";

export const Route = createFileRoute("/tim-kiem")({
  validateSearch: z.object({ q: z.string().optional().default("") }),
  head: () => ({
    meta: [
      { title: "Tìm kiếm — ÉLANE" },
      { name: "description", content: "Tìm kiếm thời trang nữ tại ÉLANE." },
      { property: "og:title", content: "Tìm kiếm — ÉLANE" },
      { property: "og:description", content: "Tìm kiếm thời trang nữ tại ÉLANE." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const items = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-[1440px] px-6 py-12 md:px-8">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Kết quả tìm kiếm</p>
      <h1 className="mt-2 text-4xl">"{q}" <span className="text-lg text-muted-foreground">({items.length})</span></h1>
      {items.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">Không tìm thấy sản phẩm phù hợp. Hãy thử từ khóa khác.</p>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
