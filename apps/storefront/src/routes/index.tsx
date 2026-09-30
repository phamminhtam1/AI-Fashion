import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import hero from "@/assets/hero.jpg";
import setImg from "@/assets/p-set.jpg";
import coatImg from "@/assets/p-coat.jpg";
import dressImg from "@/assets/p-dress.jpg";
import {
  categories,
  getBestSellerProducts,
  getNewArrivalProducts,
  isAccessory,
  prioritizeApparel,
  products,
  rootCategoriesList,
  allProductsList,
  ensureCatalog,
  hydrateCatalog,
  useCatalog,
} from "@/lib/products";
import { fetchElaneWomanPosts, type ElaneWomanPost } from "@/lib/api";
import { ProductCard } from "@/components/site/ProductCard";
import { Newsletter } from "@/components/site/Footer";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [_, elaneWomanRes] = await Promise.all([
      ensureCatalog(),
      fetchElaneWomanPosts(),
    ]);
    return {
      categories: rootCategoriesList().map((c) => ({ ...c })),
      products: allProductsList().map((p) => ({ ...p })),
      elaneWomanPosts: elaneWomanRes.items,
    };
  },
  head: () => ({
    meta: [
      { title: "ÉLANE — Thời trang nữ cao cấp | Bộ sưu tập Thu Đông 2026" },
      { name: "description", content: "Khám phá thời trang nữ ÉLANE: váy đầm, áo, quần, set bộ, áo khoác và phụ kiện thanh lịch. Miễn phí vận chuyển từ 1.000.000₫." },
      { property: "og:title", content: "ÉLANE — Thời trang nữ cao cấp" },
      { property: "og:description", content: "Timeless femininity, redefined. Bộ sưu tập Thu Đông 2026." },
    ],
  }),
  component: Home,
});

function SectionHead({ eyebrow, title, to }: { eyebrow: string; title: string; to?: string }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-2 text-3xl md:text-4xl">{title}</h2>
      </div>
      {to && (
        <Link to="/danh-muc/$slug" params={{ slug: to }} className="group hidden items-center gap-2 text-xs uppercase tracking-widest md:flex">
          Xem tất cả <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
        </Link>
      )}
    </div>
  );
}

function Home() {
  const loaderData = Route.useLoaderData();
  const catalog = useCatalog();

  useEffect(() => {
    if (loaderData?.categories?.length || loaderData?.products?.length) {
      hydrateCatalog(loaderData.products, loaderData.categories);
    }
  }, [loaderData]);

  const cats =
    catalog.categories.length > 0
      ? catalog.categories
      : (loaderData?.categories?.length ? loaderData.categories : categories);

  const prods =
    catalog.products.length > 0
      ? catalog.products
      : (loaderData?.products?.length ? loaderData.products : products);

  const newIn = getNewArrivalProducts(prods).slice(0, 8);
  const best = getBestSellerProducts(prods).slice(0, 8);

  const womanPosts: ElaneWomanPost[] = loaderData?.elaneWomanPosts ?? [];
  const womanItems =
    womanPosts.length > 0
      ? womanPosts.slice(0, 6).map((p) => ({
          id: p.id,
          title: p.title,
          image: p.image_url,
          link: p.link_url || (p.product_slug ? `/san-pham/${p.product_slug}` : null),
        }))
      : prods
          .filter((p) => !isAccessory(p))
          .slice(0, 6)
          .map((p) => ({
            id: p.id,
            title: p.name,
            image: p.images[0] ?? "",
            link: `/san-pham/${p.slug}`,
          }));

  return (
    <>
      <section className="relative h-[calc(100svh-7rem)] min-h-[520px] overflow-hidden bg-secondary">
        <img src={hero} alt="Bộ sưu tập Thu Đông 2026 ÉLANE" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover object-[75%_center] animate-in fade-in zoom-in-105 duration-[1500ms]" />
        <div className="relative mx-auto flex h-full max-w-[1440px] items-center px-6 md:px-12">
          <div className="max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <p className="text-[11px] uppercase tracking-[0.4em]">New Collection</p>
            <p className="mt-2 text-sm uppercase tracking-[0.3em] text-muted-foreground">Autumn / Winter 2026</p>
            <h1 className="mt-6 text-5xl leading-[1.05] md:text-7xl">Timeless femininity, <em>redefined.</em></h1>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className="bg-primary px-8 py-4 text-xs uppercase tracking-widest text-primary-foreground transition hover:opacity-90">Khám phá bộ sưu tập</Link>
              <Link to="/danh-muc/$slug" params={{ slug: "ban-chay" }} className="border border-foreground px-8 py-4 text-xs uppercase tracking-widest transition hover:bg-foreground hover:text-background">Mua ngay</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 divide-y divide-border px-6 text-sm md:grid-cols-3 md:divide-x md:divide-y-0">
          {[[Truck, "Miễn phí vận chuyển", "Cho đơn hàng từ 1.000.000₫"], [RefreshCw, "Đổi trả 30 ngày", "Miễn phí, không cần lý do"], [ShieldCheck, "Thanh toán an toàn", "COD, thẻ, ví điện tử"]].map(([I, t, d]) => {
            const Icon = I as typeof Truck;
            return (
              <div key={t as string} className="flex items-center justify-center gap-4 py-6">
                <Icon className="h-5 w-5" strokeWidth={1.25} />
                <div><p className="font-medium">{t as string}</p><p className="text-xs text-muted-foreground">{d as string}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-20 md:px-8">
        <SectionHead eyebrow="Danh mục" title="Mua sắm theo danh mục" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          {cats.map((c) => (
            <Link key={c.slug} to="/danh-muc/$slug" params={{ slug: c.slug }} className="group">
              <div className="aspect-[3/4] overflow-hidden bg-secondary">
                <img src={c.image} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <p className="mt-3 text-center text-xs uppercase tracking-widest">{c.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 pb-20 md:px-8">
        <SectionHead eyebrow="Vừa cập bến" title="Hàng mới về" to="hang-moi" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {newIn.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      <section className="grid bg-secondary md:grid-cols-2">
        <div className="aspect-[4/5] overflow-hidden md:aspect-auto">
          <img src={setImg} alt="Bộ sưu tập Parisienne" loading="lazy" className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-col justify-center px-8 py-16 md:px-20">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Editorial</p>
          <h2 className="mt-4 text-4xl leading-tight md:text-5xl">La Parisienne</h2>
          <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">Cảm hứng từ những buổi chiều Paris — chất liệu tweed mềm mại, gam kem ấm áp và những chi tiết vàng tinh xảo. Một bộ sưu tập dành cho người phụ nữ yêu sự thanh lịch không cần phô trương.</p>
          <Link to="/danh-muc/$slug" params={{ slug: "set-bo" }} className="mt-10 self-start border-b border-foreground pb-1 text-xs uppercase tracking-widest">Khám phá ngay</Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-20 md:px-8">
        <SectionHead eyebrow="Được yêu thích" title="Bán chạy nhất" to="ban-chay" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {best.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 pb-20 md:px-8">
        <SectionHead eyebrow="Dịp đặc biệt" title="Mua sắm theo dịp" />
        <div className="grid gap-4 md:grid-cols-3">
          {([["cong-so", "Công sở", coatImg], ["du-tiec", "Dự tiệc", dressImg], ["casual", "Casual", hero]] as [string, string, string][]).map(([slug, name, img]) => (
            <Link key={slug} to="/danh-muc/$slug" params={{ slug }} className="group relative block aspect-[4/5] overflow-hidden bg-secondary">
              <img src={img} alt={name} loading="lazy" className="h-full w-full object-cover object-right transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/60 to-transparent p-8">
                <p className="font-serif text-3xl text-background">{name}</p>
                <p className="mt-2 text-xs uppercase tracking-widest text-background/90">Xem bộ sưu tập →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-primary px-6 py-20 text-center text-primary-foreground">
        <p className="text-[11px] uppercase tracking-[0.4em] opacity-70">Mid-season sale</p>
        <h2 className="mt-4 text-4xl md:text-6xl">Giảm đến 30%</h2>
        <p className="mt-4 text-sm opacity-70">Ưu đãi có hạn cho các thiết kế được chọn lọc.</p>
        <Link to="/danh-muc/$slug" params={{ slug: "sale" }} className="mt-8 inline-block bg-background px-10 py-4 text-xs uppercase tracking-widest text-foreground">Mua sale ngay</Link>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-20 text-center md:px-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">@elane.official</p>
        <h2 className="mt-2 text-3xl md:text-4xl">#ÉLANEwoman</h2>
        <div className="mt-10 grid grid-cols-3 gap-2 md:grid-cols-6">
          {womanItems.map((item) => (
            <LookbookItem key={item.id} post={item} />
          ))}
        </div>
      </section>

      <Newsletter />
    </>
  );
}

function LookbookItem({
  post,
}: {
  post: { id: string; title?: string | null; image: string; link?: string | null };
}) {
  const isInternal = post.link && post.link.startsWith("/") && !post.link.startsWith("//");

  const inner = (
    <div className="group relative aspect-square overflow-hidden bg-secondary">
      <img
        src={post.image}
        alt={post.title || "ÉLANEwoman"}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
      {post.title && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-end p-3">
          <p className="text-xs text-white line-clamp-2 text-left font-light leading-snug">{post.title}</p>
        </div>
      )}
    </div>
  );

  if (isInternal && post.link) {
    return (
      <Link to={post.link} className="block">
        {inner}
      </Link>
    );
  }

  if (post.link) {
    return (
      <a href={post.link} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }

  return <div>{inner}</div>;
}
