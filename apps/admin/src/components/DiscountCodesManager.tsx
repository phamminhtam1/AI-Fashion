import { adminErrorMessage } from "@/lib/admin-language";
import {
  ArrowLeft,
  Ban,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Copy,
  Eye,
  FileText,
  Gift,
  Image as ImageIcon,
  Info,
  MoreHorizontal,
  Pencil,
  Percent,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Tag,
  Trash2,
  Truck,
  Upload,
  User,
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
import { useConfirmDialog } from "@/components/ConfirmDialog";
import {
  adminApi,
  type AdminProduct,
  type Category,
  type DiscountCode,
  type DiscountCodeInput,
} from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Field tuỳ chọn mà API có thể trả về */
type DiscountExtra = DiscountCode & {
  description?: string | null;
  image_url?: string | null;
  banner_url?: string | null;
};

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "₫";
}

function formatValue(c: DiscountCode) {
  if (c.type === "free_shipping" || c.type === "shipping") return "Freeship";
  if (c.type === "bxgy") return "Tặng quà";
  return c.type === "percent" ? `${c.value}%` : formatVnd(c.value);
}

function typeLabel(c: DiscountCode) {
  const t = String(c.type);
  if (t === "percent") return "Giảm %";
  if (t === "fixed") return "Giảm tiền";
  if (t === "free_shipping" || t === "shipping") return "Miễn phí ship";
  if (t === "bxgy") return "Mua X tặng Y";
  return t;
}

function formatUsage(c: DiscountCode) {
  const lim = c.usage_limit == null ? "∞" : c.usage_limit.toLocaleString("vi-VN");
  return `${c.usage_count.toLocaleString("vi-VN")} / ${lim}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

type PromoState = "running" | "upcoming" | "ended" | "disabled" | "draft" | "paused";

function stateOf(c: DiscountCode): PromoState {
  if (c.status === "disabled") return "disabled";
  if (c.status === "draft") return "draft";
  if (c.status === "paused") return "paused";
  const now = new Date();
  const starts = c.starts_at ? new Date(c.starts_at) : null;
  const ends = c.ends_at ? new Date(c.ends_at) : null;
  if (ends && ends < now) return "ended";
  if (starts && starts > now) return "upcoming";
  return "running";
}

const STATE_UI: Record<PromoState, { label: string; pill: string; dot: string }> = {
  running: { label: "Đang diễn ra", pill: "bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" },
  upcoming: { label: "Sắp diễn ra", pill: "bg-blue-500/10 text-blue-700", dot: "bg-blue-500" },
  ended: { label: "Đã kết thúc", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  disabled: { label: "Đã tắt", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  draft: { label: "Đang nháp", pill: "bg-amber-500/10 text-amber-700", dot: "bg-amber-500" },
  paused: { label: "Tạm dừng", pill: "bg-orange-500/10 text-orange-700", dot: "bg-orange-500" },
};

type PromoTab = "all" | "running" | "upcoming" | "ended";

/** Tab "Đã kết thúc" gồm cả mã đã hết hạn lẫn mã đã tắt */
function tabOf(c: DiscountCode): Exclude<PromoTab, "all"> {
  const s = stateOf(c);
  return s === "disabled" ? "ended" : s === "ended" ? "ended" : s === "upcoming" ? "upcoming" : "running";
}

const emptyForm: DiscountCodeInput = {
  code: "",
  name: "",
  type: "percent",
  value: 10,
  min_order_vnd: 0,
  max_discount_vnd: null,
  starts_at: null,
  ends_at: null,
  usage_limit: null,
  status: "active",
};

type FilterState = {
  status: "all" | "active" | "disabled" | "draft" | "paused";
  type: "" | "percent" | "fixed" | "free_shipping" | "bxgy";
  usage: "" | "unused" | "partial" | "exhausted";
  dateFrom: string;
  dateTo: string;
  sortBy: string;
};

const emptyFilters: FilterState = {
  status: "all",
  type: "",
  usage: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "created_at_desc",
};

const SORT_OPTIONS = [
  { value: "created_at_desc", label: "Mới tạo nhất" },
  { value: "usage_desc", label: "Dùng nhiều nhất" },
  { value: "usage_asc", label: "Dùng ít nhất" },
  { value: "value_desc", label: "Ưu đãi cao nhất" },
  { value: "ends_at_asc", label: "Sắp hết hạn" },
];

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
        className="h-9 w-full appearance-none rounded-xs border border-slate-200 bg-white pl-3 pr-9 text-sm outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
    "grid size-9 place-items-center rounded-xs border border-slate-200 bg-white text-sm transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3.5">
      <span className="text-sm text-muted-foreground">
        Hiển thị {from} - {to} của {total.toLocaleString("vi-VN")} khuyến mãi
      </span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          <ChevronLeft className="size-4" />
        </button>
        {pageItems(page, totalPages).map((it, i) =>
          it === "…" ? (
            <span key={`e${i}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={it}
              type="button"
              onClick={() => onPage(it)}
              className={cn(btn, it === page && "border-primary bg-primary text-primary-foreground hover:bg-primary")}
            >
              {it}
            </button>
          ),
        )}
        <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <ChevronRight className="size-4" />
        </button>
        <SelectBox
          label="Số dòng mỗi trang"
          value={String(pageSize)}
          onChange={(v) => onPageSize(Number(v))}
          className="ml-2 w-32 [&_select]:h-9"
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
        "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
        destructive && "text-destructive hover:bg-destructive/10",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PromoThumb({ c }: { c: DiscountExtra }) {
  return c.image_url ? (
    <img src={c.image_url} alt={c.name} className="size-11 shrink-0 rounded-lg border border-border/60 object-cover" />
  ) : (
    <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-border/60 bg-secondary/60 text-muted-foreground">
      <Tag className="size-4" />
    </span>
  );
}

// ─── Promotion form (trang Tạo / Chỉnh sửa khuyến mãi) ───────────────────────
//
// Những phần chưa có trong API (loại Miễn phí ship / Mua X tặng Y, phạm vi sản phẩm,
// nhóm khách hàng, giới hạn mỗi khách, banner, các công tắc nâng cao…) đang là
// state cục bộ. Chúng được gom vào `PromotionExtra` và truyền cho `onSubmit`
// để bạn nối API sau — tìm các chỗ có `TODO(api)`.

type PromoKind = "percent" | "fixed" | "free_shipping" | "bxgy";
type ApplyScope = "all" | "category" | "products";
type CustomerGroup = "all" | "member" | "new" | "selected";
type StatusUi = "draft" | "active" | "paused" | "ended";

type AppliedProduct = {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  image_url?: string | null;
};

export type PromotionExtra = {
  kind: PromoKind;
  description: string;
  apply_scope: ApplyScope;
  products: AppliedProduct[];
  customer_group: CustomerGroup;
  per_customer_limit: number | null;
  apply_on_sale: boolean;
  show_on_homepage: boolean;
  stackable: boolean;
  activate_now: boolean;
  status_ui: StatusUi;
  banner_url: string | null;
};

type PromotionDetail = DiscountExtra & {
  per_customer_limit?: number | null;
  apply_scope?: ApplyScope;
  customer_group?: CustomerGroup;
  apply_on_sale?: boolean;
  show_on_homepage?: boolean;
  stackable?: boolean;
  banner_url?: string | null;
  products?: AppliedProduct[];
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const DESC_MAX = 500;
const NAME_MAX = 100;
const BANNER_MAX_BYTES = 2 * 1024 * 1024;

const KIND_OPTIONS: Array<{
  id: PromoKind;
  title: string;
  desc: string;
  icon: React.ReactNode;
  tint: string;
}> = [
    {
      id: "percent",
      title: "Giảm giá theo %",
      desc: "Giảm giá theo phần trăm giá trị đơn hàng",
      icon: <Percent className="size-5 text-violet-600" />,
      tint: "bg-violet-500/10",
    },
    {
      id: "fixed",
      title: "Giảm giá theo số tiền",
      desc: "Giảm trực tiếp số tiền trên đơn hàng",
      icon: <CircleDollarSign className="size-5 text-amber-600" />,
      tint: "bg-amber-500/10",
    },
    {
      id: "free_shipping",
      title: "Miễn phí vận chuyển",
      desc: "Miễn phí vận chuyển cho đơn hàng đủ điều kiện",
      icon: <Truck className="size-5 text-emerald-600" />,
      tint: "bg-emerald-500/10",
    },
    {
      id: "bxgy",
      title: "Mua X tặng Y",
      desc: "Mua sản phẩm X tặng sản phẩm Y",
      icon: <Gift className="size-5 text-pink-600" />,
      tint: "bg-pink-500/10",
    },
  ];

const STATUS_OPTIONS: Array<{ id: StatusUi; title: string; desc: string }> = [
  { id: "draft", title: "Đang nháp", desc: "Lưu để chỉnh sửa sau" },
  { id: "active", title: "Đang diễn ra", desc: "Kích hoạt chương trình" },
  { id: "paused", title: "Tạm dừng", desc: "Tạm dừng chương trình" },
  { id: "ended", title: "Đã kết thúc", desc: "Tự động khi hết thời gian" },
];

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function ToggleRow({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Toggle checked={checked} onChange={onChange} label={title} />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function RadioRow({
  checked,
  onChange,
  label,
  name,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  name: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="radio" name={name} className="size-4 accent-primary" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

function PCard({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xs border border-slate-200 bg-white p-4 shadow-xs", className)}>
      <h2 className="admin-section-title flex items-center gap-2.5 text-slate-900">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      <div className="mt-2">{children}</div>
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function ProductPickerModal({
  open,
  onClose,
  onAdd,
  alreadySelectedIds,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (items: AppliedProduct[]) => void;
  alreadySelectedIds: Set<string>;
}) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selected, setSelected] = useState<Map<string, AppliedProduct>>(new Map());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      adminApi
        .products({ q: search.trim() || undefined, limit: 40 })
        .then((res) => {
          if (!cancelled) setProducts(res.items);
        })
        .catch(() => { })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, search]);

  if (!open) return null;

  const toggle = (p: AdminProduct) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) {
        next.delete(p.id);
      } else {
        const primaryImg = p.media?.find((m) => m.is_cover)?.url ?? p.images?.[0] ?? null;
        next.set(p.id, {
          id: p.id,
          name: p.name,
          sku: p.variants?.[0]?.sku,
          category: p.category?.name,
          image_url: primaryImg,
        });
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">Chọn sản phẩm áp dụng khuyến mãi</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              placeholder="Tìm theo tên sản phẩm, mã SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Đang tải danh sách sản phẩm...</div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Không tìm thấy sản phẩm nào</div>
          ) : (
            products.map((p) => {
              const isAlready = alreadySelectedIds.has(p.id);
              const isChecked = isAlready || selected.has(p.id);
              const primaryImg = p.media?.find((m) => m.is_cover)?.url ?? p.images?.[0] ?? null;
              return (
                <div
                  key={p.id}
                  onClick={() => !isAlready && toggle(p)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                    isAlready
                      ? "opacity-60 bg-muted/40 cursor-not-allowed"
                      : isChecked
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:bg-secondary/40",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={isChecked}
                    disabled={isAlready}
                    onChange={() => !isAlready && toggle(p)}
                  />
                  {primaryImg ? (
                    <img src={primaryImg} alt={p.name} className="size-11 rounded-md border object-cover" />
                  ) : (
                    <span className="grid size-11 place-items-center rounded-md border bg-secondary text-muted-foreground">
                      <ImageIcon className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.category?.name && <span>{p.category.name} • </span>}
                      <span>{formatVnd(p.price_vnd)}</span>
                      {isAlready && <span className="ml-2 text-emerald-600 font-medium">(Đã có trong danh sách)</span>}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
          <span className="text-xs text-muted-foreground">Đã chọn {selected.size} sản phẩm mới</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={selected.size === 0}
              onClick={() => {
                onAdd(Array.from(selected.values()));
                onClose();
              }}
            >
              Thêm {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromotionForm({
  editing,
  saving,
  onCancel,
  onSubmit,
  onDelete,
}: {
  editing: DiscountCode | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (body: DiscountCodeInput, extra: PromotionExtra) => Promise<void>;
  onDelete?: (() => void) | undefined;
}) {
  const d = editing as PromotionDetail | null;
  const inputCls = "h-9 rounded-xs border-slate-200 bg-white px-3 text-sm";

  const [form, setForm] = useState<DiscountCodeInput>(() =>
    editing
      ? {
        code: editing.code,
        name: editing.name,
        type: (editing.type as PromoKind) || "percent",
        value: editing.value,
        min_order_vnd: editing.min_order_vnd,
        max_discount_vnd: editing.max_discount_vnd,
        starts_at: editing.starts_at,
        ends_at: editing.ends_at,
        usage_limit: editing.usage_limit,
        status: (editing.status as any) || "active",
      }
      : emptyForm,
  );
  const [startsLocal, setStartsLocal] = useState(toLocalInput(editing?.starts_at ?? null));
  const [endsLocal, setEndsLocal] = useState(toLocalInput(editing?.ends_at ?? null));
  const [kind, setKind] = useState<PromoKind>((editing?.type as PromoKind) || "percent");
  const [description, setDescription] = useState(d?.description ?? "");
  const [scope, setScope] = useState<ApplyScope>((d?.apply_scope as ApplyScope) ?? "all");
  const [products, setProducts] = useState<AppliedProduct[]>(d?.products ?? []);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    editing?.applied_category_ids ?? [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [customerGroup, setCustomerGroup] = useState<CustomerGroup>(
    (d?.customer_group as CustomerGroup) ?? "all",
  );
  const [perCustomer, setPerCustomer] = useState(
    d?.per_customer_limit != null ? String(d.per_customer_limit) : editing ? "" : "1",
  );
  const [applyOnSale, setApplyOnSale] = useState(d?.apply_on_sale ?? false);
  const [showOnHomepage, setShowOnHomepage] = useState(d?.show_on_homepage ?? false);
  const [stackable, setStackable] = useState(d?.stackable ?? false);
  const [activateNow, setActivateNow] = useState(false);
  const [statusUi, setStatusUi] = useState<StatusUi>(() => {
    if (!editing) return "draft";
    if (editing.status === "draft") return "draft";
    if (editing.status === "paused" || editing.status === "disabled") return "paused";
    const s = stateOf(editing);
    return s === "ended" ? "ended" : "active";
  });
  const [banner, setBanner] = useState<string | null>(d?.banner_url ?? d?.image_url ?? null);
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(!editing);

  useEffect(() => {
    adminApi
      .categories()
      .then((res) => setCategoryList(res.items))
      .catch(() => { });
  }, []);

  const isMoney = kind === "fixed";
  const valueText =
    kind === "percent"
      ? `${form.value || 0}%`
      : kind === "free_shipping"
        ? "Freeship"
        : kind === "bxgy"
          ? "Tặng quà"
          : formatVnd(form.value || 0);

  const scopeText =
    scope === "all"
      ? "tất cả sản phẩm"
      : scope === "category"
        ? `${selectedCategoryIds.length} danh mục được chọn`
        : `${products.length} sản phẩm được chọn`;

  async function pickBanner(file?: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      toast.error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP");
      return;
    }
    if (file.size > BANNER_MAX_BYTES) {
      toast.error("Ảnh tối đa 2MB");
      return;
    }
    setUploadingBanner(true);
    try {
      const res = await adminApi.uploadDiscountCodeImage(file);
      setBanner(res.url);
      toast.success("Đã tải ảnh banner lên");
    } catch {
      const reader = new FileReader();
      reader.onload = () => setBanner(String(reader.result));
      reader.readAsDataURL(file);
    } finally {
      setUploadingBanner(false);
    }
  }

  function handleActivateNow(on: boolean) {
    setActivateNow(on);
    if (on) setStartsLocal(toLocalInput(new Date().toISOString()));
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Nhập tên chương trình");
      return;
    }
    if (!form.code.trim()) {
      toast.error("Nhập mã code");
      return;
    }
    const starts = fromLocalInput(startsLocal);
    const ends = fromLocalInput(endsLocal);
    if (starts && ends && new Date(ends) <= new Date(starts)) {
      toast.error("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    const body: DiscountCodeInput = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      type: kind,
      value: kind === "free_shipping" ? (form.value || 100) : form.value,
      starts_at: starts,
      ends_at: ends,
      max_discount_vnd: kind === "percent" ? (form.max_discount_vnd ?? null) : null,
      status: statusUi,
      description: description.trim() || null,
      image_url: banner,
      banner_url: banner,
      apply_scope: scope,
      products,
      applied_category_ids: selectedCategoryIds,
      customer_group: customerGroup,
      per_customer_limit: perCustomer === "" ? null : Number(perCustomer) || null,
      apply_on_sale: applyOnSale,
      show_on_homepage: showOnHomepage,
      stackable,
    };
    const extra: PromotionExtra = {
      kind,
      description: description.trim(),
      apply_scope: scope,
      products,
      customer_group: customerGroup,
      per_customer_limit: perCustomer === "" ? null : Number(perCustomer) || null,
      apply_on_sale: applyOnSale,
      show_on_homepage: showOnHomepage,
      stackable,
      activate_now: activateNow,
      status_ui: statusUi,
      banner_url: banner,
    };
    await onSubmit(body, extra);
  }

  return (
    <div className="space-y-5 pb-12 font-sans">
      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        alreadySelectedIds={new Set(products.map((p) => p.id))}
        onAdd={(newItems) => setProducts((prev) => [...prev, ...newItems])}
      />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            className="mt-0.5 size-9 shrink-0 rounded-xs border-slate-200 bg-white"
            onClick={onCancel}
            aria-label="Quay lại"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="admin-page-title text-slate-900">
              {editing ? "Chỉnh sửa khuyến mãi" : "Tạo khuyến mãi mới"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {editing
                ? "Cập nhật thông tin chương trình khuyến mãi. Các thay đổi sẽ được áp dụng sau khi lưu."
                : "Thiết lập thông tin chi tiết cho chương trình khuyến mãi."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-medium" onClick={onCancel}>
            Hủy
          </Button>
          {editing && (
            <Button
              variant="outline"
              className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-medium"
              onClick={() => setShowPreview((v) => !v)}
            >
              <Eye className="size-4" />
              Xem trước
            </Button>
          )}
          <Button className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white hover:bg-[#53389e]" disabled={saving} onClick={() => void submit()}>
            {editing && <Save className="size-4" />}
            {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Lưu khuyến mãi"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ============ LEFT ============ */}
        <div className="space-y-5">
          <PCard title="Thông tin cơ bản" icon={<FileText className="size-4" />}>
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <PField label="Tên chương trình" required>
                <Input
                  className={inputCls}
                  placeholder="Nhập tên chương trình khuyến mãi"
                  maxLength={NAME_MAX}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <span className="mt-1 block text-right text-xs text-muted-foreground">
                  {form.name.length}/{NAME_MAX}
                </span>
              </PField>
              <PField label="Mã code" required>
                <div className="flex gap-2">
                  <Input
                    className={inputCls}
                    placeholder="Nhập mã khuyến mãi"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 border-0 bg-primary/10 px-4 text-primary hover:bg-primary/15"
                    onClick={() => setForm((f) => ({ ...f, code: randomCode() }))}
                  >
                    Tạo ngẫu nhiên
                  </Button>
                </div>
              </PField>
            </div>
            <div className="mt-5">
              <PField label="Mô tả">
                <textarea
                  className="min-h-24 w-full resize-y rounded-lg border border-input bg-white p-3.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                  placeholder="Nhập mô tả chương trình…"
                  maxLength={DESC_MAX}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <span className="mt-1 block text-right text-xs text-muted-foreground">
                  {description.length}/{DESC_MAX}
                </span>
              </PField>
            </div>
          </PCard>

          <PCard title="Loại khuyến mãi" icon={<Tag className="size-4" />}>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {KIND_OPTIONS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
                    kind === k.id
                      ? "border-primary/60 bg-accent/30 ring-1 ring-primary/30"
                      : "border-border hover:bg-secondary/40",
                  )}
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", k.tint)}>{k.icon}</span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-medium", kind === k.id && "text-primary")}>{k.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{k.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </PCard>

          <PCard title="Giá trị khuyến mãi" icon={<Percent className="size-4" />}>
            <div className="grid gap-6 md:grid-cols-2">
              {kind === "free_shipping" ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <span className="text-sm font-semibold text-emerald-800">Miễn phí vận chuyển</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Khách hàng được miễn phí 100% phí giao hàng khi đơn thỏa mãn điều kiện áp dụng.
                  </p>
                </div>
              ) : kind === "bxgy" ? (
                <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-4">
                  <span className="text-sm font-semibold text-pink-800">Mua X tặng Y</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Áp dụng chương trình quà tặng hoặc tặng kèm cho các sản phẩm đã chọn bên dưới.
                  </p>
                </div>
              ) : (
                <PField label={`Giá trị giảm giá (${isMoney ? "₫" : "%"})`} required>
                  <div className="flex">
                    <Input
                      className={cn(inputCls, "rounded-r-none")}
                      type="number"
                      min={0}
                      placeholder="Nhập giá trị giảm giá"
                      value={form.value || ""}
                      onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) || 0 }))}
                    />
                    <span className="grid h-11 w-12 shrink-0 place-items-center rounded-r-lg border border-l-0 border-border/70 bg-secondary/50 text-sm text-muted-foreground">
                      {isMoney ? "₫" : "%"}
                    </span>
                  </div>
                </PField>
              )}
              <div>
                <span className="text-sm font-medium">Phạm vi áp dụng</span>
                <div className="mt-3 space-y-2.5">
                  <RadioRow name="scope" checked={scope === "all"} onChange={() => setScope("all")} label="Áp dụng cho toàn bộ sản phẩm" />
                  <RadioRow name="scope" checked={scope === "category"} onChange={() => setScope("category")} label="Chọn danh mục" />
                  <RadioRow name="scope" checked={scope === "products"} onChange={() => setScope("products")} label="Áp dụng cho sản phẩm cụ thể" />
                </div>
              </div>
            </div>

            {scope === "products" && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Sản phẩm áp dụng ({products.length})</h3>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2 bg-white"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Plus className="size-4" />
                    Thêm sản phẩm
                  </Button>
                </div>
                {products.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    Chưa chọn sản phẩm nào. Nhấn &quot;Thêm sản phẩm&quot; để chọn từ kho.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                    {products.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 p-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="size-12 rounded-md border border-border object-cover" />
                        ) : (
                          <span className="grid size-12 place-items-center rounded-md border border-border bg-secondary text-muted-foreground">
                            <ImageIcon className="size-4" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.sku && <>SKU: {p.sku}</>}
                            {p.sku && p.category && <span className="mx-2">|</span>}
                            {p.category && <>Danh mục: {p.category}</>}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Bỏ ${p.name}`}
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setProducts((ps) => ps.filter((x) => x.id !== p.id))}
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {scope === "category" && (
              <div className="mt-6 space-y-3">
                <span className="text-sm font-semibold">
                  Chọn danh mục áp dụng ({selectedCategoryIds.length} đã chọn)
                </span>
                {categoryList.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                    Đang tải danh sách danh mục...
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {categoryList.map((cat) => {
                      const checked = selectedCategoryIds.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-xs font-medium transition-colors",
                            checked
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border hover:bg-secondary/40",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={checked}
                            onChange={() => {
                              setSelectedCategoryIds((prev) =>
                                checked ? prev.filter((id) => id !== cat.id) : [...prev, cat.id],
                              );
                            }}
                          />
                          <span className="truncate">{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </PCard>

          <PCard title="Thời gian áp dụng" icon={<Calendar className="size-4" />}>
            <div className="grid gap-5 md:grid-cols-[1fr_1fr_1fr]">
              <PField label="Ngày bắt đầu">
                <Input
                  className={inputCls}
                  type="datetime-local"
                  value={startsLocal}
                  disabled={activateNow}
                  onChange={(e) => setStartsLocal(e.target.value)}
                />
              </PField>
              <PField label="Ngày kết thúc">
                <Input
                  className={inputCls}
                  type="datetime-local"
                  value={endsLocal}
                  onChange={(e) => setEndsLocal(e.target.value)}
                />
              </PField>
              <div>
                <span className="text-sm font-medium">Kích hoạt ngay</span>
                <div className="mt-2 flex items-start gap-3">
                  <Toggle checked={activateNow} onChange={handleActivateNow} label="Kích hoạt ngay" />
                  <p className="text-xs text-muted-foreground">
                    Chương trình sẽ được kích hoạt ngay sau khi lưu thay đổi.
                  </p>
                </div>
              </div>
            </div>
          </PCard>

          <PCard title="Điều kiện sử dụng" icon={<SlidersHorizontal className="size-4" />}>
            <div className="grid gap-5 md:grid-cols-3">
              <PField label="Giá trị đơn hàng tối thiểu (VNĐ)" hint="Áp dụng khi giá trị đơn hàng đạt mức tối thiểu">
                <Input
                  className={inputCls}
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.min_order_vnd ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, min_order_vnd: Number(e.target.value) || 0 }))}
                />
              </PField>
              <PField label="Giảm giá tối đa (VNĐ)" hint="Số tiền giảm tối đa cho mỗi đơn hàng">
                <Input
                  className={inputCls}
                  type="number"
                  min={0}
                  placeholder="Không giới hạn"
                  disabled={kind !== "percent"}
                  value={form.max_discount_vnd ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      max_discount_vnd: e.target.value === "" ? null : Number(e.target.value) || 0,
                    }))
                  }
                />
              </PField>
              <PField label="Đối tượng khách hàng" hint="Chọn nhóm khách hàng áp dụng">
                <div className="relative">
                  <select
                    className="h-11 w-full appearance-none rounded-lg border border-border/70 bg-white pl-3.5 pr-9 text-sm outline-none focus:ring-1 focus:ring-ring"
                    value={customerGroup}
                    onChange={(e) => setCustomerGroup(e.target.value as CustomerGroup)}
                  >
                    {/* TODO(api): nhóm khách hàng lấy từ backend */}
                    <option value="all">Tất cả khách hàng</option>
                    <option value="member">Khách hàng thành viên</option>
                    <option value="new">Khách hàng mới</option>
                    <option value="selected">Khách hàng được chọn</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </PField>
            </div>
          </PCard>

          {/* Trạng thái dạng radio (khi tạo mới) */}
          {!editing && (
            <PCard title="Trạng thái">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {STATUS_OPTIONS.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="radio"
                      name="status_ui"
                      className="mt-1 size-4 accent-primary"
                      checked={statusUi === s.id}
                      onChange={() => setStatusUi(s.id)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{s.title}</span>
                      <span className="block text-xs text-muted-foreground">{s.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </PCard>
          )}
        </div>

        {/* ============ RIGHT ============ */}
        <div className="space-y-5">
          <PCard title="Cài đặt nâng cao" icon={<Settings2 className="size-4" />}>
            <div className="space-y-5">
              <PField label="Số lượt sử dụng tối đa" hint="Để trống nếu không giới hạn">
                <Input
                  className={inputCls}
                  type="number"
                  min={0}
                  placeholder="Không giới hạn"
                  value={form.usage_limit ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      usage_limit: e.target.value === "" ? null : Number(e.target.value) || 0,
                    }))
                  }
                />
              </PField>
              <PField label="Số lần sử dụng mỗi khách hàng" hint="Giới hạn số lần mỗi khách hàng có thể sử dụng mã này">
                <Input
                  className={inputCls}
                  type="number"
                  min={0}
                  placeholder="Không giới hạn"
                  value={perCustomer}
                  onChange={(e) => setPerCustomer(e.target.value)}
                />
              </PField>
              <ToggleRow
                checked={applyOnSale}
                onChange={setApplyOnSale}
                title="Áp dụng cho sản phẩm đang giảm giá"
                desc="Cho phép áp dụng mã này cho các sản phẩm đã có khuyến mãi khác"
              />
              <ToggleRow
                checked={showOnHomepage}
                onChange={setShowOnHomepage}
                title="Hiển thị trên trang chủ"
                desc="Hiển thị chương trình khuyến mãi này trên trang chủ"
              />
              <ToggleRow
                checked={stackable}
                onChange={setStackable}
                title="Kết hợp với mã khác"
                desc="Cho phép kết hợp với các mã khuyến mãi khác"
              />
            </div>
          </PCard>

          {editing && (
            <PCard title="Trạng thái" icon={<Clock className="size-4" />}>
              <div className="relative">
                <select
                  aria-label="Trạng thái chương trình"
                  className={cn(
                    "h-11 w-full appearance-none rounded-lg border pl-9 pr-9 text-sm font-medium outline-none",
                    statusUi === "active"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                      : "border-border bg-white",
                  )}
                  value={statusUi}
                  onChange={(e) => setStatusUi(e.target.value as StatusUi)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <span
                  className={cn(
                    "pointer-events-none absolute left-3.5 top-1/2 size-2 -translate-y-1/2 rounded-full",
                    statusUi === "active" ? "bg-emerald-500" : "bg-muted-foreground/60",
                  )}
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <dl className="mt-4 divide-y divide-border rounded-lg border border-border text-sm">
                <div className="flex items-center justify-between gap-3 p-3">
                  <dt className="flex items-center gap-2.5 text-muted-foreground">
                    <User className="size-4" /> Tạo bởi
                  </dt>
                  <dd className="text-right">
                    <p>{d?.created_by_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(d?.created_at ?? null) ?? "—"}</p>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 p-3">
                  <dt className="flex items-center gap-2.5 text-muted-foreground">
                    <RefreshCw className="size-4" /> Cập nhật gần nhất
                  </dt>
                  <dd className="text-right">
                    <p>{d?.updated_by_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(d?.updated_at ?? null) ?? "—"}</p>
                  </dd>
                </div>
              </dl>
            </PCard>
          )}

          <PCard title="Hình ảnh banner" icon={<ImageIcon className="size-4" />}>
            {/* TODO(api): upload banner */}
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickBanner(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
                dragOver ? "border-primary bg-accent/30" : "border-border bg-white hover:bg-secondary/30",
              )}
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => pickBanner(e.target.files?.[0])}
              />
              <Upload className="size-6 text-muted-foreground" />
              <span className="text-sm">Kéo thả hình ảnh hoặc chọn file</span>
              <span className="text-xs text-muted-foreground">JPG, PNG, WebP. Tối đa 2MB.</span>
            </label>
            {banner && (
              <div className="relative mt-3 overflow-hidden rounded-lg border border-border">
                <img src={banner} alt="Banner khuyến mãi" className="aspect-[16/9] w-full object-cover" />
                <button
                  type="button"
                  aria-label="Xóa banner"
                  className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/75"
                  onClick={() => setBanner(null)}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </PCard>

          {showPreview && (
            <PCard title="Xem trước">
              <div className="flex items-stretch overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
                <div className="grid w-20 shrink-0 place-items-center border-r border-dashed border-primary/30 bg-primary/10">
                  <Percent className="size-7 text-primary" />
                </div>
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold">{form.code || "MÃ KHUYẾN MÃI"}</p>
                    <span className="shrink-0 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
                      Giảm {valueText}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Giảm {valueText} cho {scopeText}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="size-3" />
                    {fmtDate(fromLocalInput(startsLocal)) ?? "Ngay lập tức"} –{" "}
                    {fmtDate(fromLocalInput(endsLocal)) ?? "Không hết hạn"}
                  </p>
                </div>
              </div>
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-blue-500/10 px-3 py-2.5 text-xs text-blue-800">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                  Đây là bản xem trước hiển thị cho khách hàng. Giao diện thực tế có thể thay đổi tùy theo vị trí hiển thị.
                </span>
              </p>
            </PCard>
          )}

          {editing && onDelete && (
            <section className="rounded-xl border border-red-200 bg-red-50/60 p-5">
              <h2 className="flex items-center gap-2.5 text-base font-semibold text-red-600">
                <Trash2 className="size-4" />
                Xóa khuyến mãi
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Hành động này không thể hoàn tác. Chương trình khuyến mãi sẽ bị vô hiệu hóa.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 h-11 w-full gap-2 border-red-300 bg-white text-red-600 hover:bg-red-50"
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
                Xóa khuyến mãi
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DiscountCodesManager() {
  const [items, setItems] = useState<DiscountCode[]>([]);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(emptyFilters);
  const [tab, setTab] = useState<PromoTab>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.discountCodes({
        ...(filters.status !== "all" ? { status: filters.status } : {}),
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.usage ? { usage: filters.usage } : {}),
        ...(filters.sortBy !== "created_at_desc" ? { sort_by: filters.sortBy } : {}),
      });
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không tải được mã giảm giá");
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.type, filters.usage, filters.sortBy, query]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab, filters, query, pageSize]);

  // Lọc theo khoảng thời gian chương trình (chồng lấn với [từ, đến])
  const baseItems = useMemo(() => {
    if (!filters.dateFrom && !filters.dateTo) return items;
    const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : -Infinity;
    const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`).getTime() : Infinity;
    return items.filter((c) => {
      const s = c.starts_at ? new Date(c.starts_at).getTime() : -Infinity;
      const e = c.ends_at ? new Date(c.ends_at).getTime() : Infinity;
      return e >= from && s <= to;
    });
  }, [items, filters.dateFrom, filters.dateTo]);

  const counts = useMemo(() => {
    const n = { all: baseItems.length, running: 0, upcoming: 0, ended: 0 };
    for (const c of baseItems) n[tabOf(c)] += 1;
    return n;
  }, [baseItems]);

  const visible = useMemo(
    () => (tab === "all" ? baseItems : baseItems.filter((c) => tabOf(c) === tab)),
    [baseItems, tab],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const paged = useMemo(
    () => visible.slice((page - 1) * pageSize, page * pageSize),
    [visible, page, pageSize],
  );

  const advancedCount = (filters.usage ? 1 : 0) + (filters.sortBy !== "created_at_desc" ? 1 : 0);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (filters.usage) {
      const labels: Record<string, string> = { unused: "Chưa dùng", partial: "Đang dùng", exhausted: "Hết lượt" };
      chips.push({
        key: "usage",
        label: `Sử dụng: ${labels[filters.usage] ?? filters.usage}`,
        clear: () => setFilters((f) => ({ ...f, usage: "" })),
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

  const location = useLocation();
  const navigate = useNavigate();

  const openCreateInternal = useCallback(() => {
    setEditing(null);
    setOpen(true);
  }, []);

  const openEditInternal = useCallback((c: DiscountCode) => {
    setEditing(c);
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    navigate({ to: "/khuyenmai" });
  }, [navigate]);

  useEffect(() => {
    const route = resolveAdminPath(location.pathname);
    if (route.tabId !== "promotions") return;

    if (route.action === "create") {
      openCreateInternal();
    } else if (route.action === "edit" && route.subParam) {
      const target = route.subParam;
      const found = items.find(
        (x) => x.id === target || x.code.toLowerCase() === target.toLowerCase(),
      );
      if (found) {
        openEditInternal(found);
      } else if (!loading) {
        adminApi
          .discountCodes({ q: target })
          .then((res) => {
            const c = res.items.find(
              (x) => x.id === target || x.code.toLowerCase() === target.toLowerCase(),
            );
            if (c) openEditInternal(c);
          })
          .catch(() => { });
      }
    } else {
      setOpen(false);
    }
  }, [location.pathname, items, loading, openCreateInternal, openEditInternal]);

  function openCreate() {
    navigate({ to: "/khuyenmai/them" });
  }

  function openEdit(c: DiscountCode) {
    navigate({ to: `/khuyenmai/sua/${c.id}` });
  }

  async function save(body: DiscountCodeInput, _extra: PromotionExtra) {
    // TODO(api): gửi thêm `_extra` (mô tả, phạm vi sản phẩm, nhóm khách hàng,
    // giới hạn mỗi khách, banner, công tắc nâng cao…) khi backend hỗ trợ.
    setSaving(true);
    try {
      if (editing) {
        await adminApi.patchDiscountCode(editing.id, body);
        toast.success("Đã cập nhật khuyến mãi");
      } else {
        await adminApi.createDiscountCode(body);
        toast.success("Đã tạo khuyến mãi");
      }
      closeDialog();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function removePromo(c: DiscountCode) {
    const ok = await confirm({
      title: "Xóa khuyến mãi vĩnh viễn?",
      description: `Chương trình "${c.name}" (${c.code}) sẽ bị xóa hoàn toàn khỏi hệ thống. Hành động này không thể hoàn tác.`,
      confirmLabel: "Xóa vĩnh viễn",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteDiscountCode(c.id, true);
      toast.success("Đã xóa khuyến mãi");
      if (open) closeDialog();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không xóa được khuyến mãi");
    }
  }

  async function disable(c: DiscountCode) {
    try {
      await adminApi.deleteDiscountCode(c.id, false);
      toast.success("Đã vô hiệu hóa");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không vô hiệu hóa được");
    }
  }

  async function enable(c: DiscountCode) {
    try {
      const body: Partial<DiscountCodeInput> = {
        code: c.code,
        name: c.name,
        type: (c.type as any) || "percent",
        value: c.value,
        min_order_vnd: c.min_order_vnd,
        max_discount_vnd: c.max_discount_vnd,
        starts_at: c.starts_at,
        ends_at: c.ends_at,
        usage_limit: c.usage_limit,
        status: "active",
      };
      await adminApi.patchDiscountCode(c.id, body);
      toast.success("Đã bật lại mã");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không bật lại được");
    }
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setDraftFilters(emptyFilters);
    setQueryInput("");
    setQuery("");
    setTab("all");
  }

  if (open) {
    return (
      <>
        {confirmDialog}
        <PromotionForm
          key={editing?.id ?? "new"}
          editing={editing}
          saving={saving}
          onCancel={closeDialog}
          onSubmit={save}
          onDelete={editing ? () => void removePromo(editing) : undefined}
        />
      </>
    );
  }

  return (
    <>
      {confirmDialog}
      <div className="space-y-5 font-sans pb-12">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div>
              <h1 className="admin-page-title text-slate-900">Khuyến mãi</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Quản lý các chương trình khuyến mãi, mã giảm giá và ưu đãi cho khách hàng.
              </p>
            </div>
          </div>
          <Button asChild className="h-9 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white hover:bg-[#53389e]">
            <a
              href="/khuyenmai/them"
              onClick={(e) => {
                e.preventDefault();
                openCreate();
              }}
            >
              <Plus className="mr-2 size-4" /> Tạo khuyến mãi
            </a>
          </Button>
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Tabs */}
          <div className="flex gap-6 border-b border-border px-5 pt-3">
            {(
              [
                ["all", "Tất cả"],
                ["running", "Đang diễn ra"],
                ["upcoming", "Sắp diễn ra"],
                ["ended", "Đã kết thúc"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label} ({counts[id]})
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 rounded-lg border-border/70 bg-white pl-9 pr-9"
                  placeholder="Tìm kiếm theo tên, mã, mô tả…"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
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

              <SelectBox
                label="Loại"
                value={filters.type}
                onChange={(v) => setFilters((f) => ({ ...f, type: v as FilterState["type"] }))}
                className="w-44"
                options={[
                  { value: "", label: "Tất cả loại" },
                  { value: "percent", label: "Giảm %" },
                  { value: "fixed", label: "Giảm tiền" },
                  { value: "free_shipping", label: "Miễn phí ship" },
                  { value: "bxgy", label: "Mua X tặng Y" },
                ]}
              />
              <SelectBox
                label="Trạng thái"
                value={filters.status}
                onChange={(v) => setFilters((f) => ({ ...f, status: v as FilterState["status"] }))}
                className="w-48"
                options={[
                  { value: "all", label: "Tất cả trạng thái" },
                  { value: "active", label: "Đang bật" },
                  { value: "draft", label: "Đang nháp" },
                  { value: "paused", label: "Tạm dừng" },
                  { value: "disabled", label: "Đã tắt" },
                ]}
              />

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 gap-2 rounded-lg border-border/70 bg-white font-normal",
                      (filters.dateFrom || filters.dateTo) && "border-primary/40 bg-accent/40",
                    )}
                  >
                    <Calendar className="size-4" />
                    {filters.dateFrom || filters.dateTo
                      ? `${filters.dateFrom ? fmtDate(filters.dateFrom) : "…"} – ${filters.dateTo ? fmtDate(filters.dateTo) : "…"}`
                      : "Chọn khoảng thời gian"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 space-y-3 p-4">
                  <label className="block text-xs font-medium">
                    Từ ngày
                    <Input
                      type="date"
                      className="mt-1.5 h-9"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs font-medium">
                    Đến ngày
                    <Input
                      type="date"
                      className="mt-1.5 h-9"
                      value={filters.dateTo}
                      onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters((f) => ({ ...f, dateFrom: "", dateTo: "" }))}
                  >
                    Xóa khoảng thời gian
                  </Button>
                </PopoverContent>
              </Popover>

              <Popover onOpenChange={(o) => o && setDraftFilters(filters)}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-10 gap-2 rounded-lg border-border/70 bg-white",
                      advancedCount > 0 && "border-primary/40 bg-accent/40",
                    )}
                  >
                    <SlidersHorizontal className="size-4" />
                    Lọc
                    {advancedCount > 0 && (
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {advancedCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[320px] p-0 shadow-xl">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold">Bộ lọc nâng cao</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Lọc theo lượt sử dụng và cách sắp xếp.</p>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium">Lượt sử dụng</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { v: "", l: "Tất cả" },
                          { v: "unused", l: "Chưa dùng" },
                          { v: "partial", l: "Đang dùng" },
                          { v: "exhausted", l: "Hết lượt" },
                        ].map(({ v, l }) => (
                          <button
                            key={v || "all"}
                            type="button"
                            onClick={() => setDraftFilters((f) => ({ ...f, usage: v as FilterState["usage"] }))}
                            className={cn(
                              "rounded-md border px-2 py-1.5 text-sm transition-colors",
                              draftFilters.usage === v
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-white text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium">Sắp xếp</span>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none"
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
                  <div className="flex justify-between border-t border-border px-4 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const reset = { ...filters, usage: "" as const, sortBy: "created_at_desc" };
                        setDraftFilters(reset);
                        setFilters(reset);
                      }}
                    >
                      Xóa lọc
                    </Button>
                    <Button type="button" size="sm" onClick={() => setFilters(draftFilters)}>
                      Áp dụng
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-white px-2.5 py-1 text-xs transition-colors hover:border-primary/40"
                  >
                    {chip.label}
                    <X className="size-3 opacity-60" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Xóa tất cả
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
              <thead className="bg-slate-50/80">
                <tr className="border-b border-slate-200 text-sm font-semibold tracking-tight text-slate-700">
                  <th className="w-12 px-4 py-3.5 font-medium">#</th>
                  <th className="px-4 py-3.5">Tên chương trình</th>
                  <th className="px-4 py-3.5">Mã code</th>
                  <th className="px-4 py-3.5">Loại</th>
                  <th className="px-4 py-3.5">Giá trị</th>
                  <th className="px-4 py-3.5">Thời gian</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5">Lượt dùng</th>
                  <th className="w-24 whitespace-nowrap px-3 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm text-muted-foreground">
                      Đang tải…
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="grid place-items-center gap-2">
                        <Tag className="size-8 text-muted-foreground/40" />
                        <p className="text-sm font-medium">Không tìm thấy khuyến mãi</p>
                        <p className="text-sm text-muted-foreground">Thử điều chỉnh bộ lọc hoặc tạo khuyến mãi mới.</p>
                        <Button variant="outline" size="sm" onClick={resetFilters} className="mt-1 bg-white">
                          Xóa bộ lọc
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paged.map((c, idx) => {
                    const x = c as DiscountExtra;
                    const st = stateOf(c);
                    const ui = STATE_UI[st];
                    const start = fmtDate(c.starts_at);
                    const end = fmtDate(c.ends_at);
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border/70 transition-colors last:border-b-0 hover:bg-secondary/30"
                      >
                        <td className="px-4 py-4 text-muted-foreground">{(page - 1) * pageSize + idx + 1}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <PromoThumb c={x} />
                            <div className="min-w-0">
                              <a
                                href={`/khuyenmai/sua/${c.id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  openEdit(c);
                                }}
                                className="block max-w-[240px] truncate text-[14px] font-semibold hover:underline"
                              >
                                {c.name}
                              </a>
                              <p className="max-w-[240px] truncate text-xs text-muted-foreground">
                                {x.description ||
                                  (c.min_order_vnd ? `Đơn tối thiểu ${formatVnd(c.min_order_vnd)}` : "Áp dụng cho mọi đơn hàng")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-foreground/85">{c.code}</td>
                        <td className="px-4 py-4 text-foreground/85">{typeLabel(c)}</td>
                        <td className="px-4 py-4 font-semibold tabular-nums">{formatValue(c)}</td>
                        <td className="px-4 py-4 text-foreground/85 tabular-nums">
                          <p>{start ?? "Ngay lập tức"}</p>
                          <p>{end ?? "Không hết hạn"}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium",
                              ui.pill,
                            )}
                          >
                            <span className={cn("size-1.5 rounded-full", ui.dot)} />
                            {ui.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 tabular-nums text-foreground/85">{formatUsage(c)}</td>
                        <td className="px-3 py-4 text-right">
                          <Popover open={menuId === c.id} onOpenChange={(o) => setMenuId(o ? c.id : null)}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8" aria-label={`Thao tác với ${c.code}`}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-52 p-1">
                              <MenuItem
                                icon={<Pencil className="size-3.5" />}
                                label="Chỉnh sửa"
                                onClick={() => {
                                  setMenuId(null);
                                  openEdit(c);
                                }}
                              />
                              <MenuItem
                                icon={<Copy className="size-3.5" />}
                                label="Sao chép mã"
                                onClick={() => {
                                  setMenuId(null);
                                  void navigator.clipboard.writeText(c.code).then(
                                    () => toast.success(`Đã sao chép ${c.code}`),
                                    () => toast.error("Không sao chép được"),
                                  );
                                }}
                              />
                              {c.status === "active" ? (
                                <MenuItem
                                  icon={<Ban className="size-3.5" />}
                                  label="Vô hiệu hóa"
                                  onClick={() => {
                                    setMenuId(null);
                                    void disable(c);
                                  }}
                                />
                              ) : (
                                <MenuItem
                                  icon={<Power className="size-3.5" />}
                                  label="Bật lại"
                                  onClick={() => {
                                    setMenuId(null);
                                    void enable(c);
                                  }}
                                />
                              )}
                              <div className="my-1 border-t border-border/60" />
                              <MenuItem
                                icon={<Trash2 className="size-3.5" />}
                                label="Xóa khuyến mãi"
                                destructive
                                onClick={() => {
                                  setMenuId(null);
                                  void removePromo(c);
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
            total={visible.length}
            pageSize={pageSize}
            shown={paged.length}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </section>

      </div>
    </>
  );
}
