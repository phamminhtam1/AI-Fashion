import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, Minus, Plus, RefreshCw, Star, Truck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatVND, getCategory, getProduct, products } from "@/lib/products";
import { useStore } from "@/lib/store";
import { ProductCard } from "@/components/site/ProductCard";
import { toast } from "sonner";

export const Route = createFileRoute("/san-pham/$slug")({
  loader: ({ params }) => {
    const p = getProduct(params.slug);
    if (!p) throw notFound();
    return { name: p.name, description: p.description, price: p.salePrice ?? p.price };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Không tìm thấy sản phẩm — ÉLANE" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.name} — ÉLANE`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.description.slice(0, 155) },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.description.slice(0, 155) },
        { property: "og:type", content: "product" },
      ],
      scripts: [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: loaderData.name, brand: "ÉLANE", offers: { "@type": "Offer", priceCurrency: "VND", price: loaderData.price, availability: "https://schema.org/InStock" } }) }],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const p = getProduct(slug)!;
  const cat = getCategory(p.category);
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const [color, setColor] = useState(p.colors[0]!.name);
  const [size, setSize] = useState<string | null>(p.sizes.length === 1 ? p.sizes[0]! : null);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const liked = wishlist.includes(p.id);
  const related = products.filter((x) => x.category === p.category && x.id !== p.id).concat(products.filter((x) => x.bestSeller && x.id !== p.id)).slice(0, 4);

  const add = () => {
    if (!size) { toast.error("Vui lòng chọn kích cỡ"); return; }
    addToCart(p, size, color, qty);
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Trang chủ</Link> /{" "}
        {cat && <><Link to="/danh-muc/$slug" params={{ slug: cat.slug }} className="hover:text-foreground">{cat.name}</Link> / </>}
        <span className="text-foreground">{p.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <div className="grid gap-3 md:grid-cols-[80px_1fr]">
          <div className="order-2 flex gap-2 md:order-1 md:flex-col">
            {p.images.map((src, i) => (
              <button key={i} onClick={() => setImg(i)} className={`aspect-[3/4] w-20 overflow-hidden border ${img === i ? "border-foreground" : "border-transparent"}`} aria-label={`Ảnh ${i + 1}`}>
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div className="order-1 aspect-[3/4] overflow-hidden bg-secondary md:order-2">
            <img src={p.images[img]} alt={p.name} width={768} height={1024} className="h-full w-full cursor-zoom-in object-cover transition-transform duration-700 hover:scale-125" />
          </div>
        </div>

        <div className="lg:sticky lg:top-40 lg:self-start">
          {p.isNew && <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Hàng mới</p>}
          <h1 className="mt-2 text-3xl md:text-4xl">{p.name}</h1>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(p.rating) ? "fill-foreground text-foreground" : ""}`} />)}</div>
            {p.rating.toFixed(1)} · {p.reviews} đánh giá
          </div>
          <div className="mt-5 flex items-baseline gap-3 text-xl">
            {p.salePrice ? (
              <><span className="text-sale">{formatVND(p.salePrice)}</span><span className="text-base text-muted-foreground line-through">{formatVND(p.price)}</span></>
            ) : formatVND(p.price)}
          </div>

          <div className="mt-8">
            <p className="text-xs uppercase tracking-widest">Màu sắc: <span className="text-muted-foreground normal-case">{color}</span></p>
            <div className="mt-3 flex gap-3">
              {p.colors.map((c) => (
                <button key={c.name} onClick={() => setColor(c.name)} aria-label={c.name} className={`h-8 w-8 rounded-full border p-0.5 ${color === c.name ? "border-foreground" : "border-border"}`}>
                  <span className="block h-full w-full rounded-full" style={{ backgroundColor: c.hex }} />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between text-xs uppercase tracking-widest">
              <span>Kích cỡ</span>
              <Link to="/huong-dan-chon-size" className="text-muted-foreground underline normal-case tracking-normal">Hướng dẫn chọn size</Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.sizes.map((s) => (
                <button key={s} onClick={() => setSize(s)} className={`h-11 min-w-14 border px-3 text-sm transition ${size === s ? "border-foreground bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <div className="flex items-center border border-border">
              <button className="px-3 py-3" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Giảm"><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center">{qty}</span>
              <button className="px-3 py-3" onClick={() => setQty(qty + 1)} aria-label="Tăng"><Plus className="h-4 w-4" /></button>
            </div>
            <button onClick={add} className="flex-1 bg-primary text-xs uppercase tracking-widest text-primary-foreground transition hover:opacity-90">Thêm vào giỏ hàng</button>
            <button onClick={() => toggleWishlist(p.id)} aria-label="Yêu thích" className="grid w-12 place-items-center border border-border hover:border-foreground">
              <Heart className={`h-5 w-5 ${liked ? "fill-foreground" : ""}`} strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><Truck className="h-4 w-4" strokeWidth={1.5} /> Miễn phí vận chuyển cho đơn từ 1.000.000₫</p>
            <p className="flex items-center gap-2"><RefreshCw className="h-4 w-4" strokeWidth={1.5} /> Đổi trả miễn phí trong 30 ngày</p>
          </div>

          <Accordion type="single" collapsible defaultValue="desc" className="mt-8 border-t border-border">
            <AccordionItem value="desc"><AccordionTrigger className="text-xs uppercase tracking-widest">Mô tả</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">{p.description}</AccordionContent></AccordionItem>
            <AccordionItem value="mat"><AccordionTrigger className="text-xs uppercase tracking-widest">Chất liệu & bảo quản</AccordionTrigger><AccordionContent className="text-muted-foreground">Chất liệu: {p.material}. Giặt tay hoặc giặt khô, không dùng chất tẩy, ủi ở nhiệt độ thấp.</AccordionContent></AccordionItem>
            <AccordionItem value="ship"><AccordionTrigger className="text-xs uppercase tracking-widest">Vận chuyển & đổi trả</AccordionTrigger><AccordionContent className="text-muted-foreground">Giao hàng 2–4 ngày toàn quốc. Đổi trả miễn phí trong 30 ngày với sản phẩm còn nguyên tem mác.</AccordionContent></AccordionItem>
          </Accordion>
        </div>
      </div>

      <section className="mt-24">
        <h2 className="mb-8 text-3xl">Có thể bạn cũng thích</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {related.map((x) => <ProductCard key={x.id} product={x} />)}
        </div>
      </section>
    </div>
  );
}
