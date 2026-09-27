import {
  Boxes,
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  CreditCard,
  Edit3,
  ExternalLink,
  Filter,
  History,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TablePagination } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";
import { adminApi, type Customer, type CustomerSegment, type CustomerOrderSummary } from "@/lib/api";

const SEGMENTS: Array<{ id: CustomerSegment | "all"; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "vip", label: "VIP" },
  { id: "loyal", label: "Thân thiết" },
  { id: "new", label: "Mới" },
];

const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  vip: "Khách VIP",
  loyal: "Thân thiết",
  new: "Khách mới",
};

const SEGMENT_STYLE: Record<CustomerSegment, string> = {
  vip: "bg-foreground text-background font-semibold border-foreground",
  loyal: "bg-secondary text-foreground font-medium border-border",
  new: "bg-secondary/60 text-muted-foreground border-border",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã duyệt",
  cancelled: "Đã hủy",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  awaiting: "Chờ thanh toán",
  paid: "Đã thanh toán",
  refunded: "Đã hoàn tiền",
  unpaid: "Chưa thanh toán",
  failed: "Thất bại",
};

const switchClass =
  "h-6 w-11 border-0 data-[state=checked]:bg-foreground data-[state=unchecked]:bg-border [&>span]:h-5 [&>span]:w-5 data-[state=checked]:[&>span]:translate-x-5";

function formatVnd(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
  return new Intl.NumberFormat("vi-VN").format(n) + "₫";
}

function formatVndFull(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "₫";
}

function formatAddress(a: {
  address_line: string;
  administrative_units: Record<string, string>;
}) {
  const city = a.administrative_units?.["city"];
  const district = a.administrative_units?.["district"];
  return [a.address_line, district, city].filter(Boolean).join(", ");
}

type FilterState = {
  segment: CustomerSegment | "all";
  status: "" | "active" | "blocked";
  spentMin: string;
  spentMax: string;
  dateFrom: string;
  dateTo: string;
  city: string;
  sortBy: string;
};

const emptyFilters: FilterState = {
  segment: "all",
  status: "",
  spentMin: "",
  spentMax: "",
  dateFrom: "",
  dateTo: "",
  city: "",
  sortBy: "created_at_desc",
};

const SORT_OPTIONS = [
  { value: "created_at_desc", label: "Mới đăng ký nhất" },
  { value: "created_at_asc", label: "Đăng ký lâu nhất" },
  { value: "spent_desc", label: "Chi tiêu cao nhất" },
  { value: "spent_asc", label: "Chi tiêu thấp nhất" },
  { value: "name_asc", label: "Tên A→Z" },
  { value: "name_desc", label: "Tên Z→A" },
];

// ─── Customer Order Card Component with Items Pagination ──────────────────────

function CustomerOrderCard({
  order: o,
  copyText,
  onNavigateToOrder,
}: {
  order: CustomerOrderSummary;
  copyText: (key: string, label: string, value: string) => void;
  onNavigateToOrder?: (orderNumber: string) => void;
}) {
  const [itemPage, setItemPage] = useState(1);
  const itemsPerPage = 4;
  const items = o.items ?? [];
  const totalItemPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const pagedItems = useMemo(
    () => items.slice((itemPage - 1) * itemsPerPage, itemPage * itemsPerPage),
    [items, itemPage]
  );

  const isCancelled = o.status === "cancelled";
  const isPaid =
    o.payment_status === "paid" ||
    (o.payment_method === "cod" && (o.status === "confirmed" || o.fulfillment_status === "fulfilled"));
  const isAwaiting = !isCancelled && !isPaid;

  return (
    <div
      className={cn(
        "rounded-md border bg-card transition-all hover:border-foreground/30 shadow-2xs overflow-hidden",
        isCancelled ? "border-border/60 opacity-80" : "border-border"
      )}
    >
      {/* Order Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-secondary/30 p-3.5 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={cn(
              "font-mono text-sm font-bold",
              isCancelled ? "line-through text-muted-foreground" : "text-foreground"
            )}
          >
            #{o.order_number}
          </span>
          <button
            type="button"
            onClick={() => copyText(`order-${o.id}`, "mã đơn", o.order_number)}
            className="text-muted-foreground hover:text-foreground"
            title="Copy mã đơn"
          >
            <Copy className="size-3" />
          </button>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {new Date(o.placed_at).toLocaleString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Payment Status Badge */}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
              isPaid
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                : isCancelled
                ? "bg-secondary text-muted-foreground border border-border"
                : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30"
            )}
          >
            {PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status}
          </span>

          {/* Order Status Badge */}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium border",
              isCancelled
                ? "bg-destructive/10 text-destructive border-destructive/20 font-semibold"
                : o.status === "confirmed"
                ? "bg-secondary text-foreground border-border"
                : "bg-secondary text-muted-foreground border-border"
            )}
          >
            {ORDER_STATUS_LABEL[o.status] ?? o.status}
          </span>

          {onNavigateToOrder && (
            <button
              type="button"
              onClick={() => onNavigateToOrder(o.order_number)}
              className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-[11px] text-foreground hover:bg-secondary transition-colors ml-1"
              title="Xem trong Quản lý Đơn hàng"
            >
              <span>Xem đơn</span>
              <ExternalLink className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Order Status Notice Banner */}
      {isCancelled ? (
        <div className="flex items-center gap-1.5 bg-destructive/5 border-b border-border/50 px-3.5 py-1.5 text-[11px] text-destructive">
          <ShieldAlert className="size-3.5 shrink-0" />
          <span>Đơn đã hủy · Không phát sinh tiền thực tế (không tính vào tổng chi tiêu)</span>
        </div>
      ) : isAwaiting ? (
        <div className="flex items-center gap-1.5 bg-amber-500/10 border-b border-border/50 px-3.5 py-1.5 text-[11px] text-amber-900 dark:text-amber-200">
          <Clock className="size-3.5 shrink-0" />
          <span>Chờ khách thanh toán chuyển khoản · Chưa thu tiền (chưa cộng vào tổng chi tiêu)</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border-b border-border/50 px-3.5 py-1.5 text-[11px] text-emerald-900 dark:text-emerald-200">
          <Check className="size-3.5 shrink-0" />
          <span>Đã thanh toán thành công · Đã ghi nhận vào tổng chi tiêu thực tế</span>
        </div>
      )}

      {/* Order Items List with Pagination */}
      <div className="divide-y divide-border/60 p-3.5">
        {items.length > 0 ? (
          pagedItems.map((it) => (
            <div key={it.id ?? it.sku} className="flex items-center gap-3.5 py-2.5 first:pt-0 last:pb-0">
              {it.image_url ? (
                <img
                  src={it.image_url}
                  alt={it.product_name}
                  className="size-12 rounded object-cover bg-secondary border border-border shrink-0"
                />
              ) : (
                <div className="flex size-12 items-center justify-center rounded bg-secondary text-muted-foreground border border-border shrink-0">
                  <Package className="size-5 stroke-[1.2]" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-medium text-xs truncate",
                    isCancelled ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {it.product_name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-mono">
                  <span className="text-foreground/80 font-medium">SKU: {it.sku}</span>
                  {it.size_label && (
                    <span className="rounded bg-secondary px-1.5 py-0.2">
                      Size {it.size_label}
                    </span>
                  )}
                  {it.color_label && (
                    <span className="rounded bg-secondary px-1.5 py-0.2">
                      {it.color_label}
                    </span>
                  )}
                  <span>SL: {it.qty}</span>
                </div>
              </div>

              <div className="text-right">
                <p
                  className={cn(
                    "font-semibold text-xs font-mono",
                    isCancelled ? "line-through text-muted-foreground" : "text-foreground"
                  )}
                >
                  {formatVndFull(it.line_total_vnd)}
                </p>
                {it.qty > 1 && (
                  <p className="text-[10px] text-muted-foreground">
                    {it.qty} × {formatVnd(it.unit_price_vnd)}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground py-2 italic">
            Chi tiết sản phẩm đang được đồng bộ...
          </p>
        )}
      </div>

      {/* Mini Items Pagination Footer if more than itemsPerPage items */}
      {items.length > itemsPerPage && (
        <div className="flex items-center justify-between border-t border-border/60 bg-secondary/20 px-3.5 py-1.5 text-[11px] text-muted-foreground">
          <span>
            Sản phẩm {(itemPage - 1) * itemsPerPage + 1}–{Math.min(itemPage * itemsPerPage, items.length)} / {items.length} món
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={itemPage <= 1}
              onClick={() => setItemPage((p) => Math.max(1, p - 1))}
              className="rounded px-2 py-0.5 text-[11px] border border-border bg-background disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
            >
              ‹ Trước
            </button>
            <span className="font-mono text-[10px] text-foreground">
              {itemPage}/{totalItemPages}
            </span>
            <button
              type="button"
              disabled={itemPage >= totalItemPages}
              onClick={() => setItemPage((p) => Math.min(totalItemPages, p + 1))}
              className="rounded px-2 py-0.5 text-[11px] border border-border bg-background disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
            >
              Sau ›
            </button>
          </div>
        </div>
      )}

      {/* Order Financial Breakdown Footer */}
      <div className="flex flex-wrap items-center justify-between border-t border-border/60 bg-secondary/15 px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
          <span>
            Thanh toán: <b className="text-foreground font-medium uppercase">{o.payment_method}</b>
          </span>
          {o.discount_code && (
            <span className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.2 text-[11px] font-mono text-foreground">
              <Tag className="size-3" />
              {o.discount_code}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {isCancelled ? "Giá trị đơn (đã hủy):" : "Tổng tiền đơn:"}
          </span>
          <span
            className={cn(
              "font-serif text-base font-bold",
              isCancelled ? "line-through text-muted-foreground" : "text-foreground"
            )}
          >
            {formatVndFull(o.grand_total_vnd)}
          </span>
          {isCancelled && (
            <span className="text-xs text-destructive font-mono font-medium">(0₫ thu)</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CustomersManager({
  onNavigateToOrder,
}: {
  onNavigateToOrder?: (orderNumber: string) => void;
} = {}) {
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [segmentDist, setSegmentDist] = useState<Record<string, number>>({});
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(emptyFilters);
  const [loading, setLoading] = useState(true);

  // Detail View State
  const [activeTab, setActiveTab] = useState<"list" | "detail">("list");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [internalNoteDraft, setInternalNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [orderFilterTab, setOrderFilterTab] = useState<"all" | "paid" | "awaiting" | "cancelled">("all");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(5);

  const orderCounts = useMemo(() => {
    if (!detail?.orders) return { all: 0, paid: 0, awaiting: 0, cancelled: 0 };
    let paid = 0;
    let awaiting = 0;
    let cancelled = 0;
    for (const o of detail.orders) {
      if (o.status === "cancelled") {
        cancelled++;
      } else if (
        o.payment_status === "paid" ||
        (o.payment_method === "cod" && (o.status === "confirmed" || o.fulfillment_status === "fulfilled"))
      ) {
        paid++;
      } else {
        awaiting++;
      }
    }
    return { all: detail.orders.length, paid, awaiting, cancelled };
  }, [detail?.orders]);

  const displayedOrders = useMemo(() => {
    if (!detail?.orders) return [];
    if (orderFilterTab === "all") return detail.orders;
    if (orderFilterTab === "paid") {
      return detail.orders.filter(
        (o) =>
          o.status !== "cancelled" &&
          (o.payment_status === "paid" ||
            (o.payment_method === "cod" && (o.status === "confirmed" || o.fulfillment_status === "fulfilled")))
      );
    }
    if (orderFilterTab === "awaiting") {
      return detail.orders.filter(
        (o) =>
          o.status !== "cancelled" &&
          !(
            o.payment_status === "paid" ||
            (o.payment_method === "cod" && (o.status === "confirmed" || o.fulfillment_status === "fulfilled"))
          )
      );
    }
    if (orderFilterTab === "cancelled") {
      return detail.orders.filter((o) => o.status === "cancelled");
    }
    return detail.orders;
  }, [detail?.orders, orderFilterTab]);

  // Reset order pagination when filter or customer changes
  useEffect(() => {
    setOrderPage(1);
  }, [orderFilterTab, selectedCustomerId]);

  const totalOrderPages = Math.max(1, Math.ceil(displayedOrders.length / orderPageSize));
  const pagedOrders = useMemo(() => {
    const start = (orderPage - 1) * orderPageSize;
    return displayedOrders.slice(start, start + orderPageSize);
  }, [displayedOrders, orderPage, orderPageSize]);

  const copyText = (key: string, label: string, value: string) => {
    void navigator.clipboard.writeText(value).then(
      () => {
        setCopiedKey(key);
        toast.success(`Đã sao chép ${label}`);
        setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
      },
      () => toast.error("Không thể sao chép"),
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.customers({
        ...(filters.segment !== "all" ? { segment: filters.segment } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(filters.spentMin ? { spent_min: Number(filters.spentMin) } : {}),
        ...(filters.spentMax ? { spent_max: Number(filters.spentMax) } : {}),
        ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
        ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
        ...(filters.city.trim() ? { city: filters.city.trim() } : {}),
        ...(filters.sortBy !== "created_at_desc" ? { sort_by: filters.sortBy } : {}),
        page,
        limit,
      });
      setItems(res.items);
      setTotal(res.total ?? res.items.length);
      setSegmentDist(res.segment_distribution ?? {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được khách hàng");
    } finally {
      setLoading(false);
    }
  }, [filters, query, page, limit]);

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    setPage(1);
  }, [filters, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const globalMetrics = useMemo(() => ({
    total,
    vip: segmentDist["vip"] ?? 0,
    loyal: segmentDist["loyal"] ?? 0,
    newCount: segmentDist["new"] ?? 0,
  }), [total, segmentDist]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.status) n++;
    if (filters.spentMin || filters.spentMax) n++;
    if (filters.dateFrom || filters.dateTo) n++;
    if (filters.city.trim()) n++;
    if (filters.sortBy !== "created_at_desc") n++;
    return n;
  }, [filters]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (filters.status) {
      chips.push({
        key: "status",
        label: `Trạng thái: ${filters.status === "active" ? "Đang hoạt động" : "Đã khóa"}`,
        clear: () => setFilters((f) => ({ ...f, status: "" })),
      });
    }
    if (filters.spentMin || filters.spentMax) {
      const from = filters.spentMin ? formatVnd(Number(filters.spentMin)) : "…";
      const to = filters.spentMax ? formatVnd(Number(filters.spentMax)) : "…";
      chips.push({
        key: "spent",
        label: `Đã chi: ${from} – ${to}`,
        clear: () => setFilters((f) => ({ ...f, spentMin: "", spentMax: "" })),
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      chips.push({
        key: "date",
        label: `Đăng ký: ${filters.dateFrom || "…"} – ${filters.dateTo || "…"}`,
        clear: () => setFilters((f) => ({ ...f, dateFrom: "", dateTo: "" })),
      });
    }
    if (filters.city.trim()) {
      chips.push({
        key: "city",
        label: `Thành phố: ${filters.city}`,
        clear: () => setFilters((f) => ({ ...f, city: "" })),
      });
    }
    if (filters.sortBy !== "created_at_desc") {
      const label = SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label ?? filters.sortBy;
      chips.push({
        key: "sort",
        label: `Sắp xếp: ${label}`,
        clear: () => setFilters((f) => ({ ...f, sortBy: "created_at_desc" })),
      });
    }
    return chips;
  }, [filters]);

  function applyDraft() {
    setFilters(draftFilters);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setDraftFilters(emptyFilters);
    setQueryInput("");
    setQuery("");
  }

  async function openDetail(c: Customer) {
    setSelectedCustomerId(c.id);
    setActiveTab("detail");
    setDetailLoading(true);
    setDetail(c);
    setInternalNoteDraft(c.internal_note || "");
    try {
      const full = await adminApi.customer(c.id);
      setDetail(full);
      setInternalNoteDraft(full.internal_note || "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được hồ sơ khách hàng");
    } finally {
      setDetailLoading(false);
    }
  }

  const handleBackToList = () => {
    setActiveTab("list");
  };

  async function toggleStatus(c: Customer, active: boolean) {
    const next = active ? "active" : "blocked";
    setItems((list) => list.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    setDetail((d) => (d && d.id === c.id ? { ...d, status: next } : d));
    try {
      await adminApi.updateCustomer(c.id, { status: next });
      toast.success(active ? "Đã mở hoạt động tài khoản" : "Đã khóa tài khoản khách hàng");
    } catch (e) {
      setItems((list) => list.map((x) => (x.id === c.id ? { ...x, status: c.status } : x)));
      setDetail((d) => (d && d.id === c.id ? { ...d, status: c.status } : d));
      toast.error(e instanceof Error ? e.message : "Không đổi được trạng thái");
    }
  }

  async function saveInternalNote() {
    if (!detail) return;
    setSavingNote(true);
    try {
      await adminApi.updateCustomer(detail.id, { internal_note: internalNoteDraft });
      setDetail((prev) => (prev ? { ...prev, internal_note: internalNoteDraft } : null));
      setItems((list) =>
        list.map((x) => (x.id === detail.id ? { ...x, internal_note: internalNoteDraft } : x)),
      );
      toast.success("Đã lưu ghi chú chăm sóc khách hàng");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được ghi chú");
    } finally {
      setSavingNote(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6 pb-12">
      {/* Top Bar Header & View Switcher */}
      <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label text-primary">Quan hệ khách hàng · CRM Atelier</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hồ sơ 360°, thói quen mua sắm, giá trị vòng đời và quản lý danh sách khách hàng ÉLANE.
          </p>
        </div>

        {/* View Switcher Tabs (Consistent border-b tab strip) */}
        <div className="flex items-center gap-1 border-b border-border pb-px">
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px",
              activeTab === "list"
                ? "border-foreground text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="size-3.5" />
            <span>Danh sách khách hàng</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px] leading-none inline-flex items-center justify-center transition-colors",
                activeTab === "list"
                  ? "bg-foreground text-background font-bold shadow-xs"
                  : "bg-secondary text-muted-foreground border border-border/60",
              )}
            >
              {total}
            </span>
          </button>

          {selectedCustomerId && detail && (
            <button
              type="button"
              onClick={() => setActiveTab("detail")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px",
                activeTab === "detail"
                  ? "border-foreground text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <UserCheck className="size-3.5" />
              <span>Hồ sơ: {detail.full_name}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCustomerId(null);
                  setActiveTab("list");
                }}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-destructive transition-colors"
                title="Đóng hồ sơ"
              >
                <X className="size-3" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── DETAIL VIEW (CUSTOMER 360 CRM PROFILE) ─────────────────────────────────── */}
      {activeTab === "detail" && detail ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Back & Breadcrumb Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToList}
                className="h-8 gap-1 text-xs hover:bg-secondary transition-colors"
              >
                <ChevronLeft className="size-3.5" /> Quay lại danh sách
              </Button>
              <div className="h-4 w-px bg-border" />
              <div>
                <span className="text-xs text-muted-foreground">Mã khách hàng: </span>
                <span className="font-mono text-xs font-semibold text-foreground">
                  {detail.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3.5 py-1.5 shadow-2xs">
                <span className="text-xs font-medium text-muted-foreground">Trạng thái tài khoản:</span>
                <Switch
                  checked={detail.status === "active"}
                  onCheckedChange={(on) => void toggleStatus(detail, on)}
                  aria-label="Trạng thái khách hàng"
                  className={switchClass}
                />
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider",
                  detail.status === "active" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30" : "bg-destructive/10 text-destructive border border-destructive/30"
                )}>
                  {detail.status === "active" ? "Hoạt động" : "Đã khóa"}
                </span>
              </div>
            </div>
          </div>

          {/* Hero Banner: Customer Overview */}
          <div className="rounded-md border border-border bg-card p-6 shadow-2xs">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-foreground text-background font-serif text-2xl font-bold shadow-sm">
                  {detail.full_name ? detail.full_name.charAt(0).toUpperCase() : "K"}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="font-serif text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
                      {detail.full_name}
                    </h1>
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-mono font-bold tracking-wide uppercase shadow-2xs",
                      detail.segment === "vip"
                        ? "bg-foreground text-background"
                        : "bg-secondary text-foreground border border-border"
                    )}>
                      {SEGMENT_LABEL[detail.segment] ?? detail.segment}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                    <Calendar className="size-3.5" />
                    Đăng ký ngày: {new Date(detail.created_at).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Quick Communication Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {detail.phone && (
                  <>
                    <a
                      href={`tel:${detail.phone}`}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-secondary transition-colors"
                    >
                      <Phone className="size-3.5 text-muted-foreground" />
                      <span>{detail.phone}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => copyText("phone", "số điện thoại", detail.phone!)}
                      className="h-8 px-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Copy SĐT"
                    >
                      {copiedKey === "phone" ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    </button>
                  </>
                )}
                {detail.email && (
                  <>
                    <a
                      href={`mailto:${detail.email}`}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-secondary transition-colors"
                    >
                      <Mail className="size-3.5 text-muted-foreground" />
                      <span>{detail.email}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => copyText("email", "email", detail.email!)}
                      className="h-8 px-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="Copy Email"
                    >
                      {copiedKey === "email" ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 4 RFM Behavior KPI Metrics Cards */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* KPI 1: Total Spent */}
            <div className="rounded-md border border-border bg-card p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="section-label">Tổng chi tiêu thực tế (LTV)</p>
                <CreditCard className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-3 font-serif text-3xl font-normal text-foreground">
                {formatVndFull(detail.analytics?.total_spent_vnd ?? detail.total_spent_vnd ?? 0)}
              </p>
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                <p className="text-foreground/90 font-medium">
                  {detail.analytics?.completed_orders ?? 0} đơn đã thanh toán thành công
                </p>
                {((detail.analytics?.pending_orders ?? 0) > 0 || (detail.analytics?.cancelled_orders ?? 0) > 0) && (
                  <p className="text-[11px] text-muted-foreground">
                    Không tính {(detail.analytics?.pending_orders ?? 0) > 0 ? `${detail.analytics?.pending_orders} đơn chờ TT` : ""}
                    {(detail.analytics?.pending_orders ?? 0) > 0 && (detail.analytics?.cancelled_orders ?? 0) > 0 ? " & " : ""}
                    {(detail.analytics?.cancelled_orders ?? 0) > 0 ? `${detail.analytics?.cancelled_orders} đơn đã hủy` : ""}
                  </p>
                )}
              </div>
            </div>

            {/* KPI 2: Order Count */}
            <div className="rounded-md border border-border bg-card p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="section-label">Đơn hàng (Thành công / Tổng)</p>
                <ShoppingBag className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-3 font-serif text-3xl font-normal text-foreground">
                {detail.analytics?.completed_orders ?? 0}{" "}
                <span className="text-lg text-muted-foreground font-sans">
                  / {detail.analytics?.total_orders ?? detail.orders?.length ?? 0}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {detail.analytics?.completed_orders ?? 0} thành công · {detail.analytics?.pending_orders ?? 0} chờ TT · {detail.analytics?.cancelled_orders ?? 0} hủy
              </p>
            </div>

            {/* KPI 3: Average Order Value */}
            <div className="rounded-md border border-border bg-card p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="section-label">Giá trị đơn TB (AOV)</p>
                <TrendingUp className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-3 font-serif text-3xl font-normal text-foreground">
                {formatVndFull(detail.analytics?.aov_vnd ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Mức chi trung bình mỗi đơn
              </p>
            </div>

            {/* KPI 4: Recency */}
            <div className="rounded-md border border-border bg-card p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="section-label">Lần mua gần nhất</p>
                <Clock className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-3 font-serif text-3xl font-normal text-foreground">
                {detail.analytics?.days_since_last_order !== null && detail.analytics?.days_since_last_order !== undefined
                  ? `${detail.analytics.days_since_last_order} ngày`
                  : "Chưa mua"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {detail.analytics?.last_order_at
                  ? new Date(detail.analytics.last_order_at).toLocaleDateString("vi-VN")
                  : "Chưa phát sinh giao dịch"}
              </p>
            </div>
          </section>

          {/* Main 2-Column CRM Dashboard Layout */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* LEFT COLUMN: Customer Info, Staff Notes & Preferences (5 cols) */}
            <div className="space-y-6 lg:col-span-5">
              {/* Card 1: Internal Staff Note (CRM Sticky Note) */}
              <div className="rounded-md border border-border bg-card p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <Edit3 className="size-4 text-foreground" />
                    <p className="section-label text-foreground">Ghi chú chăm sóc khách hàng</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                    Nội bộ shop
                  </span>
                </div>
                <div className="mt-3.5 space-y-3">
                  <textarea
                    rows={4}
                    value={internalNoteDraft}
                    onChange={(e) => setInternalNoteDraft(e.target.value)}
                    placeholder="Ghi chú sở thích, thói quen thời trang, lưu ý khi gọi tư vấn hoặc đóng gói hàng cho khách này…"
                    className="w-full resize-none rounded-md border border-border/80 bg-secondary/30 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-colors"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Chỉ nhân viên và quản lý nhìn thấy
                    </p>
                    <Button
                      size="sm"
                      onClick={saveInternalNote}
                      disabled={savingNote}
                      className="h-8 gap-1.5 text-xs bg-foreground text-background hover:bg-foreground/90 font-medium"
                    >
                      <Save className="size-3.5" />
                      {savingNote ? "Đang lưu…" : "Lưu ghi chú"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Card 2: Fashion Profile & Size Preferences */}
              <div className="rounded-md border border-border bg-card p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-foreground" />
                    <p className="section-label text-foreground">Hồ sơ thời trang & Sở thích Size</p>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  {/* Size Distribution */}
                  <div>
                    <span className="text-xs font-medium text-muted-foreground block mb-2">
                      Tần suất chọn Size:
                    </span>
                    {detail.analytics?.top_sizes && detail.analytics.top_sizes.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {detail.analytics.top_sizes.map((s) => (
                          <div
                            key={s.size}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs font-mono"
                          >
                            <span className="font-bold text-foreground">Size {s.size}</span>
                            <span className="rounded-full bg-foreground text-background px-1.5 py-0.2 text-[10px] font-bold">
                              {s.count} SP
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Chưa có dữ liệu lịch sử size đã mua.
                      </p>
                    )}
                  </div>

                  {/* Top Products Purchased */}
                  {detail.analytics?.top_products && detail.analytics.top_products.length > 0 && (
                    <div className="border-t border-border/60 pt-3">
                      <span className="text-xs font-medium text-muted-foreground block mb-2.5">
                        Sản phẩm đã mua:
                      </span>
                      <div className="space-y-2.5">
                        {detail.analytics.top_products.slice(0, 4).map((p, idx) => (
                          <div key={idx} className="flex items-center gap-3 rounded border border-border/60 bg-secondary/20 p-2 text-xs">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="size-10 rounded object-cover bg-secondary border border-border shrink-0"
                              />
                            ) : (
                              <div className="flex size-10 items-center justify-center rounded bg-secondary text-muted-foreground border border-border shrink-0">
                                <Package className="size-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground truncate">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Đã mua {p.count} lần · {formatVnd(p.total_vnd)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Saved Delivery Addresses */}
              <div className="rounded-md border border-border bg-card p-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-foreground" />
                    <p className="section-label text-foreground">Sổ địa chỉ giao hàng</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/60">
                    {detail.addresses?.length ?? 0} địa chỉ
                  </span>
                </div>
                <div className="mt-4">
                  {(!detail.addresses || detail.addresses.length === 0) ? (
                    <p className="text-xs text-muted-foreground italic py-2">
                      Khách hàng chưa lưu địa chỉ trong sổ địa chỉ.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {detail.addresses.map((a) => (
                        <div
                          key={a.id}
                          className={cn(
                            "rounded-md border p-3 text-xs transition-colors",
                            a.is_default
                              ? "border-foreground/40 bg-secondary/30"
                              : "border-border bg-card"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-foreground">{a.recipient_name}</p>
                            {a.is_default && (
                              <span className="rounded-full bg-foreground text-background px-2 py-0.2 text-[10px] font-mono font-bold">
                                Mặc định
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-mono text-muted-foreground">{a.phone}</p>
                          <p className="mt-1.5 text-foreground leading-relaxed">
                            {formatAddress(a)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Complete Order History with Items & Breakdown (7 cols) */}
            <div className="space-y-6 lg:col-span-7">
              <div className="rounded-md border border-border bg-card p-5 shadow-2xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-foreground" />
                    <p className="section-label text-foreground">
                      Lịch sử đơn hàng & Chi tiết sản phẩm đã đặt
                    </p>
                  </div>

                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-1 rounded-md border border-border/70 bg-secondary/30 p-0.5 text-xs flex-wrap">
                    <button
                      type="button"
                      onClick={() => setOrderFilterTab("all")}
                      className={cn(
                        "rounded px-2.5 py-1 transition-colors text-[11px]",
                        orderFilterTab === "all"
                          ? "bg-foreground text-background font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Tất cả ({orderCounts.all})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderFilterTab("paid")}
                      className={cn(
                        "rounded px-2.5 py-1 transition-colors text-[11px]",
                        orderFilterTab === "paid"
                          ? "bg-foreground text-background font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Đã thanh toán ({orderCounts.paid})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderFilterTab("awaiting")}
                      className={cn(
                        "rounded px-2.5 py-1 transition-colors text-[11px]",
                        orderFilterTab === "awaiting"
                          ? "bg-foreground text-background font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Chờ thanh toán ({orderCounts.awaiting})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderFilterTab("cancelled")}
                      className={cn(
                        "rounded px-2.5 py-1 transition-colors text-[11px]",
                        orderFilterTab === "cancelled"
                          ? "bg-foreground text-background font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Đã hủy ({orderCounts.cancelled})
                    </button>
                  </div>
                </div>

                {(!detail.orders || detail.orders.length === 0) ? (
                  <div className="py-16 text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      <ShoppingBag className="size-6 stroke-1" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">Chưa có đơn hàng nào</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Khách hàng chưa thực hiện đơn đặt hàng nào trong hệ thống.
                    </p>
                  </div>
                ) : displayedOrders.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    Không có đơn hàng nào ở trạng thái này.
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {pagedOrders.map((o) => (
                      <CustomerOrderCard
                        key={o.id}
                        order={o}
                        copyText={copyText}
                        onNavigateToOrder={onNavigateToOrder}
                      />
                    ))}

                    {/* Pagination for Customer Orders */}
                    {displayedOrders.length > 0 && (
                      <TablePagination
                        currentPage={orderPage}
                        totalPages={totalOrderPages}
                        totalItems={displayedOrders.length}
                        pageSize={orderPageSize}
                        pageSizeOptions={[3, 5, 10, 20]}
                        onPageChange={setOrderPage}
                        onPageSizeChange={(newSize) => {
                          setOrderPageSize(newSize);
                          setOrderPage(1);
                        }}
                        itemName="đơn hàng"
                        compact
                        className="rounded-md border border-border"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── LIST VIEW ──────────────────────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Top 4 Metrics Cards */}
          <section className="grid gap-4 sm:grid-cols-4">
            <div
              onClick={() => setFilters((f) => ({ ...f, segment: "all" }))}
              className={cn(
                "rounded-md border p-5 bg-card cursor-pointer transition-all",
                filters.segment === "all"
                  ? "ring-2 ring-foreground/80 border-foreground/80 bg-foreground/5 shadow-sm"
                  : "border-border hover:border-border/80"
              )}
            >
              <p className="section-label">Tổng khách hàng</p>
              <p className="mt-3 font-serif text-3xl font-normal text-foreground">{total}</p>
              <p className="mt-1 text-xs text-muted-foreground">Trong hệ thống ÉLANE</p>
            </div>

            <div
              onClick={() => setFilters((f) => ({ ...f, segment: "vip" }))}
              className={cn(
                "rounded-md border p-5 bg-card cursor-pointer transition-all",
                filters.segment === "vip"
                  ? "ring-2 ring-foreground/80 border-foreground/80 bg-foreground/5 shadow-sm"
                  : "border-border hover:border-border/80"
              )}
            >
              <div className="flex items-center justify-between">
                <p className="section-label">Khách hàng VIP</p>
                <Sparkles className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-3 font-serif text-3xl font-normal text-foreground">
                {segmentDist["vip"] ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Chi tiêu tích lũy &gt; 50 triệu</p>
            </div>

            <div
              onClick={() => setFilters((f) => ({ ...f, segment: "loyal" }))}
              className={cn(
                "rounded-md border p-5 bg-card cursor-pointer transition-all",
                filters.segment === "loyal"
                  ? "ring-2 ring-foreground/80 border-foreground/80 bg-foreground/5 shadow-sm"
                  : "border-border hover:border-border/80"
              )}
            >
              <div className="flex items-center justify-between">
                <p className="section-label">Khách thân thiết</p>
                <Users className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-3 font-serif text-3xl font-normal text-foreground">
                {segmentDist["loyal"] ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Chi tiêu từ 15 – 50 triệu</p>
            </div>

            <div
              onClick={() => setFilters((f) => ({ ...f, segment: "new" }))}
              className={cn(
                "rounded-md border p-5 bg-card cursor-pointer transition-all",
                filters.segment === "new"
                  ? "ring-2 ring-foreground/80 border-foreground/80 bg-foreground/5 shadow-sm"
                  : "border-border hover:border-border/80"
              )}
            >
              <p className="section-label">Khách hàng mới</p>
              <p className="mt-3 font-serif text-3xl font-normal text-foreground">
                {segmentDist["new"] ?? 0}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Mới đăng ký &lt; 15 triệu</p>
            </div>
          </section>

          {/* Table Container */}
          <section className="overflow-hidden rounded-md border border-border bg-card">
            {/* Filter and Search Bar */}
            <div className="border-b border-border bg-card/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                {/* Segment Tabs (Monochrome Minimalist Style) */}
                <div className="flex shrink-0 gap-0.5 rounded-md border border-border/70 bg-[#f7f4ef] p-0.5 overflow-x-auto">
                  {SEGMENTS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setFilters((f) => ({ ...f, segment: t.id }));
                        setDraftFilters((f) => ({ ...f, segment: t.id }));
                      }}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
                        filters.segment === t.id
                          ? "bg-foreground text-background shadow-xs font-semibold"
                          : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                      )}
                    >
                      <span>{t.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 font-mono text-[10px] leading-none inline-flex items-center justify-center min-w-4 h-4 transition-all",
                          filters.segment === t.id
                            ? "bg-white text-stone-950 font-bold shadow-xs"
                            : "bg-secondary text-muted-foreground border border-border/70",
                        )}
                      >
                        {t.id === "all" ? total : segmentDist[t.id] ?? 0}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Instant Search Input */}
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    className="h-9 border-border/70 bg-[#f7f4ef] pl-9 pr-9 text-xs"
                    placeholder="Tìm theo tên khách, số điện thoại, email, địa chỉ…"
                  />
                  {queryInput && (
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => setQueryInput("")}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Advanced Filter Popover */}
                <div className="flex shrink-0 items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-9 gap-1.5 border-border/70 bg-[#f7f4ef] text-xs",
                          activeFilterCount > 0 && "border-foreground bg-secondary font-semibold",
                        )}
                      >
                        <SlidersHorizontal className="size-3.5" />
                        <span>Bộ lọc</span>
                        {activeFilterCount > 0 && (
                          <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background font-mono">
                            {activeFilterCount}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[340px] p-0 shadow-xl border-border">
                      <div className="border-b border-border px-4 py-3">
                        <p className="text-sm font-semibold">Bộ lọc nâng cao</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Kết hợp tiêu chí tìm kiếm tệp khách hàng mục tiêu.
                        </p>
                      </div>
                      <div className="space-y-4 p-4 text-xs">
                        {/* Status */}
                        <div className="space-y-1.5">
                          <span className="font-medium">Trạng thái tài khoản</span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { v: "", l: "Tất cả" },
                              { v: "active", l: "Hoạt động" },
                              { v: "blocked", l: "Đã khóa" },
                            ].map(({ v, l }) => (
                              <button
                                key={v || "all"}
                                type="button"
                                onClick={() => setDraftFilters((f) => ({ ...f, status: v as FilterState["status"] }))}
                                className={cn(
                                  "rounded-md border px-2 py-1.5 text-xs transition-colors",
                                  draftFilters.status === v
                                    ? "border-foreground bg-foreground text-background font-medium"
                                    : "border-border bg-[#f7f4ef] text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Spent Range */}
                        <div className="space-y-1.5">
                          <span className="font-medium">Mức chi tiêu (₫)</span>
                          <div className="flex gap-2">
                            <Input
                              inputMode="numeric"
                              placeholder="Từ"
                              value={draftFilters.spentMin}
                              onChange={(e) => setDraftFilters((f) => ({ ...f, spentMin: e.target.value.replace(/[^\d]/g, "") }))}
                              className="h-8 text-xs bg-[#f7f4ef]"
                            />
                            <Input
                              inputMode="numeric"
                              placeholder="Đến"
                              value={draftFilters.spentMax}
                              onChange={(e) => setDraftFilters((f) => ({ ...f, spentMax: e.target.value.replace(/[^\d]/g, "") }))}
                              className="h-8 text-xs bg-[#f7f4ef]"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {[
                              { l: "< 5tr", min: "", max: "5000000" },
                              { l: "5–15tr", min: "5000000", max: "15000000" },
                              { l: "15–50tr", min: "15000000", max: "50000000" },
                              { l: "> 50tr", min: "50000000", max: "" },
                            ].map((p) => (
                              <button
                                key={p.l}
                                type="button"
                                onClick={() => setDraftFilters((f) => ({ ...f, spentMin: p.min, spentMax: p.max }))}
                                className={cn(
                                  "rounded border px-2 py-1 text-[11px] transition-colors",
                                  draftFilters.spentMin === p.min && draftFilters.spentMax === p.max
                                    ? "border-foreground bg-foreground text-background font-medium"
                                    : "border-border bg-[#f7f4ef] text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {p.l}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* City / Province */}
                        <div className="space-y-1.5">
                          <span className="font-medium">Tỉnh / Thành phố</span>
                          <Input
                            placeholder="VD: Hà Nội, TP.HCM, Bắc Giang…"
                            value={draftFilters.city}
                            onChange={(e) => setDraftFilters((f) => ({ ...f, city: e.target.value }))}
                            className="h-8 text-xs bg-[#f7f4ef]"
                          />
                        </div>

                        {/* Sort */}
                        <div className="space-y-1.5">
                          <span className="font-medium">Sắp xếp theo</span>
                          <select
                            className="h-8 w-full rounded-md border border-input bg-[#f7f4ef] px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
                            value={draftFilters.sortBy}
                            onChange={(e) => setDraftFilters((f) => ({ ...f, sortBy: e.target.value }))}
                          >
                            {SORT_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Filter Actions */}
                      <div className="flex justify-between border-t border-border px-4 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const reset = { ...emptyFilters, segment: filters.segment };
                            setDraftFilters(reset);
                            setFilters(reset);
                          }}
                          className="text-xs"
                        >
                          Xóa bộ lọc
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={applyDraft}
                          className="text-xs bg-foreground text-background hover:bg-foreground/90 font-medium"
                        >
                          Áp dụng lọc
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void load()}
                    className="size-9"
                    title="Làm mới danh sách"
                  >
                    <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {/* Active Filter Chips */}
              {activeFilterChips.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.clear}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-[#f7f4ef] px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-foreground"
                    >
                      {chip.label}
                      <X className="size-3 opacity-60" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-[11px] font-medium text-foreground underline underline-offset-4 hover:opacity-80"
                  >
                    Xóa tất cả bộ lọc
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-secondary/55">
                  <tr>
                    {["Khách hàng", "Phân khúc", "Tổng chi tiêu", "Liên hệ", "Khu vực", "Ngày đăng ký", "Trạng thái", "Thao tác"].map((c) => (
                      <th
                        key={c}
                        className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground text-xs">
                        Đang đồng bộ dữ liệu khách hàng…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <div className="grid place-items-center gap-2">
                          <Filter className="size-8 text-muted-foreground/40" />
                          <p className="text-sm font-medium">Không tìm thấy khách hàng phù hợp</p>
                          <p className="text-xs text-muted-foreground">Thử tìm kiếm với từ khóa khác hoặc bỏ bớt tiêu chí lọc</p>
                          <Button variant="outline" size="sm" onClick={resetFilters} className="mt-2 text-xs">
                            Bỏ lọc
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((c) => (
                      <tr
                        key={c.id}
                        className="cursor-pointer border-t border-border transition-colors hover:bg-secondary/35 group"
                        onClick={() => void openDetail(c)}
                      >
                        {/* Customer Name & Avatar */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground font-serif font-bold text-xs border border-border">
                              {c.full_name ? c.full_name.charAt(0).toUpperCase() : "K"}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground group-hover:underline truncate">
                                {c.full_name}
                              </p>
                              {c.internal_note ? (
                                <p className="text-[11px] text-muted-foreground truncate max-w-[200px]" title={c.internal_note}>
                                  📝 {c.internal_note}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        {/* Segment Badge */}
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-mono tracking-wide uppercase",
                              c.segment === "vip"
                                ? "bg-foreground text-background font-bold shadow-2xs"
                                : "bg-secondary text-foreground font-medium border border-border/80"
                            )}
                          >
                            {SEGMENT_LABEL[c.segment] ?? c.segment}
                          </span>
                        </td>

                        {/* Total Spent */}
                        <td className="px-4 py-3.5 font-semibold text-foreground font-serif text-sm tabular-nums">
                          {formatVndFull(c.total_spent_vnd ?? 0)}
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          <div className="font-mono text-foreground">{c.phone || "—"}</div>
                          {c.email && <div className="truncate max-w-[160px] text-[11px] text-muted-foreground">{c.email}</div>}
                        </td>

                        {/* City / Province */}
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {c.city || "—"}
                        </td>

                        {/* Registration Date */}
                        <td className="px-4 py-3.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString("vi-VN")}
                        </td>

                        {/* Status Switch */}
                        <td
                          className="px-4 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={c.status === "active"}
                              onCheckedChange={(on) => void toggleStatus(c, on)}
                              aria-label={`Trạng thái ${c.full_name}`}
                              className={switchClass}
                            />
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-mono font-medium",
                              c.status === "active" ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10" : "text-destructive bg-destructive/10"
                            )}>
                              {c.status === "active" ? "Hoạt động" : "Khóa"}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-xs group-hover:bg-foreground group-hover:text-background transition-colors"
                          >
                            Xem hồ sơ 360°
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={limit}
              pageSizeOptions={[20, 50, 100]}
              onPageChange={setPage}
              onPageSizeChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              itemName="khách hàng"
            />
          </section>
        </div>
      )}
    </div>
  );
}
