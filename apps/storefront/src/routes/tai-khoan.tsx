// Thay toàn bộ nội dung file route /tai-khoan hiện tại bằng file này.
// Giữ các component và module @/ hiện có. Không cần thêm file CSS.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Clock,
  Heart,
  Package,
  Sparkles,
  ShoppingBag,
  Maximize2,
  Trash2,
  Loader2,
  ArrowRight,
  ArrowUpRight,
  UserRound,
  LogOut,
  LayoutDashboard,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { seo } from "@/components/site/PageHeader";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { ProductCard } from "@/components/site/ProductCard";
import { formatVND, products, fetchProductsByIds, type Product } from "@/lib/products";
import {
  deleteTryOnRecord,
  fetchUnifiedTryOnHistory,
  subscribeTryOnHistory,
} from "@/lib/tryon-history";
import { TryOnImageLightbox } from "@/components/tryon/TryOnImageLightbox";
export const Route = createFileRoute("/tai-khoan")({
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    orderId?: string;
    tab?: "overview" | "orders" | "tryon" | "profile" | "wishlist";
  } => {
    const res: {
      orderId?: string;
      tab?: "overview" | "orders" | "tryon" | "profile" | "wishlist";
    } = {};
    const oId = s["orderId"];
    const tabVal = s["tab"];
    if (typeof oId === "string" && oId.length > 0) res.orderId = oId;
    if (
      typeof tabVal === "string" &&
      ["overview", "orders", "tryon", "profile", "wishlist"].includes(tabVal)
    ) {
      res.tab = tabVal as "overview" | "orders" | "tryon" | "profile" | "wishlist";
    }
    return res;
  },
  head: () =>
    seo(
      "Tài khoản của tôi — ÉLANE",
      "Quản lý thông tin cá nhân, đơn hàng, danh sách yêu thích và lịch sử thử đồ AI tại ÉLANE.",
      [{ name: "robots", content: "noindex" }],
    ),
  component: Account,
});
type OrderFilter = "all" | "awaiting" | "processing" | "shipping" | "completed" | "cancelled";
interface TryOnDisplayItem {
  id: string;
  resultImageUrl: string;
  userPhotoUrl?: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    salePrice?: number | null;
    image?: string | null;
    size?: string | null;
    variantId?: string | null;
  };
}
function formatTryOnDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
function Account() {
  const {
    user,
    logout,
    orders,
    wishlist,
    sessionReady,
    refreshOrders,
    addToCart,
    setCartOpen,
  } = useStore();
  const search = Route.useSearch();
  const [tab, setTab] = useState<"overview" | "orders" | "tryon" | "profile" | "wishlist">(
    search.tab || "orders",
  );
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    search.orderId || null,
  );
  // Try-on history state
  const [tryOnHistory, setTryOnHistory] = useState<TryOnDisplayItem[]>([]);
  const [loadingTryOns, setLoadingTryOns] = useState(false);
  // Wishlist items state
  const [wishlistItems, setWishlistItems] = useState<Product[]>([]);
  const [loadingWishlist, setLoadingWishlist] = useState(false);
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<{
    imageUrl: string;
    originalUrl?: string | null | undefined;
    productName?: string | undefined;
    productPrice?: number | undefined;
    productSlug?: string | undefined;
  } | null>(null);
  // Load unified try-on data (Server API + LocalStorage)
  const loadTryOnData = useCallback(async () => {
    setLoadingTryOns(true);
    try {
      const items = await fetchUnifiedTryOnHistory(!!user);
      const displayItems: TryOnDisplayItem[] = items.map((item) => ({
        id: item.id,
        resultImageUrl: item.resultUrl,
        userPhotoUrl: item.userImageUrl ?? undefined,
        createdAt: item.createdAt,
        product: {
          id: item.productId,
          name: item.productName,
          slug: item.productSlug,
          price: item.productPrice,
          salePrice: item.productSalePrice,
          image: item.productImage,
          size: item.size,
          variantId: item.variantId,
        },
      }));
      setTryOnHistory(displayItems);
    } finally {
      setLoadingTryOns(false);
    }
  }, [user]);
  useEffect(() => {
    void loadTryOnData();
    const unsub = subscribeTryOnHistory(() => {
      void loadTryOnData();
    });
    return unsub;
  }, [loadTryOnData]);
  // Load wishlist products
  useEffect(() => {
    let active = true;
    if (wishlist.length === 0) {
      setWishlistItems([]);
      setLoadingWishlist(false);
      return;
    }
    setLoadingWishlist(true);
    fetchProductsByIds(wishlist)
      .then((prods) => {
        if (active) setWishlistItems(prods);
      })
      .finally(() => {
        if (active) setLoadingWishlist(false);
      });
    return () => {
      active = false;
    };
  }, [wishlist]);
  // Sync the active section and selected order when URL search changes.
  useEffect(() => {
    if (search.orderId) {
      setSelectedOrderId(search.orderId);
      setTab("orders");
    } else if (search.tab) {
      setTab(search.tab);
    }
  }, [search.orderId, search.tab]);
  // Always refresh orders on mount if user is logged in
  useEffect(() => {
    if (user) {
      void refreshOrders();
    }
  }, [user, refreshOrders]);
  // Refresh when returning to tab / window focus
  useEffect(() => {
    const handleSync = () => {
      if (document.visibilityState === "visible" && user) {
        void refreshOrders();
      }
    };
    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);
    return () => {
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
    };
  }, [user, refreshOrders]);
  // Real-time polling if any bank order is awaiting payment
  const hasAwaitingOrders = useMemo(() => {
    return orders.some((o) => o.paymentMethod === "bank" && o.paymentStatus === "awaiting");
  }, [orders]);
  useEffect(() => {
    if (!hasAwaitingOrders) return;
    const interval = setInterval(() => {
      void refreshOrders();
    }, 3000);
    return () => clearInterval(interval);
  }, [hasAwaitingOrders, refreshOrders]);
  const awaitingCount = useMemo(() => {
    return orders.filter(
      (o) => o.paymentMethod === "bank" && o.paymentStatus === "awaiting" && o.status === "pending",
    ).length;
  }, [orders]);
  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return orders;
    if (orderFilter === "awaiting") {
      return orders.filter(
        (o) => o.paymentMethod === "bank" && o.paymentStatus === "awaiting" && o.status === "pending",
      );
    }
    if (orderFilter === "processing") {
      return orders.filter((o) => o.status === "confirmed" || o.status === "processing");
    }
    if (orderFilter === "shipping") {
      return orders.filter((o) => o.status === "shipping");
    }
    if (orderFilter === "completed") {
      return orders.filter((o) => o.status === "completed");
    }
    if (orderFilter === "cancelled") {
      return orders.filter((o) => o.status === "cancelled");
    }
    return orders;
  }, [orders, orderFilter]);
  // Add tried product to cart
  const handleAddToCartItem = (item: TryOnDisplayItem) => {
    const p = products.find(
      (x) => x.id === item.product.id || x.slug === item.product.slug,
    );
    if (!p) {
      toast.error("Không tìm thấy thông tin chi tiết sản phẩm");
      return;
    }
    const variant =
      (item.product.variantId
        ? p.variants.find((v) => v.id === item.product.variantId)
        : null) ||
      (item.product.size
        ? p.variants.find(
          (v) => v.size.toLowerCase() === item.product.size?.toLowerCase(),
        )
        : null) ||
      p.variants[0];
    if (!variant) {
      toast.error("Sản phẩm tạm thời hết hàng");
      return;
    }
    addToCart(p, variant.id, 1);
    toast.success(`Đã thêm "${p.name}" (Size ${variant.size}) vào giỏ hàng`);
    setCartOpen(true);
  };
  // Delete try-on record
  const handleDeleteTryOn = async (id: string, imageUrl: string) => {
    await deleteTryOnRecord(id, imageUrl);
    setTryOnHistory((prev) =>
      prev.filter((x) => x.id !== id && x.resultImageUrl !== imageUrl),
    );
    toast.success("Đã xóa ảnh thử đồ khỏi danh sách");
  };
  if (!sessionReady) {
    return (
      <main className="flex min-h-[65vh] items-center justify-center bg-[#ffffff] px-5 text-[#171717]">
        <AccountLoadingState label="Đang tải thông tin tài khoản…" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-[75vh] items-center justify-center bg-[#ffffff] px-4 py-14 text-[#171717] sm:px-6">
        <div className="w-full max-w-lg rounded-3xl border border-[#e5e5e5] bg-white p-7 text-center shadow-[0_16px_60px_-32px_rgba(0,0,0,0.1)] sm:p-12">
          <span className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full bg-[#f2f2f2] text-[#111111]">
            <UserRound aria-hidden="true" className="h-7 w-7 stroke-[1.3]" />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#666666]">My ÉLANE</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight">Không gian của bạn.</h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-[#666666]">
            Đăng nhập để theo dõi đơn hàng, lưu những thiết kế yêu thích và khám phá phòng thử đồ AI của riêng bạn.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link to="/dang-nhap" className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 text-sm font-medium text-white transition-colors hover:bg-[#333333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
              Đăng nhập <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link to="/dang-ky" className="flex min-h-[52px] items-center justify-center rounded-xl border border-[#e5e5e5] px-5 text-sm font-medium text-[#111111] transition-colors hover:border-[#111111] hover:bg-[#f7f7f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
              Tạo tài khoản
            </Link>
          </div>
          <p className="mt-8 font-serif text-sm italic text-[#666666]">With love, ÉLANE.</p>
        </div>
      </main>
    );
  }

  const tabs: Array<{ id: typeof tab; label: string; Icon: LucideIcon; count?: number }> = [
    { id: "overview", label: "Tổng quan", Icon: LayoutDashboard },
    { id: "orders", label: "Đơn hàng của tôi", Icon: Package, count: orders.length },
    { id: "tryon", label: "Phòng thử đồ AI", Icon: Sparkles, count: tryOnHistory.length },
    { id: "wishlist", label: "Thiết kế yêu thích", Icon: Heart, count: wishlist.length },
    { id: "profile", label: "Thông tin cá nhân", Icon: UserRound },
  ];

  const filterTabs: Array<{ id: OrderFilter; label: string; count?: number }> = [
    { id: "all", label: "Tất cả", count: orders.length },
    { id: "awaiting", label: "Chờ thanh toán", count: awaitingCount },
    { id: "processing", label: "Đang xử lý", count: orders.filter((o) => o.status === "confirmed" || o.status === "processing").length },
    { id: "shipping", label: "Đang giao", count: orders.filter((o) => o.status === "shipping").length },
    { id: "completed", label: "Hoàn tất", count: orders.filter((o) => o.status === "completed").length },
    { id: "cancelled", label: "Đã hủy", count: orders.filter((o) => o.status === "cancelled").length },
  ];

  const openTryOnImage = (item: TryOnDisplayItem) => {
    setLightboxItem({
      imageUrl: item.resultImageUrl,
      originalUrl: item.userPhotoUrl,
      productName: item.product.name,
      productPrice: item.product.salePrice ?? item.product.price,
      productSlug: item.product.slug,
    });
    setLightboxOpen(true);
  };

  const initial = user.name?.trim().charAt(0).toUpperCase() || "É";

  return (
    <main className="min-h-screen bg-[#ffffff] px-4 py-8 text-[#171717] sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Personal welcome */}
        <header className="mb-7 flex flex-col gap-6 border-b border-[#e5e5e5] pb-7 sm:mb-9 sm:pb-9 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#666666] sm:text-xs">My ÉLANE · Không gian của bạn</p>
            <h1 className="break-words font-serif text-4xl leading-[1.2] tracking-tight sm:text-5xl">
              Xin chào, <span className="italic text-[#111111]">{user.name}.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[#666666]">Những lựa chọn yêu thích, những trải nghiệm dành riêng cho bạn.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:shrink-0">
            <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-5 text-xs font-medium text-[#111111] transition-colors hover:border-[#111111] hover:bg-[#f7f7f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
              Khám phá hàng mới <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => void logout()} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 text-xs font-medium text-[#666666] transition-colors hover:bg-[#eeeeee] hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
              <LogOut aria-hidden="true" className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
          {/* Sidebar; horizontal navigation on mobile */}
          <aside className="min-w-0 lg:sticky lg:top-[calc(var(--header-height,148px)+24px)]">
            <div className="rounded-3xl border border-[#e5e5e5] bg-white p-3 sm:p-4 font-sans">
              <div className="hidden items-center gap-3 border-b border-[#ededed] px-2 pb-5 pt-2 lg:flex">
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] font-serif text-xl text-[#111111]">{initial}</span>
                <div className="min-w-0">
                  <p className="truncate font-sans text-sm font-semibold tracking-tight text-[#111111]" title={user.name}>{user.name}</p>
                  <p className="mt-0.5 truncate font-sans text-xs text-[#666666]" title={user.email}>{user.email}</p>
                </div>
              </div>
              <nav aria-label="Khu vực tài khoản" className="flex gap-2 overflow-x-auto overscroll-x-contain py-1 lg:mt-3 lg:flex-col lg:overflow-visible lg:py-0">
                {tabs.map(({ id, label, Icon, count }) => {
                  const active = tab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={active}
                      aria-controls="account-panel"
                      onClick={() => setTab(id)}
                      className={`flex min-h-[48px] shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left font-sans text-xs font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-inset lg:w-full ${active ? "bg-[#111111] text-white" : "text-[#666666] hover:bg-[#f7f7f7] hover:text-[#111111]"}`}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 stroke-[1.6]" />
                      <span className="whitespace-nowrap font-sans">{label}</span>
                      {typeof count === "number" && count > 0 && <span className={`ml-auto rounded-full px-2 py-0.5 font-sans text-[10px] font-medium tabular-nums ${active ? "bg-white/15 text-white" : "bg-[#f2f2f2] text-[#666666]"}`}>{count}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="relative mt-5 hidden overflow-hidden rounded-3xl bg-[#f2f2f2] p-6 lg:block">
              <div aria-hidden="true" className="absolute -right-7 -top-8 h-32 w-32 rounded-full border border-white/50" />
              <Heart aria-hidden="true" className="relative mb-4 h-5 w-5 stroke-[1.4] text-[#111111]" />
              <p className="relative font-serif text-xl leading-7 text-[#171717]">Phong cách của bạn,<br /><span className="italic">dấu ấn riêng của bạn.</span></p>
              <p className="relative mt-3 text-xs leading-6 text-[#666666]">Lưu lại những thiết kế khiến bạn cảm thấy tự tin và là chính mình.</p>
              <button type="button" onClick={() => setTab("wishlist")} className="relative mt-5 inline-flex min-h-[44px] items-center gap-2 text-xs font-medium text-[#111111] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
                Xem thiết kế đã lưu <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          </aside>

          <section id="account-panel" aria-labelledby="account-panel-heading" className="min-w-0">
            {/* Orders */}
            {tab === "orders" && (
              <div className="space-y-5">
                <div className="rounded-3xl border border-[#e5e5e5] bg-white p-5 sm:p-7">
                  <AccountSectionHeading eyebrow="Từng lựa chọn được nâng niu" title="Đơn hàng của bạn" description="Theo dõi và quản lý những thiết kế bạn đã chọn." count={`${orders.length} đơn hàng`} />
                  {awaitingCount > 0 && (
                    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#dddddd] bg-[#f5f5f5] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#555555]" />
                        <div>
                          <p className="text-xs font-medium text-[#333333]">Bạn có {awaitingCount} đơn hàng chờ thanh toán VietQR</p>
                          <p className="mt-1 text-xs leading-5 text-[#666666]">Mở chi tiết đơn hàng để xem thông tin thanh toán.</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setOrderFilter("awaiting")} className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-medium text-[#333333] transition-colors hover:bg-[#eeeeee] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#555555]">
                        Xem đơn hàng <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div aria-label="Lọc đơn hàng" className="mt-6 flex gap-2 overflow-x-auto overscroll-x-contain border-t border-[#ededed] pt-5 pb-1 font-sans">
                    {filterTabs.map((filter) => (
                      <button key={filter.id} type="button" aria-pressed={orderFilter === filter.id} onClick={() => setOrderFilter(filter.id)} className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 font-sans text-xs font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-inset ${orderFilter === filter.id ? "border-[#e5e5e5] bg-[#f2f2f2] text-[#111111]" : "border-[#ededed] bg-white text-[#666666] hover:border-[#bdbdbd] hover:text-[#111111]"}`}>
                        <span className="font-sans">{filter.label}</span>
                        <span className={`rounded-full px-1.5 py-0.5 font-sans text-[10px] tabular-nums ${orderFilter === filter.id ? "bg-white text-[#111111]" : "bg-[#ffffff] text-[#666666]"}`}>{filter.count ?? 0}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {filteredOrders.length === 0 ? (
                  <AccountEmptyState icon={Package} title="Chưa có đơn hàng trong mục này" description={orderFilter === "awaiting" ? "Bạn không có đơn nào đang chờ thanh toán. Cùng khám phá những thiết kế mới nhé." : "Những thiết kế yêu thích đang chờ bạn. Khám phá bộ sưu tập mới nhất của ÉLANE."} actionLabel="Khám phá bộ sưu tập" />
                ) : (
                  <div className="space-y-4 [&>*]:rounded-3xl [&>*]:border-[#e5e5e5] [&>*]:bg-white [&>*]:shadow-none">
                    {filteredOrders.map((order) => <OrderCard key={order.id} order={order} onViewDetail={(id) => setSelectedOrderId(id)} onOrderUpdated={() => void refreshOrders()} />)}
                  </div>
                )}
              </div>
            )}

            {/* Virtual try-on gallery */}
            {tab === "tryon" && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-[#e5e5e5] bg-white p-5 sm:p-7">
                  <AccountSectionHeading eyebrow="ÉLANE Virtual Atelier" title="Phòng thử đồ của bạn" description="Một nơi để thử, để yêu và để tìm thấy phong cách riêng." count={`${tryOnHistory.length} lần thử`} actionLabel="Thử thiết kế mới" />
                </div>
                {loadingTryOns ? <AccountLoadingState label="Đang tải phòng thử đồ…" /> : tryOnHistory.length === 0 ? (
                  <AccountEmptyState icon={Sparkles} title="Diện mạo mới đang chờ bạn" description="Chọn một thiết kế và sử dụng tính năng “Thử đồ ảo AI” để bắt đầu lưu những diện mạo yêu thích." actionLabel="Khám phá thiết kế" />
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {tryOnHistory.map((item) => (
                      <article key={item.id} className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white">
                        <button type="button" onClick={() => openTryOnImage(item)} aria-label={`Xem ảnh thử đồ: ${item.product.name}`} className="relative block aspect-[3/4] w-full shrink-0 cursor-zoom-in overflow-hidden bg-[#f0f0f0] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-inset">
                          <img src={item.resultImageUrl} alt={`Thử đồ: ${item.product.name}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none" />
                          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-medium text-[#111111] shadow-sm backdrop-blur-sm">
                            <Sparkles aria-hidden="true" className="h-3 w-3" /> AI Try-On
                          </span>
                          <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#111111] shadow-sm transition-colors group-hover:bg-[#111111] group-hover:text-white">
                            <Maximize2 aria-hidden="true" className="h-4 w-4" />
                          </span>
                          {item.userPhotoUrl && <span className="absolute bottom-3 left-3 block h-14 w-11 overflow-hidden rounded-lg border-2 border-white bg-[#f0f0f0] shadow-sm"><img src={item.userPhotoUrl} alt="Ảnh gốc của bạn" loading="lazy" className="h-full w-full object-cover" /></span>}
                        </button>
                        <div className="flex flex-1 flex-col p-4 sm:p-5">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#666666]">
                            <span className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="h-3 w-3" />{formatTryOnDate(item.createdAt)}</span>
                            {item.product.size && <span className="rounded-md bg-[#f7f7f7] px-2 py-1 font-medium text-[#666666]">Size {item.product.size}</span>}
                          </div>
                          <Link to="/san-pham/$slug" params={{ slug: item.product.slug }} title={item.product.name} className="line-clamp-2 font-serif text-lg leading-6 transition-colors hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]">
                            {item.product.name}
                          </Link>
                          <p className="mt-2 text-sm font-semibold tabular-nums text-[#111111]">{formatVND(item.product.salePrice ?? item.product.price)}</p>
                          <div className="mt-auto pt-4">
                            <div className="flex items-center gap-2 border-t border-[#ededed] pt-4">
                              <button type="button" onClick={() => handleAddToCartItem(item)} className="inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#111111] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#333333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
                                <ShoppingBag aria-hidden="true" className="h-4 w-4 shrink-0" />Thêm vào giỏ
                              </button>
                              <button type="button" onClick={() => void handleDeleteTryOn(item.id, item.resultImageUrl)} title="Xóa khỏi lịch sử" aria-label={`Xóa ảnh thử đồ: ${item.product.name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#ededed] text-[#666666] transition-colors hover:border-[#bdbdbd] hover:bg-[#f7f7f7] hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]">
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </button>
                            </div>
                            <Link to="/san-pham/$slug" params={{ slug: item.product.slug }} className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[#666666] hover:text-[#111111] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]">
                              Xem thiết kế <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Wishlist */}
            {tab === "wishlist" && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-[#e5e5e5] bg-white p-5 sm:p-7">
                  <AccountSectionHeading eyebrow="Những thiết kế khiến bạn rung động" title="Danh sách yêu thích" description="Lưu lại hôm nay, tìm thấy cảm hứng cho những ngày sắp tới." count={`${wishlist.length} thiết kế`} actionLabel="Khám phá hàng mới" />
                </div>
                {loadingWishlist ? <AccountLoadingState label="Đang tải danh sách yêu thích…" /> : wishlistItems.length === 0 ? (
                  <AccountEmptyState icon={Heart} title="Dành chỗ cho những điều bạn yêu" description="Chạm vào biểu tượng trái tim khi khám phá sản phẩm để lưu những thiết kế yêu thích tại đây." actionLabel="Tìm thiết kế yêu thích" />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                    {wishlistItems.map((product) => <div key={product.id} className="min-w-0 overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white p-2.5 sm:rounded-3xl sm:p-4"><ProductCard product={product} /></div>)}
                  </div>
                )}
              </div>
            )}

            {/* Overview */}
            {tab === "overview" && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-[#e5e5e5] bg-white p-5 sm:p-7">
                  <AccountSectionHeading eyebrow="Mọi điều bạn yêu, ở cùng một nơi" title="Tổng quan của bạn" description="Một góc nhỏ để theo dõi hành trình mua sắm cùng ÉLANE." />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                  {[
                    { label: "Tổng đơn hàng", value: orders.length, Icon: Package, onClick: () => { setOrderFilter("all"); setTab("orders"); } },
                    { label: "Chờ thanh toán", value: awaitingCount, Icon: Clock, onClick: () => { setOrderFilter("awaiting"); setTab("orders"); } },
                    { label: "Thiết kế yêu thích", value: wishlist.length, Icon: Heart, onClick: () => setTab("wishlist") },
                    { label: "Lần thử đồ AI", value: tryOnHistory.length, Icon: Sparkles, onClick: () => setTab("tryon") },
                  ].map(({ label, value, Icon, onClick }) => (
                    <button key={label} type="button" onClick={onClick} className="group rounded-2xl border border-[#e5e5e5] bg-white p-4 text-left transition-colors hover:border-[#bdbdbd] hover:bg-[#fafafa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 sm:p-5">
                      <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f2f2] text-[#111111]"><Icon aria-hidden="true" className="h-4 w-4 stroke-[1.5]" /></span>
                      <p className="font-serif text-4xl tabular-nums text-[#111111]">{value}</p>
                      <p className="mt-2 text-[11px] text-[#666666]">{label}</p>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-medium text-[#666666]">Xem chi tiết <ArrowUpRight aria-hidden="true" className="h-3 w-3" /></span>
                    </button>
                  ))}
                </div>

                {orders.length > 0 && (
                  <div className="rounded-3xl border border-[#e5e5e5] bg-white p-5 sm:p-7">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-serif text-2xl">Đơn hàng gần nhất</h3>
                      <button type="button" onClick={() => { setOrderFilter("all"); setTab("orders"); }} className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[#111111] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]">Xem tất cả <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="[&>*]:rounded-2xl [&>*]:border-[#ededed] [&>*]:bg-white [&>*]:shadow-none">
                      <OrderCard order={orders[0]!} onViewDetail={(id) => setSelectedOrderId(id)} onOrderUpdated={() => void refreshOrders()} />
                    </div>
                  </div>
                )}

                {tryOnHistory.length > 0 && (
                  <div className="rounded-3xl border border-[#e5e5e5] bg-white p-5 sm:p-7">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div><p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#666666]">Virtual Atelier</p><h3 className="font-serif text-2xl">Những lần thử gần đây</h3></div>
                      <button type="button" onClick={() => setTab("tryon")} className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[#111111] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]">Xem tất cả <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {tryOnHistory.slice(0, 4).map((item) => (
                        <button key={item.id} type="button" onClick={() => openTryOnImage(item)} aria-label={`Xem ảnh thử đồ: ${item.product.name}`} className="group overflow-hidden rounded-2xl border border-[#ededed] bg-[#ffffff] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
                          <div className="relative aspect-[3/4] overflow-hidden"><img src={item.resultImageUrl} alt={item.product.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none" /><span className="absolute bottom-2 right-2 rounded-full bg-white/95 p-2 text-[#111111]"><Maximize2 aria-hidden="true" className="h-3 w-3" /></span></div>
                          <div className="p-3"><p className="line-clamp-2 text-xs leading-5" title={item.product.name}>{item.product.name}</p><p className="mt-1.5 text-[11px] font-medium tabular-nums text-[#111111]">{formatVND(item.product.salePrice ?? item.product.price)}</p></div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {loadingTryOns && <AccountLoadingState label="Đang tải những lần thử gần đây…" />}
                {orders.length === 0 && tryOnHistory.length === 0 && !loadingTryOns && <AccountEmptyState icon={ShoppingBag} title="Bắt đầu hành trình cùng ÉLANE" description="Khám phá bộ sưu tập, thử một diện mạo mới và lưu lại những thiết kế yêu thích." actionLabel="Khám phá ngay" />}
              </div>
            )}

            {/* Personal information */}
            {tab === "profile" && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-[#e5e5e5] bg-white p-5 sm:p-7"><AccountSectionHeading eyebrow="Dành riêng cho bạn" title="Thông tin cá nhân" description="Thông tin tài khoản để ÉLANE đồng hành cùng bạn chu đáo hơn." /></div>
                <div className="overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white">
                  <div className="flex flex-wrap items-center gap-4 bg-[#f2f2f2] p-5 sm:p-7">
                    <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white/80 bg-[#e5e5e5] font-serif text-2xl text-[#111111]">{initial}</span>
                    <div className="min-w-0 flex-1"><p className="break-words font-serif text-2xl text-[#171717]">{user.name}</p><p className="mt-1 text-xs text-[#666666]">Tài khoản ÉLANE của bạn</p></div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 text-[11px] font-medium text-[#333333]"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />Đã đăng nhập</span>
                  </div>
                  <dl className="divide-y divide-[#ededed] px-5 sm:px-7">
                    {[
                      { label: "Họ và tên", value: user.name },
                      { label: "Địa chỉ email", value: user.email },
                      { label: "Số điện thoại", value: user.phone || "Chưa cập nhật" },
                    ].map(({ label, value }) => (
                      <div key={label} className="grid gap-2 py-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-5 sm:py-6"><dt className="text-xs leading-6 text-[#666666]">{label}</dt><dd className="break-words text-sm font-medium leading-6">{value}</dd></div>
                    ))}
                  </dl>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-[#e5e5e5] bg-[#f7f7f7] p-5">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 stroke-[1.5] text-[#666666]" />
                  <p className="text-xs leading-6 text-[#666666]">Thông tin này được sử dụng để cá nhân hóa trải nghiệm mua sắm và hỗ trợ đơn hàng của bạn tại ÉLANE.</p>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-[#e5e5e5] pt-6 text-center sm:mt-14 sm:flex-row sm:text-left">
          <p className="text-[11px] text-[#666666]">ÉLANE · Nâng niu phong cách riêng của bạn.</p>
          <p className="font-serif text-sm italic text-[#666666]">With love, ÉLANE.</p>
        </footer>
      </div>

      {/* Existing order detail and try-on modals */}
      {selectedOrderId && <OrderDetailModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} onOrderUpdated={() => void refreshOrders()} />}
      <TryOnImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={lightboxItem?.imageUrl ?? ""}
        originalUrl={lightboxItem?.originalUrl}
        productName={lightboxItem?.productName ?? ""}
        productPrice={lightboxItem?.productPrice ?? 0}
        productSlug={lightboxItem?.productSlug}
        onAddToCart={lightboxItem ? () => {
          const matched = tryOnHistory.find((item) => item.resultImageUrl === lightboxItem.imageUrl);
          if (matched) handleAddToCartItem(matched);
        } : undefined}
      />
    </main>
  );
}

// Small UI helpers stay in this TSX file; all styling uses Tailwind.
function AccountSectionHeading({ eyebrow, title, description, count, actionLabel }: {
  eyebrow: string;
  title: string;
  description: string;
  count?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#666666]">{eyebrow}</p>
        <h2 id="account-panel-heading" className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h2>
        <p className="mt-3 max-w-lg text-xs leading-6 text-[#666666] sm:text-sm">{description}</p>
      </div>
      {(count || actionLabel) && <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
        {count && <span className="rounded-full bg-[#f7f7f7] px-3 py-1.5 text-[11px] font-medium tabular-nums text-[#666666]">{count}</span>}
        {actionLabel && <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-[#111111] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]">{actionLabel}<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>}
      </div>}
    </div>
  );
}

function AccountLoadingState({ label }: { label: string }) {
  return (
    <div role="status" className="rounded-3xl border border-[#e5e5e5] bg-white px-6 py-16 text-center">
      <Loader2 aria-hidden="true" className="mx-auto h-7 w-7 animate-spin text-[#111111] motion-reduce:animate-none" />
      <p className="mt-4 text-xs leading-6 text-[#666666]">{label}</p>
    </div>
  );
}

function AccountEmptyState({ icon: Icon, title, description, actionLabel }: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-[#e5e5e5] bg-white px-5 py-12 text-center sm:px-8 sm:py-16">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f2f2f2] ring-8 ring-[#fafafa]"><Icon aria-hidden="true" className="h-8 w-8 stroke-[1.2] text-[#666666]" /></span>
      <h3 className="mt-7 font-serif text-2xl leading-tight sm:text-3xl">{title}</h3>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#666666]">{description}</p>
      <Link to="/danh-muc/$slug" params={{ slug: "hang-moi" }} className="mt-7 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#111111] px-6 py-3 text-xs font-medium text-white transition-colors hover:bg-[#333333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
        {actionLabel}<ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </div>
  );
}
