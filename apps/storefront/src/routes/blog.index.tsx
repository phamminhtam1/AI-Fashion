import { createFileRoute, Link } from "@tanstack/react-router";
import { posts } from "@/lib/content";
import { PageHeader, seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/blog/")({
  head: () => seo("Tạp chí thời trang — ÉLANE Journal", "Xu hướng, bí quyết phối đồ và hướng dẫn chăm sóc trang phục từ ÉLANE Journal."),
  component: Blog,
});

const fmt = (d: string) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" });

function Blog() {
  const [first, ...rest] = posts;
  return (
    <>
      <PageHeader title="ÉLANE Journal" crumb="Tạp chí" eyebrow="Tạp chí">Xu hướng, phong cách và những câu chuyện về thời trang.</PageHeader>
      <div className="mx-auto max-w-[1440px] px-6 py-12 md:px-8">
        {first && (
          <Link to="/blog/$slug" params={{ slug: first.slug }} className="group grid gap-8 md:grid-cols-2">
            <div className="aspect-[4/3] overflow-hidden bg-secondary"><img src={first.image} alt={first.title} className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" /></div>
            <div className="flex flex-col justify-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{first.category} · {fmt(first.date)}</p>
              <h2 className="mt-4 text-3xl leading-tight group-hover:underline md:text-4xl">{first.title}</h2>
              <p className="mt-4 text-muted-foreground">{first.excerpt}</p>
              <span className="mt-6 text-xs uppercase tracking-widest">Đọc tiếp →</span>
            </div>
          </Link>
        )}
        <div className="mt-20 grid gap-x-6 gap-y-12 md:grid-cols-3">
          {rest.map((p) => (
            <Link key={p.slug} to="/blog/$slug" params={{ slug: p.slug }} className="group">
              <div className="aspect-[4/5] overflow-hidden bg-secondary"><img src={p.image} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" /></div>
              <p className="mt-4 text-[11px] uppercase tracking-widest text-muted-foreground">{p.category} · {p.readTime} phút đọc</p>
              <h3 className="mt-2 text-xl leading-snug group-hover:underline">{p.title}</h3>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
