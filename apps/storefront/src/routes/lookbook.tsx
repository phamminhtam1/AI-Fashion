import { createFileRoute, Link } from "@tanstack/react-router";
import { lookbook } from "@/lib/content";
import { PageHeader, seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/lookbook")({
  head: () => seo("Lookbook Thu Đông 2026 — ÉLANE", "Cảm hứng phối đồ từ lookbook ÉLANE Thu Đông 2026 — những bộ trang phục thanh lịch, nữ tính."),
  component: Lookbook,
});

function Lookbook() {
  return (
    <>
      <PageHeader title="Lookbook" eyebrow="Autumn / Winter 2026">Những khoảnh khắc thanh lịch — cảm hứng phối đồ cho mùa mới.</PageHeader>
      <div className="mx-auto max-w-[1440px] columns-1 gap-6 px-6 py-12 sm:columns-2 lg:columns-3 md:px-8">
        {lookbook.map((l, i) => (
          <figure key={i} className="group mb-6 break-inside-avoid">
            <div className="overflow-hidden bg-secondary">
              <img src={l.image} alt={l.title} loading="lazy" className={`w-full object-cover transition-transform duration-1000 group-hover:scale-105 ${i % 3 === 0 ? "aspect-[3/4]" : i % 3 === 1 ? "aspect-[4/5]" : "aspect-square"}`} />
            </div>
            <figcaption className="mt-3 flex items-baseline justify-between gap-4">
              <span className="font-serif text-xl">{String(i + 1).padStart(2, "0")} — {l.title}</span>
            </figcaption>
            <p className="mt-1 text-sm text-muted-foreground">{l.caption}</p>
          </figure>
        ))}
      </div>
      <div className="pb-20 text-center">
        <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className="bg-primary px-10 py-4 text-xs uppercase tracking-widest text-primary-foreground">Mua sắm bộ sưu tập</Link>
      </div>
    </>
  );
}
