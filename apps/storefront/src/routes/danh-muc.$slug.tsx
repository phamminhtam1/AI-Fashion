import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { categoryBreadcrumb, productsForListing } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";

export const Route = createFileRoute("/danh-muc/$slug")({
  loader: ({ params }) => {
    const data = productsForListing(params.slug);
    if (!data) throw notFound();
    return { title: data.title, description: data.description };
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
  const data = productsForListing(slug)!;
  const crumbs = categoryBreadcrumb(slug);
  const [sort, setSort] = useState<keyof typeof sorts>("new");
  const [size, setSize] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState(4000000);
  const [showFilter, setShowFilter] = useState(false);

  const items = useMemo(() => {
    const price = (p: (typeof data.items)[number]) => p.salePrice ?? p.price;
    let r = data.items.filter((p) => price(p) <= maxPrice && (!size || p.sizes.includes(size)));
    if (sort === "asc") r = [...r].sort((a, b) => price(a) - price(b));
    if (sort === "desc") r = [...r].sort((a, b) => price(b) - price(a));
    if (sort === "best") r = [...r].sort((a, b) => b.reviews - a.reviews);
    if (sort === "new") r = [...r].sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));
    return r;
  }, [data.items, sort, size, maxPrice]);

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-10 md:px-8">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
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
            <span className="text-foreground">{data.title}</span>
          </>
        )}
      </nav>
      <header className="mt-6 max-w-2xl">
        <h1 className="text-4xl md:text-5xl">{data.title}</h1>
        <p className="mt-3 text-muted-foreground">{data.description}</p>
      </header>

      <div className="sticky top-[104px] z-10 mt-10 flex items-center justify-between border-y border-border bg-background py-3 text-xs uppercase tracking-widest lg:top-[140px]">
        <button onClick={() => setShowFilter((s) => !s)} className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} /> Bộ lọc
        </button>
        <span className="hidden normal-case tracking-normal text-muted-foreground md:block">{items.length} sản phẩm</span>
        <label className="flex items-center gap-2">
          <span className="sr-only">Sắp xếp</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof sorts)} className="bg-transparent text-xs uppercase tracking-widest outline-none">
            {Object.entries(sorts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      {showFilter && (
        <div className="grid gap-8 border-b border-border py-6 md:grid-cols-3 animate-in fade-in slide-in-from-top-2">
          <div>
            <p className="text-[11px] uppercase tracking-widest">Kích cỡ</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["XS", "S", "M", "L", "XL"].map((s) => (
                <button key={s} onClick={() => setSize(size === s ? null : s)} className={`h-10 w-12 border text-sm ${size === s ? "border-foreground bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest">Giá tối đa: {maxPrice.toLocaleString("vi-VN")}₫</p>
            <input type="range" min={300000} max={4000000} step={100000} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="mt-4 w-full accent-foreground" />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setSize(null); setMaxPrice(4000000); }} className="text-xs uppercase tracking-widest underline">Xóa bộ lọc</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-serif text-2xl">Không có sản phẩm phù hợp</p>
          <p className="mt-2 text-sm text-muted-foreground">Hãy thử điều chỉnh bộ lọc của bạn.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
