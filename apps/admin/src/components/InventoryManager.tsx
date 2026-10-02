import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowDownUp,
  ArrowLeft,
  ArrowUpFromLine,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Package,
  PackageMinus,
  PackagePlus,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import type {
  InventoryDocumentDetail,
  InventoryDocumentListItem,
  InventoryItem,
} from "@/lib/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

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

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`Đã copy ${label}`),
    () => toast.error("Không copy được"),
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type MainView = "stock" | "docs" | "doc_detail" | "form";
type StockFilter = "all" | "low" | "out" | "safe";
type DocFilter = "all" | "receipt" | "issue" | "adjustment" | "draft" | "posted";
type DocType = "receipt" | "issue" | "adjustment";

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
  approved: "Đã duyệt",
  posted: "Đã ghi sổ",
  void: "Đã hủy",
};

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
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-md border border-border bg-card shadow-2xl print:max-h-none print:w-full print:border-none print:shadow-none">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="size-4 text-primary" />
            <h3 className="font-serif text-base font-medium">{title}</h3>
            <span className="font-mono text-xs text-muted-foreground">#{doc.code}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
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

        {/* Printable Body */}
        <div className="overflow-y-auto p-8 font-sans text-foreground print:overflow-visible print:p-0">
          <div className="flex items-start justify-between border-b pb-6">
            <div>
              <p className="font-serif text-2xl font-bold tracking-wider text-primary">ÉLANE</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Hệ Thống Kho Vận & Quản Lý Tồn Kho
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Kho lưu trữ: <span className="font-medium text-foreground">Kho Tổng (MAIN)</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Lý do: <span className="font-medium text-foreground">{doc.reason || "Vận hành kho"}</span>
              </p>
            </div>
            <div className="text-right">
              <h2 className="font-serif text-xl font-bold uppercase tracking-tight text-foreground">
                {title}
              </h2>
              <p className="mt-1 font-mono text-base font-semibold text-primary">#{doc.code}</p>
              <p className="text-xs text-muted-foreground">Ngày lập: {fmtDate(doc.created_at)}</p>
              {doc.posted_at && (
                <p className="text-xs text-muted-foreground">Ngày ghi sổ: {fmtDate(doc.posted_at)}</p>
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
                <span className="font-mono text-[9px] tracking-widest text-muted-foreground">
                  *{doc.code}*
                </span>
              </div>
            </div>
          </div>

          {/* Table Lines */}
          <div className="mt-6 overflow-hidden rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/55">
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
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
                      <td className="py-2.5 pl-3 font-mono text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded border border-border bg-[#f7f4ef]">
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
                      <td className="py-2.5 font-mono text-xs">{l.sku}</td>
                      <td className="py-2.5 text-center">
                        <span className="rounded bg-secondary px-2 py-0.5 text-[11px]">
                          {l.size_label ? `Size ${l.size_label}` : ""}
                          {l.color_name ? ` · ${l.color_name}` : ""}
                        </span>
                      </td>
                      <td className="py-2.5 text-center font-medium">
                        {l.direction === "in" ? "+ Nhập" : "- Xuất"}
                      </td>
                      <td className="py-2.5 text-center font-bold text-foreground">{l.qty}</td>
                      <td className="py-2.5 text-right text-muted-foreground font-mono">
                        {fmtVND(l.unit_cost_vnd)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium text-foreground font-mono">
                        {fmtVND((l.unit_cost_vnd ?? 0) * l.qty)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 flex justify-end border-t pt-4 text-xs">
            <div className="w-72 space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Tổng số lượng:</span>
                <span className="font-bold text-foreground">{totalQty} cái</span>
              </div>
              {totalCost > 0 && (
                <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-foreground">
                  <span>
                    {doc.type === "issue" ? "Tổng giá trị xuất (Hóa đơn):" : "Tổng giá trị vốn nhập:"}
                  </span>
                  <span className="font-serif text-base text-primary">{fmtVND(totalCost)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-12 grid grid-cols-4 gap-4 text-center text-xs">
            <div>
              <p className="font-medium text-muted-foreground">Người lập phiếu</p>
              <p className="mt-12 text-[10px] text-muted-foreground">(Ký & họ tên)</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Thủ kho</p>
              <p className="mt-12 text-[10px] text-muted-foreground">(Ký & họ tên)</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Kế toán kho</p>
              <p className="mt-12 text-[10px] text-muted-foreground">(Ký & họ tên)</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Người giao / nhận</p>
              <p className="mt-12 text-[10px] text-muted-foreground">(Ký & họ tên)</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 print:hidden">
          <p className="text-xs text-muted-foreground">Mẫu phiếu kho tiêu chuẩn ÉLANE Atelier.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
              Đóng
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
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

// ─── MAIN INVENTORY MANAGER COMPONENT ─────────────────────────────────────────

export function InventoryManager({
  seedProduct,
  seed,
  onSeedConsumed,
}: {
  seedProduct?: { productId: string; productName?: string } | null;
  seed?: InventorySeed | null;
  onSeedConsumed?: () => void;
} = {}) {
  const [view, setView] = useState<MainView>("stock");
  const [stockTab, setStockTab] = useState<StockFilter>("all");
  const [docTab, setDocTab] = useState<DocFilter>("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"available" | "name" | "sku">("available");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(20);
  const [docPage, setDocPage] = useState(1);
  const [docPageSize, setDocPageSize] = useState(15);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [docs, setDocs] = useState<InventoryDocumentListItem[]>([]);
  const [warehouseLabel, setWarehouseLabel] = useState("MAIN");
  const [loading, setLoading] = useState(true);

  // Document Detail State
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docDetail, setDocDetail] = useState<InventoryDocumentDetail | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [postingDoc, setPostingDoc] = useState(false);
  const [printDocModalOpen, setPrintDocModalOpen] = useState(false);

  // Compose State
  const [formType, setFormType] = useState<DocType>("receipt");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [matrixProductId, setMatrixProductId] = useState("");
  const [matrixQty, setMatrixQty] = useState<Record<string, string>>({});
  const [matrixDirection, setMatrixDirection] = useState<"in" | "out">("in");
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { confirm, dialog: confirmDialog } = useConfirmDialog();

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
      toast.error(e instanceof Error ? e.message : "Tải dữ liệu kho thất bại");
    } finally {
      setLoading(false);
    }
  }, [loadStock, loadDocs]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Open Document Detail
  const openDocDetail = async (id: string) => {
    setSelectedDocId(id);
    setLoadingDoc(true);
    setView("doc_detail");
    try {
      const d = await adminApi.inventoryDocument(id);
      setDocDetail(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được phiếu kho");
    } finally {
      setLoadingDoc(false);
    }
  };

  // Post Document (Ghi sổ phiếu)
  const handlePostDoc = async (id: string) => {
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
      toast.error(e instanceof Error ? e.message : "Ghi sổ thất bại");
    } finally {
      setPostingDoc(false);
    }
  };

  // Delete / Revert Document
  const handleDeleteDoc = async (id: string) => {
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
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xóa được phiếu");
    }
  };

  // Open Form to create new doc
  const openCreateForm = async (opts?: InventorySeed) => {
    const targetType = opts?.docType ?? "receipt";
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
    try {
      const invByVariant = new Map(items.map((row) => [row.variant_id, row]));
      const prods = await adminApi.productsAll();
      const list: CatalogProduct[] = [];
      for (const p of prods.items) {
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
      toast.error(e instanceof Error ? e.message : "Không tải được danh mục sản phẩm");
      setLines([]);
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
      toast.error("Nhập số lượng ít nhất một ô Màu × Size");
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
  async function handleSaveDoc(andPost = false) {
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
      toast.success(`Đã tạo phiếu ${res.code}`);

      if (andPost) {
        const key = `post-${res.id}-${Date.now()}`;
        await adminApi.postDoc(res.id, key);
        toast.success(`Đã ghi sổ phiếu ${res.code} cập nhật tồn kho!`);
      }

      await reload();
      await openDocDetail(res.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tạo phiếu kho thất bại");
    } finally {
      setSaving(false);
    }
  }

  // ─── Metrics Calculation for Shop Owner ───────────────────────────────────

  const shopMetrics = useMemo(() => {
    const totalAvailable = items.reduce((s, it) => s + (it.available > 0 ? it.available : 0), 0);
    const lowCount = items.filter(isLow).length;
    const outCount = items.filter(isOut).length;
    const safeCount = items.filter((it) => it.available > it.reorder_point).length;

    const receiptDocs = docs.filter((d) => d.type === "receipt");
    const issueDocs = docs.filter((d) => d.type === "issue");
    const totalInboundQty = receiptDocs.reduce((s, d) => s + (Number(d.total_qty) || 0), 0);
    const totalOutboundQty = issueDocs.reduce((s, d) => s + (Number(d.total_qty) || 0), 0);

    return {
      totalAvailable,
      lowCount,
      outCount,
      safeCount,
      receiptCount: receiptDocs.length,
      issueCount: issueDocs.length,
      totalInboundQty,
      totalOutboundQty,
    };
  }, [items, docs]);

  // ─── Filtered Stock Items ─────────────────────────────────────────────────

  const filteredStock = useMemo(() => {
    let rows = items;
    if (stockTab === "low") rows = rows.filter(isLow);
    if (stockTab === "out") rows = rows.filter(isOut);
    if (stockTab === "safe") rows = rows.filter((it) => it.available > it.reorder_point);

    const q = query.trim().toLowerCase();
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

    return rows.sort((a, b) => {
      if (sortBy === "available") {
        return sortDir === "desc" ? b.available - a.available : a.available - b.available;
      }
      if (sortBy === "sku") {
        return sortDir === "desc" ? b.sku.localeCompare(a.sku) : a.sku.localeCompare(b.sku);
      }
      return sortDir === "desc"
        ? b.product_name.localeCompare(a.product_name, "vi")
        : a.product_name.localeCompare(b.product_name, "vi");
    });
  }, [items, stockTab, query, sortBy, sortDir]);

  // ─── Filtered Documents ───────────────────────────────────────────────────

  const filteredDocs = useMemo(() => {
    let list = docs;
    if (docTab === "receipt") list = list.filter((d) => d.type === "receipt");
    if (docTab === "issue") list = list.filter((d) => d.type === "issue");
    if (docTab === "adjustment") list = list.filter((d) => d.type === "adjustment");
    if (docTab === "draft") list = list.filter((d) => d.status === "draft" || d.status === "approved");
    if (docTab === "posted") list = list.filter((d) => d.status === "posted");

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.code.toLowerCase().includes(q) ||
          d.reason?.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q) ||
          d.status.toLowerCase().includes(q),
      );
    }
    return list;
  }, [docs, docTab, query]);

  // Reset pagination when filters change
  useEffect(() => {
    setStockPage(1);
  }, [stockTab, query, sortBy, sortDir]);

  useEffect(() => {
    setDocPage(1);
  }, [docTab, query]);

  // Sliced data for pagination
  const totalStockPages = Math.max(1, Math.ceil(filteredStock.length / stockPageSize));
  const pagedStock = useMemo(() => {
    const start = (stockPage - 1) * stockPageSize;
    return filteredStock.slice(start, start + stockPageSize);
  }, [filteredStock, stockPage, stockPageSize]);

  const totalDocPages = Math.max(1, Math.ceil(filteredDocs.length / docPageSize));
  const pagedDocs = useMemo(() => {
    const start = (docPage - 1) * docPageSize;
    return filteredDocs.slice(start, start + docPageSize);
  }, [filteredDocs, docPage, docPageSize]);

  return (
    <div className="space-y-6 pb-12">
      {confirmDialog}

      {/* Print Document Modal */}
      <PrintInventoryDocModal
        doc={docDetail}
        open={printDocModalOpen}
        onClose={() => setPrintDocModalOpen(false)}
      />

      {/* View Switcher Tabs Strip */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 border-b border-border pb-px">
          <button
            type="button"
            onClick={() => setView("stock")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px",
              view === "stock"
                ? "border-foreground text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Boxes className="size-3.5" />
            <span>Tồn kho hàng hóa</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px] leading-none inline-flex items-center justify-center transition-colors",
                view === "stock"
                  ? "bg-foreground text-background font-bold shadow-xs"
                  : "bg-secondary text-muted-foreground border border-border/60",
              )}
            >
              {items.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setView("docs")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px",
              view === "docs"
                ? "border-foreground text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <FileSpreadsheet className="size-3.5" />
            <span>Phiếu kho</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px] leading-none inline-flex items-center justify-center transition-colors",
                view === "docs"
                  ? "bg-foreground text-background font-bold shadow-xs"
                  : "bg-secondary text-muted-foreground border border-border/60",
              )}
            >
              {docs.length}
            </span>
          </button>

          {view === "doc_detail" && docDetail && (
            <button
              type="button"
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium border-b-2 border-foreground text-foreground font-semibold -mb-px"
            >
              <FileText className="size-3.5" />
              <span>Phiếu #{docDetail.code}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setView("docs");
                }}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
              >
                <X className="size-3" />
              </span>
            </button>
          )}

          {view === "form" && (
            <button
              type="button"
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium border-b-2 border-foreground text-foreground font-semibold -mb-px"
            >
              <Plus className="size-3.5" />
              <span>Lập phiếu mới</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setView("stock");
                }}
                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
              >
                <X className="size-3" />
              </span>
            </button>
          )}

          <div className="ml-2 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => openCreateForm({ docType: "receipt" })}
              className="h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium"
            >
              <Plus className="size-3.5" />
              <span>Tạo phiếu kho</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Visual Inbound / Outbound Metrics Bar */}
      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        {/* Metric 1: Total Available */}
        <div className="rounded-md border border-border bg-card p-5">
          <p className="section-label">Tồn kho khả dụng</p>
          <p className="mt-3 font-serif text-3xl font-normal">{shopMetrics.totalAvailable.toLocaleString("vi-VN")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length} biến thể SKU · Kho {warehouseLabel}
          </p>
        </div>

        {/* Metric 2: Total Inbound */}
        <div className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="section-label">Tổng hàng đã nhập</p>
            <ArrowDownToLine className="size-3.5 text-emerald-700" />
          </div>
          <p className="mt-3 font-serif text-3xl font-normal text-emerald-800 dark:text-emerald-300">
            +{shopMetrics.totalInboundQty.toLocaleString("vi-VN")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{shopMetrics.receiptCount} phiếu nhập kho</p>
        </div>

        {/* Metric 3: Total Outbound */}
        <div className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="section-label">Tổng hàng đã xuất</p>
            <ArrowUpFromLine className="size-3.5 text-orange-700" />
          </div>
          <p className="mt-3 font-serif text-3xl font-normal text-foreground">
            -{shopMetrics.totalOutboundQty.toLocaleString("vi-VN")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{shopMetrics.issueCount} phiếu xuất kho</p>
        </div>

        {/* Metric 4: Stock Alerts */}
        <div
          className={cn(
            "rounded-md border p-5 bg-card transition-colors",
            shopMetrics.lowCount > 0 || shopMetrics.outCount > 0
              ? "border-primary/40 bg-primary/5"
              : "border-border",
          )}
        >
          <p className="section-label">Cảnh báo tồn kho</p>
          <p
            className={cn(
              "mt-3 font-serif text-3xl font-normal",
              (shopMetrics.lowCount > 0 || shopMetrics.outCount > 0) && "text-primary",
            )}
          >
            {shopMetrics.lowCount} <span className="text-sm font-sans font-normal text-muted-foreground">sắp hết</span> · {shopMetrics.outCount} <span className="text-sm font-sans font-normal text-muted-foreground">cháy hàng</span>
          </p>
          <p className={cn("mt-1 text-xs", (shopMetrics.lowCount > 0 || shopMetrics.outCount > 0) ? "text-primary" : "text-muted-foreground")}>
            {shopMetrics.lowCount > 0 || shopMetrics.outCount > 0 ? "Cần lập phiếu nhập bổ sung" : "Tồn kho trong mức an toàn"}
          </p>
        </div>
      </section>

      {/* ── VIEW 1: TỒN KHO HÀNG HÓA ────────────────────────────────────────── */}
      {view === "stock" && (
        <section className="mt-6 overflow-hidden rounded-md border border-border bg-card">
          {/* Sub Filters & Search */}
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between bg-card/40">
            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {[
                { key: "all", label: "Tất cả", count: items.length },
                { key: "low", label: "Sắp hết hàng", count: shopMetrics.lowCount },
                { key: "out", label: "Hết hàng", count: shopMetrics.outCount },
                { key: "safe", label: "Tồn an toàn", count: shopMetrics.safeCount },
              ].map((f) => {
                const isActive = stockTab === f.key;

                return (
                  <Button
                    key={f.key}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStockTab(f.key as StockFilter)}
                    className={cn(
                      "h-8 text-xs font-medium shrink-0 gap-1.5 transition-all",
                      isActive && "bg-foreground text-background hover:bg-foreground/90 shadow-xs",
                    )}
                  >
                    <span>{f.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 font-mono text-[10px] leading-none inline-flex items-center justify-center min-w-4 h-4 transition-all",
                        isActive
                          ? "bg-white text-stone-950 font-bold shadow-xs"
                          : "bg-secondary text-muted-foreground border border-border/70",
                      )}
                    >
                      {f.count}
                    </span>
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm tên SP, SKU, mã vạch…"
                  className="h-8 pl-8 text-xs bg-[#f7f4ef]"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy(sortBy === "available" ? "name" : sortBy === "name" ? "sku" : "available")}
                className="h-8 gap-1 text-xs"
              >
                <ArrowDownUp className="size-3 text-muted-foreground" />
                {sortBy === "available" ? "Tồn khả dụng" : sortBy === "name" ? "Tên SP" : "SKU"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
                className="h-8 px-2.5 text-xs"
              >
                {sortDir === "desc" ? "↓" : "↑"}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => void reload()}
                className="size-8"
                title="Làm mới"
              >
                <RefreshCcw className={cn("size-3.5", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-secondary/55">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Sản phẩm
                  </th>
                  <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Mã SKU / Vạch
                  </th>
                  <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Phân loại
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Tồn trong kho
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Chờ xuất đơn
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Khả dụng bán
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Giá bán
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Trạng thái
                  </th>
                  <th className="w-28 px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-5 animate-spin text-primary" />
                        <span>Đang tải số liệu kho hàng…</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-muted-foreground">
                      Không tìm thấy mặt hàng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  pagedStock.map((row) => {
                    const imgUrl = resolveImageUrl(row.image_url);
                    const isOutStock = row.available <= 0;
                    const isLowStock = !isOutStock && row.available <= row.reorder_point;

                    return (
                      <tr key={row.variant_id} className="border-t border-border hover:bg-secondary/35 transition-colors">
                        {/* Product info with thumbnail */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative size-12 shrink-0 overflow-hidden rounded border border-border bg-[#f7f4ef]">
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
                                <div className="flex size-full items-center justify-center text-muted-foreground">
                                  <Package className="size-5 stroke-[1.5]" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-serif text-sm font-medium leading-snug truncate max-w-[240px]">
                                {row.product_name}
                              </p>
                              <span className="text-[11px] text-muted-foreground">Kho {warehouseLabel}</span>
                            </div>
                          </div>
                        </td>

                        {/* SKU & Barcode */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold">{row.sku}</span>
                            <button
                              onClick={() => copyText("mã SKU", row.sku)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Copy SKU"
                            >
                              <Copy className="size-3" />
                            </button>
                          </div>
                          {row.barcode && (
                            <span className="block font-mono text-[10px] text-muted-foreground">
                              {row.barcode}
                            </span>
                          )}
                        </td>

                        {/* Variant: Color & Size */}
                        <td className="px-4 py-3">
                          <span className="rounded bg-secondary px-2 py-0.5 text-xs text-foreground font-medium">
                            {row.color_name} · Size {row.size_label}
                          </span>
                        </td>

                        {/* On Hand: Tồn thực tế trong kho */}
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-sm font-bold text-foreground">
                            {row.on_hand}
                          </span>
                        </td>

                        {/* Reserved: Chờ xuất cho đơn khách */}
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {row.reserved > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400 font-medium">
                              {row.reserved}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>

                        {/* Available: Khả dụng để bán */}
                        <td className="px-4 py-3 text-right">
                          <span
                            className={cn(
                              "font-mono text-sm font-semibold",
                              isOutStock
                                ? "text-muted-foreground line-through"
                                : isLowStock
                                  ? "text-primary font-bold"
                                  : "text-foreground",
                            )}
                          >
                            {row.available}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            tối thiểu {row.reorder_point}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="px-4 py-3 text-right font-serif text-xs font-medium text-foreground">
                          {fmtVND(row.price_vnd)}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          {isOutStock ? (
                            <span className="inline-flex rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                              Hết hàng
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Sắp hết ({row.available})
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                              Ổn định
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                openCreateForm({
                                  productId: row.product_id,
                                  productName: row.product_name,
                                  docType: "receipt",
                                })
                              }
                              className="h-7 px-2 text-[11px] gap-1"
                              title="Tạo phiếu nhập hàng cho sản phẩm này"
                            >
                              <PackagePlus className="size-3" />
                              <span>Nhập</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                openCreateForm({
                                  productId: row.product_id,
                                  productName: row.product_name,
                                  docType: "issue",
                                })
                              }
                              className="h-7 px-2 text-[11px] gap-1"
                              title="Tạo phiếu xuất kho cho sản phẩm này"
                            >
                              <PackageMinus className="size-3" />
                              <span>Xuất</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with Pagination */}
          <TablePagination
            currentPage={stockPage}
            totalPages={totalStockPages}
            totalItems={filteredStock.length}
            pageSize={stockPageSize}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageChange={setStockPage}
            onPageSizeChange={(newSize) => {
              setStockPageSize(newSize);
              setStockPage(1);
            }}
            itemName="biến thể SKU"
          />
        </section>
      )}

      {/* ── VIEW 2: DANH SÁCH PHIẾU KHO & LỊCH SỬ NHẬP XUẤT ─────────────────── */}
      {view === "docs" && (
        <section className="mt-6 overflow-hidden rounded-md border border-border bg-card">
          {/* Sub Filters & Search */}
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between bg-card/40">
            <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
              {[
                { key: "all", label: "Tất cả phiếu" },
                { key: "receipt", label: "Phiếu nhập kho" },
                { key: "issue", label: "Phiếu xuất kho" },
                { key: "adjustment", label: "Điều chỉnh" },
                { key: "draft", label: "Chờ xử lý / Nháp" },
                { key: "posted", label: "Đã ghi sổ" },
              ].map((f) => (
                <Button
                  key={f.key}
                  variant={docTab === f.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDocTab(f.key as DocFilter)}
                  className={cn(
                    "h-8 text-xs font-medium",
                    docTab === f.key && "bg-foreground text-background hover:bg-foreground/90",
                  )}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm mã phiếu, lý do…"
                  className="h-8 pl-8 text-xs bg-[#f7f4ef]"
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => void reload()}
                className="size-8"
                title="Làm mới"
              >
                <RefreshCcw className={cn("size-3.5", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-secondary/55">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Mã phiếu
                  </th>
                  <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Loại phiếu
                  </th>
                  <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Lý do / Mục đích
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Quy mô hàng hóa
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Thời gian
                  </th>
                  <th className="w-24 px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && docs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-5 animate-spin text-primary" />
                        <span>Đang tải danh sách phiếu kho…</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                      Chưa có phiếu kho nào trong danh mục này.
                    </td>
                  </tr>
                ) : (
                  pagedDocs.map((doc) => {
                    const isReceipt = doc.type === "receipt";
                    const isIssue = doc.type === "issue";
                    const isPosted = doc.status === "posted";

                    return (
                      <tr
                        key={doc.id}
                        onClick={() => openDocDetail(doc.id)}
                        className="border-t border-border hover:bg-secondary/35 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">
                          #{doc.code}
                        </td>

                        {/* Type badge */}
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                              isReceipt
                                ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                                : isIssue
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : "border-border bg-secondary text-muted-foreground",
                            )}
                          >
                            {isReceipt ? (
                              <ArrowDownToLine className="size-3 text-emerald-600" />
                            ) : isIssue ? (
                              <ArrowUpFromLine className="size-3 text-primary" />
                            ) : (
                              <SlidersHorizontal className="size-3" />
                            )}
                            {TYPE_LABEL[doc.type as DocType] ?? doc.type}
                          </span>
                        </td>

                        {/* Reason */}
                        <td className="px-4 py-3 text-xs text-foreground font-medium max-w-[280px] truncate">
                          {doc.reason || "—"}
                        </td>

                        {/* Items Qty */}
                        <td className="px-4 py-3 text-center text-xs font-mono">
                          <span className="font-semibold text-foreground">
                            {Number(doc.total_qty) > 0 ? `${Number(doc.total_qty).toLocaleString("vi-VN")} cái` : "—"}
                          </span>
                          <span className="block text-[10px] text-muted-foreground font-sans">
                            {Number(doc.line_count) > 0 ? `${Number(doc.line_count).toLocaleString("vi-VN")} dòng sản phẩm` : "0 dòng sản phẩm"}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              isPosted
                                ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                                : doc.status === "void"
                                  ? "border-border bg-secondary text-muted-foreground"
                                  : "border-primary/40 bg-primary/5 text-primary",
                            )}
                          >
                            {STATUS_LABEL[doc.status] ?? doc.status}
                          </span>
                        </td>

                        {/* Time */}
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {fmtDate(doc.created_at)}
                          {doc.posted_at && (
                            <span className="block text-[10px] text-muted-foreground/80">
                              Đã ghi sổ lúc {fmtDate(doc.posted_at)}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDocDetail(doc.id);
                            }}
                            className="h-7 px-2.5 text-xs font-medium gap-1"
                          >
                            <Eye className="size-3.5" />
                            <span>Xem</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with Pagination */}
          <TablePagination
            currentPage={docPage}
            totalPages={totalDocPages}
            totalItems={filteredDocs.length}
            pageSize={docPageSize}
            pageSizeOptions={[10, 15, 25, 50]}
            onPageChange={setDocPage}
            onPageSizeChange={(newSize) => {
              setDocPageSize(newSize);
              setDocPage(1);
            }}
            itemName="phiếu kho"
          />
        </section>
      )}

      {/* ── VIEW 3: XEM CHI TIẾT PHIẾU KHO (DOC DETAIL) ────────────────────── */}
      {view === "doc_detail" && (
        <div className="space-y-6">
          {loadingDoc || !docDetail ? (
            <div className="mt-8 flex min-h-[360px] items-center justify-center rounded-md border border-border bg-card p-12">
              <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p>Đang tải chi tiết phiếu kho…</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setView("docs")}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <ArrowLeft className="size-3.5" />
                    Quay lại danh sách
                  </Button>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="section-label">PHIẾU KHO</span>
                    <span className="font-mono text-base font-bold text-foreground">
                      #{docDetail.code}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                        docDetail.type === "receipt"
                          ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                          : docDetail.type === "issue"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-secondary text-muted-foreground",
                      )}
                    >
                      {TYPE_LABEL[docDetail.type as DocType] ?? docDetail.type}
                    </span>
                    <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {STATUS_LABEL[docDetail.status] ?? docDetail.status}
                    </span>
                    <span className="hidden sm:inline text-xs text-muted-foreground">
                      · Ngày lập {fmtDate(docDetail.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Print Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPrintDocModalOpen(true)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Printer className="size-3.5 text-muted-foreground" />
                    <span>In phiếu kho</span>
                  </Button>

                  {/* Post Document Button (Ghi sổ) */}
                  {docDetail.status !== "posted" && (
                    <Button
                      size="sm"
                      disabled={postingDoc}
                      onClick={() => handlePostDoc(docDetail.id)}
                      className="h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium"
                    >
                      {postingDoc ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                      )}
                      <span>Ghi sổ phiếu ngay</span>
                    </Button>
                  )}

                  {/* Delete Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteDoc(docDetail.id)}
                    className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                    title="Xóa hoặc đảo ngược phiếu kho"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Xóa phiếu</span>
                  </Button>
                </div>
              </div>

              {/* 2 Columns: Lines & Summary */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Left (8 cols): Line items */}
                <div className="space-y-6 lg:col-span-8">
                  <div className="overflow-hidden rounded-md border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3.5">
                      <div>
                        <p className="section-label">Hàng hóa trong phiếu</p>
                        <h3 className="mt-0.5 font-serif text-base">
                          {docDetail.lines.length} dòng sản phẩm
                        </h3>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        Tổng số lượng: {docDetail.lines.reduce((s, l) => s + l.qty, 0)} cái
                      </span>
                    </div>

                    <div className="divide-y divide-border">
                      {docDetail.lines.map((line, idx) => {
                        const imgUrl = resolveImageUrl(line.image_url);
                        return (
                          <div
                            key={idx}
                            className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-secondary/20 transition-colors"
                          >
                            <div className="flex items-start gap-4">
                              <div className="relative size-14 shrink-0 overflow-hidden rounded border border-border bg-[#f7f4ef]">
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
                                  <div className="flex size-full items-center justify-center text-muted-foreground">
                                    <Package className="size-5 stroke-[1.5]" />
                                  </div>
                                )}
                              </div>

                              <div className="space-y-1">
                                <p className="font-serif text-sm font-medium text-foreground">
                                  {line.product_name}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded bg-secondary px-2 py-0.5 font-mono text-xs text-foreground">
                                    SKU: {line.sku}
                                  </span>
                                  <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                                    {line.color_name} · Size {line.size_label}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-border/50 pt-2 sm:border-0 sm:pt-0 sm:text-right">
                              <span className="text-xs text-muted-foreground sm:hidden">Chiều & Số lượng:</span>
                              <div>
                                <p className="font-mono text-base font-bold text-foreground">
                                  {line.direction === "in" ? "+" : "-"}
                                  {line.qty} cái
                                </p>
                                {line.unit_cost_vnd != null && line.unit_cost_vnd > 0 && (
                                  <div className="space-y-0.5 mt-1 sm:mt-0.5">
                                    <p className="text-[11px] text-muted-foreground font-serif">
                                      {docDetail.type === "issue" ? "Giá hóa đơn: " : "Giá vốn: "}
                                      {fmtVND(line.unit_cost_vnd)}
                                    </p>
                                    <p className="font-mono text-xs font-semibold text-foreground">
                                      {docDetail.type === "issue" ? "Thành tiền: " : "Tổng vốn: "}
                                      {fmtVND(line.unit_cost_vnd * line.qty)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-border bg-card/60 p-5">
                      <div className="ml-auto max-w-xs space-y-1.5 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Tổng số lượng:</span>
                          <span className="font-mono font-bold text-foreground">
                            {docDetail.lines.reduce((s, l) => s + l.qty, 0)} cái
                          </span>
                        </div>
                        {docDetail.lines.some((l) => (l.unit_cost_vnd ?? 0) > 0) && (
                          <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-foreground">
                            <span>
                              {docDetail.type === "issue"
                                ? "Tổng giá trị xuất (Hóa đơn):"
                                : "Tổng giá trị vốn nhập:"}
                            </span>
                            <span className="font-serif text-base text-primary">
                              {fmtVND(docDetail.lines.reduce((s, l) => s + (l.unit_cost_vnd ?? 0) * l.qty, 0))}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right (4 cols): Metadata */}
                <div className="space-y-6 lg:col-span-4">
                  <div className="rounded-md border border-border bg-card p-5 space-y-4">
                    <p className="section-label">Thông tin kiểm kê</p>
                    <div className="space-y-3 text-xs">
                      <div>
                        <p className="section-label">Lý do xuất / nhập</p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">
                          {docDetail.reason || "Vận hành kho thường kỳ"}
                        </p>
                      </div>

                      <div>
                        <p className="section-label">Kho hàng</p>
                        <p className="mt-0.5 font-medium text-foreground">Kho Tổng (MAIN)</p>
                      </div>

                      <div>
                        <p className="section-label">Trạng thái ghi sổ</p>
                        <p className="mt-0.5 font-medium text-foreground">
                          {docDetail.status === "posted" ? (
                            <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
                              ✓ Đã ghi sổ vào tồn kho
                            </span>
                          ) : (
                            <span className="text-primary font-semibold">
                              Chờ ghi sổ (Chưa trừ/cộng tồn kho)
                            </span>
                          )}
                        </p>
                      </div>

                      {docDetail.posted_at && (
                        <div>
                          <p className="section-label">Thời gian ghi sổ</p>
                          <p className="mt-0.5 font-mono text-muted-foreground">
                            {fmtDate(docDetail.posted_at)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── VIEW 4: LẬP PHIẾU KHO MỚI (COMPOSE FORM) ────────────────────────── */}
      {view === "form" && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("stock")}
                className="h-8 gap-1.5 text-xs"
              >
                <ArrowLeft className="size-3.5" />
                Hủy & Quay lại
              </Button>
              <div className="h-4 w-px bg-border" />
              <div>
                <p className="section-label text-primary">Tạo mới</p>
                <h3 className="font-serif text-base font-medium">Lập phiếu kho hàng</h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={saving || !lines.length}
                onClick={() => handleSaveDoc(false)}
                className="h-8 text-xs"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                Lưu phiếu nháp
              </Button>
              <Button
                size="sm"
                disabled={saving || !lines.length}
                onClick={() => handleSaveDoc(true)}
                className="h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Check className="size-3.5" />}
                <span>Ghi sổ ngay</span>
              </Button>
            </div>
          </div>

          {/* Form Content */}
          <div className="space-y-6">
            {/* Top Row: Information & Matrix Picker */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Card 1 (5 cols): Thông tin phiếu kho */}
              <div className="rounded-md border border-border bg-card p-5 space-y-4 lg:col-span-5">
                <div>
                  <p className="section-label">Thông tin chung</p>
                  <h4 className="font-serif text-sm font-medium mt-0.5">Cấu hình phiếu kho</h4>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-medium text-foreground">Loại phiếu kho</label>
                    <select
                      className="mt-1 flex h-9 w-full rounded-md border border-border bg-[#f7f4ef] px-3 text-xs outline-none focus:border-primary/50 transition-colors"
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as DocType)}
                    >
                      <option value="receipt">Phiếu nhập kho (+ Inbound)</option>
                      <option value="issue">Phiếu xuất kho (- Outbound)</option>
                      <option value="adjustment">Phiếu điều chỉnh tồn kho (±)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground">Lý do lập phiếu</label>
                    <Input
                      className="mt-1 h-9 text-xs bg-[#f7f4ef]"
                      placeholder="Ví dụ: Nhập hàng may từ xưởng, Xuất đơn hàng #ELN..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  {linkedOrderId && (
                    <div className="rounded-md border border-border/70 bg-secondary/40 px-3 py-2 text-xs flex items-center justify-between">
                      <span className="text-muted-foreground">Đơn hàng liên kết:</span>
                      <span className="font-mono font-medium text-primary">#{linkedOrderId.slice(0, 8)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2 (7 cols): Thêm hàng nhanh từ lưới ma trận */}
              <div className="rounded-md border border-border bg-card p-5 space-y-4 lg:col-span-7">
                <div>
                  <p className="section-label">Chọn thêm sản phẩm</p>
                  <h4 className="font-serif text-sm font-medium mt-0.5">Lưới ma trận Màu × Size</h4>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-[11px] text-muted-foreground">Tìm sản phẩm</span>
                    <Input
                      className="mt-1 h-8 text-xs bg-[#f7f4ef]"
                      placeholder="Gõ tên hoặc SKU…"
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground">
                      Chọn từ danh mục ({filteredCatalog.length})
                    </span>
                    <select
                      className="mt-1 flex h-8 w-full rounded-md border border-border bg-[#f7f4ef] px-2 text-xs outline-none"
                      value={matrixProductId}
                      onChange={(e) => {
                        setMatrixProductId(e.target.value);
                        setMatrixQty({});
                      }}
                    >
                      <option value="">Chọn sản phẩm…</option>
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
                    return (
                      <div className="overflow-x-auto rounded border border-border">
                        <table className="w-full min-w-[340px] text-xs">
                          <thead className="bg-secondary/55">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                Màu \ Size
                              </th>
                              {sizes.map((sz) => (
                                <th
                                  key={sz}
                                  className="px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                                >
                                  {sz}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {colors.map((color) => (
                              <tr key={color} className="border-t border-border">
                                <td className="px-3 py-2 font-medium">{color}</td>
                                {sizes.map((sz) => {
                                  const v = byKey.get(`${color}||${sz}`);
                                  if (!v) {
                                    return (
                                      <td key={sz} className="px-1 py-1 text-center text-muted-foreground">
                                        —
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={sz} className="px-1 py-1 text-center">
                                      <Input
                                        className="h-8 w-16 text-center tabular-nums text-xs bg-[#f7f4ef] mx-auto"
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
                                        <span className="block text-[9px] text-muted-foreground mt-0.5 whitespace-nowrap">
                                          kho: <b className="text-foreground">{v.on_hand ?? v.available}</b>
                                          {(v.reserved ?? 0) > 0 ? (
                                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                                              {" "}({v.reserved} chờ xuất)
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
                    );
                  })()
                ) : (
                  <p className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded">
                    Chọn một sản phẩm phía trên để nhập số lượng theo từng Màu × Size.
                  </p>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!matrixProduct}
                    onClick={addMatrixToLines}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    <span>Thêm vào danh sách phiếu</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Bottom Row: Full-width Line Items Table */}
            <div className="rounded-md border border-border bg-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between border-b border-border bg-secondary/35 px-5 py-3.5 gap-3">
                <div>
                  <p className="section-label">Hàng hóa trong phiếu</p>
                  <h3 className="font-serif text-base font-medium mt-0.5">
                    Danh sách sản phẩm xuất / nhập ({lines.length})
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    Tổng số lượng:{" "}
                    <strong className="text-foreground font-semibold">
                      {lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)} cái
                    </strong>
                  </span>
                  {lines.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLines([])}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3 mr-1" />
                      Xóa hết
                    </Button>
                  )}
                </div>
              </div>

              {lines.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                  <Package className="size-8 mx-auto text-muted-foreground/50 stroke-[1.5]" />
                  <p className="font-medium text-foreground">Chưa có sản phẩm nào trong phiếu kho</p>
                  <p className="text-[11px] max-w-sm mx-auto">
                    Chọn sản phẩm và nhập số lượng ở lưới ma trận bên trên, hoặc chuyển tự động từ đơn hàng cần xuất kho.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/25 border-b border-border">
                      <tr className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        <th className="py-3 pl-4 w-12 text-center font-medium">STT</th>
                        <th className="py-3 px-3 font-medium">Sản phẩm</th>
                        <th className="py-3 px-3 font-medium">Phân loại / SKU</th>
                        <th className="py-3 px-3 text-right font-medium min-w-[160px]">
                          {formType === "receipt"
                            ? "Giá vốn nhập (₫)"
                            : formType === "issue"
                              ? "Đơn giá hóa đơn"
                              : "Đơn giá (₫)"}
                        </th>
                        <th className="py-3 px-3 text-center font-medium min-w-[130px]">Số lượng</th>
                        <th className="py-3 px-4 text-right font-medium min-w-[140px]">Thành tiền</th>
                        <th className="py-3 pr-4 w-12 text-center font-medium">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lines.map((line, idx) => {
                        const p = catalog.find((x) => x.id === line.product_id);
                        const v = p?.variants.find((x) => x.id === line.variant_id);
                        const displayName = p?.name ?? line.product_name ?? "Sản phẩm";
                        const variantLabel = v
                          ? `${v.color} · ${v.size}`
                          : [line.color_label, line.size_label ? `Size ${line.size_label}` : null]
                              .filter(Boolean)
                              .join(" · ") || "—";
                        const displaySku = v?.sku ?? line.sku ?? "—";
                        const img = line.image_url || v?.image_url || p?.image_url || null;
                        const imgUrl = resolveImageUrl(img);
                        const lineQty = Number(line.qty) || 0;
                        const lineCost = line.unit_cost_vnd || 0;
                        const lineTotal = lineQty * lineCost;

                        return (
                          <tr key={`${line.variant_id}-${idx}`} className="hover:bg-secondary/20 transition-colors">
                            {/* STT */}
                            <td className="py-3 pl-4 text-center font-mono text-muted-foreground">
                              {idx + 1}
                            </td>

                            {/* Sản phẩm & Thumbnail */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-3">
                                <div className="relative size-12 shrink-0 overflow-hidden rounded border border-border bg-[#f7f4ef]">
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
                                    <div className="flex size-full items-center justify-center text-muted-foreground">
                                      <Package className="size-4 stroke-[1.5]" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 max-w-[280px]">
                                  <p
                                    className="font-medium text-foreground text-xs leading-snug line-clamp-2"
                                    title={displayName}
                                  >
                                    {displayName}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Phân loại & SKU */}
                            <td className="py-3 px-3">
                              <div className="space-y-1">
                                <span className="inline-block rounded bg-secondary px-2 py-0.5 text-xs text-foreground font-medium">
                                  {variantLabel}
                                </span>
                                <p className="font-mono text-[11px] text-muted-foreground">
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
                                    className="h-8 w-32 pr-6 text-right font-mono text-xs bg-[#f7f4ef] border-border focus:bg-background transition-colors"
                                  />
                                  <span className="pointer-events-none absolute right-2 text-xs text-muted-foreground">
                                    ₫
                                  </span>
                                </div>
                              ) : formType === "issue" ? (
                                <div className="inline-block text-right">
                                  <span className="font-serif text-xs font-semibold text-foreground block">
                                    {fmtVND(lineCost)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block">
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
                                    className="h-8 w-28 pr-6 text-right font-mono text-xs bg-[#f7f4ef]"
                                  />
                                  <span className="pointer-events-none absolute right-2 text-xs text-muted-foreground">
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
                                  className="size-7 rounded border border-border bg-[#f7f4ef] hover:bg-secondary text-foreground flex items-center justify-center text-xs font-bold transition-colors"
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
                                  className="h-7 w-14 text-center tabular-nums font-mono text-xs bg-[#f7f4ef]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cur = (Number(line.qty) || 0) + 1;
                                    setLines((ls) =>
                                      ls.map((l, i) => (i === idx ? { ...l, qty: String(cur) } : l)),
                                    );
                                  }}
                                  className="size-7 rounded border border-border bg-[#f7f4ef] hover:bg-secondary text-foreground flex items-center justify-center text-xs font-bold transition-colors"
                                  title="Tăng 1"
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            {/* Thành tiền */}
                            <td className="py-3 px-4 text-right">
                              <span className="font-serif text-sm font-semibold text-foreground">
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
                                className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Xóa dòng này"
                              >
                                <Trash2 className="size-3.5" />
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
                <div className="border-t border-border bg-secondary/15 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-muted-foreground">
                      Hiển thị <strong>{lines.length}</strong> dòng sản phẩm được chọn
                    </div>

                    <div className="space-y-2 sm:w-80 ml-auto">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Tổng số mặt hàng:</span>
                        <span className="font-mono font-medium text-foreground">{lines.length} dòng</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Tổng số lượng:</span>
                        <span className="font-mono font-bold text-foreground">
                          {lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)} cái
                        </span>
                      </div>
                      {lines.some((l) => (l.unit_cost_vnd || 0) > 0) && (
                        <div className="flex justify-between items-baseline border-t border-border pt-2">
                          <span className="text-xs font-semibold text-foreground">
                            {formType === "issue"
                              ? "Tổng giá trị xuất (Hóa đơn):"
                              : "Tổng giá trị vốn nhập:"}
                          </span>
                          <span className="font-serif text-lg font-bold text-primary">
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
