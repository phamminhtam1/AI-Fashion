import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Package,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { formatVND, products } from "@/lib/products";
import { FREE_SHIP, useStore, getCartItemImage } from "@/lib/store";
import {
  checkPaymentStatus,
  fetchBankInfo,
  storeApi,
  type BankInfo,
  type StoreOrderDetail,
} from "@/lib/api";
import { toast } from "sonner";
import { fireCheckoutCelebration } from "@/lib/celebrate";
import { VIETNAM_PROVINCES, getDistrictsByProvince } from "@/lib/vietnam-address";

export const Route = createFileRoute("/thanh-toan")({
  validateSearch: (s: Record<string, unknown>): { orderId?: string } => {
    const res: { orderId?: string } = {};
    const oId = s["orderId"];
    if (typeof oId === "string" && oId.length > 0) res.orderId = oId;
    return res;
  },
  head: () => ({
    meta: [
      { title: "Thanh toán — ÉLANE" },
      { name: "description", content: "Hoàn tất đơn hàng ÉLANE của bạn an toàn và nhanh chóng." },
      { property: "og:title", content: "Thanh toán — ÉLANE" },
      { property: "og:description", content: "Hoàn tất đơn hàng ÉLANE của bạn." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});


const input = "w-full border border-border bg-background px-4 py-3 text-sm outline-none focus:border-foreground";

type AwaitingBank = {
  orderId: string;
  orderNumber: string;
  grandTotalVnd: number;
};

type Success = {
  orderId?: string;
  orderNumber: string;
  paymentMethod: "cod" | "bank";
};

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`Đã copy ${label}`),
    () => toast.error("Không copy được"),
  );
}

function SuccessScreen({ done }: { done: Success }) {
  const { refreshOrders } = useStore();
  const [order, setOrder] = useState<StoreOrderDetail | null>(null);

  useEffect(() => {
    void refreshOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fireCheckoutCelebration();
    const interval = setInterval(() => {
      fireCheckoutCelebration();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!done.orderId) return;
    let active = true;
    storeApi
      .order(done.orderId)
      .then((data) => {
        if (active) setOrder(data);
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [done.orderId]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24 space-y-12 animate-in fade-in duration-500">
      {/* Top Banner Celebration */}
      <div className="text-center space-y-4">
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute -inset-6 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-600 shadow-lg transition-transform hover:scale-105">
            <CheckCircle2 className="h-12 w-12" strokeWidth={1.8} />
          </div>
        </div>

        <div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-serif">Cảm Ơn Quý Khách!</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {done.paymentMethod === "bank" ? (
              <>
                Đơn hàng <b className="text-foreground">#{done.orderNumber}</b> đã thanh toán thành công qua VietQR. Chúng tôi đang tiến hành đóng gói và giao hàng sớm nhất.
              </>
            ) : (
              <>
                Đơn hàng <b className="text-foreground">#{done.orderNumber}</b> đã được đặt thành công. Chúng tôi sẽ liên hệ xác nhận và giao hàng tận nơi.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Stepper Timeline */}
      <div className="border border-border bg-secondary/20 p-6 sm:p-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground text-center mb-6">
          Tiến trình xử lý đơn hàng
        </p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Đặt đơn", desc: "Hoàn tất", done: true, icon: FileText },
            {
              label: done.paymentMethod === "bank" ? "Đã thanh toán" : "Xác nhận COD",
              desc: "SePay VietQR",
              done: true,
              icon: CreditCard,
            },
            { label: "Đóng gói", desc: "Kho ÉLANE", done: false, icon: Package },
            { label: "Giao hàng", desc: "ÉLANE Express", done: false, icon: Truck },
          ].map((st, i) => {
            const Icon = st.icon;
            return (
              <div key={st.label} className="relative flex flex-col items-center">
                {i > 0 && (
                  <div
                    className={`absolute top-4 -left-1/2 w-full h-[2px] -z-0 ${st.done ? "bg-foreground" : "bg-border"
                      }`}
                  />
                )}
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border transition-all ${st.done
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-background text-muted-foreground border-border"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">{st.label}</p>
                <p className="hidden sm:block text-[10px] text-muted-foreground">{st.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Info & Items Card */}
      {order && (
        <div className="border border-border bg-background divide-y divide-border shadow-sm">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 bg-secondary/30 text-xs">
            <div>
              <span className="text-muted-foreground">Mã đơn hàng:</span>{" "}
              <b className="font-mono text-sm text-foreground">#{order.order_number}</b>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                {new Date(order.placed_at).toLocaleDateString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
              <button
                type="button"
                onClick={() => copyText("mã đơn", order.order_number)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
          </div>

          {/* Delivery & Payment details */}
          <div className="grid gap-6 p-6 sm:grid-cols-2 text-xs">
            <div className="space-y-1.5">
              <p className="font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-foreground" />
                Người nhận & Địa chỉ giao
              </p>
              <p className="font-medium text-sm text-foreground">
                {order.recipient?.full_name || order.recipient?.recipient_name || "—"}
              </p>
              <p className="text-muted-foreground">SĐT: {order.recipient?.phone || "—"}</p>
              <p className="text-muted-foreground">
                {order.shipping_address?.full_address ||
                  [
                    order.shipping_address?.address_line,
                    order.shipping_address?.district,
                    order.shipping_address?.city,
                  ]
                    .filter(Boolean)
                    .join(", ")}
              </p>
            </div>
            <div className="space-y-1.5 sm:border-l sm:border-border sm:pl-6">
              <p className="font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-foreground" />
                Phương thức & Chi phí
              </p>
              <p className="font-medium text-foreground">
                {order.payment_method === "bank"
                  ? "Chuyển khoản QR (Đã thanh toán)"
                  : "Thanh toán tiền mặt khi nhận hàng (COD)"}
              </p>
              <p className="text-muted-foreground">
                Tổng cộng: <b className="font-serif text-base text-foreground">{formatVND(order.grand_total_vnd)}</b>
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                Miễn phí đổi trả trong vòng 30 ngày
              </p>
            </div>
          </div>

          {/* Purchased Items */}
          <div className="p-6 space-y-4">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Sản phẩm trong đơn ({order.items.length})
            </p>
            <div className="divide-y divide-border/60">
              {order.items.map((it) => (
                <div key={it.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt={it.product_name}
                      className="h-16 w-12 object-cover bg-secondary flex-shrink-0 border border-border"
                    />
                  ) : (
                    <div className="flex h-16 w-12 items-center justify-center bg-secondary text-muted-foreground flex-shrink-0">
                      <Package className="h-5 w-5 stroke-[1.2]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{it.product_name}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {it.size_label && <span className="bg-secondary px-2 py-0.5">Size {it.size_label}</span>}
                      {it.color_label && <span className="bg-secondary px-2 py-0.5">{it.color_label}</span>}
                      <span>SL: {it.qty}</span>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-foreground">{formatVND(it.line_total_vnd)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {it.qty > 1 ? `${it.qty} × ${formatVND(it.unit_price_vnd)}` : null}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <Link
          to="/tai-khoan"
          search={done.orderId ? { orderId: done.orderId } : {}}
          className="bg-foreground text-background px-8 py-4 text-xs uppercase tracking-widest font-medium hover:bg-foreground/90 transition-all shadow-sm"
        >
          Xem đơn hàng trong Tài khoản
        </Link>
        <Link
          to="/"
          className="border border-border px-8 py-4 text-xs uppercase tracking-widest text-foreground hover:bg-secondary transition-colors"
        >
          Tiếp tục mua sắm
        </Link>
      </div>
    </div>
  );
}

function AwaitingBankScreen({
  awaiting,
  bankInfo,
  onPaid,
  onCancelled,
}: {
  awaiting: AwaitingBank;
  bankInfo: BankInfo;
  onPaid: () => void;
  onCancelled: () => void;
}) {
  const { refreshOrders } = useStore();
  const [cancelling, setCancelling] = useState(false);
  const [checkingManual, setCheckingManual] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<StoreOrderDetail | null>(null);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 mins countdown

  const onPaidRef = useRef(onPaid);
  const onCancelledRef = useRef(onCancelled);
  onPaidRef.current = onPaid;
  onCancelledRef.current = onCancelled;

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleCopy = (key: string, label: string, value: string) => {
    void navigator.clipboard.writeText(value).then(
      () => {
        setCopiedKey(key);
        toast.success(`Đã sao chép ${label}`);
        setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
      },
      () => toast.error("Không thể sao chép"),
    );
  };

  // Fetch full order detail for right column
  useEffect(() => {
    let active = true;
    storeApi
      .order(awaiting.orderId)
      .then((data) => {
        if (active) setOrderDetail(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [awaiting.orderId]);

  // SePay / VietQR Image URL
  const bankCode = bankInfo.bank_code || bankInfo.bank_name || "MSB";
  const holder = bankInfo.account_name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  const q = new URLSearchParams({
    bank: bankCode,
    acc: bankInfo.account_number,
    amount: String(awaiting.grandTotalVnd),
    des: awaiting.orderNumber,
    template: "compact",
    showInfo: "true",
    holder,
  });
  const qr = `https://vietqr.app/img/?${q.toString()}`;

  // High-Frequency Realtime Polling via dedicated public endpoint
  useEffect(() => {
    let stopped = false;
    const checkNow = async () => {
      if (stopped) return;
      try {
        const st = await checkPaymentStatus(awaiting.orderId);
        if (stopped) return;
        if (st.is_paid) {
          stopped = true;
          fireCheckoutCelebration();
          toast.success("Thanh toán thành công! Hệ thống đang xử lý đơn hàng.");
          void refreshOrders();
          sessionStorage.removeItem("elane_awaiting_bank_order");
          onPaidRef.current();
          return;
        }
        if (st.status === "cancelled" || st.payment_status === "failed") {
          stopped = true;
          toast.message("Đơn hàng đã bị hủy");
          sessionStorage.removeItem("elane_awaiting_bank_order");
          onCancelledRef.current();
        }
      } catch {
        /* keep polling silently */
      }
    };

    void checkNow();
    const id = window.setInterval(() => void checkNow(), 1500);

    // Immediate check on tab focus
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        void checkNow();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      stopped = true;
      window.clearInterval(id);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [awaiting.orderId]);

  // Manual Check Button
  const handleManualCheck = async () => {
    if (checkingManual) return;
    setCheckingManual(true);
    try {
      const st = await checkPaymentStatus(awaiting.orderId);
      if (st.is_paid) {
        fireCheckoutCelebration();
        toast.success("Thanh toán thành công! Đơn hàng đã được xác nhận.");
        void refreshOrders();
        sessionStorage.removeItem("elane_awaiting_bank_order");
        onPaidRef.current();
      } else {
        toast.info("Hệ thống đang chờ ngân hàng đối soát. Quý khách vui lòng đợi từ 3 - 5 giây hoặc kiểm tra lại nội dung chuyển khoản.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chưa kiểm tra được trạng thái");
    } finally {
      setCheckingManual(false);
    }
  };

  async function cancel() {
    if (!confirm("Bạn có chắc chắn muốn hủy đơn hàng này?")) return;
    if (cancelling) return;
    setCancelling(true);
    try {
      await storeApi.cancelOrder(awaiting.orderId);
      sessionStorage.removeItem("elane_awaiting_bank_order");
      toast.success("Đã hủy đơn hàng");
      onCancelled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không hủy được đơn");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-8 animate-in fade-in duration-500">
      {/* Top Banner Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-4 py-1.5 text-xs font-medium rounded-full border border-amber-500/20 shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <span>CỔNG THANH TOÁN TỰ ĐỘNG NAPAS 24/7 • SEPAY VIETQR</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif tracking-tight text-foreground">
          Quét Mã VietQR Thanh Toán
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
          Mở App Ngân hàng hoặc Ví MoMo, ZaloPay để quét mã QR. Đơn hàng sẽ được tự động kích hoạt ngay lập tức khi tiền về tài khoản.
        </p>
      </div>

      {/* 2-Column Luxury Production Grid */}
      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-start">
        {/* Left Column: Interactive QR Card & Bank Info */}
        <div className="border border-border/80 bg-background/80 backdrop-blur-sm p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
          {/* Top Bar inside card */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded bg-foreground text-background flex items-center justify-center font-serif text-sm font-bold shadow-sm">
                É
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">ÉLANE Pay</p>
                <p className="text-[10px] text-muted-foreground">VietQR Chuẩn Quốc Gia</p>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="inline-flex items-center gap-2 bg-secondary/80 border border-border px-3 py-1.5 text-xs font-mono rounded">
              <Clock className="h-3.5 w-3.5 text-amber-600 animate-spin" style={{ animationDuration: "12s" }} />
              <span className="text-muted-foreground">Giữ đơn:</span>
              <span className={`font-bold ${timeLeft < 300 ? "text-destructive animate-pulse" : "text-amber-600 dark:text-amber-400"}`}>
                {formatCountdown(timeLeft)}
              </span>
            </div>
          </div>

          {/* QR Viewfinder Card with Laser Scan Animation */}
          <div className="relative mx-auto flex flex-col items-center">
            {/* Viewfinder Target Container */}
            <div className="relative p-4 bg-white rounded-xl shadow-2xl border-2 border-border/40 group">
              {/* Corner Viewfinder Markers */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-600 rounded-tl" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-600 rounded-tr" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-600 rounded-bl" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-600 rounded-br" />

              {/* Laser Scanning Line */}
              <div className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_0_12px_rgba(245,158,11,0.9)] animate-qr-scan pointer-events-none z-10" />

              {/* The QR Image */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 bg-white flex items-center justify-center overflow-hidden">
                <img
                  src={qr}
                  alt={`VietQR đơn hàng ${awaiting.orderNumber}`}
                  className="w-full h-full object-contain select-none"
                  loading="eager"
                />
              </div>

              {/* Security Pill */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-foreground text-background px-3 py-0.5 text-[10px] uppercase font-mono tracking-widest rounded-full shadow-md whitespace-nowrap flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                <span>Napas 24/7 Bảo Mật</span>
              </div>
            </div>

            {/* Quick Actions below QR */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <a
                href={qr}
                download={`VietQR-${awaiting.orderNumber}.png`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/80 hover:border-foreground/50 transition-colors bg-secondary/30 rounded"
                title="Tải ảnh QR để mở trong app ngân hàng"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tải ảnh QR</span>
              </a>

              <button
                type="button"
                onClick={() => void handleManualCheck()}
                disabled={checkingManual}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-foreground hover:text-background border border-foreground/60 transition-colors bg-background rounded shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingManual ? "animate-spin" : ""}`} />
                <span>{checkingManual ? "Đang kiểm tra…" : "Kiểm tra thanh toán"}</span>
              </button>
            </div>
          </div>

          {/* 3 Step Visual Guide */}
          <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/60 text-center text-xs">
            <div className="space-y-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-bold text-foreground">
                1
              </span>
              <p className="text-[11px] font-medium text-foreground">Mở App Ngân hàng</p>
              <p className="text-[10px] text-muted-foreground hidden sm:block">Hoặc MoMo, ZaloPay</p>
            </div>
            <div className="space-y-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-bold text-foreground">
                2
              </span>
              <p className="text-[11px] font-medium text-foreground">Chọn Quét QR</p>
              <p className="text-[10px] text-muted-foreground hidden sm:block">Hướng camera vào mã</p>
            </div>
            <div className="space-y-1">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-bold text-foreground">
                3
              </span>
              <p className="text-[11px] font-medium text-foreground">Xác nhận chuyển</p>
              <p className="text-[10px] text-muted-foreground hidden sm:block">Duyệt tự động 3 giây</p>
            </div>
          </div>

          {/* Transfer Details Cards */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 border border-border bg-secondary/20">
              <span className="text-muted-foreground font-medium">Ngân hàng thụ hưởng:</span>
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                {bankInfo.bank_name}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 border border-border bg-secondary/20">
              <div>
                <p className="text-muted-foreground font-medium">Số tài khoản:</p>
                <p className="font-mono text-base font-bold text-foreground tracking-wider mt-0.5">
                  {bankInfo.account_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy("acc", "Số tài khoản", bankInfo.account_number)}
                className="inline-flex items-center gap-1 text-xs border border-border px-3 py-1.5 bg-background hover:bg-secondary transition-colors rounded shadow-xs"
              >
                {copiedKey === "acc" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-medium">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 border border-border bg-secondary/20">
              <span className="text-muted-foreground font-medium">Chủ tài khoản:</span>
              <span className="font-semibold text-foreground uppercase tracking-wide">
                {bankInfo.account_name}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 border border-border bg-secondary/40">
              <div>
                <p className="text-muted-foreground font-medium">Số tiền chính xác:</p>
                <p className="font-serif text-lg font-bold text-foreground mt-0.5">
                  {formatVND(awaiting.grandTotalVnd)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy("amount", "Số tiền", String(awaiting.grandTotalVnd))}
                className="inline-flex items-center gap-1 text-xs border border-border px-3 py-1.5 bg-background hover:bg-secondary transition-colors rounded shadow-xs"
              >
                {copiedKey === "amount" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-medium">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>

            {/* Crucial Transfer Content Box */}
            <div className="p-4 border-2 border-amber-500/40 bg-amber-500/10 rounded-sm space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Nội dung chuyển khoản (Bắt buộc):
                  </p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                    Hệ thống nhận diện đơn qua mã này để duyệt tự động
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy("des", "Nội dung chuyển khoản", awaiting.orderNumber)}
                  className="inline-flex items-center gap-1 text-xs border border-amber-500/50 bg-background text-amber-900 dark:text-amber-200 px-3.5 py-1.5 font-medium hover:bg-amber-500 hover:text-white transition-colors rounded shadow-sm"
                >
                  {copiedKey === "des" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Sao chép mã</span>
                    </>
                  )}
                </button>
              </div>
              <div className="bg-background/90 p-2.5 rounded border border-amber-500/20 text-center">
                <span className="font-mono text-lg font-extrabold tracking-widest text-foreground select-all">
                  {awaiting.orderNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Live Signal Status Bar */}
          <div className="flex items-center justify-center gap-2.5 text-xs text-muted-foreground bg-secondary/50 py-3 px-4 border border-border rounded">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground flex-shrink-0" />
            <span className="font-medium">Đang tự động đối soát giao dịch thời gian thực (Napas 24/7)…</span>
          </div>
        </div>

        {/* Right Column: Order Details & Actions */}
        <div className="space-y-6">
          <div className="border border-border bg-secondary/20 p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-lg text-foreground">Chi Tiết Đơn Hàng</h3>
              <span className="font-mono text-xs bg-secondary px-2.5 py-1 font-semibold text-foreground">
                #{awaiting.orderNumber}
              </span>
            </div>

            {/* Items list */}
            {orderDetail ? (
              <div className="divide-y divide-border/60 max-h-72 overflow-y-auto pr-1">
                {orderDetail.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    {it.image_url ? (
                      <img
                        src={it.image_url}
                        alt={it.product_name}
                        className="h-16 w-12 object-cover bg-background flex-shrink-0 border border-border"
                      />
                    ) : (
                      <div className="flex h-16 w-12 items-center justify-center bg-background text-muted-foreground flex-shrink-0">
                        <Package className="h-5 w-5 stroke-[1.2]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs text-foreground truncate">{it.product_name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {it.size_label && <span className="bg-secondary px-1.5 py-0.2">Size {it.size_label}</span>}
                        {it.color_label && <span className="bg-secondary px-1.5 py-0.2">{it.color_label}</span>}
                        <span>SL: {it.qty}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-medium text-foreground">{formatVND(it.line_total_vnd)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Đang tải tóm tắt sản phẩm…
              </div>
            )}

            {/* Financial breakdown */}
            {orderDetail && (
              <div className="border-t border-border pt-4 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Tạm tính tiền hàng:</span>
                  <span>{formatVND(orderDetail.subtotal_vnd)}</span>
                </div>
                {orderDetail.discount_vnd > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Giảm giá voucher {orderDetail.discount_code ? `(${orderDetail.discount_code})` : ""}:</span>
                    <span>-{formatVND(orderDetail.discount_vnd)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Phí vận chuyển:</span>
                  <span>{orderDetail.shipping_vnd === 0 ? "Miễn phí" : formatVND(orderDetail.shipping_vnd)}</span>
                </div>
                <div className="flex justify-between pt-2.5 border-t border-border text-foreground font-semibold text-sm">
                  <span>Tổng tiền thanh toán:</span>
                  <span className="font-serif text-xl text-foreground font-bold">{formatVND(orderDetail.grand_total_vnd)}</span>
                </div>
              </div>
            )}

            {/* Delivery address snapshot */}
            {orderDetail && orderDetail.recipient && (
              <div className="border-t border-border pt-4 text-xs space-y-1">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  Giao đến: {orderDetail.recipient.full_name} ({orderDetail.recipient.phone})
                </p>
                <p className="text-muted-foreground pl-5">
                  {orderDetail.shipping_address?.full_address ||
                    [
                      orderDetail.shipping_address?.address_line,
                      orderDetail.shipping_address?.district,
                      orderDetail.shipping_address?.city,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                </p>
              </div>
            )}

            {/* Reassurance Badge */}
            <div className="border-t border-border pt-4 flex items-start gap-2.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                Cam kết chính hãng 100% • Đổi trả miễn phí trong 30 ngày • Hỗ trợ CSKH 24/7 hotline 1900 8888.
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              disabled={cancelling}
              onClick={() => void cancel()}
              className="border border-border px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-50"
            >
              {cancelling ? "Đang hủy…" : "Hủy đơn hàng này"}
            </button>
            <Link
              to="/tai-khoan"
              search={{ orderId: awaiting.orderId }}
              className="border border-foreground px-6 py-3 text-xs uppercase tracking-wider text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              Xem trong Tài khoản
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


function Checkout() {
  const { cart, subtotal, placeOrder, user, sessionReady, refreshOrders } = useStore();
  const search = Route.useSearch();
  const nav = useNavigate();
  const [awaiting, setAwaiting] = useState<AwaitingBank | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [pay, setPay] = useState<"cod" | "bank">("cod");
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount_vnd: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const shipping = subtotal >= FREE_SHIP ? 0 : 30000;
  const discount = applied?.discount_vnd ?? 0;
  const grand = Math.max(0, subtotal + shipping - discount);

  const availableDistricts = selectedCity ? getDistrictsByProvince(selectedCity) : [];

  const handleCityChange = (c: string) => {
    setSelectedCity(c);
    setSelectedDistrict("");
  };

  async function applyCoupon() {
    setCouponError(null);
    const code = couponInput.trim();
    if (!code) {
      setCouponError("Nhập mã giảm giá");
      return;
    }
    setCouponBusy(true);
    try {
      const res = await storeApi.previewCoupon({ code, subtotal_vnd: subtotal });
      setApplied({ code: res.code, discount_vnd: res.discount_vnd });
      setCouponInput(res.code);
    } catch (err) {
      setApplied(null);
      setCouponError(err instanceof Error ? err.message : "Mã không hợp lệ");
    } finally {
      setCouponBusy(false);
    }
  }

  // Restore awaiting order on reload if user had placed bank transfer order
  useEffect(() => {
    if (search.orderId) {
      checkPaymentStatus(search.orderId)
        .then((st) => {
          if (st.is_paid) {
            setSuccess({ orderId: st.id, orderNumber: st.order_number, paymentMethod: "bank" });
          } else if (st.payment_method === "bank" && st.status === "pending") {
            setAwaiting({
              orderId: st.id,
              orderNumber: st.order_number,
              grandTotalVnd: st.grand_total_vnd,
            });
          }
        })
        .catch(() => {});
      return;
    }

    try {
      const saved = sessionStorage.getItem("elane_awaiting_bank_order");
      if (saved) {
        const parsed = JSON.parse(saved) as AwaitingBank;
        if (parsed?.orderId) {
          checkPaymentStatus(parsed.orderId)
            .then((st) => {
              if (st.is_paid) {
                sessionStorage.removeItem("elane_awaiting_bank_order");
                setSuccess({ orderId: st.id, orderNumber: st.order_number, paymentMethod: "bank" });
              } else if (st.status !== "cancelled" && st.payment_status !== "failed") {
                setAwaiting(parsed);
              } else {
                sessionStorage.removeItem("elane_awaiting_bank_order");
              }
            })
            .catch(() => {
              setAwaiting(parsed);
            });
        }
      }
    } catch {
      /* ignore parse error */
    }
  }, [search.orderId]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!user) {
      void nav({ to: "/dang-nhap", search: { next: "/thanh-toan" } });
    }
  }, [sessionReady, user, nav]);

  useEffect(() => {
    if (pay !== "bank" && !awaiting) return;
    let cancelled = false;
    void fetchBankInfo()
      .then((info) => {
        if (!cancelled) setBankInfo(info);
      })
      .catch((err) => {
        if (!cancelled) {
          setBankInfo(null);
          toast.error(err instanceof Error ? err.message : "Chưa cấu hình tài khoản ngân hàng");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pay, awaiting]);

  if (success) {
    return <SuccessScreen done={success} />;
  }

  if (awaiting && bankInfo) {
    return (
      <AwaitingBankScreen
        awaiting={awaiting}
        bankInfo={bankInfo}
        onPaid={() => {
          try {
            sessionStorage.removeItem("elane_awaiting_bank_order");
          } catch {}
          void refreshOrders();
          setSuccess({ orderId: awaiting.orderId, orderNumber: awaiting.orderNumber, paymentMethod: "bank" });
          setAwaiting(null);
        }}
        onCancelled={() => {
          try {
            sessionStorage.removeItem("elane_awaiting_bank_order");
          } catch {}
          setAwaiting(null);
          void nav({ to: "/" });
        }}
      />
    );
  }

  if (awaiting && !bankInfo) {
    return (
      <div className="py-32 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Đang tải thông tin chuyển khoản VietQR…</p>
      </div>
    );
  }

  if (!sessionReady || !user) {
    return (
      <div className="py-32 text-center text-muted-foreground">
        Đang chuyển tới đăng nhập…
      </div>
    );
  }

  if (cart.length === 0)
    return (
      <div className="py-32 text-center space-y-4">
        <h1 className="text-3xl font-serif">Giỏ hàng của bạn đang trống</h1>
        <p className="text-xs text-muted-foreground">Hãy chọn các thiết kế thanh lịch từ bộ sưu tập của chúng tôi.</p>
        <Link to="/" className="inline-block border border-foreground px-8 py-3 text-xs uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors">
          Khám phá bộ sưu tập
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <h1 className="text-4xl">Thanh toán</h1>
      <form
        className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (pay === "bank" && !bankInfo) {
            toast.error("Chưa cấu hình tài khoản ngân hàng");
            return;
          }
          const f = new FormData(e.currentTarget);
          const cityVal = selectedCity || String(f.get("city") || "");
          const districtVal = selectedDistrict || String(f.get("district") || "");
          const addressVal = String(f.get("address") || "").trim();

          if (!cityVal) {
            toast.error("Vui lòng chọn Tỉnh / Thành phố");
            return;
          }
          if (!districtVal) {
            toast.error("Vui lòng chọn Quận / Huyện");
            return;
          }
          if (!addressVal) {
            toast.error("Vui lòng nhập địa chỉ cụ thể");
            return;
          }

          void (async () => {
            setSubmitting(true);
            try {
              const noteVal = String(f.get("note") || "").trim();
              const result = await placeOrder({
                fullName: String(f.get("name")),
                phone: String(f.get("phone")),
                email: String(f.get("email")),
                address: addressVal,
                city: cityVal,
                district: districtVal,
                paymentMethod: pay,
                total: grand,
                ...(noteVal ? { note: noteVal } : {}),
                ...(applied?.code ? { couponCode: applied.code } : {}),
              });
              if (result.paymentMethod === "bank") {
                const aw = {
                  orderId: result.id,
                  orderNumber: result.orderNumber,
                  grandTotalVnd: result.grandTotalVnd,
                };
                try {
                  sessionStorage.setItem("elane_awaiting_bank_order", JSON.stringify(aw));
                } catch {}
                setAwaiting(aw);
              } else {
                try {
                  sessionStorage.removeItem("elane_awaiting_bank_order");
                } catch {}
                fireCheckoutCelebration();
                setSuccess({ orderId: result.id, orderNumber: result.orderNumber, paymentMethod: "cod" });
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Đặt hàng thất bại");
            } finally {
              setSubmitting(false);
            }
          })();
        }}
      >

        <div className="space-y-10">
          <fieldset className="space-y-4">
            <legend className="mb-4 text-xs uppercase tracking-widest font-semibold">Thông tin giao hàng</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                  Họ và tên <span className="text-destructive">*</span>
                </label>
                <input required name="name" defaultValue={user.name} placeholder="Họ và tên" className={input} aria-label="Họ và tên" />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                  Số điện thoại <span className="text-destructive">*</span>
                </label>
                <input required name="phone" type="tel" defaultValue={user.phone} placeholder="Số điện thoại" className={input} aria-label="Số điện thoại" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                Email nhận thông báo <span className="text-destructive">*</span>
              </label>
              <input required name="email" type="email" defaultValue={user.email} placeholder="Email" className={input} aria-label="Email" />
            </div>

            {/* Chuẩn Tỉnh thành & Quận huyện Việt Nam */}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                  Tỉnh / Thành phố <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  name="city"
                  value={selectedCity}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className={input}
                  aria-label="Tỉnh / Thành phố"
                >
                  <option value="">-- Chọn Tỉnh / Thành phố --</option>
                  {VIETNAM_PROVINCES.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                  Quận / Huyện <span className="text-destructive">*</span>
                </label>
                <select
                  required
                  name="district"
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  disabled={!selectedCity}
                  className={`${input} ${!selectedCity ? "cursor-not-allowed opacity-50 bg-secondary/30" : ""}`}
                  aria-label="Quận / Huyện"
                >
                  <option value="">
                    {selectedCity ? "-- Chọn Quận / Huyện --" : "-- Chọn Tỉnh / Thành trước --"}
                  </option>
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                Địa chỉ cụ thể <span className="text-destructive">*</span>
              </label>
              <input
                required
                name="address"
                placeholder="Số nhà, tên tòa nhà, tên đường, phường / xã..."
                className={input}
                aria-label="Địa chỉ cụ thể"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                Ghi chú giao hàng
              </label>
              <textarea name="note" placeholder="Ghi chú đơn hàng (ví dụ: giao giờ hành chính, gọi trước khi giao...)" className={input} rows={3} aria-label="Ghi chú" />
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-4 text-xs uppercase tracking-widest font-semibold">Phương thức thanh toán</legend>
            <div className="divide-y divide-border border border-border">
              {([["cod", "Thanh toán khi nhận hàng (COD)"], ["bank", "Chuyển khoản ngân hàng"]] as const).map(([v, l]) => (
                <label key={v} className="flex cursor-pointer items-center gap-3 px-4 py-4 text-sm">
                  <input type="radio" name="pay" value={v} checked={pay === v} onChange={() => setPay(v)} className="accent-foreground" /> {l}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <aside className="h-fit bg-secondary p-8">
          <h2 className="text-xl">Đơn hàng ({cart.length})</h2>
          <ul className="mt-6 space-y-4">
            {cart.map((it, i) => {
              const p = products.find((x) => x.id === it.productId)!;
              const itemImg = getCartItemImage(it, p);
              return (
                <li key={i} className="flex gap-3 text-sm">
                  <img src={itemImg} alt={p.name} className="h-20 w-15 object-cover" />
                  <div className="flex-1"><p>{p.name}</p><p className="text-xs text-muted-foreground">{it.colorName ? `${it.colorName} · ` : ""}{it.sku} · Size {it.size} · x{it.qty}</p></div>
                  <span>{formatVND((p.salePrice ?? p.price) * it.qty)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt>Tạm tính</dt><dd>{formatVND(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Vận chuyển</dt><dd>{shipping ? formatVND(shipping) : "Miễn phí"}</dd></div>
            {applied && (
              <div className="flex justify-between text-success">
                <dt>Giảm giá ({applied.code})</dt>
                <dd>−{formatVND(applied.discount_vnd)}</dd>
              </div>
            )}
            <div className="pt-2">
              <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">Mã giảm giá</label>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Nhập mã"
                  className={input}
                  aria-label="Mã giảm giá"
                  disabled={!!applied}
                />
                {applied ? (
                  <button
                    type="button"
                    className="shrink-0 border border-border px-3 text-xs uppercase tracking-widest"
                    onClick={() => {
                      setApplied(null);
                      setCouponError(null);
                    }}
                  >
                    Gỡ
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={couponBusy}
                    className="shrink-0 border border-foreground px-3 text-xs uppercase tracking-widest disabled:opacity-60"
                    onClick={() => void applyCoupon()}
                  >
                    {couponBusy ? "…" : "Áp dụng"}
                  </button>
                )}
              </div>
              {couponError && <p className="mt-2 text-xs text-destructive">{couponError}</p>}
            </div>
            <div className="flex justify-between pt-2 text-base font-medium"><dt>Tổng cộng</dt><dd>{formatVND(grand)}</dd></div>
          </dl>
          <button type="submit" disabled={submitting} className="mt-6 w-full bg-primary py-4 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-60">
            {submitting ? "Đang đặt…" : "Đặt hàng"}
          </button>
        </aside>
      </form>
    </div>
  );
}
