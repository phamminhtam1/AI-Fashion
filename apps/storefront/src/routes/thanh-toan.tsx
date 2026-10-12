import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Gift,
  HeartHandshake,
  Loader2,
  MapPin,
  Package,
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
import { VIETNAM_PROVINCES, getDistrictsByProvince } from "@/lib/vietnam-address";
import { fireCheckoutCelebration } from "@/lib/celebrate";

export const Route = createFileRoute("/thanh-toan")({
  validateSearch: (s: Record<string, unknown>): { orderId?: string; buyNow?: boolean } => {
    const res: { orderId?: string; buyNow?: boolean } = {};
    const oId = s["orderId"];
    if (typeof oId === "string" && oId.length > 0) res.orderId = oId;
    if (s["buyNow"] === true || s["buyNow"] === "true" || s["buyNow"] === 1 || s["buyNow"] === "1") {
      res.buyNow = true;
    }
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

const input = "w-full border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-foreground transition-colors";

type AwaitingBank = {
  orderId: string;
  orderNumber: string;
  grandTotalVnd: number;
  createdAt?: number;
};

const ORDER_EXPIRE_SECONDS = 15 * 60;

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type Success = {
  orderId?: string;
  orderNumber: string;
  paymentMethod: "cod" | "bank";
};

function PaymentOrderSummary({
  order,
  total,
  orderNumber,
  failed = false,
}: {
  order: StoreOrderDetail | null;
  total?: number;
  orderNumber: string;
  failed?: boolean;
}) {
  return (
    <aside className="border-t border-border pt-8 lg:border-t-0 lg:border-l lg:border-border lg:pl-10 lg:pt-0" aria-label="Tóm tắt đơn hàng">
      <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-border">
        <h2 className="text-xl sm:text-2xl font-serif">Đơn hàng của bạn</h2>
        <span className="text-xs uppercase tracking-wider font-mono text-muted-foreground">#{orderNumber}</span>
      </div>
      {order ? (
        <ul className="divide-y divide-border/60">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-4 first:pt-0">
              {item.image_url ? (
                <img
                  className="h-28 w-21 object-cover bg-secondary shrink-0 border border-border/80"
                  src={item.image_url}
                  alt={item.product_name}
                />
              ) : (
                <div
                  className="h-28 w-21 bg-secondary flex items-center justify-center text-muted-foreground shrink-0 border border-border/80"
                  aria-hidden="true"
                >
                  <Package className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm sm:text-[15px] font-medium leading-snug line-clamp-2">{item.product_name}</h3>
                  <div className="text-xs text-muted-foreground mt-1">
                    {[item.color_label, item.size_label ? `Size ${item.size_label}` : null, `Số lượng ${item.qty}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="text-sm font-medium mt-2 font-mono">{formatVND(item.line_total_vnd)}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground" role="status">
          {failed ? "Chưa tải được chi tiết. Bạn có thể xem lại đơn hàng trong tài khoản." : "Đang tải đơn hàng…"}
        </p>
      )}
      <dl className="mt-6 pt-4 border-t border-border space-y-2.5 text-sm">
        {order && (
          <>
            <div className="flex justify-between text-muted-foreground">
              <dt>Tạm tính</dt>
              <dd className="text-foreground font-medium font-mono">{formatVND(order.subtotal_vnd)}</dd>
            </div>
            {order.discount_vnd > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <dt>Giảm giá{order.discount_code ? ` (${order.discount_code})` : ""}</dt>
                <dd className="font-mono">−{formatVND(order.discount_vnd)}</dd>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <dt>Vận chuyển</dt>
              <dd className="text-foreground font-medium font-mono">
                {order.shipping_vnd === 0 ? "Miễn phí" : formatVND(order.shipping_vnd)}
              </dd>
            </div>
          </>
        )}
        {(total !== undefined || order) && (
          <div className="flex items-baseline justify-between pt-3 border-t border-border text-base font-medium">
            <dt className="font-serif text-xl">Tổng cộng</dt>
            <dd className="text-lg text-xl font-mono font-semibold text-foreground">
              {formatVND(total ?? order!.grand_total_vnd)}
            </dd>
          </div>
        )}
      </dl>
      {order?.recipient && (
        <div className="mt-6 p-4 bg-[#fbfbf8] dark:bg-muted/30 border border-border text-sm space-y-1 leading-relaxed">
          <p className="uppercase tracking-widest text-muted-foreground font-semibold">Giao đến: </p>
          <p className="font-medium text-foreground">
            {order.recipient.full_name || order.recipient.recipient_name} · {order.recipient.phone}
          </p>
          <p className="text-muted-foreground">
            {order.shipping_address?.full_address ||
              [order.shipping_address?.address_line, order.shipping_address?.district, order.shipping_address?.city]
                .filter(Boolean)
                .join(", ")}
          </p>
        </div>
      )}
    </aside>
  );
}

function SuccessScreen({ done }: { done: Success }) {
  const { refreshOrders } = useStore();
  const [order, setOrder] = useState<StoreOrderDetail | null>(null);
  const [orderLoadFailed, setOrderLoadFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void refreshOrders();
    try {
      fireCheckoutCelebration();
    } catch { }
  }, [refreshOrders]);

  useEffect(() => {
    if (!done.orderId) {
      setOrderLoadFailed(true);
      return;
    }
    let active = true;
    void storeApi
      .order(done.orderId)
      .then((data) => {
        if (active) setOrder(data);
      })
      .catch(() => {
        if (active) setOrderLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [done.orderId]);

  const handleCopyOrderNumber = () => {
    void navigator.clipboard.writeText(done.orderNumber).then(
      () => {
        setCopied(true);
        toast.success("Đã sao chép mã đơn hàng");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Không thể sao chép"),
    );
  };

  return (
    <main className="min-h-screen bg-[#ffffff] px-4 py-10 text-[#171717] sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Thank-you header */}
        <header className="relative mb-9 border-b border-[#e5e5e5] pb-9 sm:mb-12 sm:pb-12">
          <div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e0e0e0] bg-[#f5f5f5] px-3.5 py-2 text-xs font-medium text-[#333333]">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                Đặt hàng thành công
              </div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#666666] sm:text-xs">
                ÉLANE · Một chút yêu thương dành cho bạn
              </p>
              <h1 className="font-serif text-4xl leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
                Cảm ơn bạn đã chọn
                <span className="mt-1 block italic text-[#111111]">ÉLANE.</span>
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#666666] sm:text-base">
                Những thiết kế bạn yêu thích đã được ghi nhận trong đơn hàng.
                Cảm ơn bạn đã để ÉLANE đồng hành cùng phong cách của mình.
              </p>
            </div>

            <div aria-hidden="true" className="relative hidden h-44 w-44 shrink-0 items-center justify-center sm:flex lg:mr-8 lg:h-52 lg:w-52">
              <div className="absolute inset-0 rounded-full border border-[#e5e5e5]" />
              <div className="absolute inset-4 rounded-full bg-[#f0f0f0]" />
              <div className="absolute inset-8 rounded-full border border-white/80" />
              <Gift className="relative h-14 w-14 -rotate-6 stroke-[1.1] text-[#111111] lg:h-16 lg:w-16" />
              <span className="absolute bottom-5 right-3 flex h-11 w-11 items-center justify-center rounded-full border-[5px] border-[#ffffff] bg-[#111111] text-white">
                <Check className="h-4 w-4" />
              </span>
            </div>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Order contents and delivery */}
          <div className="space-y-6 lg:col-span-2">
            <section aria-labelledby="order-heading" className="overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ededed] px-5 py-5 sm:px-7 sm:py-6">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#666666]">
                    Dành riêng cho bạn
                  </p>
                  <h2 id="order-heading" className="font-serif text-2xl">Đơn hàng của bạn</h2>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-[#f7f7f7] py-1 pl-4 pr-1">
                  <span className="text-xs font-semibold tracking-wide text-[#111111]">#{done.orderNumber}</span>
                  <button
                    type="button"
                    onClick={handleCopyOrderNumber}
                    title={copied ? "Đã sao chép" : "Sao chép mã đơn"}
                    aria-label={copied ? "Đã sao chép mã đơn hàng" : "Sao chép mã đơn hàng"}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#666666] transition-colors hover:bg-[#eeeeee] hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"
                  >
                    {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                  </button>
                  <span role="status" aria-live="polite" className="sr-only">{copied ? "Đã sao chép mã đơn hàng" : ""}</span>
                </div>
              </div>

              {order?.items && order.items.length > 0 ? (
                <ul className="divide-y divide-[#ededed] px-5 sm:px-7">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-start gap-4 py-5 sm:items-center sm:gap-5 sm:py-6">
                      <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f7f7f7] sm:h-28 sm:w-24">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[#666666]">
                            <Package aria-hidden="true" className="h-7 w-7 stroke-[1.3]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <h3 className="break-words font-serif text-sm font-medium leading-6 sm:text-base">{item.product_name}</h3>
                          <p className="mt-1.5 text-xs leading-5 text-[#666666]">
                            {[item.color_label, item.size_label ? `Size ${item.size_label}` : null].filter(Boolean).join(" · ")}
                          </p>
                          <p className="mt-2 text-xs text-[#666666]">Số lượng: {item.qty}</p>
                        </div>
                        <p className="mt-3 shrink-0 text-sm font-semibold tabular-nums text-[#111111] sm:mt-0 sm:text-right">
                          {formatVND(item.line_total_vnd)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-sm leading-6 text-[#666666] sm:px-7">
                  Chi tiết sản phẩm chưa có sẵn. Bạn có thể xem lại trong mục đơn hàng.
                </p>
              )}

              {order?.recipient && (
                <div className="mx-5 mb-5 rounded-2xl bg-[#ffffff] p-4 sm:mx-7 sm:mb-7 sm:p-5">
                  <div className="flex items-start gap-3">
                    <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#666666]" />
                    <div className="min-w-0 text-sm">
                      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#666666]">Địa chỉ nhận hàng</h3>
                      <p className="break-words font-medium">
                        {order.recipient.full_name}
                        {order.recipient.phone && <span className="font-normal text-[#666666]"> · {order.recipient.phone}</span>}
                      </p>
                      <p className="mt-1.5 break-words leading-6 text-[#666666]">
                        {[order.shipping_address?.address_line, order.shipping_address?.district, order.shipping_address?.city].filter(Boolean).join(", ") || "Địa chỉ chưa có sẵn."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section aria-labelledby="journey-heading" className="rounded-3xl border border-[#e5e5e5] bg-white px-5 py-6 sm:p-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <h2 id="journey-heading" className="font-serif text-xl">Hành trình đơn hàng</h2>
                <span className="rounded-full bg-[#f5f5f5] px-3 py-1.5 text-[11px] font-medium text-[#333333]">Đã ghi nhận đơn</span>
              </div>
              <ol className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-x-0">
                {[
                  { label: "Xác nhận", description: "Đơn đã được ghi nhận", complete: true },
                  { label: "Chuẩn bị", description: "Kiểm tra & đóng gói", complete: false },
                  { label: "Vận chuyển", description: "Chuyển đến bạn", complete: false },
                  { label: "Nhận hàng", description: "Hoàn tất giao nhận", complete: false },
                ].map((step, index) => (
                  <li key={step.label} aria-current={step.complete ? "step" : undefined} className="relative sm:pr-3">
                    {index < 3 && <div aria-hidden="true" className="absolute left-10 right-0 top-4 hidden h-px bg-[#e5e5e5] sm:block" />}
                    <span className={`relative mb-3 flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${step.complete ? "bg-[#111111] text-white ring-4 ring-[#eeeeee]" : "border border-[#e5e5e5] bg-white text-[#666666]"}`}>
                      {step.complete ? <Check aria-hidden="true" className="h-4 w-4" /> : <span aria-hidden="true">{index + 1}</span>}
                    </span>
                    <p className={`text-xs font-medium ${step.complete ? "text-[#111111]" : "text-[#666666]"}`}>{step.label}</p>
                    <p className="mt-1.5 text-[11px] leading-5 text-[#666666]">{step.description}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Receipt and primary actions */}
          <aside aria-labelledby="receipt-heading" className="overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white shadow-[0_8px_32px_-20px_rgba(0,0,0,0.08)] lg:sticky lg:top-8">
            <div className="bg-[#f2f2f2] px-5 py-6 sm:px-7">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#666666]">Order confirmation</p>
              <h2 id="receipt-heading" className="font-serif text-2xl text-[#171717]">Một lựa chọn thật đẹp.</h2>
              <p className="mt-2 text-xs leading-6 text-[#666666]">ÉLANE trân quý sự tin tưởng của bạn.</p>
            </div>
            <div className="p-5 sm:p-7">
              <dl className="space-y-5 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="shrink-0 text-[#666666]">Mã đơn hàng</dt>
                  <dd className="break-all text-right font-medium">#{done.orderNumber}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="shrink-0 text-[#666666]">Ngày đặt</dt>
                  <dd className="text-right text-xs leading-5">
                    {order?.placed_at
                      ? new Date(order.placed_at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="shrink-0 text-[#666666]">Thanh toán</dt>
                  <dd className="text-right text-xs font-medium">
                    {done.paymentMethod === "bank" ? (
                      <span className="inline-flex items-center justify-end gap-1.5 text-[#333333]">
                        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />Đã thanh toán VietQR
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-end gap-1.5 text-[#555555]">
                        <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />COD khi nhận hàng
                      </span>
                    )}
                  </dd>
                </div>
                <div className="border-t border-dashed border-[#e5e5e5] pt-5">
                  <dt className="text-xs text-[#666666]">Tổng thanh toán</dt>
                  <dd className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums text-[#111111]">
                    {order ? formatVND(order.grand_total_vnd) : "—"}
                  </dd>
                  <p className="mt-2 text-xs leading-5 text-[#666666]">
                    {done.paymentMethod === "bank" ? "Thanh toán của bạn đã được ghi nhận." : "Bạn sẽ thanh toán khi nhận được đơn hàng."}
                  </p>
                </div>
              </dl>

              <div className="mt-7 space-y-3">
                <Link
                  to="/tai-khoan"
                  search={{ tab: "orders" }}
                  className="group flex min-h-[52px] items-center justify-center gap-3 rounded-xl bg-[#111111] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#333333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"
                >
                  Theo dõi đơn hàng
                  <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
                </Link>
                <Link
                  to="/"
                  className="flex min-h-[52px] items-center justify-center rounded-xl border border-[#e5e5e5] px-4 py-3 text-sm font-medium text-[#111111] transition-colors hover:border-[#111111] hover:bg-[#f7f7f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"
                >
                  Tiếp tục mua sắm
                </Link>
              </div>
              <p className="mt-5 text-center text-[11px] leading-5 text-[#666666]">Đơn hàng được gửi đi cùng sự chỉn chu của ÉLANE.</p>
            </div>
          </aside>
        </div>

        {/* Boutique service details */}
        <footer className="mt-9 border-t border-[#e5e5e5] pt-7 sm:mt-12 sm:pt-8">
          <div className="grid gap-6 sm:grid-cols-3 sm:gap-7">
            {[
              { Icon: Gift, title: "Gói ghém yêu thương", text: "Hộp quà và nơ lụa ÉLANE, chỉn chu trong từng chi tiết." },
              { Icon: ShieldCheck, title: "Đổi size trong 30 ngày", text: "An tâm chọn thiết kế yêu thích, hỗ trợ đổi size theo chính sách." },
              { Icon: HeartHandshake, title: "Luôn sẵn sàng lắng nghe", text: "Đội ngũ ÉLANE đồng hành cùng bạn trong suốt quá trình mua sắm." },
            ].map(({ Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eeeeee] text-[#111111]">
                  <Icon aria-hidden="true" className="h-4 w-4 stroke-[1.5]" />
                </span>
                <div>
                  <h2 className="text-xs font-semibold">{title}</h2>
                  <p className="pt-1 max-w-xs text-xs leading-4 text-[#666666]">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-9 text-center font-serif text-sm italic text-[#666666]">With love, ÉLANE.</p>
        </footer>
      </div>
    </main>
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
  const [qrFailed, setQrFailed] = useState(false);
  const [orderLoadFailed, setOrderLoadFailed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (awaiting.createdAt) {
      const elapsed = Math.floor((Date.now() - awaiting.createdAt) / 1000);
      return Math.max(0, ORDER_EXPIRE_SECONDS - elapsed);
    }
    return ORDER_EXPIRE_SECONDS;
  });
  const onPaidRef = useRef(onPaid);
  const onCancelledRef = useRef(onCancelled);
  onPaidRef.current = onPaid;
  onCancelledRef.current = onCancelled;

  // Tick countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = window.setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timeLeft]);

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
        if (active) {
          setOrderDetail(data);
          if (data.placed_at) {
            const placed = new Date(data.placed_at).getTime();
            if (!Number.isNaN(placed)) {
              const elapsed = Math.floor((Date.now() - placed) / 1000);
              setTimeLeft(Math.max(0, ORDER_EXPIRE_SECONDS - elapsed));
            }
          }
        }
      })
      .catch(() => {
        if (active) setOrderLoadFailed(true);
      });
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
  }, [awaiting.orderId, refreshOrders]);

  const handleManualCheck = async () => {
    if (checkingManual) return;
    setCheckingManual(true);
    try {
      const st = await checkPaymentStatus(awaiting.orderId);
      if (st.is_paid) {
        toast.success("Thanh toán thành công! Đơn hàng đã được xác nhận.");
        void refreshOrders();
        sessionStorage.removeItem("elane_awaiting_bank_order");
        onPaidRef.current();
      } else {
        toast.info(
          "Hệ thống đang chờ ngân hàng đối soát. Quý khách vui lòng đợi từ 3 - 5 giây hoặc kiểm tra lại nội dung chuyển khoản.",
        );
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

  const copyButton = (key: string, label: string, value: string) => (
    <button
      type="button"
      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors cursor-pointer"
      onClick={() => handleCopy(key, label, value)}
      aria-label={copiedKey === key ? `Đã sao chép ${label}` : `Sao chép ${label}`}
      title={`Sao chép ${label}`}
    >
      {copiedKey === key ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  return (
    <main className="mx-auto max-w-[1160px] px-4 sm:px-8 py-10 sm:py-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] items-start">
        <section aria-labelledby="payment-heading">
          <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-border">
            <h2 id="payment-heading" className="text-xl sm:text-2xl font-serif">
              Thanh toán qua VietQR
            </h2>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Chuyển khoản ngân hàng</span>
          </div>

          <div className="bg-[#f6f6f2] dark:bg-muted/30 border border-border/80 p-6 sm:p-8 text-center">
            <div
              className={`inline-flex items-center justify-center gap-2 px-3.5 py-1.5 text-xs border mb-5 shadow-xs transition-colors ${timeLeft === 0
                ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
                : timeLeft <= 180
                  ? "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300"
                  : "border-border bg-background text-muted-foreground"
                }`}
              role="timer"
              aria-live="polite"
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {timeLeft === 0 ? (
                  <strong className="font-semibold">Đã hết thời gian thanh toán</strong>
                ) : (
                  <>
                    Thời gian thanh toán còn lại:{" "}
                    <strong className="font-semibold font-mono">{formatCountdown(timeLeft)}</strong>
                  </>
                )}
              </span>
            </div>

            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Số tiền thanh toán</p>
            <div className="text-3xl sm:text-4xl font-mono tracking-tight my-2 text-foreground font-normal">
              {formatVND(awaiting.grandTotalVnd)}
            </div>

            <div className="relative mx-auto w-[248px] h-[248px] bg-white p-2.5 shadow-sm border border-border/80 flex items-center justify-center overflow-hidden my-4">
              {qrFailed ? (
                <p className="p-4 text-xs text-muted-foreground text-center" role="alert">
                  Chưa tải được mã QR. Vui lòng dùng thông tin chuyển khoản bên dưới.
                </p>
              ) : (
                <>
                  <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-600 rounded-tl pointer-events-none z-10" aria-hidden="true" />
                  <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-600 rounded-tr pointer-events-none z-10" aria-hidden="true" />
                  <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-600 rounded-bl pointer-events-none z-10" aria-hidden="true" />
                  <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-600 rounded-br pointer-events-none z-10" aria-hidden="true" />
                  <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-[0_0_12px_rgba(245,158,11,0.95),0_0_4px_rgba(245,158,11,1)] animate-qr-scan pointer-events-none z-10" aria-hidden="true" />
                  <img
                    src={qr}
                    alt={`Mã thanh toán VietQR cho đơn ${awaiting.orderNumber}`}
                    loading="eager"
                    className="w-full h-full object-contain select-none"
                    onError={() => setQrFailed(true)}
                  />
                </>
              )}
            </div>

            <p className="text-xs sm:text-[13px] text-muted-foreground mt-3 max-w-xs mx-auto leading-relaxed">
              Mở ứng dụng ngân hàng, quét mã và xác nhận chuyển khoản.
            </p>

            {!qrFailed && (
              <div className="mt-3">
                <a
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                  href={qr}
                  download={`VietQR-${awaiting.orderNumber}.png`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Lưu / mở mã QR
                </a>
              </div>
            )}
          </div>

          <p className="flex items-center justify-center gap-2.5 my-5 text-xs sm:text-[13px] text-muted-foreground" role="status">
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            </span>
            Đang chờ thanh toán · Tự động cập nhật
          </p>

          <button
            className="w-full min-h-[48px] bg-foreground text-background flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-semibold hover:bg-foreground/90 transition-colors cursor-pointer disabled:opacity-50"
            type="button"
            onClick={() => void handleManualCheck()}
            disabled={checkingManual}
          >
            {checkingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {checkingManual ? "Đang kiểm tra…" : "Tôi đã chuyển khoản"}
          </button>

          <details className="group mt-6 border-y border-border" key={qrFailed ? "fallback" : "normal"} open={qrFailed ? true : undefined}>
            <summary className="flex items-center justify-between py-4 cursor-pointer text-xs uppercase tracking-wider font-semibold select-none list-none text-foreground hover:text-muted-foreground transition-colors">
              <span>Chuyển khoản thủ công</span>
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="pb-4 space-y-2.5 text-sm divide-y divide-border/40">
              <div className="flex items-center justify-between pt-2.5">
                <dt className="text-xs uppercase text-muted-foreground">Ngân hàng</dt>
                <dd className="font-medium text-foreground">{bankInfo.bank_name || bankCode}</dd>
              </div>
              <div className="flex items-center justify-between pt-2.5">
                <dt className="text-xs uppercase text-muted-foreground">Chủ tài khoản</dt>
                <dd className="font-medium text-foreground">{bankInfo.account_name}</dd>
              </div>
              <div className="flex items-center justify-between pt-2.5">
                <dt className="text-xs uppercase text-muted-foreground">Số tài khoản</dt>
                <dd className="flex items-center gap-2 font-mono font-medium text-foreground">
                  <span>{bankInfo.account_number}</span>
                  {copyButton("acc", "số tài khoản", bankInfo.account_number)}
                </dd>
              </div>
              <div className="flex items-center justify-between pt-2.5">
                <dt className="text-xs uppercase text-muted-foreground">Số tiền</dt>
                <dd className="flex items-center gap-2 font-mono font-medium text-foreground">
                  <span>{formatVND(awaiting.grandTotalVnd)}</span>
                  {copyButton("amount", "số tiền", String(awaiting.grandTotalVnd))}
                </dd>
              </div>
              <div className="flex items-center justify-between pt-2.5">
                <dt className="text-xs uppercase text-muted-foreground">Nội dung</dt>
                <dd className="flex items-center gap-2 font-mono font-semibold text-foreground tracking-wider">
                  <span>{awaiting.orderNumber}</span>
                  {copyButton("des", "nội dung chuyển khoản", awaiting.orderNumber)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground italic pb-3">Chuyển đúng số tiền và nội dung để đơn hàng được xác nhận.</p>
          </details>

          <div className="mt-6 flex justify-center">
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors cursor-pointer disabled:opacity-50"
              type="button"
              disabled={cancelling}
              onClick={() => void cancel()}
            >
              {cancelling ? "Đang hủy…" : "Hủy đơn hàng"}
            </button>
          </div>

          <span className="sr-only" role="status">
            {copiedKey ? "Đã sao chép thông tin chuyển khoản" : ""}
          </span>
        </section>

        <PaymentOrderSummary
          order={orderDetail}
          total={awaiting.grandTotalVnd}
          orderNumber={awaiting.orderNumber}
          failed={orderLoadFailed}
        />
      </div>
    </main>
  );
}

function Checkout() {
  const { cart, placeOrder, user, sessionReady, refreshOrders, setCartOpen, buyNowItem } = useStore();
  const search = Route.useSearch();
  const nav = useNavigate();

  useEffect(() => {
    setCartOpen(false);
  }, [setCartOpen]);

  const isBuyNowMode = Boolean(search.buyNow && buyNowItem);
  const checkoutItems = isBuyNowMode && buyNowItem ? [buyNowItem] : cart;
  const currentSubtotal = checkoutItems.reduce((acc, it) => {
    const p = products.find((x) => x.id === it.productId);
    const pr = p ? p.salePrice ?? p.price : 0;
    return acc + pr * it.qty;
  }, 0);

  const [awaiting, setAwaiting] = useState<AwaitingBank | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [pay, setPay] = useState<"cod" | "bank">("cod");
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState<boolean>(Boolean(search.orderId));
  const [couponInput, setCouponInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount_vnd: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const shipping = currentSubtotal >= FREE_SHIP ? 0 : 30000;
  const discount = applied?.discount_vnd ?? 0;
  const grand = Math.max(0, currentSubtotal + shipping - discount);
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
      const res = await storeApi.previewCoupon({ code, subtotal_vnd: currentSubtotal });
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
      setLoadingOrder(true);
      checkPaymentStatus(search.orderId)
        .then((st) => {
          if (st.is_paid) {
            setSuccess({ orderId: st.id, orderNumber: st.order_number, paymentMethod: (st.payment_method as "bank" | "cod") || "bank" });
          } else if (st.payment_method === "bank" && st.status === "pending") {
            setAwaiting({
              orderId: st.id,
              orderNumber: st.order_number,
              grandTotalVnd: st.grand_total_vnd,
              createdAt: Date.now(),
            });
          } else if (st.status === "cancelled" || st.payment_status === "failed") {
            toast.error("Đơn hàng này đã bị hủy hoặc hết hạn thanh toán");
            try {
              sessionStorage.removeItem("elane_awaiting_bank_order");
            } catch { }
            void nav({ to: "/", search: {}, replace: true });
          } else if (st.payment_method === "cod") {
            setSuccess({ orderId: st.id, orderNumber: st.order_number, paymentMethod: "cod" });
          }
        })
        .catch(() => {
          toast.error("Không tìm thấy thông tin đơn hàng");
        })
        .finally(() => {
          setLoadingOrder(false);
        });
      return;
    }

    try {
      const saved = sessionStorage.getItem("elane_awaiting_bank_order");
      if (saved) {
        const parsed = JSON.parse(saved) as AwaitingBank;
        if (parsed?.orderId) {
          if (!parsed.createdAt) parsed.createdAt = Date.now();
          setLoadingOrder(true);
          checkPaymentStatus(parsed.orderId)
            .then((st) => {
              if (st.is_paid) {
                sessionStorage.removeItem("elane_awaiting_bank_order");
                setSuccess({ orderId: st.id, orderNumber: st.order_number, paymentMethod: "bank" });
                void nav({ to: "/thanh-toan", search: { orderId: st.id }, replace: true });
              } else if (st.status !== "cancelled" && st.payment_status !== "failed") {
                setAwaiting(parsed);
                void nav({ to: "/thanh-toan", search: { orderId: parsed.orderId }, replace: true });
              } else {
                sessionStorage.removeItem("elane_awaiting_bank_order");
              }
            })
            .catch(() => {
              setAwaiting(parsed);
              void nav({ to: "/thanh-toan", search: { orderId: parsed.orderId }, replace: true });
            })
            .finally(() => {
              setLoadingOrder(false);
            });
        }
      }
    } catch {
      /* ignore parse error */
    }
  }, [search.orderId, nav]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!user) {
      void nav({
        to: "/dang-nhap",
        search: { next: search.orderId ? `/thanh-toan?orderId=${search.orderId}` : (isBuyNowMode ? "/thanh-toan?buyNow=true" : "/thanh-toan") },
      });
    }
  }, [sessionReady, user, nav, isBuyNowMode, search.orderId]);

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

  if (loadingOrder) {
    return (
      <div className="py-32 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Đang tải thông tin đơn hàng…</p>
      </div>
    );
  }

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
          } catch { }
          void refreshOrders();
          setSuccess({ orderId: awaiting.orderId, orderNumber: awaiting.orderNumber, paymentMethod: "bank" });
          setAwaiting(null);
          void nav({ to: "/thanh-toan", search: { orderId: awaiting.orderId }, replace: true });
        }}
        onCancelled={() => {
          try {
            sessionStorage.removeItem("elane_awaiting_bank_order");
          } catch { }
          setAwaiting(null);
          void nav({ to: "/", search: {}, replace: true });
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

  if (checkoutItems.length === 0)
    return (
      <div className="py-32 text-center space-y-4">
        <h1 className="text-3xl font-serif">
          {isBuyNowMode ? "Không có sản phẩm nào cần thanh toán" : "Giỏ hàng của bạn đang trống"}
        </h1>
        <p className="text-xs text-muted-foreground">Hãy chọn các thiết kế thanh lịch từ bộ sưu tập của chúng tôi.</p>
        <Link
          to="/"
          className="inline-block border border-foreground px-8 py-3 text-xs uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
        >
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
                isBuyNow: isBuyNowMode,
              });
              if (result.paymentMethod === "bank") {
                const aw: AwaitingBank = {
                  orderId: result.id,
                  orderNumber: result.orderNumber,
                  grandTotalVnd: result.grandTotalVnd,
                  createdAt: Date.now(),
                };
                try {
                  sessionStorage.setItem("elane_awaiting_bank_order", JSON.stringify(aw));
                } catch { }
                setAwaiting(aw);
                void nav({ to: "/thanh-toan", search: { orderId: result.id }, replace: true });
              } else {
                try {
                  sessionStorage.removeItem("elane_awaiting_bank_order");
                } catch { }
                setSuccess({ orderId: result.id, orderNumber: result.orderNumber, paymentMethod: "cod" });
                void nav({ to: "/thanh-toan", search: { orderId: result.id }, replace: true });
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
            <legend className="mb-4 text-sm uppercase tracking-widest font-semibold">Thông tin giao hàng</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13.5px] uppercase tracking-wider text-muted-foreground">
                  Họ và tên <span className="text-destructive">*</span>
                </label>
                <input required name="name" defaultValue={user.name} placeholder="Họ và tên" className={input} aria-label="Họ và tên" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13.5px] uppercase tracking-wider text-muted-foreground">
                  Số điện thoại <span className="text-destructive">*</span>
                </label>
                <input
                  required
                  name="phone"
                  type="tel"
                  defaultValue={user.phone}
                  placeholder="Số điện thoại"
                  className={input}
                  aria-label="Số điện thoại"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[13.5px] uppercase tracking-wider text-muted-foreground">
                Email nhận thông báo <span className="text-destructive">*</span>
              </label>
              <input required name="email" type="email" defaultValue={user.email} placeholder="Email" className={input} aria-label="Email" />
            </div>

            {/* Chuẩn Tỉnh thành & Quận huyện Việt Nam */}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13.5px] uppercase tracking-wider text-muted-foreground">
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
                <label className="mb-1.5 block text-[13.5px] uppercase tracking-wider text-muted-foreground">
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
              <label className="mb-1.5 block text-[13.5px] uppercase tracking-wider text-muted-foreground">
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
              <label className="mb-1.5 block text-[13.5px] uppercase tracking-wider text-muted-foreground">
                Ghi chú giao hàng
              </label>
              <textarea
                name="note"
                placeholder="Ghi chú đơn hàng (ví dụ: giao giờ hành chính, gọi trước khi giao...)"
                className={input}
                rows={3}
                aria-label="Ghi chú"
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-4 text-sm uppercase tracking-widest font-semibold">Phương thức thanh toán</legend>
            <div className="divide-y divide-border border border-border">
              {([["cod", "Thanh toán khi nhận hàng (COD)"], ["bank", "Chuyển khoản ngân hàng"]] as const).map(
                ([v, l]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-3 px-4 py-4 text-[15px]">
                    <input
                      type="radio"
                      name="pay"
                      value={v}
                      checked={pay === v}
                      onChange={() => setPay(v)}
                      className="accent-foreground"
                    />{" "}
                    {l}
                  </label>
                ),
              )}
            </div>
          </fieldset>
        </div>

        <aside className="h-fit bg-secondary p-8">
          <ul className=" space-y-4">
            {checkoutItems.map((it, i) => {
              const p = products.find((x) => x.id === it.productId);
              const itemImg = getCartItemImage(it, p);
              const itemName = p?.name ?? "Sản phẩm";
              const itemPrice = p ? (p.salePrice ?? p.price) * it.qty : 0;
              return (
                <li key={i} className="flex gap-4 text-[14.5px] items-start">
                  {itemImg ? (
                    <img src={itemImg} alt={itemName} className="w-[96px] h-[128px] object-cover shrink-0 border border-border/80 bg-secondary" />
                  ) : (
                    <div className="w-[96px] h-[128px] bg-secondary shrink-0 border border-border/80" />
                  )}
                  <div className="flex-1">
                    <p className="line-clamp-2 font-medium leading-snug" title={itemName}>
                      {itemName}
                    </p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      {it.colorName ? `${it.colorName} · ` : ""}
                      {it.sku} · Size {it.size} · x{it.qty}
                    </p>
                  </div>
                  <span className="font-medium">{formatVND(itemPrice)}</span>
                </li>
              );
            })}
          </ul>
          <dl className="mt-6 space-y-2.5 border-t border-border pt-4 text-[14.5px]">
            <div className="flex justify-between">
              <dt>Tạm tính</dt>
              <dd>{formatVND(currentSubtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Vận chuyển</dt>
              <dd>{shipping ? formatVND(shipping) : "Miễn phí"}</dd>
            </div>
            {applied && (
              <div className="flex justify-between text-success">
                <dt>Giảm giá ({applied.code})</dt>
                <dd>−{formatVND(applied.discount_vnd)}</dd>
              </div>
            )}
            <div className="pt-2">
              <label className="mb-2 block text-[13px] uppercase tracking-widest text-muted-foreground">Mã giảm giá</label>
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
            <div className="flex justify-between pt-2.5 text-base sm:text-lg font-semibold border-t border-border/80">
              <dt>Tổng cộng</dt>
              <dd className=" text-xl sm:text-2xl">{formatVND(grand)}</dd>
            </div>
          </dl>
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full bg-primary py-4 text-xs sm:text-sm font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-60 transition-opacity hover:opacity-95"
          >
            {submitting ? "Đang đặt…" : "Đặt hàng"}
          </button>
        </aside>
      </form>
    </div>
  );
}
