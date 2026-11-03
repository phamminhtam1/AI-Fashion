import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { fetchCollectionBySlug, fetchCollections, type StoreCollection } from "@/lib/api";
import { pantioCollectionsFallback } from "@/lib/content";
import { seo } from "@/components/site/PageHeader";
import { ProductCard } from "@/components/site/ProductCard";
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
      related: all.filter((item) => item.slug !== collection.slug).slice(0, 6),
    };
  },
  head: ({ loaderData }) =>
    loaderData
      ? seo(
        `${loaderData.collection.name} — ÉLANE`,
        loaderData.collection.description ??
        loaderData.collection.tagline ??
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
      <div className="w-full px-4 pt-6 md:px-6 md:pt-10">
        <nav
          aria-label="Breadcrumb"
          className="relative left-1/2 mb-8 flex w-screen max-w-[100vw] -translate-x-1/2 px-4 md:mb-10 md:px-6"
        >
          <span className="flex w-fit max-w-full flex-wrap items-center gap-2 border-b border-border/60 pb-4 text-base font-medium text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">
              Trang chủ
            </Link>
            <span aria-hidden="true" className="opacity-40">/</span>
            <Link to="/bo-suu-tap" className="transition-colors hover:text-foreground">
              Bộ sưu tập
            </Link>
            <span aria-hidden="true" className="opacity-40">/</span>
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
          <div data-product-reveal className="product-reveal-grid grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 lg:grid-cols-4 lg:gap-y-10">
            {collection.items.map((product) => (
              <ProductCard key={product.id} product={mapApiProduct(product)} />
            ))}
          </div>
        ) : (
          <p className="border-y border-border/50 py-10 text-center text-sm text-muted-foreground">
            Sản phẩm trong album sẽ sớm được cập nhật.
          </p>
        )}
      </section>

      {related.length > 0 && (
        <section
          className="mx-auto mt-14 max-w-[1540px] px-4 sm:mt-20 sm:px-6 md:px-8"
          aria-label="Có thể bạn quan tâm"
        >
          <SectionHeading title="Có thể bạn quan tâm" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">
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

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="mb-2 flex items-center gap-4 pb-3 text-lg sm:text-xl">
      <span>{title}</span>

    </h2>
  );
}
