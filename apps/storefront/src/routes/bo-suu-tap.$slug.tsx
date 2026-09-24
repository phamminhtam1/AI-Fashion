import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { collections } from "@/lib/content";
import { products } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/bo-suu-tap/$slug")({
  loader: ({ params }) => {
    const c = collections.find((x) => x.slug === params.slug);
    if (!c) throw notFound();
    return { name: c.name, description: c.description };
  },
  head: ({ loaderData }) =>
    loaderData ? seo(`Bộ sưu tập ${loaderData.name} — ÉLANE`, loaderData.description) : { meta: [{ title: "Không tìm thấy — ÉLANE" }, { name: "robots", content: "noindex" }] },
  component: CollectionDetail,
});

function CollectionDetail() {
  const { slug } = Route.useParams();
  const c = collections.find((x) => x.slug === slug)!;
  const items = products.filter((p) => c.categories.includes(p.category));
  return (
    <>
      <section className="relative h-[70vh] min-h-[440px] overflow-hidden bg-secondary">
        <img src={c.image} alt={c.name} className="h-full w-full object-cover object-[70%_center]" />
        <div className="absolute inset-0 flex items-end px-6 pb-16 md:px-16">
          <div className="max-w-xl bg-background/85 p-8 backdrop-blur">
            <nav className="text-xs text-muted-foreground"><Link to="/bo-suu-tap">Bộ sưu tập</Link> / {c.name}</nav>
            <h1 className="mt-4 text-4xl md:text-6xl">{c.name}</h1>
            <p className="mt-2 font-serif italic">{c.tagline}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1440px] px-6 py-16 md:px-8">
        <p className="mb-8 text-sm text-muted-foreground">{items.length} thiết kế</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </>
  );
}
