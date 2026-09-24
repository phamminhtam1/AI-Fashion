import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { policies } from "@/lib/content";
import { PageHeader, seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/chinh-sach/$slug")({
  loader: ({ params }) => {
    const p = policies[params.slug];
    if (!p) throw notFound();
    return { title: p.title, first: p.sections[0]?.p ?? "" };
  },
  head: ({ loaderData }) =>
    loaderData ? seo(`${loaderData.title} — ÉLANE`, loaderData.first) : { meta: [{ title: "Không tìm thấy — ÉLANE" }, { name: "robots", content: "noindex" }] },
  component: Policy,
});

function Policy() {
  const { slug } = Route.useParams();
  const p = policies[slug]!;
  return (
    <>
      <PageHeader title={p.title} />
      <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-12 md:grid-cols-[220px_1fr] md:px-8">
        <nav className="flex flex-col gap-3 text-sm">
          {Object.entries(policies).map(([k, v]) => (
            <Link key={k} to="/chinh-sach/$slug" params={{ slug: k }} className={k === slug ? "font-medium underline underline-offset-4" : "text-muted-foreground hover:text-foreground"}>{v.title}</Link>
          ))}
        </nav>
        <div className="max-w-2xl">
          {p.sections.map((s) => (
            <section key={s.h} className="mb-10">
              <h2 className="text-2xl">{s.h}</h2>
              <p className="mt-3 leading-loose text-muted-foreground">{s.p}</p>
            </section>
          ))}
          <p className="text-sm text-muted-foreground">Cập nhật lần cuối: 01/09/2026 · Mọi thắc mắc vui lòng liên hệ hello@elane.vn</p>
        </div>
      </div>
    </>
  );
}
