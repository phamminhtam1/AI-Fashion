import { adminErrorMessage } from "@/lib/admin-language";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  Heart,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { resolveAdminPath } from "@/lib/routes";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  adminApi,
  type Customer,
  type CustomerSegment,
  type CustomerOrderSummary,
  type CustomerOverviewMetrics,
} from "@/lib/api";

// ─── Constants & helpers ──────────────────────────────────────────────────────

const SEGMENT_LABEL: Record<CustomerSegment, string> = {
  vip: "VIP",
  loyal: "Thường",
  new: "Mới",
};

const SEGMENT_CLASS: Record<CustomerSegment, string> = {
  vip: "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60",
  loyal: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60",
  new: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
};

const AVATAR_TINTS = [
  "bg-blue-50 text-blue-700 border-blue-200/60",
  "bg-purple-50 text-purple-700 border-purple-200/60",
  "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  "bg-amber-50 text-amber-700 border-amber-200/60",
  "bg-rose-50 text-rose-700 border-rose-200/60",
];

const GENDER_LABEL: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };

type CustomerExtra = Customer & {
  order_count?: number | null;
  last_order_at?: string | null;
  avatar_url?: string | null;
  birth_date?: string | null;
  gender?: string | null;
};

const SORT_OPTIONS = [
  { value: "created_at_desc", label: "Mới đăng ký nhất" },
  { value: "created_at_asc", label: "Đăng ký lâu nhất" },
  { value: "spent_desc", label: "Chi tiêu cao nhất" },
  { value: "spent_asc", label: "Chi tiêu thấp nhất" },
  { value: "name_asc", label: "Tên A→Z" },
  { value: "name_desc", label: "Tên Z→A" },
];

function formatVnd(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
  return new Intl.NumberFormat("vi-VN").format(n) + "₫";
}

function formatVndFull(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "₫";
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatAddress(a: { address_line: string; administrative_units: Record<string, string> }) {
  const city = a.administrative_units?.["city"];
  const district = a.administrative_units?.["district"];
  return [a.address_line, district, city].filter(Boolean).join(", ");
}

function memberSince(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  const months = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.4)));
  const span = months >= 12 ? `${Math.floor(months / 12)} năm` : `${months} tháng`;
  return `${fmtDate(s)} (${span})`;
}

/** Trạng thái đơn hiển thị trong lịch sử mua hàng */
function orderState(o: CustomerOrderSummary): { tone: "green" | "amber" | "red"; label: string } {
  if (o.status === "cancelled") return { tone: "red", label: "Đã hủy" };
  const paid =
    o.payment_status === "paid" ||
    (o.payment_method === "cod" && (o.status === "confirmed" || o.fulfillment_status === "fulfilled"));
  return paid ? { tone: "green", label: "Đã thanh toán" } : { tone: "amber", label: "Chờ thanh toán" };
}

const TONE: Record<"green" | "amber" | "red" | "grey", { pill: string; dot: string }> = {
  green: {
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
    dot: "bg-emerald-500",
  },
  amber: {
    pill: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
    dot: "bg-amber-500",
  },
  red: {
    pill: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
    dot: "bg-rose-500",
  },
  grey: {
    pill: "bg-muted text-muted-foreground border-border/60",
    dot: "bg-muted-foreground/60",
  },
};

function DotPill({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 py-0.5 text-xs font-semibold", t.pill)}>
      <span className={cn("size-1.5 rounded-full shrink-0", t.dot)} />
      {children}
    </span>
  );
}

function SegmentPill({ segment }: { segment: CustomerSegment }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-xs border px-2 py-0.5 text-xs font-semibold",
        SEGMENT_CLASS[segment] ?? "bg-muted text-muted-foreground border-border/60",
      )}
    >
      {SEGMENT_LABEL[segment] ?? segment}
    </span>
  );
}

function Avatar({ c, className }: { c: CustomerExtra; className?: string }) {
  const tint = AVATAR_TINTS[(c.full_name?.charCodeAt(0) ?? 0) % AVATAR_TINTS.length];
  return c.avatar_url ? (
    <img src={c.avatar_url} alt={c.full_name} className={cn("size-8.5 shrink-0 rounded-xs border border-border/60 object-cover", className)} />
  ) : (
    <span className={cn("grid size-8.5 shrink-0 place-items-center rounded-xs border text-sm font-semibold", tint, className)}>
      {c.full_name ? c.full_name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join("").toUpperCase() : "K"}
    </span>
  );
}

function MetricCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  sublabel,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  sublabel?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3.5 rounded-xs border bg-white p-3.5 text-left transition-all shadow-2xs",
        active
          ? "border-[#6941c6]/60 bg-[#6941c6]/5 ring-1 ring-[#6941c6]/30"
          : "border-border/70 hover:border-border hover:bg-slate-50/50",
      )}
    >
      <div className={cn("grid size-10 shrink-0 place-items-center rounded-xs", iconBg, iconColor)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xl font-semibold tabular-nums leading-tight text-slate-950">{value}</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-slate-700">{label}</div>
        {sublabel && <div className="mt-0.5 text-xs font-medium text-slate-500 leading-tight">{sublabel}</div>}
      </div>
    </button>
  );
}

function SelectBox({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8.5 w-full appearance-none rounded-xs border border-border/70 bg-white pl-3 pr-8 text-sm outline-none focus:ring-1 focus:ring-[#6941c6]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function pageItems(cur: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (cur >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", cur - 1, cur, cur + 1, "…", total];
}

function Pager({
  page,
  totalPages,
  total,
  pageSize,
  shown,
  onPage,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  shown: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + shown;
  const btn =
    "grid size-7.5 place-items-center rounded-xs border border-border/70 bg-white text-sm transition-colors hover:bg-secondary/60 disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
      <span className="text-sm font-semibold text-slate-700">
        Hiển thị {from} – {to} của {total.toLocaleString("vi-VN")} khách hàng
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          <ChevronLeft className="size-3.5" />
        </button>
        {pageItems(page, totalPages).map((it, i) =>
          it === "…" ? (
            <span key={`e${i}`} className="px-1 text-sm font-semibold text-slate-400">
              …
            </span>
          ) : (
            <button
              key={it}
              type="button"
              onClick={() => onPage(it)}
              className={cn(
                btn,
                it === page
                  ? "border-[#6941c6] bg-[#6941c6] text-white font-semibold hover:bg-[#6941c6]"
                  : "font-semibold text-slate-800",
              )}
            >
              {it}
            </button>
          ),
        )}
        <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <ChevronRight className="size-3.5" />
        </button>
        <SelectBox
          label="Số dòng mỗi trang"
          value={String(pageSize)}
          onChange={(v) => onPageSize(Number(v))}
          className="ml-2 w-28 [&_select]:h-7.5 [&_select]:text-sm [&_select]:rounded-xs"
          options={[5, 10, 20, 50].map((n) => ({ value: String(n), label: `${n} / trang` }))}
        />
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xs px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-secondary",
        destructive && "text-destructive hover:bg-destructive/10",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xs border border-border/70 bg-white p-4.5 shadow-2xs">
      <h2 className=" admin-section-title">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

type CustomerForm = {
  full_name: string;
  email: string;
  phone: string;
  birth_date: string;
  gender: string;
  segment: CustomerSegment;
  recipient_name: string;
  recipient_phone: string;
  address_line: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  note: string;
};

const emptyForm: CustomerForm = {
  full_name: "",
  email: "",
  phone: "",
  birth_date: "",
  gender: "",
  segment: "new",
  recipient_name: "",
  recipient_phone: "",
  address_line: "",
  city: "",
  province: "",
  postal_code: "",
  country: "Việt Nam",
  note: "",
};

const NOTE_MAX = 500;

type ViewTab = "list" | "detail" | "form";
type DetailTab = "orders" | "shipping" | "notes" | "activity";

// ─── Main component ───────────────────────────────────────────────────────────

export function CustomersManager({
  permissions = [],
  onNavigateToOrder,
  onCreateOrder,
}: {
  permissions?: string[];
  onNavigateToOrder?: (orderNumber: string) => void;
  /** Nếu truyền vào, nút "Tạo đơn hàng" sẽ hiện ở trang chi tiết */
  onCreateOrder?: (customer: Customer) => void;
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const route = resolveAdminPath(location.pathname);
  const canWrite = permissions.includes("*") || permissions.includes("customer.write");
  const activeCustomerParam = route.tabId === "customers" ? route.subParam : null;
  const isCreateRoute = route.tabId === "customers" && (route.action === "create" || activeCustomerParam === "them");
  const detailParam = isCreateRoute ? null : activeCustomerParam;

  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [segmentDist, setSegmentDist] = useState<Record<string, number>>({});
  const [metrics, setMetrics] = useState<CustomerOverviewMetrics | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  // View state
  const [activeTab, setActiveTab] = useState<ViewTab>(isCreateRoute ? "form" : detailParam ? "detail" : "list");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(detailParam ?? null);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("orders");
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [internalNoteDraft, setInternalNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

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
      if (res.overview_metrics) {
        setMetrics(res.overview_metrics);
      }
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không tải được khách hàng");
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
    setSelected(new Set());
  }, [filters, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (filters.dateFrom || filters.dateTo) {
      chips.push({
        key: "date",
        label: `Ngày tạo: ${filters.dateFrom || "…"} – ${filters.dateTo || "…"}`,
        clear: () => setFilters((f) => ({ ...f, dateFrom: "", dateTo: "" })),
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

  // Bộ lọc nâng cao trong popover "Lọc" (không gồm segment/status/ngày đã có trên toolbar)
  const advancedCount =
    (filters.spentMin || filters.spentMax ? 1 : 0) +
    (filters.city.trim() ? 1 : 0) +
    (filters.sortBy !== "created_at_desc" ? 1 : 0);

  function resetFilters() {
    setFilters(emptyFilters);
    setDraftFilters(emptyFilters);
    setQueryInput("");
    setQuery("");
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  const openDetailInternal = useCallback(async (id: string, initialCustomer?: Customer) => {
    setSelectedCustomerId(id);
    setActiveTab("detail");
    setDetailTab("orders");
    setShowAllOrders(false);
    setDetailLoading(true);
    if (initialCustomer) {
      setDetail(initialCustomer);
      setInternalNoteDraft(initialCustomer.internal_note || "");
    }
    try {
      const full = await adminApi.customer(id);
      setDetail(full);
      setInternalNoteDraft(full.internal_note || "");
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không tải được hồ sơ khách hàng");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = (c: Customer) => {
    void openDetailInternal(c.id, c);
    navigate({ to: `/khachhang/${c.id}` });
  };

  const handleBackToList = () => {
    setSelectedCustomerId(null);
    setEditingId(null);
    setActiveTab("list");
    navigate({ to: "/khachhang" });
  };

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setActiveTab("form");
    navigate({ to: "/khachhang/them" });
  }

  function openEdit(c: Customer) {
    const x = c as CustomerExtra;
    setEditingId(c.id);
    setSelectedCustomerId(c.id);
    setForm({
      ...emptyForm,
      full_name: c.full_name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      birth_date: x.birth_date ? x.birth_date.slice(0, 10) : "",
      gender: x.gender ?? "",
      segment: c.segment,
      note: c.internal_note ?? "",
    });
    setActiveTab("form");
  }

  // Sync state with URL location
  useEffect(() => {
    if (route.tabId !== "customers") return;
    if (isCreateRoute) {
      if (activeTab !== "form" || editingId) {
        setEditingId(null);
        setForm(emptyForm);
        setActiveTab("form");
      }
    } else if (detailParam) {
      if (selectedCustomerId !== detailParam) {
        const match = items.find((c) => c.id === detailParam);
        void openDetailInternal(detailParam, match);
      }
    } else if (activeTab === "detail" || (activeTab === "form" && !editingId)) {
      setSelectedCustomerId(null);
      setActiveTab("list");
    }
  }, [route.tabId, isCreateRoute, detailParam, items, selectedCustomerId, activeTab, editingId, openDetailInternal]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function toggleStatus(c: Customer, active: boolean) {
    const next = active ? "active" : "blocked";
    setItems((list) => list.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    setDetail((d) => (d && d.id === c.id ? { ...d, status: next } : d));
    try {
      await adminApi.updateCustomer(c.id, { status: next });
      toast.success(active ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản khách hàng");
    } catch (e) {
      setItems((list) => list.map((x) => (x.id === c.id ? { ...x, status: c.status } : x)));
      setDetail((d) => (d && d.id === c.id ? { ...d, status: c.status } : d));
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không đổi được trạng thái");
    }
  }

  async function bulkSetStatus(active: boolean) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => adminApi.updateCustomer(id, { status: active ? "active" : "blocked" })));
      toast.success(`${active ? "Đã mở khóa" : "Đã khóa"} ${ids.length} tài khoản`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Thao tác hàng loạt thất bại");
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  async function saveInternalNote() {
    if (!detail) return;
    setSavingNote(true);
    try {
      await adminApi.updateCustomer(detail.id, { internal_note: internalNoteDraft });
      setDetail((prev) => (prev ? { ...prev, internal_note: internalNoteDraft } : null));
      setItems((list) => list.map((x) => (x.id === detail.id ? { ...x, internal_note: internalNoteDraft } : x)));
      toast.success("Đã lưu ghi chú chăm sóc khách hàng");
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không lưu được ghi chú");
    } finally {
      setSavingNote(false);
    }
  }

  async function saveForm() {
    if (!form.full_name.trim()) {
      toast.error("Nhập họ và tên khách hàng");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Nhập email khách hàng");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateCustomer(editingId, {
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          segment: form.segment,
          internal_note: form.note.trim(),
        });
        toast.success("Đã cập nhật khách hàng thành công");
        const id = editingId;
        setEditingId(null);
        await load();
        await openDetailInternal(id);
        navigate({ to: `/khachhang/${id}` });
      } else {
        const hasAddress = form.address_line.trim() || form.city.trim();
        await adminApi.createCustomer({
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          segment: form.segment,
          status: "active",
          internal_note: form.note.trim(),
          address: hasAddress
            ? {
                recipient_name: form.recipient_name.trim() || form.full_name.trim(),
                phone: form.recipient_phone.trim() || form.phone.trim(),
                address_line: form.address_line.trim(),
                city: form.city.trim(),
                province: form.province.trim(),
                postal_code: form.postal_code.trim(),
                country: form.country.trim(),
                is_default: true,
              }
            : undefined,
        });
        toast.success("Đã thêm khách hàng mới thành công");
        await load();
        handleBackToList();
      }
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const allSelected = items.length > 0 && items.every((c) => selected.has(c.id));
  const someSelected = items.some((c) => selected.has(c.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of items) {
        if (allSelected) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const orders = detail?.orders ?? [];
  const shownOrders = showAllOrders ? orders : orders.slice(0, 5);

  // ─────────────────────────────────────────────────────────────────────────────
  // FORM VIEW (Thêm / Sửa khách hàng)
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeTab === "form") {
    const inputCls = "h-8.5 rounded-xs border-border/70 bg-white px-3 text-sm focus-visible:ring-1 focus-visible:ring-[#6941c6]";
    return (
      <div className="space-y-4 pb-12 font-sans text-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-8.5 shrink-0 rounded-xs border-border/70 bg-white text-muted-foreground hover:text-foreground shadow-2xs"
              onClick={() => (editingId ? (setEditingId(null), setActiveTab("detail")) : handleBackToList())}
              aria-label="Quay lại"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-foreground admin-page-title">
                {editingId ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {editingId ? "Cập nhật thông tin khách hàng." : "Tạo tài khoản khách hàng mới vào hệ thống."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8.5 rounded-xs border-border/70 bg-white px-3.5 text-sm hover:bg-secondary/60"
              onClick={() => (editingId ? (setEditingId(null), setActiveTab("detail")) : handleBackToList())}
            >
              Hủy
            </Button>
            <Button
              className="h-8.5 gap-1.5 rounded-xs bg-[#6941c6] hover:bg-[#53389e] text-white px-3.5 text-sm font-medium shadow-2xs"
              disabled={saving}
              onClick={saveForm}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {saving ? "Đang lưu…" : "Lưu khách hàng"}
            </Button>
          </div>
        </div>

        <FormCard title="Thông tin cơ bản">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Họ và tên" required>
              <Input
                className={inputCls}
                placeholder="Nhập họ và tên"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </Field>
            <Field label="Email" required>
              <Input
                className={inputCls}
                type="email"
                placeholder="Nhập địa chỉ email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="Số điện thoại">
              <Input
                className={inputCls}
                placeholder="0901 234 567"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Field>
            <Field label="Ngày sinh">
              <Input
                className={inputCls}
                type="date"
                value={form.birth_date}
                onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
              />
            </Field>
            <Field label="Giới tính">
              <SelectBox
                label="Giới tính"
                value={form.gender}
                onChange={(v) => setForm((f) => ({ ...f, gender: v }))}
                className="[&_select]:h-8.5 [&_select]:text-sm [&_select]:rounded-xs"
                options={[
                  { value: "", label: "Chọn giới tính" },
                  { value: "female", label: "Nữ" },
                  { value: "male", label: "Nam" },
                  { value: "other", label: "Khác" },
                ]}
              />
            </Field>
            <Field label="Phân khúc khách hàng">
              <SelectBox
                label="Phân khúc"
                value={form.segment}
                onChange={(v) => setForm((f) => ({ ...f, segment: v as CustomerSegment }))}
                className="[&_select]:h-8.5 [&_select]:text-sm [&_select]:rounded-xs"
                options={[
                  { value: "new", label: "Mới" },
                  { value: "loyal", label: "Thường" },
                  { value: "vip", label: "VIP" },
                ]}
              />
            </Field>
          </div>
        </FormCard>

        {!editingId && (
          <FormCard title="Địa chỉ mặc định">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Họ và tên người nhận">
                <Input
                  className={inputCls}
                  placeholder="Nhập họ và tên"
                  value={form.recipient_name}
                  onChange={(e) => setForm((f) => ({ ...f, recipient_name: e.target.value }))}
                />
              </Field>
              <Field label="Số điện thoại">
                <Input
                  className={inputCls}
                  placeholder="0901 234 567"
                  value={form.recipient_phone}
                  onChange={(e) => setForm((f) => ({ ...f, recipient_phone: e.target.value }))}
                />
              </Field>
              <Field label="Địa chỉ">
                <Input
                  className={inputCls}
                  placeholder="Nhập địa chỉ"
                  value={form.address_line}
                  onChange={(e) => setForm((f) => ({ ...f, address_line: e.target.value }))}
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Field label="Thành phố">
                <Input
                  className={inputCls}
                  placeholder="Nhập thành phố"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </Field>
              <Field label="Tỉnh / Quận huyện">
                <Input
                  className={inputCls}
                  placeholder="Nhập tỉnh / quận huyện"
                  value={form.province}
                  onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                />
              </Field>
              <Field label="Mã bưu điện">
                <Input
                  className={inputCls}
                  placeholder="Nhập mã bưu điện"
                  value={form.postal_code}
                  onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                />
              </Field>
              <Field label="Quốc gia">
                <Input
                  className={inputCls}
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                />
              </Field>
            </div>
          </FormCard>
        )}

        <FormCard title="Ghi chú">
          <textarea
            className="min-h-24 w-full resize-y rounded-xs border border-border/70 bg-white p-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-[#6941c6]"
            placeholder="Nhập ghi chú về khách hàng…"
            maxLength={NOTE_MAX}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {form.note.length}/{NOTE_MAX}
          </p>
        </FormCard>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DETAIL VIEW (Chi tiết khách hàng)
  // ─────────────────────────────────────────────────────────────────────────────
  if (activeTab === "detail") {
    if (!detail) {
      return (
        <div className="mt-8 grid min-h-[360px] place-items-center rounded-xs border border-border/70 bg-card text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-5 animate-spin text-[#6941c6]" />
            <p>Đang tải hồ sơ khách hàng…</p>
          </div>
        </div>
      );
    }
    const dx = detail as CustomerExtra;
    const an = detail.analytics;
    return (
      <div className="space-y-5 pb-12 font-sans">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-8.5 shrink-0 rounded-xs border-border/70 bg-white text-slate-700 hover:text-slate-950 shadow-2xs"
              onClick={handleBackToList}
              aria-label="Quay lại danh sách"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-slate-950 admin-page-title">Chi tiết khách hàng</h1>
              <p className="mt-1 text-sm font-semibold text-slate-600 sm:text-sm">
                Xem thông tin chi tiết, lịch sử mua hàng và hoạt động của khách hàng.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8.5 gap-1.5 rounded-xs border-border/70 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-secondary/60"
              onClick={() => openEdit(detail)}
            >
              <Pencil className="size-3.5" />
              Chỉnh sửa
            </Button>
            {onCreateOrder && (
              <Button
                className="h-8.5 gap-1.5 rounded-xs bg-[#6941c6] hover:bg-[#53389e] text-white px-3.5 text-sm font-semibold shadow-2xs"
                onClick={() => onCreateOrder(detail)}
              >
                <Plus className="size-3.5" />
                Tạo đơn hàng
              </Button>
            )}
            <Popover open={menuId === "detail"} onOpenChange={(o) => setMenuId(o ? "detail" : null)}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8.5 rounded-xs border-border/70 bg-white text-slate-700 hover:text-slate-950 shadow-2xs"
                  aria-label="Thao tác khác"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-1 rounded-xs shadow-md">
                <MenuItem
                  icon={detail.status === "active" ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                  label={detail.status === "active" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                  destructive={detail.status === "active"}
                  onClick={() => {
                    setMenuId(null);
                    void toggleStatus(detail, detail.status !== "active");
                  }}
                />
                <MenuItem
                  icon={<Copy className="size-3.5" />}
                  label="Sao chép mã khách hàng"
                  onClick={() => {
                    setMenuId(null);
                    copyText("id", "mã khách hàng", detail.id);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* LEFT */}
          <div className="space-y-4">
            <section className="rounded-xs border border-border/70 bg-white p-4.5 shadow-2xs">
              <div className="flex items-start gap-3.5">
                <Avatar c={dx} className="size-14 text-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-slate-950 admin-section-title">{detail.full_name}</h2>
                    <SegmentPill segment={detail.segment} />
                    {detail.status !== "active" && <DotPill tone="red">Đã khóa</DotPill>}
                  </div>
                  <div className="mt-2 space-y-1.5 text-sm font-semibold text-slate-700">
                    {detail.email && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail className="size-3 shrink-0 text-slate-500" />
                        <a href={`mailto:${detail.email}`} className="truncate hover:underline">
                          {detail.email}
                        </a>
                        <button
                          type="button"
                          title="Sao chép email"
                          onClick={() => copyText("email", "email", detail.email!)}
                          className="hover:text-slate-950"
                        >
                          {copiedKey === "email" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-slate-500" />}
                        </button>
                      </p>
                    )}
                    {detail.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="size-3 shrink-0 text-slate-500" />
                        <a href={`tel:${detail.phone}`} className="hover:underline">
                          {detail.phone}
                        </a>
                        <button
                          type="button"
                          title="Copy SĐT"
                          onClick={() => copyText("phone", "số điện thoại", detail.phone!)}
                          className="hover:text-slate-950"
                        >
                          {copiedKey === "phone" ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-slate-500" />}
                        </button>
                      </p>
                    )}
                    <p className="flex items-center gap-1.5 font-medium text-slate-500">
                      <Calendar className="size-3 shrink-0 text-slate-500" />
                      Khách hàng từ {memberSince(detail.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border/70 pt-3.5 text-center">
                <div>
                  <p className="text-xl font-semibold tabular-nums text-slate-950">{an?.total_orders ?? orders.length}</p>
                  <p className="text-xs font-semibold text-slate-600">Tổng đơn hàng</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums text-slate-950">
                    {formatVnd(an?.total_spent_vnd ?? detail.total_spent_vnd ?? 0)}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">Tổng chi tiêu</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums text-slate-950">{formatVnd(an?.aov_vnd ?? 0)}</p>
                  <p className="text-xs font-semibold text-slate-600">AOV trung bình</p>
                </div>
              </div>
            </section>

            <section className="rounded-xs border border-border/70 bg-white p-4.5 shadow-2xs">
              <h3 className="text-slate-950 admin-subsection-title">Thông tin cá nhân</h3>
              <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-2 gap-y-2.5 text-sm">
                <dt className="font-semibold text-slate-600">Họ và tên</dt>
                <dd className="font-semibold text-slate-900">{detail.full_name}</dd>
                <dt className="font-semibold text-slate-600">Email</dt>
                <dd className="break-all font-semibold text-slate-900">{detail.email || "—"}</dd>
                <dt className="font-semibold text-slate-600">Số điện thoại</dt>
                <dd className="font-semibold text-slate-900">{detail.phone || "—"}</dd>
                <dt className="font-semibold text-slate-600">Ngày sinh</dt>
                <dd className="font-semibold text-slate-800">{fmtDate(dx.birth_date)}</dd>
                <dt className="font-semibold text-slate-600">Giới tính</dt>
                <dd className="font-semibold text-slate-800">{dx.gender ? (GENDER_LABEL[dx.gender] ?? dx.gender) : "—"}</dd>
                <dt className="font-semibold text-slate-600">Ghi chú</dt>
                <dd className="whitespace-pre-line font-medium text-slate-800">{detail.internal_note || "—"}</dd>
              </dl>
            </section>
          </div>

          {/* RIGHT */}
          <section className="min-w-0 rounded-xs border border-border/70 bg-white p-4.5 shadow-2xs">
            <div className="flex gap-5 border-b border-border/70">
              {(
                [
                  ["orders", "Lịch sử mua hàng"],
                  ["shipping", "Thông tin giao hàng"],
                  ["notes", "Ghi chú"],
                  ["activity", "Hoạt động"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDetailTab(id)}
                  className={cn(
                    "-mb-px border-b-2 px-1 pb-2.5 text-sm font-semibold transition-colors cursor-pointer",
                    detailTab === id
                      ? "border-[#6941c6] text-[#6941c6]"
                      : "border-transparent text-slate-500 hover:text-slate-900",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {detailLoading && (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <Loader2 className="size-3.5 animate-spin text-[#6941c6]" /> Đang đồng bộ dữ liệu mới nhất…
              </p>
            )}

            {/* Orders */}
            {detailTab === "orders" && (
              <div className="mt-4">
                <h3 className="text-slate-950 admin-subsection-title">Danh sách đơn hàng ({orders.length})</h3>
                {orders.length === 0 ? (
                  <p className="py-12 text-center text-sm font-medium text-slate-500">
                    Khách hàng chưa có đơn hàng nào.
                  </p>
                ) : (
                  <>
                    <div className="mt-3 overflow-x-auto rounded-xs border border-border/70">
                      <table className="w-full min-w-[580px] text-left text-sm">
                        <thead>
                          <tr className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold tracking-tight text-slate-700">
                            <th className="w-8 px-3 py-2.5 font-semibold tracking-tight text-slate-700">#</th>
                            <th className="px-3 py-2.5 font-semibold tracking-tight text-slate-700">Mã đơn & Ngày đặt</th>
                            <th className="px-3 py-2.5 font-semibold tracking-tight text-slate-700">Sản phẩm</th>
                            <th className="px-3 py-2.5 text-right font-semibold tracking-tight text-slate-700">Tổng tiền</th>
                            <th className="px-3 py-2.5 font-semibold tracking-tight text-slate-700">Trạng thái</th>
                            <th className="w-24 whitespace-nowrap px-3 py-2.5 text-center font-semibold tracking-tight text-slate-700">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shownOrders.map((o, idx) => {
                            const st = orderState(o);
                            const its = o.items ?? [];
                            return (
                              <tr key={o.id} className="border-b border-border/60 last:border-b-0 hover:bg-slate-50/60 transition-colors">
                                <td className="px-3 py-2.5 font-semibold text-slate-500">{idx + 1}</td>
                                <td className="px-3 py-2.5">
                                  <p className="text-sm font-semibold text-slate-950">#{o.order_number}</p>
                                  <p className="text-sm font-medium text-slate-600">{fmtDate(o.placed_at)}</p>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-1">
                                    {its.slice(0, 3).map((it) =>
                                      it.image_url ? (
                                        <img
                                          key={it.id ?? it.sku}
                                          src={it.image_url}
                                          alt={it.product_name}
                                          title={it.product_name}
                                          className="size-8 rounded-xs border border-border/60 object-cover"
                                        />
                                      ) : (
                                        <span
                                          key={it.id ?? it.sku}
                                          title={it.product_name}
                                          className="grid size-8 place-items-center rounded-xs border border-border/60 bg-secondary text-slate-600"
                                        >
                                          <Package className="size-3.5" />
                                        </span>
                                      ),
                                    )}
                                    {its.length > 3 && (
                                      <span className="text-xs font-semibold text-slate-600">+{its.length - 3}</span>
                                    )}
                                    {its.length === 0 && <span className="text-xs text-slate-400">—</span>}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-950">
                                  {formatVndFull(o.grand_total_vnd)}
                                </td>
                                <td className="px-3 py-2.5">
                                  <DotPill tone={st.tone}>{st.label}</DotPill>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <Popover open={menuId === o.id} onOpenChange={(v) => setMenuId(v ? o.id : null)}>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="icon" className="size-7 rounded-xs text-slate-500 hover:text-slate-950" aria-label={`Thao tác đơn ${o.order_number}`}>
                                        <MoreHorizontal className="size-3.5" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-44 p-1 rounded-xs shadow-md">
                                      {onNavigateToOrder && (
                                        <MenuItem
                                          icon={<ExternalLink className="size-3.5" />}
                                          label="Xem đơn hàng"
                                          onClick={() => {
                                            setMenuId(null);
                                            onNavigateToOrder(o.order_number);
                                          }}
                                        />
                                      )}
                                      <MenuItem
                                        icon={<Copy className="size-3.5" />}
                                        label="Sao chép mã đơn"
                                        onClick={() => {
                                          setMenuId(null);
                                          copyText(`order-${o.id}`, "mã đơn", o.order_number);
                                        }}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {orders.length > 5 && (
                      <div className="mt-3 text-right">
                        <button
                          type="button"
                          onClick={() => setShowAllOrders((v) => !v)}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-[#6941c6] hover:underline cursor-pointer"
                        >
                          {showAllOrders ? "Thu gọn" : "Xem tất cả đơn hàng"}
                          {!showAllOrders && <ChevronRight className="size-3.5" />}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Shipping */}
            {detailTab === "shipping" && (
              <div className="mt-4">
                <h3 className="text-slate-950 admin-subsection-title">Sổ địa chỉ giao hàng ({detail.addresses?.length ?? 0})</h3>
                {!detail.addresses || detail.addresses.length === 0 ? (
                  <p className="py-12 text-center text-sm font-medium text-slate-500">
                    Khách hàng chưa lưu địa chỉ nào.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {detail.addresses.map((a) => (
                      <div
                        key={a.id}
                        className={cn(
                          "rounded-xs border p-3 text-sm shadow-2xs",
                          a.is_default ? "border-[#6941c6]/40 bg-[#6941c6]/5" : "border-border/70 bg-white",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex items-center gap-1.5 font-semibold text-slate-950">
                            <MapPin className="size-3.5 text-slate-500" />
                            {a.recipient_name}
                          </p>
                          {a.is_default && (
                            <span className="rounded-xs bg-[#6941c6]/10 px-1.5 py-0.5 text-xs font-semibold text-[#6941c6]">
                              Mặc định
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-semibold text-slate-700">{a.phone}</p>
                        <p className="mt-0.5 font-medium text-slate-800">{formatAddress(a)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {detailTab === "notes" && (
              <div className="mt-4">
                <h3 className="text-slate-950 admin-subsection-title">Ghi chú chăm sóc khách hàng</h3>
                <p className="mt-0.5 text-xs font-medium text-slate-500">Chỉ nhân viên và quản lý nhìn thấy.</p>
                <textarea
                  rows={5}
                  value={internalNoteDraft}
                  onChange={(e) => setInternalNoteDraft(e.target.value)}
                  placeholder="Ghi chú sở thích, thói quen thời trang, lưu ý khi tư vấn hoặc đóng gói hàng cho khách này…"
                  className="mt-3 w-full resize-y rounded-xs border border-border/70 bg-white p-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-[#6941c6]"
                />
                <div className="mt-2.5 flex justify-end">
                  <Button
                    className="h-8.5 gap-1.5 rounded-xs bg-[#6941c6] hover:bg-[#53389e] text-white text-sm px-3.5 font-semibold shadow-2xs"
                    onClick={saveInternalNote}
                    disabled={savingNote}
                  >
                    <Save className="size-3.5" />
                    {savingNote ? "Đang lưu…" : "Lưu ghi chú"}
                  </Button>
                </div>
              </div>
            )}

            {/* Activity */}
            {detailTab === "activity" && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: <CreditCard className="size-3.5 text-blue-600" />,
                      label: "Tổng chi tiêu thực tế (LTV)",
                      value: formatVndFull(an?.total_spent_vnd ?? detail.total_spent_vnd ?? 0),
                      note: `${an?.completed_orders ?? 0} đơn đã thanh toán`,
                    },
                    {
                      icon: <TrendingUp className="size-3.5 text-emerald-600" />,
                      label: "Giá trị đơn trung bình",
                      value: formatVndFull(an?.aov_vnd ?? 0),
                      note: `${an?.pending_orders ?? 0} chờ TT · ${an?.cancelled_orders ?? 0} hủy`,
                    },
                    {
                      icon: <Clock className="size-3.5 text-purple-600" />,
                      label: "Lần mua gần nhất",
                      value:
                        an?.days_since_last_order !== null && an?.days_since_last_order !== undefined
                          ? `${an.days_since_last_order} ngày trước`
                          : "Chưa mua",
                      note: an?.last_order_at ? fmtDate(an.last_order_at) : "Chưa phát sinh giao dịch",
                    },
                  ].map((k) => (
                    <div key={k.label} className="rounded-xs border border-border/70 bg-white p-3.5 shadow-2xs">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                        {k.icon}
                        {k.label}
                      </p>
                      <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-950">{k.value}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">{k.note}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground">Tần suất chọn kích cỡ</h4>
                  {an?.top_sizes && an.top_sizes.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {an.top_sizes.map((s) => (
                        <span
                          key={s.size}
                          className="inline-flex items-center gap-1.5 rounded-xs border border-border/70 bg-white px-2.5 py-1 text-sm"
                        >
                          Kích cỡ {s.size}
                          <span className="rounded-xs bg-[#6941c6] px-1.5 text-xs font-semibold text-white">
                            {s.count}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm text-muted-foreground">Chưa có dữ liệu kích cỡ đã mua.</p>
                  )}
                </div>

                {an?.top_products && an.top_products.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Sản phẩm đã mua nhiều</h4>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {an.top_products.slice(0, 4).map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 rounded-xs border border-border/70 bg-white p-2 shadow-2xs">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="size-9 rounded-xs border border-border/60 object-cover" />
                          ) : (
                            <span className="grid size-9 place-items-center rounded-xs border border-border/60 bg-secondary text-muted-foreground">
                              <Package className="size-3.5" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Đã mua {p.count} lần · {formatVnd(p.total_vnd)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LIST VIEW (Khách hàng)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 font-sans pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-slate-900 admin-page-title">
            Khách hàng
          </h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-sm">
            Quản lý thông tin khách hàng, lịch sử mua hàng và phân khúc khách hàng.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canWrite && <Button
              onClick={openCreate}
              className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Thêm khách hàng</span>
            </Button>}
        </div>
      </div>

      {/* 5 Metric Cards matching screenshot */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          icon={<Users className="size-4.5" />}
          iconBg="bg-blue-50 dark:bg-blue-950/40"
          iconColor="text-blue-600 dark:text-blue-400"
          value={(metrics?.total_customers ?? total).toLocaleString("vi-VN")}
          label="Tổng khách hàng"
          active={filters.segment === "all"}
          onClick={() => setFilters((f) => ({ ...f, segment: "all" }))}
        />
        <MetricCard
          icon={<UserCheck className="size-4.5" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          iconColor="text-emerald-600 dark:text-emerald-400"
          value={(metrics?.active_customers ?? total).toLocaleString("vi-VN")}
          label="Khách hàng hoạt động"
          sublabel="(12 tháng qua)"
        />
        <MetricCard
          icon={<ShoppingBag className="size-4.5" />}
          iconBg="bg-purple-50 dark:bg-purple-950/40"
          iconColor="text-[#6941c6] dark:text-purple-400"
          value={String(metrics?.avg_orders_per_customer ?? 0)}
          label="Đơn hàng trung bình mỗi khách"
        />
        <MetricCard
          icon={<CreditCard className="size-4.5" />}
          iconBg="bg-amber-50 dark:bg-amber-950/40"
          iconColor="text-amber-600 dark:text-amber-400"
          value={formatVnd(metrics?.avg_order_value_vnd ?? 0)}
          label="Giá trị đơn hàng trung bình"
        />
        <MetricCard
          icon={<Heart className="size-4.5" />}
          iconBg="bg-rose-50 dark:bg-rose-950/40"
          iconColor="text-rose-600 dark:text-rose-400"
          value={`${metrics?.repeat_customer_rate ?? 0}%`}
          label="Tỷ lệ khách hàng quay lại"
        />
      </section>

      <section className="overflow-hidden rounded-xs border border-border/70 bg-white shadow-2xs">
        {/* Toolbar */}
        <div className="border-b border-border/70 p-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                className="h-8.5 rounded-xs border-border/70 bg-white pl-9 pr-8 text-sm focus-visible:ring-1 focus-visible:ring-[#6941c6]"
                placeholder="Tìm kiếm theo tên, email, số điện thoại..."
              />
              {queryInput && (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xs p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setQueryInput("")}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <SelectBox
              label="Phân khúc"
              value={filters.segment}
              onChange={(v) => setFilters((f) => ({ ...f, segment: v as FilterState["segment"] }))}
              className="w-38"
              options={[
                { value: "all", label: "Tất cả phân khúc" },
                { value: "vip", label: "VIP" },
                { value: "loyal", label: "Thường" },
                { value: "new", label: "Mới" },
              ]}
            />
            <SelectBox
              label="Trạng thái"
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v as FilterState["status"] }))}
              className="w-38"
              options={[
                { value: "", label: "Tất cả trạng thái" },
                { value: "active", label: "Hoạt động" },
                { value: "blocked", label: "Đã khóa" },
              ]}
            />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8.5 gap-1.5 rounded-xs border-border/70 bg-white text-sm font-normal hover:bg-secondary/60",
                    (filters.dateFrom || filters.dateTo) && "border-[#6941c6]/50 bg-[#6941c6]/5 text-[#6941c6]",
                  )}
                >
                  <Calendar className="size-3.5" />
                  {filters.dateFrom || filters.dateTo
                    ? `${filters.dateFrom ? fmtDate(filters.dateFrom) : "…"} – ${filters.dateTo ? fmtDate(filters.dateTo) : "…"}`
                    : "Ngày tạo"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3 p-3.5 rounded-xs shadow-md">
                <label className="block text-sm font-medium">
                  Từ ngày
                  <Input
                    type="date"
                    className="mt-1.5 h-8 text-sm rounded-xs"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-medium">
                  Đến ngày
                  <Input
                    type="date"
                    className="mt-1.5 h-8 text-sm rounded-xs"
                    value={filters.dateTo}
                    onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-sm h-7.5 rounded-xs"
                  onClick={() => setFilters((f) => ({ ...f, dateFrom: "", dateTo: "" }))}
                >
                  Xóa khoảng ngày
                </Button>
              </PopoverContent>
            </Popover>

            <Popover onOpenChange={(o) => o && setDraftFilters(filters)}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-8.5 gap-1.5 rounded-xs border-border/70 bg-white text-sm hover:bg-secondary/60",
                    advancedCount > 0 && "border-[#6941c6]/50 bg-[#6941c6]/5 text-[#6941c6]",
                  )}
                >
                  <SlidersHorizontal className="size-3.5" />
                  Lọc
                  {advancedCount > 0 && (
                    <span className="inline-flex size-4 items-center justify-center rounded-xs bg-[#6941c6] text-xs font-semibold text-white">
                      {advancedCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[320px] p-0 shadow-xl rounded-xs">
                <div className="border-b border-border/70 px-3.5 py-2.5">
                  <p className="text-sm font-semibold">Bộ lọc nâng cao</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Kết hợp tiêu chí để tìm đúng tệp khách hàng.</p>
                </div>
                <div className="space-y-3.5 p-3.5 text-sm">
                  <div className="space-y-1.5">
                    <span className="font-medium text-foreground">Mức chi tiêu (₫)</span>
                    <div className="flex gap-2">
                      <Input
                        inputMode="numeric"
                        placeholder="Từ"
                        value={draftFilters.spentMin}
                        onChange={(e) => setDraftFilters((f) => ({ ...f, spentMin: e.target.value.replace(/[^\d]/g, "") }))}
                        className="h-8 rounded-xs bg-white text-sm"
                      />
                      <Input
                        inputMode="numeric"
                        placeholder="Đến"
                        value={draftFilters.spentMax}
                        onChange={(e) => setDraftFilters((f) => ({ ...f, spentMax: e.target.value.replace(/[^\d]/g, "") }))}
                        className="h-8 rounded-xs bg-white text-sm"
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
                            "rounded-xs border px-2 py-0.5 text-xs transition-colors",
                            draftFilters.spentMin === p.min && draftFilters.spentMax === p.max
                              ? "border-[#6941c6] bg-[#6941c6] text-white font-medium"
                              : "border-border/70 bg-white text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {p.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="font-medium text-foreground">Tỉnh / Thành phố</span>
                    <Input
                      placeholder="VD: Hà Nội, TP.HCM…"
                      value={draftFilters.city}
                      onChange={(e) => setDraftFilters((f) => ({ ...f, city: e.target.value }))}
                      className="h-8 rounded-xs bg-white text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="font-medium text-foreground">Sắp xếp theo</span>
                    <select
                      className="h-8 w-full rounded-xs border border-border/70 bg-white px-2.5 text-sm outline-none focus:ring-1 focus:ring-[#6941c6]"
                      value={draftFilters.sortBy}
                      onChange={(e) => setDraftFilters((f) => ({ ...f, sortBy: e.target.value }))}
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-between border-t border-border/70 px-3.5 py-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7.5 rounded-xs text-sm"
                    onClick={() => {
                      const reset = { ...filters, spentMin: "", spentMax: "", city: "", sortBy: "created_at_desc" };
                      setDraftFilters(reset);
                      setFilters(reset);
                    }}
                  >
                    Xóa lọc
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7.5 rounded-xs bg-[#6941c6] hover:bg-[#53389e] text-white text-sm px-3 shadow-2xs"
                    onClick={() => setFilters(draftFilters)}
                  >
                    Áp dụng
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {activeFilterChips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex items-center gap-1 rounded-xs border border-border/80 bg-white px-2 py-0.5 text-xs transition-colors hover:border-[#6941c6]/40"
                >
                  {chip.label}
                  <X className="size-3 opacity-60" />
                </button>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-[#6941c6] underline-offset-2 hover:underline ml-1"
              >
                Xóa tất cả
              </button>
            </div>
          )}
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-secondary/30 px-3.5 py-2">
            <span className="text-sm font-medium text-foreground">Đã chọn {selected.size}</span>
            <Button size="sm" variant="outline" className="h-7 rounded-xs bg-white text-sm gap-1" disabled={bulkBusy} onClick={() => bulkSetStatus(false)}>
              <Lock className="size-3" /> Khóa
            </Button>
            <Button size="sm" variant="outline" className="h-7 rounded-xs bg-white text-sm gap-1" disabled={bulkBusy} onClick={() => bulkSetStatus(true)}>
              <Unlock className="size-3" /> Mở khóa
            </Button>
            <Button size="sm" variant="ghost" className="h-7 rounded-xs text-sm" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
              Bỏ chọn
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold tracking-tight text-slate-700">
                <th className="w-10 px-3.5 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả"
                    className="size-3.5 rounded-xs accent-[#6941c6]"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2.5 text-sm font-semibold tracking-tight text-slate-700">Khách hàng</th>
                <th className="px-3 py-2.5 text-sm font-semibold tracking-tight text-slate-700">Liên hệ</th>
                <th className="px-3 py-2.5 text-center text-sm font-semibold tracking-tight text-slate-700">Đơn hàng</th>
                <th className="px-3 py-2.5 text-sm font-semibold tracking-tight text-slate-700">Tổng chi tiêu</th>
                <th className="px-3 py-2.5 text-sm font-semibold tracking-tight text-slate-700">Lần mua cuối</th>
                <th className="px-3 py-2.5 text-sm font-semibold tracking-tight text-slate-700">Phân khúc</th>
                <th className="px-3 py-2.5 text-sm font-semibold tracking-tight text-slate-700">Trạng thái</th>
                <th className="w-24 whitespace-nowrap px-3 py-2.5 text-center text-sm font-semibold tracking-tight text-slate-700">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-sm font-semibold text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-4.5 animate-spin text-[#6941c6]" />
                      <span>Đang tải danh sách khách hàng…</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center">
                    <p className="text-sm font-semibold text-slate-900">Không tìm thấy khách hàng phù hợp</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Thử từ khóa khác hoặc bỏ bớt tiêu chí lọc.
                    </p>
                    <Button variant="outline" size="sm" onClick={resetFilters} className="mt-2.5 h-7.5 rounded-xs bg-white text-sm font-semibold text-slate-700">
                      Bỏ lọc
                    </Button>
                  </td>
                </tr>
              ) : (
                items.map((c) => {
                  const x = c as CustomerExtra;
                  const checked = selected.has(c.id);
                  const orderCount = x.order_count ?? x.analytics?.total_orders;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => openDetail(c)}
                      className={cn(
                        "cursor-pointer border-b border-border/60 transition-colors last:border-b-0 text-sm",
                        checked ? "bg-[#6941c6]/5" : "hover:bg-slate-50/70",
                      )}
                    >
                      <td className="px-3.5 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${c.full_name}`}
                          className="size-3.5 rounded-xs accent-[#6941c6]"
                          checked={checked}
                          onChange={() => toggleOne(c.id)}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar c={x} />
                          <div className="min-w-0">
                            <a
                              href={`/khachhang/${c.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openDetail(c);
                              }}
                              className="block max-w-[200px] truncate text-sm font-semibold text-slate-950 hover:underline"
                            >
                              {c.full_name}
                            </a>
                            <p className="max-w-[200px] truncate text-sm font-medium text-slate-600">{c.email || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{c.phone || "—"}</td>
                      <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-slate-900">{orderCount ?? 0}</td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-950">{formatVndFull(c.total_spent_vnd ?? 0)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-700">{fmtDate(x.last_order_at)}</td>
                      <td className="px-3 py-2.5">
                        <SegmentPill segment={c.segment} />
                      </td>
                      <td className="px-3 py-2.5">
                        <DotPill tone={c.status === "active" ? "green" : "red"}>
                          {c.status === "active" ? "Hoạt động" : "Đã khóa"}
                        </DotPill>
                      </td>
                      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <Popover open={menuId === c.id} onOpenChange={(o) => setMenuId(o ? c.id : null)}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7 rounded-xs text-muted-foreground hover:text-foreground" aria-label={`Thao tác với ${c.full_name}`}>
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-44 p-1 rounded-xs shadow-md">
                            <MenuItem
                              icon={<Users className="size-3.5" />}
                              label="Xem hồ sơ"
                              onClick={() => {
                                setMenuId(null);
                                openDetail(c);
                              }}
                            />
                            <MenuItem
                              icon={<Pencil className="size-3.5" />}
                              label="Chỉnh sửa"
                              onClick={() => {
                                setMenuId(null);
                                openEdit(c);
                              }}
                            />
                            <MenuItem
                              icon={c.status === "active" ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                              label={c.status === "active" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                              destructive={c.status === "active"}
                              onClick={() => {
                                setMenuId(null);
                                void toggleStatus(c, c.status !== "active");
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pager
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={limit}
          shown={items.length}
          onPage={setPage}
          onPageSize={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </section>
    </div>
  );
}
