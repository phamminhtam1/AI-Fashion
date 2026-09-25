import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent } from "react";
import { Heart, Minus, Plus, RefreshCw, Star, Truck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatVND, getCategory, getProduct, products } from "@/lib/products";
import { useStore } from "@/lib/store";
import { ProductCard } from "@/components/site/ProductCard";
import { colorwayHasStock, findVariant, isSizeInStock } from "@/lib/variant-stock";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

function preloadImage(src: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("image load failed"));
    image.src = src;
    if (image.complete) resolve();
  });
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ADJACENT_MS = 800;
const JUMP_MS = 1000;
const THUMB_VISIBLE = 4;
const THUMB_W_PX = 80; // w-20
const THUMB_GAP_PX = 8; // gap-2
const THUMB_H_PX = (THUMB_W_PX * 4) / 3; // aspect-[3/4]
const THUMB_SLOT_PX = THUMB_H_PX + THUMB_GAP_PX;
const THUMB_VIEWPORT_PX = THUMB_H_PX * THUMB_VISIBLE + THUMB_GAP_PX * (THUMB_VISIBLE - 1);

function filmDurationForSteps(steps: number) {
  return Math.abs(steps) <= 1 ? ADJACENT_MS : JUMP_MS;
}

/** Shortest circular delta; forward wins ties (last→first is +1). */
function loopDelta(from: number, to: number, n: number) {
  if (n <= 0 || from === to) return 0;
  const forward = (to - from + n) % n;
  const backward = (from - to + n) % n;
  return forward <= backward ? forward : -backward;
}

function normalizeStripIndex(index: number, n: number) {
  // Keep cursor in the middle copy of a triple track [n, 2n).
  return ((index % n) + n) % n + n;
}

function ProductPage() {
  const { slug } = Route.useParams();
  const p = getProduct(slug)!;
  const cat = getCategory(p.category);
  const { addToCart, toggleWishlist, wishlist } = useStore();

  const initialCw = p.colorways[0];
  const initialGallery = initialCw?.images?.length ? initialCw.images : p.images;
  const initialLoop = initialGallery.length > THUMB_VISIBLE;

  const [colorwayId, setColorwayId] = useState(initialCw?.id ?? "");
  const cw = p.colorways.find((c) => c.id === colorwayId) ?? p.colorways[0];
  const sizesForCw = p.variants
    .filter((v) => !colorwayId || v.colorwayId === colorwayId)
    .map((v) => v.size);
  const uniqueSizes = [...new Set(sizesForCw.length ? sizesForCw : p.sizes)];
  const hasStock = colorwayHasStock(p.variants, colorwayId, uniqueSizes);
  const [size, setSize] = useState<string | null>(() => {
    if (uniqueSizes.length !== 1) return null;
    const only = uniqueSizes[0]!;
    return isSizeInStock(p.variants, colorwayId, only) ? only : null;
  });
  const [qty, setQty] = useState(1);
  const liked = wishlist.includes(p.id);
  const related = products
    .filter((x) => x.category === p.category && x.id !== p.id)
    .concat(products.filter((x) => x.bestSeller && x.id !== p.id))
    .slice(0, 4);

  // Shared stripIndex: main slides horizontally, thumbs vertically; selected always at top of 4-slot window.
  // >4 images → triple track so last↔first loops as one circle.
  const [gallery, setGallery] = useState<string[]>(initialGallery);
  const [stripIndex, setStripIndex] = useState(initialLoop ? initialGallery.length : 0);
  const [galleryKey, setGalleryKey] = useState(0);
  const [transitionMs, setTransitionMs] = useState(ADJACENT_MS);
  const [stripReady, setStripReady] = useState(true);
  const [zooming, setZooming] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });

  const n = gallery.length;
  const loop = n > THUMB_VISIBLE;
  const img = n === 0 ? 0 : loop ? ((stripIndex % n) + n) % n : stripIndex;
  const track = loop ? [...gallery, ...gallery, ...gallery] : gallery;

  useEffect(() => {
    gallery.forEach((src) => {
      void preloadImage(src).catch(() => {});
    });
  }, [gallery]);

  useEffect(() => {
    setZooming(false);
    setZoomOrigin({ x: 50, y: 50 });
  }, [img, galleryKey]);

  const settleLoopIfNeeded = () => {
    if (!loop || n === 0) return;
    const normalized = normalizeStripIndex(stripIndex, n);
    if (normalized === stripIndex) return;
    setStripReady(false);
    setStripIndex(normalized);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setStripReady(true));
    });
  };

  const changeImage = (nextIndex: number) => {
    if (n === 0 || nextIndex < 0 || nextIndex >= n) return;
    const delta = loop ? loopDelta(img, nextIndex, n) : nextIndex - img;
    if (delta === 0) return;
    setTransitionMs(filmDurationForSteps(delta));
    setStripIndex((i) => i + delta);
  };

  const handleColorwayChange = (nextId: string) => {
    if (nextId === colorwayId) return;
    setColorwayId(nextId);
    setSize(null);

    const nextCw = p.colorways.find((c) => c.id === nextId);
    const nextGallery = nextCw?.images?.length ? nextCw.images : p.images;
    const nextLoop = nextGallery.length > THUMB_VISIBLE;
    setGalleryKey((k) => k + 1);
    setStripReady(false);
    setGallery(nextGallery);
    setStripIndex(nextLoop ? nextGallery.length : 0);
    setTransitionMs(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setStripReady(true));
    });
  };

  const onZoomMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    setZoomOrigin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const add = () => {
    if (!hasStock) return;
    if (!size) {
      toast.error("Vui lòng chọn kích cỡ");
      return;
    }
    const variant = findVariant(p.variants, colorwayId, size);
    if (!variant) {
      toast.error("Không tìm thấy SKU");
      return;
    }
    if (variant.available <= 0) {
      toast.error("Size này tạm hết hàng");
      return;
    }
    addToCart(p, variant.id, qty);
  };

  const renderThumb = (src: string, logical: number, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => changeImage(logical)}
      aria-label={`Ảnh ${logical + 1}`}
      aria-current={img === logical ? "true" : undefined}
      className={cn(
        "aspect-[3/4] w-20 shrink-0 overflow-hidden border transition-[border-color,opacity,transform] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none",
        img === logical
          ? "border-foreground opacity-100"
          : "border-transparent opacity-75 hover:opacity-100",
      )}
    >
      <img src={src} alt="" className="h-full w-full object-cover" />
    </button>
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Trang chủ</Link> /{" "}
        {cat && <><Link to="/danh-muc/$slug" params={{ slug: cat.slug }} className="hover:text-foreground">{cat.name}</Link> / </>}
        <span className="text-foreground">{p.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <div className="grid gap-3 md:grid-cols-[80px_1fr]">
          {/* Mobile: horizontal strip */}
          <div
            key={`thumbs-m-${galleryKey}`}
            className="order-2 flex gap-2 overflow-x-auto md:hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
          >
            {gallery.map((src, i) => renderThumb(src, i, `m-${src}-${i}`))}
          </div>

          {/* Desktop: vertical filmstrip, max 4 visible; loops when >4 */}
          <div
            className="order-1 hidden overflow-hidden md:block"
            style={{ height: THUMB_VIEWPORT_PX }}
          >
            <div
              key={`thumbs-d-${galleryKey}`}
              className={cn(
                "flex w-20 flex-col gap-2 will-change-transform motion-reduce:transition-none",
                stripReady && "transition-transform",
              )}
              style={{
                transform: `translate3d(0, -${(loop ? stripIndex : 0) * THUMB_SLOT_PX}px, 0)`,
                transitionDuration: stripReady ? `${transitionMs}ms` : "0ms",
                transitionTimingFunction: EASE,
              }}
            >
              {track.map((src, i) =>
                renderThumb(src, n === 0 ? 0 : i % n, `d-${src}-${i}`),
              )}
            </div>
          </div>

          <div
            className="relative order-1 aspect-[3/4] overflow-hidden bg-secondary md:order-2"
            onMouseEnter={() => setZooming(true)}
            onMouseLeave={() => {
              setZooming(false);
              setZoomOrigin({ x: 50, y: 50 });
            }}
            onMouseMove={onZoomMove}
          >
            <div
              key={galleryKey}
              className={cn(
                "flex h-full w-full will-change-transform motion-reduce:transition-none",
                stripReady && "transition-transform",
              )}
              style={{
                transform: `translate3d(-${stripIndex * 100}%, 0, 0)`,
                transitionDuration: stripReady ? `${transitionMs}ms` : "0ms",
                transitionTimingFunction: EASE,
              }}
              onTransitionEnd={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.propertyName !== "transform") return;
                settleLoopIfNeeded();
              }}
            >
              {track.map((src, i) => {
                const logical = n === 0 ? 0 : i % n;
                return (
                  <div key={`${src}-${i}`} className="h-full w-full shrink-0 grow-0 basis-full overflow-hidden">
                    <img
                      src={src}
                      alt={logical === img ? p.name : ""}
                      width={768}
                      height={1024}
                      draggable={false}
                      className="h-full w-full cursor-zoom-in object-cover transition-transform duration-500 ease-out motion-reduce:transition-none motion-reduce:scale-100"
                      style={
                        logical === img && i === stripIndex
                          ? {
                              transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                              transform: zooming ? "scale(1.35)" : "scale(1)",
                            }
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
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

          {p.colorways.length > 0 && (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest">Màu sắc</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.colorways.map((c, i) => {
                  const selected = c.id === (cw?.id ?? colorwayId);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleColorwayChange(c.id)}
                      aria-label={`Màu ${i + 1}`}
                      className={cn(
                        "relative h-[68px] w-[52px] overflow-hidden border-2 transition-[border-color,transform,opacity] duration-200 active:scale-[0.96] motion-reduce:transition-none",
                        selected ? "border-[#8B1E2D]" : "border-border",
                      )}
                    >
                      <img src={c.thumbnail} alt="" className="h-full w-full object-cover" />
                      {selected && (
                        <span className="absolute bottom-0 right-0 border-b-[14px] border-l-[14px] border-b-[#8B1E2D] border-l-transparent" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="flex justify-between text-xs uppercase tracking-widest">
              <span>Kích cỡ</span>
              <Link to="/huong-dan-chon-size" className="text-muted-foreground underline normal-case tracking-normal">Hướng dẫn chọn size</Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {uniqueSizes.map((s) => {
                const inStock = isSizeInStock(p.variants, colorwayId, s);
                const selected = size === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!inStock}
                    onClick={() => inStock && setSize(s)}
                    aria-label={inStock ? undefined : `Size ${s} hết hàng`}
                    aria-disabled={!inStock ? true : undefined}
                    className={cn(
                      "relative h-11 min-w-14 border px-3 text-sm transition",
                      !inStock && "cursor-not-allowed opacity-40 border-border text-muted-foreground",
                      inStock && selected && "border-foreground bg-primary text-primary-foreground",
                      inStock && !selected && "border-border hover:border-foreground",
                    )}
                  >
                    <span className={cn(!inStock && "opacity-70")}>{s}</span>
                    {!inStock && (
                      <>
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-2 top-1/2 h-px origin-center -rotate-45 bg-foreground/50"
                        />
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-2 top-1/2 h-px origin-center rotate-45 bg-foreground/50"
                        />
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <div className="flex items-center border border-border">
              <button className="px-3 py-3" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Giảm"><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center">{qty}</span>
              <button className="px-3 py-3" onClick={() => setQty(qty + 1)} aria-label="Tăng"><Plus className="h-4 w-4" /></button>
            </div>
            <button
              type="button"
              onClick={add}
              disabled={!hasStock}
              className={cn(
                "flex-1 bg-primary text-xs uppercase tracking-widest text-primary-foreground transition",
                hasStock ? "hover:opacity-90" : "cursor-not-allowed opacity-50",
              )}
            >
              {hasStock ? "Thêm vào giỏ hàng" : "Sản phẩm tạm hết hàng"}
            </button>
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
