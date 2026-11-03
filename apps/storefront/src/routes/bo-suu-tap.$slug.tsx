import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchCollectionBySlug, fetchCollections, type StoreCollection } from "@/lib/api";
import { pantioCollectionsFallback } from "@/lib/content";
import { seo } from "@/components/site/PageHeader";
import { ProductCard } from "@/components/site/ProductCard";
import { SectionHeading } from "@/components/site/SectionHeading";
import { mapApiProduct } from "@/lib/products";

export const Route = createFileRoute("/bo-suu-tap/$slug")({
  loader: async ({ params }) => {
    const [remote, allRemote] = await Promise.all([
      fetchCollectionBySlug(params.slug),
      fetchCollections().catch(() => null),
    ]);
    const local = pantioCollectionsFallback.find((item) => item.slug === params.slug) ?? null;
    const collection = remote ?? local;
    if (!collection) throw notFound();
    const all = allRemote?.items.length ? allRemote.items : pantioCollectionsFallback;
    return {
      collection: collection as StoreCollection,
      related: all.filter((item) => item.slug !== collection.slug).slice(0, 4),
    };
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo(
          `${loaderData.collection.name} — ÉLANE`,
          `Khám phá bộ sưu tập ${loaderData.collection.name}.`,
        )
      : { meta: [{ title: "Không tìm thấy — ÉLANE" }, { name: "robots", content: "noindex" }] },
  component: CollectionDetail,
});

function CollectionDetail() {
  const { collection, related } = Route.useLoaderData();
  const banner = collection.hero_image_url || collection.cover_image_url;
  const productGalleryImages = Array.from(
    new Set(
      (collection.items ?? []).flatMap((product) => [
        ...product.images,
        ...(product.colorways ?? []).flatMap((colorway) => colorway.images),
      ]),
    ),
  ).slice(0, 24);
  const galleryImages = collection.gallery_images?.length
    ? collection.gallery_images.slice(0, 40)
    : productGalleryImages.map((url, index) => ({
        url,
        layout: index % 6 === 4 ? ("wide" as const) : ("half" as const),
      }));

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
            <span aria-hidden="true" className="opacity-40">
              /
            </span>
            <Link to="/bo-suu-tap" className="transition-colors hover:text-foreground">
              Bộ sưu tập
            </Link>
            <span aria-hidden="true" className="opacity-40">
              /
            </span>
            <span className="truncate text-foreground">{collection.name}</span>
          </span>
        </nav>
      </div>

      {galleryImages.length > 0 && (
        <section
          className="mt-4 grid grid-cols-1 gap-0 overflow-hidden sm:grid-cols-2"
          aria-label={`Hình ảnh bộ sưu tập ${collection.name}`}
        >
          {galleryImages.map((image, index) => {
            const isWideFrame = image.layout === "wide";
            return (
              <figure
                key={`${image.url}-${index}`}
                className={isWideFrame ? "relative sm:col-span-2" : "relative"}
              >
                <img
                  src={image.url}
                  alt={`${collection.name} — hình ${index + 1}`}
                  loading={index < 2 ? "eager" : "lazy"}
                  className={
                    isWideFrame
                      ? "aspect-[16/9] size-full object-cover"
                      : "aspect-[0.82/1] size-full object-cover sm:aspect-square"
                  }
                />
              </figure>
            );
          })}
        </section>
      )}

      <section
        className="mx-auto mt-8 max-w-[1600px] px-6 pb-20 sm:mt-12 md:px-8"
        aria-label="Sản phẩm trong bộ sưu tập"
      >
        <SectionHeading title="Sản phẩm có trong album" />
        {collection.items?.length ? (
          <AlbumProductCarousel products={collection.items.map(mapApiProduct)} />
        ) : (
          <p className="border-y border-border/50 py-10 text-center text-sm text-muted-foreground">
            Sản phẩm trong album sẽ sớm được cập nhật.
          </p>
        )}
      </section>

      {related.length > 0 && (
        <section
          className="mx-auto mt-14 max-w-[1600px] px-6 sm:mt-20 md:px-8"
          aria-label="Có thể bạn quan tâm"
        >
          <SectionHeading title="Có thể bạn quan tâm" />
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            {related.map((item) => (
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
        </section>
      )}
    </main>
  );
}

function AlbumProductCarousel({ products }: { products: ReturnType<typeof mapApiProduct>[] }) {
  const [visibleItems, setVisibleItems] = useState(4);
  const [gap, setGap] = useState(16);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const updateLayout = () => {
      const nextVisible = window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 3 : 2;
      const nextGap = window.innerWidth >= 640 ? 16 : 12;
      setVisibleItems(nextVisible);
      setGap(nextGap);
      setIndex((current) => Math.min(current, Math.max(0, products.length - nextVisible)));
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, [products.length]);

  const maxIndex = Math.max(0, products.length - visibleItems);
  const trackWidth = `${(products.length / visibleItems) * 100}% + ${gap * (products.length / visibleItems - 1)}px`;
  const trackOffset = `-${(index * 100) / visibleItems}cqw - ${(index * gap) / visibleItems}px`;

  return (
    <div className="overflow-hidden [container-type:inline-size]">
      <div
        className="flex transition-transform duration-700 [transition-timing-function:cubic-bezier(0.22,0.75,0.25,1)] motion-reduce:transition-none"
        style={{
          width: `calc(${trackWidth})`,
          gap: `${gap}px`,
          transform: `translateX(calc(${trackOffset}))`,
        }}
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="min-w-0"
            style={{ flex: `0 0 calc((100% - ${gap * (products.length - 1)}px) / ${products.length})` }}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
      {products.length > visibleItems && (
        <div className="mt-8 flex justify-center gap-2">
          <button
            type="button"
            aria-label="Xem nhóm sản phẩm trước"
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
            disabled={index === 0}
            className="grid h-7 w-5 place-items-center rounded-[3px] bg-[#d6d6d6] text-white transition-colors hover:bg-[#bcbcbc] disabled:pointer-events-none disabled:opacity-60"
          >
            <ArrowLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Xem nhóm sản phẩm tiếp theo"
            onClick={() => setIndex((current) => Math.min(maxIndex, current + 1))}
            disabled={index >= maxIndex}
            className="grid h-7 w-5 place-items-center rounded-[3px] bg-[#d6d6d6] text-white transition-colors hover:bg-[#bcbcbc] disabled:pointer-events-none disabled:opacity-60"
          >
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

