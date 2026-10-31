import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Heart, Menu, Search, ShoppingBag, User, X, Minus, Plus, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchProducts } from "@/lib/api";
import {
  categories,
  ensureCategories,
  formatVND,
  getNavItems,
  mapApiProduct,
  products,
  type NavItem,
  type Product,
} from "@/lib/products";
import { useStore, getCartItemImage } from "@/lib/store";
import { toast } from "sonner";
import heroImg from "@/assets/hero.jpg";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function Header({ navItems: navItemsProp = [] }: { navItems?: NavItem[] }) {
  const { cartCount, wishlist, setCartOpen, storeSettings } = useStore();
  const announcements = [
    storeSettings.shipping.freeShippingFromVnd > 0
      ? `Miễn phí vận chuyển đơn hàng từ ${formatVND(storeSettings.shipping.freeShippingFromVnd)}`
      : "Miễn phí vận chuyển cho mọi đơn hàng",
    `Đổi trả miễn phí trong ${storeSettings.returns.returnWindowDays} ngày`,
    "Thành viên mới giảm 10% đơn đầu tiên",
  ];
  const [ann, setAnn] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpenCategory, setMobileOpenCategory] = useState<string | null>(null);
  const [navItems, setNavItems] = useState<NavItem[]>(navItemsProp);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setNavItems(navItemsProp);
  }, [navItemsProp]);

  // Rebuild nav on client only if categories weren't hydrated from SSR
  useEffect(() => {
    let cancelled = false;
    if (navItems.length === 0) {
      ensureCategories().then(() => {
        if (!cancelled) setNavItems(getNavItems());
      });
    }
    return () => {
      cancelled = true;
    };
  }, [navItems.length]);

  const openNav = open ? navItems.find((n) => n.slug === open && (n.children?.length ?? 0) > 0) : undefined;
  const megaCols = openNav?.children?.length ? chunk(openNav.children, 6) : [];

  const [scrolled, setScrolled] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Sync header height to CSS custom property --header-height
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const updateHeaderHeight = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height > 0) {
        document.documentElement.style.setProperty("--header-height", `${height}px`);
      }
    };

    updateHeaderHeight();

    const ro = new ResizeObserver(() => {
      updateHeaderHeight();
    });
    ro.observe(el);

    window.addEventListener("resize", updateHeaderHeight, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, [announcements.length]);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          // Hysteresis threshold to eliminate scroll bounce:
          // Scroll down past 120px: collapse category bar
          // Scroll back up to the top (< 25px): expand category bar
          if (y > 120) {
            setScrolled(true);
          } else if (y < 25) {
            setScrolled(false);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAnn((a) => (a + 1) % announcements.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-50 overflow-visible transition-all duration-300 group/header ${scrolled ? "bg-background/95 backdrop-blur-md shadow-sm" : "bg-background"
        }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setOpen(null);
      }}
    >
      <div className="bg-primary py-2 text-center text-[11px] uppercase tracking-[0.2em] text-primary-foreground">
        <span key={ann} className="inline-block animate-in fade-in duration-700">{announcements[ann]}</span>
      </div>
      <div
        className="relative overflow-visible border-b border-border"
      >
        <div className="mx-auto grid min-h-18 md:min-h-22 lg:min-h-26 max-w-[1600px] grid-cols-3 items-center px-4 py-1.5 md:py-2 md:px-8">
          <div className="flex items-center gap-4">
            <button className="lg:hidden" onClick={() => setMobile(true)} aria-label="Mở menu">
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button className="lg:hidden" onClick={() => setSearch(true)} aria-label="Tìm kiếm">
              <Search className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <div className="hidden gap-6 lg:flex items-center">
              <Link to="/bo-suu-tap" className="text-xs font-medium uppercase tracking-widest hover:opacity-60">Bộ sưu tập</Link>
              <div className="relative group/lb py-2">
                <Link
                  to="/lookbook"
                  search={{ collection: undefined }}
                  className="text-xs font-medium uppercase tracking-widest hover:opacity-60 flex items-center gap-1 cursor-pointer"
                >
                  <span>Lookbook</span>
                  <ChevronDown className="size-3 opacity-60 transition-transform group-hover/lb:rotate-180" />
                </Link>
                <div className="absolute left-0 top-full hidden group-hover/lb:block pt-1 z-50">
                  <div className="w-56 rounded-xl border border-border bg-background/95 backdrop-blur-md p-2 shadow-xl">
                    <Link
                      to="/lookbook"
                      search={{ collection: undefined }}
                      className="block rounded-lg px-3 py-2 text-xs uppercase tracking-wider hover:bg-secondary font-medium transition"
                    >
                      Tất cả Runway (Thác ảnh)
                    </Link>
                    <div className="my-1 border-t border-border/60" />
                    <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      Bộ sưu tập Lookbook
                    </div>
                    <Link
                      to="/lookbook"
                      search={{ collection: "autumn-winter-2026" }}
                      className="block rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                    >
                      Thu Đông 2026
                    </Link>
                    <Link
                      to="/lookbook"
                      search={{ collection: "la-parisienne" }}
                      className="block rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                    >
                      La Parisienne
                    </Link>
                    <Link
                      to="/lookbook"
                      search={{ collection: "the-office-edit" }}
                      className="block rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                    >
                      The Office Edit
                    </Link>
                    <Link
                      to="/lookbook"
                      search={{ collection: "evening-noir" }}
                      className="block rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                    >
                      Evening Noir
                    </Link>
                  </div>
                </div>
              </div>
              <Link to="/blog" className="text-xs font-medium uppercase tracking-widest hover:opacity-60">Tạp chí</Link>
            </div>
          </div>
          <Link to="/" className="justify-self-center flex items-center justify-center py-1 group/logo">
            <div className="header-logo-wrap">
              <img
                src="/images/elane-logo.png"
                alt={`${storeSettings.brand.name} - ${storeSettings.brand.tagline}`}
                className="h-[50px] sm:h-[58px] md:h-[72px] lg:h-[86px] w-auto object-contain transition-transform duration-300"
              />
              <span className="header-logo-shimmer" aria-hidden="true" />
            </div>
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
        <nav
          className={`
            hidden justify-center gap-7 lg:flex overflow-hidden
            transition-all duration-300 ease-out
            ${scrolled
              ? "max-h-0 opacity-0 pb-0 pointer-events-none -translate-y-2"
              : "max-h-16 opacity-100 pb-3 translate-y-0 pointer-events-auto"
            }
          `}
          aria-label="Danh mục"
        >
          {navItems.map((n) => {
            const hasKids = (n.children?.length ?? 0) > 0;
            return (
              <div
                key={n.slug}
                className="relative"
                onMouseEnter={() => setOpen(hasKids ? n.slug : null)}
                onFocus={() => setOpen(hasKids ? n.slug : null)}
              >
                <Link
                  to="/danh-muc/$slug"
                  params={{ slug: n.slug }}
                  aria-haspopup={hasKids ? "true" : undefined}
                  aria-expanded={hasKids ? open === n.slug : undefined}
                  className={`text-[12px] font-medium uppercase tracking-[0.15em] underline-offset-8 hover:underline ${n.slug === "sale" ? "text-sale" : ""} ${open === n.slug ? "underline" : ""}`}
                  activeProps={{ className: "underline" }}
                >
                  {n.label}
                </Link>
              </div>
            );
          })}
        </nav>
        {openNav ? (
          <nav
            className="absolute inset-x-0 top-full z-[60] border-b border-border/70 bg-background shadow-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-200"
            aria-label={`Danh mục con ${openNav.label}`}
          >
            <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-start gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_170px_210px] lg:gap-10 lg:px-10 lg:py-8">
              <section className="min-w-0">
                <div className="mb-3 flex items-end justify-between gap-4 border-b border-border/70 pb-3">
                  <div>
                    <h2 className="font-serif text-xl leading-tight text-foreground">{openNav.label}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Khám phá các thiết kế mới nhất</p>
                  </div>
                  <Link
                    to="/danh-muc/$slug"
                    params={{ slug: openNav.slug }}
                    className="group inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground transition-colors hover:text-primary"
                    onClick={() => setOpen(null)}
                  >
                    Xem tất cả <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </div>
                <div className={`grid gap-x-5 ${megaCols.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {megaCols.map((col, i) => (
                    <ul key={i} className="space-y-0.5">
                      {col.map((l) => (
                        <li key={l.slug}>
                          <Link
                            to="/danh-muc/$slug"
                            params={{ slug: l.slug }}
                            className="group flex min-h-10 items-center justify-between gap-3 rounded-sm px-2 text-sm text-muted-foreground transition-colors duration-200 hover:bg-secondary/70 hover:text-foreground focus-visible:bg-secondary/70 focus-visible:text-foreground"
                            onClick={() => setOpen(null)}
                          >
                            <span className="truncate">{l.label}</span>
                            <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-60 group-focus-visible:opacity-60" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
              </section>
              <section className="hidden min-w-0 lg:block">
                <h3 className="mb-3 border-b border-border/70 pb-3 text-sm font-semibold text-foreground">Khám phá thêm</h3>
                <ul className="space-y-1">
                  <li>
                    <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className="block rounded-sm px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground" onClick={() => setOpen(null)}>
                      New Collection
                    </Link>
                  </li>
                  <li>
                    <Link to="/danh-muc/$slug" params={{ slug: "ban-chay" }} className="block rounded-sm px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground" onClick={() => setOpen(null)}>
                      Best Seller
                    </Link>
                  </li>
                </ul>
              </section>
              <Link
                to="/danh-muc/$slug"
                params={{ slug: "hang-moi" }}
                className="group relative hidden aspect-[4/3] w-full overflow-hidden bg-secondary lg:block lg:aspect-[3/4]"
                onClick={() => setOpen(null)}
              >
                <img src={heroImg} alt="Bộ sưu tập Thu Đông 2026" className="h-full w-full object-cover object-right transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute inset-x-3 bottom-3 bg-background px-3 py-3 text-center text-sm font-medium text-foreground">Thu Đông 2026</span>
              </Link>
            </div>
          </nav>
        ) : null}
      </div>

      <Sheet open={mobile} onOpenChange={(nextOpen) => {
        setMobile(nextOpen);
        if (!nextOpen) setMobileOpenCategory(null);
      }}>
        <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto">
          <SheetHeader><SheetTitle className="font-serif tracking-[0.3em]">ÉLANE</SheetTitle></SheetHeader>
          <nav className="mt-6 flex flex-col">
            {navItems.map((n) => (
              <div key={n.slug} className="border-b border-border/70">
                <div className="flex items-center gap-3">
                  <Link
                    to="/danh-muc/$slug"
                    params={{ slug: n.slug }}
                    onClick={() => setMobile(false)}
                    className={`flex-1 py-4 text-sm font-medium uppercase tracking-widest ${n.slug === "sale" ? "text-sale" : "text-foreground"}`}
                  >
                    {n.label}
                  </Link>
                  {n.children?.length ? (
                    <button
                      type="button"
                      aria-label={`${mobileOpenCategory === n.slug ? "Thu gọn" : "Mở rộng"} ${n.label}`}
                      aria-expanded={mobileOpenCategory === n.slug}
                      aria-controls={`mobile-category-${n.slug}`}
                      className="grid size-10 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setMobileOpenCategory((current) => current === n.slug ? null : n.slug)}
                    >
                      <ChevronDown className={`size-4 transition-transform duration-300 ease-in-out ${mobileOpenCategory === n.slug ? "rotate-180" : ""}`} />
                    </button>
                  ) : null}
                </div>
                {n.children?.length ? (
                  <div
                    id={`mobile-category-${n.slug}`}
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${mobileOpenCategory === n.slug ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="mb-3 ml-1 flex flex-col border-l border-border pl-4">
                        {n.children.map((ch) => (
                          <Link
                            key={ch.slug}
                            to="/danh-muc/$slug"
                            params={{ slug: ch.slug }}
                            onClick={() => setMobile(false)}
                            className="py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {ch.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            <div className="py-2 border-b border-border/40">
              <Link
                to="/lookbook"
                search={{ collection: undefined }}
                onClick={() => setMobile(false)}
                className="py-2 text-sm font-medium uppercase tracking-wider text-foreground flex items-center justify-between"
              >
                <span>Lookbook Runway</span>
                <span className="text-[10px] font-mono text-primary font-normal">ARCHIVE</span>
              </Link>
              <div className="pl-3 space-y-2 pt-1 pb-2">
                <Link
                  to="/lookbook"
                  search={{ collection: undefined }}
                  onClick={() => setMobile(false)}
                  className="block text-xs text-muted-foreground hover:text-foreground"
                >
                  · Tất cả bộ ảnh (Thác ảnh)
                </Link>
                <Link
                  to="/lookbook"
                  search={{ collection: "autumn-winter-2026" }}
                  onClick={() => setMobile(false)}
                  className="block text-xs text-muted-foreground hover:text-foreground"
                >
                  · Thu Đông 2026
                </Link>
                <Link
                  to="/lookbook"
                  search={{ collection: "la-parisienne" }}
                  onClick={() => setMobile(false)}
                  className="block text-xs text-muted-foreground hover:text-foreground"
                >
                  · La Parisienne
                </Link>
                <Link
                  to="/lookbook"
                  search={{ collection: "the-office-edit" }}
                  onClick={() => setMobile(false)}
                  className="block text-xs text-muted-foreground hover:text-foreground"
                >
                  · The Office Edit
                </Link>
                <Link
                  to="/lookbook"
                  search={{ collection: "evening-noir" }}
                  onClick={() => setMobile(false)}
                  className="block text-xs text-muted-foreground hover:text-foreground"
                >
                  · Evening Noir
                </Link>
              </div>
            </div>
            {([["/bo-suu-tap", "Bộ sưu tập"], ["/blog", "Tạp chí"], ["/tai-khoan", "Tài khoản"], ["/yeu-thich", "Yêu thích"], ["/cua-hang", "Cửa hàng"], ["/gioi-thieu", "Về chúng tôi"], ["/lien-he", "Liên hệ"]] as const).map(([to, l]) => (
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
  const [mounted, setMounted] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    const query = q.trim();
    setResults([]);
    setSearchFailed(false);
    if (!open || !query) {
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetchProducts({ q: query, limit: "6", page: "1" });
        if (!cancelled) setResults((response.items ?? []).map(mapApiProduct));
      } catch (error) {
        console.error("Product search failed:", error);
        if (!cancelled) {
          setResults([]);
          setSearchFailed(true);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, q]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-background text-foreground overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="mx-auto max-w-4xl px-6 pt-10 pb-16">
        <div className="flex items-center gap-4 border-b border-foreground pb-3">
          <Search className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          <form
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) {
                onClose();
                navigate({ to: "/tim-kiem", search: { q } });
              }
            }}
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm kiếm sản phẩm..."
              className="w-full bg-transparent font-serif text-xl outline-none md:text-2xl placeholder:text-muted-foreground"
            />
          </form>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="p-1 hover:opacity-70 transition-opacity cursor-pointer"
          >
            <X className="h-6 w-6" strokeWidth={1.5} />
          </button>
        </div>
        {!q && (
          <div className="mt-8">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Tìm kiếm phổ biến</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Đầm lụa", "Blazer", "Set tweed", "Quần linen", "Chân váy xếp ly"].map((t) => (
                <button
                  key={t}
                  onClick={() => setQ(t)}
                  className="border border-border px-4 py-2 text-sm hover:border-foreground transition-colors cursor-pointer"
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-8 text-[11px] uppercase tracking-widest text-muted-foreground">Danh mục</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  to="/danh-muc/$slug"
                  params={{ slug: c.slug }}
                  onClick={onClose}
                  className="underline-offset-4 hover:underline"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
        {q && (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            {isSearching && (
              <p className="col-span-full text-muted-foreground">Đang tìm sản phẩm...</p>
            )}
            {!isSearching && searchFailed && (
              <p className="col-span-full text-muted-foreground">
                Không thể tải kết quả tìm kiếm. Vui lòng thử lại.
              </p>
            )}
            {!isSearching && !searchFailed && results.length === 0 && (
              <p className="col-span-full text-muted-foreground">Không tìm thấy sản phẩm cho "{q}".</p>
            )}
            {!isSearching && results.map((p) => (
              <Link
                key={p.id}
                to="/san-pham/$slug"
                params={{ slug: p.slug }}
                onClick={onClose}
                className="flex gap-3 p-2 rounded-sm hover:bg-secondary/50 transition-colors"
              >
                <img
                  src={p.images[0]}
                  alt={p.name}
                  className="h-24 w-18 object-cover bg-secondary shrink-0"
                />
                <div className="text-sm">
                  <p className="line-clamp-2 min-h-[2.6em] font-serif text-[16px] font-medium leading-[1.3] tracking-[-0.015em] text-foreground transition-opacity hover:opacity-70">{p.name}</p>
                  <p className="mt-1 text-muted-foreground">{formatVND(p.salePrice ?? p.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function MiniCart() {
  const { cart, cartOpen, setCartOpen, subtotal, updateQty, removeItem, storeSettings } = useStore();
  const freeShippingFrom = storeSettings.shipping.freeShippingFromVnd;
  const left = freeShippingFrom - subtotal;
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
              <div className="mt-2 h-0.5 bg-border"><div className="h-full bg-primary transition-all" style={{ width: `${freeShippingFrom > 0 ? Math.min(100, (subtotal / freeShippingFrom) * 100) : 100}%` }} /></div>
            </div>
            <ul className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              {cart.map((it, i) => {
                const p = products.find((x) => x.id === it.productId);
                const itemImg = getCartItemImage(it, p);
                const itemName = p?.name ?? it.productName ?? "Sản phẩm";
                const itemPrice = (p ? (p.salePrice ?? p.price) : (it.unitPrice ?? 0)) * it.qty;
                const productSlug = p?.slug ?? it.productSlug;
                return (
                  <li key={i} className="flex gap-4">
                    {itemImg ? (
                      productSlug ? (
                        <Link to="/san-pham/$slug" params={{ slug: productSlug }} onClick={() => setCartOpen(false)} className="shrink-0">
                          <img src={itemImg} alt={itemName} className="h-28 w-21 object-cover" />
                        </Link>
                      ) : (
                        <img src={itemImg} alt={itemName} className="h-28 w-21 object-cover" />
                      )
                    ) : (
                      <div className="h-28 w-21 bg-secondary" />
                    )}
                    <div className="flex flex-1 flex-col text-sm">
                      {productSlug ? (
                        <Link to="/san-pham/$slug" params={{ slug: productSlug }} onClick={() => setCartOpen(false)} className="line-clamp-2 font-medium leading-snug transition-opacity hover:opacity-65" title={itemName}>
                          {itemName}
                        </Link>
                      ) : (
                        <p className="line-clamp-2 font-medium leading-snug" title={itemName}>{itemName}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{it.colorName ? `${it.colorName} · ` : ""}{it.sku} · Size {it.size}</p>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center border border-border">
                          <button className="p-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" onClick={() => updateQty(i, it.qty - 1)} aria-label="Giảm"><Minus className="h-3 w-3" /></button>
                          <span className="w-6 text-center text-xs font-medium">{it.qty}</span>
                          <button
                            className="p-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            disabled={it.qty >= (products.find((x) => x.id === it.productId)?.variants.find((x) => x.id === it.variantId)?.available ?? it.maxStock ?? 99)}
                            onClick={() => {
                              const maxAvail = products.find((x) => x.id === it.productId)?.variants.find((x) => x.id === it.variantId)?.available ?? it.maxStock ?? 99;
                              if (it.qty >= maxAvail) {
                                toast.error(`Kho chỉ còn tối đa ${maxAvail} sản phẩm`);
                                return;
                              }
                              updateQty(i, it.qty + 1);
                            }}
                            aria-label="Tăng"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span>{formatVND(itemPrice)}</span>
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
