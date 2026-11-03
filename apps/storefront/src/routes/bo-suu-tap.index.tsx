import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { pantioCollectionsFallback } from "@/lib/content";
import { fetchCollections, type StoreCollection } from "@/lib/api";
import { seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/bo-suu-tap/")({
  head: () => seo("Bộ sưu tập — ÉLANE", "Khám phá các bộ sưu tập mới nhất của ÉLANE."),
  component: Collections,
});

const CATEGORY_OPTIONS = ["ÁO", "ĐẦM", "CHÂN VÁY", "QUẦN", "SPECIAL RUNWAY COLLECTION", "PHỤ KIỆN"];

function Collections() {
  const [items, setItems] = useState<StoreCollection[]>(pantioCollectionsFallback);
  const [categories, setCategories] = useState<string[]>(CATEGORY_OPTIONS);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    let alive = true;
    void fetchCollections()
      .then((result) => {
        if (!alive || result.items.length === 0) return;
        setItems(result.items);
        if (result.categories.length) setCategories(result.categories);
      })
      .catch(() => { });
    return () => {
      alive = false;
    };
  }, []);

  const orderedItems = useMemo(
    () => [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [items],
  );
  const featured = orderedItems.find((item) => item.is_featured) ?? orderedItems[0];
  const visibleItems = useMemo(() => {
    return orderedItems
      .filter((item) => {
        if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
        return true;
      });
  }, [orderedItems, selectedCategory]);

  return (
    <main className="pb-16">
      <div className="w-full px-4 pt-5 md:px-6 md:pt-5">
        <nav
          aria-label="Breadcrumb"
          className="relative left-1/2 mb-8 flex w-screen max-w-[100vw] -translate-x-1/2 px-4 md:mb-10 md:px-6"
        >
          <span className="flex w-fit max-w-full flex-wrap items-center gap-2 border-b border-border/60 pb-4 text-base font-medium text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Trang chủ
          </Link>
          <span aria-hidden="true" className="opacity-40">/</span>
          <span className="text-foreground">Bộ sưu tập</span>
          </span>
        </nav>
      </div>

      {featured && selectedCategory === "all" && (
        <section
          className="relative left-1/2 mt-12 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden sm:mt-16"
          aria-label={`Banner ${featured.name}`}
        >
          <Link
            to="/bo-suu-tap/$slug"
            params={{ slug: featured.slug }}
            className="block aspect-[1.78/1] bg-secondary sm:aspect-[2.05/1]"
          >
            <img
              src={featured.hero_image_url || featured.cover_image_url || ""}
              alt={featured.name}
              fetchPriority="high"
              className="size-full object-cover"
            />
          </Link>
        </section>
      )}

      <section
        className="mx-auto max-w-[1540px] px-4 pt-10 sm:px-6 sm:pt-12 md:px-8"
        aria-label="Danh sách bộ sưu tập"
      >
        {visibleItems.length ? (
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-8 lg:gap-x-7">
            {visibleItems.map((item) => (
              <Link
                key={item.slug}
                to="/bo-suu-tap/$slug"
                params={{ slug: item.slug }}
                className="group relative block min-w-0 overflow-hidden bg-secondary"
              >
                <img
                  src={item.cover_image_url || ""}
                  alt={item.name}
                  loading="lazy"
                  className="aspect-[0.5625/1] size-full object-cover"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 grid -translate-x-full place-items-center bg-neutral-500/45 p-3 text-center text-white transition-transform duration-500 ease-out group-hover:translate-x-0 group-focus-visible:translate-x-0 motion-reduce:transition-none"
                >
                  <span className="text-sm font-semibold uppercase tracking-[0.12em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.75)] opacity-0 transition-opacity delay-100 duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none sm:text-base">
                    {item.name}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-y border-border/70 py-16 text-center">
            <p className="font-serif text-xl">Không tìm thấy bộ sưu tập</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Thử chọn nhóm “Tất cả” để xem mọi bộ sưu tập.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
