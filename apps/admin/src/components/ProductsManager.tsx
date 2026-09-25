import {
  Archive,
  Boxes,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { adminApi, API_URL, type AdminProduct, type ProductMeta } from "@/lib/api";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type StockFilter = "" | "in" | "out" | "none";
type StatusCounts = { all: number; published: number; draft: number; archived: number };

const STOCK_LABELS: Record<Exclude<StockFilter, "">, string> = {
  in: "Còn hàng",
  out: "Hết hàng",
  none: "Chưa nhập kho",
};

function productImageUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

type FormState = {
  name: string;
  slug: string;
  description: string;
  material: string;
  primary_category_id: string;
  occasion_id: string;
  size_chart_id: string;
  status: "draft" | "published" | "archived";
  price_vnd: string;
  compare_at_price_vnd: string;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  material: "",
  primary_category_id: "",
  occasion_id: "",
  size_chart_id: "",
  status: "draft",
  price_vnd: "",
  compare_at_price_vnd: "",
};

type DraftColorway = {
  key: string;
  files: { file: File; preview: string }[];
  size_ids: string[];
};

function colorwaySizesFromProduct(
  p: AdminProduct,
  metaSizes?: Array<{ id: string; code: string }>,
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const cw of p.colorways ?? []) map[cw.id] = [];
  for (const v of p.variants ?? []) {
    if (v.status === "inactive" || v.status === "archived") continue;
    if (!v.colorway_id) continue;
    const sizeId =
      v.size_id ?? metaSizes?.find((s) => s.code === v.size?.code)?.id;
    if (!sizeId) continue;
    const list = map[v.colorway_id] ?? (map[v.colorway_id] = []);
    if (!list.includes(sizeId)) list.push(sizeId);
  }
  return map;
}

function slugify(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function statusLabel(s: string) {
  if (s === "published") return "Đang bán";
  if (s === "draft") return "Bản nháp";
  if (s === "archived") return "Đã ẩn";
  return s;
}

export function ProductsManager({
  onNavigate,
}: {
  onNavigate?: (section: string, opts?: { productId?: string; productName?: string }) => void;
} = {}) {
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [meta, setMeta] = useState<ProductMeta | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "published" | "draft" | "archived">("all");
  const [categoryId, setCategoryId] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [stock, setStock] = useState<StockFilter>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    all: 0,
    published: 0,
    draft: 0,
    archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** Create-mode only: local colorway drafts with pending images + sizes */
  const [draftColorways, setDraftColorways] = useState<DraftColorway[]>([
    { key: "d0", files: [], size_ids: [] },
  ]);
  const [activeDraftKey, setActiveDraftKey] = useState("d0");
  const [activeColorwayId, setActiveColorwayId] = useState<string | null>(null);
  /** Edit-mode: size_ids per colorway id */
  const [colorwaySizes, setColorwaySizes] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [stockDetail, setStockDetail] = useState<AdminProduct | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

  const categoryOptions = useMemo(() => {
    const cats = meta?.categories ?? [];
    const leaves = cats.filter((c) => c.is_leaf);
    const currentId = form.primary_category_id;
    const current = cats.find((c) => c.id === currentId);
    if (current && !leaves.some((l) => l.id === current.id)) return [current, ...leaves];
    return leaves;
  }, [meta, form.primary_category_id]);

  /** Leaves grouped under parent name for readable picker */
  const categoryGroups = useMemo(() => {
    const cats = meta?.categories ?? [];
    const byId = Object.fromEntries(cats.map((c) => [c.id, c]));
    const groups = new Map<string, { title: string; items: typeof categoryOptions }>();
    for (const leaf of categoryOptions) {
      const parent = leaf.parent_id ? byId[leaf.parent_id] : null;
      const key = parent?.id ?? "__root__";
      const title = parent?.name ?? "Danh mục gốc";
      const g = groups.get(key) ?? { title, items: [] };
      g.items.push(leaf);
      groups.set(key, g);
    }
    return [...groups.values()];
  }, [meta, categoryOptions]);

  const selectedCategoryLabel = useMemo(() => {
    const c = categoryOptions.find((x) => x.id === form.primary_category_id);
    if (!c) return null;
    const parent = meta?.categories.find((p) => p.id === c.parent_id);
    return parent ? `${parent.name} · ${c.name}` : c.name;
  }, [categoryOptions, form.primary_category_id, meta]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        status?: string;
        q?: string;
        category_id?: string;
        price_min?: number;
        price_max?: number;
        stock?: "in" | "out" | "none";
        page?: number;
        limit?: number;
      } = { page, limit };
      if (query.trim()) params.q = query.trim();
      if (tab !== "all") params.status = tab;
      if (categoryId) params.category_id = categoryId;
      if (priceMin.trim()) params.price_min = Number(priceMin);
      if (priceMax.trim()) params.price_max = Number(priceMax);
      if (stock) params.stock = stock;

      const [prods, m] = await Promise.all([adminApi.products(params), adminApi.productMeta()]);
      setItems(prods.items);
      setTotal(prods.total);
      setStatusCounts(prods.status_counts);
      setMeta(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được sản phẩm");
    } finally {
      setLoading(false);
    }
  }, [page, limit, query, tab, categoryId, priceMin, priceMax, stock]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim()), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tab, query, categoryId, priceMin, priceMax, stock, limit]);

  const allFilteredSelected = items.length > 0 && items.every((p) => selected.has(p.id));
  const someFilteredSelected = items.some((p) => selected.has(p.id));
  const selectedCount = items.filter((p) => selected.has(p.id)).length;

  const metrics = useMemo(
    () => [
      {
        label: "Tổng sản phẩm",
        value: String(statusCounts.all),
        note: `${statusCounts.published} đang bán`,
      },
      {
        label: "Bản nháp",
        value: String(statusCounts.draft),
        note: "Chưa public",
      },
      {
        label: "Đã ẩn",
        value: String(statusCounts.archived),
        note: "Lưu trữ",
      },
    ],
    [statusCounts],
  );

  const filterCategories = useMemo(() => {
    const cats = meta?.categories ?? [];
    return [...cats].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [meta]);

  const stockLabels: Record<Exclude<StockFilter, "">, string> = {
    in: "Còn hàng",
    out: "Hết hàng",
    none: "Chưa nhập kho",
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (categoryId) {
      const name = filterCategories.find((c) => c.id === categoryId)?.name ?? "Danh mục";
      chips.push({
        key: "category",
        label: `Danh mục: ${name}`,
        clear: () => setCategoryId(""),
      });
    }
    if (priceMin || priceMax) {
      const from = priceMin ? Number(priceMin).toLocaleString("vi-VN") : "…";
      const to = priceMax ? Number(priceMax).toLocaleString("vi-VN") : "…";
      chips.push({
        key: "price",
        label: `Giá: ${from}–${to}`,
        clear: () => {
          setPriceMin("");
          setPriceMax("");
        },
      });
    }
    if (stock) {
      chips.push({
        key: "stock",
        label: `Tồn: ${STOCK_LABELS[stock]}`,
        clear: () => setStock(""),
      });
    }
    return chips;
  }, [categoryId, priceMin, priceMax, stock, filterCategories]);

  const activeFilterCount = activeFilterChips.length;

  function clearAdvancedFilters() {
    setCategoryId("");
    setPriceMin("");
    setPriceMax("");
    setStock("");
  }

  function clearDrafts() {
    setDraftColorways((prev) => {
      for (const d of prev) {
        for (const f of d.files) URL.revokeObjectURL(f.preview);
      }
      return [{ key: "d0", files: [], size_ids: [] }];
    });
    setActiveDraftKey("d0");
  }

  function activeSizeIds(): string[] {
    if (editing && activeColorwayId) return colorwaySizes[activeColorwayId] ?? [];
    return draftColorways.find((d) => d.key === activeDraftKey)?.size_ids ?? [];
  }

  function toggleActiveSize(sizeId: string) {
    if (editing && activeColorwayId) {
      setColorwaySizes((m) => {
        const cur = m[activeColorwayId] ?? [];
        const next = cur.includes(sizeId) ? cur.filter((id) => id !== sizeId) : [...cur, sizeId];
        return { ...m, [activeColorwayId]: next };
      });
      return;
    }
    setDraftColorways((ds) =>
      ds.map((d) => {
        if (d.key !== activeDraftKey) return d;
        const next = d.size_ids.includes(sizeId)
          ? d.size_ids.filter((id) => id !== sizeId)
          : [...d.size_ids, sizeId];
        return { ...d, size_ids: next };
      }),
    );
  }

  function openCreate() {
    setEditing(null);
    clearDrafts();
    setActiveColorwayId(null);
    setColorwaySizes({});
    const firstCat =
      meta?.categories.find((c) => c.is_leaf && c.status === "active") ??
      meta?.categories.find((c) => c.is_leaf) ??
      meta?.categories.find((c) => c.status === "active") ??
      meta?.categories[0];
    const defaultSizes = meta?.sizes.filter((s) => s.code !== "ONE_SIZE").map((s) => s.id) ?? [];
    setDraftColorways([{ key: "d0", files: [], size_ids: defaultSizes }]);
    setForm({
      ...emptyForm,
      primary_category_id: firstCat?.id ?? "",
      occasion_id: meta?.occasions[0]?.id ?? "",
      size_chart_id: meta?.size_charts[0]?.id ?? "",
    });
    setView("form");
  }

  function openEdit(p: AdminProduct) {
    setEditing(p);
    clearDrafts();
    const sorted = [...(p.colorways ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    setActiveColorwayId(sorted[0]?.id ?? null);
    setColorwaySizes(colorwaySizesFromProduct(p, meta?.sizes));
    const catId =
      meta?.categories.find((c) => c.slug === p.category?.slug)?.id ??
      meta?.categories[0]?.id ??
      "";
    const occId = meta?.occasions.find((o) => o.slug === p.occasion)?.id ?? "";
    const chartId = p.size_chart?.id ?? "";
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      material: p.material ?? "",
      primary_category_id: catId,
      occasion_id: occId,
      size_chart_id: chartId,
      status: (p.status as FormState["status"]) || "draft",
      price_vnd: String(p.price_vnd || ""),
      compare_at_price_vnd: p.sale_compare_vnd ? String(p.sale_compare_vnd) : "",
    });
    setView("form");
  }

  function backToList() {
    setView("list");
    setEditing(null);
    clearDrafts();
    setActiveColorwayId(null);
    setColorwaySizes({});
    setForm(emptyForm);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Nhập tên sản phẩm");
      return;
    }
    if (!form.primary_category_id) {
      toast.error("Chọn danh mục");
      return;
    }
    if (editing) {
      if ((editing.colorways ?? []).some((cw) => !(colorwaySizes[cw.id]?.length))) {
        toast.error("Mỗi màu cần ít nhất một size");
        return;
      }
    } else if (draftColorways.some((d) => !d.size_ids.length)) {
      toast.error("Mỗi màu cần ít nhất một size");
      return;
    }
    setSaving(true);
    try {
      const price = form.price_vnd ? Number(form.price_vnd) : undefined;
      const compare = form.compare_at_price_vnd ? Number(form.compare_at_price_vnd) : null;
      if (editing) {
        await adminApi.updateProduct(editing.id, {
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          description: form.description,
          material: form.material.trim() || null,
          primary_category_id: form.primary_category_id,
          occasion_id: form.occasion_id || null,
          size_chart_id: form.size_chart_id || null,
          colorway_sizes: (editing.colorways ?? []).map((cw) => ({
            colorway_id: cw.id,
            size_ids: colorwaySizes[cw.id] ?? [],
          })),
          status: form.status,
          price_vnd: price,
          compare_at_price_vnd: compare,
        });
        toast.success("Đã cập nhật sản phẩm");
      } else {
        let created = await adminApi.createProduct({
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          description: form.description,
          material: form.material.trim() || undefined,
          primary_category_id: form.primary_category_id,
          occasion_id: form.occasion_id || undefined,
          size_chart_id: form.size_chart_id || undefined,
          size_ids: draftColorways[0]?.size_ids ?? [],
          status: form.status,
          price_vnd: price ?? 0,
          compare_at_price_vnd: compare,
        });
        // Product starts with 1 colorway; upload draft[0], then create+upload rest
        for (let i = 0; i < draftColorways.length; i++) {
          const draft = draftColorways[i]!;
          let cwId: string | undefined;
          if (i === 0) {
            cwId = [...(created.colorways ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.id;
          } else {
            created = await adminApi.createColorway(created.id, { size_ids: draft.size_ids });
            const sorted = [...(created.colorways ?? [])].sort((a, b) => a.sort_order - b.sort_order);
            cwId = sorted[sorted.length - 1]?.id;
          }
          if (!cwId) throw new Error("Không tạo được màu");
          for (let fi = 0; fi < draft.files.length; fi++) {
            created = await adminApi.uploadProductMedia(created.id, draft.files[fi]!.file, {
              colorwayId: cwId,
              isCover: fi === 0 && i === 0,
            });
          }
        }
        clearDrafts();
        toast.success("Đã thêm sản phẩm");
      }
      setView("list");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function publish(p: AdminProduct) {
    try {
      await adminApi.publishProduct(p.id);
      toast.success("Đã xuất bản");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xuất bản thất bại");
    }
  }

  async function remove(p: AdminProduct) {
    const ok = await confirm({
      title: "Ẩn sản phẩm?",
      description: `"${p.name}" sẽ được lưu trữ và không còn hiện trên storefront.`,
      confirmLabel: "Ẩn sản phẩm",
    });
    if (!ok) return;
    try {
      await adminApi.deleteProduct(p.id, false);
      toast.success("Đã lưu trữ sản phẩm");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ẩn thất bại");
    }
  }

  async function destroy(p: AdminProduct) {
    const ok = await confirm({
      title: "Xóa vĩnh viễn?",
      description: `Xóa sản phẩm "${p.name}"?\nToàn bộ biến thể, tồn kho và ảnh sẽ bị xóa. Không hoàn tác.`,
      confirmLabel: "Xóa vĩnh viễn",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteProduct(p.id, true);
      toast.success("Đã xóa sản phẩm");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xóa thất bại");
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        for (const p of items) next.delete(p.id);
        return next;
      }
      const next = new Set(prev);
      for (const p of items) next.add(p.id);
      return next;
    });
  }

  async function bulkArchive() {
    const ids = items
      .filter((p) => selected.has(p.id) && p.status !== "archived")
      .map((p) => p.id);
    if (!ids.length) {
      toast.message("Không có mục nào cần ẩn (đã ẩn hết hoặc chưa chọn).");
      return;
    }
    const ok = await confirm({
      title: "Ẩn hàng loạt?",
      description: `Ẩn / lưu trữ ${ids.length} sản phẩm đã chọn? Chúng sẽ không còn hiện trên storefront.`,
      confirmLabel: `Ẩn ${ids.length} sản phẩm`,
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      let ok = 0;
      for (const id of ids) {
        await adminApi.deleteProduct(id, false);
        ok += 1;
      }
      toast.success(`Đã ẩn ${ok} sản phẩm`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Thao tác hàng loạt thất bại");
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDestroy() {
    const ids = items.filter((p) => selected.has(p.id)).map((p) => p.id);
    if (!ids.length) return;
    const ok = await confirm({
      title: "Xóa vĩnh viễn?",
      description: `Xóa ${ids.length} sản phẩm đã chọn?\nKhông hoàn tác.`,
      confirmLabel: `Xóa ${ids.length} sản phẩm`,
      destructive: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      let ok = 0;
      for (const id of ids) {
        await adminApi.deleteProduct(id, true);
        ok += 1;
      }
      toast.success(`Đã xóa ${ok} sản phẩm`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xóa hàng loạt thất bại");
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkPublish() {
    const ids = items.filter((p) => selected.has(p.id) && p.status === "draft").map((p) => p.id);
    if (!ids.length) {
      toast.message("Không có bản nháp nào trong lựa chọn.");
      return;
    }
    const ok = await confirm({
      title: "Xuất bản hàng loạt?",
      description: `Xuất bản ${ids.length} bản nháp đã chọn lên storefront?`,
      confirmLabel: `Xuất bản ${ids.length}`,
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      let ok = 0;
      for (const id of ids) {
        await adminApi.publishProduct(id);
        ok += 1;
      }
      toast.success(`Đã xuất bản ${ok} sản phẩm`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xuất bản hàng loạt thất bại");
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  if (view === "form") {
    return (
      <>
        {confirmDialog}
        <nav className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            className="hover:text-foreground hover:underline"
            onClick={backToList}
          >
            Sản phẩm
          </button>
          <span aria-hidden>›</span>
          <span className="text-foreground">
            {editing
              ? `Chỉnh sửa sản phẩm${editing.name ? ` · ${editing.name}` : ""}`
              : "Thêm sản phẩm"}
          </span>
        </nav>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="section-label text-primary">{editing ? "Chỉnh sửa" : "Tạo mới"}</p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl">
              {editing ? editing.name : "Thêm sản phẩm"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {editing
                ? "Cập nhật thông tin, danh mục lá và tồn size."
                : "Tạo sản phẩm kèm giá / biến thể mặc định."}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={backToList}>
              Quay lại
            </Button>
            <Button disabled={saving || uploading} onClick={save}>
              {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo sản phẩm"}
            </Button>
          </div>
        </div>
        <section className="mt-8 grid gap-8 border-t border-border pt-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <label className="block">
              <span className="text-xs font-medium">Tên sản phẩm</span>
              <Input
                className="mt-2"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: editing ? f.slug : slugify(name) }));
                }}
                placeholder="Đầm lụa hai dây Noir"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Slug</span>
              <Input
                className="mt-2 font-mono text-sm"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium">Dịp mặc</span>
                <select
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-[#f7f4ef] px-3 text-sm"
                  value={form.occasion_id}
                  onChange={(e) => setForm((f) => ({ ...f, occasion_id: e.target.value }))}
                >
                  <option value="">—</option>
                  {meta?.occasions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium">Bảng size</span>
                <select
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-[#f7f4ef] px-3 text-sm"
                  value={form.size_chart_id}
                  onChange={(e) => setForm((f) => ({ ...f, size_chart_id: e.target.value }))}
                >
                  <option value="">Không gắn</option>
                  {meta?.size_charts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.unit})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="block space-y-3">
              <legend className="text-xs font-medium">Màu (bộ ảnh)</legend>
              <p className="text-[11px] text-muted-foreground">
                Mỗi tab là một màu với gallery riêng. Thêm màu trước hoặc sau khi lưu đều được.
              </p>
              <div className="flex flex-wrap gap-1 border-b border-border pb-2">
                {editing
                  ? [...(editing.colorways ?? [])]
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((cw, i) => (
                        <button
                          key={cw.id}
                          type="button"
                          onClick={() => setActiveColorwayId(cw.id)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-sm",
                            activeColorwayId === cw.id
                              ? "border-foreground bg-accent/40 font-medium"
                              : "border-border bg-[#f7f4ef] hover:bg-secondary/50",
                          )}
                        >
                          Màu {i + 1}
                        </button>
                      ))
                  : draftColorways.map((d, i) => (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setActiveDraftKey(d.key)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-sm",
                          activeDraftKey === d.key
                            ? "border-foreground bg-accent/40 font-medium"
                            : "border-border bg-[#f7f4ef] hover:bg-secondary/50",
                        )}
                      >
                        Màu {i + 1}
                        {d.files.length ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            ({d.files.length})
                          </span>
                        ) : null}
                      </button>
                    ))}
                <button
                  type="button"
                  disabled={uploading || saving}
                  className="rounded-md border border-dashed border-border bg-[#f7f4ef] px-2.5 py-1 text-sm text-muted-foreground hover:bg-secondary/50"
                  onClick={async () => {
                    if (editing) {
                      setUploading(true);
                      try {
                        const updated = await adminApi.createColorway(editing.id, {
                          size_ids: colorwaySizes[activeColorwayId ?? ""] ?? [],
                        });
                        setEditing(updated);
                        setColorwaySizes(colorwaySizesFromProduct(updated, meta?.sizes));
                        const sorted = [...(updated.colorways ?? [])].sort(
                          (a, b) => a.sort_order - b.sort_order,
                        );
                        setActiveColorwayId(sorted[sorted.length - 1]?.id ?? null);
                        await load();
                        toast.success("Đã thêm màu");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Thêm màu thất bại");
                      } finally {
                        setUploading(false);
                      }
                    } else {
                      const key = `d${Date.now()}`;
                      const from =
                        draftColorways.find((d) => d.key === activeDraftKey)?.size_ids ?? [];
                      setDraftColorways((ds) => [...ds, { key, files: [], size_ids: [...from] }]);
                      setActiveDraftKey(key);
                    }
                  }}
                >
                  + Thêm màu
                </button>
                <button
                  type="button"
                  disabled={
                    uploading ||
                    saving ||
                    (editing
                      ? (editing.colorways?.length ?? 0) <= 1 || !activeColorwayId
                      : draftColorways.length <= 1)
                  }
                  className="rounded-md border border-border bg-[#f7f4ef] px-2.5 py-1 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  onClick={async () => {
                    if (editing) {
                      if (!activeColorwayId) return;
                      const ok = await confirm({
                        title: "Xóa màu này?",
                        description: "Ảnh và SKU của màu sẽ bị gỡ / ngưng bán.",
                        confirmLabel: "Xóa màu",
                        destructive: true,
                      });
                      if (!ok) return;
                      setUploading(true);
                      try {
                        const updated = await adminApi.deleteColorway(editing.id, activeColorwayId);
                        setEditing(updated);
                        setColorwaySizes(colorwaySizesFromProduct(updated, meta?.sizes));
                        const sorted = [...(updated.colorways ?? [])].sort(
                          (a, b) => a.sort_order - b.sort_order,
                        );
                        setActiveColorwayId(sorted[0]?.id ?? null);
                        await load();
                        toast.success("Đã xóa màu");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Xóa màu thất bại");
                      } finally {
                        setUploading(false);
                      }
                    } else {
                      if (draftColorways.length <= 1) return;
                      const removing = draftColorways.find((d) => d.key === activeDraftKey);
                      if (removing) {
                        for (const f of removing.files) URL.revokeObjectURL(f.preview);
                      }
                      const next = draftColorways.filter((d) => d.key !== activeDraftKey);
                      setDraftColorways(next);
                      setActiveDraftKey(next[0]?.key ?? "d0");
                    }
                  }}
                >
                  Xóa màu
                </button>
              </div>
              <div className="space-y-3 pt-1">
                <p className="text-xs font-medium">Ảnh — tab màu đang chọn</p>
                <div className="flex flex-wrap gap-2">
                  {editing
                    ? (editing.media ?? [])
                        .filter((m) => !activeColorwayId || m.colorway_id === activeColorwayId)
                        .map((m) => {
                          const src = productImageUrl(m.url);
                          return (
                            <div
                              key={m.asset_id}
                              className="relative h-20 w-16 overflow-hidden rounded-sm border border-border"
                            >
                              {src ? (
                                <img
                                  src={src}
                                  alt={m.alt ?? ""}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                              {m.is_cover ? (
                                <span className="absolute left-0.5 top-0.5 rounded bg-foreground/80 px-1 text-[8px] text-background">
                                  Cover
                                </span>
                              ) : null}
                              <button
                                type="button"
                                className="absolute bottom-0.5 right-0.5 rounded bg-background/90 px-1 text-[9px] text-primary"
                                disabled={uploading}
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: "Xóa ảnh?",
                                    description: "Ảnh này sẽ bị gỡ khỏi sản phẩm.",
                                    confirmLabel: "Xóa ảnh",
                                    destructive: true,
                                  });
                                  if (!ok) return;
                                  setUploading(true);
                                  try {
                                    const updated = await adminApi.deleteProductMedia(
                                      editing.id,
                                      m.asset_id,
                                    );
                                    setEditing(updated);
                                    await load();
                                    toast.success("Đã xóa ảnh");
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "Xóa ảnh thất bại");
                                  } finally {
                                    setUploading(false);
                                  }
                                }}
                              >
                                Xóa
                              </button>
                            </div>
                          );
                        })
                    : (draftColorways.find((d) => d.key === activeDraftKey)?.files ?? []).map(
                        (f, idx) => (
                          <div
                            key={`${activeDraftKey}-${idx}`}
                            className="relative h-20 w-16 overflow-hidden rounded-sm border border-dashed border-primary"
                          >
                            <img
                              src={f.preview}
                              alt="Preview"
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              className="absolute bottom-0.5 right-0.5 rounded bg-background/90 px-1 text-[9px] text-primary"
                              onClick={() => {
                                URL.revokeObjectURL(f.preview);
                                setDraftColorways((ds) =>
                                  ds.map((d) =>
                                    d.key === activeDraftKey
                                      ? { ...d, files: d.files.filter((_, i) => i !== idx) }
                                      : d,
                                  ),
                                );
                              }}
                            >
                              Xóa
                            </button>
                          </div>
                        ),
                      )}
                </div>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border p-5 text-center text-muted-foreground hover:bg-secondary/40">
                  <Upload className="size-5" />
                  <p className="mt-2 text-sm">Chọn ảnh (JPEG/PNG/WebP, ≤5MB) — nhiều file được</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    onChange={async (e) => {
                      const picked = [...(e.target.files ?? [])];
                      e.target.value = "";
                      if (!picked.length) return;
                      const tooBig = picked.filter((f) => f.size > 5 * 1024 * 1024);
                      if (tooBig.length) {
                        toast.error(`${tooBig.length} ảnh vượt 5MB — bỏ qua`);
                      }
                      const files = picked.filter((f) => f.size <= 5 * 1024 * 1024);
                      if (!files.length) return;

                      if (editing) {
                        const cwId = activeColorwayId ?? editing.colorways?.[0]?.id;
                        if (!cwId) {
                          toast.error("Chọn tab màu trước khi upload");
                          return;
                        }
                        const hadMedia = (editing.media ?? []).some((m) => m.colorway_id === cwId);
                        setUploading(true);
                        try {
                          let updated = editing;
                          for (let i = 0; i < files.length; i++) {
                            updated = await adminApi.uploadProductMedia(editing.id, files[i]!, {
                              colorwayId: cwId,
                              isCover: !hadMedia && i === 0,
                            });
                          }
                          setEditing(updated);
                          await load();
                          toast.success(
                            files.length === 1 ? "Đã tải ảnh lên" : `Đã tải ${files.length} ảnh lên`,
                          );
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Upload thất bại");
                        } finally {
                          setUploading(false);
                        }
                      } else {
                        setDraftColorways((ds) =>
                          ds.map((d) =>
                            d.key === activeDraftKey
                              ? {
                                  ...d,
                                  files: [
                                    ...d.files,
                                    ...files.map((file) => ({
                                      file,
                                      preview: URL.createObjectURL(file),
                                    })),
                                  ],
                                }
                              : d,
                          ),
                        );
                      }
                    }}
                  />
                </label>
              </div>
            </fieldset>
            <fieldset className="block space-y-3">
              <legend className="text-xs font-medium">Size bán (màu đang chọn)</legend>
              <p className="text-[11px] text-muted-foreground">
                Mỗi màu có list size riêng. Thêm màu mới sẽ copy size từ tab đang chọn.
              </p>
              <div className="flex flex-wrap gap-2">
                {(meta?.sizes ?? []).map((s) => {
                  const checked = activeSizeIds().includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleActiveSize(s.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                        checked
                          ? "border-foreground bg-accent/40 font-medium"
                          : "border-border bg-[#f7f4ef] hover:bg-secondary/50",
                      )}
                    >
                      <span className="font-medium">{s.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{s.code}</span>
                    </button>
                  );
                })}
              </div>
              {!meta?.sizes?.length && (
                <span className="text-xs text-muted-foreground">
                  Chưa có mã size — thêm ở tab Bảng size.
                </span>
              )}
            </fieldset>

            <fieldset className="block space-y-3">
              <legend className="text-xs font-medium">Tồn kho theo SKU</legend>
              <p className="text-[11px] text-muted-foreground">
                Chỉ xem. Muốn đổi số → tạo phiếu nhập / điều chỉnh ở Kho hàng.
              </p>
              {editing ? (
                <>
                  <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/55 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Màu</th>
                          <th className="px-3 py-2 text-left">Size</th>
                          <th className="px-3 py-2 text-left">SKU</th>
                          <th className="px-3 py-2 text-right">Thực có</th>
                          <th className="px-3 py-2 text-right">Giữ</th>
                          <th className="px-3 py-2 text-right">Khả dụng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(editing.variants ?? [])
                          .filter((v) => v.status !== "inactive" && v.status !== "archived")
                          .filter((v) => !activeColorwayId || v.colorway_id === activeColorwayId)
                          .map((v) => {
                            const available = v.available ?? 0;
                            const low =
                              available <= (v.reorder_point ?? 0) && (v.reorder_point ?? 0) > 0;
                            return (
                              <tr key={v.id} className="border-t border-border">
                                <td className="px-3 py-2">
                                  <span className="inline-flex items-center gap-2">
                                    {v.color?.hex ? (
                                      <span
                                        className="size-3 rounded-full border border-border"
                                        style={{ backgroundColor: v.color.hex }}
                                      />
                                    ) : null}
                                    {v.color?.name ?? "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-2">{v.size?.label ?? "—"}</td>
                                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                                  {v.sku}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">{v.on_hand ?? 0}</td>
                                <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                                  {v.reserved ?? 0}
                                </td>
                                <td
                                  className={cn(
                                    "px-3 py-2 text-right font-mono font-medium",
                                    available === 0
                                      ? "text-destructive"
                                      : low
                                        ? "text-primary"
                                        : "",
                                  )}
                                >
                                  {available}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tổng thực có: {editing.stock_total ?? 0} · {editing.variants?.length ?? 0} SKU
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onNavigate?.("inventory", {
                        productId: editing.id,
                        productName: editing.name,
                      })
                    }
                  >
                    Nhập kho cho sản phẩm này
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sau khi tạo sẽ có{" "}
                  {draftColorways.reduce((n, d) => n + d.size_ids.length, 0)} SKU (tồn 0).
                  Lưu xong rồi dùng «Nhập kho cho sản phẩm này».
                </p>
              )}
            </fieldset>
            <label className="block">
              <span className="text-xs font-medium">Mô tả</span>
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-input bg-[#f7f4ef] p-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Chất liệu</span>
              <Input
                className="mt-2"
                value={form.material}
                onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium">Giá bán (VND)</span>
                <Input
                  className="mt-2"
                  type="number"
                  value={form.price_vnd}
                  onChange={(e) => setForm((f) => ({ ...f, price_vnd: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium">Giá so sánh</span>
                <Input
                  className="mt-2"
                  type="number"
                  value={form.compare_at_price_vnd}
                  onChange={(e) => setForm((f) => ({ ...f, compare_at_price_vnd: e.target.value }))}
                  placeholder="Tuỳ chọn"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium">Trạng thái</span>
              <select
                className="mt-2 flex h-9 w-full rounded-md border border-input bg-[#f7f4ef] px-3 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))
                }
              >
                <option value="draft">Bản nháp</option>
                <option value="published">Đang bán</option>
                <option value="archived">Đã ẩn</option>
              </select>
            </label>

            <div className="flex gap-2 border-t border-border pt-6">
              <Button disabled={saving || uploading} onClick={save}>
                {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo sản phẩm"}
              </Button>
              <Button variant="outline" onClick={backToList}>
                Hủy
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium">Danh mục</p>
              {selectedCategoryLabel ? (
                <p className="truncate text-[11px] text-muted-foreground">
                  Đã chọn: {selectedCategoryLabel}
                </p>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Chỉ gắn được danh mục lá (không còn mục con).
            </p>
            <div className="mt-2 max-h-[28rem] overflow-y-auto rounded-md border border-border lg:max-h-[calc(100vh-22rem)]">
              {categoryGroups.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">Chưa có danh mục lá.</p>
              ) : (
                categoryGroups.map((g) => (
                  <div key={g.title} className="border-b border-border last:border-b-0">
                    <p className="sticky top-0 bg-secondary/80 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
                      {g.title}
                    </p>
                    {g.items.map((c) => {
                      const selected = form.primary_category_id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, primary_category_id: c.id }))}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                            selected ? "bg-accent/45 font-medium" : "hover:bg-secondary/45",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-4 shrink-0 place-items-center rounded-full border",
                              selected
                                ? "border-foreground bg-foreground"
                                : "border-muted-foreground/40",
                            )}
                          >
                            {selected ? (
                              <span className="size-1.5 rounded-full bg-background" />
                            ) : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate">{c.name}</span>
                            <span className="block truncate font-mono text-[10px] text-muted-foreground">
                              {c.slug}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[11px] text-muted-foreground">
          <span>© 2026 ÉLANE · Modern Femininity</span>
          <span>Sản phẩm · form</span>
        </footer>
      </>
    );
  }

  return (
    <>
      {confirmDialog}
      <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label text-primary">Danh mục thương mại</p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Quản lý thông tin, giá, danh mục và trạng thái.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> Thêm sản phẩm
        </Button>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={cn(
              "rounded-md border p-5",
              i === 0 ? "border-accent bg-accent/25" : "border-border",
            )}
          >
            <p className="section-label">{m.label}</p>
            <p className="mt-3 font-serif text-3xl">{m.value}</p>
            <p className={cn("mt-1 text-xs", i === 0 ? "text-primary" : "text-muted-foreground")}>
              {m.note}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border">
        <div className="border-b border-border bg-secondary/20 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex shrink-0 gap-0.5 rounded-md border border-border/70 bg-[#f7f4ef] p-0.5">
              {(
                [
                  ["all", "Tất cả", statusCounts.all],
                  ["published", "Đang bán", statusCounts.published],
                  ["draft", "Bản nháp", statusCounts.draft],
                  ["archived", "Đã ẩn", statusCounts.archived],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
                    tab === id
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "tabular-nums",
                      tab === id ? "text-background/70" : "text-muted-foreground/80",
                    )}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                className="h-9 border-border/70 bg-[#f7f4ef] pl-9 pr-9"
                placeholder="Tìm tên, slug, SKU…"
              />
              {queryInput ? (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setQueryInput("")}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 gap-1.5 border-border/70 bg-[#f7f4ef]",
                      activeFilterCount > 0 && "border-primary/40 bg-accent/40",
                    )}
                  >
                    <SlidersHorizontal className="size-3.5" />
                    Bộ lọc
                    {activeFilterCount > 0 ? (
                      <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 space-y-4 p-4">
                  <div>
                    <p className="section-label">Bộ lọc nâng cao</p>
                    <p className="mt-1 text-xs text-muted-foreground">Áp dụng ngay khi chọn.</p>
                  </div>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium">Danh mục</span>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-[#f7f4ef] px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <option value="">Tất cả danh mục</option>
                      {filterCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">Khoảng giá (VND)</span>
                    <div className="flex gap-2">
                      <Input
                        inputMode="numeric"
                        placeholder="Từ"
                        value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value.replace(/[^\d]/g, ""))}
                      />
                      <Input
                        inputMode="numeric"
                        placeholder="Đến"
                        value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value.replace(/[^\d]/g, ""))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">Tồn kho</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          ["", "Tất cả"],
                          ["in", "Còn hàng"],
                          ["out", "Hết hàng"],
                          ["none", "Chưa nhập"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id || "all"}
                          type="button"
                          onClick={() => setStock(id)}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-xs transition-colors",
                            stock === id
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-[#f7f4ef] text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end border-t border-border pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={activeFilterCount === 0}
                      onClick={clearAdvancedFilters}
                    >
                      Xóa lọc
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <select
                aria-label="Số dòng mỗi trang"
                className="h-9 rounded-md border border-border/70 bg-[#f7f4ef] px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
              </select>
            </div>
          </div>

          {activeFilterChips.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.clear}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-[#f7f4ef] px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-primary/40"
                >
                  {chip.label}
                  <X className="size-3 opacity-60" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAdvancedFilters}
                className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
              >
                Xóa tất cả
              </button>
            </div>
          ) : null}
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
            <span className="text-xs font-medium">Đã chọn {selectedCount}</span>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkPublish}>
              Xuất bản
            </Button>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkArchive}>
              <Archive className="size-3.5" /> Ẩn
            </Button>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkDestroy}>
              <Trash2 className="size-3.5" /> Xóa
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={bulkBusy}
              onClick={() => setSelected(new Set())}
            >
              Bỏ chọn
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-secondary/55">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                    }}
                    onChange={toggleAllFiltered}
                  />
                </th>
                <th className="w-12 px-2 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  STT
                </th>
                {[
                  "Ảnh",
                  "Sản phẩm",
                  "Danh mục",
                  "Size",
                  "Tồn",
                  "Giá bán",
                  "SKU",
                  "Trạng thái",
                  "",
                ].map((c) => (
                  <th
                    key={c || "a"}
                    className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((p, idx) => {
                const thumb = productImageUrl(p.images?.[0] ?? p.media?.[0]?.url);
                const checked = selected.has(p.id);
                const stt = (page - 1) * limit + idx + 1;
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-t border-border transition-colors hover:bg-secondary/35",
                      checked && "bg-accent/20",
                    )}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${p.name}`}
                        checked={checked}
                        onChange={() => toggleOne(p.id)}
                      />
                    </td>
                    <td className="px-2 py-3.5 text-center text-xs tabular-nums text-muted-foreground">
                      {stt}
                    </td>                    <td className="px-4 py-2.5">
                      <div className="h-20 w-16 overflow-hidden rounded-sm border border-border bg-secondary/40">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={p.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-[9px] text-muted-foreground">
                            N/A
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium">{p.name}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{p.category?.name ?? "—"}</td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {p.sizes?.length ? p.sizes.map((s) => s.label).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{p.stock_total ?? 0}</td>
                    <td className="px-4 py-3.5">
                      {Number(p.price_vnd).toLocaleString("vi-VN")}₫
                      {p.sale_compare_vnd ? (
                        <span className="ml-2 text-xs text-muted-foreground line-through">
                          {Number(p.sale_compare_vnd).toLocaleString("vi-VN")}₫
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                      {p.variants?.[0]?.sku ?? "—"}
                      {p.variants && p.variants.length > 1 ? ` +${p.variants.length - 1}` : ""}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium",
                          p.status === "draft" || p.status === "archived"
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary text-foreground",
                        )}
                      >
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td className="px-2">
                      <div className="flex justify-end gap-1">
                        {p.status === "draft" && (
                          <Button variant="ghost" size="sm" onClick={() => publish(p)}>
                            Publish
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Chi tiết tồn ${p.name}`}
                          title="Xem chi tiết tồn"
                          onClick={() => setStockDetail(p)}
                        >
                          <Boxes className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Sửa ${p.name}`}
                          onClick={() => openEdit(p)}
                        >
                          <MoreHorizontal />
                        </Button>
                        {p.status !== "archived" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ẩn ${p.name}`}
                            onClick={() => remove(p)}
                          >
                            <Archive className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Xóa ${p.name}`}
                          onClick={() => destroy(p)}
                        >
                          <Trash2 className="size-4 text-primary" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && items.length === 0 && (
            <div className="grid h-48 place-items-center text-sm text-muted-foreground">
              Không tìm thấy sản phẩm.
            </div>
          )}
          {loading && (
            <div className="grid h-48 place-items-center text-sm text-muted-foreground">
              Đang tải…
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            {total === 0
              ? "Không có mục"
              : `Hiển thị ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} / ${total}`}
            {selectedCount > 0 ? ` · đã chọn ${selectedCount}` : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" /> Trước
            </Button>
            <span className="tabular-nums">
              Trang {page}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[11px] text-muted-foreground">
        <span>© 2026 ÉLANE · Modern Femininity</span>
        <span>Sản phẩm · CRUD Phase 1</span>
      </footer>

      <Dialog open={!!stockDetail} onOpenChange={(open) => !open && setStockDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden bg-[#f7f4ef] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Chi tiết tồn</DialogTitle>
            <p className="text-sm text-muted-foreground line-clamp-2">{stockDetail?.name}</p>
          </DialogHeader>
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-secondary/55 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Màu</th>
                  <th className="px-3 py-2 text-left">Size</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-right">Thực có</th>
                  <th className="px-3 py-2 text-right">Giữ</th>
                  <th className="px-3 py-2 text-right">Khả dụng</th>
                </tr>
              </thead>
              <tbody>
                {(stockDetail?.variants ?? [])
                  .filter((v) => v.status !== "inactive" && v.status !== "archived")
                  .map((v) => {
                    const available = v.available ?? 0;
                    const low =
                      available <= (v.reorder_point ?? 0) && (v.reorder_point ?? 0) > 0;
                    return (
                      <tr key={v.id} className="border-t border-border">
                        <td className="px-3 py-2">{v.color?.name ?? v.color_name ?? "—"}</td>
                        <td className="px-3 py-2">{v.size?.label ?? v.size_label ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{v.on_hand ?? 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{v.reserved ?? 0}</td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right font-medium tabular-nums",
                            available === 0
                              ? "text-destructive"
                              : low
                                ? "text-primary"
                                : "",
                          )}
                        >
                          {available}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {!stockDetail?.variants?.some(
              (v) => v.status !== "inactive" && v.status !== "archived",
            ) ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Chưa có SKU / tồn — tạo size trên form sản phẩm rồi nhập kho.
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Tổng thực có: {stockDetail?.stock_total ?? 0} ·{" "}
            {(stockDetail?.variants ?? []).filter(
              (v) => v.status !== "inactive" && v.status !== "archived",
            ).length}{" "}
            SKU
          </p>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!stockDetail) return;
                const id = stockDetail.id;
                const name = stockDetail.name;
                setStockDetail(null);
                onNavigate?.("inventory", { productId: id, productName: name });
              }}
            >
              Nhập kho
            </Button>
            <Button type="button" onClick={() => setStockDetail(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
