import { createFileRoute, Link } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqs } from "@/lib/content";
import { PageHeader, seo } from "@/components/site/PageHeader";
import { fetchStorefrontSettings, type StorefrontSettings } from "@/lib/api";

function buildFaqs(settings: StorefrontSettings | null) {
  return faqs.map((group) => {
    const items = group.items.map(([question, answer]) => {
      if (!settings) return [question, answer] as [string, string];
      if (question === "Thời gian giao hàng bao lâu?") {
        return [question, `Nội thành: ${settings.shipping.cityDeliveryDays}; các tỉnh thành khác: ${settings.shipping.otherDeliveryDays}.`] as [string, string];
      }
      if (question === "Phí vận chuyển là bao nhiêu?") {
        const threshold = new Intl.NumberFormat("vi-VN").format(settings.shipping.freeShippingFromVnd);
        const fee = new Intl.NumberFormat("vi-VN").format(settings.shipping.feeVnd);
        return [question, settings.shipping.freeShippingFromVnd > 0
          ? `Miễn phí cho đơn từ ${threshold}₫, dưới mức này phí đồng giá ${fee}₫.`
          : "Đơn hàng được miễn phí vận chuyển."] as [string, string];
      }
      if (question === "Chính sách đổi trả thế nào?") {
        return [question, `Đổi trả miễn phí trong ${settings.returns.returnWindowDays} ngày với sản phẩm đáp ứng điều kiện: ${settings.returns.conditions}`] as [string, string];
      }
      if (question === "Bao lâu tôi nhận được tiền hoàn?") {
        return [question, `${settings.returns.refundWindow} sau khi cửa hàng nhận được sản phẩm trả lại.`] as [string, string];
      }
      if (question === "Tôi có thể hủy đơn không?") {
        return [question, `Bạn có thể hủy đơn trước khi đơn được bàn giao vận chuyển bằng cách liên hệ hotline ${settings.brand.supportPhone}.`] as [string, string];
      }
      return [question, answer] as [string, string];
    });
    if (group.group === "Đặt hàng" && settings) {
      const methods = [
        settings.payments.codEnabled ? "COD" : null,
        settings.payments.bankEnabled ? "chuyển khoản VietQR" : null,
      ].filter(Boolean);
      items.push(["Có những phương thức thanh toán nào?", methods.length
        ? `Cửa hàng hiện hỗ trợ ${methods.join(" và ")}.`
        : "Vui lòng liên hệ cửa hàng để được hướng dẫn thanh toán."]);
    }
    return { ...group, items };
  });
}

export const Route = createFileRoute("/faq")({
  loader: async () => {
    const settings = await fetchStorefrontSettings().catch(() => null);
    return { faqs: buildFaqs(settings) };
  },
  head: ({ loaderData }) => {
    const faqItems = loaderData?.faqs ?? buildFaqs(null);
    return {
      ...seo("Câu hỏi thường gặp — ÉLANE", "Giải đáp thắc mắc về đặt hàng, vận chuyển, đổi trả và sản phẩm tại ÉLANE."),
      scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqItems.flatMap((g) => g.items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }))) }) }],
    };
  },
  component: Faq,
});

function Faq() {
  const { faqs: faqItems } = Route.useLoaderData();
  return (
    <>
      <PageHeader title="Câu hỏi thường gặp" crumb="FAQ">Không tìm thấy câu trả lời? <Link to="/lien-he" className="text-foreground underline">Liên hệ với chúng tôi</Link>.</PageHeader>
      <div className="mx-auto max-w-3xl px-6 py-12">
        {faqItems.map((g) => (
          <section key={g.group} className="mb-12">
            <h2 className="text-2xl">{g.group}</h2>
            <Accordion type="single" collapsible className="mt-4">
              {g.items.map(([q, a]) => (
                <AccordionItem key={q} value={q}><AccordionTrigger>{q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{a}</AccordionContent></AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
    </>
  );
}
