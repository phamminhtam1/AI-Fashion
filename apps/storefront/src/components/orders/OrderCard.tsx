import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Package,
  QrCode,
  Trash2,
  XCircle,
} from "lucide-react";
import { formatVND } from "@/lib/products";
import type { Order } from "@/lib/store";
import { storeApi } from "@/lib/api";
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
  onPayNow: (order: {
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
      toast.error(
        err instanceof Error ? err.message : "Không hủy được đơn",
      );
    } finally {
      setCancelling(false);
    }
  };

  const fulfillmentLabel =
    order.status === "completed"
      ? "Hoàn thành"
      : order.status === "shipping"
        ? "Đang giao"
        : order.status === "processing"
          ? "Đang đóng gói"
          : order.status === "confirmed"
            ? "Đã xác nhận"
            : order.status === "cancelled"
              ? "Đã hủy"
              : "Chờ xử lý";

  const fulfillmentTone =
    order.status === "completed"
      ? "bg-emerald-500"
      : order.status === "shipping"
        ? "bg-blue-500"
        : order.status === "processing" || order.status === "confirmed"
          ? "bg-amber-500"
          : order.status === "cancelled"
            ? "bg-rose-500"
            : "bg-neutral-400";

  return (
    <article className="group border-b border-border/60 pb-7 transition-colors">
      {/* ORDER META */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/75">
              Order
            </p>

            <span className="h-px w-5 bg-border" />

            <button
              type="button"
              onClick={() => copyText("mã đơn", order.orderNumber)}
              className="group/copy inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-foreground"
              title="Sao chép mã đơn"
            >
              #{order.orderNumber}
              <Copy className="size-3 stroke-[1.4] text-foreground/60 transition-colors group-hover/copy:text-foreground" />
            </button>
          </div>

          <p className="mt-2 text-[11px] font-medium text-foreground/75">
            {new Date(order.date).toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Status */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${fulfillmentTone}`} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
              {fulfillmentLabel}
            </span>
          </div>

          <span className="hidden h-4 w-px bg-border sm:block" />

          {isPaid ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5 stroke-[1.6]" />
              Đã thanh toán
              {order.paymentMethod === "bank" ? " · QR" : " · COD"}
            </span>
          ) : isBankAwaiting ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              <Clock className="size-3.5 stroke-[1.6] animate-pulse" />
              Chờ thanh toán VietQR
            </span>
          ) : isCancelled ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
              <XCircle className="size-3.5 stroke-[1.6]" />
              Đơn đã hủy
            </span>
          ) : (
            <span className="text-[11px] font-medium text-foreground/75">
              Chưa thanh toán
            </span>
          )}
        </div>
      </div>

      {/* PRODUCT ITEMS */}
      <div className="mt-6">
        {order.itemsPreview && order.itemsPreview.length > 0 ? (
          <div className="divide-y divide-border/50">
            {order.itemsPreview.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-[72px_minmax(0,1fr)_auto] gap-4 py-4 first:pt-0 last:pb-0"
              >
                {/* Image */}
                <div className="aspect-[3/4] w-[72px] overflow-hidden bg-secondary/40">
                  {it.image_url ? (
                    <img
                      src={it.image_url}
                      alt={it.product_name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="size-5 stroke-[1.2] text-foreground/60" />
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="min-w-0 self-center">
                  <p className="line-clamp-2 font-serif text-[16px] font-medium leading-[1.3] tracking-[-0.01em] text-foreground">
                    {it.product_name}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-foreground/75">
                    {it.size_label && (
                      <span className="font-semibold">Size {it.size_label}</span>
                    )}
                    {it.color_label && (
                      <span>{it.color_label}</span>
                    )}
                    <span>Số lượng {it.qty}</span>
                  </div>
                </div>

                {/* Price */}
                <div className="self-center text-right">
                  <p className="text-[14px] font-bold text-foreground">
                    {formatVND(it.line_total_vnd)}
                  </p>
                  {it.qty > 1 && (
                    <p className="mt-1 text-[10px] font-medium text-foreground/60">
                      {it.qty} × {formatVND(it.unit_price_vnd)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between py-3 text-[11px] font-medium text-foreground/75">
            <span>Chi tiết sản phẩm trong đơn</span>
            <span className="font-semibold text-foreground">
              {order.itemsCount ? `${order.itemsCount} sản phẩm` : ""}
            </span>
          </div>
        )}
      </div>

      {/* ORDER SUMMARY / ACTIONS */}
      <div className="mt-6 flex flex-col gap-5 border-t border-border/60 pt-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/75">
            Tổng thanh toán
          </p>
          <p className="mt-1  text-[26px] font-medium tracking-[-0.02em] text-foreground">
            {formatVND(order.total)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
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
              className="group/pay inline-flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground"
            >
              <QrCode className="size-3.5 stroke-[1.5]" />
              <span className="border-b border-foreground pb-0.5">
                Thanh toán ngay
              </span>
              <span className="transition-transform duration-300 group-hover/pay:translate-x-1">
                →
              </span>
            </button>
          )}

          {isBankAwaiting && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => void handleCancel()}
              className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground/60 transition-colors hover:text-destructive disabled:opacity-40"
            >
              <Trash2 className="size-3.5 stroke-[1.4]" />
              {cancelling ? "Đang hủy..." : "Hủy đơn"}
            </button>
          )}

          <button
            type="button"
            onClick={() => onViewDetail(order.id)}
            className="group/detail inline-flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground"
          >
            <Eye className="size-3.5 stroke-[1.4]" />
            <span className="border-b border-foreground pb-0.5">
              Xem chi tiết
            </span>
            <span className="transition-transform duration-300 group-hover/detail:translate-x-1">
              →
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
