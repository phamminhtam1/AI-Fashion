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
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { btnCls, seo } from "@/components/site/PageHeader";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { OrderPaymentModal } from "@/components/orders/OrderPaymentModal";
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
  const [payingOrder, setPayingOrder] = useState<{
    id: string;
    order_number: string;
    grand_total_vnd: number;
  } | null>(null);

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

  // Sync selectedOrderId if search param changes
  useEffect(() => {
    if (search.orderId) {
      setSelectedOrderId(search.orderId);
      setTab("orders");
    }
  }, [search.orderId]);

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
      <div className="py-32 text-center space-y-3">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Đang tải thông tin tài khoản…
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-28 text-center">
        <span className="font-serif text-3xl font-medium italic tracking-wider text-foreground">É L A N E</span>
        <h1 className="mt-4 font-serif text-4xl font-medium tracking-tight text-foreground">Tài khoản</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-foreground/80">
          Đăng nhập để xem đơn hàng, lịch sử thử đồ AI và quyền lợi thành viên.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/dang-nhap" className={btnCls}>
            Đăng nhập
          </Link>
          <Link
            to="/dang-ky"
            className="border border-foreground px-10 py-4 text-xs font-semibold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
          >
            Đăng ký
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    [
      "orders",
      `Đơn hàng của tôi ${awaitingCount > 0 ? `(${awaitingCount} cần thanh toán)` : ""}`,
    ],
    [
      "tryon",
      `Phòng thử đồ AI ${tryOnHistory.length > 0 ? `(${tryOnHistory.length})` : ""}`,
    ],
    [
      "wishlist",
      `Yêu thích ${wishlist.length > 0 ? `(${wishlist.length})` : ""}`,
    ],
    ["overview", "Tổng quan"],
    ["profile", "Thông tin cá nhân"],
  ] as const;

  const filterTabs: Array<{ id: OrderFilter; label: string; count?: number }> = [
    { id: "all", label: "Tất cả", count: orders.length },
    {
      id: "awaiting",
      label: "Chờ thanh toán VietQR",
      count: awaitingCount,
    },
    {
      id: "processing",
      label: "Đang xử lý",
      count: orders.filter((o) => o.status === "confirmed" || o.status === "processing").length,
    },
    {
      id: "shipping",
      label: "Đang giao",
      count: orders.filter((o) => o.status === "shipping").length,
    },
    {
      id: "completed",
      label: "Hoàn tất",
      count: orders.filter((o) => o.status === "completed").length,
    },
    {
      id: "cancelled",
      label: "Đã hủy",
      count: orders.filter((o) => o.status === "cancelled").length,
    },
  ];

  return (
    <div className="mx-auto max-w-[1380px] px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
      {/* ÉLANE Private Client header */}
      <header className="border-b border-border/60 pb-8 lg:pb-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground/80">
              ÉLANE / Private Client
            </p>
            <h1 className="max-w-3xl font-serif text-[38px] font-medium leading-[0.98] tracking-[-0.035em] sm:text-[48px] lg:text-[58px] text-foreground">
              Xin chào, <span className="italic"> {user.name}.</span>
            </h1>
            <p className="mt-5 max-w-md text-[13px] font-medium leading-6 text-foreground/75">
              Quản lý đơn hàng, những thiết kế bạn yêu thích và trải nghiệm thử đồ ảo
              của riêng bạn.
            </p>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/75">
                Membership
              </p>
              <p className="mt-1 font-serif text-[17px] font-medium text-foreground">Silver Member</p>
            </div>

            <span className="hidden h-8 w-px bg-border sm:block" />

            <button
              type="button"
              onClick={() => void logout()}
              className="group inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/80 transition-colors hover:text-foreground"
            >
              <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-foreground">
                Đăng xuất
              </span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-10 lg:mt-12 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-16">
        {/* Editorial navigation without 01 02 03 04 05 */}
        <aside
          className="overflow-x-auto border-b border-border/60 pb-4 lg:sticky lg:self-start lg:overflow-visible lg:border-b-0 lg:pb-0"
          style={{ top: "calc(var(--header-height, 148px) + 24px)" }}
        >
          <nav className="flex min-w-max gap-7 lg:min-w-0 lg:flex-col lg:gap-0">
            {tabs.map(([k, l]) => {
              const isActive = tab === k;

              return (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setTab(k as "overview" | "orders" | "tryon" | "profile" | "wishlist")
                  }
                  className={`group relative flex cursor-pointer items-center gap-3 py-3 text-left transition-all duration-300 lg:w-full lg:border-b lg:border-border/50 lg:py-4 ${isActive
                    ? "text-foreground"
                    : "text-foreground/75 hover:text-foreground"
                    }`}
                >
                  <span
                    className={`text-xs uppercase tracking-[0.14em] transition-all duration-300 ${isActive
                      ? "font-bold text-foreground"
                      : "font-semibold text-foreground/75 group-hover:translate-x-1"
                      }`}
                  >
                    {l}
                  </span>

                  {isActive && (
                    <span className="absolute bottom-[-1px] left-0 hidden h-[1.5px] w-12 bg-foreground lg:block" />
                  )}

                  {k === "orders" && awaitingCount > 0 && (
                    <span className="ml-auto hidden size-1.5 rounded-full bg-amber-500 lg:block" />
                  )}

                  {k === "tryon" && tryOnHistory.length > 0 && (
                    <span className="ml-auto hidden text-[10px] font-bold tabular-nums text-foreground/75 lg:block">
                      {tryOnHistory.length}
                    </span>
                  )}

                  {k === "wishlist" && wishlist.length > 0 && (
                    <span className="ml-auto hidden text-[10px] font-bold tabular-nums text-foreground/75 lg:block">
                      {wishlist.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-10 hidden lg:block">
            <div className="border-t border-border/60 pt-5">
              <Sparkles className="mb-3 size-3.5 stroke-[1.4] text-foreground/80" />
              <p className="font-serif text-[16px] font-medium text-foreground">Silver Member</p>
              <p className="mt-1 text-[11px] font-medium leading-5 text-foreground/75">
                Thành viên ÉLANE với những trải nghiệm được cá nhân hóa.
              </p>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          {/* ORDERS */}
          {tab === "orders" && (
            <div className="space-y-7">
              <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/75">
                    Purchase archive
                  </p>
                  <h2 className="font-serif text-[30px] font-medium tracking-[-0.025em] text-foreground sm:text-[36px]">
                    Đơn hàng của bạn
                  </h2>
                </div>
                <p className="text-[12px] font-semibold text-foreground/75">
                  {orders.length} đơn hàng
                </p>
              </div>

              <div
                className="sticky z-10 flex items-center gap-7 overflow-x-auto border-b border-border/60 bg-background/95 py-1 backdrop-blur-md no-scrollbar"
                style={{ top: "var(--header-height, 148px)" }}
              >
                {filterTabs.map((f) => {
                  const isActive = orderFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setOrderFilter(f.id)}
                      className={`group relative shrink-0 cursor-pointer py-4 text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 ${isActive
                        ? "font-bold text-foreground"
                        : "font-semibold text-foreground/75 hover:text-foreground"
                        }`}
                    >
                      <span>{f.label}</span>
                      {typeof f.count === "number" && f.count > 0 && (
                        <sup
                          className={`ml-1.5 text-[9px] font-bold tabular-nums ${f.id === "awaiting" && f.count > 0
                            ? "text-amber-600"
                            : "text-foreground/60"
                            }`}
                        >
                          {f.count}
                        </sup>
                      )}
                      <span
                        className={`absolute bottom-0 left-0 h-[1.5px] bg-foreground transition-all duration-300 ${isActive ? "w-full" : "w-0 group-hover:w-full"
                          }`}
                      />
                    </button>
                  );
                })}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="py-20 text-center">
                  <Package className="mx-auto h-10 w-10 stroke-[1.2] text-foreground/60" />
                  <h3 className="mt-5 font-serif text-xl font-medium text-foreground">
                    Chưa có đơn hàng trong mục này
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-[13px] font-medium leading-6 text-foreground/75">
                    {orderFilter === "awaiting"
                      ? "Bạn không có đơn nào đang chờ thanh toán."
                      : "Khám phá những thiết kế mới nhất của ÉLANE."}
                  </p>
                  <Link
                    to="/danh-muc/$slug"
                    params={{ slug: "hang-moi" }}
                    className="group mt-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]"
                  >
                    <span className="border-b border-foreground pb-1">
                      Khám phá bộ sưu tập
                    </span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onViewDetail={(id) => setSelectedOrderId(id)}
                      onPayNow={(order) => setPayingOrder(order)}
                      onOrderUpdated={() => void refreshOrders()}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIRTUAL TRY-ON */}
          {tab === "tryon" && (
            <div className="space-y-8">
              <div className="flex flex-col gap-5 border-b border-border/60 pb-7 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/75">
                    ÉLANE Virtual Atelier
                  </p>
                  <h2 className="font-serif text-[30px] font-medium tracking-[-0.025em] text-foreground sm:text-[36px]">
                    Phòng thử đồ của bạn
                  </h2>
                  <p className="mt-2 max-w-lg text-[13px] font-medium leading-6 text-foreground/75">
                    Những thiết kế bạn đã trải nghiệm với công nghệ thử đồ ảo ÉLANE.
                  </p>
                </div>

                <div className="flex items-center gap-5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/75">
                    {tryOnHistory.length} looks
                  </span>
                  <Link
                    to="/danh-muc/$slug"
                    params={{ slug: "hang-moi" }}
                    className="group inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em]"
                  >
                    <span className="border-b border-foreground pb-1">
                      Thử thiết kế mới
                    </span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </div>
              </div>

              {loadingTryOns ? (
                <div className="py-20 text-center">
                  <div className="mx-auto size-7 animate-spin rounded-full border border-foreground border-t-transparent" />
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/75">
                    Đang tải phòng thử đồ
                  </p>
                </div>
              ) : tryOnHistory.length === 0 ? (
                <div className="py-20 text-center">
                  <Sparkles className="mx-auto size-9 stroke-[1.2] text-foreground/70" />
                  <h3 className="mt-5 font-serif text-xl font-medium text-foreground">
                    Phòng thử đồ vẫn đang trống
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-[13px] font-medium leading-6 text-foreground/75">
                    Chọn một thiết kế bất kỳ và sử dụng tính năng “Thử đồ ảo AI”
                    để bắt đầu bộ sưu tập cá nhân của bạn.
                  </p>
                  <Link
                    to="/danh-muc/$slug"
                    params={{ slug: "hang-moi" }}
                    className="group mt-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]"
                  >
                    <span className="border-b border-foreground pb-1">
                      Khám phá thiết kế
                    </span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-x-5 gap-y-11 sm:grid-cols-2 xl:grid-cols-3">
                  {tryOnHistory.map((item) => (
                    <article key={item.id} className="group flex flex-col justify-between min-w-0">
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setLightboxItem({
                              imageUrl: item.resultImageUrl,
                              originalUrl: item.userPhotoUrl,
                              productName: item.product.name,
                              productPrice:
                                item.product.salePrice ?? item.product.price,
                              productSlug: item.product.slug,
                            });
                            setLightboxOpen(true);
                          }}
                          className="relative block w-full cursor-zoom-in overflow-hidden bg-secondary/30 text-left"
                        >
                          <div className="aspect-[3/4] overflow-hidden">
                            <img
                              src={item.resultImageUrl}
                              alt={`Thử đồ: ${item.product.name}`}
                              className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.035]"
                              loading="lazy"
                            />
                          </div>

                          <div className="absolute inset-0 flex items-center justify-center bg-black/15 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-black backdrop-blur">
                              <Maximize2 className="size-3" />
                              Xem ảnh
                            </span>
                          </div>

                          <span className="absolute left-3 top-3 bg-black/75 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">
                            AI Try-On
                          </span>

                          {item.userPhotoUrl && (
                            <div className="absolute bottom-3 left-3 size-10 overflow-hidden border border-white/80 bg-secondary shadow-sm">
                              <img
                                src={item.userPhotoUrl}
                                alt="Ảnh gốc"
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                        </button>

                        <div className="pt-4">
                          <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-foreground/75">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <Clock className="size-3 stroke-[1.5]" />
                              {formatTryOnDate(item.createdAt)}
                            </span>
                            {item.product.size && (
                              <span className="font-semibold uppercase tracking-[0.12em]">
                                Size {item.product.size}
                              </span>
                            )}
                          </div>

                          <Link
                            to="/san-pham/$slug"
                            params={{ slug: item.product.slug }}
                            title={item.product.name}
                            className="mt-3 line-clamp-2 h-[2.6em] font-serif text-[18px] font-medium leading-[1.3] tracking-[-0.015em] text-foreground transition-opacity hover:opacity-70"
                          >
                            {item.product.name}
                          </Link>

                          <p className="mt-1.5 text-[14px] font-bold text-foreground">
                            {formatVND(item.product.salePrice ?? item.product.price)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border/60 pt-4">
                        <Link
                          to="/san-pham/$slug"
                          params={{ slug: item.product.slug }}
                          className="group/link inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]"
                        >
                          <span className="border-b border-foreground pb-0.5">
                            Xem thiết kế
                          </span>
                          <span className="transition-transform duration-300 group-hover/link:translate-x-1">
                            →
                          </span>
                        </Link>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleAddToCartItem(item)}
                            className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-opacity hover:opacity-70"
                          >
                            <ShoppingBag className="size-3.5 stroke-[1.6]" />
                            Thêm giỏ
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteTryOn(item.id, item.resultImageUrl)
                            }
                            title="Xóa khỏi lịch sử"
                            className="cursor-pointer text-foreground/60 transition-colors hover:text-destructive"
                          >
                            <Trash2 className="size-3.5 stroke-[1.5]" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WISHLIST */}
          {tab === "wishlist" && (
            <div className="space-y-8">
              <div className="flex flex-col gap-5 border-b border-border/60 pb-7 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/75">
                    Saved curation
                  </p>
                  <h2 className="font-serif text-[30px] font-medium tracking-[-0.025em] text-foreground sm:text-[36px]">
                    Danh sách yêu thích
                  </h2>
                  <p className="mt-2 max-w-lg text-[13px] font-medium leading-6 text-foreground/75">
                    Những thiết kế ÉLANE bạn đã lưu lại để tham khảo hoặc mua sắm sau.
                  </p>
                </div>

                <div className="flex items-center gap-5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/75">
                    {wishlist.length} thiết kế
                  </span>
                  <Link
                    to="/danh-muc/$slug"
                    params={{ slug: "hang-moi" }}
                    className="group inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em]"
                  >
                    <span className="border-b border-foreground pb-1">
                      Khám phá hàng mới
                    </span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </div>
              </div>

              {loadingWishlist ? (
                <div className="py-20 text-center">
                  <Loader2 className="mx-auto size-8 animate-spin text-foreground/70" />
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/75">
                    Đang tải danh sách yêu thích
                  </p>
                </div>
              ) : wishlistItems.length === 0 ? (
                <div className="py-20 text-center">
                  <Heart className="mx-auto size-9 stroke-[1.2] text-foreground/60" />
                  <h3 className="mt-5 font-serif text-xl font-medium text-foreground">
                    Danh sách yêu thích đang trống
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-[13px] font-medium leading-6 text-foreground/75">
                    Hãy lưu lại những thiết kế bạn ấn tượng khi duyệt bộ sưu tập của ÉLANE.
                  </p>
                  <Link
                    to="/danh-muc/$slug"
                    params={{ slug: "hang-moi" }}
                    className="group mt-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]"
                  >
                    <span className="border-b border-foreground pb-1">
                      Khám phá bộ sưu tập
                    </span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
                  {wishlistItems.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-10">
              <div className="">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/75">
                  Client overview
                </p>
                <h2 className="font-serif text-[30px] font-medium tracking-[-0.025em] text-foreground sm:text-[36px]">
                  Tổng quan của bạn
                </h2>
              </div>

              <div className="grid border-y border-border/60 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Tổng đơn hàng", orders.length, Package, () => setTab("orders")],
                  ["Chờ thanh toán", awaitingCount, Clock, () => setTab("orders")],
                  ["Yêu thích", wishlist.length, Heart, () => setTab("wishlist")],
                  [
                    "Virtual looks",
                    tryOnHistory.length,
                    Sparkles,
                    () => setTab("tryon"),
                  ],
                ].map(([l, v, Icon, onClick], index) => {
                  const Comp = Icon as typeof Package;
                  const clickHandler = onClick as (() => void) | undefined;

                  return (
                    <button
                      key={String(l)}
                      type="button"
                      onClick={clickHandler ? () => clickHandler() : undefined}
                      className={`group min-h-[150px] border-border/60 p-5 text-left transition-colors sm:border-r ${index > 1 ? "sm:border-t lg:border-t-0" : ""
                        } ${clickHandler
                          ? "cursor-pointer hover:bg-secondary/30"
                          : "cursor-default"
                        }`}
                    >
                      <div className="flex items-center justify-between text-foreground/80">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                          {String(l)}
                        </span>
                        <Comp className="size-4 stroke-[1.6]" />
                      </div>

                      <p className="mt-7 font-serif text-[40px] font-medium leading-none text-foreground">
                        {String(v)}
                      </p>

                      {clickHandler && (
                        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/75 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-foreground">
                          Xem chi tiết →
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {tryOnHistory.length > 0 && (
                <div>
                  <div className="mb-5 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/75">
                        Virtual atelier
                      </p>
                      <h3 className="mt-1 font-serif text-[24px] font-medium text-foreground">
                        Những lần thử gần đây
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTab("tryon")}
                      className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/75 transition-colors hover:text-foreground"
                    >
                      Xem tất cả ({tryOnHistory.length})
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {tryOnHistory.slice(0, 4).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setLightboxItem({
                            imageUrl: item.resultImageUrl,
                            originalUrl: item.userPhotoUrl,
                            productName: item.product.name,
                            productPrice:
                              item.product.salePrice ?? item.product.price,
                            productSlug: item.product.slug,
                          });
                          setLightboxOpen(true);
                        }}
                        className="group relative aspect-[3/4] cursor-zoom-in overflow-hidden bg-secondary/30"
                      >
                        <img
                          src={item.resultImageUrl}
                          alt={item.product.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="absolute inset-x-3 bottom-3 translate-y-2 text-left opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                          <p className="line-clamp-2 font-serif text-sm font-medium text-white" title={item.product.name}>
                            {item.product.name}
                          </p>
                          <p className="mt-0.5 text-[11px] font-bold text-white">
                            {formatVND(item.product.salePrice ?? item.product.price)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {orders.length > 0 && (
                <div>
                  <div className="mb-5 flex items-end justify-between border-t border-border/60 pt-8">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/75">
                        Latest purchase
                      </p>
                      <h3 className="mt-1 font-serif text-[24px] font-medium text-foreground">
                        Đơn hàng gần nhất
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setTab("orders")}
                      className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/75 transition-colors hover:text-foreground"
                    >
                      Xem tất cả ({orders.length})
                    </button>
                  </div>

                  <OrderCard
                    order={orders[0]!}
                    onViewDetail={(id) => setSelectedOrderId(id)}
                    onPayNow={(order) => setPayingOrder(order)}
                    onOrderUpdated={() => void refreshOrders()}
                  />
                </div>
              )}
            </div>
          )}

          {/* PROFILE */}
          {tab === "profile" && (
            <div className="space-y-8">
              <div className="">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/75">
                  Personal details
                </p>
                <h2 className="font-serif text-[30px] font-medium tracking-[-0.025em] text-foreground sm:text-[36px]">
                  Thông tin cá nhân
                </h2>
              </div>

              <dl className="border-t border-border/60">
                {[
                  ["Họ và tên", user.name],
                  ["Email", user.email],
                  ["Số điện thoại", user.phone || "Chưa cập nhật"],
                  ["Trạng thái thành viên", "Đã kích hoạt"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="grid gap-2 border-b border-border/60 py-5 sm:grid-cols-[190px_1fr]"
                  >
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/75">
                      {k}
                    </dt>
                    <dd className="font-serif text-[17px] font-medium text-foreground sm:text-right">{v}</dd>
                  </div>
                ))}
              </dl>

              <p className="max-w-lg pt-3 text-[12px] font-medium leading-6 text-foreground/75">
                Thông tin này được sử dụng để cá nhân hóa trải nghiệm mua sắm và hỗ
                trợ đơn hàng của bạn tại ÉLANE.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onOrderUpdated={() => void refreshOrders()}
          onPayNow={(order) => {
            setSelectedOrderId(null);
            setPayingOrder({
              id: order.id,
              order_number: order.order_number,
              grand_total_vnd: order.grand_total_vnd,
            });
          }}
        />
      )}

      {payingOrder && (
        <OrderPaymentModal
          order={payingOrder}
          onClose={() => {
            setPayingOrder(null);
            void refreshOrders();
          }}
          onPaid={() => {
            setPayingOrder(null);
            void refreshOrders();
          }}
        />
      )}

      <TryOnImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        imageUrl={lightboxItem?.imageUrl ?? ""}
        originalUrl={lightboxItem?.originalUrl}
        productName={lightboxItem?.productName ?? ""}
        productPrice={lightboxItem?.productPrice ?? 0}
        productSlug={lightboxItem?.productSlug}
        onAddToCart={
          lightboxItem
            ? () => {
              const matched = tryOnHistory.find(
                (x) => x.resultImageUrl === lightboxItem.imageUrl,
              );
              if (matched) handleAddToCartItem(matched);
            }
            : undefined
        }
      />
    </div>
  );
}
