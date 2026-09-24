import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { fetchDefaultSizeChart, type ApiSizeChart } from "@/lib/api";

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
  const [chart, setChart] = useState<ApiSizeChart | null>(null);

  useEffect(() => {
    fetchDefaultSizeChart()
      .then(setChart)
      .catch(() => setChart(null));
  }, []);

  const columns = chart?.columns?.length ? chart.columns : ["bust", "waist", "hip"];

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <h1 className="text-4xl md:text-5xl">Liên hệ & Hỗ trợ</h1>
      <div className="mt-12 grid gap-16 lg:grid-cols-2">
        <div className="space-y-6 text-sm">
          <p className="flex gap-3">
            <MapPin className="h-5 w-5 shrink-0" strokeWidth={1.5} /> 68 Tràng Tiền, Hoàn Kiếm, Hà Nội
            <br />
            125 Đồng Khởi, Quận 1, TP. Hồ Chí Minh
          </p>
          <p className="flex gap-3">
            <Phone className="h-5 w-5" strokeWidth={1.5} /> 1900 0000 (8:00 – 22:00)
          </p>
          <p className="flex gap-3">
            <Mail className="h-5 w-5" strokeWidth={1.5} /> hello@elane.vn
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
              ["Thời gian giao hàng bao lâu?", "2–4 ngày làm việc trên toàn quốc, 1–2 ngày tại Hà Nội và TP. HCM."],
              ["Chính sách đổi trả thế nào?", "Đổi trả miễn phí trong 30 ngày với sản phẩm còn nguyên tem mác, chưa qua sử dụng."],
              ["Có những phương thức thanh toán nào?", "COD, chuyển khoản ngân hàng, thẻ tín dụng/ghi nợ và ví điện tử MoMo, ZaloPay."],
              ["Phí vận chuyển là bao nhiêu?", "Miễn phí cho đơn từ 1.000.000₫, dưới mức này phí đồng giá 30.000₫."],
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
