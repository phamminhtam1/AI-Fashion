import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, Check, ChevronLeft, ChevronRight, CircleDollarSign, FolderOpen, GripVertical,
  Info, LayoutGrid, List, Loader2, Package, Search, Shirt, Sparkles, Star, Tag, Trash2, X,
} from "lucide-react";
import { adminApi, type AdminProduct } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TINTS, type Collection, type Product } from "../mock";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                 */
/* ------------------------------------------------------------------ */

export type TagOptions = { tagProducts: boolean; showPrice: boolean; featured: boolean };
export const DEFAULT_TAG_OPTIONS: TagOptions = { tagProducts: true, showPrice: true, featured: false };

type Props = {
  open: boolean;
  onClose: () => void;
  products: Product[];
  lookbooks: Collection[];
  selectedIds: string[];
  selectedLookbook: Collection | null;
  /** true → chỉ cho chọn 1 sản phẩm (dùng cho chế độ "Người tự tạo nội dung") */
  singleSelect?: boolean;
  tagOptions?: TagOptions;
  onApply: (ids: string[], pickedProducts: Product[], lookbook: Collection | null, tagOptions: TagOptions) => void;
};

type Tab = "products" | "lookbooks";
type PickState = "all" | "selected" | "unselected";
type StockFilter = "all" | "in" | "out";

const PAGE_LIMIT = 24;
const BRAND = "#6941c6";
const fmt = (n: number) => `${n.toLocaleString("vi-VN")}đ`;

const PRICE_RANGES: { id: string; label: string; min?: number; max?: number }[] = [
  { id: "all", label: "Mức giá" },
  { id: "lt400", label: "Dưới 400.000đ", max: 400_000 },
  { id: "400-600", label: "400.000đ – 600.000đ", min: 400_000, max: 600_000 },
  { id: "600-800", label: "600.000đ – 800.000đ", min: 600_000, max: 800_000 },
  { id: "gt800", label: "Trên 800.000đ", min: 800_000 },
];

/**
 * Rút gọn SKU biến thể về Mã sản phẩm gốc (Style Code / Model SKU).
 * Ví dụ: FDC34045-TIM-S -> FDC34045, BJD33061-KEM-XL -> BJD33061.
 * Các màu khác nhau, size khác nhau đều chung quy về 1 sản phẩm.
 */
function extractBaseSku(rawSku: string | undefined, slug?: string): string {
  if (!rawSku) return slug ? slug.toUpperCase().slice(0, 10) : "";
  const parts = rawSku.split("-");
  if (parts.length >= 2 && !rawSku.startsWith("EL-")) {
    return parts[0] ?? rawSku;
  }
  return rawSku;
}

function mapApiProduct(p: AdminProduct, index = 0): Product {
  const gallery = Array.from(new Set([
    ...(p.images || []),
    ...(p.media || []).map((item) => item.url),
  ].filter((url): url is string => Boolean(url))));
  const img = p.media?.find((m) => m.is_cover)?.url || gallery[0];
  const rawSku = p.variants?.[0]?.sku || p.slug || `EL-${p.id.slice(0, 6)}`;
  const baseSku = extractBaseSku(rawSku, p.slug);

  const colorCount =
    p.colorways?.length ||
    p.colors?.length ||
    new Set(p.variants?.map((v) => v.colorway_id || v.color_name || v.color?.name).filter(Boolean)).size ||
    1;
  const sizeCount =
    p.sizes?.length ||
    new Set(p.variants?.map((v) => v.size_id || v.size_label || v.size?.code).filter(Boolean)).size ||
    1;

  return {
    id: p.id,
    name: p.name,
    sku: baseSku,
    price: p.price_vnd,
    tint: TINTS[index % TINTS.length] ?? "#e0e7ff",
    inStock: p.variants && p.variants.length > 0 ? p.variants.some((v) => (v.cost_vnd ?? 1) >= 0) : true,
    imageUrl: img ?? null,
    imageUrls: gallery,
    category: p.category?.name ?? null,
    description: p.material ? `${p.description || ""} (Chất liệu: ${p.material})` : (p.description ?? null),
    slug: p.slug,
    colorsCount: colorCount,
    sizesCount: sizeCount,
    variantsCount: p.variants?.length || 1,
  };
}

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

function Thumb({ p, className }: { p: { imageUrl?: string | null; name: string }; className?: string }) {
  return p.imageUrl ? (
    <img src={p.imageUrl} alt={p.name} loading="lazy" draggable={false} className={cn("object-cover object-top", className)} />
  ) : (
    <div className={cn("grid place-items-center bg-slate-100 text-slate-400", className)}><Shirt className="size-6" /></div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300", checked ? "bg-[#6941c6]" : "bg-slate-200")}>
      <span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

function FilterSelect({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: ReactNode; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className="h-11 min-w-[7.5rem] cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors hover:border-violet-200 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]">
      {children}
    </select>
  );
}

function StockBadge({ inStock }: { inStock: boolean }) {
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", inStock ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
      {inStock ? "Còn hàng" : "Hết hàng"}
    </span>
  );
}

function Checkbox({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors", on ? "border-[#6941c6] bg-[#6941c6] text-white" : "border-slate-300 bg-white/90")}>
      {on && <Check className="size-4" strokeWidth={3} />}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

export function ProductBstPickerModal({
  open, onClose, products, lookbooks, selectedIds, selectedLookbook, singleSelect = false, tagOptions = DEFAULT_TAG_OPTIONS, onApply,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("products");
  const [ids, setIds] = useState<string[]>([]);
  const [lb, setLb] = useState<Collection | null>(null);
  const [opts, setOpts] = useState<TagOptions>(tagOptions);

  // Filters
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [cat, setCat] = useState("all");
  const [pick, setPick] = useState<PickState>("all");
  const [price, setPrice] = useState("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dragId, setDragId] = useState<string | null>(null);

  // Real API state
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [apiTotal, setApiTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  // Cache of all loaded or passed products to guarantee chosen items never vanish
  const [productCache, setProductCache] = useState<Map<string, Product>>(() => new Map());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync initial passed products into productCache
  useEffect(() => {
    if (products.length > 0) {
      setProductCache((prev) => {
        const next = new Map(prev);
        products.forEach((p) => next.set(p.id, p));
        return next;
      });
    }
  }, [products]);

  // Debounce search keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  // Reset page when category, price, or stock changes
  const handleCatChange = (v: string) => { setCat(v); setPage(1); };
  const handlePriceChange = (v: string) => { setPrice(v); setPage(1); };
  const handleStockChange = (v: StockFilter) => { setStock(v); setPage(1); };

  // Fetch real categories from API once
  useEffect(() => {
    if (!open) return;
    let alive = true;
    adminApi
      .categoryOptions()
      .then((res) => {
        if (alive && res.items && res.items.length > 0) {
          setCategories(res.items.map((c) => ({ id: c.id, name: c.name, slug: c.slug })));
        }
      })
      .catch(() => { });
    return () => { alive = false; };
  }, [open]);

  // Mỗi lần mở popup: đồng bộ lại từ giá trị đang áp dụng & reset bộ lọc
  useEffect(() => {
    if (!open) return;
    setIds(selectedIds);
    setLb(selectedLookbook);
    setOpts(tagOptions);
    setTab("products");
    setQ("");
    setDebouncedQ("");
    setCat("all");
    setPick("all");
    setPrice("all");
    setStock("all");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc để đóng + khóa cuộn nền
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  // ----------------------------------------------------------------
  // LIVE API QUERY: Gọi API thật khi tìm kiếm, lọc danh mục, giá, tồn kho, trang
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!open || tab !== "products") return;
    let alive = true;
    setLoading(true);

    const priceDef = PRICE_RANGES.find((r) => r.id === price);
    const params: Parameters<typeof adminApi.products>[0] = {
      status: "published",
      page,
      limit: PAGE_LIMIT,
    };
    const trimmedQ = debouncedQ.trim();
    if (trimmedQ) params.q = trimmedQ;
    if (cat !== "all") params.category_id = cat;
    if (priceDef?.min !== undefined) params.price_min = priceDef.min;
    if (priceDef?.max !== undefined) params.price_max = priceDef.max;
    if (stock === "in" || stock === "out") params.stock = stock;

    adminApi
      .products(params)
      .then((res) => {
        if (!alive) return;
        const seenNames = new Set<string>();
        const mapped: Product[] = [];

        (res.items || []).forEach((item, idx) => {
          const norm = item.name?.trim().toLowerCase();
          // Gom nhóm: các biến thể màu/size khác nhau đều chung quy về 1 sản phẩm
          if (norm && seenNames.has(norm)) return;
          if (norm) seenNames.add(norm);
          mapped.push(mapApiProduct(item, (page - 1) * PAGE_LIMIT + idx));
        });

        setApiProducts(mapped);
        setApiTotal(res.total || 0);

        // Lưu vào productCache để không bao giờ bị mất dữ liệu khi sang trang hoặc đổi query
        setProductCache((prev) => {
          const next = new Map(prev);
          mapped.forEach((p) => next.set(p.id, p));
          return next;
        });
      })
      .catch((err) => {
        console.error("Lỗi khi tải sản phẩm từ API:", err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [open, tab, debouncedQ, cat, price, stock, page]);

  // Chosen products derived from productCache
  const chosen = useMemo(() => {
    return ids.map((id) => productCache.get(id)).filter((p): p is Product => Boolean(p));
  }, [ids, productCache]);

  // List of products displayed to the user
  const displayProducts = useMemo(() => {
    if (pick === "selected") {
      return chosen;
    }
    if (pick === "unselected") {
      return apiProducts.filter((p) => !ids.includes(p.id));
    }
    return apiProducts;
  }, [apiProducts, pick, chosen, ids]);

  // Lookbooks list filtered by keyword
  const filteredLookbooks = useMemo(() => {
    const kw = debouncedQ.trim().toLowerCase();
    return lookbooks.filter((l) => !kw || `${l.title} ${l.season ?? ""}`.toLowerCase().includes(kw));
  }, [lookbooks, debouncedQ]);

  const totalPages = Math.max(1, Math.ceil(apiTotal / PAGE_LIMIT));

  const toggle = (id: string) =>
    setIds((cur) => (singleSelect ? (cur.includes(id) ? [] : [id]) : cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const remove = (id: string) => setIds((cur) => cur.filter((x) => x !== id));
  const add = (id: string) => setIds((cur) => (singleSelect ? [id] : cur.includes(id) ? cur : [...cur, id]));

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setIds((cur) => {
      const next = cur.filter((x) => x !== dragId);
      next.splice(next.indexOf(targetId) + (cur.indexOf(dragId) < cur.indexOf(targetId) ? 1 : 0), 0, dragId);
      return next;
    });
  };

  const lbProductIds = (lb?.attachedProductIds ?? []).filter((id) => productCache.has(id));
  const lbMissing = lbProductIds.filter((id) => !ids.includes(id));

  const confirm = () => {
    onApply(ids, chosen, lb, opts);
    onClose();
  };

  if (!open || !mounted || typeof document === "undefined") return null;

  const total = singleSelect ? Math.min(ids.length, 1) : ids.length;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-[2px] sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="pick-title"
        className="social-product-picker grid h-full max-h-[900px] w-full max-w-[1340px] grid-rows-[minmax(0,1fr)] gap-4 overflow-y-auto rounded-xs bg-slate-100 p-4 font-sans text-sm text-slate-900 shadow-2xl lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">

        {/* ============ TRÁI: chọn sản phẩm / BST ============ */}
        <section className="flex min-h-[560px] min-w-0 flex-col rounded-xs bg-white p-5 lg:min-h-0">
          <header className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 id="pick-title" className="text-xl font-semibold tracking-tight">Chọn sản phẩm / BST</h2>

              </div>
              <p className="mt-1 text-sm text-slate-500">
                Tìm kiếm trực tiếp từ kho {apiTotal > 0 ? `${apiTotal.toLocaleString("vi-VN")} sản phẩm` : "sản phẩm"} và bộ sưu tập để tạo nội dung.
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Đóng" className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"><X className="size-5" /></button>
          </header>

          {/* Tabs */}
          <div className="mt-4 flex items-center justify-between border-b border-slate-200">
            <div role="tablist" className="flex gap-2">
              {([
                ["products", Package, "Sản phẩm"],
                ["lookbooks", FolderOpen, "Bộ sưu tập"],
              ] as const).map(([id, Icon, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={cn("-mb-px flex items-center gap-2 rounded-t-lg border-b-2 px-5 py-3 text-sm font-medium transition-colors",
                    tab === id ? "border-[#6941c6] bg-violet-50 text-[#6941c6]" : "border-transparent text-slate-500 hover:text-slate-800")}>
                  <Icon className="size-4" />{label}
                </button>
              ))}
            </div>
            {tab === "products" && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {loading ? (
                  <span className="flex items-center gap-1 text-[#6941c6]">
                    <Loader2 className="size-3.5 animate-spin" /> Đang tải từ API...
                  </span>
                ) : (
                  <span><strong>{apiTotal.toLocaleString("vi-VN")}</strong> sản phẩm</span>
                )}
              </div>
            )}
          </div>

          {/* Bộ lọc */}
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tab === "products" ? "Tìm theo tên sản phẩm, mã SKU (gọi API real)..." : "Tìm theo tên bộ sưu tập..."}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm outline-none placeholder:text-slate-400 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
              />
              {loading && tab === "products" && (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[#6941c6]" />
              )}
            </label>
            {tab === "products" && (
              <>
                <FilterSelect label="Danh mục" value={cat} onChange={handleCatChange}>
                  <option value="all">Tất cả danh mục</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </FilterSelect>
                <FilterSelect label="Trạng thái chọn" value={pick} onChange={(v) => setPick(v as PickState)}>
                  <option value="all">Trạng thái</option>
                  <option value="selected">Đã chọn ({ids.length})</option>
                  <option value="unselected">Chưa chọn</option>
                </FilterSelect>
                <FilterSelect label="Mức giá" value={price} onChange={handlePriceChange}>
                  {PRICE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </FilterSelect>
                <FilterSelect label="Tồn kho" value={stock} onChange={(v) => handleStockChange(v as StockFilter)}>
                  <option value="all">Tồn kho</option>
                  <option value="in">Còn hàng</option>
                  <option value="out">Hết hàng</option>
                </FilterSelect>
              </>
            )}
          </div>

          {tab === "products" && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">Đã chọn: {total}</span>
                <Button type="button" variant="outline" size="sm" disabled={!ids.length} onClick={() => setIds([])}>Bỏ chọn tất cả</Button>
              </div>
              <div className="flex rounded-lg border border-slate-200 p-0.5">
                {([["grid", LayoutGrid, "Dạng lưới"], ["list", List, "Dạng danh sách"]] as const).map(([id, Icon, label]) => (
                  <button key={id} type="button" aria-label={label} aria-pressed={view === id} onClick={() => setView(id)}
                    className={cn("grid size-8 place-items-center rounded-md transition-colors", view === id ? "bg-violet-100 text-[#6941c6]" : "text-slate-400 hover:text-slate-700")}>
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Danh sách */}
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            {tab === "products" ? (
              loading && displayProducts.length === 0 ? (
                <div className="grid h-56 place-items-center rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-8 animate-spin text-[#6941c6]" />
                    <span>Đang truy vấn danh mục sản phẩm từ máy chủ...</span>
                  </div>
                </div>
              ) : displayProducts.length === 0 ? (
                <div className="grid h-48 place-items-center rounded-xl border border-dashed border-slate-200 text-center text-sm text-slate-500">
                  <div>
                    <Search className="mx-auto mb-2 size-6 text-slate-300" />
                    Không tìm thấy sản phẩm nào phù hợp bộ lọc.<br />
                    Thử đổi từ khóa hoặc bỏ bớt bộ lọc.
                  </div>
                </div>
              ) : view === "grid" ? (
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                  {displayProducts.map((p) => {
                    const on = ids.includes(p.id);
                    return (
                      <button key={p.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(p.id)}
                        className={cn("group rounded-xl border bg-white p-2 text-left transition-all", on ? "border-[#6941c6] ring-1 ring-[#6941c6]" : "border-slate-200 hover:border-violet-300 hover:shadow-sm")}>
                        <div className="relative overflow-hidden rounded-lg bg-slate-100">
                          <Thumb p={p} className="aspect-[3/4] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
                          <span className="absolute right-2 top-2"><Checkbox on={on} /></span>
                          {p.category && <span className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-600">{p.category}</span>}
                          <span className="absolute bottom-2 right-2"><StockBadge inStock={p.inStock} /></span>
                        </div>
                        <div className="px-1 pb-1 pt-2.5">
                          <div className="line-clamp-1 text-sm font-medium">{p.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span>SKU: {p.sku}</span>
                            {p.colorsCount && p.colorsCount > 1 ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                {p.colorsCount} màu
                              </span>
                            ) : null}
                            {p.sizesCount && p.sizesCount > 1 ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                {p.sizesCount} size
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-sm font-semibold">{fmt(p.price)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <ul className="space-y-2">
                  {displayProducts.map((p) => {
                    const on = ids.includes(p.id);
                    return (
                      <li key={p.id}>
                        <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(p.id)}
                          className={cn("flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors", on ? "border-[#6941c6] bg-violet-50/50 ring-1 ring-[#6941c6]" : "border-slate-200 hover:border-violet-300")}>
                          <Checkbox on={on} />
                          <Thumb p={p} className="size-14 shrink-0 rounded-lg" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{p.name}</span>
                            <span className="flex items-center gap-1.5 text-xs text-slate-500">
                              <span>SKU: {p.sku}</span>
                              {p.category ? <span>· {p.category}</span> : null}
                              {p.colorsCount && p.colorsCount > 1 ? (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  {p.colorsCount} màu
                                </span>
                              ) : null}
                              {p.sizesCount && p.sizesCount > 1 ? (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  {p.sizesCount} size
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <StockBadge inStock={p.inStock} />
                          <span className="w-24 text-right text-sm font-semibold">{fmt(p.price)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : filteredLookbooks.length === 0 ? (
              <div className="grid h-48 place-items-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                {lookbooks.length === 0 ? "Chưa có bộ sưu tập nào." : "Không tìm thấy bộ sưu tập phù hợp."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {filteredLookbooks.map((l) => {
                  const on = lb?.id === l.id;
                  return (
                    <button key={l.id} type="button" role="radio" aria-checked={on} onClick={() => setLb(on ? null : l)}
                      className={cn("group rounded-xl border bg-white p-2 text-left transition-all", on ? "border-[#6941c6] ring-1 ring-[#6941c6]" : "border-slate-200 hover:border-violet-300 hover:shadow-sm")}>
                      <div className="relative overflow-hidden rounded-lg bg-slate-100">
                        <Thumb p={{ imageUrl: l.coverImageUrl ?? null, name: l.title }} className="h-40 w-full" />
                        <span className="absolute right-2 top-2"><Checkbox on={on} /></span>
                        {l.season && <span className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-600">{l.season}</span>}
                      </div>
                      <div className="px-1 pb-1 pt-2.5">
                        <div className="line-clamp-1 text-sm font-medium">{l.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{l.itemCount} sản phẩm</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phân trang API cho sản phẩm */}
          {tab === "products" && totalPages > 1 && pick !== "selected" && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>Trang <strong>{page}</strong> / <strong>{totalPages}</strong></span>
                <span className="text-slate-300">|</span>
                <span>Tổng {apiTotal.toLocaleString("vi-VN")} sản phẩm</span>
                {loading && <Loader2 className="size-3.5 animate-spin text-[#6941c6]" />}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 px-3 text-xs"
                >
                  <ChevronLeft className="size-3.5" />Trước
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 gap-1 px-3 text-xs"
                >
                  Sau<ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* ============ PHẢI: đã chọn + thiết lập thẻ ============ */}
        <aside className="flex min-h-0 min-w-0 flex-col gap-4">
          <section className="flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-xs bg-white p-5">
            <header className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Sản phẩm đã chọn ({total})</h3>
              <button type="button" disabled={!ids.length && !lb} onClick={() => { setIds([]); setLb(null); }}
                className="flex items-center gap-1.5 text-sm font-medium text-[#6941c6] hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline">
                <Trash2 className="size-4" />Xóa tất cả
              </button>
            </header>

            <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {lb && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-2.5">
                  <div className="flex items-center gap-3">
                    <Thumb p={{ imageUrl: lb.coverImageUrl ?? null, name: lb.title }} className="size-12 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{lb.title}</div>
                      <div className="text-xs text-slate-500">Bộ sưu tập{lb.season ? ` · ${lb.season}` : ""} · {lb.itemCount} sản phẩm</div>
                    </div>
                    <button type="button" aria-label="Bỏ bộ sưu tập" onClick={() => setLb(null)} className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-slate-700"><X className="size-4" /></button>
                  </div>
                  {!singleSelect && lbMissing.length > 0 && (
                    <button type="button" onClick={() => setIds((cur) => [...cur, ...lbMissing])}
                      className="mt-2 w-full rounded-lg border border-violet-200 bg-white py-1.5 text-xs font-medium text-[#6941c6] hover:bg-violet-50">
                      Thêm {lbMissing.length} sản phẩm của bộ sưu tập này
                    </button>
                  )}
                </div>
              )}

              {chosen.length === 0 && !lb ? (
                <div className="grid h-full min-h-[140px] place-items-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-sm text-slate-500">
                  <div><Package className="mx-auto mb-2 size-6 text-slate-300" />Chưa chọn sản phẩm nào.<br />Bấm vào thẻ sản phẩm bên trái để thêm.</div>
                </div>
              ) : (
                chosen.map((p, i) => (
                  <div key={p.id} draggable={!singleSelect}
                    onDragStart={() => setDragId(p.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { reorder(p.id); setDragId(null); }} onDragEnd={() => setDragId(null)}
                    className={cn("flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 transition-opacity", dragId === p.id && "opacity-40")}>
                    <Thumb p={p} className="h-[72px] w-[60px] shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="line-clamp-1 text-sm font-medium">{p.name}</span>
                        {opts.featured && i === 0 && <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Nổi bật</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>SKU: {p.sku}</span>
                        {p.colorsCount && p.colorsCount > 1 ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {p.colorsCount} màu
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold">{fmt(p.price)}</div>
                    </div>
                    {!singleSelect && <GripVertical className="size-5 shrink-0 cursor-grab text-slate-400 active:cursor-grabbing" aria-label="Kéo để sắp xếp" />}
                    <button type="button" aria-label={`Bỏ ${p.name}`} onClick={() => remove(p.id)} className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"><X className="size-4" /></button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xs bg-white p-5">
            <h3 className="flex items-center gap-2 text-base font-semibold">Thiết lập gắn thẻ sản phẩm <Info className="size-4 text-slate-400" /></h3>
            <p className="mt-1 text-sm text-slate-500">Cấu hình cách hiển thị sản phẩm trong nội dung được tạo.</p>
            <div className="mt-4 space-y-4">
              {([
                ["tagProducts", Tag, "Gắn thẻ sản phẩm trong bài viết", "Tự động gắn thẻ sản phẩm vào ảnh/video và nội dung."],
                ["showPrice", CircleDollarSign, "Hiển thị giá", "Hiển thị giá sản phẩm khi gắn thẻ."],
                ["featured", Star, "Ưu tiên sản phẩm nổi bật", "Đặt các sản phẩm đã chọn ở vị trí nổi bật trong nội dung."],
              ] as const).map(([key, Icon, title, desc]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-violet-50 text-[#6941c6]"><Icon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{title}</div>
                    <div className="text-xs text-slate-500">{desc}</div>
                  </div>
                  <Switch checked={opts[key]} onChange={(v) => setOpts((o) => ({ ...o, [key]: v }))} label={title} />
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-[1fr_1.4fr] gap-3">
              <Button type="button" variant="outline" className="h-9 rounded-xs" onClick={onClose}>Hủy</Button>
              <Button type="button" className="h-9 rounded-xs text-white hover:opacity-90" style={{ background: `linear-gradient(135deg, ${BRAND}, #8b5cf6)` }} disabled={!ids.length && !lb} onClick={confirm}>
                Xác nhận sản phẩm ({total})
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
