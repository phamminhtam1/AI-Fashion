import { createFileRoute, Link } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqs } from "@/lib/content";
import { PageHeader, seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/faq")({
  head: () => ({
    ...seo("Câu hỏi thường gặp — ÉLANE", "Giải đáp thắc mắc về đặt hàng, vận chuyển, đổi trả và sản phẩm tại ÉLANE."),
    scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.flatMap((g) => g.items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }))) }) }],
  }),
  component: Faq,
});

function Faq() {
  return (
    <>
      <PageHeader title="Câu hỏi thường gặp" crumb="FAQ">Không tìm thấy câu trả lời? <Link to="/lien-he" className="text-foreground underline">Liên hệ với chúng tôi</Link>.</PageHeader>
      <div className="mx-auto max-w-3xl px-6 py-12">
        {faqs.map((g) => (
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
