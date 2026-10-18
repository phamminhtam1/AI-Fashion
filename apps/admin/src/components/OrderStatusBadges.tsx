import { cn } from "@/lib/utils";
import { adminLabel } from "@/lib/admin-language";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã duyệt",
  cancelled: "Đã hủy",
  shipping: "Đang giao",
  delivered: "Đã giao",
  completed: "Hoàn thành",
  fulfilled: "Hoàn thành",
};

export function PaymentStatusBadge({
  status,
  orderStatus,
}: {
  status: string;
  orderStatus?: string;
}) {
  const s = (status || "").toLowerCase();
  const o = (orderStatus || "").toLowerCase();
  if (o === "cancelled" || s === "failed" || s === "cancelled" || s === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-rose-200/80 bg-rose-50 px-2.5 py-0.5 text-sm font-semibold text-rose-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-rose-500" />
        Đã hủy
      </span>
    );
  }
  if (s === "paid" || s === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Đã thanh toán
      </span>
    );
  }
  if (s === "pending" || s === "awaiting" || s === "unpaid") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-sm font-semibold text-amber-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Chờ thanh toán
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700 shadow-2xs">
      <span className="size-1.5 rounded-full bg-slate-400" />
      {s === "refunded" ? "Đã hoàn tiền" : adminLabel(status)}
    </span>
  );
}

export function OrderStatusBadge({
  status,
  fulfillmentStatus,
  paymentStatus,
}: {
  status: string;
  fulfillmentStatus?: string;
  paymentStatus?: string;
}) {
  const f = (fulfillmentStatus || "").toLowerCase();
  const p = (paymentStatus || "").toLowerCase();
  const s = (status || "").toLowerCase();

  const isCancelled = s === "cancelled";
  const isPending = s === "pending";

  // Đơn nào giao thành công hoàn tất đầy đủ thì Trạng thái sẽ là "Hoàn thành"
  const isCompleted =
    !isCancelled &&
    (s === "completed" ||
      s === "delivered" ||
      ((f === "delivered" || f === "fulfilled") && (p === "paid" || p === "completed")));

  if (isCancelled) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-sm font-semibold tracking-tight text-slate-600 shadow-2xs">
        <span className="size-1.5 rounded-full bg-slate-400" />
        Đã hủy
      </span>
    );
  }

  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold tracking-tight text-emerald-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-emerald-600" />
        Hoàn thành
      </span>
    );
  }

  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-sm font-semibold tracking-tight text-[#6941c6] shadow-2xs">
        <span className="size-1.5 rounded-full bg-[#6941c6]" />
        Chờ xác nhận
      </span>
    );
  }

  if (s === "shipping" || f === "shipping") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-sm font-semibold tracking-tight text-indigo-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-indigo-500" />
        Đang giao
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-sm font-semibold tracking-tight text-blue-700 shadow-2xs">
      <span className="size-1.5 rounded-full bg-blue-500" />
      {STATUS_LABEL[s] ?? s}
    </span>
  );
}
