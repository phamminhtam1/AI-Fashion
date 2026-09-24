import { createFileRoute, Link } from "@tanstack/react-router";
import { collections } from "@/lib/content";
import { PageHeader, seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/bo-suu-tap/")({
  head: () => seo("Bộ sưu tập — ÉLANE", "Khám phá các bộ sưu tập thời trang nữ ÉLANE: Thu Đông 2026, La Parisienne, Evening Noir và The Office Edit."),
  component: Collections,
});

function Collections() {
  return (
    <>
      <PageHeader title="Bộ sưu tập" eyebrow="Collections">Mỗi bộ sưu tập là một câu chuyện — về chất liệu, cảm hứng và người phụ nữ hiện đại.</PageHeader>
      <div className="mx-auto grid max-w-[1440px] gap-6 px-6 py-12 md:grid-cols-2 md:px-8">
        {collections.map((c, i) => (
          <Link key={c.slug} to="/bo-suu-tap/$slug" params={{ slug: c.slug }} className={`group relative block overflow-hidden bg-secondary ${i === 0 ? "md:col-span-2 aspect-[16/7]" : "aspect-[4/5]"}`}>
            <img src={c.image} alt={c.name} loading={i ? "lazy" : undefined} className="h-full w-full object-cover object-[70%_center] transition-transform duration-1000 group-hover:scale-105" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/60 to-transparent p-8 md:p-12">
              <p className="text-[11px] uppercase tracking-[0.3em] text-background/80">{c.tagline}</p>
              <h2 className="mt-2 text-3xl text-background md:text-5xl">{c.name}</h2>
              <p className="mt-4 text-xs uppercase tracking-widest text-background">Khám phá →</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
