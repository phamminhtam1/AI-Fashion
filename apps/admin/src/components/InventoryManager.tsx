import { adminErrorMessage } from "@/lib/admin-language";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { resolveAdminPath } from "@/lib/routes";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  LayoutGrid,
  Loader2,
  Lock,
  MoreHorizontal,
  Package,
  PackageMinus,
  PackagePlus,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  ArrowRightLeft,
  FileText,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import type {
  AdminProduct,
  InventoryDocumentDetail,
  InventoryDocumentListItem,
  InventoryItem,
} from "@/lib/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const PAGE_SIZE = 10;

function resolveImageUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function fmtVND(n: number | null | undefined) {
  if (n == null) return "—";
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

function fmtDateParts(s: string | null | undefined) {
  if (!s) return { date: "—", time: "" };
  const d = new Date(s);
  return {
    date: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
}

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`Đã sao chép ${label}`),
    () => toast.error("Không copy được"),
  );
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Types ───────────────────────────────────────────────────────────────────

type MainView = "stock" | "docs" | "doc_detail" | "form";
type StockFilter = "all" | "low" | "out" | "safe";
type DocStatusTab = "all" | "draft" | "submitted" | "approved" | "posted" | "void";
type DocType = "receipt" | "issue" | "adjustment";

/** Các field tuỳ chọn mà API có thể trả về */
type StockRow = InventoryItem & {
  category_name?: string | null;
  incoming?: number | null;
  warehouse_code?: string | null;
};
type DocRow = InventoryDocumentListItem & {
  warehouse_code?: string | null;
  created_by_name?: string | null;
  created_by_role?: string | null;
  approved_by_name?: string | null;
  approved_by_role?: string | null;
};

type CatalogVariant = {
  id: string;
  color: string;
  size: string;
  sku: string;
  available: number;
  on_hand?: number;
  reserved?: number;
  price_vnd?: number;
  cost_vnd?: number | null;
  image_url?: string | null;
};

type CatalogProduct = {
  id: string;
  name: string;
  image_url?: string | null;
  variants: CatalogVariant[];
};

function mapAdminProductsToCatalog(
  prods: AdminProduct[],
  invByVariant: Map<string, InventoryItem>,
): CatalogProduct[] {
  const list: CatalogProduct[] = [];
  for (const p of prods) {
    const coverImg =
      p.images?.[0] ||
      p.media?.find((m) => (m as { isCover?: boolean; is_cover?: boolean }).isCover || (m as { isCover?: boolean; is_cover?: boolean }).is_cover)?.url ||
      p.media?.[0]?.url ||
      null;
    const variants: CatalogVariant[] = [];
    for (const v of p.variants ?? []) {
      if (v.status === "archived" || v.status === "inactive") continue;
      const inv = invByVariant.get(v.id);
      const cwMedia =
        p.media?.find((m) => m.colorway_id === v.colorway_id)?.url ||
        p.colorways?.find((cw) => cw.id === v.colorway_id)?.thumbnail ||
        p.colorways?.find((cw) => cw.id === v.colorway_id)?.images?.[0];
      const variantImg = cwMedia || v.image_url || inv?.image_url || coverImg;

      variants.push({
        id: v.id,
        color: v.color?.name ?? v.color_name ?? "—",
        size: v.size?.label ?? v.size_label ?? "—",
        sku: v.sku,
        on_hand: inv?.on_hand ?? v.on_hand ?? 0,
        reserved: inv?.reserved ?? v.reserved ?? 0,
        available: inv?.available ?? v.available ?? 0,
        price_vnd: inv?.price_vnd ?? v.price_vnd ?? p.price_vnd ?? 0,
        cost_vnd:
          inv?.cost_vnd ??
          v.cost_vnd ??
          p.cost_vnd ??
          (v.price_vnd ? Math.round(v.price_vnd * 0.3) : null),
        image_url: variantImg,
      });
    }
    if (!variants.length) continue;
    variants.sort((a, b) =>
      `${a.color} ${a.size}`.localeCompare(`${b.color} ${b.size}`, "vi"),
    );
    list.push({ id: p.id, name: p.name, image_url: coverImg, variants });
  }
  list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return list;
}

export type InventorySeed = {
  productId?: string;
  productName?: string;
  docType?: "receipt" | "issue" | "adjustment";
  orderId?: string;
  orderNumber?: string;
  reason?: string;
  lines?: Array<{
    product_id: string;
    variant_id: string;
    qty: number;
    direction?: "in" | "out";
    sku?: string;
    product_name?: string;
    color_label?: string | null;
    size_label?: string | null;
    unit_cost_vnd?: number;
    image_url?: string | null;
  }>;
};

type LineDraft = {
  product_id: string;
  variant_id: string;
  qty: string;
  direction: "in" | "out";
  sku?: string;
  product_name?: string;
  color_label?: string | null;
  size_label?: string | null;
  unit_cost_vnd?: number;
  cost_input?: string;
  image_url?: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<DocType, string> = {
  receipt: "Nhập kho",
  issue: "Xuất kho",
  adjustment: "Điều chỉnh",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  submitted: "Chờ duyệt",
  approved: "Đã duyệt",
  posted: "Đã ghi sổ",
  void: "Đã hủy",
};

const STOCK_COLS = [
  { key: "product", label: "Sản phẩm" },
  { key: "variant", label: "Phân loại" },
  { key: "warehouse", label: "Kho" },
  { key: "available", label: "Khả dụng" },
  { key: "reserved", label: "Giữ chỗ" },
  { key: "incoming", label: "Đang về" },
  { key: "reorder", label: "Mức đặt lại" },
  { key: "status", label: "Trạng thái" },
] as const;
type StockColKey = (typeof STOCK_COLS)[number]["key"];

function isLow(row: InventoryItem) {
  return row.available > 0 && row.available <= row.reorder_point;
}

function isOut(row: InventoryItem) {
  return row.available <= 0;
}

function matrixAxes(product: CatalogProduct) {
  const colors: string[] = [];
  const sizes: string[] = [];
  for (const v of product.variants) {
    if (!colors.includes(v.color)) colors.push(v.color);
    if (!sizes.includes(v.size)) sizes.push(v.size);
  }
  colors.sort((a, b) => a.localeCompare(b, "vi"));
  sizes.sort((a, b) => a.localeCompare(b, "vi"));
  const byKey = new Map(product.variants.map((v) => [`${v.color}||${v.size}`, v]));
  return { colors, sizes, byKey };
}

// ─── Small UI helpers (theo design) ───────────────────────────────────────────

type Tone = "green" | "amber" | "red" | "grey" | "violet";

const TONE_CLASS: Record<Tone, { pill: string; dot: string }> = {
  green: { pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  amber: { pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  red: { pill: "bg-red-500/10 text-red-700 dark:text-red-300", dot: "bg-red-500" },
  grey: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  violet: { pill: "bg-violet-500/10 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
};

function DotPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONE_CLASS[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs px-2.5 py-0.5 text-sm font-semibold",
        t.pill,
      )}
    >
      <span className={cn("size-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  extra?: string;
}) {
  return (
    <div className="rounded-xs border border-slate-200/90 bg-white p-4.5 shadow-2xs">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-600">{label}</p>
      </div>
      <p className="mt-2 text-xl  font-semibold tracking-tight tabular-nums text-slate-950 truncate" title={value}>
        {value}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-600">
        <span className="truncate">{note}</span>
        {extra && <span className="shrink-0 text-slate-500 font-medium text-sm">{extra}</span>}
      </div>
    </div>
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
        className="h-9 w-full appearance-none rounded-xs border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-800 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
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
  itemName,
  pageSize = PAGE_SIZE,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  itemName: string;
  pageSize?: number;
  onPage: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn =
    "grid size-8 place-items-center rounded-xs border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40 cursor-pointer";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3.5 py-2.5">
      <span className="text-sm font-medium text-slate-600">
        Hiển thị {from}–{to} trong {total} {itemName}
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
                  ? "border-[#6941c6] bg-[#6941c6] text-white hover:bg-[#53389e] font-semibold"
                  : "text-slate-700 hover:text-slate-900",
              )}
            >
              {it}
            </button>
          ),
        )}
        <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <ChevronRight className="size-3.5" />
        </button>
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
        "flex w-full items-center gap-2 rounded-xs px-2.5 py-1.5 text-left text-sm font-semibold transition-colors hover:bg-slate-50 cursor-pointer",
        destructive ? "text-rose-600 hover:bg-rose-50 font-semibold" : "text-slate-800",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Modal In Phiếu Kho A4 / A5 ───────────────────────────────────────────────

function PrintInventoryDocModal({
  doc,
  open,
  onClose,
}: {
  doc: InventoryDocumentDetail | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !doc) return null;

  const isReceipt = doc.type === "receipt";
  const title = isReceipt
    ? "PHIẾU NHẬP KHO HÀNG HÓA"
    : doc.type === "issue"
      ? "PHIẾU XUẤT KHO KIÊM VẬN CHUYỂN"
      : "PHIẾU ĐIỀU CHỈNH TỒN KHO";

  const totalQty = doc.lines.reduce((s, l) => s + l.qty, 0);
  const totalCost = doc.lines.reduce((s, l) => s + (l.unit_cost_vnd ?? 0) * l.qty, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:static print:bg-white print:p-0">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xs border border-border bg-card shadow-2xl print:max-h-none print:w-full print:border-none print:shadow-none">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="size-4 text-primary" />
            <h3 className="font-sans admin-subsection-title">{title}</h3>
            <span className="tabular-nums text-sm text-muted-foreground">#{doc.code}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
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

        {/* Printable Body */}
        <div className="overflow-y-auto p-8 font-sans text-foreground print:overflow-visible print:p-0">
          <div className="flex items-start justify-between border-b pb-6">
            <div>
              <p className="font-sans admin-metric font-semibold tracking-wider text-primary">ÉLANE</p>
              <p className="text-xs uppercase tracking-[0.04em] text-muted-foreground">
                Hệ Thống Kho Vận & Quản Lý Tồn Kho
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Kho lưu trữ: <span className="font-medium text-foreground">Kho Tổng (MAIN)</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Lý do: <span className="font-medium text-foreground">{doc.reason || "Vận hành kho"}</span>
              </p>
            </div>
            <div className="text-right">
              <h2 className="font-sans uppercase text-foreground admin-section-title">
                {title}
              </h2>
              <p className="mt-1 tabular-nums text-base font-semibold text-primary">#{doc.code}</p>
              <p className="text-sm text-muted-foreground">Ngày lập: {fmtDate(doc.created_at)}</p>
              {doc.posted_at && (
                <p className="text-sm text-muted-foreground">Ngày ghi sổ: {fmtDate(doc.posted_at)}</p>
              )}
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
                <span className="tabular-nums text-xs tracking-widest text-muted-foreground">
                  *{doc.code}*
                </span>
              </div>
            </div>
          </div>

          {/* Table Lines */}
          <div className="mt-6 overflow-hidden rounded-xs border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/55">
                <tr className="border-b border-border text-xs uppercase tracking-[0.04em] text-muted-foreground">
                  <th className="py-2.5 pl-3 font-medium">STT</th>
                  <th className="py-2.5 font-medium">Ảnh</th>
                  <th className="py-2.5 font-medium">Sản phẩm</th>
                  <th className="py-2.5 font-medium">Mã SKU</th>
                  <th className="py-2.5 text-center font-medium">Phân loại</th>
                  <th className="py-2.5 text-center font-medium">Chiều</th>
                  <th className="py-2.5 text-center font-medium">Số lượng</th>
                  <th className="py-2.5 text-right font-medium">
                    {doc.type === "issue" ? "Đơn giá (Hóa đơn)" : "Đơn giá vốn"}
                  </th>
                  <th className="py-2.5 pr-3 text-right font-medium">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {doc.lines.map((l, idx) => {
                  const imgUrl = resolveImageUrl(l.image_url);
                  return (
                    <tr key={idx}>
                      <td className="py-2.5 pl-3 tabular-nums text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-xs border border-border bg-secondary">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={l.product_name}
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground">
                              <Package className="size-4 stroke-[1.5]" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 font-medium text-foreground">{l.product_name}</td>
                      <td className="py-2.5 tabular-nums text-sm">{l.sku}</td>
                      <td className="py-2.5 text-center">
                        <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                          {l.size_label ? `Kích cỡ ${l.size_label}` : ""}
                          {l.color_name ? ` · ${l.color_name}` : ""}
                        </span>
                      </td>
                      <td className="py-2.5 text-center font-medium">
                        {l.direction === "in" ? "+ Nhập" : "- Xuất"}
                      </td>
                      <td className="py-2.5 text-center font-semibold text-foreground">{l.qty}</td>
                      <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                        {fmtVND(l.unit_cost_vnd)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium text-foreground tabular-nums">
                        {fmtVND((l.unit_cost_vnd ?? 0) * l.qty)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end border-t pt-4 text-sm">
            <div className="w-72 space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Tổng số lượng:</span>
                <span className="font-semibold text-foreground">{totalQty} cái</span>
              </div>
              {totalCost > 0 && (
                <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold text-foreground">
                  <span>
                    {doc.type === "issue" ? "Tổng giá trị xuất (Hóa đơn):" : "Tổng giá trị vốn nhập:"}
                  </span>
                  <span className="font-sans text-base text-primary">{fmtVND(totalCost)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-12 grid grid-cols-4 gap-4 text-center text-sm">
            <div>
              <p className="font-medium text-muted-foreground">Người lập phiếu</p>
              <p className="mt-12 text-xs text-muted-foreground">(Ký & họ tên)</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Thủ kho</p>
              <p className="mt-12 text-xs text-muted-foreground">(Ký & họ tên)</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Kế toán kho</p>
              <p className="mt-12 text-xs text-muted-foreground">(Ký & họ tên)</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Người giao / nhận</p>
              <p className="mt-12 text-xs text-muted-foreground">(Ký & họ tên)</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 print:hidden">
          <p className="text-sm text-muted-foreground">Mẫu phiếu kho tiêu chuẩn ÉLANE Atelier.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-sm">
              Đóng
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5 h-8 bg-foreground text-background hover:bg-foreground/90 text-sm font-medium"
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

// ─── MAIN INVENTORY MANAGER COMPONENT ─────────────────────────────────────────

export function InventoryManager({
  seedProduct,
  seed,
  onSeedConsumed,
  permissions = [],
}: {
  seedProduct?: { productId: string; productName?: string } | null;
  seed?: InventorySeed | null;
  onSeedConsumed?: () => void;
  permissions?: string[];
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const route = resolveAdminPath(location.pathname);
  const activeDocParam = route.tabId === "inventory" ? route.subParam : null;
  const hasPermission = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const canReceive = hasPermission("inventory.receive");
  const canIssue = hasPermission("inventory.issue");
  const canAdjustRequest = hasPermission("inventory.adjust.request");
  const canApprove = hasPermission("inventory.adjust.approve");
  const canCreateAnyDocument = canReceive || canIssue || canAdjustRequest;
  const canCreateDocumentType = (type: DocType) =>
    type === "receipt" ? canReceive : type === "issue" ? canIssue : canAdjustRequest;
  const canDeleteDocument = (type: string, status: string) =>
    status === "posted" ? canApprove : canCreateDocumentType(type as DocType);

  const [view, setView] = useState<MainView>(
    route.tabId === "inventory" && route.action === "create"
      ? "form"
      : route.tabId === "inventory" && activeDocParam
        ? "doc_detail"
        : "stock",
  );

  // Stock list filters
  const [stockTab, setStockTab] = useState<StockFilter>("all");
  const [stockQuery, setStockQuery] = useState("");
  const [whFilter, setWhFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [onlyReserved, setOnlyReserved] = useState(false);
  const [stockSort, setStockSort] = useState<"available_asc" | "available_desc" | "name" | "sku">(
    "available_asc",
  );
  const [visibleCols, setVisibleCols] = useState<Set<StockColKey>>(
    new Set(STOCK_COLS.map((c) => c.key)),
  );
  const [stockPage, setStockPage] = useState(1);
  const [stockSelected, setStockSelected] = useState<Set<string>>(new Set());
  const [rowMenu, setRowMenu] = useState<string | null>(null);

  // Docs list filters
  const [docTab, setDocTab] = useState<DocStatusTab>("all");
  const [docTypeFilter, setDocTypeFilter] = useState<"all" | DocType>("all");
  const [docWhFilter, setDocWhFilter] = useState("all");
  const [docQuery, setDocQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [docPage, setDocPage] = useState(1);
  const [docSelected, setDocSelected] = useState<Set<string>>(new Set());
  const [docMenu, setDocMenu] = useState<string | null>(null);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [docs, setDocs] = useState<InventoryDocumentListItem[]>([]);
  const [warehouseLabel, setWarehouseLabel] = useState("MAIN");
  const [loading, setLoading] = useState(true);

  // Document Detail State
  // Khi mở trực tiếp URL /khohang/:code, cần để effect bên dưới tự tải chi tiết.
  // Nếu khởi tạo bằng mã phiếu, effect sẽ tưởng rằng phiếu đã được tải xong.
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docDetail, setDocDetail] = useState<InventoryDocumentDetail | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [postingDoc, setPostingDoc] = useState(false);
  const [printDocModalOpen, setPrintDocModalOpen] = useState(false);
  const [docLinePage, setDocLinePage] = useState(1);
  const [docLinePageSize, setDocLinePageSize] = useState(10);
  const [docLineQuery, setDocLineQuery] = useState("");

  // Compose State
  const [formType, setFormType] = useState<DocType>("receipt");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const isInitialFormSearch = useRef(true);
  const [matrixProductId, setMatrixProductId] = useState("");
  const [matrixQty, setMatrixQty] = useState<Record<string, string>>({});
  const [matrixDirection, setMatrixDirection] = useState<"in" | "out">("in");
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  // Debounce search query from API instead of full catalog download
  useEffect(() => {
    if (view !== "form") {
      isInitialFormSearch.current = true;
      return;
    }
    if (isInitialFormSearch.current) {
      isInitialFormSearch.current = false;
      return;
    }
    const q = productQuery.trim();
    const timer = setTimeout(async () => {
      setCatalogLoading(true);
      try {
        const invByVariant = new Map(items.map((row) => [row.variant_id, row]));
        const res = await adminApi.products({
          q: q || undefined,
          limit: 30,
        });
        const list = mapAdminProductsToCatalog(res.items, invByVariant);
        setCatalog((prev) => {
          if (matrixProductId && !list.some((p) => p.id === matrixProductId)) {
            const currentSelected = prev.find((p) => p.id === matrixProductId);
            if (currentSelected) return [currentSelected, ...list];
          }
          return list;
        });
      } catch (err) {
        console.error("Lỗi tìm kiếm sản phẩm cho kho:", err);
      } finally {
        setCatalogLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [productQuery, view, items, matrixProductId]);

  const loadStock = useCallback(async () => {
    const res = await adminApi.inventory();
    setItems(res.items);
    setWarehouseLabel(res.warehouse.code);
  }, []);

  const loadDocs = useCallback(async () => {
    const res = await adminApi.inventoryDocuments();
    setDocs(res.items);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadStock(), loadDocs()]);
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Tải dữ liệu kho thất bại");
    } finally {
      setLoading(false);
    }
  }, [loadStock, loadDocs]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Ensure documents reload if previous in-memory state missed total_amount_vnd
  useEffect(() => {
    if (docs.length > 0 && docs.some((d) => d.total_amount_vnd === undefined)) {
      void loadDocs();
    }
  }, [docs, loadDocs]);

  // Open Document Detail
  const openDocDetailInternal = useCallback(async (id: string) => {
    setSelectedDocId(id);
    setLoadingDoc(true);
    setView("doc_detail");
    setDocLinePage(1);
    setDocLineQuery("");
    try {
      const d = await adminApi.inventoryDocument(id);
      const enhancedLines = d.lines.map((l) => {
        if (l.unit_cost_vnd != null && Number(l.unit_cost_vnd) > 0) {
          return l;
        }
        const match = items.find((it) => it.variant_id === l.variant_id || it.sku === l.sku);
        const fallbackCost =
          d.type === "issue"
            ? (match?.price_vnd ?? null)
            : (match?.cost_vnd ?? (match?.price_vnd ? Math.round(match.price_vnd * 0.45) : null));
        return {
          ...l,
          unit_cost_vnd: fallbackCost ?? l.unit_cost_vnd,
        };
      });
      setDocDetail({ ...d, lines: enhancedLines });
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không tải được phiếu kho");
    } finally {
      setLoadingDoc(false);
    }
  }, [items]);

  const openDocDetail = (id: string, code?: string) => {
    void openDocDetailInternal(id);
    navigate({ to: `/khohang/${code || id}` });
  };

  const handleBackToList = (targetView: "stock" | "docs" = "docs") => {
    setView(targetView);
    setSelectedDocId(null);
    setDocDetail(null);
    navigate({ to: "/khohang" });
  };

  const openCreateDoc = () => {
    if (!canCreateAnyDocument) {
      toast.error("Bạn không có quyền tạo phiếu kho");
      return;
    }
    setView("form");
    navigate({ to: "/khohang/taophieu" });
  };

  // Sync state with URL location
  useEffect(() => {
    if (route.tabId === "inventory") {
      if (seed || seedProduct) return;

      if (route.action === "create") {
        if (view !== "form") setView("form");
      } else if (activeDocParam && activeDocParam !== "taophieu") {
        const match = docs.find(
          (d) => d.id === activeDocParam || d.code.toLowerCase() === activeDocParam.toLowerCase(),
        );
        // Chờ danh sách phiếu tải xong để đổi mã phiếu (INV-...) thành ID trước khi gọi API chi tiết.
        if (!match && loading) return;
        const targetId = match?.id ?? activeDocParam;
        const routeMatchesDetail =
          docDetail &&
          (docDetail.id === targetId || docDetail.code.toLowerCase() === activeDocParam.toLowerCase());

        if (!routeMatchesDetail && !loadingDoc && selectedDocId !== targetId) {
          void openDocDetailInternal(targetId);
        }
      } else {
        if (view === "form" || view === "doc_detail") {
          setView("docs");
          setSelectedDocId(null);
          setDocDetail(null);
        }
      }
    }
  }, [
    route.tabId,
    route.action,
    activeDocParam,
    docs,
    loading,
    selectedDocId,
    docDetail,
    loadingDoc,
    view,
    openDocDetailInternal,
    seed,
    seedProduct,
  ]);

  // Post Document (Ghi sổ phiếu)
  const handlePostDoc = async (id: string) => {
    if (!canApprove) {
      toast.error("Bạn không có quyền ghi sổ hoặc duyệt phiếu kho");
      return;
    }
    const ok = await confirm({
      title: "Ghi sổ phiếu kho?",
      description: "Ghi sổ sẽ chính thức cập nhật tồn kho tức thì. Không thể hoàn tác trực tiếp.",
      confirmLabel: "Ghi sổ ngay",
    });
    if (!ok) return;

    setPostingDoc(true);
    try {
      const key = `post-${id}-${Date.now()}`;
      await adminApi.postDoc(id, key);
      toast.success("Đã ghi sổ phiếu kho thành công!");
      await Promise.all([reload(), openDocDetail(id)]);
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Ghi sổ thất bại");
    } finally {
      setPostingDoc(false);
    }
  };

  const handleApproveDoc = async (id: string) => {
    if (!canApprove) {
      toast.error("Bạn không có quyền duyệt phiếu kho");
      return;
    }
    const ok = await confirm({
      title: "Duyệt phiếu kho?",
      description: "Sau khi duyệt, phiếu sẽ sẵn sàng để ghi sổ và cập nhật tồn kho.",
      confirmLabel: "Duyệt phiếu",
    });
    if (!ok) return;

    setPostingDoc(true);
    try {
      await adminApi.approveDoc(id);
      toast.success("Đã duyệt phiếu kho");
      await Promise.all([reload(), openDocDetail(id)]);
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Duyệt phiếu thất bại");
    } finally {
      setPostingDoc(false);
    }
  };

  // Delete / Revert Document
  const handleDeleteDoc = async (id: string) => {
    const target = docs.find((doc) => doc.id === id) ?? (docDetail?.id === id ? docDetail : null);
    if (target && !canDeleteDocument(target.type, target.status)) {
      toast.error("Bạn không có quyền xóa phiếu kho này");
      return;
    }
    const ok = await confirm({
      title: "Hủy phiếu kho?",
      description: "Phiếu này sẽ bị xóa khỏi hệ thống. Nếu đã ghi sổ, tồn kho sẽ được đảo ngược lại.",
      confirmLabel: "Xác nhận xóa",
      destructive: true,
    });
    if (!ok) return;

    try {
      await adminApi.deleteDoc(id);
      toast.success("Đã xóa phiếu kho!");
      setSelectedDocId(null);
      setDocDetail(null);
      setView("docs");
      setDocSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không xóa được phiếu");
    }
  };

  // Open Form to create new doc
  const openCreateForm = async (opts?: InventorySeed) => {
    const targetType = opts?.docType ?? "receipt";
    if (!canCreateDocumentType(targetType)) {
      toast.error("Bạn không có quyền tạo loại phiếu kho này");
      return;
    }
    setFormType(targetType);
    setLinkedOrderId(opts?.orderId ?? null);
    setReason(
      opts?.reason
        ? opts.reason
        : opts?.productName
          ? `${targetType === "issue" ? "Xuất kho" : "Nhập kho"} · ${opts.productName}`
          : "",
    );
    setProductQuery(opts?.productName ?? "");
    setView("form");
    if (route.action !== "create") {
      navigate({ to: "/khohang/taophieu" });
    }
    isInitialFormSearch.current = true;
    setCatalogLoading(true);
    try {
      const invByVariant = new Map(items.map((row) => [row.variant_id, row]));

      const neededProductIds = new Set<string>();
      if (opts?.productId) neededProductIds.add(opts.productId);
      if (opts?.lines?.length) {
        opts.lines.forEach((l) => neededProductIds.add(l.product_id));
      }

      // Query only first 30 products (or matching productName if seed provided)
      const res = await adminApi.products({
        q: opts?.productName || undefined,
        limit: 30,
      });

      const fetchedProducts: AdminProduct[] = [...res.items];
      for (const pId of neededProductIds) {
        if (!fetchedProducts.some((p) => p.id === pId)) {
          try {
            const extra = await adminApi.product(pId);
            if (extra) fetchedProducts.push(extra);
          } catch { }
        }
      }

      const list = mapAdminProductsToCatalog(fetchedProducts, invByVariant);
      setCatalog(list);

      if (opts?.lines && opts.lines.length > 0) {
        const prefilledLines: LineDraft[] = opts.lines.map((l) => {
          const catP = list.find((p) => p.id === l.product_id);
          const catV = catP?.variants.find((v) => v.id === l.variant_id);
          const inv = invByVariant.get(l.variant_id);
          const img = l.image_url || catV?.image_url || inv?.image_url || catP?.image_url || null;
          const unitCost =
            l.unit_cost_vnd != null
              ? l.unit_cost_vnd
              : targetType === "issue"
                ? (catV?.price_vnd ?? inv?.price_vnd ?? 0)
                : (catV?.cost_vnd ??
                  inv?.cost_vnd ??
                  (catV?.price_vnd ? Math.round(catV.price_vnd * 0.3) : 0));
          return {
            product_id: l.product_id,
            variant_id: l.variant_id,
            qty: String(l.qty),
            direction: l.direction ?? (targetType === "issue" ? "out" : "in"),
            sku: l.sku || catV?.sku || inv?.sku,
            product_name: l.product_name || catP?.name || inv?.product_name,
            color_label: l.color_label || catV?.color || inv?.color_name,
            size_label: l.size_label || catV?.size || inv?.size_label,
            image_url: img,
            unit_cost_vnd: unitCost > 0 ? unitCost : undefined,
            cost_input: unitCost > 0 ? String(unitCost) : "",
          };
        });
        setLines(prefilledLines);

        const firstProductId = opts.lines[0]?.product_id || opts.productId;
        if (firstProductId) {
          const target = list.find((p) => p.id === firstProductId);
          if (target) {
            setMatrixProductId(target.id);
            setProductQuery(target.name);
          }
        }

        const mQty: Record<string, string> = {};
        for (const l of opts.lines) {
          if (l.product_id === firstProductId) {
            mQty[l.variant_id] = String(l.qty);
          }
        }
        setMatrixQty(mQty);

        if (opts.orderNumber) {
          toast.success(
            `Đã chuyển sang Kho và tự động điền ${opts.lines.length} sản phẩm của đơn #${opts.orderNumber} vào phiếu xuất kho!`,
          );
        }
      } else {
        if (opts?.productId) {
          const target = list.find((p) => p.id === opts.productId);
          if (target) {
            setMatrixProductId(target.id);
            setProductQuery(target.name);
            const productLines: LineDraft[] = target.variants.map((v) => {
              const unitCost =
                v.cost_vnd != null
                  ? v.cost_vnd
                  : targetType === "issue"
                    ? v.price_vnd
                    : (v.price_vnd ? Math.round(v.price_vnd * 0.3) : 0);
              return {
                product_id: target.id,
                variant_id: v.id,
                qty: "1",
                direction: targetType === "issue" ? "out" : "in",
                sku: v.sku,
                product_name: target.name,
                color_label: v.color,
                size_label: v.size,
                image_url: v.image_url ?? target.image_url ?? null,
                unit_cost_vnd: unitCost > 0 ? unitCost : undefined,
                cost_input: unitCost > 0 ? String(unitCost) : "",
              };
            });
            setLines(productLines);
            const mQty: Record<string, string> = {};
            for (const v of target.variants) {
              mQty[v.id] = "1";
            }
            setMatrixQty(mQty);
            toast.success(
              `Đã tự động điền phân loại và giá nhập (${target.name}) vào phiếu!`,
            );
          } else {
            setMatrixProductId("");
            setMatrixQty({});
            setLines([]);
          }
        } else {
          setMatrixProductId("");
          setMatrixQty({});
          setLines([]);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không tải được danh mục sản phẩm");
      setLines([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    const activeSeed =
      seed ||
      (seedProduct
        ? {
          productId: seedProduct.productId,
          productName: seedProduct.productName,
          docType: "receipt" as const,
        }
        : null);
    if (!activeSeed || loading) return;
    void openCreateForm(activeSeed).finally(() => onSeedConsumed?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, seedProduct, loading]);

  const filteredCatalog = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.variants.some(
          (v) =>
            v.sku.toLowerCase().includes(q) ||
            v.color.toLowerCase().includes(q) ||
            v.size.toLowerCase().includes(q),
        ),
    );
  }, [catalog, productQuery]);

  const matrixProduct = useMemo(
    () => catalog.find((p) => p.id === matrixProductId) ?? null,
    [catalog, matrixProductId],
  );

  function addMatrixToLines() {
    if (!matrixProduct) {
      toast.error("Vui lòng chọn sản phẩm trước");
      return;
    }
    const dir = formType === "receipt" ? "in" : formType === "issue" ? "out" : matrixDirection;
    const additions: LineDraft[] = [];
    for (const v of matrixProduct.variants) {
      const raw = matrixQty[v.id]?.trim();
      if (!raw) continue;
      const qty = Number(raw);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const defaultCost =
        formType === "issue"
          ? (v.price_vnd ?? 0)
          : (v.cost_vnd ?? (v.price_vnd ? Math.round(v.price_vnd * 0.3) : 0));
      additions.push({
        product_id: matrixProduct.id,
        variant_id: v.id,
        qty: String(qty),
        direction: dir,
        sku: v.sku,
        product_name: matrixProduct.name,
        color_label: v.color,
        size_label: v.size,
        image_url: v.image_url ?? matrixProduct.image_url ?? null,
        unit_cost_vnd: defaultCost > 0 ? defaultCost : undefined,
        cost_input: defaultCost > 0 ? String(defaultCost) : "",
      });
    }
    if (!additions.length) {
      toast.error("Nhập số lượng ít nhất một ô Màu × Kích cỡ");
      return;
    }
    setLines((prev) => {
      const next = [...prev];
      for (const a of additions) {
        const i = next.findIndex((l) => l.variant_id === a.variant_id);
        if (i >= 0) {
          next[i] = {
            ...next[i]!,
            qty: String(Number(next[i]!.qty || 0) + Number(a.qty)),
            direction: a.direction,
            image_url: next[i]!.image_url || a.image_url,
            unit_cost_vnd: next[i]!.unit_cost_vnd ?? a.unit_cost_vnd,
            cost_input: next[i]!.cost_input ?? a.cost_input,
          };
        } else {
          next.push(a);
        }
      }
      return next;
    });
    setMatrixQty({});
    toast.success(`Đã thêm ${additions.length} biến thể vào phiếu`);
  }

  // Save Document
  async function handleSaveDoc(action: "draft" | "submit" | "post" = "draft") {
    if (!canCreateDocumentType(formType)) {
      toast.error("Bạn không có quyền tạo loại phiếu kho này");
      return;
    }
    if (action === "post" && !canApprove) {
      toast.error("Bạn chỉ có thể lưu phiếu nháp; không có quyền ghi sổ");
      return;
    }
    const bodyLines = lines
      .filter((l) => l.variant_id && Number(l.qty) > 0)
      .map((l) => ({
        variant_id: l.variant_id,
        qty: Number(l.qty),
        direction:
          formType === "receipt" ? ("in" as const) : formType === "issue" ? ("out" as const) : l.direction,
        unit_cost_vnd:
          l.unit_cost_vnd !== undefined && l.unit_cost_vnd !== null && !Number.isNaN(Number(l.unit_cost_vnd))
            ? Math.round(Number(l.unit_cost_vnd))
            : undefined,
      }));
    if (!bodyLines.length) {
      toast.error("Phiếu cần ít nhất một dòng sản phẩm với số lượng > 0");
      return;
    }
    setSaving(true);
    try {
      const res = await adminApi.createInventoryDocument({
        type: formType,
        reason: reason.trim() || undefined,
        order_id: linkedOrderId || undefined,
        lines: bodyLines,
      });
      if (action === "draft") {
        toast.success(`Đã lưu phiếu nháp ${res.code}`);
      }

      if (action === "submit") {
        await adminApi.submitDoc(res.id);
        toast.success(`Đã tạo phiếu ${res.code}, đang chờ duyệt`);
      }

      if (action === "post") {
        await adminApi.approveDoc(res.id);
        const key = `post-${res.id}-${Date.now()}`;
        await adminApi.postDoc(res.id, key);
        toast.success(`Đã ghi sổ phiếu ${res.code} cập nhật tồn kho!`);
      }

      await reload();
      await openDocDetail(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Tạo phiếu kho thất bại");
    } finally {
      setSaving(false);
    }
  }

  // ─── Metrics ──────────────────────────────────────────────────────────────

  const stockMetrics = useMemo(() => {
    const rows = items as StockRow[];
    return {
      onHand: rows.reduce((s, it) => s + (Number(it.on_hand) || 0), 0),
      reserved: rows.reduce((s, it) => s + (Number(it.reserved) || 0), 0),
      reservedSkus: rows.filter((it) => (it.reserved ?? 0) > 0).length,
      low: rows.filter(isLow).length,
      out: rows.filter(isOut).length,
      safe: rows.filter((it) => it.available > it.reorder_point).length,
    };
  }, [items]);

  const docMetrics = useMemo(() => {
    const today = new Date().toDateString();
    const receipts = docs.filter((d) => d.type === "receipt");
    const issues = docs.filter((d) => d.type === "issue");
    return {
      draft: docs.filter((d) => d.status === "draft").length,
      approved: docs.filter((d) => d.status === "approved").length,
      postedToday: docs.filter(
        (d) => d.status === "posted" && d.posted_at && new Date(d.posted_at).toDateString() === today,
      ).length,
      adjustments: docs.filter((d) => d.type === "adjustment").length,
      totalReceiptAmount: receipts.reduce((s, d) => s + (Number(d.total_amount_vnd) || 0), 0),
      totalReceiptQty: receipts.reduce((s, d) => s + (Number(d.total_qty) || 0), 0),
      receiptCount: receipts.length,
      totalIssueAmount: issues.reduce((s, d) => s + (Number(d.total_amount_vnd) || 0), 0),
      totalIssueQty: issues.reduce((s, d) => s + (Number(d.total_qty) || 0), 0),
      issueCount: issues.length,
    };
  }, [docs]);

  // ─── Filtered Stock Items ─────────────────────────────────────────────────

  const warehouseOptions = useMemo(() => {
    const codes = new Set<string>([warehouseLabel]);
    for (const it of items as StockRow[]) if (it.warehouse_code) codes.add(it.warehouse_code);
    return Array.from(codes);
  }, [items, warehouseLabel]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items as StockRow[]) if (it.category_name) set.add(it.category_name);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [items]);

  const filteredStock = useMemo(() => {
    let rows = items as StockRow[];
    if (stockTab === "low") rows = rows.filter(isLow);
    if (stockTab === "out") rows = rows.filter(isOut);
    if (stockTab === "safe") rows = rows.filter((it) => it.available > it.reorder_point);
    if (whFilter !== "all") rows = rows.filter((r) => (r.warehouse_code ?? warehouseLabel) === whFilter);
    if (catFilter !== "all") rows = rows.filter((r) => r.category_name === catFilter);
    if (onlyReserved) rows = rows.filter((r) => (r.reserved ?? 0) > 0);

    const q = stockQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.product_name.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.barcode?.toLowerCase().includes(q) ||
          r.color_name.toLowerCase().includes(q) ||
          r.size_label.toLowerCase().includes(q),
      );
    }

    return [...rows].sort((a, b) => {
      if (stockSort === "available_asc") return a.available - b.available;
      if (stockSort === "available_desc") return b.available - a.available;
      if (stockSort === "sku") return a.sku.localeCompare(b.sku);
      return a.product_name.localeCompare(b.product_name, "vi");
    });
  }, [items, stockTab, stockQuery, whFilter, catFilter, onlyReserved, stockSort, warehouseLabel]);

  // ─── Filtered Documents ───────────────────────────────────────────────────

  const filteredDocs = useMemo(() => {
    let list = docs as DocRow[];
    if (docTab !== "all") list = list.filter((d) => d.status === docTab);
    if (docTypeFilter !== "all") list = list.filter((d) => d.type === docTypeFilter);
    if (docWhFilter !== "all") list = list.filter((d) => (d.warehouse_code ?? warehouseLabel) === docWhFilter);
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`).getTime();
      list = list.filter((d) => new Date(d.created_at).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999`).getTime();
      list = list.filter((d) => new Date(d.created_at).getTime() <= to);
    }

    const q = docQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.code.toLowerCase().includes(q) ||
          d.reason?.toLowerCase().includes(q) ||
          d.created_by_name?.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q),
      );
    }
    return list;
  }, [docs, docTab, docTypeFilter, docWhFilter, dateFrom, dateTo, docQuery, warehouseLabel]);

  // Reset pagination / selection when filters change
  useEffect(() => {
    setStockPage(1);
    setStockSelected(new Set());
  }, [stockTab, stockQuery, whFilter, catFilter, onlyReserved, stockSort]);

  useEffect(() => {
    setDocPage(1);
    setDocSelected(new Set());
  }, [docTab, docTypeFilter, docWhFilter, dateFrom, dateTo, docQuery]);

  const totalStockPages = Math.max(1, Math.ceil(filteredStock.length / PAGE_SIZE));
  const pagedStock = useMemo(
    () => filteredStock.slice((stockPage - 1) * PAGE_SIZE, stockPage * PAGE_SIZE),
    [filteredStock, stockPage],
  );

  const totalDocPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE));
  const pagedDocs = useMemo(
    () => filteredDocs.slice((docPage - 1) * PAGE_SIZE, docPage * PAGE_SIZE),
    [filteredDocs, docPage],
  );

  const filteredDocLines = useMemo(() => {
    if (!docDetail?.lines) return [];
    const q = docLineQuery.trim().toLowerCase();
    if (!q) return docDetail.lines;
    return docDetail.lines.filter(
      (l) =>
        l.product_name.toLowerCase().includes(q) ||
        l.sku.toLowerCase().includes(q) ||
        (l.color_name && l.color_name.toLowerCase().includes(q)) ||
        (l.size_label && l.size_label.toLowerCase().includes(q)) ||
        (l.barcode && l.barcode.toLowerCase().includes(q)),
    );
  }, [docDetail?.lines, docLineQuery]);

  const totalDocLinePages = Math.max(1, Math.ceil(filteredDocLines.length / docLinePageSize));
  const pagedDocLines = useMemo(
    () => filteredDocLines.slice((docLinePage - 1) * docLinePageSize, docLinePage * docLinePageSize),
    [filteredDocLines, docLinePage, docLinePageSize],
  );

  const resolveLineCost = useCallback(
    (line: InventoryDocumentDetail["lines"][number]) => {
      if (line.unit_cost_vnd != null && Number(line.unit_cost_vnd) > 0) {
        return Number(line.unit_cost_vnd);
      }
      const match = items.find((it) => it.variant_id === line.variant_id || it.sku === line.sku);
      if (docDetail?.type === "issue") {
        if (match?.price_vnd) return match.price_vnd;
      } else {
        if (match?.cost_vnd) return match.cost_vnd;
        if (match?.price_vnd) return Math.round(match.price_vnd * 0.45);
      }
      return 0;
    },
    [items, docDetail?.type],
  );

  const totalDocAmount = useMemo(() => {
    if (!docDetail?.lines) return 0;
    return docDetail.lines.reduce((s, l) => s + resolveLineCost(l) * l.qty, 0);
  }, [docDetail?.lines, resolveLineCost]);

  const allStockPageSelected =
    pagedStock.length > 0 && pagedStock.every((r) => stockSelected.has(r.variant_id));
  const someStockPageSelected = pagedStock.some((r) => stockSelected.has(r.variant_id));
  const allDocPageSelected = pagedDocs.length > 0 && pagedDocs.every((d) => docSelected.has(d.id));
  const someDocPageSelected = pagedDocs.some((d) => docSelected.has(d.id));

  function toggleStockPage() {
    setStockSelected((prev) => {
      const next = new Set(prev);
      for (const r of pagedStock) {
        if (allStockPageSelected) next.delete(r.variant_id);
        else next.add(r.variant_id);
      }
      return next;
    });
  }

  function toggleDocPage() {
    setDocSelected((prev) => {
      const next = new Set(prev);
      for (const d of pagedDocs) {
        if (allDocPageSelected) next.delete(d.id);
        else next.add(d.id);
      }
      return next;
    });
  }

  function toggleSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stockStatus(row: InventoryItem): { tone: Tone; label: string } {
    if (isOut(row)) return { tone: "red", label: "Hết hàng" };
    if (isLow(row)) return { tone: "amber", label: "Sắp hết" };
    return { tone: "green", label: "Còn hàng" };
  }

  function seedLine(row: InventoryItem, direction: "in" | "out") {
    return {
      product_id: row.product_id,
      variant_id: row.variant_id,
      qty: 1,
      direction,
      sku: row.sku,
      product_name: row.product_name,
      color_label: row.color_name,
      size_label: row.size_label,
      image_url: row.image_url ?? null,
    };
  }

  function createSlipForRows(rows: InventoryItem[], type: "receipt" | "issue") {
    if (!rows.length) return;
    void openCreateForm({
      docType: type,
      reason: type === "receipt" ? "Nhập bổ sung tồn kho" : "Xuất kho",
      lines: rows.map((r) => seedLine(r, type === "receipt" ? "in" : "out")),
    });
  }

  function exportStock() {
    const rows = stockSelected.size
      ? filteredStock.filter((r) => stockSelected.has(r.variant_id))
      : filteredStock;
    downloadCsv("ton-kho.csv", [
      ["SKU", "Sản phẩm", "Danh mục", "Phân loại", "Kho", "Khả dụng", "Giữ chỗ", "Đang về", "Mức đặt lại", "Trạng thái"],
      ...rows.map((r) => [
        r.sku,
        r.product_name,
        r.category_name ?? "",
        `${r.size_label} / ${r.color_name}`,
        r.warehouse_code ?? warehouseLabel,
        r.available,
        r.reserved ?? 0,
        r.incoming ?? "",
        r.reorder_point,
        stockStatus(r).label,
      ]),
    ]);
  }

  function exportDocs() {
    const rows = docSelected.size ? filteredDocs.filter((d) => docSelected.has(d.id)) : filteredDocs;
    downloadCsv("phieu-kho.csv", [
      ["Mã phiếu", "Loại", "Kho", "Người yêu cầu", "Người duyệt", "Số lượng", "Trạng thái", "Ngày tạo"],
      ...rows.map((d) => [
        d.code,
        TYPE_LABEL[d.type as DocType] ?? d.type,
        d.warehouse_code ?? warehouseLabel,
        d.created_by_name ?? "",
        d.approved_by_name ?? "",
        Number(d.total_qty) || 0,
        STATUS_LABEL[d.status] ?? d.status,
        fmtDate(d.created_at),
      ]),
    ]);
  }

  const isListView = view === "stock" || view === "docs";

  return (
    <div className="space-y-5 font-sans pb-12">
      {confirmDialog}

      {/* Print Document Modal */}
      <PrintInventoryDocModal
        doc={docDetail}
        open={printDocModalOpen}
        onClose={() => setPrintDocModalOpen(false)}
      />

      {/* ── Page header + chuyển giữa Tồn kho / Phiếu kho ───────────────────── */}
      {isListView && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-slate-950 admin-page-title">
                {view === "stock" ? "Tồn kho" : "Phiếu kho"}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-600">
                {view === "stock"
                  ? "Theo dõi tồn kho theo kho, sản phẩm và biến thể."
                  : "Quản lý các chứng từ nhập, xuất và điều chỉnh tồn kho."}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                onClick={view === "stock" ? exportStock : exportDocs}
              >
                <Download className="size-3.5 text-slate-500" />
                <span>Xuất file</span>
              </Button>
              {canCreateAnyDocument && <Button asChild className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-semibold text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer">
                <a
                  href="/khohang/taophieu"
                  onClick={(e) => {
                    e.preventDefault();
                    openCreateDoc();
                  }}
                >
                  <Plus className="size-3.5" />
                  <span>{view === "stock" ? "Tạo phiếu kho" : "Tạo phiếu"}</span>
                </a>
              </Button>}
            </div>
          </div>

          <div className="inline-flex items-center gap-1 rounded-xs border border-slate-200/90 bg-slate-100/80 p-1 shadow-2xs">
            {(
              [
                ["stock", "Tồn kho", items.length.toLocaleString("vi-VN"), Package],
                ["docs", "Phiếu kho", docs.length, FileText],
              ] as const
            ).map(([id, label, count, Icon]) => {
              const active = view === id;
              return (
                <a
                  key={id}
                  href="/khohang"
                  onClick={(e) => {
                    e.preventDefault();
                    handleBackToList(id);
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xs px-3.5 py-1.5 text-sm font-semibold transition-all cursor-pointer",
                    active
                      ? "border border-slate-200/90 bg-white text-slate-950 shadow-2xs"
                      : "border border-transparent text-slate-600 hover:text-slate-950 hover:bg-white/50",
                  )}
                >
                  <Icon className={cn("size-3.5", active ? "text-[#6941c6]" : "text-slate-400")} />
                  <span>{label}</span>
                  <span
                    className={cn(
                      "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-xs px-1.5 tabular-nums text-sm leading-none font-semibold tabular-nums transition-colors",
                      active
                        ? "border border-[#6941c6]/20 bg-[#f4f3ff] text-[#6941c6]"
                        : "border border-slate-200/60 bg-slate-200/70 text-slate-600",
                    )}
                  >
                    {count}
                  </span>
                </a>
              );
            })}
          </div>
        </>
      )}

      {/* ── VIEW 1: TỒN KHO ─────────────────────────────────────────────────── */}
      {view === "stock" && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<Package className="size-4" />}
              label="Tổng tồn thực tế"
              value={stockMetrics.onHand.toLocaleString("vi-VN")}
              note={`${items.length} biến thể SKU`}
              extra={`Kho ${warehouseLabel}`}
            />
            <MetricCard
              icon={<Lock className="size-4" />}
              label="Đang giữ chỗ"
              value={stockMetrics.reserved.toLocaleString("vi-VN")}
              note={`${stockMetrics.reservedSkus} SKU chờ xuất đơn`}
            />
            <MetricCard
              icon={<AlertTriangle className="size-4" />}
              label="SKU sắp hết hàng"
              value={String(stockMetrics.low)}
              note={stockMetrics.low > 0 ? "Cần lập phiếu nhập" : "Trong mức an toàn"}
            />
            <MetricCard
              icon={<Ban className="size-4" />}
              label="Hết hàng"
              value={String(stockMetrics.out)}
              note={stockMetrics.out > 0 ? "Đang ngừng bán" : "Không có SKU hết hàng"}
            />
          </section>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                className="h-9 rounded-xs border-slate-200 bg-white pl-8.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                placeholder="Tìm theo SKU, tên sản phẩm hoặc biến thể…"
              />
            </div>
            <SelectBox
              label="Kho"
              value={whFilter}
              onChange={setWhFilter}
              className="w-36"
              options={[
                { value: "all", label: "Tất cả kho" },
                ...warehouseOptions.map((w) => ({ value: w, label: `Kho ${w}` })),
              ]}
            />
            <SelectBox
              label="Trạng thái"
              value={stockTab}
              onChange={(v) => setStockTab(v as StockFilter)}
              className="w-44"
              options={[
                { value: "all", label: "Mọi trạng thái" },
                { value: "safe", label: `Còn hàng (${stockMetrics.safe})` },
                { value: "low", label: `Sắp hết (${stockMetrics.low})` },
                { value: "out", label: `Hết hàng (${stockMetrics.out})` },
              ]}
            />
            {categoryOptions.length > 0 && (
              <SelectBox
                label="Danh mục"
                value={catFilter}
                onChange={setCatFilter}
                className="w-40"
                options={[
                  { value: "all", label: "Mọi danh mục" },
                  ...categoryOptions.map((c) => ({ value: c, label: c })),
                ]}
              />
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50",
                    onlyReserved && "border-primary/40 bg-accent/40",
                  )}
                >
                  <SlidersHorizontal className="size-3.5 text-slate-500" />
                  <span>Bộ lọc khác</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 p-3 rounded-xs shadow-xl text-sm">
                <label className="flex cursor-pointer items-center gap-2.5 font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                    checked={onlyReserved}
                    onChange={(e) => setOnlyReserved(e.target.checked)}
                  />
                  <span>Chỉ SKU đang giữ chỗ</span>
                </label>
              </PopoverContent>
            </Popover>

            <div className="ml-auto flex items-center gap-2.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50">
                    <LayoutGrid className="size-3.5 text-slate-500" />
                    <span>Cột hiển thị</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52 p-2 rounded-xs shadow-xl text-sm">
                  {STOCK_COLS.map((c) => (
                    <label
                      key={c.key}
                      className="flex cursor-pointer items-center gap-2.5 rounded-xs px-2.5 py-1.5 font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                        checked={visibleCols.has(c.key)}
                        onChange={() =>
                          setVisibleCols((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.key)) next.delete(c.key);
                            else next.add(c.key);
                            return next;
                          })
                        }
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </PopoverContent>
              </Popover>
              <SelectBox
                label="Sắp xếp"
                value={stockSort}
                onChange={(v) => setStockSort(v as typeof stockSort)}
                className="w-48"
                options={[
                  { value: "available_asc", label: "Sắp xếp: Tồn thấp nhất" },
                  { value: "available_desc", label: "Sắp xếp: Tồn cao nhất" },
                  { value: "name", label: "Sắp xếp: Tên A→Z" },
                  { value: "sku", label: "Sắp xếp: SKU" },
                ]}
              />
            </div>
          </div>

          {/* Bulk bar */}
          {stockSelected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-xs border border-slate-200 bg-purple-50/40 px-3.5 py-2 text-sm">
              <span className="font-semibold text-slate-950">Đã chọn {stockSelected.size}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 rounded-xs bg-white px-3 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50"
                onClick={() =>
                  createSlipForRows(
                    filteredStock.filter((r) => stockSelected.has(r.variant_id)),
                    "receipt",
                  )
                }
              >
                <PackagePlus className="size-3.5 text-slate-600" />
                <span>Lập phiếu nhập</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 rounded-xs bg-white px-3 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50"
                onClick={() =>
                  createSlipForRows(
                    filteredStock.filter((r) => stockSelected.has(r.variant_id)),
                    "issue",
                  )
                }
              >
                <PackageMinus className="size-3.5 text-slate-600" />
                <span>Lập phiếu xuất</span>
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 rounded-xs" onClick={() => setStockSelected(new Set())}>
                Bỏ chọn
              </Button>
            </div>
          )}

          {/* Table */}
          <section className="overflow-hidden rounded-xs border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-700">
                  <tr>
                    <th className="w-12 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả"
                        className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                        checked={allStockPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someStockPageSelected && !allStockPageSelected;
                        }}
                        onChange={toggleStockPage}
                      />
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-700">SKU</th>
                    {visibleCols.has("product") && <th className="px-3 py-2.5 font-semibold text-slate-700">Sản phẩm</th>}
                    {visibleCols.has("variant") && <th className="px-3 py-2.5 font-semibold text-slate-700">Phân loại</th>}
                    {visibleCols.has("warehouse") && <th className="px-3 py-2.5 font-semibold text-slate-700">Kho</th>}
                    {visibleCols.has("available") && (
                      <th className="px-3 py-2.5 text-center font-semibold text-slate-700">Khả dụng</th>
                    )}
                    {visibleCols.has("reserved") && (
                      <th className="px-3 py-2.5 text-center font-semibold text-slate-700">Giữ chỗ</th>
                    )}
                    {visibleCols.has("incoming") && (
                      <th className="px-3 py-2.5 text-center font-semibold text-slate-700">Đang về</th>
                    )}
                    {visibleCols.has("reorder") && (
                      <th className="px-3 py-2.5 text-center font-semibold text-slate-700">Mức đặt lại</th>
                    )}
                    {visibleCols.has("status") && <th className="px-3 py-2.5 font-semibold text-slate-700">Trạng thái</th>}
                    <th className="w-24 whitespace-nowrap px-3 py-2.5 text-center font-semibold text-slate-700">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-14 text-center text-sm text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="size-5 animate-spin text-[#6941c6]" />
                          <span className="font-semibold text-slate-700">Đang tải số liệu tồn kho…</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-14 text-center text-sm font-medium text-slate-500">
                        Không tìm thấy mặt hàng nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    pagedStock.map((row) => {
                      const imgUrl = resolveImageUrl(row.image_url);
                      const st = stockStatus(row);
                      const checked = stockSelected.has(row.variant_id);
                      return (
                        <tr
                          key={row.variant_id}
                          className={cn(
                            "border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/80",
                            checked && "bg-purple-50/30",
                          )}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              aria-label={`Chọn ${row.sku}`}
                              className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                              checked={checked}
                              onChange={() => toggleSet(setStockSelected, row.variant_id)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <div className="relative size-9 shrink-0 overflow-hidden rounded-xs border border-slate-200 bg-slate-100">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={row.product_name}
                                    className="size-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <div className="flex size-full items-center justify-center text-slate-400">
                                    <Package className="size-3.5 stroke-[1.5]" />
                                  </div>
                                )}
                              </div>
                              <span className="max-w-[130px] break-all tabular-nums text-sm font-semibold leading-tight text-slate-950">{row.sku}</span>
                            </div>
                          </td>
                          {visibleCols.has("product") && (
                            <td className="px-3 py-2">
                              <p className="max-w-[200px] truncate text-sm font-semibold text-slate-950">
                                {row.product_name}
                              </p>
                              {row.category_name && (
                                <p className="text-sm font-medium text-slate-500 mt-0.5">{row.category_name}</p>
                              )}
                            </td>
                          )}
                          {visibleCols.has("variant") && (
                            <td className="px-3 py-2 text-sm font-semibold text-slate-800">
                              {row.size_label} / {row.color_name}
                            </td>
                          )}
                          {visibleCols.has("warehouse") && (
                            <td className="px-3 py-2 text-sm font-semibold text-slate-700">
                              {row.warehouse_code ?? warehouseLabel}
                            </td>
                          )}
                          {visibleCols.has("available") && (
                            <td className="px-3 py-2 text-center tabular-nums font-semibold text-slate-950 text-sm">{row.available}</td>
                          )}
                          {visibleCols.has("reserved") && (
                            <td className="px-3 py-2 text-center tabular-nums text-sm font-semibold text-slate-700">{row.reserved ?? 0}</td>
                          )}
                          {visibleCols.has("incoming") && (
                            <td className="px-3 py-2 text-center tabular-nums text-sm font-semibold text-slate-700">{row.incoming ?? "—"}</td>
                          )}
                          {visibleCols.has("reorder") && (
                            <td className="px-3 py-2 text-center tabular-nums text-sm font-semibold text-slate-700">{row.reorder_point}</td>
                          )}
                          {visibleCols.has("status") && (
                            <td className="px-3 py-2">
                              <DotPill tone={st.tone}>{st.label}</DotPill>
                            </td>
                          )}
                          <td className="px-3 py-2 text-center">
                            <Popover
                              open={rowMenu === row.variant_id}
                              onOpenChange={(o) => setRowMenu(o ? row.variant_id : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 rounded-xs text-slate-500 hover:text-slate-800"
                                  aria-label={`Thao tác với ${row.sku}`}
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-48 p-1 rounded-xs shadow-xl">
                                <MenuItem
                                  icon={<PackagePlus className="size-3.5" />}
                                  label="Lập phiếu nhập"
                                  onClick={() => {
                                    setRowMenu(null);
                                    createSlipForRows([row], "receipt");
                                  }}
                                />
                                <MenuItem
                                  icon={<PackageMinus className="size-3.5" />}
                                  label="Lập phiếu xuất"
                                  onClick={() => {
                                    setRowMenu(null);
                                    createSlipForRows([row], "issue");
                                  }}
                                />
                                <MenuItem
                                  icon={<Copy className="size-3.5" />}
                                  label="Sao chép SKU"
                                  onClick={() => {
                                    setRowMenu(null);
                                    copyText("mã SKU", row.sku);
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
              page={stockPage}
              totalPages={totalStockPages}
              total={filteredStock.length}
              itemName="mặt hàng tồn kho"
              onPage={setStockPage}
            />
          </section>
        </>
      )}

      {/* ── VIEW 2: PHIẾU KHO ───────────────────────────────────────────────── */}
      {view === "docs" && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              icon={<PackagePlus className="size-4 text-emerald-600" />}
              label="Tiền nhập kho"
              value={fmtVND(docMetrics.totalReceiptAmount)}
              note={`${docMetrics.receiptCount} phiếu nhập`}
              extra={`${docMetrics.totalReceiptQty.toLocaleString("vi-VN")} cái`}
            />
            <MetricCard
              icon={<PackageMinus className="size-4 text-rose-600" />}
              label="Tiền xuất kho"
              value={fmtVND(docMetrics.totalIssueAmount)}
              note={`${docMetrics.issueCount} phiếu xuất`}
              extra={`${docMetrics.totalIssueQty.toLocaleString("vi-VN")} cái`}
            />
            <MetricCard
              icon={<FileText className="size-4 text-[#6941c6]" />}
              label="Phiếu nháp"
              value={String(docMetrics.draft)}
              note={`${docs.length} phiếu tổng cộng`}
            />
            <MetricCard
              icon={<Clock className="size-4 text-amber-600" />}
              label="Đã duyệt, chờ ghi sổ"
              value={String(docMetrics.approved)}
              note="Cần ghi sổ để cập nhật tồn"
            />
            <MetricCard
              icon={<CheckCircle2 className="size-4 text-emerald-600" />}
              label="Ghi sổ hôm nay"
              value={String(docMetrics.postedToday)}
              note={
                docMetrics.postedToday > 0
                  ? "Phiếu đã cập nhật tồn kho"
                  : `${docs.filter((d) => d.status === "posted").length} phiếu đã ghi sổ trước đó`
              }
            />
            <MetricCard
              icon={<ArrowRightLeft className="size-4 text-slate-600" />}
              label="Điều chỉnh"
              value={String(docMetrics.adjustments)}
              note="Phiếu điều chỉnh tồn kho"
            />
          </section>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={docQuery}
                onChange={(e) => setDocQuery(e.target.value)}
                className="h-9 rounded-xs border-slate-200 bg-white pl-8.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                placeholder="Tìm số phiếu, lý do hoặc người yêu cầu…"
              />
            </div>
            <SelectBox
              label="Loại phiếu"
              value={docTypeFilter}
              onChange={(v) => setDocTypeFilter(v as "all" | DocType)}
              className="w-36"
              options={[
                { value: "all", label: "Mọi loại" },
                { value: "receipt", label: "Nhập kho" },
                { value: "issue", label: "Xuất kho" },
                { value: "adjustment", label: "Điều chỉnh" },
              ]}
            />
            <SelectBox
              label="Kho"
              value={docWhFilter}
              onChange={setDocWhFilter}
              className="w-36"
              options={[
                { value: "all", label: "Tất cả kho" },
                ...warehouseOptions.map((w) => ({ value: w, label: `Kho ${w}` })),
              ]}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50",
                    (dateFrom || dateTo) && "border-primary/40 bg-accent/40",
                  )}
                >
                  <Calendar className="size-3.5 text-slate-500" />
                  <span>
                    {dateFrom || dateTo
                      ? `${dateFrom ? new Date(dateFrom).toLocaleDateString("vi-VN") : "…"} – ${dateTo ? new Date(dateTo).toLocaleDateString("vi-VN") : "…"}`
                      : "Khoảng ngày"}
                  </span>
                  <ChevronDown className="size-3 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 space-y-2.5 p-3 rounded-xs shadow-xl text-sm">
                <label className="block font-semibold text-slate-700">
                  <span>Từ ngày</span>
                  <Input
                    type="date"
                    className="mt-1 h-8.5 rounded-xs text-sm font-semibold text-slate-900"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label className="block font-semibold text-slate-700">
                  <span>Đến ngày</span>
                  <Input
                    type="date"
                    className="mt-1 h-8.5 rounded-xs text-sm font-semibold text-slate-900"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-sm font-semibold rounded-xs w-full text-slate-500 hover:text-slate-800"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Xóa khoảng ngày
                </Button>
              </PopoverContent>
            </Popover>

            <div className="ml-auto inline-flex items-center gap-0.5 rounded-xs border border-slate-200/90 bg-slate-100/80 p-0.5 shadow-2xs">
              {(
                [
                  ["all", "Tất cả"],
                  ["draft", "Nháp"],
                  ["submitted", "Chờ duyệt"],
                  ["approved", "Đã duyệt"],
                  ["posted", "Đã ghi sổ"],
                  ["void", "Đã hủy"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDocTab(id)}
                  className={cn(
                    "rounded-xs px-3 py-1.5 text-sm font-semibold transition-all cursor-pointer",
                    docTab === id
                      ? "border border-slate-200/90 bg-white text-slate-950 shadow-2xs"
                      : "border border-transparent text-slate-600 hover:text-slate-950 hover:bg-white/50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {docSelected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-xs border border-slate-200 bg-purple-50/40 px-3.5 py-2 text-sm">
              <span className="font-semibold text-slate-950">Đã chọn {docSelected.size}</span>
              <Button size="sm" variant="outline" className="h-8 gap-1 rounded-xs bg-white px-3 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50" onClick={exportDocs}>
                <Download className="size-3.5 text-slate-600" />
                <span>Xuất file</span>
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 rounded-xs" onClick={() => setDocSelected(new Set())}>
                Bỏ chọn
              </Button>
            </div>
          )}

          {/* Table */}
          <section className="overflow-hidden rounded-xs border border-slate-200 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-700">
                  <tr>
                    <th className="w-12 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả"
                        className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                        checked={allDocPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someDocPageSelected && !allDocPageSelected;
                        }}
                        onChange={toggleDocPage}
                      />
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-slate-700">Số phiếu</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-700">Loại</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-700">Kho</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-700">Người yêu cầu</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-700">Người duyệt</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-slate-700">Số lượng</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">Tổng tiền (₫)</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-700">Trạng thái</th>
                    <th className="px-3 py-2.5 font-semibold text-slate-700">Ngày</th>
                    <th className="w-24 whitespace-nowrap px-3 py-2.5 text-center font-semibold text-slate-700">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && docs.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-14 text-center text-sm text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="size-5 animate-spin text-[#6941c6]" />
                          <span className="font-semibold text-slate-700">Đang tải danh sách phiếu kho…</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-14 text-center text-sm font-medium text-slate-500">
                        Chưa có phiếu kho nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    pagedDocs.map((doc) => {
                      const checked = docSelected.has(doc.id);
                      const typeTone: Tone =
                        doc.type === "receipt" ? "green" : doc.type === "issue" ? "red" : "violet";
                      const statusTone: Tone =
                        doc.status === "posted"
                          ? "green"
                          : doc.status === "submitted"
                            ? "amber"
                            : doc.status === "approved"
                              ? "amber"
                              : doc.status === "void"
                                ? "red"
                                : "grey";
                      const dp = fmtDateParts(doc.created_at);
                      return (
                        <tr
                          key={doc.id}
                          onClick={() => openDocDetail(doc.id, doc.code)}
                          className={cn(
                            "cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/80",
                            checked && "bg-purple-50/30",
                          )}
                        >
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Chọn ${doc.code}`}
                              className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                              checked={checked}
                              onChange={() => toggleSet(setDocSelected, doc.id)}
                            />
                          </td>
                          <td className="px-3 py-2 tabular-nums text-sm font-semibold text-[#6941c6]">
                            <a
                              href={`/khohang/${doc.code}`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openDocDetail(doc.id, doc.code);
                              }}
                              className="hover:underline"
                            >
                              {doc.code}
                            </a>
                          </td>
                          <td className="px-3 py-2">
                            <DotPill tone={typeTone}>
                              {TYPE_LABEL[doc.type as DocType] ?? doc.type}
                            </DotPill>
                          </td>
                          <td className="px-3 py-2 text-sm font-semibold text-slate-700">
                            {doc.warehouse_code ?? warehouseLabel}
                          </td>
                          <td className="px-3 py-2">
                            <p className="text-sm font-semibold text-slate-900">{doc.created_by_name || "—"}</p>
                            {doc.created_by_role && (
                              <p className="text-sm font-medium text-slate-500 mt-0.5">{doc.created_by_role}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <p className="text-sm font-semibold text-slate-900">{doc.approved_by_name || "—"}</p>
                            {doc.approved_by_role && (
                              <p className="text-sm font-medium text-slate-500 mt-0.5">{doc.approved_by_role}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums font-semibold text-slate-950 text-sm">
                            {Number(doc.total_qty) > 0 ? Number(doc.total_qty).toLocaleString("vi-VN") : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-950 text-sm tabular-nums whitespace-nowrap">
                            {doc.total_amount_vnd ? fmtVND(doc.total_amount_vnd) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <DotPill tone={statusTone}>{STATUS_LABEL[doc.status] ?? doc.status}</DotPill>
                          </td>
                          <td className="px-3 py-2">
                            <p className="text-sm font-semibold text-slate-900">{dp.date}</p>
                            <p className="text-sm font-medium text-slate-500 tabular-nums mt-0.5">{dp.time}</p>
                          </td>
                          <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <Popover
                              open={docMenu === doc.id}
                              onOpenChange={(o) => setDocMenu(o ? doc.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 rounded-xs text-slate-500 hover:text-slate-800"
                                  aria-label={`Thao tác với ${doc.code}`}
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-44 p-1 rounded-xs shadow-xl">
                                <MenuItem
                                  icon={<Eye className="size-3.5" />}
                                  label="Xem chi tiết"
                                  onClick={() => {
                                    setDocMenu(null);
                                    openDocDetail(doc.id, doc.code);
                                  }}
                                />
                                {canDeleteDocument(doc.type, doc.status) && <MenuItem
                                  icon={<Trash2 className="size-3.5" />}
                                  label="Xóa phiếu"
                                  destructive
                                  onClick={() => {
                                    setDocMenu(null);
                                    void handleDeleteDoc(doc.id);
                                  }}
                                />}
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
              page={docPage}
              totalPages={totalDocPages}
              total={filteredDocs.length}
              itemName="phiếu kho"
              onPage={setDocPage}
            />
          </section>
        </>
      )}

      {/* ── VIEW 3: XEM CHI TIẾT PHIẾU KHO (DOC DETAIL) ────────────────────── */}
      {view === "doc_detail" && (
        <div className="space-y-4">
          {loadingDoc || !docDetail ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-xs border border-border/80 bg-card p-12">
              <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-[#6941c6]" />
                <p>Đang tải chi tiết phiếu kho…</p>
              </div>
            </div>
          ) : (
            <>
              {/* Top Header Bar */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleBackToList("docs")}
                    className="size-8.5 rounded-xs border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                    title="Quay lại danh sách phiếu kho"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h1 className="text-slate-950 tabular-nums admin-page-title">
                        #{docDetail.code}
                      </h1>
                      <DotPill
                        tone={
                          docDetail.type === "receipt"
                            ? "green"
                            : docDetail.type === "issue"
                              ? "red"
                              : "violet"
                        }
                      >
                        {TYPE_LABEL[docDetail.type as DocType] ?? docDetail.type}
                      </DotPill>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-xs px-2.5 py-0.5 text-sm font-semibold border",
                          docDetail.status === "posted"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : docDetail.status === "approved"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : docDetail.status === "void"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-slate-200 bg-slate-50 text-slate-700",
                        )}
                      >
                        {STATUS_LABEL[docDetail.status] ?? docDetail.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText("mã phiếu", docDetail.code)}
                        className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-xs hover:bg-slate-100 cursor-pointer"
                        title="Sao chép mã phiếu"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-medium text-slate-600">
                      <span>Ngày lập: {fmtDate(docDetail.created_at)}</span>
                      <span className="text-slate-300">•</span>
                      <span>Kho: Kho Tổng (MAIN)</span>
                      {docDetail.posted_at && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-emerald-700 font-semibold">
                            Ghi sổ: {fmtDate(docDetail.posted_at)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    onClick={() => handleBackToList("docs")}
                    className="h-9 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Quay lại
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setPrintDocModalOpen(true)}
                    className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Printer className="size-3.5 text-slate-500" />
                    <span>In phiếu kho</span>
                  </Button>

                  {docDetail.status !== "posted" && canApprove && (
                    <Button
                      disabled={postingDoc}
                      onClick={() => handlePostDoc(docDetail.id)}
                      className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-semibold text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer"
                    >
                      {postingDoc ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5 text-white" />
                      )}
                      <span>Ghi sổ phiếu ngay</span>
                    </Button>
                  )}

                  {canDeleteDocument(docDetail.type, docDetail.status) && <Button
                    variant="outline"
                    onClick={() => handleDeleteDoc(docDetail.id)}
                    className="h-9 gap-1.5 rounded-xs border-destructive/30 bg-white px-3.5 text-sm font-semibold text-destructive hover:bg-destructive/10 shadow-2xs transition-colors cursor-pointer"
                    title="Xóa phiếu kho"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Xóa phiếu</span>
                  </Button>}
                </div>
              </div>

              {/* Metric Overview Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard
                  icon={<FileText className="size-4 text-[#6941c6]" />}
                  label="Loại chứng từ"
                  value={TYPE_LABEL[docDetail.type as DocType] ?? docDetail.type}
                  note={docDetail.reason || "Vận hành kho thường kỳ"}
                />
                <MetricCard
                  icon={<Package className="size-4 text-blue-600" />}
                  label="Tổng hàng hóa"
                  value={`${docDetail.lines.reduce((s, l) => s + l.qty, 0)} cái`}
                  note={`${docDetail.lines.length} dòng sản phẩm`}
                />
                <MetricCard
                  icon={<ArrowRightLeft className="size-4 text-amber-600" />}
                  label={docDetail.type === "issue" ? "Tổng giá trị xuất" : "Tổng giá trị vốn"}
                  value={fmtVND(totalDocAmount)}
                  note="Theo đơn giá chứng từ"
                />
                <MetricCard
                  icon={
                    docDetail.status === "posted" ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <Clock className="size-4 text-amber-600" />
                    )
                  }
                  label="Trạng thái tồn kho"
                  value={
                    docDetail.status === "posted"
                      ? "Đã ghi sổ"
                      : docDetail.status === "submitted"
                        ? "Chờ duyệt"
                        : docDetail.status === "approved"
                          ? "Chờ ghi sổ"
                          : "Nháp"
                  }
                  note={
                    docDetail.posted_at
                      ? fmtDate(docDetail.posted_at)
                      : docDetail.status === "submitted"
                        ? "Chưa được duyệt"
                        : "Chưa cập nhật vào kho"
                  }
                />
              </div>

              {/* 2 Columns: Lines & Summary */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {/* Left (8 cols): Line items table */}
                <div className="space-y-4 lg:col-span-8">
                  <div className="overflow-hidden rounded-xs border border-slate-200 bg-white shadow-2xs">
                    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-slate-950 admin-section-title">
                            Danh sách hàng hóa
                          </h2>
                          <span className="rounded-xs bg-slate-100 border border-slate-200 px-2 py-0.5 tabular-nums text-sm font-semibold text-slate-700">
                            {docDetail.lines.length} sản phẩm
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-500 mt-0.5">
                          Chi tiết các sản phẩm và số lượng luân chuyển trong phiếu
                        </p>
                      </div>
                      <span className="tabular-nums text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-xs px-2.5 py-1 shadow-2xs">
                        Tổng {docDetail.lines.reduce((s, l) => s + l.qty, 0).toLocaleString("vi-VN")} cái
                      </span>
                    </div>

                    {/* Search & Pagination Controls Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 bg-white px-4 py-2.5">
                      <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Tìm sản phẩm, SKU, phân loại..."
                          value={docLineQuery}
                          onChange={(e) => {
                            setDocLineQuery(e.target.value);
                            setDocLinePage(1);
                          }}
                          className="h-8 pl-8 pr-7 text-sm font-medium rounded-xs border-slate-200 bg-white focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                        />
                        {docLineQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setDocLineQuery("");
                              setDocLinePage(1);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                        <span>Hiển thị:</span>
                        <select
                          aria-label="Số dòng mỗi trang"
                          value={docLinePageSize}
                          onChange={(e) => {
                            setDocLinePageSize(Number(e.target.value));
                            setDocLinePage(1);
                          }}
                          className="h-7.5 rounded-xs border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#6941c6]"
                        >
                          <option value={10}>10 dòng</option>
                          <option value={20}>20 dòng</option>
                          <option value={50}>50 dòng</option>
                          <option value={100}>100 dòng</option>
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50/80 text-sm font-semibold text-slate-700">
                          <tr>
                            <th className="py-2.5 pl-4 pr-3 font-semibold text-slate-700 min-w-[240px]">Sản phẩm</th>
                            <th className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">Phân loại</th>
                            <th className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">Mã SKU</th>
                            <th className="px-3 py-2.5 text-center font-semibold text-slate-700 whitespace-nowrap">Chiều</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap min-w-[130px]">
                              {docDetail.type === "issue" ? "Đơn giá xuất (₫)" : "Đơn giá vốn (₫)"}
                            </th>
                            <th className="px-3 py-2.5 text-center font-semibold text-slate-700 whitespace-nowrap min-w-[100px]">Số lượng</th>
                            <th className="py-2.5 pl-3 pr-4 text-right font-semibold text-slate-700 whitespace-nowrap min-w-[140px]">Thành tiền (₫)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pagedDocLines.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-10 text-center text-sm text-slate-500 font-medium">
                                {docLineQuery
                                  ? `Không tìm thấy sản phẩm nào khớp với "${docLineQuery}"`
                                  : "Không có sản phẩm nào trong phiếu kho"}
                              </td>
                            </tr>
                          ) : (
                            pagedDocLines.map((line, idx) => {
                              const imgUrl = resolveImageUrl(line.image_url);
                              const unitCost = resolveLineCost(line);
                              const lineTotal = unitCost * line.qty;
                              return (
                                <tr key={line.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                  {/* Cột sản phẩm: giới hạn độ rộng để tên tự động thu gọn và hiện dấu ... */}
                                  <td className="py-2.5 pl-4 pr-3 max-w-[280px]">
                                    <div className="flex items-center gap-2.5">
                                      <div className="relative size-10 shrink-0 overflow-hidden rounded-xs border border-slate-200 bg-slate-100">
                                        {imgUrl ? (
                                          <img
                                            src={imgUrl}
                                            alt={line.product_name}
                                            className="size-full object-cover"
                                            onError={(e) => {
                                              (e.target as HTMLElement).style.display = "none";
                                            }}
                                          />
                                        ) : (
                                          <div className="flex size-full items-center justify-center text-slate-400">
                                            <Package className="size-4 stroke-[1.5]" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0 max-w-[220px]">
                                        <p
                                          className="truncate font-semibold text-sm text-slate-950 leading-snug"
                                          title={line.product_name}
                                        >
                                          {line.product_name}
                                        </p>
                                        {line.barcode && (
                                          <p className="tabular-nums text-xs font-semibold text-slate-500 mt-0.5">
                                            BC: {line.barcode}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                    <span className="inline-flex items-center rounded-xs bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-800">
                                      {line.color_name} · Kích cỡ {line.size_label}
                                    </span>
                                  </td>

                                  <td className="px-3 py-2.5 tabular-nums text-sm font-semibold text-slate-700 whitespace-nowrap">
                                    {line.sku}
                                  </td>

                                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-sm font-semibold",
                                        line.direction === "in"
                                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                          : "bg-rose-50 text-rose-700 border border-rose-200",
                                      )}
                                    >
                                      {line.direction === "in" ? "+ Nhập" : "- Xuất"}
                                    </span>
                                  </td>

                                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                    {unitCost > 0 ? (
                                      <div className="inline-block text-right">
                                        <span className="tabular-nums text-sm font-semibold text-slate-900 block tabular-nums">
                                          {fmtVND(unitCost)}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-500 block">
                                          {docDetail.type === "issue" ? "Giá hóa đơn" : "Giá vốn"}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 font-semibold">—</span>
                                    )}
                                  </td>

                                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                    <span className="inline-flex min-w-10 items-center justify-center rounded-xs bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 tabular-nums text-sm font-semibold text-slate-950 tabular-nums">
                                      {line.qty.toLocaleString("vi-VN")}
                                    </span>
                                  </td>

                                  <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                                    {lineTotal > 0 ? (
                                      <div className="inline-block text-right">
                                        <span className="tabular-nums text-sm font-semibold text-slate-950 block tabular-nums">
                                          {fmtVND(lineTotal)}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 font-semibold">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Phân trang danh sách sản phẩm */}
                    {filteredDocLines.length > docLinePageSize && (
                      <Pager
                        page={docLinePage}
                        totalPages={totalDocLinePages}
                        total={filteredDocLines.length}
                        itemName="sản phẩm"
                        pageSize={docLinePageSize}
                        onPage={setDocLinePage}
                      />
                    )}

                    {/* Summary Footer */}
                    <div className="border-t border-slate-200 bg-slate-50/40 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="text-sm font-medium text-slate-600">
                          Chứng từ gồm <strong className="text-slate-950">{docDetail.lines.length}</strong> dòng sản phẩm
                        </div>

                        <div className="space-y-1.5 sm:w-80 ml-auto">
                          <div className="flex justify-between text-sm text-slate-600">
                            <span>Tổng số mặt hàng:</span>
                            <span className="tabular-nums font-semibold text-slate-950">
                              {docDetail.lines.length} sản phẩm
                            </span>
                          </div>
                          <div className="flex justify-between text-sm text-slate-600">
                            <span>Tổng số lượng:</span>
                            <span className="tabular-nums font-semibold text-slate-950">
                              {docDetail.lines.reduce((s, l) => s + l.qty, 0).toLocaleString("vi-VN")} cái
                            </span>
                          </div>
                          {totalDocAmount > 0 && (
                            <div className="flex justify-between items-baseline border-t border-slate-200 pt-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {docDetail.type === "issue"
                                  ? "Tổng giá trị xuất (Hóa đơn):"
                                  : "Tổng giá trị vốn nhập:"}
                              </span>
                              <span className="text-lg font-semibold text-[#6941c6] tabular-nums">
                                {fmtVND(totalDocAmount)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right (4 cols): Metadata */}
                <div className="space-y-4 lg:col-span-4">
                  {/* Card 1: Thông tin chứng từ */}
                  <div className="rounded-xs border border-slate-200 bg-white p-4 space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <h3 className="uppercase text-slate-900 admin-subsection-title">
                        Thông tin chứng từ
                      </h3>
                      <span className="tabular-nums text-sm font-semibold text-slate-500">
                        #{docDetail.code}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-600">Mã phiếu:</span>
                        <div className="flex items-center gap-1.5 tabular-nums font-semibold text-slate-950">
                          <span>#{docDetail.code}</span>
                          <button
                            type="button"
                            onClick={() => copyText("mã phiếu", docDetail.code)}
                            className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 rounded-xs hover:bg-slate-100 cursor-pointer"
                            title="Sao chép"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-600">Loại chứng từ:</span>
                        <DotPill
                          tone={
                            docDetail.type === "receipt"
                              ? "green"
                              : docDetail.type === "issue"
                                ? "red"
                                : "violet"
                          }
                        >
                          {TYPE_LABEL[docDetail.type as DocType] ?? docDetail.type}
                        </DotPill>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-600">Trạng thái:</span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-xs px-2.5 py-0.5 text-sm font-semibold border",
                            docDetail.status === "posted"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : docDetail.status === "submitted"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : docDetail.status === "approved"
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : docDetail.status === "void"
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : "border-slate-200 bg-slate-50 text-slate-700",
                          )}
                        >
                          {STATUS_LABEL[docDetail.status] ?? docDetail.status}
                        </span>
                      </div>

                      <div className="border-t border-slate-200 pt-2.5 space-y-2.5">
                        <div>
                          <span className="font-semibold text-slate-600 block text-sm">Lý do thực hiện:</span>
                          <p className="mt-0.5 font-semibold text-slate-950">
                            {docDetail.reason || "Vận hành kho thường kỳ"}
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-600">Kho thực hiện:</span>
                          <span className="font-semibold text-slate-950">Kho Tổng (MAIN)</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-600">Người lập:</span>
                          <span className="font-semibold text-slate-950">
                            {docDetail.requested_by || "Quản trị viên"}
                          </span>
                        </div>

                        {docDetail.approved_by && (
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-600">Người duyệt:</span>
                            <span className="font-semibold text-slate-950">{docDetail.approved_by}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-600">Ngày lập:</span>
                          <span className="tabular-nums font-semibold text-slate-800">{fmtDate(docDetail.created_at)}</span>
                        </div>

                        {docDetail.posted_at && (
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-600">Ngày ghi sổ:</span>
                            <span className="tabular-nums text-emerald-700 font-semibold">
                              {fmtDate(docDetail.posted_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Trạng thái & Tác động kho */}
                  <div className="rounded-xs border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      {docDetail.status === "posted" ? (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="size-4 text-amber-500 shrink-0" />
                      )}
                      <h3 className="uppercase text-slate-900 admin-subsection-title">
                        Tác động tồn kho
                      </h3>
                    </div>

                    <p className="text-sm leading-relaxed font-medium text-slate-600">
                      {docDetail.status === "posted" ? (
                        <>
                          Chứng từ này <strong className="text-slate-950 font-semibold">đã được ghi sổ</strong>. Số lượng tồn kho thực tế và khả
                          dụng của tất cả sản phẩm trong phiếu đã được cập nhật vào hệ thống.
                        </>
                      ) : docDetail.status === "submitted" ? (
                        <>
                          Chứng từ đang <strong className="text-slate-950 font-semibold">chờ duyệt</strong>. Tồn kho thực tế chưa bị thay đổi;
                          người có quyền duyệt cần kiểm tra trước khi cho phép ghi sổ.
                        </>
                      ) : docDetail.status === "approved" ? (
                        <>
                          Chứng từ đang ở trạng thái <strong className="text-slate-950 font-semibold">chờ ghi sổ</strong>. Tồn kho thực tế chưa
                          bị thay đổi. Hãy kiểm tra chính xác hàng hóa trước khi xác nhận ghi sổ.
                        </>
                      ) : (
                        <>
                          Chứng từ đang ở trạng thái <strong className="text-slate-950 font-semibold">nháp</strong>. Tồn kho thực tế chưa bị
                          thay đổi; hãy tạo phiếu để gửi duyệt khi đã hoàn tất thông tin.
                        </>
                      )}
                    </p>

                    {docDetail.status !== "posted" && canApprove && (
                      <div className="space-y-2">
                        {(docDetail.status === "submitted" || docDetail.status === "draft") && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={postingDoc}
                            onClick={() => handleApproveDoc(docDetail.id)}
                            className="w-full h-9 gap-1.5 rounded-xs border-[#6941c6] text-[#6941c6] text-sm font-semibold hover:bg-purple-50 transition-colors cursor-pointer"
                          >
                            {postingDoc ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                            <span>Duyệt phiếu</span>
                          </Button>
                        )}
                        {docDetail.status === "approved" && (
                          <Button
                            size="sm"
                            disabled={postingDoc}
                            onClick={() => handlePostDoc(docDetail.id)}
                            className="w-full h-9 gap-1.5 rounded-xs bg-[#6941c6] text-sm font-semibold text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer"
                          >
                            {postingDoc ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5 text-white" />}
                            <span>Ghi sổ chứng từ ngay</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── VIEW 4: LẬP PHIẾU KHO MỚI (COMPOSE FORM) ────────────────────────── */}
      {view === "form" && (
        <div className="space-y-4">
          {/* Top Action Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleBackToList("docs")}
                className="size-8.5 rounded-xs border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                title="Quay lại danh sách phiếu kho"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-slate-950 admin-page-title">
                    Lập phiếu kho mới
                  </h1>
                  <DotPill
                    tone={
                      formType === "receipt" ? "green" : formType === "issue" ? "red" : "violet"
                    }
                  >
                    {formType === "receipt"
                      ? "Phiếu nhập"
                      : formType === "issue"
                        ? "Phiếu xuất"
                        : "Điều chỉnh"}
                  </DotPill>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  Tạo chứng từ xuất, nhập hoặc kiểm kê tồn kho · Kho {warehouseLabel}
                  {linkedOrderId && (
                    <span className="ml-1 font-semibold text-[#6941c6]">
                      · Theo đơn #{linkedOrderId.slice(0, 8)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                variant="outline"
                onClick={() => handleBackToList("docs")}
                className="h-9 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                Hủy
              </Button>
              <Button
                variant="outline"
                disabled={saving || !lines.length || !canCreateDocumentType(formType)}
                onClick={() => handleSaveDoc("draft")}
                className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                <span>Lưu phiếu nháp</span>
              </Button>
              {canCreateDocumentType(formType) && <Button
                variant="outline"
                disabled={saving || !lines.length}
                onClick={() => handleSaveDoc("submit")}
                className="h-9 gap-1.5 rounded-xs border-[#6941c6] bg-white px-4 text-sm font-semibold text-[#6941c6] shadow-2xs hover:bg-purple-50 transition-colors cursor-pointer"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                <span>Tạo phiếu</span>
              </Button>}
              {canApprove && canCreateDocumentType(formType) && <Button
                disabled={saving || !lines.length}
                onClick={() => handleSaveDoc("post")}
                className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-semibold text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                <span>Ghi sổ ngay</span>
              </Button>}
            </div>
          </div>

          {/* Form Content */}
          <div className="space-y-4">
            {/* Top Row: Information & Matrix Picker */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Card 1 (5 cols): Thông tin phiếu kho */}
              <div className="rounded-xs border border-slate-200 bg-white p-4 space-y-3.5 lg:col-span-5 shadow-2xs">
                <div>
                  <h3 className="text-slate-950 admin-subsection-title">Thông tin phiếu</h3>
                  <p className="text-sm font-medium text-slate-500 mt-0.5">
                    Chọn loại nghiệp vụ kho và lý do thực hiện
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 block mb-1.5">
                      Loại phiếu kho
                    </label>
                    <div className="grid grid-cols-3 gap-1 rounded-xs border border-slate-200 bg-slate-100/80 p-0.5">
                      {(
                        [
                          ["receipt", "Nhập kho", PackagePlus],
                          ["issue", "Xuất kho", PackageMinus],
                          ["adjustment", "Điều chỉnh", ArrowRightLeft],
                        ] as const
                      ).filter(([t]) => canCreateDocumentType(t)).map(([t, lbl, Icon]) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormType(t)}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-xs py-1.5 text-sm font-semibold transition-colors cursor-pointer",
                            formType === t
                              ? "bg-white text-slate-950 shadow-2xs"
                              : "text-slate-600 hover:text-slate-950",
                          )}
                        >
                          <Icon className="size-3.5" />
                          <span>{lbl}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700 block">
                      Lý do lập phiếu
                    </label>
                    <Input
                      className="mt-1 h-9 rounded-xs border-slate-200 bg-white text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                      placeholder="Ví dụ: Nhập hàng may từ xưởng, Xuất đơn hàng #ELN..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  <div className="rounded-xs border border-slate-200 bg-slate-50 px-3 py-2 text-sm flex items-center justify-between">
                    <span className="font-semibold text-slate-600">Kho thao tác:</span>
                    <span className="font-semibold text-slate-950">Kho {warehouseLabel}</span>
                  </div>

                  {linkedOrderId && (
                    <div className="rounded-xs border border-[#6941c6]/30 bg-[#f4f3ff] px-3 py-2 text-sm flex items-center justify-between">
                      <span className="font-semibold text-slate-600">Đơn hàng liên kết:</span>
                      <span className="tabular-nums font-semibold text-[#6941c6]">
                        #{linkedOrderId.slice(0, 8)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2 (7 cols): Thêm hàng nhanh từ lưới ma trận */}
              <div className="rounded-xs border border-slate-200 bg-white p-4 space-y-3.5 lg:col-span-7 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-slate-950 admin-subsection-title">Chọn sản phẩm</h3>
                    <p className="text-sm font-medium text-slate-500 mt-0.5">
                      Nhập số lượng theo từng Màu × Kích cỡ
                    </p>
                  </div>
                  {matrixProduct && (
                    <span className="text-sm text-slate-500 tabular-nums font-semibold">
                      {matrixProduct.variants.length} phân loại
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="h-9 rounded-xs border-slate-200 bg-white pl-8.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                      placeholder="Tìm tên hoặc SKU…"
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                    />
                  </div>
                  <div>
                    <select
                      className="h-9 w-full appearance-none rounded-xs border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                      value={matrixProductId}
                      onChange={(e) => {
                        setMatrixProductId(e.target.value);
                        setMatrixQty({});
                      }}
                    >
                      <option value="">{catalogLoading ? "Đang tìm kiếm..." : "Chọn sản phẩm…"}</option>
                      {filteredCatalog.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.variants.length} SKU)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {matrixProduct ? (
                  (() => {
                    const { colors, sizes, byKey } = matrixAxes(matrixProduct);
                    const prodImg = resolveImageUrl(matrixProduct.image_url);
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2.5 rounded-xs border border-slate-200 bg-slate-50 p-2">
                          <div className="size-9 shrink-0 overflow-hidden rounded-xs border border-slate-200 bg-white">
                            {prodImg ? (
                              <img src={prodImg} alt={matrixProduct.name} className="size-full object-cover" />
                            ) : (
                              <Package className="size-full p-1.5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-950">{matrixProduct.name}</p>
                            <p className="text-sm font-medium text-slate-500">Chọn số lượng để thêm vào bảng</p>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-xs border border-slate-200">
                          <table className="w-full min-w-max text-sm">
                            <thead className="bg-slate-50/80 border-b border-slate-200">
                              <tr>
                                <th className="px-3.5 py-2 text-left font-semibold text-slate-800 whitespace-nowrap min-w-[110px]">
                                  Màu \ Kích cỡ
                                </th>
                                {sizes.map((sz) => (
                                  <th
                                    key={sz}
                                    className="px-2.5 py-2 text-center font-semibold text-slate-800 min-w-[110px]"
                                  >
                                    {sz}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {colors.map((color) => (
                                <tr key={color} className="border-t border-slate-200">
                                  <td className="px-3.5 py-2 font-semibold text-slate-900 whitespace-nowrap">{color}</td>
                                  {sizes.map((sz) => {
                                    const v = byKey.get(`${color}||${sz}`);
                                    if (!v) {
                                      return (
                                        <td key={sz} className="px-2 py-2 text-center text-slate-400 min-w-[110px]">
                                          —
                                        </td>
                                      );
                                    }
                                    return (
                                      <td key={sz} className="px-2 py-2 text-center min-w-[110px]">
                                        <Input
                                          className="h-8.5 w-24 sm:w-28 rounded-xs border-slate-200 text-center tabular-nums text-sm font-semibold bg-white mx-auto focus:border-[#6941c6] px-1.5 placeholder:text-xs placeholder:font-normal placeholder:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          type="number"
                                          min={0}
                                          placeholder={
                                            formType === "issue"
                                              ? `tối đa ${v.on_hand ?? v.available}`
                                              : "0"
                                          }
                                          value={matrixQty[v.id] ?? ""}
                                          onChange={(e) =>
                                            setMatrixQty((q) => ({ ...q, [v.id]: e.target.value }))
                                          }
                                        />
                                        {formType === "issue" && (
                                          <span className="block text-xs text-slate-500 font-medium mt-1 whitespace-nowrap">
                                            kho: <b className="text-slate-900 font-semibold">{v.on_hand ?? v.available}</b>
                                            {(v.reserved ?? 0) > 0 ? (
                                              <span className="text-amber-700 font-semibold">
                                                {" "}({v.reserved})
                                              </span>
                                            ) : null}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!matrixProduct}
                            onClick={addMatrixToLines}
                            className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-semibold text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer"
                          >
                            <Plus className="size-3.5" />
                            <span>Thêm vào phiếu</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="rounded-xs border border-dashed border-slate-200 py-6 text-center text-sm font-medium text-slate-500">
                    Chọn một sản phẩm phía trên để nhập số lượng theo từng Màu × Kích cỡ.
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Row: Full-width Line Items Table */}
            <div className="rounded-xs border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-3 gap-3">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-slate-950 admin-subsection-title">
                    Sản phẩm trong phiếu
                  </h3>
                  <span className="rounded-xs bg-white border border-slate-200 px-2.5 py-0.5 text-sm font-semibold text-slate-800 shadow-2xs">
                    {lines.length} dòng
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-600">
                    Tổng số lượng:{" "}
                    <strong className="font-semibold text-slate-950 tabular-nums">
                      {lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)} cái
                    </strong>
                  </span>
                  {lines.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setLines([])}
                      className="h-8 gap-1.5 rounded-xs border-rose-200 bg-white px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 shadow-2xs"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Xóa hết</span>
                    </Button>
                  )}
                </div>
              </div>

              {lines.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
                  <Package className="size-8 mx-auto text-slate-300 stroke-[1.5]" />
                  <p className="text-sm font-semibold text-slate-900">Chưa có sản phẩm nào trong phiếu kho</p>
                  <p className="text-sm max-w-sm mx-auto text-slate-500 font-medium">
                    Chọn sản phẩm và nhập số lượng ở lưới ma trận bên trên để đưa vào danh sách xuất / nhập.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                      <tr className="text-slate-700">
                        <th className="py-2.5 pl-4 w-12 text-center font-semibold text-slate-700">STT</th>
                        <th className="py-2.5 px-3 font-semibold text-slate-700">Sản phẩm</th>
                        <th className="py-2.5 px-3 font-semibold text-slate-700">Phân loại / SKU</th>
                        <th className="py-2.5 px-3 text-right font-semibold text-slate-700 min-w-[150px]">
                          {formType === "receipt"
                            ? "Giá vốn nhập (₫)"
                            : formType === "issue"
                              ? "Đơn giá hóa đơn"
                              : "Đơn giá (₫)"}
                        </th>
                        <th className="py-2.5 px-3 text-center font-semibold text-slate-700 min-w-[130px]">Số lượng</th>
                        <th className="py-2.5 px-4 text-right font-semibold text-slate-700 min-w-[130px]">Thành tiền</th>
                        <th className="py-2.5 pr-4 w-12 text-center font-semibold text-slate-700">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((line, idx) => {
                        const p = catalog.find((x) => x.id === line.product_id);
                        const v = p?.variants.find((x) => x.id === line.variant_id);
                        const displayName = p?.name ?? line.product_name ?? "Sản phẩm";
                        const variantLabel = v
                          ? `${v.color} · ${v.size}`
                          : [line.color_label, line.size_label ? `Kích cỡ ${line.size_label}` : null]
                            .filter(Boolean)
                            .join(" · ") || "—";
                        const displaySku = v?.sku ?? line.sku ?? "—";
                        const img = line.image_url || v?.image_url || p?.image_url || null;
                        const imgUrl = resolveImageUrl(img);
                        const lineQty = Number(line.qty) || 0;
                        const lineCost = line.unit_cost_vnd || 0;
                        const lineTotal = lineQty * lineCost;

                        return (
                          <tr key={`${line.variant_id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                            {/* STT */}
                            <td className="py-3 pl-4 text-center tabular-nums font-semibold text-slate-500 text-sm">
                              {idx + 1}
                            </td>

                            {/* Sản phẩm & Thumbnail */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="relative size-10 shrink-0 overflow-hidden rounded-xs border border-slate-200 bg-slate-50">
                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={displayName}
                                      className="size-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <div className="flex size-full items-center justify-center text-slate-400">
                                      <Package className="size-4 stroke-[1.5]" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 max-w-[260px]">
                                  <p
                                    className="font-semibold text-slate-950 text-sm leading-snug truncate"
                                    title={displayName}
                                  >
                                    {displayName}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Phân loại & SKU */}
                            <td className="py-3 px-3">
                              <div className="space-y-0.5">
                                <span className="inline-block rounded-xs bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-sm font-semibold text-slate-800">
                                  {variantLabel}
                                </span>
                                <p className="tabular-nums text-sm font-semibold text-slate-500">
                                  SKU: {displaySku}
                                </p>
                              </div>
                            </td>

                            {/* Đơn giá */}
                            <td className="py-3 px-3 text-right">
                              {formType === "receipt" ? (
                                <div className="inline-flex items-center relative">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1000}
                                    placeholder="0"
                                    value={
                                      line.cost_input ??
                                      (line.unit_cost_vnd != null ? String(line.unit_cost_vnd) : "")
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const parsed = val === "" ? undefined : Number(val);
                                      setLines((ls) =>
                                        ls.map((l, i) =>
                                          i === idx
                                            ? {
                                              ...l,
                                              cost_input: val,
                                              unit_cost_vnd: parsed,
                                            }
                                            : l,
                                        ),
                                      );
                                    }}
                                    className="h-8 w-28 pr-6 text-right tabular-nums text-sm font-semibold text-slate-900 bg-white rounded-xs border-slate-200 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                                  />
                                  <span className="pointer-events-none absolute right-2 text-sm font-semibold text-slate-400">
                                    ₫
                                  </span>
                                </div>
                              ) : formType === "issue" ? (
                                <div className="inline-block text-right">
                                  <span className="text-sm font-semibold text-slate-950 block tabular-nums">
                                    {fmtVND(lineCost)}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-500 block">
                                    Đã thanh toán
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center relative">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1000}
                                    placeholder="0"
                                    value={
                                      line.cost_input ??
                                      (line.unit_cost_vnd != null ? String(line.unit_cost_vnd) : "")
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const parsed = val === "" ? undefined : Number(val);
                                      setLines((ls) =>
                                        ls.map((l, i) =>
                                          i === idx
                                            ? {
                                              ...l,
                                              cost_input: val,
                                              unit_cost_vnd: parsed,
                                            }
                                            : l,
                                        ),
                                      );
                                    }}
                                    className="h-8 w-28 pr-6 text-right tabular-nums text-sm font-semibold text-slate-900 bg-white rounded-xs border-slate-200 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                                  />
                                  <span className="pointer-events-none absolute right-2 text-sm font-semibold text-slate-400">
                                    ₫
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Số lượng */}
                            <td className="py-3 px-3 text-center">
                              <div className="inline-flex items-center gap-1 justify-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cur = Math.max(1, (Number(line.qty) || 1) - 1);
                                    setLines((ls) =>
                                      ls.map((l, i) => (i === idx ? { ...l, qty: String(cur) } : l)),
                                    );
                                  }}
                                  className="size-7 rounded-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 flex items-center justify-center text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
                                  title="Giảm 1"
                                >
                                  -
                                </button>
                                <Input
                                  type="number"
                                  min={1}
                                  value={line.qty}
                                  onChange={(e) =>
                                    setLines((ls) =>
                                      ls.map((l, i) => (i === idx ? { ...l, qty: e.target.value } : l)),
                                    )
                                  }
                                  className="h-7 w-13 text-center tabular-nums tabular-nums text-sm font-semibold text-slate-950 bg-white rounded-xs border-slate-200 px-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cur = (Number(line.qty) || 0) + 1;
                                    setLines((ls) =>
                                      ls.map((l, i) => (i === idx ? { ...l, qty: String(cur) } : l)),
                                    );
                                  }}
                                  className="size-7 rounded-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 flex items-center justify-center text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
                                  title="Tăng 1"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            {/* Thành tiền */}
                            <td className="py-3 px-4 text-right">
                              <span className="text-sm font-semibold tabular-nums text-slate-950">
                                {fmtVND(lineTotal)}
                              </span>
                            </td>

                            {/* Xóa dòng */}
                            <td className="py-3 pr-4 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                                className="size-8 rounded-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Xóa dòng này"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer summary table */}
              {lines.length > 0 && (
                <div className="border-t border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-sm font-medium text-slate-600">
                      Hiển thị <strong className="font-semibold text-slate-950">{lines.length}</strong> dòng sản phẩm được chọn
                    </div>

                    <div className="space-y-1.5 sm:w-84 ml-auto">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span className="font-medium">Tổng số mặt hàng:</span>
                        <span className="tabular-nums font-semibold text-slate-950">{lines.length} dòng</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600">
                        <span className="font-medium">Tổng số lượng:</span>
                        <span className="tabular-nums font-semibold text-slate-950">
                          {lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)} cái
                        </span>
                      </div>
                      {lines.some((l) => (l.unit_cost_vnd || 0) > 0) && (
                        <div className="flex justify-between items-baseline border-t border-slate-200 pt-2">
                          <span className="text-sm font-semibold text-slate-950">
                            {formType === "issue"
                              ? "Tổng giá trị xuất (Hóa đơn):"
                              : "Tổng giá trị vốn nhập:"}
                          </span>
                          <span className="text-lg font-semibold text-[#6941c6] tabular-nums">
                            {fmtVND(
                              lines.reduce(
                                (s, l) => s + (Number(l.qty) || 0) * (l.unit_cost_vnd || 0),
                                0,
                              ),
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
