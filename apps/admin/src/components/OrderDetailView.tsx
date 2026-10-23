import { adminErrorMessage } from "@/lib/admin-language";
import { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  Printer,
  RefreshCcw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { InventorySeed } from "./InventoryManager";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrderItemDetail = {
  id?: string | undefined;
  product_id?: string | undefined;
  variant_id?: string | undefined;
  sku: string;
  product_name: string;
  category?: string | undefined;
  variant?: string | undefined;
  size_label?: string | null | undefined;
  color_label?: string | null | undefined;
  color_hex?: string | null | undefined;
  image_url?: string | null | undefined;
  qty: number;
  unit_price: number; // in VND
  unit_price_vnd?: number | undefined;
  line_total: number; // in VND
};

export type OrderTimelineEvent = {
  id: string;
  type: "placed" | "payment" | "picking" | "packed" | "shipped" | "cancelled" | "refunded" | "custom";
  title: string;
  description: string;
  time: string;
  completed: boolean;
  isCurrent?: boolean;
  actor?: string;
  statusBadge?: { label: string; className: string };
};

export type OrderNote = {
  id: string;
  author: string;
  authorInitials: string;
  content: string;
  createdAt: string;
};

export type FullOrderDetail = {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: "confirmed" | "pending" | "cancelled" | string;
  paymentStatus: "paid" | "pending" | "failed" | "refunded";
  paymentMethod: string;
  paymentCardLast4?: string | undefined;
  paymentCardBrand?: string | undefined;
  paymentExpiry?: string | undefined;
  paidAt?: string | null | undefined;
  fulfillmentStatus: "processing" | "shipping" | "delivered" | "unfulfilled" | "cancelled" | string;
  fulfillmentLocation: string;
  shippingMethod: string;
  shippingEstimate: string;
  packedCount: number;
  inventoryDocId?: string | null | undefined;
  inventoryDocCode?: string | null | undefined;
  items: OrderItemDetail[];
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    ordersCount: number;
    joinedDate: string;
    avatarInitials: string;
  };
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string | undefined;
  };
  billingAddress: {
    fullName: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  discountCode?: string | undefined;
  discountAmount: number; // VND
  shippingCost: number; // VND
  taxRate: number; // 0.08 = 8%
  taxAmountOverride?: number | undefined;
  notes: OrderNote[];
  timeline: OrderTimelineEvent[];
};

// ─── Design tokens ───────────────────────────────────────────────────────────

const CARD =
  "rounded-xs border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const BRAND_LINK = "text-[#6d3df0] hover:underline cursor-pointer";
const BRAND_BTN = "bg-[#6d3df0] hover:bg-[#5a2fd6] text-white";

const TIMELINE_ICON = {
  placed: { Icon: ShoppingCart, color: "text-violet-600", bg: "bg-violet-100" },
  payment: { Icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-100" },
  picking: { Icon: Package, color: "text-violet-600", bg: "bg-violet-100" },
  packed: { Icon: Package, color: "text-violet-600", bg: "bg-violet-100" },
  shipped: { Icon: Truck, color: "text-blue-600", bg: "bg-blue-100" },
  cancelled: { Icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-100" },
  refunded: { Icon: RefreshCcw, color: "text-purple-600", bg: "bg-purple-100" },
  custom: { Icon: Check, color: "text-slate-600", bg: "bg-slate-100" },
} as const;

export function buildOrderTimeline(params: {
  orderNumber: string;
  custName: string;
  placedAt: string | null | undefined;
  paidAt?: string | null | undefined;
  paymentMethod?: string | null | undefined;
  paymentStatus?: string | null | undefined;
  paymentRef?: string | null | undefined;
  fulfillmentStatus?: string | null | undefined;
  fulfilledAt?: string | null | undefined;
  status?: string | null | undefined;
  inventoryDocCode?: string | null | undefined;
  sepayTransaction?: { id?: string | number | undefined } | null | undefined;
  grandTotalVnd?: number | undefined;
  subtotalVnd?: number | undefined;
  itemCount: number;
  totalQty: number;
  updatedAt?: string | null | undefined;
}): OrderTimelineEvent[] {
  const {
    orderNumber,
    custName,
    placedAt,
    paidAt,
    paymentMethod,
    paymentStatus,
    paymentRef,
    fulfillmentStatus,
    fulfilledAt,
    status,
    inventoryDocCode,
    sepayTransaction,
    grandTotalVnd = 0,
    subtotalVnd = 0,
    itemCount,
    totalQty,
    updatedAt,
  } = params;

  const totalAmountStr = fmtMoney(grandTotalVnd || subtotalVnd);
  const methodDisplay = formatPaymentMethod(paymentMethod);
  const isPaid = (paymentStatus || "").toLowerCase() === "paid";
  const isRefunded = (paymentStatus || "").toLowerCase() === "refunded";
  const isDelivered = (fulfillmentStatus || "").toLowerCase() === "delivered";
  const isShipping =
    (fulfillmentStatus || "").toLowerCase() === "shipping" ||
    (fulfillmentStatus || "").toLowerCase() === "fulfilled" ||
    (fulfillmentStatus || "").toLowerCase() === "partial";
  const isCancelled = status === "cancelled";
  const isCod = (paymentMethod || "").toLowerCase().includes("cod");

  const events: OrderTimelineEvent[] = [
    {
      id: "tl-placed",
      type: "placed",
      title: "Đặt hàng thành công",
      description: `Đơn hàng #${orderNumber} được đặt bởi ${custName}.`,
      time: placedAt || "—",
      completed: true,
      actor: `Khách hàng (${custName})`,
      statusBadge: { label: "Đã hoàn thành", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    },
  ];

  // 2. Payment Event
  if (isRefunded) {
    events.push({
      id: "tl-refunded",
      type: "refunded",
      title: "Đã hoàn tiền",
      description: `Đã hoàn trả toàn bộ ${totalAmountStr} cho khách hàng qua ${methodDisplay}.`,
      time: paidAt || updatedAt || placedAt || "—",
      completed: true,
      actor: "Quản trị viên",
      statusBadge: { label: "Đã hoàn tiền", className: "bg-purple-50 text-purple-700 border-purple-200" },
    });
  } else if (isPaid) {
    const sepayId = sepayTransaction?.id ? ` (Mã GD SePay: #${sepayTransaction.id})` : "";
    const refCode = paymentRef && !sepayId ? ` (Mã GD: ${paymentRef})` : "";
    events.push({
      id: "tl-payment",
      type: "payment",
      title: "Xác nhận thanh toán thành công",
      description: `Đã nhận thanh toán ${totalAmountStr} qua ${methodDisplay}${sepayId || refCode}.`,
      time: paidAt || placedAt || "—",
      completed: true,
      actor: sepayTransaction ? "Cổng VietQR (Tự động)" : "Hệ thống / Kế toán",
      statusBadge: { label: "Đã thanh toán", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    });
  } else if (isCod) {
    events.push({
      id: "tl-payment",
      type: "payment",
      title: isDelivered ? "Đã thu tiền COD" : "Thanh toán khi nhận hàng (COD)",
      description: isDelivered
        ? `Đã thu ${totalAmountStr} tiền mặt từ khách hàng khi giao kiện hàng.`
        : `Thu hộ ${totalAmountStr} tiền mặt khi nhân viên giao hàng phát kiện.`,
      time: isDelivered ? (fulfilledAt || paidAt || "Đã thu tiền") : "Khi phát hàng",
      completed: isDelivered,
      isCurrent: !isDelivered && !isCancelled,
      actor: "Shipper / Giao vận",
      statusBadge: isDelivered
        ? { label: "Đã thu tiền", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
        : { label: "Chờ phát hàng", className: "bg-amber-50 text-amber-700 border-amber-200" },
    });
  } else {
    events.push({
      id: "tl-payment",
      type: "payment",
      title: "Chờ thanh toán",
      description: `Đang chờ khách hàng thanh toán qua ${methodDisplay}. Hệ thống tự động khớp lệnh ngay khi nhận tiền.`,
      time: "Đang chờ",
      completed: false,
      isCurrent: !isCancelled,
      actor: "Hệ thống ÉLANE Pay",
      statusBadge: { label: "Chờ thanh toán", className: "bg-amber-50 text-amber-700 border-amber-200" },
    });
  }

  // 3. Picking & Xuất kho
  if (isDelivered) {
    events.push({
      id: "tl-picking",
      type: "picking",
      title: "Soạn hàng & Xuất kho hoàn tất",
      description: inventoryDocCode
        ? `Đã xuất kho theo phiếu xuất ${inventoryDocCode} cho ${totalQty} sản phẩm.`
        : `Kho tiếp nhận đơn và đã xuất hoàn tất ${totalQty} sản phẩm.`,
      time: fulfilledAt || placedAt || "—",
      completed: true,
      actor: "Thủ kho trung tâm",
      statusBadge: { label: "Đã xuất kho", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    });
  } else if (isShipping) {
    events.push({
      id: "tl-picking",
      type: "picking",
      title: "Soạn hàng & Xuất kho hoàn tất",
      description: inventoryDocCode
        ? `Đã xuất kho theo phiếu xuất ${inventoryDocCode} cho ${totalQty} sản phẩm.`
        : `Kho tiếp nhận đơn và đã xuất hoàn tất ${totalQty} sản phẩm.`,
      time: fulfilledAt || placedAt || "—",
      completed: true,
      actor: "Thủ kho trung tâm",
      statusBadge: { label: "Đã xuất kho", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    });
  } else {
    events.push({
      id: "tl-picking",
      type: "picking",
      title: "Chờ soạn hàng & Xuất kho",
      description: (isPaid || isCod) && !isCancelled
        ? "Đơn hàng đủ điều kiện xuất kho, chờ bộ phận kho lấy hàng."
        : "Kho sẽ tiến hành lấy hàng sau khi đơn hàng được xác nhận thanh toán.",
      time: "—",
      completed: false,
      isCurrent: (isPaid || isCod) && !isCancelled,
      actor: "Thủ kho trung tâm",
      statusBadge: { label: "Chờ lấy hàng", className: "bg-slate-100 text-slate-500 border-slate-200" },
    });
  }

  // 4. Packaging
  if (isDelivered) {
    events.push({
      id: "tl-packed",
      type: "packed",
      title: "Đã đóng gói hoàn tất",
      description: `${itemCount} mặt hàng (${totalQty} sản phẩm) được đóng gói hộp quà ÉLANE kèm thiệp cảm ơn.`,
      time: fulfilledAt || placedAt || "—",
      completed: true,
      actor: "Đội đóng gói ÉLANE",
      statusBadge: { label: "Đã đóng gói", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    });
  } else if (isShipping) {
    events.push({
      id: "tl-packed",
      type: "packed",
      title: "Đã đóng gói hoàn tất",
      description: `${itemCount} mặt hàng (${totalQty} sản phẩm) được đóng gói hộp quà ÉLANE kèm thiệp cảm ơn.`,
      time: fulfilledAt || placedAt || "—",
      completed: true,
      actor: "Đội đóng gói ÉLANE",
      statusBadge: { label: "Đã đóng gói", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    });
  } else {
    events.push({
      id: "tl-packed",
      type: "packed",
      title: "Đóng gói sản phẩm",
      description: `${itemCount} mặt hàng (${totalQty} sản phẩm) sẽ được đóng gói quy cách hộp quà ÉLANE.`,
      time: "—",
      completed: false,
      actor: "Đội đóng gói ÉLANE",
      statusBadge: { label: "Chờ đóng gói", className: "bg-slate-100 text-slate-500 border-slate-200" },
    });
  }

  // 5. Shipping
  if (isDelivered) {
    events.push({
      id: "tl-shipped",
      type: "shipped",
      title: "Đã giao hàng thành công",
      description: "Kiện hàng đã được đơn vị vận chuyển giao tận tay khách hàng an toàn.",
      time: fulfilledAt || placedAt || "—",
      completed: true,
      actor: "Đơn vị vận chuyển",
      statusBadge: { label: "Giao thành công", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    });
  } else if (isShipping) {
    events.push({
      id: "tl-shipped",
      type: "shipped",
      title: "Đang vận chuyển",
      description: "Kiện hàng đã giao cho đơn vị vận chuyển và đang trên đường phát đến khách hàng.",
      time: "Đang giao",
      completed: false,
      isCurrent: true,
      actor: "Đơn vị vận chuyển",
      statusBadge: { label: "Đang giao hàng", className: "bg-blue-50 text-blue-700 border-blue-200" },
    });
  } else {
    events.push({
      id: "tl-shipped",
      type: "shipped",
      title: "Chờ bàn giao vận chuyển",
      description: "Mã vận đơn sẽ được gán tự động khi đơn vị vận chuyển tiếp nhận kiện hàng.",
      time: "—",
      completed: false,
      actor: "Đơn vị vận chuyển",
      statusBadge: { label: "Chờ lấy hàng", className: "bg-slate-100 text-slate-500 border-slate-200" },
    });
  }

  // 6. Cancelled event if cancelled
  if (isCancelled) {
    events.push({
      id: "tl-cancelled",
      type: "cancelled",
      title: "Đơn hàng đã bị hủy",
      description: "Đơn hàng đã được hủy, toàn bộ số lượng tồn kho tạm giữ đã được hoàn trả.",
      time: updatedAt || placedAt || "—",
      completed: true,
      actor: "Quản trị viên",
      statusBadge: { label: "Đã hủy", className: "bg-rose-50 text-rose-700 border-rose-200" },
    });
  }

  return events;
}

// Ô trong thanh trạng thái: vạch chia ngắn, nằm giữa, hiệu ứng hover mượt mà
const STATUS_CELL =
  "group relative flex min-w-0 items-center gap-4 px-6 py-5 transition-all duration-300 hover:bg-slate-50/90 md:after:absolute md:after:right-0 md:after:top-1/2 md:after:h-8 md:after:w-px md:after:-translate-y-1/2 md:after:bg-slate-200";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString("vi-VN") + " ₫";
}

// Map tên màu -> mã hex để vẽ swatch ở cột Phân loại (fallback xám khi không khớp)
function resolveColorHex(
  colorLabel: string | null | undefined,
  directHex: string | null | undefined,
  hexByName: Map<string, string>,
): string | null {
  if (directHex) return directHex;
  if (!colorLabel) return null;
  const hit = hexByName.get(colorLabel.trim().toLowerCase());
  return hit ?? null;
}

function formatVnDateTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return "—";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return (
      d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) +
      " lúc " +
      d.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  } catch {
    return String(dateInput);
  }
}

function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "Chưa xác định";
  const m = method.toLowerCase();
  if (m.includes("vietqr") || m === "qr") return "Chuyển khoản VietQR";
  if (m.includes("bank") || m.includes("transfer")) return "Chuyển khoản ngân hàng";
  if (m === "cod" || m.includes("cash")) return "Thanh toán khi nhận hàng (COD)";
  if (m === "card" || m === "visa" || m === "mastercard") return "Thẻ Visa / Quốc tế";
  return method;
}

function formatPaymentStatus(status: string | null | undefined): {
  label: string;
  badgeClass: string;
} {
  const s = (status || "").toLowerCase();
  if (s === "paid") {
    return { label: "Đã thanh toán", badgeClass: "bg-emerald-100 text-emerald-600" };
  }
  if (s === "refunded") {
    return { label: "Đã hoàn tiền", badgeClass: "bg-purple-100 text-purple-700" };
  }
  if (s === "failed" || s === "cancelled") {
    return { label: "Đã hủy (Hết hạn)", badgeClass: "bg-rose-100 text-rose-600" };
  }
  return { label: "Chờ thanh toán", badgeClass: "bg-amber-100 text-amber-600" };
}

function formatFulfillmentStatus(status: string | null | undefined): {
  label: string;
  badgeClass: string;
} {
  const s = (status || "").toLowerCase();
  if (s === "delivered") {
    return { label: "Đã giao hàng", badgeClass: "bg-emerald-100 text-emerald-600" };
  }
  if (s === "fulfilled" || s === "shipping") {
    return { label: "Đang giao hàng", badgeClass: "bg-blue-100 text-blue-600" };
  }
  if (s === "unfulfilled") {
    return { label: "Chờ xuất kho", badgeClass: "bg-amber-100 text-amber-600" };
  }
  return { label: "Đang xử lý", badgeClass: "bg-orange-100 text-orange-600" };
}

// ─── Initial Empty Order ───────────────────────────────────────────────────────

const EMPTY_ORDER_DATA: FullOrderDetail = {
  id: "",
  orderNumber: "",
  placedAt: "—",
  status: "pending",
  paymentStatus: "pending",
  paymentMethod: "Chưa xác định",
  fulfillmentStatus: "unfulfilled",
  fulfillmentLocation: "Kho trung tâm",
  shippingMethod: "Giao hàng tiêu chuẩn",
  shippingEstimate: "—",
  packedCount: 0,
  items: [],
  customer: {
    id: "",
    name: "Khách mua hàng",
    email: "—",
    phone: "—",
    ordersCount: 1,
    joinedDate: "—",
    avatarInitials: "KH",
  },
  shippingAddress: {
    fullName: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Việt Nam",
    phone: "",
  },
  billingAddress: {
    fullName: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Việt Nam",
  },
  discountAmount: 0,
  shippingCost: 0,
  taxRate: 0.08,
  taxAmountOverride: 0,
  notes: [],
  timeline: [],
};

// ─── Component ───────────────────────────────────────────────────────────────

export function OrderDetailView({
  orderId,
  orderNumber,
  onBack,
  onUpdated,
  onNavigateToInventory,
  permissions = [],
}: {
  orderId: string | null;
  orderNumber?: string | null | undefined;
  onBack: () => void;
  onUpdated?: (() => void) | undefined;
  onNavigateToInventory?: ((seed: InventorySeed) => void) | undefined;
  permissions?: string[];
}) {
  const hasPermission = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const canUpdateOrder = hasPermission("order.update");
  const canIssueInventory = hasPermission("inventory.issue");
  const [order, setOrder] = useState<FullOrderDetail>(() => ({
    ...EMPTY_ORDER_DATA,
    id: orderId || "",
    orderNumber: orderNumber || "",
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [newNoteInput, setNewNoteInput] = useState("");
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"all" | "payment" | "warehouse" | "other">("all");
  const [newActivityNote, setNewActivityNote] = useState("");
  const [newActivityType, setNewActivityType] = useState("Liên hệ khách hàng");

  // Load colors từ API để map tên → hex cho swatch cột Phân loại
  const [colorHexByName, setColorHexByName] = useState(new Map<string, string>());
  useEffect(() => {
    adminApi
      .colors()
      .then((res) => {
        const map = new Map<string, string>();
        res.items.forEach((c) => {
          if (c.hex) map.set(c.name.trim().toLowerCase(), c.hex);
        });
        setColorHexByName(map);
      })
      .catch(() => {});
  }, []);

  // Edit address draft
  const [addressDraft, setAddressDraft] = useState({
    fullName: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  // Edit customer draft
  const [customerDraft, setCustomerDraft] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // ── Hydrate real order data from backend API if available ──
  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    const fetchOrderData = async () => {
      setIsLoading(true);
      try {
        const res = await adminApi.orderDetail(orderId);
        if (!isMounted || !res) return;

        const discountVnd = Number(res.discount_vnd || 0);
        const shippingVnd = Number(res.shipping_vnd || 0);
        const subtotalVnd = Number(res.subtotal_vnd || 0);
        const grandTotalVnd = Number(res.grand_total_vnd || 0);

        const productIds = Array.from(
          new Set(
            (res.items || [])
              .map((item) => item.product_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const products = await Promise.all(
          productIds.map((productId) => adminApi.product(productId).catch(() => null)),
        );
        if (!isMounted) return;

        const colorLabelByVariantId = new Map<string, string>();
        products.forEach((product) => {
          product?.variants.forEach((variant) => {
            const colorLabel = variant.color?.name || variant.color_name;
            if (colorLabel) colorLabelByVariantId.set(variant.id, colorLabel);
          });
        });

        const mappedItems: OrderItemDetail[] = (res.items || []).map((it, idx) => {
          const unitPrice = Number(it.unit_price_vnd || 0);
          const lineTotal = Number(it.line_total_vnd || unitPrice * (it.qty || 1));
          const colorLabel =
            (it.variant_id ? colorLabelByVariantId.get(it.variant_id) : null) ||
            it.color_label ||
            null;
          return {
            id: it.id || `it-${idx}`,
            product_id: it.product_id,
            variant_id: it.variant_id,
            sku: it.sku || `SKU-${idx + 1}`,
            product_name: it.product_name || "Sản phẩm ÉLANE",
            category: "Thời trang ÉLANE",
            variant:
              it.size_label && colorLabel
                ? `${colorLabel} / ${it.size_label}`
                : it.size_label || colorLabel || "Tiêu chuẩn",
            size_label: it.size_label,
            color_label: colorLabel,
            color_hex: (it as { color_hex?: string | null }).color_hex ?? null,
            image_url: it.image_url || null,
            qty: it.qty,
            unit_price: unitPrice,
            unit_price_vnd: unitPrice,
            line_total: lineTotal,
          };
        });

        const custName =
          res.customer?.full_name || res.recipient?.["full_name"] || "Khách mua hàng";
        const custEmail = res.customer?.email || res.recipient?.["email"] || "Chưa có email";
        const custPhone = res.customer?.phone || res.recipient?.["phone"] || "Chưa có SĐT";

        const custInitials =
          custName
            .split(" ")
            .filter(Boolean)
            .map((n) => n[0])
            .slice(-2)
            .join("")
            .toUpperCase() || "KH";

        const placedDateStr = formatVnDateTime(res.placed_at);
        const paidDateStr = res.paid_at ? formatVnDateTime(res.paid_at) : null;
        const fulfilledDateStr = res.fulfilled_at ? formatVnDateTime(res.fulfilled_at) : null;
        const methodDisplay = formatPaymentMethod(res.payment_method);

        const isPaid = (res.payment_status || "").toLowerCase() === "paid";
        const isDelivered =
          (res.fulfillment_status as string) === "fulfilled" ||
          (res.fulfillment_status as string) === "delivered";
        const isShipping =
          (res.fulfillment_status as string) === "shipping" ||
          (res.fulfillment_status as string) === "partial";

        const finalItems = mappedItems;
        const totalCount = finalItems.reduce((acc, it) => acc + it.qty, 0);

        const realTimeline = buildOrderTimeline({
          orderNumber: res.order_number || orderNumber || "ELN-NEW",
          custName,
          placedAt: placedDateStr,
          paidAt: paidDateStr,
          paymentMethod: res.payment_method,
          paymentStatus: res.payment_status,
          paymentRef: res.payment_ref,
          fulfillmentStatus: res.fulfillment_status,
          fulfilledAt: fulfilledDateStr,
          status: res.status,
          inventoryDocCode: res.inventory_doc_code,
          sepayTransaction: res.sepay_transaction,
          grandTotalVnd: grandTotalVnd || subtotalVnd,
          subtotalVnd,
          itemCount: finalItems.length,
          totalQty: totalCount,
          updatedAt: res.updated_at ? formatVnDateTime(res.updated_at) : null,
        });

        setOrder((prev) => ({
          ...prev,
          id: res.id,
          orderNumber: res.order_number || orderNumber || prev.orderNumber,
          placedAt: placedDateStr,
          status: res.status,
          paymentStatus:
            res.status === "cancelled" || res.payment_status === "failed"
              ? "failed"
              : isPaid
                ? "paid"
                : res.payment_status === "refunded"
                  ? "refunded"
                  : "pending",
          paymentMethod: methodDisplay,
          paidAt: paidDateStr,
          fulfillmentStatus: (res.fulfillment_status as string) || "unfulfilled",
          inventoryDocId: res.inventory_doc_id,
          inventoryDocCode: res.inventory_doc_code,
          items: finalItems,
          packedCount: isDelivered ? totalCount : Math.min(prev.packedCount, totalCount),
          customer: {
            id: res.customer?.id || prev.customer.id,
            name: custName,
            email: custEmail,
            phone: custPhone,
            ordersCount: (res.customer as any)?.orders_count || prev.customer.ordersCount,
            joinedDate: res.customer?.created_at ? formatVnDateTime(res.customer.created_at) : prev.customer.joinedDate,
            avatarInitials: custInitials,
          },
          shippingAddress: {
            fullName: res.recipient?.["full_name"] || custName,
            addressLine1:
              res.shipping_address?.["address_line"] ||
              res.shipping_address?.["address"] ||
              prev.shippingAddress.addressLine1,
            city: res.shipping_address?.["city"] || prev.shippingAddress.city,
            state:
              res.shipping_address?.["district"] ||
              res.shipping_address?.["state"] ||
              prev.shippingAddress.state,
            postalCode:
              res.shipping_address?.["postal_code"] ||
              res.shipping_address?.["postalCode"] ||
              prev.shippingAddress.postalCode,
            country: res.shipping_address?.["country"] || "Việt Nam",
            phone: res.recipient?.["phone"] || custPhone,
          },
          billingAddress: {
            fullName: res.recipient?.["full_name"] || custName,
            addressLine1:
              res.shipping_address?.["address_line"] || prev.billingAddress.addressLine1,
            city: res.shipping_address?.["city"] || prev.billingAddress.city,
            state: res.shipping_address?.["district"] || prev.billingAddress.state,
            postalCode: res.shipping_address?.["postal_code"] || prev.billingAddress.postalCode,
            country: res.shipping_address?.["country"] || "Việt Nam",
          },
          discountCode: res.discount_code || (discountVnd > 0 ? "ƯU ĐÃI" : undefined),
          discountAmount: discountVnd,
          shippingCost: shippingVnd,
          taxAmountOverride: 0,
          timeline: realTimeline,
        }));
      } catch (err) {
        console.error("Lỗi khi tải chi tiết đơn hàng", orderId, err);
        toast.error("Không thể tải thông tin đơn hàng từ hệ thống");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void fetchOrderData();
    return () => {
      isMounted = false;
    };
  }, [orderId, orderNumber]);

  // ── Financial Calculations ──
  const subtotal = useMemo(() => {
    return order.items.reduce((acc, it) => acc + it.line_total, 0);
  }, [order.items]);

  const totalQty = useMemo(() => {
    return order.items.reduce((acc, it) => acc + it.qty, 0);
  }, [order.items]);

  const taxAmount = useMemo(() => {
    if (order.taxAmountOverride !== undefined) return order.taxAmountOverride;
    return Math.max(0, (subtotal - order.discountAmount) * order.taxRate);
  }, [subtotal, order.discountAmount, order.taxRate, order.taxAmountOverride]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - order.discountAmount + order.shippingCost + taxAmount);
  }, [subtotal, order.discountAmount, order.shippingCost, taxAmount]);

  // ── Actions ──

  const handleAddNote = () => {
    if (!newNoteInput.trim()) return;
    const newNote: OrderNote = {
      id: `note-${Date.now()}`,
      author: "Quản trị viên",
      authorInitials: "QT",
      content: newNoteInput.trim(),
      createdAt: formatVnDateTime(new Date()),
    };
    setOrder((prev) => ({
      ...prev,
      notes: [newNote, ...prev.notes],
    }));
    setNewNoteInput("");
    toast.success("Đã thêm ghi chú cho đơn hàng!");
  };

  const handleDeleteNote = (noteId: string) => {
    setOrder((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== noteId),
    }));
    toast.success("Đã xóa ghi chú!");
  };

  const handleMarkPaid = async () => {
    setIsMarkingPaid(true);
    try {
      const targetId = order.id || orderId || order.orderNumber;
      if (targetId) {
        await adminApi.markOrderPaid(targetId);
      }
      const nowStr = formatVnDateTime(new Date());
      setOrder((prev) => {
        const nextTimeline = buildOrderTimeline({
          orderNumber: prev.orderNumber,
          custName: prev.customer.name,
          placedAt: prev.placedAt,
          paidAt: nowStr,
          paymentMethod: prev.paymentMethod,
          paymentStatus: "paid",
          fulfillmentStatus: prev.fulfillmentStatus,
          status: "confirmed",
          inventoryDocCode: prev.inventoryDocCode,
          grandTotalVnd: grandTotal,
          subtotalVnd: subtotal,
          itemCount: prev.items.length,
          totalQty,
        });
        return {
          ...prev,
          paymentStatus: "paid",
          paidAt: nowStr,
          status: "confirmed",
          timeline: nextTimeline,
        };
      });
      toast.success("Đã xác nhận thanh toán đơn hàng thành công!");
      onUpdated?.();
    } catch (err: any) {
      console.error(err);
      const errMsg = adminErrorMessage(err) || "Không thể xác nhận thanh toán. Vui lòng thử lại!";
      toast.error(errMsg);
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const isPaid = order.paymentStatus === "paid";
  const isCod = order.paymentMethod?.toLowerCase().includes("cod") ?? false;
  const isCancelled = order.status === "cancelled";
  const isDelivered = (order.fulfillmentStatus || "").toLowerCase() === "delivered";
  const isShipping =
    (order.fulfillmentStatus || "").toLowerCase() === "shipping" ||
    (order.fulfillmentStatus || "").toLowerCase() === "fulfilled" ||
    (order.fulfillmentStatus || "").toLowerCase() === "partial";
  const isExported = isShipping || isDelivered;
  const canFulfill = (isPaid || isCod) && !isCancelled;
  const isReadyToFulfill = canFulfill && !isExported;

  // Nối trực tiếp tới module Kho hàng để tạo phiếu xuất kho & điền sẵn mặt hàng
  const handleCreateStockIssue = () => {
    if (!canFulfill) {
      if (isCancelled) {
        toast.error("Đơn hàng đã bị hủy, không thể xuất kho");
      } else {
        toast.error("Chỉ đơn hàng đã thanh toán thành công hoặc COD mới được xuất kho");
      }
      return;
    }
    if (!order.items.length) {
      toast.error("Đơn hàng không có sản phẩm để xuất kho");
      return;
    }

    const recipientName =
      order.shippingAddress?.fullName || order.customer?.name || "Khách hàng";

    const lines = order.items.map((it) => ({
      product_id: it.product_id || "",
      variant_id: it.variant_id || "",
      qty: it.qty,
      direction: "out" as const,
      sku: it.sku,
      product_name: it.product_name,
      color_label: it.color_label ?? null,
      size_label: it.size_label ?? null,
      image_url: it.image_url ?? null,
      unit_cost_vnd: it.unit_price_vnd ?? it.unit_price,
    }));

    if (onNavigateToInventory) {
      const seed: InventorySeed = {
        docType: "issue",
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: `Xuất kho đơn hàng #${order.orderNumber} (${recipientName})`,
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

  // Xuất kho nhanh trực tiếp cho đơn hàng
  const handleQuickFulfill = async () => {
    if (!canFulfill) {
      if (isCancelled) {
        toast.error("Đơn hàng đã bị hủy, không thể xuất kho");
      } else {
        toast.error("Chỉ đơn hàng đã thanh toán thành công hoặc COD mới được xuất kho");
      }
      return;
    }
    setIsFulfilling(true);
    const nowStr = formatVnDateTime(new Date());
    try {
      const targetId = order.id || orderId || order.orderNumber;
      if (targetId) {
        await adminApi.fulfillOrder(targetId, {
          status: "shipping",
        });
      }
      setOrder((prev) => {
        const nextTimeline = buildOrderTimeline({
          orderNumber: prev.orderNumber,
          custName: prev.customer.name,
          placedAt: prev.placedAt,
          paidAt: prev.paidAt,
          paymentMethod: prev.paymentMethod,
          paymentStatus: prev.paymentStatus,
          fulfillmentStatus: "shipping",
          fulfilledAt: nowStr,
          status: prev.status,
          inventoryDocCode: prev.inventoryDocCode,
          grandTotalVnd: grandTotal,
          subtotalVnd: subtotal,
          itemCount: prev.items.length,
          totalQty,
        });

        return {
          ...prev,
          fulfillmentStatus: "shipping",
          packedCount: totalQty,
          timeline: nextTimeline,
        };
      });
      toast.success("Đã xuất kho và chuyển sang trạng thái Đang giao hàng!");
      onUpdated?.();
    } catch (err: any) {
      console.error(err);
      toast.error(adminErrorMessage(err) || "Có lỗi xảy ra khi xuất kho!");
    } finally {
      setIsFulfilling(false);
    }
  };

  // Đánh dấu giao hàng hoàn tất
  const handleToggleDeliver = async () => {
    setIsFulfilling(true);
    const nextStatus = isDelivered ? "shipping" : "delivered";
    const nowStr = formatVnDateTime(new Date());
    try {
      const targetId = order.id || orderId || order.orderNumber;
      if (targetId) {
        await adminApi.fulfillOrder(targetId, {
          status: nextStatus,
        });
      }
      setOrder((prev) => {
        const isDeliv = nextStatus === "delivered";
        const nextTimeline = buildOrderTimeline({
          orderNumber: prev.orderNumber,
          custName: prev.customer.name,
          placedAt: prev.placedAt,
          paidAt: prev.paidAt,
          paymentMethod: prev.paymentMethod,
          paymentStatus: prev.paymentStatus,
          fulfillmentStatus: nextStatus,
          fulfilledAt: prev.paidAt || nowStr,
          status: prev.status,
          inventoryDocCode: prev.inventoryDocCode,
          grandTotalVnd: grandTotal,
          subtotalVnd: subtotal,
          itemCount: prev.items.length,
          totalQty,
        });

        return {
          ...prev,
          fulfillmentStatus: nextStatus,
          packedCount: totalQty,
          timeline: nextTimeline,
        };
      });
      toast.success(
        nextStatus === "delivered"
          ? "Đã giao hàng thành công! Đơn hàng hoàn tất."
          : "Đã chuyển lại trạng thái Đang giao hàng.",
      );
      onUpdated?.();
    } catch (err: any) {
      toast.error(adminErrorMessage(err) || "Có lỗi xảy ra khi cập nhật trạng thái!");
    } finally {
      setIsFulfilling(false);
    }
  };

  const handleProcessRefund = () => {
    setIsRefunding(true);
    setTimeout(() => {
      const nowStr = formatVnDateTime(new Date());
      setOrder((prev) => {
        const nextTimeline = buildOrderTimeline({
          orderNumber: prev.orderNumber,
          custName: prev.customer.name,
          placedAt: prev.placedAt,
          paidAt: nowStr,
          paymentMethod: prev.paymentMethod,
          paymentStatus: "refunded",
          fulfillmentStatus: prev.fulfillmentStatus,
          status: "confirmed",
          inventoryDocCode: prev.inventoryDocCode,
          grandTotalVnd: grandTotal,
          subtotalVnd: subtotal,
          itemCount: prev.items.length,
          totalQty,
          updatedAt: nowStr,
        });

        return {
          ...prev,
          paymentStatus: "refunded",
          timeline: nextTimeline,
        };
      });
      setIsRefunding(false);
      setIsRefundModalOpen(false);
      toast.success("Đã xử lý hoàn tiền cho đơn hàng!");
    }, 600);
  };

  const handleAddCustomActivity = () => {
    if (!newActivityNote.trim()) {
      toast.error("Vui lòng nhập nội dung ghi nhận hoạt động");
      return;
    }
    const newEvent: OrderTimelineEvent = {
      id: `tl-custom-${Date.now()}`,
      type: "custom",
      title: `Ghi nhận: ${newActivityType}`,
      description: newActivityNote.trim(),
      time: formatVnDateTime(new Date()),
      completed: true,
      actor: "Quản trị viên",
      statusBadge: { label: "Nội bộ", className: "bg-violet-50 text-violet-700 border-violet-200" },
    };
    setOrder((prev) => ({
      ...prev,
      timeline: [newEvent, ...prev.timeline],
    }));
    setNewActivityNote("");
    toast.success("Đã thêm ghi nhận hoạt động vào lịch sử đơn hàng!");
  };

  const handleOpenEditAddress = () => {
    setAddressDraft({
      fullName: order.shippingAddress.fullName,
      addressLine1: order.shippingAddress.addressLine1,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postalCode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country,
    });
    setIsEditAddressOpen(true);
  };

  const handleSaveAddress = () => {
    setOrder((prev) => ({
      ...prev,
      shippingAddress: {
        ...prev.shippingAddress,
        ...addressDraft,
      },
    }));
    setIsEditAddressOpen(false);
    toast.success("Đã cập nhật địa chỉ giao hàng!");
  };

  const handleOpenEditCustomer = () => {
    setCustomerDraft({
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
    });
    setIsEditCustomerOpen(true);
  };

  const handleSaveCustomer = () => {
    const initials =
      customerDraft.name
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .slice(-2)
        .join("")
        .toUpperCase() || "KH";

    setOrder((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        name: customerDraft.name,
        email: customerDraft.email,
        phone: customerDraft.phone,
        avatarInitials: initials,
      },
    }));
    setIsEditCustomerOpen(false);
    toast.success("Đã cập nhật thông tin khách hàng!");
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[480px] items-center justify-center rounded-xs border border-slate-200 bg-white p-12 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-6 animate-spin text-[#6d3df0]" />
          <p>Đang tải chi tiết đơn hàng #{orderNumber || orderId}...</p>
        </div>
      </div>
    );
  }

  const paymentInfo = formatPaymentStatus(order.paymentStatus);
  const fulfillmentInfo = formatFulfillmentStatus(order.fulfillmentStatus);
  const packed = Math.min(order.packedCount, totalQty);

  return (
    <div className="space-y-4 pb-8 font-sans text-sm text-slate-900">
      {/* ── 1. Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            className="size-8.5 rounded-xs border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
            title="Quay lại danh sách đơn hàng"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-slate-950 admin-page-title">
              Đơn hàng #{order.orderNumber}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-600">
              <span>Đặt ngày: {order.placedAt}</span>
              <span className="text-slate-400">•</span>
              <span>Khách hàng từ: {order.customer.joinedDate}</span>
              <span className="text-slate-400">•</span>
              <span>{order.customer.ordersCount} đơn hàng đã đặt</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <Button
            variant="outline"
            onClick={handlePrintInvoice}
            className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <Printer className="size-4 text-slate-600" />
            <span>In hóa đơn</span>
          </Button>

          {canUpdateOrder && <Button
            variant="outline"
            onClick={() => setIsRefundModalOpen(true)}
            className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCcw className="size-4 text-slate-600" />
            <span>Hoàn tiền</span>
          </Button>}
          {canUpdateOrder && order.paymentStatus !== "paid" && order.paymentStatus !== "refunded" && (
            <Button
              onClick={handleMarkPaid}
              disabled={isMarkingPaid}
              className="h-9 gap-1.5 rounded-xs bg-emerald-600 px-4 text-sm font-medium text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
            >
              {isMarkingPaid ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              <span>Xác nhận đã thanh toán</span>
            </Button>
          )}

          {/* Nút Xuất kho — Hiện khi đủ điều kiện: đã thanh toán (với QR/Bank) hoặc đặt hàng COD, và chưa xuất kho */}
          {canUpdateOrder && canIssueInventory && isReadyToFulfill && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={isFulfilling}
                  className="h-9 gap-1.5 rounded-xs bg-slate-900 px-4 text-sm font-medium text-white shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {isFulfilling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Boxes className="size-4 text-amber-400" />
                  )}
                  <span>Xuất kho</span>
                  <ChevronDown className="size-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 p-1.5">
                <DropdownMenuItem
                  onClick={handleCreateStockIssue}
                  className="cursor-pointer gap-2.5 rounded-xs p-2 text-sm font-medium transition-colors hover:bg-slate-100"
                >
                  <div className="flex size-7 items-center justify-center rounded-xs bg-amber-100 text-amber-700 shrink-0">
                    <Boxes className="size-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Tạo phiếu xuất kho</p>
                    <p className="text-xs text-slate-500">Chuyển sang mục Kho hàng</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleQuickFulfill}
                  className="cursor-pointer gap-2.5 rounded-xs p-2 text-sm font-medium transition-colors hover:bg-slate-100"
                >
                  <div className="flex size-7 items-center justify-center rounded-xs bg-emerald-100 text-emerald-700 shrink-0">
                    <Check className="size-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Xuất kho nhanh</p>
                    <p className="text-xs text-slate-500">Đánh dấu đã xuất hàng ngay</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Link xem phiếu xuất kho nếu đã có mã phiếu */}
          {order.inventoryDocCode && onNavigateToInventory && (
            <Button
              variant="outline"
              onClick={() =>
                onNavigateToInventory({
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                })
              }
              className="h-9 gap-1.5 rounded-xs border-amber-300 bg-amber-50/70 px-3.5 text-sm font-medium text-amber-800 shadow-2xs hover:bg-amber-100 cursor-pointer"
              title="Xem phiếu xuất kho chi tiết"
            >
              <FileText className="size-4 text-amber-600" />
              <span>Phiếu kho: {order.inventoryDocCode}</span>
            </Button>
          )}

          {/* Nút Giao hàng — Chỉ hiển thị khi đơn đã xuất kho */}
          {canUpdateOrder && isExported && (
            <Button
              onClick={handleToggleDeliver}
              disabled={isFulfilling}
              className={cn(
                "h-9 gap-1.5 rounded-xs px-4 text-sm font-medium shadow-xs transition-colors cursor-pointer",
                isDelivered
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : BRAND_BTN,
              )}
            >
              {isFulfilling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isDelivered ? (
                <Check className="size-4" />
              ) : (
                <Truck className="size-4" />
              )}
              <span>{isDelivered ? "Đã giao hàng thành công" : "Xác nhận đã giao"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── 2. Status overview ── */}
      <div className={cn(CARD, "grid grid-cols-1 md:grid-cols-3 overflow-hidden transition-all duration-300 hover:shadow-md")}>
        {/* Thanh toán */}
        <div className={STATUS_CELL}>
          <div
            className={cn(
              "relative flex size-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-115 group-hover:shadow-md group-hover:-translate-y-0.5",
              order.paymentStatus === "paid"
                ? "bg-emerald-100/90 text-emerald-600 shadow-[0_0_16px_rgba(16,185,129,0.28)] ring-2 ring-emerald-300/80"
                : order.paymentStatus === "refunded"
                  ? "bg-purple-100/90 text-purple-600 ring-1 ring-purple-200/70"
                  : isCancelled
                    ? "bg-rose-100/90 text-rose-600 ring-1 ring-rose-200/70"
                    : "bg-amber-100/90 text-amber-600 ring-2 ring-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.35)] animate-pulse",
            )}
          >
            {order.paymentStatus === "paid" ? (
              <CheckCircle2 className="size-6 transition-all duration-300 group-hover:scale-120 group-hover:rotate-6 text-emerald-600" strokeWidth={2.4} />
            ) : order.paymentStatus === "refunded" ? (
              <RefreshCcw className="size-6 transition-transform duration-500 group-hover:rotate-180 text-purple-600" strokeWidth={2.2} />
            ) : isCancelled ? (
              <X className="size-6 transition-transform duration-300 group-hover:scale-120 text-rose-600" strokeWidth={2.4} />
            ) : (
              <CreditCard className="size-6 transition-all duration-300 group-hover:scale-115 group-hover:-rotate-6 text-amber-600" strokeWidth={2.2} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold uppercase tracking-wider text-slate-900">Thanh toán</span>
              <span
                className={cn("rounded-md px-2.5 py-0.5 text-sm font-semibold shadow-2xs transition-transform duration-200 group-hover:scale-105", paymentInfo.badgeClass)}
              >
                {paymentInfo.label}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-slate-700">
              {order.paymentStatus === "paid"
                ? `Thanh toán lúc ${order.paidAt || order.placedAt}`
                : order.paymentStatus === "refunded"
                  ? "Đã hoàn lại tiền cho khách"
                  : isCancelled
                    ? "Đơn hàng đã hủy"
                    : `Chờ thanh toán qua ${order.paymentMethod}`}
            </p>
          </div>
        </div>

        {/* Xử lý & Xuất kho */}
        <div className={cn(STATUS_CELL, "border-t border-slate-200 md:border-t-0")}>
          <div
            className={cn(
              "relative flex size-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-115 group-hover:shadow-md group-hover:-translate-y-0.5",
              isExported
                ? "bg-emerald-100/90 text-emerald-600 shadow-[0_0_16px_rgba(16,185,129,0.28)] ring-2 ring-emerald-300/80"
                : isReadyToFulfill
                  ? "bg-amber-100/90 text-amber-600 ring-2 ring-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.35)] animate-pulse"
                  : isCancelled
                    ? "bg-rose-100/90 text-rose-500 ring-1 ring-rose-200/70"
                    : "bg-slate-100 text-slate-400",
            )}
          >
            <Package className="size-6 transition-all duration-300 group-hover:scale-120 group-hover:-rotate-12" strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold uppercase tracking-wider text-slate-900">
                Xử lý & Xuất kho
              </span>
              <span
                className={cn(
                  "rounded-md px-2.5 py-0.5 text-sm font-semibold shadow-2xs transition-transform duration-200 group-hover:scale-105",
                  fulfillmentInfo.badgeClass,
                )}
              >
                {fulfillmentInfo.label}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-slate-700">
              {order.fulfillmentStatus === "delivered"
                ? "Tất cả sản phẩm đã xuất kho & giao hàng thành công"
                : isExported
                  ? order.inventoryDocCode
                    ? `Đã xuất kho (Phiếu ${order.inventoryDocCode}) - Đang giao hàng`
                    : "Đã xuất kho toàn bộ sản phẩm - Đang giao hàng"
                  : isReadyToFulfill
                    ? "Đã sẵn sàng xuất kho"
                    : isCancelled
                      ? "Đơn hàng đã hủy"
                      : "Chờ thanh toán để xuất kho"}
            </p>
          </div>
        </div>

        {/* Vận chuyển */}
        <div className="group relative flex min-w-0 items-center gap-4 border-t border-slate-200 px-6 py-5 transition-all duration-300 hover:bg-slate-50/90 md:border-t-0">
          <div
            className={cn(
              "relative flex size-12 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-115 group-hover:shadow-md group-hover:-translate-y-0.5",
              isDelivered
                ? "bg-emerald-100/90 text-emerald-600 shadow-[0_0_16px_rgba(16,185,129,0.28)] ring-2 ring-emerald-300/80"
                : isShipping
                  ? "bg-blue-100/90 text-blue-600 shadow-[0_0_16px_rgba(59,130,246,0.3)] ring-2 ring-blue-400 animate-pulse"
                  : isCancelled
                    ? "bg-rose-100/90 text-rose-500 ring-1 ring-rose-200/70"
                    : "bg-blue-50 text-blue-500 ring-1 ring-blue-100/80",
            )}
          >
            <Truck className="size-6 transition-all duration-300 group-hover:scale-115 group-hover:translate-x-2" strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold uppercase tracking-wider text-slate-900">Vận chuyển</span>
              <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-sm font-semibold text-blue-700 border border-blue-200/60 shadow-2xs transition-transform duration-200 group-hover:scale-105">
                {order.shippingMethod}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-slate-700">
              {isDelivered
                ? "Đã giao hàng thành công"
                : isShipping
                  ? "Đang trên đường phát tới khách hàng"
                  : `Dự kiến giao: ${order.shippingEstimate}`}
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. Main two-column grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT COLUMN */}
        <div className="space-y-4 lg:col-span-8">
          {/* Order Items */}
          <div className={cn(CARD, "overflow-hidden")}>
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-slate-900 admin-section-title">
                Danh sách sản phẩm ({order.items.length})
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Tính năng chỉnh sửa sản phẩm trong đơn")}
                className="h-8 rounded-xs border-slate-200 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Chỉnh sửa
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[34%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-12" />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-12" />
                </colgroup>
                <thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-700">
                  <tr>
                    <th className="py-2.5 pl-5 pr-2 font-semibold tracking-tight">Sản phẩm</th>
                    <th className="px-2 py-2.5 font-semibold tracking-tight">Phân loại</th>
                    <th className="px-2 py-2.5 font-semibold tracking-tight">Mã SKU</th>
                    <th className="px-2 py-2.5 text-center font-semibold tracking-tight">SL</th>
                    <th className="px-2 py-2.5 text-right font-semibold tracking-tight">Đơn giá</th>
                    <th className="px-2 py-2.5 text-right font-semibold tracking-tight">Thành tiền</th>
                    <th className="py-2.5 pl-1 pr-5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.sku} className="transition-colors hover:bg-slate-50/80">
                      <td className="py-2.5 pl-5 pr-2">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.image_url || ""}
                            alt={item.product_name}
                            className="size-12 shrink-0 rounded-md border border-slate-200/80 bg-slate-100 object-cover"
                          />
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-semibold text-slate-950"
                              title={item.product_name}
                            >
                              {item.product_name}
                            </p>
                            <p className="mt-0.5 text-sm font-medium text-slate-600">{item.category}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-2 py-2.5 text-slate-700 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {(() => {
                            const hex = resolveColorHex(item.color_label, item.color_hex, colorHexByName);
                            return hex ? (
                              <span
                                className="size-3.5 shrink-0 rounded-full border border-slate-300"
                                style={{ backgroundColor: hex }}
                                title={item.color_label ?? "Màu"}
                              />
                            ) : null;
                          })()}
                          <span className="whitespace-nowrap font-medium text-slate-800">
                            {item.color_label && item.size_label
                              ? `${item.color_label} / ${item.size_label}`
                              : (item.variant ?? "—")}
                          </span>
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-xs font-semibold text-slate-600">
                        {item.sku}
                      </td>

                      <td className="px-2 py-2.5 text-center font-semibold text-slate-900">
                        {item.qty}
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-slate-900">
                        {fmtMoney(item.unit_price)}
                      </td>

                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-medium text-slate-900">
                        {fmtMoney(item.line_total)}
                      </td>

                      <td className="py-2.5 pl-1 pr-5 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="mx-auto flex size-7 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-lg text-sm">
                            <DropdownMenuItem
                              onClick={() => {
                                void navigator.clipboard.writeText(item.sku);
                                toast.success(`Đã sao chép SKU: ${item.sku}`);
                              }}
                            >
                              <Copy className="mr-2 size-3.5" />
                              Sao chép SKU
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toast.info(`Xem chi tiết: ${item.product_name}`)}
                            >
                              <ExternalLink className="mr-2 size-3.5" />
                              Xem chi tiết sản phẩm
                            </DropdownMenuItem>
                            {order.inventoryDocCode && onNavigateToInventory ? (
                              <DropdownMenuItem
                                onClick={() =>
                                  onNavigateToInventory({
                                    orderId: order.id,
                                    orderNumber: order.orderNumber,
                                  })
                                }
                              >
                                <Package className="mr-2 size-3.5" />
                                Xem phiếu kho
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Timeline — Lịch sử đơn hàng */}
          <div className={cn(CARD, "overflow-hidden")}>
            <div className="flex items-center justify-between px-5 pb-1 pt-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-slate-900 admin-section-title">Lịch sử đơn hàng</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {order.timeline.length} mốc sự kiện
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsActivityLogOpen(true)}
                className={cn("text-sm font-medium flex items-center gap-1.5", BRAND_LINK)}
              >
                <History className="size-3.5" />
                <span>Xem toàn bộ hoạt động</span>
              </button>
            </div>
            <div className="px-5 pb-4 pt-2">
              {order.timeline.map((step, index) => {
                const cfg = TIMELINE_ICON[step.type] || TIMELINE_ICON.custom;
                const StepIcon = cfg.Icon;
                const isFirst = index === 0;
                const isLast = index === order.timeline.length - 1;
                const isCompleted = step.completed;
                const isCurrent = step.isCurrent;

                return (
                  <div
                    key={step.id}
                    className="group flex items-stretch gap-3.5 rounded-xl p-2 -mx-2 transition-all duration-200 hover:bg-slate-50/90"
                  >
                    {/* Rail & Animated Node */}
                    <div className="relative flex w-3 shrink-0 items-center justify-center">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute left-1/2 w-0.5 -translate-x-1/2 transition-colors duration-300",
                          isCompleted ? "bg-gradient-to-b from-[#6d3df0] via-violet-400 to-[#6d3df0]/60" : "bg-slate-200",
                        )}
                        style={{ top: isFirst ? "50%" : 0, bottom: isLast ? "50%" : 0 }}
                      />
                      {isCurrent ? (
                        <div className="relative flex items-center justify-center">
                          <span className="absolute size-5 rounded-full bg-amber-400/35 animate-ping duration-1000" />
                          <span className="relative z-10 size-3.5 rounded-full border-2 border-amber-600 bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.65)] ring-4 ring-amber-200/90 animate-pulse" />
                        </div>
                      ) : isCompleted ? (
                        <span
                          className="relative z-10 size-3 rounded-full border-2 border-[#6d3df0] bg-[#6d3df0] ring-4 ring-violet-200/80 shadow-[0_0_8px_rgba(109,61,240,0.4)] transition-all duration-300 group-hover:scale-135 group-hover:ring-violet-300 group-hover:shadow-[0_0_12px_rgba(109,61,240,0.6)]"
                        />
                      ) : (
                        <span className="relative z-10 size-2.5 rounded-full border-2 border-slate-300 bg-white transition-transform duration-200 group-hover:scale-125 group-hover:border-slate-400" />
                      )}
                    </div>

                    {/* Icon + content */}
                    <div className="flex min-w-0 flex-1 items-center gap-3.5 py-1.5 transition-all duration-200 group-hover:translate-x-1">
                      <div
                        className={cn(
                          "relative flex size-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-115 group-hover:shadow-md",
                          isCompleted
                            ? cn(cfg.bg, cfg.color, "shadow-2xs ring-1 ring-black/5 group-hover:ring-2 group-hover:ring-violet-300/80")
                            : isCurrent
                              ? "bg-amber-100 text-amber-600 ring-2 ring-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.3)] animate-pulse"
                              : "bg-slate-100 text-slate-400 group-hover:bg-slate-200/80",
                        )}
                      >
                        <StepIcon className="size-[19px] transition-transform duration-300 group-hover:scale-115" strokeWidth={isCompleted ? 2.4 : 2.2} />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={cn(
                                "text-sm leading-5 tracking-tight",
                                isCompleted
                                  ? "font-semibold text-slate-950"
                                  : isCurrent
                                    ? "font-semibold text-slate-950"
                                    : "font-semibold text-slate-500",
                              )}
                            >
                              {step.title}
                            </p>
                            {step.statusBadge && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none shadow-2xs transition-transform duration-200 group-hover:scale-105",
                                  step.statusBadge.className,
                                )}
                              >
                                {step.statusBadge.label}
                              </span>
                            )}
                          </div>
                          <p
                            className={cn(
                              "text-sm leading-relaxed mt-0.5",
                              isCompleted || isCurrent ? "font-semibold text-slate-700" : "font-medium text-slate-400",
                            )}
                          >
                            {step.description}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 whitespace-nowrap text-sm",
                            isCompleted
                              ? "font-semibold text-slate-800"
                              : isCurrent
                                ? "font-semibold text-amber-600"
                                : "text-slate-400 font-semibold",
                          )}
                        >
                          {step.time}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes — Ghi chú */}
          <div className={cn(CARD, "px-5 py-4")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <h2 className="w-[64px] shrink-0 text-slate-900 admin-section-title">
                Ghi chú
              </h2>
              <input
                type="text"
                value={newNoteInput}
                onChange={(e) => setNewNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddNote();
                }}
                placeholder="Thêm ghi chú nội bộ cho đơn hàng này..."
                className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6d3df0] focus:outline-none focus:ring-1 focus:ring-[#6d3df0]"
              />
              <Button
                type="button"
                onClick={handleAddNote}
                className="h-10 rounded-lg bg-violet-100 px-4 text-sm font-medium text-[#6d3df0] shadow-none transition-colors hover:bg-violet-200"
              >
                Thêm ghi chú
              </Button>
            </div>

            {order.notes.length > 0 && (
              <div className="mt-3 divide-y divide-slate-100 sm:pl-[80px]">
                {order.notes.map((n) => (
                  <div key={n.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                        {n.authorInitials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Ghi chú bởi {n.author}
                        </p>
                        <p className="text-sm text-slate-500">{n.content}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="whitespace-nowrap text-sm text-slate-500">
                        {n.createdAt}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 rounded-lg text-sm">
                          <DropdownMenuItem onClick={() => handleDeleteNote(n.id)}>
                            <Trash2 className="mr-2 size-3.5" />
                            Xóa ghi chú
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4 lg:col-span-4">
          {/* Order Summary — Tóm tắt thanh toán */}
          <div className={cn(CARD, "px-5 py-4")}>
            <h2 className="text-slate-900 admin-section-title">Tóm tắt thanh toán</h2>

            <div className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-700">
                <span className="font-semibold">Tạm tính ({order.items.length} mặt hàng)</span>
                <span className="font-semibold text-slate-950">{fmtMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span className="font-semibold">Phí vận chuyển ({order.shippingMethod})</span>
                <span className="font-semibold text-slate-950">
                  {order.shippingCost > 0 ? fmtMoney(order.shippingCost) : "Miễn phí"}
                </span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span className="font-semibold">Giảm giá ({order.discountCode || "ƯU ĐÃI"})</span>
                  <span className="font-semibold text-emerald-600">
                    -{fmtMoney(order.discountAmount)}
                  </span>
                </div>
              )}
              {taxAmount > 0 ? (
                <div className="flex justify-between text-slate-700">
                  <span className="font-semibold">Thuế VAT ({Math.round(order.taxRate * 100)}%)</span>
                  <span className="font-semibold text-slate-950">{fmtMoney(taxAmount)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-slate-700">
                  <span className="font-semibold">Thuế VAT</span>
                  <span className="font-semibold text-slate-500">Đã bao gồm trong giá</span>
                </div>
              )}
            </div>

            <div className="mt-3.5 flex items-center justify-between border-t border-slate-200 pt-3.5">
              <span className="text-base font-semibold text-slate-950">Tổng thanh toán</span>
              <span className="text-xl font-semibold tracking-tight text-slate-950">
                {fmtMoney(grandTotal)}
              </span>
            </div>
          </div>

          {/* Customer — Khách hàng */}
          <div className={cn(CARD, "px-5 py-4")}>
            <div className="flex items-center justify-between">
              <h2 className="text-slate-900 admin-section-title">Khách hàng</h2>
              <button
                type="button"
                onClick={handleOpenEditCustomer}
                className={cn("text-sm font-semibold", BRAND_LINK)}
              >
                Chỉnh sửa
              </button>
            </div>

            <div className="mt-3 flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-[#6d3df0]">
                {order.customer.avatarInitials}
              </div>
              <div className="min-w-0 text-sm leading-[20px] text-slate-600">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {order.customer.name}
                </p>
                <p className="truncate font-medium">{order.customer.email}</p>
                <p className="font-semibold text-slate-800">{order.customer.phone}</p>
                <p className="text-sm font-medium text-slate-400">
                  {order.customer.ordersCount} đơn hàng • Khách từ {order.customer.joinedDate}
                </p>
              </div>
            </div>
          </div>

          {/* Shipping Address — Địa chỉ nhận hàng */}
          <div className={cn(CARD, "px-5 py-4")}>
            <div className="flex items-center justify-between">
              <h2 className="text-slate-900 admin-section-title">Địa chỉ nhận hàng</h2>
              <button
                type="button"
                onClick={handleOpenEditAddress}
                className={cn("text-sm font-semibold", BRAND_LINK)}
              >
                Chỉnh sửa
              </button>
            </div>

            <div className="mt-3 flex items-start gap-4">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <MapPin className="size-5" strokeWidth={2} />
              </div>
              <div className="text-sm leading-[20px] text-slate-600">
                <p className="font-semibold text-slate-950">{order.shippingAddress.fullName}</p>
                <p className="font-medium text-slate-700">{order.shippingAddress.addressLine1}</p>
                <p className="font-medium text-slate-600">
                  {[
                    order.shippingAddress.state,
                    order.shippingAddress.city,
                    order.shippingAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p className="font-medium text-slate-600">{order.shippingAddress.country}</p>
                {order.shippingAddress.phone ? (
                  <p className="mt-0.5 font-semibold text-slate-800">SĐT: {order.shippingAddress.phone}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Billing Address — Địa chỉ thanh toán */}
          <div className={cn(CARD, "px-5 py-4")}>
            <div className="flex items-center justify-between">
              <h2 className="text-slate-900 admin-section-title">Địa chỉ thanh toán</h2>
              <button
                type="button"
                onClick={handleOpenEditAddress}
                className={cn("text-sm font-semibold", BRAND_LINK)}
              >
                Chỉnh sửa
              </button>
            </div>

            <div className="mt-3 flex items-start gap-4">
              <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <FileText className="size-5" strokeWidth={2} />
              </div>
              <div className="text-sm leading-[20px] text-slate-600">
                <p className="font-semibold text-slate-950">{order.billingAddress.fullName}</p>
                <p className="font-medium text-slate-700">{order.billingAddress.addressLine1}</p>
                <p className="font-medium text-slate-600">
                  {[
                    order.billingAddress.state,
                    order.billingAddress.city,
                    order.billingAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p className="font-medium text-slate-600">{order.billingAddress.country}</p>
              </div>
            </div>
          </div>

          {/* Payment Method — Phương thức thanh toán */}
          <div className={cn(CARD, "px-5 py-4")}>
            <h2 className="text-slate-900 admin-section-title">Phương thức thanh toán</h2>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold italic tracking-tight text-blue-800">
                  {order.paymentCardBrand || "BANK"}
                </span>
                <div className="text-sm leading-[19px] text-slate-500">
                  <p className="font-semibold text-slate-900">
                    {order.paymentMethod}{" "}
                    {order.paymentCardLast4 ? `(*${order.paymentCardLast4})` : ""}
                  </p>
                  <p>
                    {order.paymentExpiry
                      ? `Hạn thẻ: ${order.paymentExpiry}`
                      : order.paidAt
                        ? `Xác nhận: ${order.paidAt}`
                        : "Thanh toán an toàn"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "rounded-md px-2.5 py-0.5 text-sm font-medium",
                    paymentInfo.badgeClass,
                  )}
                >
                  {paymentInfo.label}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-7 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-lg text-sm">
                    <DropdownMenuItem onClick={() => setIsRefundModalOpen(true)}>
                      Hoàn tiền đơn này
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialog: Edit Customer ── */}
      <Dialog open={isEditCustomerOpen} onOpenChange={setIsEditCustomerOpen}>
        <DialogContent className="max-w-md rounded-xs">
          <DialogHeader>
            <DialogTitle className="text-slate-900 admin-section-title">
              Chỉnh sửa thông tin khách hàng
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div>
              <label className="font-semibold text-slate-700">Họ và tên</label>
              <Input
                value={customerDraft.name}
                onChange={(e) => setCustomerDraft((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 h-10 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700">Địa chỉ email</label>
              <Input
                type="email"
                value={customerDraft.email}
                onChange={(e) => setCustomerDraft((p) => ({ ...p, email: e.target.value }))}
                className="mt-1 h-10 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700">Số điện thoại</label>
              <Input
                value={customerDraft.phone}
                onChange={(e) => setCustomerDraft((p) => ({ ...p, phone: e.target.value }))}
                className="mt-1 h-10 rounded-lg text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditCustomerOpen(false)}
              className="h-9 rounded-lg text-sm"
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCustomer}
              className={cn("h-9 rounded-lg text-sm", BRAND_BTN)}
            >
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Edit Address ── */}
      <Dialog open={isEditAddressOpen} onOpenChange={setIsEditAddressOpen}>
        <DialogContent className="max-w-md rounded-xs">
          <DialogHeader>
            <DialogTitle className="text-slate-900 admin-section-title">
              Chỉnh sửa địa chỉ nhận hàng
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div>
              <label className="font-semibold text-slate-700">Họ tên người nhận</label>
              <Input
                value={addressDraft.fullName}
                onChange={(e) => setAddressDraft((p) => ({ ...p, fullName: e.target.value }))}
                className="mt-1 h-10 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700">Địa chỉ chi tiết</label>
              <Input
                value={addressDraft.addressLine1}
                onChange={(e) => setAddressDraft((p) => ({ ...p, addressLine1: e.target.value }))}
                className="mt-1 h-10 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Tỉnh / Thành phố</label>
                <Input
                  value={addressDraft.city}
                  onChange={(e) => setAddressDraft((p) => ({ ...p, city: e.target.value }))}
                  className="mt-1 h-10 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Quận / Huyện</label>
                <Input
                  value={addressDraft.state}
                  onChange={(e) => setAddressDraft((p) => ({ ...p, state: e.target.value }))}
                  className="mt-1 h-10 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700">Mã bưu chính</label>
                <Input
                  value={addressDraft.postalCode}
                  onChange={(e) => setAddressDraft((p) => ({ ...p, postalCode: e.target.value }))}
                  className="mt-1 h-10 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Quốc gia</label>
                <Input
                  value={addressDraft.country}
                  onChange={(e) => setAddressDraft((p) => ({ ...p, country: e.target.value }))}
                  className="mt-1 h-10 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditAddressOpen(false)}
              className="h-9 rounded-lg text-sm"
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAddress}
              className={cn("h-9 rounded-lg text-sm", BRAND_BTN)}
            >
              Lưu địa chỉ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Process Refund Confirmation ── */}
      <Dialog open={isRefundModalOpen} onOpenChange={setIsRefundModalOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 admin-section-title">
              Xác nhận hoàn tiền đơn #{order.orderNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 text-sm text-slate-600">
            <p>Bạn có chắc chắn muốn xử lý hoàn tiền cho đơn hàng này không?</p>
            <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex justify-between">
                <span>Khách hàng:</span>
                <span className="font-semibold text-slate-900">{order.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Số tiền hoàn trả:</span>
                <span className="font-semibold text-emerald-700">{fmtMoney(grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Phương thức hoàn:</span>
                <span className="font-medium text-slate-800">
                  {order.paymentMethod}{" "}
                  {order.paymentCardLast4 ? `(*${order.paymentCardLast4})` : ""}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRefundModalOpen(false)}
              className="h-9 rounded-lg text-sm"
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleProcessRefund}
              disabled={isRefunding}
              className="h-9 rounded-lg bg-rose-600 text-sm text-white hover:bg-rose-700"
            >
              {isRefunding ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Xác nhận hoàn tiền
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Activity & Audit Log Modal ── */}
      <Dialog open={isActivityLogOpen} onOpenChange={setIsActivityLogOpen}>
        <DialogContent className="max-w-2xl rounded-xs p-6 max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-violet-100 text-[#6d3df0]">
                  <History className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-slate-900 admin-section-title">
                    Lịch sử & Nhật ký hoạt động #{order.orderNumber}
                  </DialogTitle>
                  <p className="text-sm text-slate-500">
                    Theo dõi đầy đủ các mốc thời gian, trạng thái thanh toán, kho vận và tương tác
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 pt-2 text-sm">
            <button
              type="button"
              onClick={() => setActivityFilter("all")}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                activityFilter === "all"
                  ? "bg-[#6d3df0] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              Tất cả ({order.timeline.length})
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter("payment")}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                activityFilter === "payment"
                  ? "bg-[#6d3df0] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              Thanh toán ({order.timeline.filter((t) => t.type === "payment" || t.type === "refunded").length})
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter("warehouse")}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                activityFilter === "warehouse"
                  ? "bg-[#6d3df0] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              Kho & Vận chuyển (
              {
                order.timeline.filter(
                  (t) => t.type === "picking" || t.type === "packed" || t.type === "shipped",
                ).length
              }
              )
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter("other")}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                activityFilter === "other"
                  ? "bg-[#6d3df0] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              Khác (
              {
                order.timeline.filter(
                  (t) => t.type === "custom" || t.type === "cancelled" || t.type === "placed",
                ).length
              }
              )
            </button>
          </div>

          {/* Activity list */}
          <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-3 min-h-[240px]">
            {order.timeline
              .filter((step) => {
                if (activityFilter === "payment")
                  return step.type === "payment" || step.type === "refunded";
                if (activityFilter === "warehouse")
                  return step.type === "picking" || step.type === "packed" || step.type === "shipped";
                if (activityFilter === "other")
                  return (
                    step.type === "custom" || step.type === "cancelled" || step.type === "placed"
                  );
                return true;
              })
              .map((step) => {
                const cfg = TIMELINE_ICON[step.type] || TIMELINE_ICON.custom;
                const StepIcon = cfg.Icon;
                return (
                  <div
                    key={step.id}
                    className="group flex items-start gap-3.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 transition-all duration-200 hover:bg-slate-50 hover:shadow-2xs"
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl mt-0.5 transition-all duration-300 group-hover:scale-110",
                        step.completed
                          ? cn(cfg.bg, cfg.color, "shadow-2xs")
                          : step.isCurrent
                            ? "bg-amber-100 text-amber-600 ring-2 ring-amber-300 animate-pulse"
                            : "bg-slate-200 text-slate-400",
                      )}
                    >
                      <StepIcon className="size-4 transition-transform duration-300 group-hover:scale-110" strokeWidth={step.completed ? 2.4 : 2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-950">{step.title}</p>
                          {step.statusBadge && (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none shadow-2xs transition-transform duration-200 group-hover:scale-105",
                                step.statusBadge.className,
                              )}
                            >
                              {step.statusBadge.label}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                          {step.time}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-700 leading-relaxed">
                        {step.description}
                      </p>
                      {step.actor && (
                        <p className="mt-1.5 text-sm text-slate-600 font-semibold flex items-center gap-1">
                          <User className="size-3 text-slate-500" />
                          <span>Thực hiện: {step.actor}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Add custom event log */}
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Plus className="size-3.5 text-[#6d3df0]" />
              <span>Ghi nhận sự kiện hoạt động mới</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={newActivityType}
                onChange={(e) => setNewActivityType(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-[#6d3df0] focus:outline-none"
              >
                <option value="Liên hệ khách hàng">Liên hệ khách hàng</option>
                <option value="Vận chuyển / Shipper">Vận chuyển / Shipper</option>
                <option value="Kiểm tra hàng">Kiểm tra chất lượng hàng</option>
                <option value="Kế toán / Thanh toán">Kế toán / Thanh toán</option>
                <option value="Ghi nhận khác">Ghi nhận khác</option>
              </select>
              <Input
                placeholder="Nhập chi tiết sự kiện / ghi nhận hoạt động..."
                value={newActivityNote}
                onChange={(e) => setNewActivityNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCustomActivity();
                }}
                className="h-9 flex-1 text-sm rounded-lg"
              />
              <Button
                type="button"
                onClick={handleAddCustomActivity}
                className={cn("h-9 rounded-lg text-sm font-medium shrink-0", BRAND_BTN)}
              >
                Ghi nhận
              </Button>
            </div>
          </div>

          <DialogFooter className="mt-3 border-t border-slate-100 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsActivityLogOpen(false)}
              className="h-8 rounded-lg text-sm"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
