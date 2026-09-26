import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { formatVND, products } from "@/lib/products";
import { FREE_SHIP, useStore } from "@/lib/store";
import { fetchBankInfo, storeApi, type BankInfo, type StoreOrderDetail } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/thanh-toan")({
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
  const [order, setOrder] = useState<StoreOrderDetail | null>(null);

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
    <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24 space-y-12">
      {/* Top Banner Celebration */}
      <div className="text-center space-y-4">
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute -inset-4 rounded-full bg-emerald-500/10 blur-lg animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600">
            <CheckCircle2 className="h-10 w-10" strokeWidth={1.5} />
          </div>
        </div>

        <div>
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            ÉLANE Haute Couture • Xác nhận đơn hàng
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-serif">Cảm Ơn Quý Khách!</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {done.paymentMethod === "bank" ? (
              <>
                Đơn hàng <b className="text-foreground">#{done.orderNumber}</b> đã thanh toán thành công qua SePay VietQR. Chúng tôi đang tiến hành đóng gói và giao hàng sớm nhất.
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
  const [cancelling, setCancelling] = useState(false);
  const [orderDetail, setOrderDetail] = useState<StoreOrderDetail | null>(null);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 mins countdown

  const onPaidRef = useRef(onPaid);
  const onCancelledRef = useRef(onCancelled);
  onPaidRef.current = onPaid;
  onCancelledRef.current = onCancelled;

  // Countdown
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

  // Fetch full order detail for right column
  useEffect(() => {
    let active = true;
    storeApi
      .order(awaiting.orderId)
      .then((data) => {
        if (active) setOrderDetail(data);
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [awaiting.orderId]);

  // Khớp format URI SePay: vietqr.app/img/?bank=&acc=&showInfo=true&holder=
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

  // Realtime Polling
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const o = await storeApi.order(awaiting.orderId);
        if (stopped) return;
        if (o.payment_status === "paid") {
          toast.success("Thanh toán thành công! Hệ thống đang xử lý đơn.");
          onPaidRef.current();
          return;
        }
        if (o.status === "cancelled" || o.payment_status === "failed") {
          toast.message("Đơn hàng đã bị hủy");
          onCancelledRef.current();
        }
      } catch {
        /* keep polling */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [awaiting.orderId]);

  async function cancel() {
    if (!confirm("Bạn có chắc chắn muốn hủy đơn hàng này?")) return;
    if (cancelling) return;
    setCancelling(true);
    try {
      await storeApi.cancelOrder(awaiting.orderId);
      toast.success("Đã hủy đơn");
      onCancelled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không hủy được đơn");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 space-y-8">
      {/* Top Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3.5 py-1 text-xs font-medium rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          Hệ thống xác nhận tự động qua cổng SePay Napas 24/7
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif">Chờ Thanh Toán VietQR</h1>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Mã đơn <b className="text-foreground">#{awaiting.orderNumber}</b> • Quét mã QR hoặc chuyển khoản đúng số tiền và nội dung bên dưới.
        </p>
      </div>

      {/* 2-Column High-Fashion Grid */}
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
        {/* Left Column: QR Code & Bank Details */}
        <div className="border border-border bg-background p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-foreground">SEPAY VIETQR</span>
              <span className="bg-secondary px-2 py-0.5 text-[10px] font-mono uppercase">Napas 24/7</span>
            </div>
            <div className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span>Thời gian giữ đơn:</span>
              <b className="text-amber-600 font-semibold">{formatCountdown(timeLeft)}</b>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative p-3 bg-white border border-border shadow-inner rounded-sm">
              <img
                src={qr}
                alt="VietQR SePay"
                className="h-60 w-60 object-contain mx-auto"
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Mở App Ngân hàng bất kỳ ➔ Chọn <b>Quét QR</b> để tự động điền đầy đủ
            </p>
          </div>

          {/* Details Table */}
          <dl className="divide-y divide-border border border-border text-xs">
            <div className="flex items-center justify-between p-3">
              <dt className="text-muted-foreground">Ngân hàng:</dt>
              <dd className="font-semibold text-foreground">{bankInfo.bank_name}</dd>
            </div>
            <div className="flex items-center justify-between p-3">
              <dt className="text-muted-foreground">Số tài khoản:</dt>
              <div className="flex items-center gap-2">
                <dd className="font-mono font-bold text-sm text-foreground">{bankInfo.account_number}</dd>
                <button
                  type="button"
                  onClick={() => copyText("Số tài khoản", bankInfo.account_number)}
                  className="p-1 hover:text-foreground text-muted-foreground transition-colors"
                  title="Copy STK"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3">
              <dt className="text-muted-foreground">Chủ tài khoản:</dt>
              <dd className="font-medium text-foreground">{bankInfo.account_name}</dd>
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/30">
              <dt className="text-muted-foreground">Số tiền:</dt>
              <div className="flex items-center gap-2">
                <dd className="font-bold text-sm text-foreground font-serif">{formatVND(awaiting.grandTotalVnd)}</dd>
                <button
                  type="button"
                  onClick={() => copyText("Số tiền", String(awaiting.grandTotalVnd))}
                  className="p-1 hover:text-foreground text-muted-foreground transition-colors"
                  title="Copy số tiền"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-500/10">
              <div>
                <dt className="font-semibold text-amber-700 dark:text-amber-400">Nội dung CK (Bắt buộc):</dt>
                <span className="text-[10px] text-muted-foreground">Chuyển đúng để hệ thống tự động xác nhận</span>
              </div>
              <div className="flex items-center gap-2">
                <dd className="font-mono font-bold text-base text-foreground">{awaiting.orderNumber}</dd>
                <button
                  type="button"
                  onClick={() => copyText("Nội dung chuyển khoản", awaiting.orderNumber)}
                  className="p-1 hover:text-foreground text-muted-foreground transition-colors"
                  title="Copy nội dung"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </dl>

          {/* Live signal indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-secondary/40 py-2.5 px-4">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />
            <span>Đang lắng nghe tín hiệu chuyển khoản từ ngân hàng…</span>
          </div>
        </div>

        {/* Right Column: Order Items & Delivery Summary */}
        <div className="space-y-6">
          <div className="border border-border bg-secondary/30 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-serif text-lg">Chi Tiết Đơn Hàng</h3>
              <span className="font-mono text-xs text-muted-foreground">#{awaiting.orderNumber}</span>
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
                        {it.size_label && <span>Size {it.size_label}</span>}
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
                Đang tải tóm tắt đơn hàng…
              </div>
            )}

            {/* Financial breakdown */}
            {orderDetail && (
              <div className="border-t border-border pt-4 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Tạm tính hàng:</span>
                  <span>{formatVND(orderDetail.subtotal_vnd)}</span>
                </div>
                {orderDetail.discount_vnd > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Giảm giá ({orderDetail.discount_code}):</span>
                    <span>-{formatVND(orderDetail.discount_vnd)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Phí vận chuyển:</span>
                  <span>{orderDetail.shipping_vnd === 0 ? "Miễn phí" : formatVND(orderDetail.shipping_vnd)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border text-foreground font-semibold text-sm">
                  <span>Tổng thanh toán:</span>
                  <span className="font-serif text-lg text-foreground">{formatVND(orderDetail.grand_total_vnd)}</span>
                </div>
              </div>
            )}

            {/* Delivery address snapshot */}
            {orderDetail && orderDetail.recipient && (
              <div className="border-t border-border pt-4 text-xs space-y-1">
                <p className="font-medium text-foreground">
                  Giao đến: {orderDetail.recipient.full_name} ({orderDetail.recipient.phone})
                </p>
                <p className="text-muted-foreground">
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
  const { cart, subtotal, placeOrder, user, sessionReady } = useStore();
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
  const shipping = subtotal >= FREE_SHIP ? 0 : 30000;
  const discount = applied?.discount_vnd ?? 0;
  const grand = Math.max(0, subtotal + shipping - discount);

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
          setSuccess({ orderId: awaiting.orderId, orderNumber: awaiting.orderNumber, paymentMethod: "bank" });
          setAwaiting(null);
        }}
        onCancelled={() => {
          setAwaiting(null);
          void nav({ to: "/" });
        }}
      />
    );
  }

  if (awaiting && !bankInfo) {
    return <div className="py-32 text-center text-muted-foreground">Đang tải thông tin chuyển khoản…</div>;
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
      <div className="py-32 text-center">
        <h1 className="text-3xl">Giỏ hàng của bạn đang trống</h1>
        <Link to="/" className="mt-6 inline-block underline">Về trang chủ</Link>
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
          void (async () => {
            setSubmitting(true);
            try {
              const result = await placeOrder({
                fullName: String(f.get("name")),
                phone: String(f.get("phone")),
                email: String(f.get("email")),
                address: String(f.get("address")),
                city: String(f.get("city")),
                district: String(f.get("district")),
                note: String(f.get("note") || "") || undefined,
                paymentMethod: pay,
                total: grand,
                couponCode: applied?.code,
              });
              if (result.paymentMethod === "bank") {
                setAwaiting({
                  orderId: result.id,
                  orderNumber: result.orderNumber,
                  grandTotalVnd: result.grandTotalVnd,
                });
              } else {
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
          <fieldset className="space-y-3">
            <legend className="mb-4 text-xs uppercase tracking-widest">Thông tin giao hàng</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <input required name="name" defaultValue={user.name} placeholder="Họ và tên" className={input} aria-label="Họ và tên" />
              <input required name="phone" type="tel" defaultValue={user.phone} placeholder="Số điện thoại" className={input} aria-label="Số điện thoại" />
            </div>
            <input required name="email" type="email" defaultValue={user.email} placeholder="Email" className={input} aria-label="Email" />
            <input required name="address" placeholder="Địa chỉ" className={input} aria-label="Địa chỉ" />
            <div className="grid gap-3 md:grid-cols-2">
              <input required name="city" placeholder="Tỉnh / Thành phố" className={input} aria-label="Tỉnh / Thành phố" />
              <input required name="district" placeholder="Quận / Huyện" className={input} aria-label="Quận / Huyện" />
            </div>
            <textarea name="note" placeholder="Ghi chú đơn hàng" className={input} rows={3} aria-label="Ghi chú" />
          </fieldset>
          <fieldset>
            <legend className="mb-4 text-xs uppercase tracking-widest">Phương thức thanh toán</legend>
            <div className="divide-y divide-border border border-border">
              {([["cod", "Thanh toán khi nhận hàng (COD)"], ["bank", "Chuyển khoản ngân hàng"]] as const).map(([v, l]) => (
                <label key={v} className="flex cursor-pointer items-center gap-3 px-4 py-4 text-sm">
                  <input type="radio" name="pay" value={v} checked={pay === v} onChange={() => setPay(v)} className="accent-foreground" /> {l}
                </label>
              ))}
            </div>
            {pay === "bank" && bankInfo && (
              <div className="mt-4 space-y-1 border border-border bg-secondary/40 px-4 py-4 text-sm text-muted-foreground">
                <p><span className="text-foreground">{bankInfo.bank_name}</span> · {bankInfo.account_number}</p>
                <p>{bankInfo.account_name}</p>
                <p className="pt-1 text-xs">Nội dung chuyển khoản = mã đơn (hiện sau khi đặt).</p>
              </div>
            )}
          </fieldset>
        </div>
        <aside className="h-fit bg-secondary p-8">
          <h2 className="text-xl">Đơn hàng ({cart.length})</h2>
          <ul className="mt-6 space-y-4">
            {cart.map((it, i) => {
              const p = products.find((x) => x.id === it.productId)!;
              return (
                <li key={i} className="flex gap-3 text-sm">
                  <img src={p.images[0]} alt={p.name} className="h-20 w-15 object-cover" />
                  <div className="flex-1"><p>{p.name}</p><p className="text-xs text-muted-foreground">{it.sku} · {it.size} · x{it.qty}</p></div>
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
