import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  FileText,
  MapPin,
  Package,
  Printer,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { formatVND } from "@/lib/products";
import { storeApi, type StoreOrderDetail } from "@/lib/api";
import { toast } from "sonner";

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`Đã copy ${label}`),
    () => toast.error("Không copy được"),
  );
}

interface OrderDetailModalProps {
  orderId: string;
  onClose: () => void;
  onPayNow?: (order: StoreOrderDetail) => void;
}

export function OrderDetailModal({ orderId, onClose, onPayNow }: OrderDetailModalProps) {
  const [order, setOrder] = useState<StoreOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    storeApi
      .order(orderId)
      .then((data) => {
        if (active) setOrder(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Không tải được đơn hàng");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  // Lock body scroll when modal is open
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, []);

  const getStepProgress = (status: string, paymentStatus: string) => {
    if (status === "cancelled") return -1;
    if (status === "completed") return 4;
    if (status === "shipping") return 3;
    if (status === "processing" || status === "confirmed") return 2;
    if (paymentStatus === "paid") return 1;
    return 0; // pending / awaiting
  };

  const steps = [
    { label: "Đặt đơn", desc: "Đã gửi đơn hàng", icon: FileText },
    { label: "Thanh toán", desc: "Xác nhận thanh toán", icon: CreditCard },
    { label: "Chuẩn bị hàng", desc: "Đóng gói tại kho", icon: Package },
    { label: "Đang giao", desc: "Bàn giao vận chuyển", icon: Truck },
    { label: "Hoàn tất", desc: "Giao thành công", icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col bg-background shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg tracking-wider">HÓA ĐƠN ĐƠN HÀNG</span>
            {order && (
              <span className="bg-secondary px-2.5 py-0.5 text-xs font-mono font-medium tracking-wider">
                #{order.order_number}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              In hóa đơn
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {loading && (
            <div className="py-20 text-center space-y-3">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Đang tải thông tin đơn hàng…</p>
            </div>
          )}

          {error && (
            <div className="py-16 text-center text-destructive space-y-3">
              <p className="text-sm font-medium">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="border border-border px-6 py-2 text-xs uppercase tracking-wider"
              >
                Đóng lại
              </button>
            </div>
          )}

          {order && (
            <>
              {/* Top Banner: Status & Date */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-secondary/50 p-4 border border-border/60">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Thời gian đặt</p>
                  <p className="text-sm font-medium mt-0.5">
                    {new Date(order.placed_at).toLocaleString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Payment status badge */}
                  {order.payment_status === "paid" ? (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 text-xs font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Đã thanh toán {order.payment_method === "bank" ? "(QR)" : "(COD)"}
                    </span>
                  ) : order.payment_status === "awaiting" ? (
                    <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-3 py-1 text-xs font-medium animate-pulse">
                      <Clock className="h-3.5 w-3.5" />
                      Chờ thanh toán VietQR
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-3 py-1 text-xs font-medium">
                      Chưa thanh toán
                    </span>
                  )}

                  {/* Order lifecycle badge */}
                  <span className="bg-foreground text-background px-3 py-1 text-xs uppercase tracking-wider font-medium">
                    {order.status === "completed"
                      ? "Hoàn thành"
                      : order.status === "shipping"
                        ? "Đang giao hàng"
                        : order.status === "processing"
                          ? "Đang đóng gói"
                          : order.status === "confirmed"
                            ? "Đã xác nhận"
                            : order.status === "cancelled"
                              ? "Đã hủy"
                              : "Chờ xử lý"}
                  </span>
                </div>
              </div>

              {/* Stepper Timeline */}
              {order.status !== "cancelled" ? (
                <div className="py-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
                    Tiến độ đơn hàng
                  </p>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {steps.map((st, idx) => {
                      const cur = getStepProgress(order.status, order.payment_status);
                      const isDone = idx <= cur;
                      const isCurrent = idx === cur;
                      const Icon = st.icon;
                      return (
                        <div key={st.label} className="relative flex flex-col items-center">
                          {/* Connector line */}
                          {idx > 0 && (
                            <div
                              className={`absolute top-4 -left-1/2 w-full h-[2px] -z-0 transition-colors ${idx <= cur ? "bg-foreground" : "bg-border"
                                }`}
                            />
                          )}
                          <div
                            className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border transition-all ${isDone
                                ? "bg-foreground text-background border-foreground shadow-sm"
                                : "bg-background text-muted-foreground border-border"
                              } ${isCurrent ? "ring-4 ring-foreground/15 scale-105" : ""}`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <p
                            className={`mt-2 text-xs font-medium ${isDone ? "text-foreground" : "text-muted-foreground"
                              }`}
                          >
                            {st.label}
                          </p>
                          <p className="hidden sm:block text-[10px] text-muted-foreground mt-0.5 leading-tight">
                            {st.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-sm">
                  Đơn hàng này đã bị hủy. Nếu bạn đã chuyển khoản, vui lòng liên hệ hotline CSKH để được hoàn tiền nhanh nhất.
                </div>
              )}

              {/* 2-Column Info: Recipient & Shipping + Payment Details */}
              <div className="grid gap-6 sm:grid-cols-2 text-sm border-t border-b border-border py-6">
                {/* Shipping info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <MapPin className="h-4 w-4 text-foreground" />
                    Địa chỉ nhận hàng
                  </div>
                  <div className="bg-secondary/30 p-3 space-y-1">
                    <p className="font-medium text-foreground">
                      {order.recipient?.full_name || order.recipient?.recipient_name || "—"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      SĐT: {order.recipient?.phone || "—"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {order.shipping_address?.full_address ||
                        [
                          order.shipping_address?.address_line,
                          order.shipping_address?.district,
                          order.shipping_address?.city,
                        ]
                          .filter(Boolean)
                          .join(", ") ||
                        "—"}
                    </p>
                    {order.shipping_address?.note && (
                      <p className="text-xs italic text-muted-foreground pt-1 border-t border-border/50">
                        Ghi chú: {order.shipping_address.note}
                      </p>
                    )}
                  </div>
                </div>

                {/* Payment info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <CreditCard className="h-4 w-4 text-foreground" />
                    Phương thức thanh toán
                  </div>
                  <div className="bg-secondary/30 p-3 space-y-1 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Hình thức:</span>
                      <span className="font-medium">
                        {order.payment_method === "bank"
                          ? "Chuyển khoản VietQR / SePay"
                          : "Thanh toán COD khi nhận hàng"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Trạng thái:</span>
                      <span className="font-medium">
                        {order.payment_status === "paid"
                          ? "Đã thanh toán thành công"
                          : order.payment_status === "awaiting"
                            ? "Chờ khách chuyển khoản"
                            : "Chưa thanh toán"}
                      </span>
                    </div>
                    {order.payment_ref && (
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Mã tham chiếu:</span>
                        <span className="font-mono">{order.payment_ref}</span>
                      </div>
                    )}
                    {order.paid_at && (
                      <div className="flex justify-between py-1">
                        <span className="text-muted-foreground">Thời gian trả:</span>
                        <span>{new Date(order.paid_at).toLocaleTimeString("vi-VN")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Danh sách sản phẩm ({order.items.length})
                  </p>
                </div>
                <div className="divide-y divide-border border border-border">
                  {order.items.map((it) => (
                    <div key={it.id} className="flex gap-4 p-4 hover:bg-secondary/20 transition-colors">
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt={it.product_name}
                          className="h-20 w-16 object-cover bg-secondary flex-shrink-0"
                        />
                      ) : (
                        <div className="flex h-20 w-16 items-center justify-center bg-secondary text-muted-foreground flex-shrink-0">
                          <Package className="h-6 w-6 stroke-[1.2]" />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col justify-between">
                        <div className="flex justify-between gap-2">
                          <div>
                            <h4 className="font-medium text-sm text-foreground line-clamp-1">
                              {it.product_name}
                            </h4>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {it.size_label && (
                                <span className="bg-secondary px-2 py-0.5">Size: {it.size_label}</span>
                              )}
                              {it.color_label && (
                                <span className="bg-secondary px-2 py-0.5">Màu: {it.color_label}</span>
                              )}
                              {it.sku && <span className="text-muted-foreground/70">SKU: {it.sku}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm text-foreground">
                              {formatVND(it.line_total_vnd)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {it.qty} × {formatVND(it.unit_price_vnd)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="bg-secondary/40 p-4 border border-border space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Tạm tính tiền hàng:</span>
                  <span>{formatVND(order.subtotal_vnd)}</span>
                </div>
                {order.discount_vnd > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 text-xs">
                    <span>
                      Giảm giá voucher {order.discount_code ? `(${order.discount_code})` : ""}:
                    </span>
                    <span>-{formatVND(order.discount_vnd)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Phí vận chuyển tiêu chuẩn:</span>
                  <span>{order.shipping_vnd === 0 ? "Miễn phí" : formatVND(order.shipping_vnd)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-3 border-t border-border">
                  <span className="font-semibold uppercase tracking-wider text-xs">
                    Tổng tiền thanh toán:
                  </span>
                  <span className="font-serif text-xl sm:text-2xl font-bold text-foreground">
                    {formatVND(order.grand_total_vnd)}
                  </span>
                </div>
              </div>

              {/* Trust Badge */}
              <div className="flex items-center gap-3 p-3 bg-secondary/20 border border-border/50 text-xs text-muted-foreground">
                <ShieldCheck className="h-5 w-5 text-foreground flex-shrink-0" />
                <p>
                  Được đảm bảo bởi ÉLANE: Đổi trả miễn phí trong 30 ngày. Hỗ trợ CSKH 24/7 hotline 1900 8888.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        {order && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 bg-background">
            <button
              type="button"
              onClick={() => copyText("mã đơn hàng", order.order_number)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy mã đơn
            </button>
            <div className="flex items-center gap-2">
              {order.payment_method === "bank" &&
                order.payment_status === "awaiting" &&
                order.status === "pending" &&
                onPayNow && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onPayNow(order);
                    }}
                    className="bg-foreground text-background px-6 py-2.5 text-xs uppercase tracking-widest font-medium hover:bg-foreground/90 transition-colors shadow-sm"
                  >
                    Thanh toán VietQR ngay
                  </button>
                )}
              <button
                type="button"
                onClick={onClose}
                className="border border-border px-6 py-2.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
