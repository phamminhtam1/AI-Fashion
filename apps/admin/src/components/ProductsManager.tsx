import { Archive, MoreHorizontal, Plus, Search, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { adminApi, API_URL, type AdminProduct, type ProductMeta } from "@/lib/api";
import { useConfirmDialog } from "@/components/ConfirmDialog";

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
  color_ids: string[];
  size_ids: string[];
  status: "draft" | "published" | "archived";
  price_vnd: string;
  compare_at_price_vnd: string;
  is_best_seller: boolean;
  is_new: boolean;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  material: "",
  primary_category_id: "",
  occasion_id: "",
  size_chart_id: "",
  color_ids: [],
  size_ids: [],
  status: "draft",
  price_vnd: "",
  compare_at_price_vnd: "",
  is_best_seller: false,
  is_new: false,
};

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
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "published" | "draft" | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

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
      const [prods, m] = await Promise.all([adminApi.products(), adminApi.productMeta()]);
      setItems(prods.items);
      setMeta(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được sản phẩm");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, query]);

  const filtered = useMemo(() => {
    let list = items;
    if (tab !== "all") list = list.filter((p) => p.status === tab);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        `${p.name} ${p.slug} ${p.category?.name ?? ""}`.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, tab, query]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someFilteredSelected = filtered.some((p) => selected.has(p.id));
  const selectedCount = filtered.filter((p) => selected.has(p.id)).length;

  const metrics = useMemo(
    () => [
      {
        label: "Tổng sản phẩm",
        value: String(items.length),
        note: `${items.filter((p) => p.status === "published").length} đang bán`,
      },
      {
        label: "Bản nháp",
        value: String(items.filter((p) => p.status === "draft").length),
        note: "Chưa public",
      },
      {
        label: "Đã ẩn",
        value: String(items.filter((p) => p.status === "archived").length),
        note: "Lưu trữ",
      },
    ],
    [items],
  );

  function openCreate() {
    setEditing(null);
    setPendingFile(null);
    setPendingPreview(null);
    const firstCat =
      meta?.categories.find((c) => c.is_leaf && c.status === "active") ??
      meta?.categories.find((c) => c.is_leaf) ??
      meta?.categories.find((c) => c.status === "active") ??
      meta?.categories[0];
    const defaultSizes = meta?.sizes.filter((s) => s.code !== "ONE_SIZE").map((s) => s.id) ?? [];
    const defaultColors = meta?.colors.slice(0, 1).map((c) => c.id) ?? [];
    setForm({
      ...emptyForm,
      primary_category_id: firstCat?.id ?? "",
      occasion_id: meta?.occasions[0]?.id ?? "",
      size_chart_id: meta?.size_charts[0]?.id ?? "",
      color_ids: defaultColors,
      size_ids: defaultSizes,
    });
    setView("form");
  }

  function openEdit(p: AdminProduct) {
    setEditing(p);
    setPendingFile(null);
    setPendingPreview(null);
    const catId =
      meta?.categories.find((c) => c.slug === p.category?.slug)?.id ??
      meta?.categories[0]?.id ??
      "";
    const occId = meta?.occasions.find((o) => o.slug === p.occasion)?.id ?? "";
    const chartId = p.size_chart?.id ?? "";
    const sizeIds =
      p.size_stocks?.map((s) => s.size_id) ??
      p.sizes
        ?.map((ps) => meta?.sizes.find((s) => s.code === ps.code)?.id)
        .filter((id): id is string => !!id) ??
      [];
    const colorIds =
      p.colors
        ?.map((pc) => meta?.colors.find((c) => c.code === pc.code)?.id)
        .filter((id): id is string => !!id) ??
      [...new Set(
        (p.variants ?? [])
          .map((v) => meta?.colors.find((c) => c.code === v.color?.code)?.id)
          .filter((id): id is string => !!id),
      )];
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      material: p.material ?? "",
      primary_category_id: catId,
      occasion_id: occId,
      size_chart_id: chartId,
      color_ids: colorIds,
      size_ids: sizeIds,
      status: (p.status as FormState["status"]) || "draft",
      price_vnd: String(p.price_vnd || ""),
      compare_at_price_vnd: p.sale_compare_vnd ? String(p.sale_compare_vnd) : "",
      is_best_seller: !!p.best_seller,
      is_new: !!p.is_new,
    });
    setView("form");
  }

  function backToList() {
    setView("list");
    setEditing(null);
    setPendingFile(null);
    setPendingPreview(null);
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
    if (!form.color_ids.length) {
      toast.error("Chọn ít nhất một màu");
      return;
    }
    if (!form.size_ids.length) {
      toast.error("Chọn ít nhất một size");
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
          material: form.material || null,
          primary_category_id: form.primary_category_id,
          occasion_id: form.occasion_id || null,
          size_chart_id: form.size_chart_id || null,
          color_ids: form.color_ids,
          size_ids: form.size_ids,
          status: form.status,
          price_vnd: price,
          compare_at_price_vnd: compare,
          is_best_seller: form.is_best_seller,
          is_new: form.is_new,
        });
        if (pendingFile) {
          const updated = await adminApi.uploadProductMedia(editing.id, pendingFile, true);
          setEditing(updated);
          setPendingFile(null);
          setPendingPreview(null);
        }
        toast.success("Đã cập nhật sản phẩm");
      } else {
        const created = await adminApi.createProduct({
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          description: form.description,
          material: form.material || undefined,
          primary_category_id: form.primary_category_id,
          occasion_id: form.occasion_id || undefined,
          size_chart_id: form.size_chart_id || undefined,
          color_ids: form.color_ids,
          size_ids: form.size_ids,
          status: form.status,
          price_vnd: price ?? 0,
          compare_at_price_vnd: compare,
          is_best_seller: form.is_best_seller,
          is_new: form.is_new,
        });
        if (pendingFile) {
          await adminApi.uploadProductMedia(created.id, pendingFile, true);
          setPendingFile(null);
          setPendingPreview(null);
        }
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
        for (const p of filtered) next.delete(p.id);
        return next;
      }
      const next = new Set(prev);
      for (const p of filtered) next.add(p.id);
      return next;
    });
  }

  async function bulkArchive() {
    const ids = filtered.filter((p) => selected.has(p.id) && p.status !== "archived").map((p) => p.id);
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
    const ids = filtered.filter((p) => selected.has(p.id)).map((p) => p.id);
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
    const ids = filtered.filter((p) => selected.has(p.id) && p.status === "draft").map((p) => p.id);
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
          <button type="button" className="hover:text-foreground hover:underline" onClick={backToList}>
            Sản phẩm
          </button>
          <span aria-hidden>›</span>
          <span className="text-foreground">
            {editing ? `Chỉnh sửa sản phẩm${editing.name ? ` · ${editing.name}` : ""}` : "Thêm sản phẩm"}
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
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
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
              <legend className="text-xs font-medium">Màu bán</legend>
              <p className="text-[11px] text-muted-foreground">
                Tick màu có bán. Hệ thống tạo biến thể theo từng cặp màu × size.
              </p>
              <div className="flex flex-wrap gap-2">
                {(meta?.colors ?? []).map((c) => {
                  const checked = form.color_ids.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          color_ids: checked
                            ? f.color_ids.filter((id) => id !== c.id)
                            : [...f.color_ids, c.id],
                        }))
                      }
                      className={cn(
                        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                        checked
                          ? "border-foreground bg-accent/40 font-medium"
                          : "border-border hover:bg-secondary/50",
                      )}
                    >
                      <span
                        className="size-3.5 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: c.hex ?? "#ccc" }}
                        aria-hidden
                      />
                      {c.name}
                    </button>
                  );
                })}
              </div>
              {!meta?.colors?.length && (
                <span className="text-xs text-muted-foreground">Chưa có màu trong hệ thống.</span>
              )}
            </fieldset>
            <fieldset className="block space-y-3">
              <legend className="text-xs font-medium">Size bán</legend>
              <p className="text-[11px] text-muted-foreground">
                Tick size có bán. Tồn theo từng SKU (màu × size) xem bên dưới / tại Kho hàng.
              </p>
              <div className="flex flex-wrap gap-2">
                {(meta?.sizes ?? []).map((s) => {
                  const checked = form.size_ids.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          size_ids: checked
                            ? f.size_ids.filter((id) => id !== s.id)
                            : [...f.size_ids, s.id],
                        }))
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                        checked
                          ? "border-foreground bg-accent/40 font-medium"
                          : "border-border hover:bg-secondary/50",
                      )}
                    >
                      <span className="font-medium">{s.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{s.code}</span>
                    </button>
                  );
                })}
              </div>
              {!meta?.sizes?.length && (
                <span className="text-xs text-muted-foreground">Chưa có mã size — thêm ở tab Bảng size.</span>
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
                  Sau khi tạo sẽ có {form.color_ids.length * form.size_ids.length || 0} SKU (tồn 0).
                  Lưu xong rồi dùng «Nhập kho cho sản phẩm này».
                </p>
              )}
            </fieldset>
            <label className="block">
              <span className="text-xs font-medium">Mô tả</span>
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-input bg-transparent p-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Chất liệu</span>
              <Input className="mt-2" value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} />
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
                className="mt-2 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))}
              >
                <option value="draft">Bản nháp</option>
                <option value="published">Đang bán</option>
                <option value="archived">Đã ẩn</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_new}
                  onChange={(e) => setForm((f) => ({ ...f, is_new: e.target.checked }))}
                />
                Hàng mới
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_best_seller}
                  onChange={(e) => setForm((f) => ({ ...f, is_best_seller: e.target.checked }))}
                />
                Bán chạy
              </label>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium">Ảnh sản phẩm</p>
              <div className="flex flex-wrap gap-2">
                {(editing?.media ?? []).map((m) => {
                  const src = productImageUrl(m.url);
                  return (
                    <div key={m.asset_id} className="relative h-20 w-16 overflow-hidden rounded-sm border border-border">
                      {src ? <img src={src} alt={m.alt ?? ""} className="h-full w-full object-cover" /> : null}
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
                          if (!editing) return;
                          const ok = await confirm({
                            title: "Xóa ảnh?",
                            description: "Ảnh này sẽ bị gỡ khỏi sản phẩm.",
                            confirmLabel: "Xóa ảnh",
                            destructive: true,
                          });
                          if (!ok) return;
                          setUploading(true);
                          try {
                            const updated = await adminApi.deleteProductMedia(editing.id, m.asset_id);
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
                })}
                {pendingPreview ? (
                  <div className="relative h-20 w-16 overflow-hidden rounded-sm border border-dashed border-primary">
                    <img src={pendingPreview} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                ) : null}
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border p-5 text-center text-muted-foreground hover:bg-secondary/40">
                <Upload className="size-5" />
                <p className="mt-2 text-sm">Chọn ảnh (JPEG/PNG/WebP, ≤5MB)</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Ảnh tối đa 5MB");
                      return;
                    }
                    if (editing) {
                      setUploading(true);
                      try {
                        const updated = await adminApi.uploadProductMedia(editing.id, file, true);
                        setEditing(updated);
                        await load();
                        toast.success("Đã tải ảnh lên");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Upload thất bại");
                      } finally {
                        setUploading(false);
                      }
                    } else {
                      setPendingFile(file);
                      setPendingPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
            </div>

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
                <p className="truncate text-[11px] text-muted-foreground">Đã chọn: {selectedCategoryLabel}</p>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Chỉ gắn được danh mục lá (không còn mục con).</p>
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
                              selected ? "border-foreground bg-foreground" : "border-muted-foreground/40",
                            )}
                          >
                            {selected ? <span className="size-1.5 rounded-full bg-background" /> : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate">{c.name}</span>
                            <span className="block truncate font-mono text-[10px] text-muted-foreground">{c.slug}</span>
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
          <div key={m.label} className={cn("rounded-md border p-5", i === 0 ? "border-accent bg-accent/25" : "border-border")}>
            <p className="section-label">{m.label}</p>
            <p className="mt-3 font-serif text-3xl">{m.value}</p>
            <p className={cn("mt-1 text-xs", i === 0 ? "text-primary" : "text-muted-foreground")}>{m.note}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {(
              [
                ["all", "Tất cả"],
                ["published", "Đang bán"],
                ["draft", "Bản nháp"],
                ["archived", "Đã ẩn"],
              ] as const
            ).map(([id, label]) => (
              <Button key={id} variant={tab === id ? "default" : "ghost"} size="sm" onClick={() => setTab(id)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Tìm sản phẩm…" />
          </div>
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
            <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
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
                {["Ảnh", "Sản phẩm", "Danh mục", "Size", "Tồn", "Giá bán", "SKU", "Trạng thái", ""].map((c) => (
                  <th key={c || "a"} className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const thumb = productImageUrl(p.images?.[0] ?? p.media?.[0]?.url);
                const checked = selected.has(p.id);
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
                    {idx + 1}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-20 w-16 overflow-hidden rounded-sm border border-border bg-secondary/40">
                      {thumb ? (
                        <img src={thumb} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="grid h-full place-items-center text-[9px] text-muted-foreground">N/A</div>
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
                      <Button variant="ghost" size="icon" aria-label={`Sá»­a ${p.name}`} onClick={() => openEdit(p)}>
                        <MoreHorizontal />
                      </Button>
                      {p.status !== "archived" && (
                        <Button variant="ghost" size="icon" aria-label={`Ẩn ${p.name}`} onClick={() => remove(p)}>
                          <Archive className="size-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" aria-label={`Xóa ${p.name}`} onClick={() => destroy(p)}>
                        <Trash2 className="size-4 text-primary" />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="grid h-48 place-items-center text-sm text-muted-foreground">Không tìm thấy sản phẩm.</div>
          )}
          {loading && <div className="grid h-48 place-items-center text-sm text-muted-foreground">Đang tải…</div>}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            Hiển thị {filtered.length} mục
            {selectedCount > 0 ? ` · đã chọn ${selectedCount}` : ""}
          </span>
        </div>
      </section>


      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[11px] text-muted-foreground">
        <span>© 2026 ÉLANE · Modern Femininity</span>
        <span>Sản phẩm · CRUD Phase 1</span>
      </footer>
    </>
  );
}
