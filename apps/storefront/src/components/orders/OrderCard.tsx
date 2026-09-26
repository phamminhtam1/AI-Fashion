import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Eye,
  Package,
  QrCode,
  RotateCcw,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import { formatVND } from "@/lib/products";
import type { Order } from "@/lib/store";
import { storeApi, type StoreOrderDetail } from "@/lib/api";
import { toast } from "sonner";

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`Đã copy ${label}`),
    () => toast.error("Không copy được"),
  );
}

interface OrderCardProps {
  order: Order;
  onViewDetail: (orderId: string) => void;
  onPayNow: (order: { id: string; order_number: string; grand_total_vnd: number }) => void;
  onOrderUpdated: () => void;
}

export function OrderCard({ order, onViewDetail, onPayNow, onOrderUpdated }: OrderCardProps) {
  const [cancelling, setCancelling] = useState(false);

  const isBankAwaiting =
    order.paymentMethod === "bank" &&
    order.paymentStatus === "awaiting" &&
    order.status === "pending";

  const isPaid = order.paymentStatus === "paid";
  const isCancelled = order.status === "cancelled";

  const handleCancel = async () => {
    if (!confirm(`Bạn có chắc muốn hủy đơn hàng #${order.orderNumber}?`)) return;
    setCancelling(true);
    try {
      await storeApi.cancelOrder(order.id);
      toast.success(`Đã hủy đơn hàng #${order.orderNumber}`);
      onOrderUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không hủy được đơn");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="group border border-border bg-background transition-all hover:border-foreground/30 hover:shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/30 px-5 py-3.5 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono font-medium text-foreground">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>#{order.orderNumber}</span>
          </div>
          <button
            type="button"
            onClick={() => copyText("mã đơn", order.orderNumber)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Sao chép mã đơn"
          >
            <Copy className="h-3 w-3" />
          </button>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            {new Date(order.date).toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Payment Status */}
          {isPaid ? (
            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Đã thanh toán {order.paymentMethod === "bank" ? "(QR)" : "(COD)"}
            </span>
          ) : isBankAwaiting ? (
            <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-medium">
              <Clock className="h-3 w-3 animate-pulse" />
              Chờ chuyển khoản VietQR
            </span>
          ) : isCancelled ? (
            <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-2.5 py-0.5 text-[11px] font-medium">
              <XCircle className="h-3 w-3" />
              Đã hủy
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-secondary text-muted-foreground px-2.5 py-0.5 text-[11px]">
              Chưa thanh toán
            </span>
          )}

          {/* Fulfillment Status */}
          <span className="bg-foreground text-background px-2.5 py-0.5 text-[11px] uppercase tracking-wider font-medium">
            {order.status === "completed"
              ? "Hoàn thành"
              : order.status === "shipping"
                ? "Đang giao"
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

      {/* Items Preview */}
      <div className="p-5 space-y-3">
        {order.itemsPreview && order.itemsPreview.length > 0 ? (
          <div className="divide-y divide-border/60">
            {order.itemsPreview.map((it) => (
              <div key={it.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                {it.image_url ? (
                  <img
                    src={it.image_url}
                    alt={it.product_name}
                    className="h-16 w-12 object-cover bg-secondary flex-shrink-0 border border-border/50"
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
                    <span>Số lượng: {it.qty}</span>
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
        ) : (
          <div className="py-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>Chi tiết các sản phẩm trong đơn</span>
            <span className="font-medium">{order.itemsCount ? `${order.itemsCount} sản phẩm` : ""}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-secondary/10 px-5 py-3.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Tổng thanh toán:</span>
          <span className="font-serif text-lg font-bold text-foreground">{formatVND(order.total)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Action: Pay Now if awaiting */}
          {isBankAwaiting && (
            <button
              type="button"
              onClick={() =>
                onPayNow({
                  id: order.id,
                  order_number: order.orderNumber,
                  grand_total_vnd: order.total,
                })
              }
              className="inline-flex items-center gap-1.5 bg-foreground text-background px-4 py-2 text-xs uppercase tracking-wider font-medium hover:bg-foreground/90 transition-all shadow-sm"
            >
              <QrCode className="h-3.5 w-3.5" />
              Thanh toán ngay
            </button>
          )}

          {/* Action: Cancel Order if pending bank */}
          {isBankAwaiting && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => void handleCancel()}
              className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hủy đơn
            </button>
          )}

          {/* Action: View Detail */}
          <button
            type="button"
            onClick={() => onViewDetail(order.id)}
            className="inline-flex items-center gap-1.5 border border-border px-4 py-2 text-xs uppercase tracking-wider text-foreground hover:bg-secondary transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            Chi tiết hóa đơn
          </button>
        </div>
      </div>
    </div>
  );
}
