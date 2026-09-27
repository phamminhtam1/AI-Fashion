import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Copy,
  CreditCard,
  Eye,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Package,
  Printer,
  RefreshCcw,
  Search,
  Share2,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InventorySeed } from "@/components/InventoryManager";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function resolveImageUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Constants ───────────────────────────────────────────────────────────────

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
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "Tiền mặt (COD)",
  bank: "Chuyển khoản VietQR",
};

export type OrderFilterTab = "all" | "ready_to_fulfill" | "fulfilled" | "pending" | "confirmed" | "cancelled";

const TAB_FILTERS: Array<{ label: string; key: OrderFilterTab }> = [
  { label: "Tất cả", key: "all" },
  { label: "Cần xuất kho", key: "ready_to_fulfill" },
  { label: "Đã xuất kho", key: "fulfilled" },
  { label: "Chờ xác nhận", key: "pending" },
  { label: "Đã duyệt", key: "confirmed" },
  { label: "Đã hủy", key: "cancelled" },
];

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

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`Đã copy ${label}`),
    () => toast.error("Không copy được"),
  );
}

// ─── Badges (Consistent with ÉLANE Atelier Style) ──────────────────────────────

function FulfillmentBadge({
  fulfillmentStatus,
  paymentMethod,
  paymentStatus,
  orderStatus,
  docCode,
}: {
  fulfillmentStatus?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  docCode?: string | null;
}) {
  const isFulfilled = fulfillmentStatus === "fulfilled";
  const isCancelled = orderStatus === "cancelled";
  const isPaidOrCod = paymentStatus === "paid" || paymentMethod === "cod";
  const isReadyToFulfill = !isFulfilled && !isCancelled && isPaidOrCod;

  if (isCancelled) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground/60" />
        Đã hủy đơn
      </span>
    );
  }

  if (isFulfilled) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
        <Check className="size-3 text-emerald-600" />
        <span className="font-semibold">Đã xuất kho</span>
        {docCode && <span className="font-mono text-[9px] opacity-75">#{docCode}</span>}
      </span>
    );
  }

  if (isReadyToFulfill) {
    return (
      <span
        title="Đơn đã thanh toán / COD sẵn sàng xuất kho"
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-600/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200"
      >
        <Boxes className="size-3 text-amber-700 animate-pulse" />
        <span>Chờ xuất kho</span>
      </span>
    );
  }

  return (
    <span
      title="Đơn hàng chờ thanh toán trước khi xuất kho"
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground"
    >
      <Clock className="size-3 text-muted-foreground" />
      <span>Chờ thanh toán</span>
    </span>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const isPending = status === "pending";
  const isCancelled = status === "cancelled";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-wide",
        isPending
          ? "border-primary/40 bg-primary/10 text-primary"
          : isCancelled
            ? "border-border bg-secondary/50 text-muted-foreground"
            : "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isPending ? "bg-primary" : isCancelled ? "bg-muted-foreground" : "bg-emerald-600",
        )}
      />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function PaymentBadge({ method, status }: { method: string; status: string }) {
  const isPaid = status === "paid";
  const isAwaiting = status === "awaiting";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-wide",
        isPaid
          ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          : isAwaiting
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-secondary text-muted-foreground",
      )}
    >
      {isPaid ? (
        <Check className="size-3 text-emerald-600" />
      ) : method === "bank" ? (
        <CreditCard className="size-3" />
      ) : (
        <CircleDollarSign className="size-3" />
      )}
      {method === "cod"
        ? "COD"
        : method === "bank" && isPaid
          ? "CK · Đã TT"
          : method === "bank" && isAwaiting
            ? "CK · Chờ TT"
            : (PAYMENT_STATUS_LABEL[status] ?? status)}
    </span>
  );
}

// ─── Modal In Phiếu Xuất Kho / Giao Hàng ──────────────────────────────────────

function PrintPackingSlipModal({
  detail,
  open,
  onClose,
}: {
  detail: OrderDetail;
  open: boolean;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const recipientName =
    detail.recipient?.full_name || detail.customer?.full_name || "Khách mua hàng";
  const recipientPhone = detail.recipient?.phone || detail.customer?.phone || "—";
  const fullAddress = [
    detail.shipping_address?.address_line,
    detail.shipping_address?.ward,
    detail.shipping_address?.district,
    detail.shipping_address?.city,
  ]
    .filter(Boolean)
    .join(", ");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:static print:bg-white print:p-0">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-md border border-border bg-card shadow-2xl print:max-h-none print:w-full print:border-none print:shadow-none">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="size-4 text-primary" />
            <h3 className="font-serif text-base font-medium">Phiếu xuất kho kiêm giao hàng</h3>
            <span className="font-mono text-xs text-muted-foreground">#{detail.order_number}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 h-8 text-xs"
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
              <p className="font-serif text-2xl font-bold tracking-wider text-primary">ÉLANE</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Haute Couture & Atelier
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Hotline CSKH: <span className="font-medium text-foreground">1900 8888</span>
              </p>
              <p className="text-xs text-muted-foreground">Website: elane.vn</p>
            </div>
            <div className="text-right">
              <h2 className="font-serif text-xl font-bold uppercase tracking-tight text-foreground">
                Phiếu xuất kho & Giao hàng
              </h2>
              <p className="mt-1 font-mono text-base font-semibold text-primary">
                #{detail.order_number}
              </p>
              <p className="text-xs text-muted-foreground">Ngày đặt: {fmtDate(detail.placed_at)}</p>
              <p className="text-xs text-muted-foreground">
                Ngày in: {new Date().toLocaleDateString("vi-VN")}
              </p>
              {/* Simulated barcode */}
              <div className="mt-2 inline-flex flex-col items-center">
                <div className="flex h-7 items-stretch gap-[2px]">
                  {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3].map((w, idx) => (
                    <div
                      key={idx}
                      className={cn("bg-foreground", idx % 2 === 0 ? "opacity-100" : "opacity-0")}
                      style={{ width: `${w}px` }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[9px] tracking-widest text-muted-foreground">
                  *{detail.order_number}*
                </span>
              </div>
            </div>
          </div>

          {/* Sender & Receiver Info */}
          <div className="mt-6 grid grid-cols-2 gap-6 rounded-md border border-border p-4 text-xs">
            <div>
              <p className="section-label">Đơn vị gửi hàng</p>
              <p className="mt-1 text-sm font-semibold">Kho Tổng ÉLANE Atelier</p>
              <p className="text-muted-foreground">Kho Vận Hà Nội / Đà Nẵng / TP.HCM</p>
              <p className="text-muted-foreground">Hotline: 0988 888 888</p>
            </div>
            <div>
              <p className="section-label">Người nhận hàng</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{recipientName}</p>
              <p className="font-medium text-foreground">SĐT: {recipientPhone}</p>
              <p className="mt-0.5 text-muted-foreground">
                Địa chỉ: {fullAddress || "Nhận tại showroom"}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="mt-6 overflow-hidden rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/55">
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="py-2.5 pl-3 font-medium">STT</th>
                  <th className="py-2.5 font-medium">Sản phẩm</th>
                  <th className="py-2.5 font-medium">Mã SKU</th>
                  <th className="py-2.5 text-center font-medium">Phân loại</th>
                  <th className="py-2.5 text-center font-medium">SL</th>
                  <th className="py-2.5 text-right font-medium">Đơn giá</th>
                  <th className="py-2.5 pr-3 text-right font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 pl-3 font-mono text-muted-foreground">{idx + 1}</td>
                    <td className="py-2.5 font-medium text-foreground">
                      <p className="line-clamp-2">{it.product_name}</p>
                    </td>
                    <td className="py-2.5 font-mono text-xs text-foreground">{it.sku}</td>
                    <td className="py-2.5 text-center">
                      <span className="inline-block rounded bg-secondary px-2 py-0.5 text-[11px]">
                        {it.size_label ? `Size ${it.size_label}` : "Freesize"}
                        {it.color_label ? ` · ${it.color_label}` : ""}
                      </span>
                    </td>
                    <td className="py-2.5 text-center font-bold text-foreground">{it.qty}</td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      {fmtVND(it.unit_price_vnd)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-medium text-foreground">
                      {fmtVND(it.line_total_vnd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pricing calculation */}
          <div className="mt-6 flex justify-end border-t pt-4 text-xs">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Tạm tính:</span>
                <span>{fmtVND(detail.subtotal_vnd)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Phí giao hàng:</span>
                <span>{fmtVND(detail.shipping_vnd)}</span>
              </div>
              {detail.discount_vnd > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Giảm giá ({detail.discount_code || "Voucher"}):</span>
                  <span>-{fmtVND(detail.discount_vnd)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-foreground">
                <span>Tổng cộng:</span>
                <span className="font-serif text-base font-bold">{fmtVND(detail.grand_total_vnd)}</span>
              </div>
              <div className="mt-3 rounded-md bg-secondary/70 p-2.5 text-center">
                <span className="section-label">Thu tiền khi giao hàng (COD):</span>
                <p className="mt-0.5 font-serif text-base font-bold text-foreground">
                  {detail.payment_method === "cod" ? fmtVND(detail.grand_total_vnd) : "0₫ (ĐÃ THANH TOÁN)"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {detail.payment_method === "cod"
                    ? "Shipper vui lòng thu đúng số tiền trên"
                    : `Đã thanh toán qua ${PAYMENT_METHOD_LABEL[detail.payment_method] || "chuyển khoản"}`}
                </p>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-10 grid grid-cols-4 gap-4 text-center text-xs">
            <div>
              <p className="font-medium text-muted-foreground">Người lập phiếu</p>
              <p className="mt-12 text-[10px] text-muted-foreground">(Ký & họ tên)</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Thủ kho xuất hàng</p>
              <p className="mt-12 text-[10px] text-muted-foreground">(Ký & họ tên)</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Nhân viên giao hàng</p>
              <p className="mt-12 text-[10px] text-muted-foreground">(Ký & họ tên)</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Người nhận hàng</p>
              <p className="mt-12 text-[10px] text-muted-foreground">(Ký & họ tên)</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 print:hidden">
          <p className="text-xs text-muted-foreground">Khổ in A4 / A5 tiêu chuẩn ÉLANE.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Đóng
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 h-8 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium"
            >
              <Printer className="size-3.5" />
              In phiếu ngay
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB CHI TIẾT ĐƠN HÀNG (Dedicated Full-Screen Tab View) ───────────────────

function OrderDetailTabView({
  orderId,
  onBack,
  onUpdated,
  onNavigateToInventory,
}: {
  orderId: string | null;
  onBack: () => void;
  onUpdated: () => void;
  onNavigateToInventory?: (seed: InventorySeed) => void;
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lỗi tải chi tiết đơn hàng");
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast.error(e instanceof Error ? e.message : "Không thực hiện được");
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
      toast.error(e instanceof Error ? e.message : "Cập nhật trạng thái thất bại");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Copy full fulfillment string for GHTK / GHN / Viettel Post
  const handleCopyFulfillment = () => {
    if (!detail) return;
    const recipientName =
      detail.recipient?.full_name || detail.customer?.full_name || "Khách hàng";
    const recipientPhone = detail.recipient?.phone || detail.customer?.phone || "";
    const fullAddress = [
      detail.shipping_address?.address_line,
      detail.shipping_address?.ward,
      detail.shipping_address?.district,
      detail.shipping_address?.city,
    ]
      .filter(Boolean)
      .join(", ");

    const itemsSummary = detail.items
      .map(
        (it) =>
          `${it.qty}x ${it.product_name} (${it.sku}${it.size_label ? ` - Size ${it.size_label}` : ""})`,
      )
      .join("; ");

    const codAmount = detail.payment_method === "cod" ? fmtVND(detail.grand_total_vnd) : "0₫ (Đã thanh toán)";

    const text = `ĐƠN HÀNG: #${detail.order_number}
NGƯỜI NHẬN: ${recipientName}
SĐT: ${recipientPhone}
ĐỊA CHỈ: ${fullAddress}
SẢN PHẨM: ${itemsSummary}
TIỀN THU COD: ${codAmount}
GHI CHÚ: ${detail.shipping_address?.note || "Cho khách xem hàng trước khi nhận"}`;

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
      detail.recipient?.full_name || detail.customer?.full_name || "Khách hàng";

    const lines = detail.items.map((it) => ({
      product_id: it.product_id || "",
      variant_id: it.variant_id || "",
      qty: it.qty,
      direction: "out" as const,
      sku: it.sku,
      product_name: it.product_name,
      color_label: it.color_label,
      size_label: it.size_label,
      image_url: it.image_url,
      unit_cost_vnd: it.unit_price_vnd, // Giá hóa đơn người dùng đã thanh toán
    }));

    if (onNavigateToInventory) {
      onNavigateToInventory({
        docType: "issue",
        orderId: detail.id,
        orderNumber: detail.order_number,
        reason: `Xuất kho đơn hàng #${detail.order_number} (${recipientName})`,
        productId: lines[0]?.product_id,
        productName: lines[0]?.product_name,
        lines,
      });
    } else {
      toast.error("Không tìm thấy liên kết module Kho hàng");
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
      toast.error(e instanceof Error ? e.message : "Cập nhật trạng thái xuất kho thất bại");
    } finally {
      setUpdatingFulfill(false);
    }
  };

  if (!orderId) {
    return (
      <div className="mt-8 flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed border-border p-12 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
          <ShoppingBag className="size-5" />
        </div>
        <h3 className="mt-4 font-serif text-lg">Chưa chọn đơn hàng nào</h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Vui lòng chọn một đơn hàng từ danh sách để xem chi tiết thông tin sản phẩm và xuất kho.
        </p>
        <Button variant="outline" onClick={onBack} className="mt-5 h-8 text-xs gap-2">
          <ArrowLeft className="size-3.5" />
          Xem danh sách đơn hàng
        </Button>
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="mt-8 flex min-h-[380px] items-center justify-center rounded-md border border-border bg-card p-12">
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p>Đang tải thông tin chi tiết đơn hàng #{orderId}…</p>
        </div>
      </div>
    );
  }

  const recipientName =
    detail.recipient?.full_name || detail.customer?.full_name || "Khách mua hàng";
  const recipientPhone = detail.recipient?.phone || detail.customer?.phone || "";
  const recipientEmail = detail.recipient?.email || detail.customer?.email || "";
  const fullAddress = [
    detail.shipping_address?.address_line,
    detail.shipping_address?.ward,
    detail.shipping_address?.district,
    detail.shipping_address?.city,
  ]
    .filter(Boolean)
    .join(", ");

  const isPaid = detail.payment_status === "paid";
  const isCod = detail.payment_method === "cod";
  const isCancelled = detail.status === "cancelled";
  const isFulfilled = detail.fulfillment_status === "fulfilled";
  const canFulfill = !isCancelled && (isPaid || isCod);
  const canMarkPaid = detail.payment_method === "bank" && detail.payment_status === "awaiting" && !isCancelled;

  return (
    <div className="mt-6 space-y-6">
      {/* Print Slip Modal */}
      <PrintPackingSlipModal
        detail={detail}
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
      />

      {/* Top Action Bar (Matching ÉLANE Style) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-8 gap-1.5 text-xs"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Quay lại danh sách</span>
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="section-label">Đơn hàng</span>
            <span className="font-mono text-base font-bold text-foreground">
              #{detail.order_number}
            </span>
            <OrderStatusBadge status={detail.status} />
            <PaymentBadge method={detail.payment_method} status={detail.payment_status} />
            <FulfillmentBadge
              fulfillmentStatus={detail.fulfillment_status}
              paymentMethod={detail.payment_method}
              paymentStatus={detail.payment_status}
              orderStatus={detail.status}
              docCode={detail.inventory_doc_code}
            />
            <span className="hidden sm:inline text-xs text-muted-foreground">
              · {fmtDate(detail.placed_at)}
            </span>
          </div>
        </div>

        {/* Action Buttons (Clean & concise: Print packing slip, Courier export, Status) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Slip Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrintModalOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Printer className="size-3.5 text-muted-foreground" />
            <span>In phiếu giao hàng</span>
          </Button>

          {/* Copy for Courier Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyFulfillment}
            className="h-8 gap-1.5 text-xs"
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
              className="h-8 gap-1.5 text-xs border-emerald-600/40 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300"
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
              className="h-8 gap-1.5 text-xs"
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
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[190px] rounded-md border border-border bg-card p-1 shadow-lg">
                {(["pending", "confirmed", "cancelled"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => void handleStatusChange(s)}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs transition-colors hover:bg-secondary",
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
          <div className="rounded-md border border-border bg-card p-5">
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
                    "flex items-center gap-3 rounded-md border p-3 text-xs transition-colors",
                    step.active
                      ? "border-foreground bg-secondary/50 font-medium text-foreground"
                      : step.done
                        ? "border-border bg-card text-foreground"
                        : "border-border/50 bg-secondary/20 text-muted-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-mono",
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
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3.5">
              <div>
                <p className="section-label">Danh sách sản phẩm ({detail.items.length})</p>
                <h3 className="mt-0.5 font-serif text-base">Sản phẩm xuất kho</h3>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
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
                      <div className="relative size-16 shrink-0 overflow-hidden rounded border border-border bg-[#f7f4ef]">
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
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-foreground/80 px-1 font-mono text-[9px] font-semibold text-background">
                          x{item.qty}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="font-serif text-sm font-medium leading-snug text-foreground">
                          {item.product_name}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 font-mono text-xs text-foreground">
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
                            <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                              Size {item.size_label}
                            </span>
                          )}

                          {item.color_label && (
                            <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                              {item.color_label}
                            </span>
                          )}
                        </div>

                        {item.barcode && (
                          <p className="font-mono text-[11px] text-muted-foreground">
                            Mã vạch: {item.barcode}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price and Total */}
                    <div className="flex items-center justify-between border-t border-border/50 pt-2 sm:border-0 sm:pt-0 sm:text-right">
                      <span className="text-xs text-muted-foreground sm:hidden">Thành tiền:</span>
                      <div>
                        <p className="font-serif text-sm font-medium text-foreground">
                          {fmtVND(item.line_total_vnd)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
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
              <div className="ml-auto max-w-xs space-y-1.5 text-xs">
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
                        <span className="rounded bg-primary/10 px-1 font-mono text-[10px] font-semibold text-primary">
                          {detail.discount_code}
                        </span>
                      )}
                    </span>
                    <span>-{fmtVND(detail.discount_vnd)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-bold text-foreground">
                  <span>Tổng thanh toán:</span>
                  <span className="font-serif text-lg font-bold text-primary">
                    {fmtVND(detail.grand_total_vnd)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fulfillment Instructions Box */}
          <div className="rounded-md border border-border bg-card p-5">
            <p className="section-label">Ghi chú đóng gói & xuất đơn</p>
            <div className="mt-2 rounded border border-border/70 bg-[#f7f4ef] p-3 text-xs text-foreground">
              <p className="font-medium">
                {detail.shipping_address?.note || "Không có ghi chú thêm từ khách hàng."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span>• Kiểm tra đúng size và màu trước khi niêm phong hộp ÉLANE.</span>
                <span>• Kèm theo thẻ cảm ơn và phiếu bảo hành tiêu chuẩn.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Warehouse & Fulfillment Card */}
          <div className="rounded-md border border-border bg-card p-5 space-y-4">
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

            <div className="space-y-3 text-xs">
              {isCancelled ? (
                <div className="rounded border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold flex items-center gap-1.5 text-foreground">
                    <span className="size-2 rounded-full bg-muted-foreground" />
                    Đơn hàng đã bị hủy
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed">
                    Đơn hàng này đã bị hủy bỏ. Không thể tạo phiếu xuất kho hay xuất hàng.
                  </p>
                </div>
              ) : isFulfilled ? (
                <>
                  <div className="rounded border border-emerald-600/30 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-200">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Check className="size-3.5 text-emerald-600" />
                      Đơn hàng đã được xuất kho
                    </p>
                    {detail.fulfilled_at && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Thời gian xuất: {fmtDate(detail.fulfilled_at)}
                      </p>
                    )}
                    {detail.inventory_doc_code && (
                      <p className="mt-0.5 font-mono text-[11px] text-primary font-medium">
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
                      className="w-full text-xs text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                      {updatingFulfill && <Loader2 className="size-3.5 animate-spin mr-1" />}
                      Đổi sang: Chưa xuất kho
                    </Button>
                  </div>
                </>
              ) : canFulfill ? (
                <>
                  <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-200">
                    <p className="font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                      <Boxes className="size-3.5 text-amber-700" />
                      Đã sẵn sàng xuất kho
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                      Đơn hàng đã {isPaid ? "thanh toán thành công qua chuyển khoản" : "chọn hình thức COD"}. Đủ điều kiện xuất hàng bàn giao cho đơn vị vận chuyển.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    {/* Nơi duy nhất tạo phiếu xuất kho */}
                    <Button
                      size="sm"
                      onClick={handleCreateStockIssue}
                      className="w-full gap-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium h-9"
                      title="Chuyển sang module Kho hàng và tự động nhập các mặt hàng (màu, size, SL) vào phiếu xuất kho"
                    >
                      <Boxes className="size-3.5" />
                      <span>Tạo phiếu xuất kho</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updatingFulfill}
                      onClick={() => void handleToggleFulfill("fulfilled")}
                      className="w-full gap-1.5 text-xs border-emerald-600/40 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 h-8"
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
                <div className="rounded border border-amber-600/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Clock className="size-3.5 text-amber-700" />
                    Chưa đủ điều kiện xuất kho
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Chỉ những đơn hàng đã thanh toán thành công (VietQR) hoặc COD mới được xuất kho. Đơn này đang chờ thanh toán hoặc chưa thanh toán.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Shipping & Recipient Card */}
          <div className="rounded-md border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                <p className="section-label text-foreground">Địa chỉ giao nhận</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyText("địa chỉ giao hàng", fullAddress)}
                className="h-6 px-2 text-[11px]"
              >
                <Copy className="size-3 mr-1" />
                Copy
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="section-label">Người nhận hàng</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{recipientName}</p>
              </div>

              <div>
                <p className="section-label">Số điện thoại</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="font-mono text-xs font-semibold text-foreground">
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
          <div className="rounded-md border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <p className="section-label text-foreground">Thanh toán</p>
              </div>
              <PaymentBadge method={detail.payment_method} status={detail.payment_status} />
            </div>

            <div className="space-y-3 text-xs">
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
                    <p className="font-mono text-xs font-semibold text-primary">
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
          <div className="rounded-md border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-border/70 pb-3">
              <User className="size-4 text-primary" />
              <p className="section-label text-foreground">Tài khoản khách hàng</p>
            </div>

            <div className="space-y-3 text-xs">
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
                  <p className="font-mono font-bold text-foreground">#{detail.order_number}</p>
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

export function OrdersManager({
  onNavigateToInventory,
}: {
  onNavigateToInventory?: (seed: InventorySeed) => void;
} = {}) {
  const [activeMainTab, setActiveMainTab] = useState<"list" | "detail">("list");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderFilterTab>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "total">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.orders();
      setOrders(res.items);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lỗi tải danh sách đơn hàng");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // Open detail tab for an order
  const handleOpenDetail = (order: OrderSummary) => {
    setSelectedOrderId(order.id);
    setSelectedOrderNumber(order.order_number);
    setActiveMainTab("detail");
  };

  // Close detail and go back to list
  const handleBackToList = () => {
    setActiveMainTab("list");
  };

  // Filtered and sorted orders for Tab List
  const filtered = useMemo(() => {
    return orders
      .filter((o) => {
        if (statusFilter === "ready_to_fulfill") {
          const isPaidOrCod = o.payment_status === "paid" || o.payment_method === "cod";
          if (!isPaidOrCod || o.fulfillment_status === "fulfilled" || o.status === "cancelled") {
            return false;
          }
        } else if (statusFilter === "fulfilled") {
          if (o.fulfillment_status !== "fulfilled") return false;
        } else if (statusFilter === "pending") {
          if (o.status !== "pending") return false;
        } else if (statusFilter === "confirmed") {
          if (o.status !== "confirmed") return false;
        } else if (statusFilter === "cancelled") {
          if (o.status !== "cancelled") return false;
        }

        if (search.trim()) {
          const q = search.toLowerCase();
          const matchNum = o.order_number.toLowerCase().includes(q);
          const matchCust = o.customer_name?.toLowerCase().includes(q);
          const matchRef = o.payment_ref?.toLowerCase().includes(q);
          const matchDoc = o.inventory_doc_code?.toLowerCase().includes(q);
          if (!matchNum && !matchCust && !matchRef && !matchDoc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "date") {
          const tA = new Date(a.placed_at).getTime();
          const tB = new Date(b.placed_at).getTime();
          return sortDir === "desc" ? tB - tA : tA - tB;
        } else {
          return sortDir === "desc"
            ? b.grand_total_vnd - a.grand_total_vnd
            : a.grand_total_vnd - b.grand_total_vnd;
        }
      });
  }, [orders, statusFilter, search, sortBy, sortDir]);

  // Metrics
  const metrics = useMemo(() => {
    const total = orders.length;
    const readyToFulfill = orders.filter(
      (o) =>
        (o.payment_status === "paid" || o.payment_method === "cod") &&
        o.fulfillment_status !== "fulfilled" &&
        o.status !== "cancelled",
    ).length;
    const fulfilled = orders.filter((o) => o.fulfillment_status === "fulfilled").length;
    const pending = orders.filter((o) => o.status === "pending").length;
    const awaitingBank = orders.filter(
      (o) => o.payment_method === "bank" && o.payment_status === "awaiting",
    ).length;
    const totalPaid = orders
      .filter((o) => o.payment_status === "paid")
      .reduce((sum, o) => sum + Number(o.grand_total_vnd), 0);
    return { total, readyToFulfill, fulfilled, pending, awaitingBank, totalPaid };
  }, [orders]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar (No duplicate heading - integrated with index.tsx title) */}
      <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label text-primary">Vận hành bán hàng</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi thanh toán, đóng gói, xuất kho và xử lý đơn hàng ÉLANE.
          </p>
        </div>

        {/* View Switcher Tabs (Consistent border-b tab strip) */}
        <div className="flex items-center gap-1 border-b border-border pb-px">
          <button
            type="button"
            onClick={() => setActiveMainTab("list")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px",
              activeMainTab === "list"
                ? "border-foreground text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <ShoppingBag className="size-3.5" />
            <span>Danh sách đơn hàng</span>
            <span className="rounded-full bg-secondary px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
              {orders.length}
            </span>
          </button>

          {selectedOrderNumber && (
            <button
              type="button"
              onClick={() => setActiveMainTab("detail")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px",
                activeMainTab === "detail"
                  ? "border-foreground text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Đơn #{selectedOrderNumber}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedOrderId(null);
                  setSelectedOrderNumber(null);
                  setActiveMainTab("list");
                }}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
                title="Đóng chi tiết"
              >
                <X className="size-3" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Render Active View */}
      {activeMainTab === "detail" ? (
        <OrderDetailTabView
          orderId={selectedOrderId}
          onBack={handleBackToList}
          onUpdated={fetchOrders}
          onNavigateToInventory={onNavigateToInventory}
        />
      ) : (
        /* TAB 1: Danh sách đơn hàng */
        <div className="space-y-6">
          {/* Metrics bar (Matching standard Atelier module format) */}
          <section className="mt-6 grid gap-4 sm:grid-cols-4">
            <div
              onClick={() => setStatusFilter("all")}
              className={cn(
                "rounded-md border p-5 bg-card cursor-pointer transition-colors",
                statusFilter === "all" ? "border-foreground/60 shadow-sm" : "border-border hover:border-border/80",
              )}
            >
              <p className="section-label">Tổng đơn hàng</p>
              <p className="mt-3 font-serif text-3xl font-normal">{metrics.total}</p>
              <p className="mt-1 text-xs text-muted-foreground">Trong hệ thống</p>
            </div>

            {/* CẦN XUẤT KHO: Đã thanh toán hoặc COD đang chờ xuất kho */}
            <div
              onClick={() => setStatusFilter("ready_to_fulfill")}
              className={cn(
                "rounded-md border p-5 bg-card cursor-pointer transition-colors",
                metrics.readyToFulfill > 0
                  ? "border-amber-600/50 bg-amber-500/10 shadow-sm"
                  : "border-border hover:border-border/80",
                statusFilter === "ready_to_fulfill" && "ring-1 ring-amber-600",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="section-label text-amber-900 dark:text-amber-200">Cần xuất kho</p>
                <Boxes className={cn("size-4 text-amber-700", metrics.readyToFulfill > 0 && "animate-pulse")} />
              </div>
              <p
                className={cn(
                  "mt-3 font-serif text-3xl font-normal",
                  metrics.readyToFulfill > 0 ? "text-amber-900 dark:text-amber-200 font-medium" : "text-foreground",
                )}
              >
                {metrics.readyToFulfill}
              </p>
              <p className={cn("mt-1 text-xs", metrics.readyToFulfill > 0 ? "text-amber-800 dark:text-amber-300 font-medium" : "text-muted-foreground")}>
                Đã TT / COD · Sẵn sàng xuất
              </p>
            </div>

            <div
              onClick={() => setStatusFilter("pending")}
              className={cn(
                "rounded-md border p-5 bg-card cursor-pointer transition-colors",
                metrics.awaitingBank > 0 ? "border-primary/40 bg-primary/5" : "border-border hover:border-border/80",
                statusFilter === "pending" && "ring-1 ring-primary",
              )}
            >
              <p className="section-label">Chờ chuyển khoản</p>
              <p
                className={cn(
                  "mt-3 font-serif text-3xl font-normal",
                  metrics.awaitingBank > 0 && "text-primary",
                )}
              >
                {metrics.awaitingBank}
              </p>
              <p className={cn("mt-1 text-xs", metrics.awaitingBank > 0 ? "text-primary" : "text-muted-foreground")}>
                Chờ tiền về SePay
              </p>
            </div>

            <div className="rounded-md border border-border bg-card p-5">
              <p className="section-label">Đã thanh toán</p>
              <p className="mt-3 font-serif text-3xl font-normal">{fmtVND(metrics.totalPaid)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Doanh thu thực thu</p>
            </div>
          </section>

          {/* Table Container (Matching ModulePage in index.tsx) */}
          <section className="mt-6 overflow-hidden rounded-md border border-border bg-card">
            {/* Filter and Search Bar */}
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between bg-card/40">
              {/* Status Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
                {TAB_FILTERS.map((f) => (
                  <Button
                    key={f.key}
                    variant={statusFilter === f.key ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStatusFilter(f.key)}
                    className={cn(
                      "h-8 text-xs font-medium shrink-0",
                      statusFilter === f.key && "bg-foreground text-background hover:bg-foreground/90",
                    )}
                  >
                    {f.label}
                    {f.key === "ready_to_fulfill" && metrics.readyToFulfill > 0 && (
                      <span className="ml-1.5 rounded-full bg-amber-500/25 text-amber-900 dark:text-amber-200 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                        {metrics.readyToFulfill}
                      </span>
                    )}
                    {f.key === "pending" && metrics.pending > 0 && (
                      <span className="ml-1.5 rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-mono">
                        {metrics.pending}
                      </span>
                    )}
                    {f.key === "fulfilled" && metrics.fulfilled > 0 && (
                      <span className="ml-1.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 text-[10px] font-mono">
                        {metrics.fulfilled}
                      </span>
                    )}
                  </Button>
                ))}
              </div>

              {/* Search & Actions */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 lg:w-64">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm mã đơn, tên khách, mã kho…"
                    className="h-8 pl-8 text-xs bg-[#f7f4ef]"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortBy(sortBy === "date" ? "total" : "date")}
                  className="h-8 gap-1 text-xs"
                >
                  <ArrowDownUp className="size-3 text-muted-foreground" />
                  {sortBy === "date" ? "Ngày" : "Tiền"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
                  className="h-8 px-2.5 text-xs"
                  title={sortDir === "desc" ? "Giảm dần" : "Tăng dần"}
                >
                  {sortDir === "desc" ? "↓" : "↑"}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void fetchOrders()}
                  className="size-8"
                  title="Làm mới"
                >
                  <RefreshCcw className={cn("size-3.5", loading && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="bg-secondary/55">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Mã đơn
                    </th>
                    <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Khách hàng
                    </th>
                    <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Thời gian
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Tổng tiền
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Thanh toán
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Kho vận
                    </th>
                    <th className="w-32 px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="size-5 animate-spin text-primary" />
                          <span>Đang tải danh sách đơn hàng…</span>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                        Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => handleOpenDetail(order)}
                        className="border-t border-border transition-colors hover:bg-secondary/35 cursor-pointer"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                          #{order.order_number}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-foreground">
                          {order.customer_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {fmtDate(order.placed_at)}
                        </td>
                        <td className="px-4 py-3 text-right font-serif text-sm font-medium text-foreground">
                          {fmtVND(order.grand_total_vnd)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <PaymentBadge
                            method={order.payment_method}
                            status={order.payment_status}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <FulfillmentBadge
                            fulfillmentStatus={order.fulfillment_status}
                            paymentMethod={order.payment_method}
                            paymentStatus={order.payment_status}
                            orderStatus={order.status}
                            docCode={order.inventory_doc_code}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {order.fulfillment_status !== "fulfilled" &&
                              order.status !== "cancelled" &&
                              (order.payment_status === "paid" || order.payment_method === "cod") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDetail(order);
                                  }}
                                  className="h-7 px-2 text-[11px] font-medium border-amber-600/40 text-amber-900 bg-amber-500/10 hover:bg-amber-500/25 dark:text-amber-200"
                                  title="Xem chi tiết và xuất kho đơn hàng"
                                >
                                  <Boxes className="size-3 mr-1" />
                                  <span>Xuất kho</span>
                                </Button>
                              )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDetail(order);
                              }}
                              className="h-7 px-2.5 text-xs font-medium gap-1"
                            >
                              <Eye className="size-3.5" />
                              <span>Xem</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>Hiển thị {filtered.length} / {orders.length} đơn hàng</span>
              <span>ÉLANE Atelier Console</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
