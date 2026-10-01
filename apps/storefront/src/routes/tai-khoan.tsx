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
  ExternalLink,
  ChevronRight,
  Layers,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { btnCls, seo } from "@/components/site/PageHeader";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { OrderPaymentModal } from "@/components/orders/OrderPaymentModal";
import { formatVND, products, type Product } from "@/lib/products";
import { storeApi } from "@/lib/api";
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
    tab?: "overview" | "orders" | "tryon" | "profile";
  } => {
    const res: {
      orderId?: string;
      tab?: "overview" | "orders" | "tryon" | "profile";
    } = {};
    const oId = s["orderId"];
    const tabVal = s["tab"];
    if (typeof oId === "string" && oId.length > 0) res.orderId = oId;
    if (
      typeof tabVal === "string" &&
      ["overview", "orders", "tryon", "profile"].includes(tabVal)
    ) {
      res.tab = tabVal as "overview" | "orders" | "tryon" | "profile";
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
  const [tab, setTab] = useState<"overview" | "orders" | "tryon" | "profile">(
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
        <span className="font-serif text-3xl italic">É L A N E</span>
        <h1 className="mt-4 text-4xl">Tài khoản</h1>
        <p className="mt-3 text-muted-foreground">
          Đăng nhập để xem đơn hàng, lịch sử thử đồ AI và quyền lợi thành viên.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/dang-nhap" className={btnCls}>
            Đăng nhập
          </Link>
          <Link
            to="/dang-ky"
            className="border border-foreground px-10 py-4 text-xs uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
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
    <div className="mx-auto max-w-[1240px] px-6 py-12">
      {/* Header Profile Info */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Thành viên ÉLANE Haute Couture
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-serif">Xin chào, {user.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 bg-secondary px-3 py-1.5 text-xs tracking-wider uppercase">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Hạng: Silver VIP
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="border border-border px-4 py-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-10 md:grid-cols-[240px_1fr] items-start">
        {/* Navigation Sidebar */}
        <aside className="sticky top-[105px] lg:top-[152px] z-20 bg-background/95 backdrop-blur-sm flex gap-2 overflow-x-auto border-b border-border pb-3 pt-1 text-sm md:flex-col md:border-b-0 md:border-r md:pr-6 md:pb-4 md:pt-0">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k as "overview" | "orders" | "tryon" | "profile")}
              className={`flex items-center justify-between px-3 py-2.5 text-left text-xs uppercase tracking-wider transition-colors ${
                tab === k
                  ? "bg-foreground text-background font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <span>{l}</span>
              {k === "orders" && awaitingCount > 0 && tab !== k && (
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
              {k === "tryon" && tryOnHistory.length > 0 && tab !== k && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          ))}
          <Link
            to="/yeu-thich"
            className="flex items-center justify-between px-3 py-2.5 text-left text-xs uppercase tracking-wider text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <span>Yêu thích</span>
            <span className="font-mono text-xs">({wishlist.length})</span>
          </Link>
        </aside>

        {/* Content Section */}
        <section className="space-y-6 min-w-0">
          {/* TAB 1: ORDERS */}
          {tab === "orders" && (
            <div className="space-y-6">
              {/* Filter Tabs */}
              <div className="sticky top-[105px] lg:top-[152px] z-10 bg-background/95 backdrop-blur-sm py-2.5 flex flex-wrap gap-2 border-b border-border">
                {filterTabs.map((f) => {
                  const isActive = orderFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setOrderFilter(f.id)}
                      className={`inline-flex items-center gap-2 border px-3.5 py-1.5 text-xs transition-colors ${
                        isActive
                          ? "border-foreground bg-foreground text-background font-medium"
                          : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                      }`}
                    >
                      <span>{f.label}</span>
                      {typeof f.count === "number" && f.count > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                            isActive
                              ? "bg-background text-foreground"
                              : f.id === "awaiting"
                              ? "bg-amber-500 text-white font-bold"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {f.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Order List */}
              {filteredOrders.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-border/80 p-8 space-y-4">
                  <Package className="mx-auto h-12 w-12 text-muted-foreground stroke-[1.2]" />
                  <div>
                    <h3 className="font-serif text-lg">Chưa có đơn hàng nào trong mục này</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {orderFilter === "awaiting"
                        ? "Bạn không có đơn nào đang chờ thanh toán."
                        : "Khám phá bộ sưu tập đầm dạ hội và thiết kế mới nhất của ÉLANE."}
                    </p>
                  </div>
                  <Link
                    to="/danh-muc/$slug"
                    params={{ slug: "hang-moi" }}
                    className={`${btnCls} mt-2 inline-block`}
                  >
                    Khám phá bộ sưu tập
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

          {/* TAB 2: VIRTUAL TRY-ON HISTORY */}
          {tab === "tryon" && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="flex flex-wrap items-center justify-between gap-4 border border-border bg-secondary/30 p-5 rounded">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h2 className="font-serif text-xl">Lịch sử phòng thử đồ ảo AI</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bộ sưu tập các mẫu trang phục bạn đã thử với AI. Bấm vào ảnh để xem độ phân giải cao HD hoặc thêm ngay vào giỏ hàng.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary">
                    {tryOnHistory.length} hình ảnh đã thử
                  </span>
                  <Link
                    to="/danh-muc/$slug"
                    params={{ slug: "hang-moi" }}
                    className="border border-foreground bg-foreground text-background px-4 py-1.5 text-xs uppercase tracking-wider hover:opacity-90 transition"
                  >
                    Thử đồ thêm
                  </Link>
                </div>
              </div>

              {/* Try-on History Cards */}
              {tryOnHistory.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-border/80 p-8 space-y-4 rounded">
                  <Sparkles className="mx-auto h-12 w-12 text-primary stroke-[1.2] animate-pulse" />
                  <div>
                    <h3 className="font-serif text-lg">Bạn chưa thử đồ ảo mẫu nào</h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                      Hãy ghé qua trang chi tiết bất kỳ sản phẩm nào và bấm vào nút{" "}
                      <strong>“Thử đồ ảo AI”</strong> để ướm thử trang phục chân thực cùng công nghệ tạo ảnh thời trang cao cấp.
                    </p>
                  </div>
                  <Link
                    to="/danh-muc/$slug"
                    params={{ slug: "hang-moi" }}
                    className={`${btnCls} mt-2 inline-block`}
                  >
                    Khám phá sản phẩm ngay
                  </Link>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {tryOnHistory.map((item) => (
                    <div
                      key={item.id}
                      className="group flex flex-col sm:flex-row overflow-hidden rounded border border-border bg-card shadow-sm transition hover:shadow-md hover:border-foreground/30"
                    >
                      {/* Left: AI Try-On Image */}
                      <div
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
                        className="relative sm:w-44 md:w-48 aspect-[3/4] flex-shrink-0 cursor-pointer overflow-hidden bg-secondary/50"
                      >
                        <img
                          src={item.resultImageUrl}
                          alt={`Thử đồ: ${item.product.name}`}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-3 text-center text-white">
                          <Maximize2 className="h-6 w-6 stroke-[1.5]" />
                          <span className="text-[11px] font-medium tracking-wide">
                            Bấm để phóng to HD
                          </span>
                        </div>
                        <span className="absolute top-2 left-2 rounded bg-black/70 backdrop-blur-sm px-2 py-0.5 text-[9px] uppercase tracking-wider text-white">
                          AI Try-On
                        </span>

                        {/* Optional thumbnail of user photo */}
                        {item.userPhotoUrl && (
                          <div
                            title="Ảnh người mẫu gốc"
                            className="absolute bottom-2 left-2 h-9 w-9 rounded overflow-hidden border-2 border-white shadow-md bg-secondary"
                          >
                            <img
                              src={item.userPhotoUrl}
                              alt="Ảnh gốc"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                      </div>

                      {/* Right: Product & Try-On Details */}
                      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTryOnDate(item.createdAt)}
                            </span>
                            {item.product.size && (
                              <span className="rounded bg-secondary px-2 py-0.5 font-medium text-foreground">
                                Size: {item.product.size}
                              </span>
                            )}
                          </div>

                          <div>
                            <Link
                              to="/san-pham/$slug"
                              params={{ slug: item.product.slug }}
                              className="font-serif text-base font-semibold text-foreground hover:underline line-clamp-2"
                            >
                              {item.product.name}
                            </Link>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {formatVND(item.product.salePrice ?? item.product.price)}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 pt-3 border-t border-border space-y-2">
                          <div className="grid grid-cols-2 gap-2">
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
                              className="inline-flex items-center justify-center gap-1.5 rounded border border-border px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Xem ảnh
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddToCartItem(item)}
                              className="inline-flex items-center justify-center gap-1.5 rounded bg-primary px-3 py-2 text-xs uppercase tracking-wider text-primary-foreground hover:opacity-90 transition"
                            >
                              <ShoppingBag className="h-3.5 w-3.5" />
                              Thêm giỏ
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <Link
                              to="/san-pham/$slug"
                              params={{ slug: item.product.slug }}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Xem trang sản phẩm
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDeleteTryOn(item.id, item.resultImageUrl)}
                              title="Xóa khỏi lịch sử"
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition"
                            >
                              <Trash2 className="h-3 w-3" />
                              Xóa
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Tổng đơn hàng", orders.length, Package, () => setTab("orders")],
                  ["Đang chờ thanh toán", awaitingCount, Clock, () => setTab("orders")],
                  ["Sản phẩm yêu thích", wishlist.length, Heart, null],
                  [
                    "Ảnh đã thử đồ AI",
                    tryOnHistory.length,
                    Sparkles,
                    () => setTab("tryon"),
                  ],
                ].map(([l, v, Icon, onClick]) => {
                  const Comp = Icon as typeof Package;
                  const clickHandler = onClick as (() => void) | undefined;
                  return (
                    <div
                      key={String(l)}
                      onClick={clickHandler ? () => clickHandler() : undefined}
                      className={`bg-secondary/40 p-6 border border-border transition ${
                        clickHandler ? "cursor-pointer hover:border-foreground/40 hover:bg-secondary/60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[11px] uppercase tracking-widest">{String(l)}</span>
                        <Comp className="h-4 w-4" />
                      </div>
                      <p className="mt-3 font-serif text-3xl font-bold">{String(v)}</p>
                    </div>
                  );
                })}
              </div>

              {/* Quick AI Try-on History Showcase */}
              {tryOnHistory.length > 0 && (
                <div className="border border-border p-6 space-y-4 rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="text-xs uppercase tracking-widest font-semibold">
                        Ảnh thử đồ AI gần đây
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("tryon")}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                    >
                      Xem tất cả ({tryOnHistory.length})
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {tryOnHistory.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setLightboxItem({
                            imageUrl: item.resultImageUrl,
                            originalUrl: item.userPhotoUrl,
                            productName: item.product.name,
                            productPrice: item.product.salePrice ?? item.product.price,
                            productSlug: item.product.slug,
                          });
                          setLightboxOpen(true);
                        }}
                        className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded border border-border bg-secondary/30"
                      >
                        <img
                          src={item.resultImageUrl}
                          alt={item.product.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
                          <p className="text-[11px] font-medium text-white line-clamp-1">
                            {item.product.name}
                          </p>
                          <p className="text-[10px] text-white/80">
                            {formatVND(item.product.salePrice ?? item.product.price)}
                          </p>
                        </div>
                        <span className="absolute top-2 right-2 rounded bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-mono text-white/90">
                          Xem HD
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Recent Order */}
              {orders.length > 0 && (
                <div className="border border-border p-6 space-y-4 rounded">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-widest font-semibold">
                      Đơn hàng gần nhất
                    </h3>
                    <button
                      type="button"
                      onClick={() => setTab("orders")}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
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

          {/* TAB 4: PROFILE */}
          {tab === "profile" && (
            <div className="border border-border p-6 space-y-6 rounded">
              <h3 className="font-serif text-xl">Thông tin tài khoản</h3>
              <dl className="divide-y divide-border text-sm">
                {[
                  ["Họ và tên", user.name],
                  ["Email", user.email],
                  ["Số điện thoại", user.phone || "Chưa cập nhật"],
                  ["Trạng thái thành viên", "Đã kích hoạt"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-3.5">
                    <dt className="text-muted-foreground text-xs uppercase tracking-wider">
                      {k}
                    </dt>
                    <dd className="font-medium text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      </div>

      {/* Order Detail Modal */}
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

      {/* Quick VietQR Payment Modal */}
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

      {/* Try-On HD Lightbox Modal */}
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
                if (matched) {
                  handleAddToCartItem(matched);
                }
              }
            : undefined
        }
      />
    </div>
  );
}
