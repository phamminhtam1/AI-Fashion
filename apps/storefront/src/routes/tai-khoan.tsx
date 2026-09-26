import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Clock,
  CreditCard,
  Heart,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { btnCls, seo } from "@/components/site/PageHeader";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { OrderPaymentModal } from "@/components/orders/OrderPaymentModal";

export const Route = createFileRoute("/tai-khoan")({
  head: () =>
    seo(
      "Tài khoản của tôi — ÉLANE",
      "Quản lý thông tin cá nhân, đơn hàng và danh sách yêu thích tại ÉLANE.",
      [{ name: "robots", content: "noindex" }],
    ),
  component: Account,
});

type OrderFilter = "all" | "awaiting" | "processing" | "shipping" | "completed" | "cancelled";

function Account() {
  const { user, logout, orders, wishlist, sessionReady, refreshOrders } = useStore();
  const [tab, setTab] = useState<"overview" | "orders" | "profile">("orders");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [payingOrder, setPayingOrder] = useState<{
    id: string;
    order_number: string;
    grand_total_vnd: number;
  } | null>(null);

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

  if (!sessionReady) {
    return (
      <div className="py-32 text-center space-y-3">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Đang tải thông tin tài khoản…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-28 text-center">
        <span className="font-serif text-3xl italic">É L A N E</span>
        <h1 className="mt-4 text-4xl">Tài khoản</h1>
        <p className="mt-3 text-muted-foreground">Đăng nhập để xem đơn hàng và quyền lợi thành viên.</p>
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
    ["orders", `Đơn hàng của tôi ${awaitingCount > 0 ? `(${awaitingCount} cần thanh toán)` : ""}`],
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
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Thành viên ÉLANE Haute Couture</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-serif">Xin chào, {user.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 bg-secondary px-3 py-1.5 text-xs tracking-wider uppercase">
            <Sparkles className="h-3.5 w-3.5" />
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
              onClick={() => setTab(k as "overview" | "orders" | "profile")}
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

          {/* TAB 2: OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-8">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["Tổng đơn hàng", orders.length, Package],
                  ["Đang chờ thanh toán", awaitingCount, Clock],
                  ["Sản phẩm yêu thích", wishlist.length, Heart],
                ].map(([l, v, Icon]) => {
                  const Comp = Icon as typeof Package;
                  return (
                    <div key={String(l)} className="bg-secondary/40 p-6 border border-border">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="text-[11px] uppercase tracking-widest">{String(l)}</span>
                        <Comp className="h-4 w-4" />
                      </div>
                      <p className="mt-3 font-serif text-3xl font-bold">{String(v)}</p>
                    </div>
                  );
                })}
              </div>

              {/* Quick Recent Order */}
              {orders.length > 0 && (
                <div className="border border-border p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-widest font-semibold">Đơn hàng gần nhất</h3>
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

          {/* TAB 3: PROFILE */}
          {tab === "profile" && (
            <div className="border border-border p-6 space-y-6">
              <h3 className="font-serif text-xl">Thông tin tài khoản</h3>
              <dl className="divide-y divide-border text-sm">
                {[
                  ["Họ và tên", user.name],
                  ["Email", user.email],
                  ["Số điện thoại", user.phone || "Chưa cập nhật"],
                  ["Trạng thái thành viên", "Đã kích hoạt"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-3.5">
                    <dt className="text-muted-foreground text-xs uppercase tracking-wider">{k}</dt>
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
          onClose={() => setPayingOrder(null)}
          onPaid={() => {
            setPayingOrder(null);
            void refreshOrders();
          }}
        />
      )}
    </div>
  );
}
