import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, seo } from "@/components/site/PageHeader";

export const Route = createFileRoute("/huong-dan-chon-size")({
  head: () => seo("Hướng dẫn chọn size — ÉLANE", "Bảng size chuẩn và cách đo số đo cơ thể để chọn trang phục ÉLANE vừa vặn nhất."),
  component: SizeGuide,
});

const tops = [["XS", "78–80", "60–62", "84–86", "150–155"], ["S", "82–84", "64–66", "88–90", "155–160"], ["M", "86–88", "68–70", "92–94", "158–163"], ["L", "90–92", "72–74", "96–98", "160–165"], ["XL", "94–96", "76–78", "100–102", "162–168"]];

function SizeGuide() {
  return (
    <>
      <PageHeader title="Hướng dẫn chọn size" eyebrow="Size guide">Số đo tính theo cm. Nếu bạn nằm giữa hai size, hãy chọn size lớn hơn để thoải mái hơn.</PageHeader>
      <div className="mx-auto max-w-[1000px] px-6 py-12">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-foreground text-xs uppercase tracking-widest"><tr>{["Size", "Vòng ngực", "Vòng eo", "Vòng mông", "Chiều cao"].map((h) => <th key={h} className="py-3">{h}</th>)}</tr></thead>
            <tbody>{tops.map((r) => <tr key={r.join()} className="border-b border-border">{r.map((c, i) => <td key={i} className={`py-3 ${i === 0 ? "font-medium" : ""}`}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <h2 className="mt-16 text-3xl">Cách đo</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[["Vòng ngực", "Đo vòng quanh phần đầy đặn nhất của ngực, giữ thước dây song song với mặt đất."], ["Vòng eo", "Đo quanh phần nhỏ nhất của eo, thường cách rốn khoảng 2–3 cm."], ["Vòng mông", "Đứng thẳng, đo quanh phần đầy đặn nhất của mông."]].map(([t, d], i) => (
            <div key={t} className="bg-secondary p-8"><p className="font-serif text-4xl text-muted-foreground">0{i + 1}</p><h3 className="mt-4 text-xl">{t}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p></div>
          ))}
        </div>
      </div>
    </>
  );
}
