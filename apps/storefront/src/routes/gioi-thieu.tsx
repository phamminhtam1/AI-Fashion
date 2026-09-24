import { createFileRoute } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";
import setImg from "@/assets/p-set.jpg";

export const Route = createFileRoute("/gioi-thieu")({
  head: () => ({
    meta: [
      { title: "Về chúng tôi — ÉLANE" },
      { name: "description", content: "Câu chuyện thương hiệu ÉLANE — thời trang nữ tinh tế, hiện đại, thiết kế tại Việt Nam." },
      { property: "og:title", content: "Về chúng tôi — ÉLANE" },
      { property: "og:description", content: "Câu chuyện thương hiệu ÉLANE — Modern Femininity." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <section className="relative h-[60vh] overflow-hidden">
        <img src={hero} alt="ÉLANE" className="h-full w-full object-cover object-right" />
        <div className="absolute inset-0 flex items-center px-8 md:px-20">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em]">Our story</p>
            <h1 className="mt-4 text-5xl md:text-7xl">Modern Femininity</h1>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="font-serif text-2xl leading-relaxed md:text-3xl">"ÉLANE ra đời từ niềm tin rằng sự thanh lịch không cần phô trương — nó nằm ở phom dáng chuẩn mực, chất liệu tử tế và sự tự tin của người mặc."</p>
      </section>
      <section className="grid bg-secondary md:grid-cols-2">
        <img src={setImg} alt="Xưởng may ÉLANE" loading="lazy" className="aspect-[4/5] h-full w-full object-cover" />
        <div className="flex flex-col justify-center gap-10 px-8 py-16 md:px-20">
          {[["Thiết kế", "Mỗi thiết kế được phát triển tại studio Hà Nội và TP. Hồ Chí Minh, lấy cảm hứng từ vẻ đẹp phụ nữ Á Đông hiện đại."], ["Chất liệu", "Lụa tơ tằm, linen, tweed và len được chọn lọc kỹ lưỡng từ các nhà cung cấp uy tín."], ["Bền vững", "Sản xuất số lượng giới hạn, hạn chế lãng phí và ưu tiên thiết kế vượt thời gian."]].map(([t, d]) => (
            <div key={t}><h2 className="text-2xl">{t}</h2><p className="mt-3 leading-relaxed text-muted-foreground">{d}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}
