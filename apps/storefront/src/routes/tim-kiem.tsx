import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { fetchProducts } from "@/lib/api";
import { mapApiProduct, type Product } from "@/lib/products";
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
  const query = q.trim();
  const requestId = useRef(0);
  const [search, setSearch] = useState<{
    query: string;
    items: Product[];
    total: number;
    page: number;
    loading: boolean;
    loadingMore: boolean;
    error: boolean;
  }>({ query: "", items: [], total: 0, page: 1, loading: false, loadingMore: false, error: false });

  useEffect(() => {
    const id = ++requestId.current;
    if (!query) {
      setSearch({ query: "", items: [], total: 0, page: 1, loading: false, loadingMore: false, error: false });
      return;
    }

    setSearch({ query, items: [], total: 0, page: 1, loading: true, loadingMore: false, error: false });
    fetchProducts({ q: query, limit: "50", page: "1" })
      .then((response) => {
        if (id !== requestId.current) return;
        setSearch({
          query,
          items: (response.items ?? []).map(mapApiProduct),
          total: response.total ?? 0,
          page: 1,
          loading: false,
          loadingMore: false,
          error: false,
        });
      })
      .catch((error) => {
        console.error("Product search failed:", error);
        if (id === requestId.current) {
          setSearch({ query, items: [], total: 0, page: 1, loading: false, loadingMore: false, error: true });
        }
      });

    return () => {
      if (requestId.current === id) requestId.current += 1;
    };
  }, [query]);

  const isCurrentQuery = search.query === query;
  const items = isCurrentQuery ? search.items : [];
  const total = isCurrentQuery ? search.total : 0;
  const isLoading = Boolean(query) && (!isCurrentQuery || search.loading);

  const loadMore = async () => {
    if (!isCurrentQuery || search.loadingMore || items.length >= total) return;
    const id = requestId.current;
    const nextPage = search.page + 1;
    setSearch((current) => ({ ...current, loadingMore: true }));
    try {
      const response = await fetchProducts({ q: query, limit: "50", page: String(nextPage) });
      if (id !== requestId.current) return;
      setSearch((current) => ({
        ...current,
        items: [...current.items, ...(response.items ?? []).map(mapApiProduct)],
        total: response.total ?? current.total,
        page: nextPage,
        loadingMore: false,
      }));
    } catch (error) {
      console.error("Loading more search results failed:", error);
      if (id === requestId.current) setSearch((current) => ({ ...current, loadingMore: false, error: true }));
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-12 md:px-8">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Kết quả tìm kiếm</p>
      <h1 className="mt-2 text-4xl">
        "{query}" <span className="text-lg text-muted-foreground">({isLoading ? "…" : total})</span>
      </h1>
      {!query ? (
        <p className="py-20 text-center text-muted-foreground">Nhập từ khóa để tìm sản phẩm.</p>
      ) : isLoading ? (
        <p className="py-20 text-center text-muted-foreground">Đang tìm sản phẩm...</p>
      ) : search.error && items.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">Không thể tải kết quả tìm kiếm. Vui lòng thử lại.</p>
      ) : items.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">Không tìm thấy sản phẩm phù hợp. Hãy thử từ khóa khác.</p>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {items.length < total && (
            <div className="mt-12 text-center">
              <p className="mb-4 text-sm text-muted-foreground">Đang hiển thị {items.length} / {total} sản phẩm</p>
              <button
                type="button"
                onClick={loadMore}
                disabled={search.loadingMore}
                className="border border-foreground px-8 py-3 text-xs uppercase tracking-widest transition-colors hover:bg-foreground hover:text-background disabled:cursor-wait disabled:opacity-60"
              >
                {search.loadingMore ? "Đang tải..." : "Xem thêm sản phẩm"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
