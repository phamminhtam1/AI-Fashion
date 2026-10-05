import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
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
        {collections.map((c, i) => {
          const lookbookSlug =
            c.slug === "thu-dong-2026"
              ? "autumn-winter-2026"
              : c.slug === "the-office"
                ? "the-office-edit"
                : c.slug;

          return (
            <div
              key={c.slug}
              className={`group relative overflow-hidden rounded-2xl bg-secondary ${
                i === 0 ? "md:col-span-2 aspect-[16/7]" : "aspect-[4/5]"
              }`}
            >
              <Link to="/bo-suu-tap/$slug" params={{ slug: c.slug }} className="absolute inset-0 z-0">
                <img
                  src={c.image}
                  alt={c.name}
                  loading={i ? "lazy" : undefined}
                  className="h-full w-full object-cover object-[70%_center] transition-transform duration-1000 group-hover:scale-105"
                />
              </Link>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent p-8 md:p-12 z-10 flex flex-col justify-end">
                <p className="text-[11px] uppercase tracking-[0.3em] text-background/80">{c.tagline}</p>
                <h2 className="mt-2 text-3xl text-background md:text-5xl font-serif">{c.name}</h2>
                <div className="pointer-events-auto mt-4 flex flex-wrap items-center gap-4 text-xs uppercase tracking-widest">
                  <Link
                    to="/bo-suu-tap/$slug"
                    params={{ slug: c.slug }}
                    className="text-background hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <span>Khám phá sản phẩm</span>
                    <span>→</span>
                  </Link>
                  <span className="text-background/40">·</span>
                  <Link
                    to="/lookbook"
                    search={{ collection: lookbookSlug }}
                    className="inline-flex items-center gap-1.5 text-background/90 hover:text-white underline underline-offset-4"
                  >
                    <Sparkles className="size-3 text-amber-300" />
                    <span>Xem Lookbook Editorial →</span>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
