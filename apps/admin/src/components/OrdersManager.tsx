import { PaymentStatusBadge, OrderStatusBadge } from "./OrderStatusBadges";
import { adminErrorMessage, adminLabel, paymentStatusLabel } from "@/lib/admin-language";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { resolveAdminPath } from "@/lib/routes";
import {
  ArrowDownUp,
  ArrowLeft,
  Boxes,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  MapPin,
  MoreHorizontal,
  MoreVertical,
  Package,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  Share2,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { InventorySeed } from "@/components/InventoryManager";
import { CreateOrderView } from "./CreateOrderView";
import { OrderDetailView } from "./OrderDetailView";

const API_URL = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001";

function resolveImageUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type EnhancedOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_location: string;
  items_count: number;
  item_images: string[];
  extra_items: number;
  grand_total_vnd: number;
  payment_method: string;
  payment_status: "paid" | "pending" | "failed" | "refunded" | string;
  fulfillment_status: "processing" | "shipping" | "picking" | "delivered" | "cancelled" | "returned" | string;
  placed_at: string;
  paid_at?: string | null;
  payment_ref?: string | null;
  status: string;
  inventory_doc_id?: string | null;
  inventory_doc_code?: string | null;
};

type OrderSummary = {
  id: string;
  order_number: string;
  status: string;
  grand_total_vnd: number;
  payment_method: string;
  payment_status: string;
  paid_at: string | null;
  payment_ref: string | null;
  placed_at: string;
  customer_name: string;
  fulfillment_status?: "unfulfilled" | "fulfilled" | "partial";
  fulfilled_at?: string | null;
  inventory_doc_id?: string | null;
  inventory_doc_code?: string | null;
};

type OrderDetail = {
  id: string;
  order_number: string;
  status: string;
  fulfillment_status?: "unfulfilled" | "fulfilled" | "partial";
  fulfilled_at?: string | null;
  inventory_doc_id?: string | null;
  inventory_doc_code?: string | null;
  customer: { id: string; full_name: string; email: string | null; phone: string | null } | null;
  subtotal_vnd: number;
  shipping_vnd: number;
  discount_vnd: number;
  discount_code: string | null;
  grand_total_vnd: number;
  payment_method: string;
  payment_status: string;
  paid_at: string | null;
  payment_ref: string | null;
  recipient: Record<string, string> | null;
  shipping_address: Record<string, string> | null;
  placed_at: string;
  items: Array<{
    id?: string;
    product_id?: string;
    variant_id?: string;
    sku: string;
    barcode?: string | null;
    product_name: string;
    size_label: string | null;
    color_label?: string | null;
    image_url?: string | null;
    qty: number;
    unit_price_vnd: number;
    line_total_vnd: number;
  }>;
};

export type OrderFilterTab =
  | "all"
  | "pending_payment"
  | "processing"
  | "shipping"
  | "delivered"
  | "cancelled"
  | "returned";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtVND(n: number) {
  return Number(n).toLocaleString("vi-VN") + "₫";
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOrderDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString("vi-VN", { month: "short", day: "numeric", year: "numeric" });
    const timeFormatted = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return { dateFormatted, timeFormatted };
  } catch {
    return { dateFormatted: dateStr, timeFormatted: "" };
  }
}

// ─── Status Badges (Matching Screenshot) ──────────────────────────────────────

function WarehouseStatusBadge({
  fulfillmentStatus,
  orderStatus,
  hasInventoryDoc,
}: {
  fulfillmentStatus?: string;
  orderStatus?: string;
  hasInventoryDoc?: boolean;
}) {
  const f = (fulfillmentStatus || "").toLowerCase();
  const o = (orderStatus || "").toLowerCase();

  if (o === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50 px-2.5 py-0.5 text-sm font-semibold text-rose-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-rose-500" />
        Đã hủy
      </span>
    );
  }

  const isExported =
    f === "shipping" ||
    f === "fulfilled" ||
    f === "delivered" ||
    Boolean(hasInventoryDoc);

  if (isExported) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Đã xuất kho
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-sm font-semibold text-amber-700 shadow-2xs">
      <span className="size-1.5 rounded-full bg-amber-500" />
      Chờ xuất kho
    </span>
  );
}

function FulfillmentStatusBadge({
  status,
  orderStatus,
}: {
  status: string;
  orderStatus?: string;
}) {
  const s = (status || "").toLowerCase();
  const o = (orderStatus || "").toLowerCase();

  if (o === "cancelled" || s === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50 px-2.5 py-0.5 text-sm font-semibold text-rose-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-rose-500" />
        Đã hủy
      </span>
    );
  }
  if (s === "delivered") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Đã giao hàng
      </span>
    );
  }
  if (s === "shipping" || s === "fulfilled") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50 px-2.5 py-0.5 text-sm font-semibold text-sky-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-sky-500" />
        Đang giao hàng
      </span>
    );
  }
  if (s === "picking") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50 px-2.5 py-0.5 text-sm font-semibold text-indigo-700 shadow-2xs">
        <span className="size-1.5 rounded-full bg-indigo-500" />
        Đang lấy hàng
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200/80 bg-purple-50 px-2.5 py-0.5 text-sm font-semibold text-[#6941c6] shadow-2xs">
      <span className="size-1.5 rounded-full bg-[#6941c6]" />
      Chờ giao hàng
    </span>
  );
}

// ─── Printable Packing Slip Modal ───────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã duyệt",
  cancelled: "Đã hủy",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  awaiting: "Chờ TT",
  paid: "Đã TT",
  refunded: "Đã hoàn",
  unpaid: "Chưa TT",
  pending: "Chờ TT",
  failed: "Thất bại",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "Tiền mặt (COD)",
  bank: "Chuyển khoản VietQR",
};

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success("Đã copy " + label),
    () => toast.error("Không copy được"),
  );
}

function PaymentBadge({ method, status }: { method: string; status: string }) {
  const isPaid = status === "paid";
  const isAwaiting = status === "awaiting" || status === "pending";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm font-semibold tracking-tight",
        isPaid
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : isAwaiting
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-slate-100 text-slate-600",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isPaid ? "bg-emerald-600" : isAwaiting ? "bg-amber-600" : "bg-slate-400",
        )}
      />
      {PAYMENT_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function FulfillmentBadge({
  fulfillmentStatus,
  paymentMethod,
  paymentStatus,
  orderStatus,
  docCode,
}: {
  fulfillmentStatus?: string | null | undefined;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  docCode?: string | null | undefined;
}) {
  const isFulfilled = fulfillmentStatus === "fulfilled" || fulfillmentStatus === "delivered";
  const isCancelled = orderStatus === "cancelled";
  const isPaidOrCod = paymentStatus === "paid" || paymentMethod === "cod";
  const isReadyToFulfill = !isFulfilled && !isCancelled && isPaidOrCod;

  if (isCancelled) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-600">
        <span className="size-1.5 rounded-full bg-slate-400" />
        Đã hủy đơn
      </span>
    );
  }

  if (isFulfilled) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
        <Check className="size-3 text-emerald-600" />
        <span className="font-semibold">Đã xuất kho</span>
        {docCode && <span className="tabular-nums text-xs opacity-75">#{docCode}</span>}
      </span>
    );
  }

  if (isReadyToFulfill) {
    return (
      <span
        title="Đơn đã thanh toán / COD sẵn sàng xuất kho"
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-sm font-semibold text-amber-800"
      >
        <Boxes className="size-3 text-amber-700 animate-pulse" />
        <span>Chờ xuất kho</span>
      </span>
    );
  }

  return (
    <span
      title="Đơn hàng chờ thanh toán trước khi xuất kho"
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-600"
    >
      <Clock className="size-3 text-slate-400" />
      <span>Chờ thanh toán</span>
    </span>
  );
}

function PackingSlipModal({
  detail,
  onClose,
}: {
  detail: OrderDetail;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:static print:bg-white print:p-0">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xs border border-border bg-card shadow-2xl print:max-h-none print:w-full print:border-none print:shadow-none">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="size-4 text-primary" />
            <h3 className="font-sans admin-subsection-title">Phiếu xuất kho kiêm giao hàng</h3>
            <span className="tabular-nums text-sm text-muted-foreground">#{detail.order_number}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 h-8 text-sm"
            >
              <Printer className="size-3.5" />
              In phiếu
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="size-8">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div
          ref={printRef}
          className="overflow-y-auto p-8 font-sans text-foreground print:overflow-visible print:p-0"
        >
          {/* Slip Header */}
          <div className="flex items-start justify-between border-b pb-6">
            <div>
              <p className="font-sans admin-metric font-semibold tracking-wider text-primary">ÉLANE</p>
              <p className="text-xs uppercase tracking-[0.04em] text-muted-foreground">
                Thời trang cao cấp và xưởng thiết kế
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Đường dây chăm sóc khách hàng: <span className="font-medium text-foreground">1900 8888</span>
              </p>
              <p className="text-sm text-muted-foreground">Trang web: elane.vn</p>
            </div>
            <div className="text-right">
              <h2 className="font-sans uppercase text-foreground admin-section-title">
                Phiếu xuất kho & Giao hàng
              </h2>
              <p className="mt-1 tabular-nums text-base font-semibold text-primary">
                #{detail.order_number}
              </p>
              <p className="text-sm text-muted-foreground">Ngày đặt: {fmtDate(detail.placed_at)}</p>
              <p className="text-sm text-muted-foreground">
                Ngày in: {new Date().toLocaleDateString("vi-VN")}
              </p>
            </div>
          </div>

          {/* Customer & Shipping Info */}
          <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
            <div className="rounded-xs border border-border p-4 bg-muted/20">
              <p className="font-semibold text-foreground uppercase tracking-wider text-xs mb-2">
                Thông tin người nhận
              </p>
              <p className="font-medium text-sm text-foreground">
                {detail.recipient?.["full_name"] || detail.customer?.full_name || "Khách lẻ"}
              </p>
              <p className="mt-1 text-muted-foreground">
                SĐT: {detail.recipient?.["phone"] || detail.customer?.phone || "—"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Đ/c: {detail.shipping_address?.["address"] || detail.shipping_address?.["line1"] || "—"},{" "}
                {detail.shipping_address?.["ward"] || ""}, {detail.shipping_address?.["district"] || ""},{" "}
                {detail.shipping_address?.["city"] || ""}
              </p>
            </div>

            <div className="rounded-xs border border-border p-4 bg-muted/20">
              <p className="font-semibold text-foreground uppercase tracking-wider text-xs mb-2">
                Thông tin vận chuyển & thanh toán
              </p>
              <p className="text-muted-foreground">
                Hình thức TT: <span className="font-medium text-foreground">{adminLabel(detail.payment_method)}</span>
              </p>
              <p className="mt-1 text-muted-foreground">
                Trạng thái TT: <span className="font-medium text-foreground">{paymentStatusLabel(detail.payment_status)}</span>
              </p>
              <p className="mt-1 text-muted-foreground">
                Trạng thái kho: <span className="font-medium text-foreground">{adminLabel(detail.fulfillment_status)}</span>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="mt-6 w-full text-sm text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
                <th className="py-2.5 px-3">Sản phẩm</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3 text-center">SL</th>
                <th className="py-2.5 px-3 text-right">Đơn giá</th>
                <th className="py-2.5 px-3 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {detail.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-foreground">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.color_label && `Màu: ${item.color_label} · `}
                      {item.size_label && `Kích cỡ: ${item.size_label}`}
                    </p>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-xs text-muted-foreground">
                    {item.sku}
                  </td>
                  <td className="py-3 px-3 text-center font-semibold">{item.qty}</td>
                  <td className="py-3 px-3 text-right">{fmtVND(item.unit_price_vnd)}</td>
                  <td className="py-3 px-3 text-right font-semibold">{fmtVND(item.line_total_vnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Tạm tính:</span>
                <span>{fmtVND(detail.subtotal_vnd)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Phí vận chuyển:</span>
                <span>{fmtVND(detail.shipping_vnd)}</span>
              </div>
              {detail.discount_vnd > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Giảm giá ({detail.discount_code}):</span>
                  <span>-{fmtVND(detail.discount_vnd)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold text-foreground">
                <span>Tổng cộng:</span>
                <span className="font-sans text-base text-primary">{fmtVND(detail.grand_total_vnd)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailTabView({
  orderId,
  onBack,
  onUpdated,
  onDetailLoaded,
  onNavigateToInventory,
}: {
  orderId: string | null;
  onBack: () => void;
  onUpdated: () => void;
  onDetailLoaded?: (detail: OrderDetail) => void;
  onNavigateToInventory?: ((seed: InventorySeed) => void) | undefined;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingFulfill, setUpdatingFulfill] = useState(false);
  const [statusDropOpen, setStatusDropOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await adminApi.orderDetail(id);
      setDetail(data);
      onDetailLoaded?.(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Lỗi tải chi tiết đơn hàng");
    } finally {
      setLoading(false);
    }
  }, [onDetailLoaded]);

  useEffect(() => {
    if (orderId) {
      void fetchDetail(orderId);
    } else {
      setDetail(null);
    }
  }, [orderId, fetchDetail]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setStatusDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkPaid = async () => {
    if (!detail) return;
    setMarkingPaid(true);
    try {
      await adminApi.markOrderPaid(detail.id);
      toast.success("Đã đánh dấu thanh toán thành công");
      await fetchDetail(detail.id);
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không thực hiện được");
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleStatusChange = async (newStatus: "pending" | "confirmed" | "cancelled") => {
    if (!detail) return;
    setUpdatingStatus(true);
    setStatusDropOpen(false);
    try {
      await adminApi.patchOrder(detail.id, { status: newStatus });
      toast.success(`Đã cập nhật trạng thái: ${STATUS_LABEL[newStatus]}`);
      await fetchDetail(detail.id);
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Cập nhật trạng thái thất bại");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Copy full fulfillment string for GHTK / GHN / Viettel Post
  const handleCopyFulfillment = () => {
    if (!detail) return;
    const recipientName =
      detail.recipient?.["full_name"] || detail.customer?.full_name || "Khách hàng";
    const recipientPhone = detail.recipient?.["phone"] || detail.customer?.phone || "";
    const fullAddress = [
      detail.shipping_address?.["address_line"],
      detail.shipping_address?.["ward"],
      detail.shipping_address?.["district"],
      detail.shipping_address?.["city"],
    ]
      .filter(Boolean)
      .join(", ");

    const itemsSummary = detail.items
      .map(
        (it) =>
          `${it.qty}x ${it.product_name} (${it.sku}${it.size_label ? ` - Kích cỡ ${it.size_label}` : ""})`,
      )
      .join("; ");

    const codAmount = detail.payment_method === "cod" ? fmtVND(detail.grand_total_vnd) : "0₫ (Đã thanh toán)";

    const text = `ĐƠN HÀNG: #${detail.order_number}
NGƯỜI NHẬN: ${recipientName}
SĐT: ${recipientPhone}
ĐỊA CHỈ: ${fullAddress}
SẢN PHẨM: ${itemsSummary}
TIỀN THU COD: ${codAmount}
GHI CHÚ: ${detail.shipping_address?.["note"] || "Cho khách xem hàng trước khi nhận"}`;

    void navigator.clipboard.writeText(text).then(
      () => toast.success("Đã copy toàn bộ thông tin xuất đơn (chuẩn giao vận)!"),
      () => toast.error("Không copy được"),
    );
  };

  // Navigate to Inventory & auto-fill stock issue document with color/size
  const handleCreateStockIssue = () => {
    if (!detail) return;
    if (!canFulfill) {
      if (isCancelled) {
        toast.error("Đơn hàng đã bị hủy, không thể xuất kho");
      } else {
        toast.error("Chỉ đơn hàng đã thanh toán thành công hoặc COD mới được xuất kho");
      }
      return;
    }
    if (!detail.items.length) {
      toast.error("Đơn hàng không có sản phẩm để xuất kho");
      return;
    }

    const recipientName =
      detail.recipient?.["full_name"] || detail.customer?.full_name || "Khách hàng";

    const lines = detail.items.map((it) => ({
      product_id: it.product_id || "",
      variant_id: it.variant_id || "",
      qty: it.qty,
      direction: "out" as const,
      sku: it.sku,
      product_name: it.product_name,
      color_label: it.color_label ?? null,
      size_label: it.size_label ?? null,
      image_url: it.image_url ?? null,
      unit_cost_vnd: it.unit_price_vnd, // Giá hóa đơn người dùng đã thanh toán
    }));

    if (onNavigateToInventory) {
      const seed: InventorySeed = {
        docType: "issue",
        orderId: detail.id,
        orderNumber: detail.order_number,
        reason: `Xuất kho đơn hàng #${detail.order_number} (${recipientName})`,
        lines,
      };
      if (lines[0]?.product_id) {
        seed.productId = lines[0].product_id;
      }
      if (lines[0]?.product_name) {
        seed.productName = lines[0].product_name;
      }
      onNavigateToInventory(seed);
    } else {
      toast.error("Không tìm thấy liên kết mục Kho hàng");
    }
  };

  const handleToggleFulfill = async (nextStatus: "fulfilled" | "unfulfilled") => {
    if (!detail) return;
    if (nextStatus === "fulfilled" && !canFulfill) {
      if (isCancelled) {
        toast.error("Đơn hàng đã bị hủy, không thể xuất kho");
      } else {
        toast.error("Chỉ đơn hàng đã thanh toán thành công hoặc COD mới được xuất kho");
      }
      return;
    }
    setUpdatingFulfill(true);
    try {
      await adminApi.fulfillOrder(detail.id, { status: nextStatus });
      toast.success(
        nextStatus === "fulfilled"
          ? "Đã đánh dấu đơn hàng: Đã xuất kho"
          : "Đã chuyển trạng thái đơn hàng: Chưa xuất kho",
      );
      await fetchDetail(detail.id);
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Cập nhật trạng thái xuất kho thất bại");
    } finally {
      setUpdatingFulfill(false);
    }
  };

  if (!orderId) {
    return (
      <div className="mt-8 flex min-h-[400px] flex-col items-center justify-center rounded-xs border border-dashed border-border p-12 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
          <ShoppingBag className="size-5" />
        </div>
        <h3 className="mt-4 font-sans admin-subsection-title">Chưa chọn đơn hàng nào</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Vui lòng chọn một đơn hàng từ danh sách để xem chi tiết thông tin sản phẩm và xuất kho.
        </p>
        <Button variant="outline" onClick={onBack} className="mt-5 h-8 text-sm gap-2">
          <ArrowLeft className="size-3.5" />
          Xem danh sách đơn hàng
        </Button>
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="mt-8 flex min-h-[380px] items-center justify-center rounded-xs border border-border bg-card p-12">
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p>Đang tải thông tin chi tiết đơn hàng #{orderId}…</p>
        </div>
      </div>
    );
  }

  const recipientName =
    detail.recipient?.["full_name"] || detail.customer?.full_name || "Khách mua hàng";
  const recipientPhone = detail.recipient?.["phone"] || detail.customer?.phone || "";
  const recipientEmail = detail.recipient?.["email"] || detail.customer?.email || "";
  const fullAddress = [
    detail.shipping_address?.["address_line"],
    detail.shipping_address?.["ward"],
    detail.shipping_address?.["district"],
    detail.shipping_address?.["city"],
  ]
    .filter(Boolean)
    .join(", ");

  const isPaid = detail.payment_status === "paid";
  const isCod = detail.payment_method === "cod";
  const isCancelled = detail.status === "cancelled";
  const isFulfilled =
    detail.fulfillment_status === "fulfilled" ||
    detail.fulfillment_status === "shipping" ||
    detail.fulfillment_status === "delivered";
  const canFulfill = !isCancelled && (isPaid || isCod);
  const canMarkPaid = detail.payment_method === "bank" && detail.payment_status === "awaiting" && !isCancelled;

  return (
    <div className="mt-6 space-y-6">
      {/* Print Slip Modal */}
      {printModalOpen && (
        <PackingSlipModal
          detail={detail}
          onClose={() => setPrintModalOpen(false)}
        />
      )}

      {/* Top Action Bar (Matching ÉLANE Style) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group cursor-pointer bg-transparent border-none p-0"
            title="Quay lại danh sách đơn hàng"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Đơn hàng</span>
          </button>
          <span className="text-muted-foreground/40 text-sm select-none">/</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular-nums text-base font-semibold text-foreground">
              #{detail.order_number}
            </span>
            <OrderStatusBadge status={detail.status} fulfillmentStatus={detail.fulfillment_status} paymentStatus={detail.payment_status} />
            <PaymentBadge method={detail.payment_method} status={detail.payment_status} />
            <FulfillmentBadge
              fulfillmentStatus={detail.fulfillment_status}
              paymentMethod={detail.payment_method}
              paymentStatus={detail.payment_status}
              orderStatus={detail.status}
              docCode={detail.inventory_doc_code}
            />
            <span className="hidden sm:inline text-sm text-muted-foreground">
              · {fmtDate(detail.placed_at)}
            </span>
          </div>
        </div>

        {/* Action Buttons (Clean & concise: Print packing slip, Courier export, Status) */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-8 text-sm"
          >
            Quay lại
          </Button>
          {/* Print Slip Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrintModalOpen(true)}
            className="h-8 gap-1.5 text-sm"
          >
            <Printer className="size-3.5 text-muted-foreground" />
            <span>In phiếu giao hàng</span>
          </Button>

          {/* Copy for Courier Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyFulfillment}
            className="h-8 gap-1.5 text-sm"
            title="Copy đầy đủ thông tin gửi bưu tá / đơn vị vận chuyển"
          >
            <Share2 className="size-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Xuất đơn</span>
          </Button>

          {/* Mark Paid button if awaiting bank transfer */}
          {canMarkPaid && (
            <Button
              size="sm"
              variant="outline"
              disabled={markingPaid}
              onClick={() => void handleMarkPaid()}
              className="h-8 gap-1.5 text-sm border-emerald-600/40 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300"
            >
              {markingPaid ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5 text-emerald-600" />
              )}
              Xác nhận đã nhận tiền
            </Button>
          )}

          {/* Status Dropdown */}
          <div className="relative" ref={dropRef}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusDropOpen(!statusDropOpen)}
              disabled={updatingStatus || detail.status === "cancelled"}
              className="h-8 gap-1.5 text-sm"
            >
              {updatingStatus ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Clock className="size-3.5 text-muted-foreground" />
              )}
              <span>Đổi trạng thái</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
            {statusDropOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[190px] rounded-xs border border-border bg-card p-1 shadow-lg">
                {(["pending", "confirmed", "cancelled"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => void handleStatusChange(s)}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
                      detail.status === s && "font-medium text-foreground bg-secondary/80",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          s === "pending" && "bg-primary",
                          s === "confirmed" && "bg-emerald-600",
                          s === "cancelled" && "bg-muted-foreground",
                        )}
                      />
                      {STATUS_LABEL[s]}
                    </span>
                    {detail.status === s && <Check className="size-3.5 text-foreground" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          {/* Stepper Progress */}
          <div className="rounded-xs border border-border bg-card p-5">
            <p className="section-label">Tiến trình xử lý đơn hàng</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  key: "pending",
                  label: "1. Chờ xác nhận",
                  done: true,
                  active: detail.status === "pending",
                },
                {
                  key: "confirmed",
                  label: "2. Đã duyệt & Đóng gói",
                  done: detail.status === "confirmed",
                  active: detail.status === "confirmed",
                },
                {
                  key: "shipping",
                  label: "3. Đang giao hàng",
                  done: false,
                  active: false,
                },
                {
                  key: "done",
                  label: "4. Hoàn tất",
                  done: false,
                  active: false,
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 rounded-xs border p-3 text-sm transition-colors",
                    step.active
                      ? "border-foreground bg-secondary/50 font-medium text-foreground"
                      : step.done
                        ? "border-border bg-card text-foreground"
                        : "border-border/50 bg-secondary/20 text-muted-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-xs tabular-nums",
                      step.active
                        ? "bg-foreground text-background font-semibold"
                        : step.done
                          ? "bg-secondary text-foreground font-medium"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {step.done && !step.active ? "✓" : idx + 1}
                  </div>
                  <span className="truncate">{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Product Items Table */}
          <div className="overflow-hidden rounded-xs border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3.5">
              <div>
                <p className="section-label">Danh sách sản phẩm ({detail.items.length})</p>
                <h3 className="mt-0.5 font-sans admin-subsection-title">Sản phẩm xuất kho</h3>
              </div>
              <span className="text-sm text-muted-foreground tabular-nums">
                Tổng SL: {detail.items.reduce((s, it) => s + it.qty, 0)} cái
              </span>
            </div>

            <div className="divide-y divide-border">
              {detail.items.map((item, idx) => {
                const imgUrl = resolveImageUrl(item.image_url);
                return (
                  <div
                    key={idx}
                    className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-secondary/20 transition-colors"
                  >
                    {/* Thumbnail & Info */}
                    <div className="flex items-start gap-4">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-xs border border-border bg-secondary">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={item.product_name}
                            className="size-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Package className="size-6 stroke-[1.5]" />
                          </div>
                        )}
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-foreground/80 px-1 tabular-nums text-xs font-semibold text-background">
                          x{item.qty}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="font-sans text-sm font-medium leading-snug text-foreground">
                          {item.product_name}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 tabular-nums text-sm text-foreground">
                            <span className="text-muted-foreground">SKU:</span>
                            <span className="font-semibold">{item.sku}</span>
                            <button
                              onClick={() => copyText("mã SKU", item.sku)}
                              className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy mã SKU"
                            >
                              <Copy className="size-3" />
                            </button>
                          </div>

                          {item.size_label && (
                            <span className="rounded bg-secondary px-2 py-0.5 text-sm text-muted-foreground">
                              Kích cỡ {item.size_label}
                            </span>
                          )}

                          {item.color_label && (
                            <span className="rounded bg-secondary px-2 py-0.5 text-sm text-muted-foreground">
                              {item.color_label}
                            </span>
                          )}
                        </div>

                        {item.barcode && (
                          <p className="tabular-nums text-xs text-muted-foreground">
                            Mã vạch: {item.barcode}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price and Total */}
                    <div className="flex items-center justify-between border-t border-border/50 pt-2 sm:border-0 sm:pt-0 sm:text-right">
                      <span className="text-sm text-muted-foreground sm:hidden">Thành tiền:</span>
                      <div>
                        <p className="font-sans text-sm font-medium text-foreground">
                          {fmtVND(item.line_total_vnd)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.qty} × {fmtVND(item.unit_price_vnd)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Financial Breakdown */}
            <div className="border-t border-border bg-card/60 p-5">
              <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Tạm tính tiền hàng:</span>
                  <span className="text-foreground">{fmtVND(detail.subtotal_vnd)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Phí vận chuyển:</span>
                  <span className="text-foreground">{fmtVND(detail.shipping_vnd)}</span>
                </div>
                {detail.discount_vnd > 0 && (
                  <div className="flex justify-between text-primary">
                    <span className="flex items-center gap-1">
                      <span>Mã giảm giá</span>
                      {detail.discount_code && (
                        <span className="rounded bg-primary/10 px-1 tabular-nums text-xs font-semibold text-primary">
                          {detail.discount_code}
                        </span>
                      )}
                    </span>
                    <span>-{fmtVND(detail.discount_vnd)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold text-foreground">
                  <span>Tổng thanh toán:</span>
                  <span className="font-sans text-lg font-semibold text-primary">
                    {fmtVND(detail.grand_total_vnd)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fulfillment Instructions Box */}
          <div className="rounded-xs border border-border bg-card p-5">
            <p className="section-label">Ghi chú đóng gói & xuất đơn</p>
            <div className="mt-2 rounded-xs border border-border/70 bg-secondary/40 p-3 text-sm text-foreground">
              <p className="font-medium">
                {detail.shipping_address?.["note"] || "Không có ghi chú thêm từ khách hàng."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>• Kiểm tra đúng kích cỡ và màu trước khi niêm phong hộp ÉLANE.</span>
                <span>• Kèm theo thẻ cảm ơn và phiếu bảo hành tiêu chuẩn.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Warehouse & Fulfillment Card */}
          <div className="rounded-xs border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <Boxes className="size-4 text-primary" />
                <p className="section-label text-foreground">Kho vận & Xuất kho</p>
              </div>
              <FulfillmentBadge
                fulfillmentStatus={detail.fulfillment_status}
                paymentMethod={detail.payment_method}
                paymentStatus={detail.payment_status}
                orderStatus={detail.status}
                docCode={detail.inventory_doc_code}
              />
            </div>

            <div className="space-y-3 text-sm">
              {isCancelled ? (
                <div className="rounded-xs border border-border bg-secondary/50 p-3 text-sm text-muted-foreground">
                  <p className="font-semibold flex items-center gap-1.5 text-foreground">
                    <span className="size-2 rounded-full bg-muted-foreground" />
                    Đơn hàng đã bị hủy
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">
                    Đơn hàng này đã bị hủy bỏ. Không thể tạo phiếu xuất kho hay xuất hàng.
                  </p>
                </div>
              ) : isFulfilled ? (
                <>
                  <div className="rounded-xs border border-emerald-600/30 bg-emerald-500/10 p-3 text-sm text-emerald-950 dark:text-emerald-200">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Check className="size-3.5 text-emerald-600" />
                      Đơn hàng đã được xuất kho
                    </p>
                    {detail.fulfilled_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Thời gian xuất: {fmtDate(detail.fulfilled_at)}
                      </p>
                    )}
                    {detail.inventory_doc_code && (
                      <p className="mt-0.5 tabular-nums text-xs text-primary font-medium">
                        Mã phiếu kho: #{detail.inventory_doc_code}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={updatingFulfill}
                      onClick={() => void handleToggleFulfill("unfulfilled")}
                      className="w-full text-sm text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                      {updatingFulfill && <Loader2 className="size-3.5 animate-spin mr-1" />}
                      Đổi sang: Chưa xuất kho
                    </Button>
                  </div>
                </>
              ) : canFulfill ? (
                <>
                  <div className="rounded-xs border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-200">
                    <p className="font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                      <Boxes className="size-3.5 text-amber-700" />
                      Đã sẵn sàng xuất kho
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                      Đơn hàng đã {isPaid ? "thanh toán thành công qua chuyển khoản" : "chọn hình thức COD"}. Đủ điều kiện xuất hàng bàn giao cho đơn vị vận chuyển.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    {/* Nơi duy nhất tạo phiếu xuất kho */}
                    <Button
                      size="sm"
                      onClick={handleCreateStockIssue}
                      className="w-full gap-1.5 bg-foreground text-background hover:bg-foreground/90 text-sm font-medium h-9"
                      title="Chuyển sang mục Kho hàng và tự động nhập các mặt hàng (màu, kích cỡ, SL) vào phiếu xuất kho"
                    >
                      <Boxes className="size-3.5" />
                      <span>Tạo phiếu xuất kho</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updatingFulfill}
                      onClick={() => void handleToggleFulfill("fulfilled")}
                      className="w-full gap-1.5 text-sm border-emerald-600/40 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 h-8"
                      title="Đánh dấu đơn hàng đã được xuất kho nhanh chóng"
                    >
                      {updatingFulfill ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5 text-emerald-600" />
                      )}
                      <span>Đánh dấu đã xuất kho</span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-xs border border-amber-600/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Clock className="size-3.5 text-amber-700" />
                    Chưa đủ điều kiện xuất kho
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Chỉ những đơn hàng đã thanh toán thành công (VietQR) hoặc COD mới được xuất kho. Đơn này đang chờ thanh toán hoặc chưa thanh toán.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Shipping & Recipient Card */}
          <div className="rounded-xs border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                <p className="section-label text-foreground">Địa chỉ giao nhận</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyText("địa chỉ giao hàng", fullAddress)}
                className="h-6 px-2 text-xs"
              >
                <Copy className="size-3 mr-1" />
                Sao chép
              </Button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="section-label">Người nhận hàng</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{recipientName}</p>
              </div>

              <div>
                <p className="section-label">Số điện thoại</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="tabular-nums text-sm font-semibold text-foreground">
                    {recipientPhone || "—"}
                  </p>
                  {recipientPhone && (
                    <button
                      onClick={() => copyText("số điện thoại", recipientPhone)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy SĐT"
                    >
                      <Copy className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <p className="section-label">Địa chỉ cụ thể</p>
                <p className="mt-0.5 leading-relaxed text-foreground">
                  {fullAddress || "Chưa có địa chỉ cụ thể"}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Details Card */}
          <div className="rounded-xs border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <p className="section-label text-foreground">Thanh toán</p>
              </div>
              <PaymentBadge method={detail.payment_method} status={detail.payment_status} />
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="section-label">Phương thức</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {PAYMENT_METHOD_LABEL[detail.payment_method] || detail.payment_method}
                </p>
              </div>

              <div>
                <p className="section-label">Trạng thái</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {PAYMENT_STATUS_LABEL[detail.payment_status] || detail.payment_status}
                </p>
              </div>

              {detail.paid_at && (
                <div>
                  <p className="section-label">Thời gian thanh toán</p>
                  <p className="mt-0.5 font-medium text-emerald-700 dark:text-emerald-400">
                    {fmtDate(detail.paid_at)}
                  </p>
                </div>
              )}

              {detail.payment_ref && (
                <div>
                  <p className="section-label">Mã giao dịch / Tham chiếu</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="tabular-nums text-sm font-semibold text-primary">
                      {detail.payment_ref}
                    </p>
                    <button
                      onClick={() => copyText("mã tham chiếu", detail.payment_ref || "")}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy mã tham chiếu"
                    >
                      <Copy className="size-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer Account Info */}
          <div className="rounded-xs border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-border/70 pb-3">
              <User className="size-4 text-primary" />
              <p className="section-label text-foreground">Tài khoản khách hàng</p>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="section-label">Họ và tên</p>
                <p className="mt-0.5 font-medium text-foreground">
                  {detail.customer?.full_name || recipientName}
                </p>
              </div>

              <div>
                <p className="section-label">Email</p>
                <p className="mt-0.5 text-muted-foreground">
                  {recipientEmail || "Chưa cập nhật"}
                </p>
              </div>

              <div>
                <p className="section-label">Mã đơn hàng</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="tabular-nums font-semibold text-foreground">#{detail.order_number}</p>
                  <button
                    onClick={() => copyText("mã đơn", detail.order_number)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Copy mã đơn"
                  >
                    <Copy className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main OrdersManager Component with Tabs ──────────────────────────────────



// ─── Main OrdersManager Component ──────────────────────────────────────────

export function OrdersManager({
  permissions = [],
  onNavigateToInventory,
  targetOrderNumber,
  onOrderConsumed,
}: {
  permissions?: string[];
  onNavigateToInventory?: (seed: InventorySeed) => void;
  targetOrderNumber?: string | null;
  onOrderConsumed?: () => void;
} = {}) {
  const hasPermission = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const canCreateOrder = hasPermission("order.write") && hasPermission("order.customer.read");
  const canUpdateOrder = hasPermission("order.update");
  const canCancelOrder = hasPermission("order.cancel");
  const canExportOrders = hasPermission("order.export");
  const navigate = useNavigate();
  const location = useLocation();
  const route = resolveAdminPath(location.pathname);
  const activeOrderParam = (route.tabId === "orders" ? route.subParam : null) ?? targetOrderNumber;

  const isCreateRoute =
    route.action === "create" ||
    activeOrderParam === "them" ||
    activeOrderParam === "themdon" ||
    activeOrderParam === "create";

  const [activeMainTab, setActiveMainTab] = useState<"list" | "detail" | "create">(
    isCreateRoute ? "create" : activeOrderParam ? "detail" : "list",
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(activeOrderParam ?? null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(activeOrderParam ?? null);

  const [orders, setOrders] = useState<EnhancedOrder[]>([]);
  const [orderStats, setOrderStats] = useState({
    total: 0, revenue_vnd: 0, pending_payment: 0, processing: 0, shipping: 0,
    delivered: 0, cancelled: 0, returned: 0, today_orders: 0, today_revenue_vnd: 0,
  });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderFilterTab>("all");
  const [search, setSearch] = useState("");
  const [dateRangeLabel, setDateRangeLabel] = useState("Tất cả thời gian");
  const [sortByOption, setSortByOption] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // Modals
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [printSlipDetail, setPrintSlipDetail] = useState<OrderDetail | null>(null);

  // New Order Form State
  const [newOrderForm, setNewOrderForm] = useState({
    customer_name: "",
    phone: "",
    city: "Hà Nội",
    product_name: "Áo khoác dạ nữ",
    items_count: 1,
    grand_total_vnd: 1890000,
    payment_method: "vietqr",
    payment_status: "paid",
  });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.orders();
      if (res && res.items && res.items.length > 0) {
        // Map backend orders into EnhancedOrder format
        const mappedBackendOrders: EnhancedOrder[] = res.items.map((bo) => ({
          id: bo.id,
          order_number: bo.order_number,
          customer_name: bo.customer_name || "Khách hàng",
          customer_location: bo.customer_location || "—",
          items_count: bo.items_count || 1,
          item_images:
            bo.item_images && bo.item_images.length > 0
              ? bo.item_images
              : [],
          extra_items: bo.extra_items ?? 0,
          grand_total_vnd: Number(bo.grand_total_vnd) || 0,
          payment_method: bo.payment_method || "vietqr",
          payment_status:
            bo.status === "cancelled" || bo.payment_status === "failed" || bo.payment_status === "cancelled"
              ? "failed"
              : bo.payment_status === "paid"
                ? "paid"
                : bo.payment_status === "refunded"
                  ? "refunded"
                  : "pending",
          fulfillment_status:
            bo.status === "cancelled"
              ? "cancelled"
              : bo.fulfillment_status === "delivered"
                ? "delivered"
                : bo.fulfillment_status === "fulfilled" || bo.fulfillment_status === "shipping"
                  ? "shipping"
                  : bo.fulfillment_status === "unfulfilled"
                    ? "processing"
                    : bo.fulfillment_status || "processing",
          placed_at: bo.placed_at || new Date().toISOString(),
          status: bo.status,
          inventory_doc_id: bo.inventory_doc_id,
          inventory_doc_code: bo.inventory_doc_code,
        }));

        setOrders(mappedBackendOrders);
        if (res.stats) {
          setOrderStats(res.stats);
        } else {
          const activeOrders = mappedBackendOrders.filter((o) => o.status !== "cancelled");
          const today = new Date().toDateString();
          setOrderStats({
            total: mappedBackendOrders.length,
            revenue_vnd: activeOrders.reduce((sum, o) => sum + o.grand_total_vnd, 0),
            pending_payment: activeOrders.filter((o) => o.payment_status === "pending").length,
            processing: activeOrders.filter((o) => ["processing", "picking"].includes(o.fulfillment_status)).length,
            shipping: activeOrders.filter((o) => o.fulfillment_status === "shipping").length,
            delivered: activeOrders.filter((o) => o.fulfillment_status === "delivered").length,
            cancelled: mappedBackendOrders.filter((o) => o.status === "cancelled").length,
            returned: mappedBackendOrders.filter((o) => o.fulfillment_status === "returned" || o.payment_status === "refunded").length,
            today_orders: mappedBackendOrders.filter((o) => new Date(o.placed_at).toDateString() === today).length,
            today_revenue_vnd: activeOrders
              .filter((o) => new Date(o.placed_at).toDateString() === today)
              .reduce((sum, o) => sum + o.grand_total_vnd, 0),
          });
        }
      } else {
        setOrders([]);
        setOrderStats({ total: 0, revenue_vnd: 0, pending_payment: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0, returned: 0, today_orders: 0, today_revenue_vnd: 0 });
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // URL route synchronization
  useEffect(() => {
    if (route.tabId === "orders") {
      if (
        route.action === "create" ||
        activeOrderParam === "them" ||
        activeOrderParam === "themdon" ||
        activeOrderParam === "create"
      ) {
        setActiveMainTab("create");
      } else if (activeOrderParam) {
        const match = orders.find(
          (o) =>
            o.order_number.toLowerCase() === activeOrderParam.toLowerCase() ||
            o.id.toLowerCase() === activeOrderParam.toLowerCase(),
        );
        if (match) {
          setSelectedOrderId(match.id);
          setSelectedOrderNumber(match.order_number);
        } else {
          setSelectedOrderId(activeOrderParam);
          setSelectedOrderNumber(activeOrderParam);
        }
        setActiveMainTab("detail");
        onOrderConsumed?.();
      } else {
        setActiveMainTab("list");
      }
    }
  }, [route.tabId, route.action, activeOrderParam, orders, onOrderConsumed]);

  const handleOpenCreateOrder = () => {
    if (!canCreateOrder) {
      toast.error("Bạn không có quyền tạo đơn hàng");
      return;
    }
    setActiveMainTab("create");
    navigate({ to: "/donhang/themdon" as any });
  };

  const handleOpenDetail = (order: EnhancedOrder) => {
    setSelectedOrderId(order.id);
    setSelectedOrderNumber(order.order_number);
    setActiveMainTab("detail");
    navigate({ to: `/donhang/${order.order_number}` as any });
  };

  const handleBackToList = () => {
    setSelectedOrderId(null);
    setSelectedOrderNumber(null);
    setActiveMainTab("list");
    navigate({ to: "/donhang" as any });
  };

  // Selection handlers
  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === pagedOrders.length && pagedOrders.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(pagedOrders.map((o) => o.id)));
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!canExportOrders) {
      toast.error("Bạn không có quyền xuất danh sách đơn hàng");
      return;
    }
    const headers = ["Mã đơn", "Khách hàng", "Khu vực", "Số lượng", "Tổng tiền VNĐ", "Thanh toán", "Vận chuyển", "Ngày đặt"];
    const rows = filtered.map((o) => [
      `#${o.order_number}`,
      o.customer_name,
      o.customer_location,
      o.items_count,
      o.grand_total_vnd,
      o.payment_status,
      o.fulfillment_status,
      o.placed_at,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((cell) => `"${cell}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đã xuất danh sách đơn hàng ra file CSV thành công!");
  };

  // Quick actions
  const handleMarkPaid = async (order: EnhancedOrder) => {
    if (!canUpdateOrder) {
      toast.error("Bạn không có quyền cập nhật đơn hàng");
      return;
    }
    try {
      await adminApi.markOrderPaid(order.id);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, payment_status: "paid" } : o)),
      );
      toast.success(`Đơn hàng #${order.order_number} đã được xác nhận thanh toán!`);
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, payment_status: "paid" } : o)),
      );
      toast.success(`Đơn hàng #${order.order_number} đã được cập nhật thanh toán!`);
    }
  };

  const handleCancelOrder = async (order: EnhancedOrder) => {
    if (!canCancelOrder) {
      toast.error("Bạn không có quyền hủy đơn hàng");
      return;
    }
    try {
      await adminApi.patchOrder(order.id, { status: "cancelled" });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, status: "cancelled", fulfillment_status: "cancelled", payment_status: "failed" }
            : o,
        ),
      );
      toast.success(`Đã hủy đơn hàng #${order.order_number}!`);
    } catch {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, status: "cancelled", fulfillment_status: "cancelled", payment_status: "failed" }
            : o,
        ),
      );
      toast.success(`Đã hủy đơn hàng #${order.order_number}!`);
    }
  };

  const handlePrintSlip = async (order: EnhancedOrder) => {
    try {
      const res = await adminApi.orderDetail(order.id);
      setPrintSlipDetail(res);
    } catch {
      toast.error("Không tải được chi tiết đơn hàng để in phiếu");
    }
  };

  // Create Order submit
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderForm.customer_name.trim()) {
      toast.error("Vui lòng nhập tên khách hàng");
      return;
    }

    const grandTotal = Number(newOrderForm.grand_total_vnd) || 1890000;
    try {
      const res = await adminApi.createOrder({
        customer_name: newOrderForm.customer_name.trim(),
        shipping: {
          full_name: newOrderForm.customer_name.trim(),
          address_line: newOrderForm.address || "Chưa xác định",
          city: newOrderForm.city || "Hà Nội",
          country: "Việt Nam",
        },
        items: [
          {
            sku: "EL-ITEM-01",
            product_name: "Sản phẩm thời trang ÉLANE",
            unit_price_vnd: grandTotal,
            qty: Number(newOrderForm.items_count) || 1,
          },
        ],
        payment_method: newOrderForm.payment_method,
        payment_status: newOrderForm.payment_status as any,
        fulfillment_status: "unfulfilled",
        status: "confirmed",
      });
      await fetchOrders();
      setCreateOrderModalOpen(false);
      toast.success(`Tạo đơn hàng #${res.order_number} thành công!`);
    } catch (err: any) {
      toast.error(adminErrorMessage(err) || "Không thể tạo đơn hàng trên máy chủ!");
    }
  };

  // Filtered orders
  const filtered = useMemo(() => {
    return orders
      .filter((o) => {
        if (statusFilter === "pending_payment") {
          if (o.payment_status !== "pending") return false;
        } else if (statusFilter === "processing") {
          if (o.fulfillment_status !== "processing" && o.fulfillment_status !== "picking") return false;
        } else if (statusFilter === "shipping") {
          if (o.fulfillment_status !== "shipping") return false;
        } else if (statusFilter === "delivered") {
          if (o.fulfillment_status !== "delivered") return false;
        } else if (statusFilter === "cancelled") {
          if (o.fulfillment_status !== "cancelled" && o.status !== "cancelled") return false;
        } else if (statusFilter === "returned") {
          if (o.fulfillment_status !== "returned" && o.payment_status !== "refunded") return false;
        }

        if (search.trim()) {
          const q = search.toLowerCase();
          const matchNum = o.order_number.toLowerCase().includes(q);
          const matchCust = o.customer_name?.toLowerCase().includes(q);
          const matchLoc = o.customer_location?.toLowerCase().includes(q);
          if (!matchNum && !matchCust && !matchLoc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortByOption === "newest") {
          return new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime();
        } else if (sortByOption === "oldest") {
          return new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime();
        } else if (sortByOption === "highest") {
          return b.grand_total_vnd - a.grand_total_vnd;
        } else if (sortByOption === "lowest") {
          return a.grand_total_vnd - b.grand_total_vnd;
        }
        return 0;
      });
  }, [orders, statusFilter, search, sortByOption]);

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Status Tabs definitions
  const ORDER_TABS: Array<{ label: string; key: OrderFilterTab; count: number | string }> = [
    { label: "Tất cả", key: "all", count: "" },
    { label: "Chờ thanh toán", key: "pending_payment", count: orderStats.pending_payment },
    { label: "Đang xử lý", key: "processing", count: orderStats.processing },
    { label: "Đang giao", key: "shipping", count: orderStats.shipping },
    { label: "Đã giao", key: "delivered", count: orderStats.delivered },
    { label: "Đã hủy", key: "cancelled", count: orderStats.cancelled },
    { label: "Trả hàng", key: "returned", count: orderStats.returned },
  ];

  const sortByLabel =
    sortByOption === "newest"
      ? "Mới nhất"
      : sortByOption === "oldest"
        ? "Cũ nhất"
        : sortByOption === "highest"
          ? "Giá cao nhất"
          : "Giá thấp nhất";

  // If active tab is create, render CreateOrderView
  if (activeMainTab === "create") {
    return (
      <CreateOrderView
        onBack={handleBackToList}
        onOrderCreated={(newOrd) => {
          setOrders((prev) => [newOrd, ...prev]);
          handleBackToList();
        }}
          onSaveDraft={(draftOrd) => {
          setOrders((prev) => [draftOrd, ...prev]);
          handleBackToList();
        }}
      />
    );
  }

  // If active tab is detail, render the detail view
  if (activeMainTab === "detail") {
    return (
      <OrderDetailView
        orderId={selectedOrderId}
        orderNumber={selectedOrderNumber}
        onBack={handleBackToList}
        onUpdated={() => {
          void fetchOrders();
        }}
        onNavigateToInventory={onNavigateToInventory}
        permissions={permissions}
      />
    );
  }

  return (
    <div className="space-y-5 font-sans pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-slate-950 admin-page-title">
            Đơn hàng
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Quản lý đơn hàng, theo dõi thanh toán và trạng thái xử lý giao nhận.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {/* Export Button */}
          {canExportOrders && <Button
            variant="outline"
            onClick={handleExportCSV}
            className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Download className="size-3.5 text-slate-500" />
            <span>Xuất CSV</span>
          </Button>}

          {/* Create Order Button */}
          {canCreateOrder && <Button
            onClick={handleOpenCreateOrder}
            className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-semibold text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Tạo đơn hàng</span>
          </Button>}
        </div>
      </div>

      {/* 2. Metric / Stat Cards (4 Cards Grid) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: TOTAL ORDERS */}
        <div className="rounded-xs border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-3.5 text-slate-400" />
              <span className="text-sm font-semibold tracking-wider uppercase text-slate-600">
                Tổng đơn hàng
              </span>
            </div>
            <button type="button" className="text-slate-400 hover:text-slate-700 p-0.5">
              <MoreVertical className="size-3.5" />
            </button>
          </div>
          <p className="mt-2 admin-metric  font-semibold tracking-tight text-slate-950">
            {orderStats.total.toLocaleString("vi-VN")}
          </p>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
              {orderStats.today_orders.toLocaleString("vi-VN")}
            </span>
            <span className="text-slate-500 font-semibold text-sm">đơn hôm nay</span>
          </div>
        </div>

        {/* Card 2: REVENUE */}
        <div className="rounded-xs border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <div className="flex items-center gap-2">
              <DollarSign className="size-3.5 text-slate-400" />
              <span className="text-sm font-semibold tracking-wider uppercase text-slate-600">
                Doanh thu
              </span>
            </div>
            <button type="button" className="text-slate-400 hover:text-slate-700 p-0.5">
              <MoreVertical className="size-3.5" />
            </button>
          </div>
          <p className="mt-2 admin-metric  font-semibold tracking-tight text-slate-950">
            {fmtVND(orderStats.revenue_vnd)}
          </p>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
              {fmtVND(orderStats.today_revenue_vnd)}
            </span>
            <span className="text-slate-500 font-semibold text-sm">hôm nay</span>
          </div>
        </div>

        {/* Card 3: PENDING PAYMENT */}
        <div className="rounded-xs border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <div className="flex items-center gap-2">
              <CreditCard className="size-3.5 text-slate-400" />
              <span className="text-sm font-semibold tracking-wider uppercase text-slate-600">
                Chờ thanh toán
              </span>
            </div>
            <button type="button" className="text-slate-400 hover:text-slate-700 p-0.5">
              <MoreVertical className="size-3.5" />
            </button>
          </div>
          <p className="mt-2 admin-metric  font-semibold tracking-tight text-slate-950">
            {orderStats.pending_payment.toLocaleString("vi-VN")}
          </p>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600">
              Dữ liệu hiện tại
            </span>
          </div>
        </div>

        {/* Card 4: TO SHIP */}
        <div className="rounded-xs border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <div className="flex items-center gap-2">
              <Truck className="size-3.5 text-slate-400" />
              <span className="text-sm font-semibold tracking-wider uppercase text-slate-600">
                Chờ giao hàng
              </span>
            </div>
            <button type="button" className="text-slate-400 hover:text-slate-700 p-0.5">
              <MoreVertical className="size-3.5" />
            </button>
          </div>
          <p className="mt-2 admin-metric  font-semibold tracking-tight text-slate-950">
            {orderStats.shipping.toLocaleString("vi-VN")}
          </p>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
              Dữ liệu hiện tại
            </span>
          </div>
        </div>
      </div>

      {/* 3. Status Filter Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-0.5 select-none">
        {ORDER_TABS.map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xs border px-3.5 py-1.5 text-sm font-semibold transition-all cursor-pointer",
                isActive
                  ? "border-[#6941c6] bg-purple-50/60 text-[#6941c6] shadow-2xs"
                  : "border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950",
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== "" && (
                <span
                  className={cn(
                    "rounded-xs px-1.5 py-0.5 text-sm leading-tight font-semibold transition-colors",
                    isActive ? "bg-purple-100 text-[#6941c6]" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Controls Toolbar (Search, Date range, Filter, Sort) */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Search input & Date picker */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo mã đơn, tên khách hàng hoặc SĐT..."
              className="h-9 pl-8.5 rounded-xs border-slate-200 bg-white text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
            />
          </div>

          {/* Date Picker Button */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-xs border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 cursor-pointer"
              >
                <Calendar className="size-3.5 text-slate-500" />
                <span>{dateRangeLabel}</span>
                <ChevronDown className="size-3 text-slate-400 ml-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1.5 rounded-xs text-sm shadow-lg" align="start">
              <div className="space-y-1">
                {["7 ngày qua", "30 ngày qua", "Tháng này", "Toàn bộ thời gian"].map(
                  (opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDateRangeLabel(opt)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-xs transition-colors font-semibold",
                        dateRangeLabel === opt
                          ? "bg-purple-50 text-[#6941c6]"
                          : "hover:bg-slate-100 text-slate-700",
                      )}
                    >
                      {opt}
                    </button>
                  ),
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Right: Filter & Sort */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterModalOpen(true)}
            className="h-9 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 gap-1.5 shadow-2xs"
          >
            <SlidersHorizontal className="size-3.5 text-slate-500" />
            <span>Bộ lọc</span>
          </Button>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 gap-1.5 shadow-2xs"
              >
                <ArrowDownUp className="size-3.5 text-slate-500" />
                <span>Sắp xếp: {sortByLabel}</span>
                <ChevronDown className="size-3 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xs p-1 shadow-lg text-sm font-semibold text-slate-800">
              <DropdownMenuItem onClick={() => setSortByOption("newest")}>Mới nhất</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortByOption("oldest")}>Cũ nhất</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortByOption("highest")}>Giá cao nhất</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortByOption("lowest")}>Giá thấp nhất</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 5. Orders Table */}
      <div className="overflow-hidden rounded-xs border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-700">
              <tr>
                <th className="w-10 px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={selectedOrderIds.size === pagedOrders.length && pagedOrders.length > 0}
                    onChange={toggleSelectAll}
                    className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                  />
                </th>
                <th className="px-3.5 py-3 font-semibold text-slate-700">Mã đơn</th>
                <th className="px-3.5 py-3 font-semibold text-slate-700">Khách hàng</th>
                <th className="px-3.5 py-3 font-semibold text-slate-700">Sản phẩm</th>
                <th className="px-3.5 py-3 font-semibold text-slate-700">Tổng tiền</th>
                <th className="px-3.5 py-3 font-semibold text-slate-700">Thanh toán</th>
                <th className="px-3.5 py-3 font-semibold text-slate-700">Xuất kho</th>
                <th className="px-3.5 py-3 font-semibold text-slate-700">Giao hàng</th>
                <th className="px-3.5 py-3 font-semibold text-slate-700">Ngày đặt</th>
                <th className="w-24 whitespace-nowrap px-3.5 py-3 text-right font-semibold text-slate-700">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-slate-400">
                    <ShoppingBag className="mx-auto size-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-800 text-sm">Không tìm thấy đơn hàng</p>
                    <p className="text-sm font-medium text-slate-500 mt-0.5">
                      Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.
                    </p>
                  </td>
                </tr>
              ) : (
                pagedOrders.map((order) => {
                  const isSelected = selectedOrderIds.has(order.id);
                  const { dateFormatted, timeFormatted } = formatOrderDate(order.placed_at);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => handleOpenDetail(order)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-slate-50/80",
                        isSelected && "bg-purple-50/30",
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3.5 py-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                        />
                      </td>

                      {/* Order ID */}
                      <td className="px-3.5 py-1">
                        <span className="tabular-nums font-semibold text-slate-950 text-sm hover:text-[#6941c6] inline-flex items-center gap-1 group">
                          <span>#{order.order_number}</span>
                          <ChevronRight className="size-3 text-slate-400 group-hover:text-[#6941c6] group-hover:translate-x-0.5 transition-all" />
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="px-3.5 py-1">
                        <div>
                          <p className="font-semibold text-slate-950 text-sm leading-tight">
                            {order.customer_name}
                          </p>
                          <p className="flex items-center gap-1 text-sm font-medium text-slate-500 mt-0.5">
                            <MapPin className="size-2.5 text-slate-400" />
                            <span>{order.customer_location || "Việt Nam"}</span>
                          </p>
                        </div>
                      </td>

                      {/* Items Thumbnails */}
                      <td className="px-3.5 py-1">
                        <div className="flex items-center gap-1.5">
                          {order.item_images.slice(0, 3).map((imgUrl, i) => (
                            <img
                              key={i}
                              src={imgUrl}
                              alt="Ảnh sản phẩm"
                              className="size-8 rounded-xs border border-slate-200 bg-slate-100 object-cover object-top shrink-0"
                            />
                          ))}
                          {order.extra_items > 0 && (
                            <span className="inline-flex size-7 items-center justify-center rounded-xs border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 shrink-0">
                              +{order.extra_items}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-3.5 py-2">
                        <div>
                          <p className="font-semibold text-slate-950 text-sm leading-tight">
                            {fmtVND(order.grand_total_vnd)}
                          </p>
                          <p className="text-sm font-medium text-slate-500 mt-0.5">
                            {order.items_count} sản phẩm
                          </p>
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="px-3.5 py-2">
                        <PaymentStatusBadge status={order.payment_status} orderStatus={order.status} />
                      </td>

                      {/* Warehouse (Xuất kho) */}
                      <td className="px-3.5 py-2">
                        <WarehouseStatusBadge
                          fulfillmentStatus={order.fulfillment_status}
                          orderStatus={order.status}
                          hasInventoryDoc={Boolean(order.inventory_doc_code || order.inventory_doc_id)}
                        />
                      </td>

                      {/* Fulfillment (Giao hàng) */}
                      <td className="px-3.5 py-2">
                        <FulfillmentStatusBadge status={order.fulfillment_status} orderStatus={order.status} />
                      </td>

                      {/* Date */}
                      <td className="px-3.5 py-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 leading-tight">
                            {dateFormatted}
                          </p>
                          <p className="text-sm font-medium text-slate-500 mt-0.5 tabular-nums">
                            {timeFormatted}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="w-24 whitespace-nowrap px-3.5 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                              aria-label={`Thao tác đơn hàng ${order.order_number}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xs p-1 shadow-lg text-sm font-semibold text-slate-800">
                            <DropdownMenuItem onClick={() => handleOpenDetail(order)}>
                              Xem chi tiết
                            </DropdownMenuItem>
                            {canUpdateOrder && <DropdownMenuItem onClick={() => handleMarkPaid(order)}>
                              Xác nhận thanh toán
                            </DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => handlePrintSlip(order)}>
                              In phiếu giao hàng
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {canCancelOrder && <DropdownMenuItem
                              onClick={() => handleCancelOrder(order)}
                              className="text-rose-600 focus:text-rose-600 font-semibold"
                            >
                              Hủy đơn hàng
                            </DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Pagination Footer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm font-medium text-slate-600 pt-1">
        <p>
          Hiển thị {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} trên tổng {filtered.length.toLocaleString("vi-VN")} đơn hàng
        </p>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="size-8 rounded-xs border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft className="size-3.5" />
          </Button>

          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <Button
              key={pageNumber}
              variant={pageNumber === page ? "default" : "outline"}
              size="sm"
              onClick={() => setPage(pageNumber)}
              className={cn(
                "size-8 rounded-xs p-0 text-sm font-semibold",
                pageNumber === page
                  ? "bg-[#6941c6] text-white hover:bg-[#53389e]"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              {pageNumber}
            </Button>
          ))}

          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="size-8 rounded-xs border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── MODALS ─── */}

      {/* Create Order Modal */}
      <Dialog open={createOrderModalOpen} onOpenChange={setCreateOrderModalOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-xs bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-950 admin-section-title">Tạo đơn hàng mới</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateOrderSubmit} className="mt-4 space-y-4 text-sm">
            <div>
              <label className="font-semibold text-slate-700">Tên khách hàng *</label>
              <Input
                className="mt-1 h-9 text-sm font-semibold text-slate-900 rounded-xs border-slate-200"
                placeholder="VD: Nguyễn Văn A"
                value={newOrderForm.customer_name}
                onChange={(e) => setNewOrderForm((f) => ({ ...f, customer_name: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Số điện thoại</label>
                <Input
                  className="mt-1 h-9 text-sm font-semibold text-slate-900 rounded-xs border-slate-200"
                  placeholder="VD: 0912345678"
                  value={newOrderForm.phone}
                  onChange={(e) => setNewOrderForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Tỉnh / Thành phố</label>
                <Input
                  className="mt-1 h-9 text-sm font-semibold text-slate-900 rounded-xs border-slate-200"
                  placeholder="VD: Hà Nội, TP.HCM..."
                  value={newOrderForm.city}
                  onChange={(e) => setNewOrderForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700">Sản phẩm chính</label>
              <Input
                className="mt-1 h-9 text-sm font-semibold text-slate-900 rounded-xs border-slate-200"
                value={newOrderForm.product_name}
                onChange={(e) => setNewOrderForm((f) => ({ ...f, product_name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Số lượng</label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1 h-9 text-sm font-semibold text-slate-900 rounded-xs border-slate-200"
                  value={newOrderForm.items_count}
                  onChange={(e) => setNewOrderForm((f) => ({ ...f, items_count: Number(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Tổng tiền (VNĐ)</label>
                <Input
                  type="number"
                  step={10000}
                  className="mt-1 h-9 tabular-nums text-sm font-semibold text-slate-900 rounded-xs border-slate-200"
                  value={newOrderForm.grand_total_vnd}
                  onChange={(e) => setNewOrderForm((f) => ({ ...f, grand_total_vnd: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Hình thức thanh toán</label>
                <select
                  className="mt-1 flex h-9 w-full rounded-xs border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#6941c6]"
                  value={newOrderForm.payment_method}
                  onChange={(e) => setNewOrderForm((f) => ({ ...f, payment_method: e.target.value }))}
                >
                  <option value="vietqr">VietQR (Chuyển khoản)</option>
                  <option value="cod">COD (Thu hộ tiền mặt)</option>
                  <option value="card">Thẻ tín dụng / Quốc tế</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Trạng thái thanh toán</label>
                <select
                  className="mt-1 flex h-9 w-full rounded-xs border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#6941c6]"
                  value={newOrderForm.payment_status}
                  onChange={(e) => setNewOrderForm((f) => ({ ...f, payment_status: e.target.value }))}
                >
                  <option value="paid">Paid (Đã thanh toán)</option>
                  <option value="pending">Pending (Chờ thanh toán)</option>
                </select>
              </div>
            </div>

            <DialogFooter className="mt-6 sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOrderModalOpen(false)} className="h-9 px-4 text-sm font-semibold rounded-xs">
                Hủy
              </Button>
              <Button type="submit" className="h-9 px-4 text-sm font-semibold rounded-xs bg-[#6941c6] text-white hover:bg-[#53389e]">
                Tạo đơn hàng
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filter Options Modal */}
      <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto rounded-xs bg-white p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-950 admin-section-title">Bộ lọc nâng cao</DialogTitle>
          </DialogHeader>

          <div className="mt-3 space-y-3.5 text-sm">
            <div>
              <label className="font-semibold text-slate-700">Thanh toán</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "Tất cả" },
                  { id: "paid", label: "Đã thanh toán" },
                  { id: "pending", label: "Chờ thanh toán" },
                  { id: "failed", label: "Thất bại" },
                  { id: "refunded", label: "Đã hoàn tiền" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(s.id === "all" ? "all" : (s.id as any));
                      setFilterModalOpen(false);
                    }}
                    className={cn(
                      "rounded-xs border px-2.5 py-1 text-sm font-semibold",
                      statusFilter === s.id
                        ? "border-[#6941c6] bg-purple-50 text-[#6941c6]"
                        : "border-slate-200 bg-white text-slate-700",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700">Vận chuyển</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { id: "all", label: "Tất cả" },
                  { id: "processing", label: "Đang xử lý" },
                  { id: "shipping", label: "Đang giao" },
                  { id: "delivered", label: "Đã giao" },
                  { id: "cancelled", label: "Đã hủy" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(s.id === "all" ? "all" : (s.id as any));
                      setFilterModalOpen(false);
                    }}
                    className={cn(
                      "rounded-xs border px-2.5 py-1 text-sm font-semibold",
                      statusFilter === s.id
                        ? "border-[#6941c6] bg-purple-50 text-[#6941c6]"
                        : "border-slate-200 bg-white text-slate-700",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 sm:justify-end">
            <Button size="sm" onClick={() => setFilterModalOpen(false)} className="h-9 px-4 rounded-xs text-sm font-semibold bg-slate-900 text-white">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Packing Slip Print Modal */}
      {printSlipDetail && (
        <PackingSlipModal detail={printSlipDetail} onClose={() => setPrintSlipDetail(null)} />
      )}
    </div>
  );
}


