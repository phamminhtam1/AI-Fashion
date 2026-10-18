// Thay component @/components/orders/OrderCard hiện tại bằng file này.
// Tương thích với trang tài khoản đã thiết kế; toàn bộ giao diện dùng Tailwind.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Loader2,
  Package,
  QrCode,
  ShoppingBag,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import { formatVND } from "@/lib/products";
import type { Order } from "@/lib/store";
import { storeApi } from "@/lib/api";
import { toast } from "sonner";

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Đã sao chép ${label}`);
    return true;
  } catch {
    toast.error("Không sao chép được. Vui lòng thử lại.");
    return false;
  }
}

interface OrderCardProps {
  order: Order;
  onViewDetail: (orderId: string) => void;
  onPayNow?: (order: {
    id: string;
    order_number: string;
    grand_total_vnd: number;
  }) => void;
  onOrderUpdated: () => void;
}

export function OrderCard({
  order,
  onViewDetail,
  onPayNow,
  onOrderUpdated,
}: OrderCardProps) {
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const isBankAwaiting =
    order.paymentMethod === "bank" &&
    order.paymentStatus === "awaiting" &&
    order.status === "pending";

  const isPaid = order.paymentStatus === "paid";
  const isCancelled = order.status === "cancelled";

  const handleCopyOrderNumber = async () => {
    const success = await copyText("mã đơn hàng", order.orderNumber);
    if (success) setCopied(true);
  };

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

  const fulfillment =
    order.status === "completed"
      ? { label: "Hoàn thành", Icon: CheckCircle2, tone: "border-[#e0e0e0] bg-[#f5f5f5] text-[#333333]" }
      : order.status === "shipping"
        ? { label: "Đang giao hàng", Icon: Truck, tone: "border-[#e0e0e0] bg-[#f5f5f5] text-[#444444]" }
        : order.status === "processing"
          ? { label: "Đang đóng gói", Icon: Package, tone: "border-[#e5e5e5] bg-[#f5f5f5] text-[#111111]" }
          : order.status === "confirmed"
            ? { label: "Đã xác nhận", Icon: CheckCircle2, tone: "border-[#e5e5e5] bg-[#f5f5f5] text-[#111111]" }
            : order.status === "cancelled"
              ? { label: "Đã hủy", Icon: XCircle, tone: "border-[#e0e0e0] bg-[#f5f5f5] text-[#666666]" }
              : { label: "Chờ xử lý", Icon: Clock, tone: "border-[#e5e5e5] bg-[#f5f5f5] text-[#555555]" };
  const StatusIcon = fulfillment.Icon;

  const placedAt = new Date(order.date);
  const formattedDate = Number.isNaN(placedAt.getTime())
    ? "Thời gian chưa có sẵn"
    : placedAt.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <article
      aria-label={`Đơn hàng #${order.orderNumber}`}
      className="overflow-hidden rounded-3xl border border-[#e5e5e5] bg-white text-[#171717] shadow-[0_8px_32px_-24px_rgba(0,0,0,0.08)]"
    >
      {/* Order identity and live status */}
      <header className="flex flex-col gap-4 border-b border-[#ededed] px-5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5 sm:px-7 sm:py-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f2f2f2] text-[#111111]">
            <ShoppingBag className="h-5 w-5 stroke-[1.4]" />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center">
              <span className="break-all text-sm font-semibold tracking-wide text-[#111111] sm:text-base">#{order.orderNumber}</span>
              <button
                type="button"
                onClick={() => void handleCopyOrderNumber()}
                title={copied ? "Đã sao chép" : "Sao chép mã đơn"}
                aria-label={copied ? "Đã sao chép mã đơn hàng" : "Sao chép mã đơn hàng"}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#666666] transition-colors hover:bg-[#f7f7f7] hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"
              >
                {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
              </button>
              <span role="status" aria-live="polite" className="sr-only">{copied ? "Đã sao chép mã đơn hàng" : ""}</span>
            </div>
            <p className="text-[11px] leading-5 text-[#666666]">{Number.isNaN(placedAt.getTime()) ? formattedDate : `Đặt lúc ${formattedDate}`}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:max-w-[260px] sm:justify-end sm:pt-1">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium ${fulfillment.tone}`}>
            <StatusIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 stroke-[1.6]" />
            {fulfillment.label}
          </span>
          {isPaid ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e0e0e0] bg-[#f5f5f5] px-3 py-1.5 text-[11px] font-medium text-[#333333]">
              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Đã thanh toán · {order.paymentMethod === "bank" ? "VietQR" : "COD"}
            </span>
          ) : isBankAwaiting ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dddddd] bg-[#f5f5f5] px-3 py-1.5 text-[11px] font-medium text-[#333333]">
              <QrCode aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              Chờ thanh toán VietQR
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ededed] bg-[#ffffff] px-3 py-1.5 text-[11px] font-medium text-[#666666]">
              <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {!isCancelled && order.paymentMethod !== "bank" ? "Thanh toán khi nhận hàng" : "Chưa thanh toán"}
            </span>
          )}
        </div>
      </header>

      {/* Purchased designs */}
      <div className="px-5 py-5 sm:px-7 sm:py-6">
        {order.itemsPreview && order.itemsPreview.length > 0 ? (
          <ul className="divide-y divide-[#ededed]">
            {order.itemsPreview.map((item) => (
              <li key={item.id} className="flex items-start gap-3.5 py-5 first:pt-0 last:pb-0 sm:items-center sm:gap-5">
                <div className="h-24 w-[72px] shrink-0 overflow-hidden rounded-xl bg-[#f0f0f0] sm:h-28 sm:w-[84px]">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.product_name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#666666]"><Package aria-hidden="true" className="h-6 w-6 stroke-[1.2]" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-5">
                  <div className="min-w-0">
                    <p className="break-words font-serif text-sm font-medium leading-6 sm:text-base">{item.product_name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] leading-5 text-[#666666]">
                      {item.size_label && <span className="rounded-md bg-[#f7f7f7] px-2 py-0.5 font-medium text-[#666666]">Size {item.size_label}</span>}
                      {item.color_label && <span>{item.color_label}</span>}
                      <span>Số lượng: {item.qty}</span>
                    </div>
                  </div>
                  <div className="mt-3 shrink-0 sm:mt-0 sm:text-right">
                    <p className="text-sm font-semibold tabular-nums text-[#111111]">{formatVND(item.line_total_vnd)}</p>
                    {item.qty > 1 && <p className="mt-1 text-[10px] leading-5 tabular-nums text-[#666666]">{item.qty} × {formatVND(item.unit_price_vnd)}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl bg-[#ffffff] p-4 text-xs leading-6 text-[#666666]">
            <Package aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[#666666]" />
            <p>Mở chi tiết đơn hàng để xem đầy đủ thông tin sản phẩm.</p>
          </div>
        )}
      </div>

      {/* Total and actions */}
      <footer className="border-t border-[#ededed] bg-[#fafafa] px-3 py-3 sm:px-5 sm:py-3">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#666666]">Tổng thanh toán</p>
            <p className="mt-1 break-words text-xl font-semibold tracking-tight tabular-nums text-[#111111] sm:text-xl">{formatVND(order.total)}</p>
          </div>

          <div className={`grid w-full shrink-0 gap-2 sm:w-auto ${isBankAwaiting ? "grid-cols-2" : "grid-cols-1"}`}>
            {isBankAwaiting && (onPayNow ? (
              <button
                type="button"
                onClick={() => onPayNow?.({ id: order.id, order_number: order.orderNumber, grand_total_vnd: order.total })}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#111111] px-3 py-3 text-xs font-medium text-white transition-colors hover:bg-[#333333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 sm:px-5"
              >
                <QrCode aria-hidden="true" className="h-4 w-4 shrink-0" />Thanh toán ngay
              </button>
            ) : (
              <Link
                to="/thanh-toan"
                search={{ orderId: order.id }}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#111111] px-3 py-3 text-xs font-medium text-white transition-colors hover:bg-[#333333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 sm:px-5"
              >
                <QrCode aria-hidden="true" className="h-4 w-4 shrink-0" />Thanh toán ngay
              </Link>
            ))}
            <button
              type="button"
              onClick={() => onViewDetail(order.id)}
              className={`group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 sm:px-5 ${isBankAwaiting ? "border border-[#e5e5e5] bg-white text-[#111111] hover:border-[#111111] hover:bg-[#f7f7f7]" : "bg-[#111111] text-white hover:bg-[#333333]"}`}
            >
              <Eye aria-hidden="true" className="h-4 w-4 shrink-0" />Xem chi tiết
              {!isBankAwaiting && <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />}
            </button>
          </div>
        </div>

        {isBankAwaiting && (
          <div className="mt-4 flex flex-col items-start justify-between gap-2 border-t border-dashed border-[#e5e5e5] pt-3 sm:flex-row sm:items-center sm:gap-4">
            <p className="flex items-start gap-2 text-[11px] leading-6 text-[#666666]"><Clock aria-hidden="true" className="mt-1.5 h-3.5 w-3.5 shrink-0 text-[#666666]" />Đơn hàng đang chờ xác nhận thanh toán VietQR.</p>
            <button
              type="button"
              disabled={cancelling}
              aria-busy={cancelling}
              onClick={() => void handleCancel()}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 self-end rounded-lg px-2 text-[11px] font-medium text-[#666666] transition-colors hover:bg-[#f5f5f5] hover:text-[#666666] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
            >
              {cancelling ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
              {cancelling ? "Đang hủy…" : "Hủy đơn hàng"}
            </button>
          </div>
        )}
      </footer>
    </article>
  );
}
