import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { fetchDefaultSizeChart, type ApiSizeChart } from "@/lib/api";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/lien-he")({
  head: () => ({
    meta: [
      { title: "Liên hệ & Hỗ trợ — ÉLANE" },
      { name: "description", content: "Liên hệ ÉLANE: hotline, email, cửa hàng, hướng dẫn chọn size và câu hỏi thường gặp." },
      { property: "og:title", content: "Liên hệ & Hỗ trợ — ÉLANE" },
      { property: "og:description", content: "Chúng tôi luôn sẵn sàng hỗ trợ bạn." },
    ],
  }),
  component: Contact,
});

const input = "w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground";

const COL_LABELS: Record<string, string> = {
  bust: "Ngực",
  waist: "Eo",
  hip: "Mông",
};

function Contact() {
  const { storeSettings } = useStore();
  const [chart, setChart] = useState<ApiSizeChart | null>(null);

  useEffect(() => {
    fetchDefaultSizeChart()
      .then(setChart)
      .catch(() => setChart(null));
  }, []);

  const columns = chart?.columns?.length ? chart.columns : ["bust", "waist", "hip"];

  return (
    <div className="mx-auto max-w-[1320px] px-6 py-12">
      <h1 className="text-4xl md:text-5xl">Liên hệ & Hỗ trợ</h1>
      <div className="mt-12 grid gap-16 lg:grid-cols-2">
        <div className="space-y-6 text-sm">
          <p className="flex gap-3">
            <MapPin className="h-5 w-5 shrink-0" strokeWidth={1.5} /> 68 Tràng Tiền, Hoàn Kiếm, Hà Nội
            <br />
            125 Đồng Khởi, Quận 1, TP. Hồ Chí Minh
          </p>
          <p className="flex gap-3">
            <Phone className="h-5 w-5 shrink-0" strokeWidth={1.5} /> <a href={`tel:${storeSettings.brand.supportPhone.replaceAll(" ", "")}`} className="hover:underline">{storeSettings.brand.supportPhone}</a> (8:00 – 22:00)
          </p>
          <p className="flex gap-3">
            <Mail className="h-5 w-5 shrink-0" strokeWidth={1.5} /> <a href={`mailto:${storeSettings.brand.supportEmail}`} className="hover:underline">{storeSettings.brand.supportEmail}</a>
          </p>
          <h2 className="pt-6 text-2xl">Hướng dẫn chọn size ({chart?.unit ?? "cm"})</h2>
          {chart?.instructions ? <p className="text-muted-foreground">{chart.instructions}</p> : null}
          <table className="w-full text-left">
            <thead className="border-b border-foreground text-xs uppercase tracking-widest">
              <tr>
                <th className="py-2">Size</th>
                {columns.map((c) => (
                  <th key={c}>{COL_LABELS[c] ?? c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(chart?.rows ?? []).map((r) => (
                <tr key={r.code ?? r.size} className="border-b border-border">
                  <td className="py-2">{r.size}</td>
                  {columns.map((c) => (
                    <td key={c} className="py-2">
                      {r[c] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
              {!chart?.rows?.length && (
                <tr>
                  <td className="py-4 text-muted-foreground" colSpan={columns.length + 1}>
                    Đang tải bảng size…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            (e.target as HTMLFormElement).reset();
            toast.success("Đã gửi tin nhắn. Chúng tôi sẽ phản hồi trong 24h.");
          }}
        >
          <input required placeholder="Họ và tên" className={input} aria-label="Họ và tên" />
          <input required type="email" placeholder="Email" className={input} aria-label="Email" />
          <textarea required rows={6} placeholder="Nội dung" className={input} aria-label="Nội dung" />
          <button className="bg-primary px-10 py-4 text-xs uppercase tracking-widest text-primary-foreground">
            Gửi tin nhắn
          </button>
        </form>
      </div>
      <section className="mt-20 max-w-3xl">
        <h2 className="text-3xl">Câu hỏi thường gặp</h2>
        <Accordion type="single" collapsible className="mt-6">
          {(
            [
              ["Thời gian giao hàng bao lâu?", `Nội thành: ${storeSettings.shipping.cityDeliveryDays}; các tỉnh thành khác: ${storeSettings.shipping.otherDeliveryDays}.`],
              ["Chính sách đổi trả thế nào?", `Đổi trả miễn phí trong ${storeSettings.returns.returnWindowDays} ngày với sản phẩm đáp ứng điều kiện: ${storeSettings.returns.conditions}`],
              ["Có những phương thức thanh toán nào?", [
                storeSettings.payments.codEnabled ? "COD" : null,
                storeSettings.payments.bankEnabled ? "chuyển khoản VietQR" : null,
              ].filter(Boolean).join(" và ") || "Vui lòng liên hệ cửa hàng để được hướng dẫn."],
              ["Phí vận chuyển là bao nhiêu?", storeSettings.shipping.freeShippingFromVnd > 0
                ? `Miễn phí cho đơn từ ${new Intl.NumberFormat("vi-VN").format(storeSettings.shipping.freeShippingFromVnd)}₫, dưới mức này phí đồng giá ${new Intl.NumberFormat("vi-VN").format(storeSettings.shipping.feeVnd)}₫.`
                : "Đơn hàng được miễn phí vận chuyển."],
            ] as const
          ).map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger>{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
