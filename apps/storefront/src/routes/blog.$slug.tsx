import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { posts } from "@/lib/content";
import { products } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const p = posts.find((x) => x.slug === params.slug);
    if (!p) throw notFound();
    return { title: p.title, excerpt: p.excerpt, date: p.date };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Không tìm thấy — ÉLANE" }, { name: "robots", content: "noindex" }] };
    return {
      ...seo(`${loaderData.title} — ÉLANE Journal`, loaderData.excerpt, [{ property: "og:type", content: "article" }]),
      scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: loaderData.title, datePublished: loaderData.date, author: { "@type": "Organization", name: "ÉLANE" } }) }],
    };
  },
  component: PostPage,
});

function PostPage() {
  const { slug } = Route.useParams();
  const post = posts.find((x) => x.slug === slug)!;
  const others = posts.filter((x) => x.slug !== slug).slice(0, 3);
  return (
    <article>
      <header className="mx-auto max-w-3xl px-6 pt-12 text-center">
        <nav className="text-xs text-muted-foreground"><Link to="/">Trang chủ</Link> / <Link to="/blog">Tạp chí</Link></nav>
        <p className="mt-8 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{post.category} · {new Date(post.date).toLocaleDateString("vi-VN")} · {post.readTime} phút đọc</p>
        <h1 className="mt-4 text-4xl leading-tight md:text-5xl">{post.title}</h1>
        <p className="mt-6 text-lg text-muted-foreground">{post.excerpt}</p>
      </header>
      <div className="mx-auto mt-12 max-w-5xl px-6"><img src={post.image} alt={post.title} className="aspect-[16/9] w-full object-cover" /></div>
      <div className="mx-auto max-w-2xl px-6 py-16">
        {post.body.map((s) => (
          <section key={s.h} className="mb-10">
            <h2 className="text-2xl">{s.h}</h2>
            <p className="mt-3 leading-loose text-muted-foreground">{s.p}</p>
          </section>
        ))}
      </div>
      <section className="mx-auto max-w-[1440px] px-6 pb-16 md:px-8">
        <h2 className="mb-8 text-3xl">Mua sắm theo bài viết</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {products.filter((p) => p.bestSeller).slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
      <section className="border-t border-border bg-secondary px-6 py-16 md:px-8">
        <div className="mx-auto max-w-[1440px]">
          <h2 className="mb-8 text-3xl">Bài viết khác</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {others.map((p) => (
              <Link key={p.slug} to="/blog/$slug" params={{ slug: p.slug }} className="group flex gap-4">
                <img src={p.image} alt={p.title} loading="lazy" className="h-28 w-24 object-cover" />
                <div><p className="text-[11px] uppercase tracking-widest text-muted-foreground">{p.category}</p><p className="mt-1 font-serif text-lg leading-snug group-hover:underline">{p.title}</p></div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </article>
  );
}
