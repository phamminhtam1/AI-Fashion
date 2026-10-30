import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { policies } from "@/lib/content";
import { PageHeader, seo } from "@/components/site/PageHeader";
import { fetchStorefrontSettings, type StorefrontSettings } from "@/lib/api";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + "₫";

function buildPolicy(slug: string, settings: StorefrontSettings | null) {
  const source = policies[slug];
  if (!source || !settings) return source;
  if (slug === "van-chuyen") {
    return {
      ...source,
      sections: source.sections.map((section, index) => index === 0
        ? { ...section, p: settings.shipping.freeShippingFromVnd <= 0
          ? "Đơn hàng được miễn phí vận chuyển."
          : `Miễn phí vận chuyển cho đơn hàng từ ${money(settings.shipping.freeShippingFromVnd)}. Đơn dưới mức này áp dụng phí đồng giá ${money(settings.shipping.feeVnd)}.` }
        : index === 1
          ? { ...section, p: `Nội thành: ${settings.shipping.cityDeliveryDays}. Các tỉnh thành khác: ${settings.shipping.otherDeliveryDays}.` }
          : section),
    };
  }
  if (slug === "doi-tra") {
    return {
      ...source,
      sections: source.sections.map((section, index) => index === 0
        ? { ...section, p: `Đổi trả miễn phí trong vòng ${settings.returns.returnWindowDays} ngày kể từ ngày nhận hàng.` }
        : index === 1
          ? { ...section, p: settings.returns.conditions }
          : index === 2
            ? { ...section, p: `Tiền được hoàn trong ${settings.returns.refundWindow} qua phương thức thanh toán ban đầu.` }
            : section),
    };
  }
  if (slug === "thanh-toan") {
    const methods = [
      settings.payments.codEnabled ? "Thanh toán khi nhận hàng (COD)" : null,
      settings.payments.bankEnabled ? "Chuyển khoản ngân hàng qua VietQR" : null,
    ].filter(Boolean);
    return {
      ...source,
      sections: source.sections.map((section, index) => index === 0
        ? { ...section, p: methods.length ? `Các phương thức hiện hỗ trợ: ${methods.join(" và ")}.` : "Vui lòng liên hệ cửa hàng để được hướng dẫn thanh toán." }
        : section),
    };
  }
  if (slug === "bao-mat") {
    return {
      ...source,
      sections: source.sections.map((section) => ({
        ...section,
        p: section.p.replaceAll("hello@elane.vn", settings.brand.supportEmail),
      })),
    };
  }
  return source;
}

export const Route = createFileRoute("/chinh-sach/$slug")({
  loader: async ({ params }) => {
    const p = policies[params.slug];
    if (!p) throw notFound();
    const settings = await fetchStorefrontSettings().catch(() => null);
    const policy = buildPolicy(params.slug, settings);
    return {
      first: policy?.sections[0]?.p ?? "",
      sections: policy?.sections ?? p?.sections ?? [],
      supportEmail: settings?.brand.supportEmail ?? "hello@elane.vn",
      title: policy?.title ?? p.title,
    };
  },
  head: ({ loaderData }) =>
    loaderData ? seo(`${loaderData.title} — ÉLANE`, loaderData.first) : { meta: [{ title: "Không tìm thấy — ÉLANE" }, { name: "robots", content: "noindex" }] },
  component: Policy,
});

function Policy() {
  const { slug } = Route.useParams();
  const data = Route.useLoaderData();
  return (
    <>
      <PageHeader title={data.title} />
      <div className="mx-auto grid max-w-[1600px] gap-12 px-6 py-12 md:grid-cols-[220px_1fr] md:px-8">
        <nav className="flex flex-col gap-3 text-sm">
          {Object.entries(policies).map(([k, v]) => (
            <Link key={k} to="/chinh-sach/$slug" params={{ slug: k }} className={k === slug ? "font-medium underline underline-offset-4" : "text-muted-foreground hover:text-foreground"}>{v.title}</Link>
          ))}
        </nav>
        <div className="max-w-2xl">
          {data.sections.map((s) => (
            <section key={s.h} className="mb-10">
              <h2 className="text-2xl">{s.h}</h2>
              <p className="mt-3 leading-loose text-muted-foreground">{s.p}</p>
            </section>
          ))}
          <p className="text-sm text-muted-foreground">Mọi thắc mắc vui lòng liên hệ <a href={`mailto:${data.supportEmail}`} className="underline underline-offset-4">{data.supportEmail}</a>.</p>
        </div>
      </div>
    </>
  );
}
