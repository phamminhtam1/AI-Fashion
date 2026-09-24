import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, Menu, Search, ShoppingBag, User, X, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { categories, formatVND, navItems, products } from "@/lib/products";
import { FREE_SHIP, useStore } from "@/lib/store";
import heroImg from "@/assets/hero.jpg";

const announcements = [
  "Miễn phí vận chuyển đơn hàng từ 1.000.000₫",
  "Đổi trả miễn phí trong 30 ngày",
  "Thành viên mới giảm 10% đơn đầu tiên",
];

const mega: Record<string, string[][]> = {
  "vay-dam": [["Đầm công sở", "Đầm dự tiệc", "Đầm maxi", "Đầm midi", "Đầm mini"], ["Đầm chữ A", "Đầm ôm", "Đầm xòe", "Đầm suông"]],
  ao: [["Áo sơ mi", "Áo kiểu", "Áo len", "Áo thun"], ["Áo croptop", "Áo tank top", "Áo vest"]],
  quan: [["Quần ống rộng", "Quần âu", "Quần jeans"], ["Quần short", "Quần culottes"]],
};

export function Header() {
  const { cartCount, wishlist, setCartOpen } = useStore();
  const [ann, setAnn] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setAnn((a) => (a + 1) % announcements.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-background">
      <div className="bg-primary py-2 text-center text-[11px] uppercase tracking-[0.2em] text-primary-foreground">
        <span key={ann} className="inline-block animate-in fade-in duration-700">{announcements[ann]}</span>
      </div>
      <div className="border-b border-border" onMouseLeave={() => setOpen(null)}>
        <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-3 items-center px-4 md:px-8">
          <div className="flex items-center gap-4">
            <button className="lg:hidden" onClick={() => setMobile(true)} aria-label="Mở menu">
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button className="lg:hidden" onClick={() => setSearch(true)} aria-label="Tìm kiếm">
              <Search className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="hidden gap-6 lg:flex">
              <Link to="/bo-suu-tap" className="text-xs uppercase tracking-widest hover:opacity-60">Bộ sưu tập</Link>
              <Link to="/lookbook" className="text-xs uppercase tracking-widest hover:opacity-60">Lookbook</Link>
              <Link to="/blog" className="text-xs uppercase tracking-widest hover:opacity-60">Tạp chí</Link>
            </div>
          </div>
          <Link to="/" className="justify-self-center text-center">
            <span className="font-serif text-2xl tracking-[0.3em] md:text-3xl">ÉLANE</span>
            <span className="hidden text-[9px] uppercase tracking-[0.4em] text-muted-foreground md:block">Modern Femininity</span>
          </Link>
          <div className="flex items-center justify-end gap-4 md:gap-5">
            <button className="hidden lg:block" onClick={() => setSearch(true)} aria-label="Tìm kiếm">
              <Search className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <Link to="/tai-khoan" aria-label="Tài khoản" className="hidden md:block"><User className="h-5 w-5" strokeWidth={1.5} /></Link>
            <Link to="/yeu-thich" aria-label="Yêu thích" className="relative">
              <Heart className="h-5 w-5" strokeWidth={1.5} />
              {wishlist.length > 0 && <Badge n={wishlist.length} />}
            </Link>
            <button onClick={() => setCartOpen(true)} aria-label="Giỏ hàng" className="relative">
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {cartCount > 0 && <Badge n={cartCount} />}
            </button>
          </div>
        </div>
        <nav className="hidden justify-center gap-7 pb-3 lg:flex" aria-label="Danh mục">
          {navItems.map((n) => (
            <Link
              key={n.slug}
              to="/danh-muc/$slug"
              params={{ slug: n.slug }}
              onMouseEnter={() => setOpen(mega[n.slug] ? n.slug : null)}
              className={`text-[12px] uppercase tracking-[0.15em] underline-offset-8 hover:underline ${n.slug === "sale" ? "text-sale" : ""}`}
              activeProps={{ className: "underline" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        {open && (
          <div className="absolute inset-x-0 top-full hidden border-b border-border bg-background lg:block animate-in fade-in slide-in-from-top-1">
            <div className="mx-auto grid max-w-[1200px] grid-cols-4 gap-10 px-8 py-10">
              {(mega[open] ?? []).map((col, i) => (
                <ul key={i} className="space-y-3 text-sm">
                  {col.map((l) => (
                    <li key={l}><Link to="/danh-muc/$slug" params={{ slug: open }} className="text-muted-foreground hover:text-foreground">{l}</Link></li>
                  ))}
                </ul>
              ))}
              <ul className="space-y-3 text-sm">
                <li className="text-[11px] uppercase tracking-widest">Nổi bật</li>
                <li><Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className="text-muted-foreground hover:text-foreground">New Collection</Link></li>
                <li><Link to="/danh-muc/$slug" params={{ slug: "ban-chay" }} className="text-muted-foreground hover:text-foreground">Best Seller</Link></li>
              </ul>
              <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className="group relative block aspect-[4/5] overflow-hidden">
                <img src={heroImg} alt="Bộ sưu tập Thu Đông" className="h-full w-full object-cover object-right transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute bottom-4 left-4 bg-background px-3 py-2 text-[11px] uppercase tracking-widest">Thu Đông 2026</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto">
          <SheetHeader><SheetTitle className="font-serif tracking-[0.3em]">ÉLANE</SheetTitle></SheetHeader>
          <nav className="mt-6 flex flex-col">
            {navItems.map((n) => (
              <Link key={n.slug} to="/danh-muc/$slug" params={{ slug: n.slug }} onClick={() => setMobile(false)} className={`border-b border-border py-4 text-sm uppercase tracking-widest ${n.slug === "sale" ? "text-sale" : ""}`}>
                {n.label}
              </Link>
            ))}
            {([["/bo-suu-tap", "Bộ sưu tập"], ["/lookbook", "Lookbook"], ["/blog", "Tạp chí"], ["/tai-khoan", "Tài khoản"], ["/yeu-thich", "Yêu thích"], ["/cua-hang", "Cửa hàng"], ["/gioi-thieu", "Về chúng tôi"], ["/lien-he", "Liên hệ"]] as const).map(([to, l]) => (
              <Link key={to} to={to} onClick={() => setMobile(false)} className="py-3 text-sm text-muted-foreground">{l}</Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <SearchOverlay open={search} onClose={() => setSearch(false)} />
      <MiniCart />
    </header>
  );
}

function Badge({ n }: { n: number }) {
  return <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{n}</span>;
}

function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const results = q.trim() ? products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-background animate-in fade-in">
      <div className="mx-auto max-w-4xl px-6 pt-10">
        <div className="flex items-center gap-4 border-b border-foreground pb-3">
          <Search className="h-5 w-5" strokeWidth={1.5} />
          <form className="flex-1" onSubmit={(e) => { e.preventDefault(); onClose(); navigate({ to: "/tim-kiem", search: { q } }); }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kiếm sản phẩm..." className="w-full bg-transparent font-serif text-2xl outline-none md:text-3xl" />
          </form>
          <button onClick={onClose} aria-label="Đóng"><X className="h-6 w-6" strokeWidth={1.5} /></button>
        </div>
        {!q && (
          <div className="mt-8">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Tìm kiếm phổ biến</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Đầm lụa", "Blazer", "Set tweed", "Quần linen", "Chân váy xếp ly"].map((t) => (
                <button key={t} onClick={() => setQ(t)} className="border border-border px-4 py-2 text-sm hover:border-foreground">{t}</button>
              ))}
            </div>
            <p className="mt-8 text-[11px] uppercase tracking-widest text-muted-foreground">Danh mục</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {categories.map((c) => (
                <Link key={c.slug} to="/danh-muc/$slug" params={{ slug: c.slug }} onClick={onClose} className="underline-offset-4 hover:underline">{c.name}</Link>
              ))}
            </div>
          </div>
        )}
        {q && (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            {results.length === 0 && <p className="col-span-full text-muted-foreground">Không tìm thấy sản phẩm cho "{q}".</p>}
            {results.map((p) => (
              <Link key={p.id} to="/san-pham/$slug" params={{ slug: p.slug }} onClick={onClose} className="flex gap-3">
                <img src={p.images[0]} alt={p.name} className="h-24 w-18 object-cover" />
                <div className="text-sm"><p>{p.name}</p><p className="mt-1 text-muted-foreground">{formatVND(p.salePrice ?? p.price)}</p></div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniCart() {
  const { cart, cartOpen, setCartOpen, subtotal, updateQty, removeItem } = useStore();
  const left = FREE_SHIP - subtotal;
  return (
    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader><SheetTitle className="font-serif text-xl font-normal">Giỏ hàng ({cart.length})</SheetTitle></SheetHeader>
        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" strokeWidth={1} />
            <p className="text-muted-foreground">Giỏ hàng của bạn đang trống.</p>
            <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} onClick={() => setCartOpen(false)} className="bg-primary px-8 py-3 text-xs uppercase tracking-widest text-primary-foreground">Tiếp tục mua sắm</Link>
          </div>
        ) : (
          <>
            <div className="px-4 text-xs">
              <p>{left > 0 ? <>Mua thêm <b>{formatVND(left)}</b> để được miễn phí vận chuyển</> : "Bạn đã được miễn phí vận chuyển ✓"}</p>
              <div className="mt-2 h-0.5 bg-border"><div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (subtotal / FREE_SHIP) * 100)}%` }} /></div>
            </div>
            <ul className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {cart.map((it, i) => {
                const p = products.find((x) => x.id === it.productId)!;
                return (
                  <li key={i} className="flex gap-4">
                    <img src={p.images[0]} alt={p.name} className="h-28 w-21 object-cover" />
                    <div className="flex flex-1 flex-col text-sm">
                      <p>{p.name}</p>
                      <p className="text-xs text-muted-foreground">{it.color} · {it.size}</p>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center border border-border">
                          <button className="p-1.5" onClick={() => updateQty(i, it.qty - 1)} aria-label="Giảm"><Minus className="h-3 w-3" /></button>
                          <span className="w-6 text-center text-xs">{it.qty}</span>
                          <button className="p-1.5" onClick={() => updateQty(i, it.qty + 1)} aria-label="Tăng"><Plus className="h-3 w-3" /></button>
                        </div>
                        <span>{formatVND((p.salePrice ?? p.price) * it.qty)}</span>
                      </div>
                      <button onClick={() => removeItem(i)} className="mt-1 self-start text-xs text-muted-foreground underline">Xóa</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="space-y-3 border-t border-border p-4">
              <div className="flex justify-between text-sm"><span>Tạm tính</span><span className="font-medium">{formatVND(subtotal)}</span></div>
              <Link to="/thanh-toan" onClick={() => setCartOpen(false)} className="block bg-primary py-3.5 text-center text-xs uppercase tracking-widest text-primary-foreground hover:opacity-90">Thanh toán</Link>
              <Link to="/gio-hang" onClick={() => setCartOpen(false)} className="block border border-foreground py-3.5 text-center text-xs uppercase tracking-widest">Xem giỏ hàng</Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
