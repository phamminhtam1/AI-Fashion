import { adminErrorMessage } from "@/lib/admin-language";
import {
  Archive,
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  CornerDownRight,
  Folder,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { resolveAdminPath } from "@/lib/routes";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { adminApi, type Category } from "@/lib/api";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type FormState = {
  name: string;
  slug: string;
  description: string;
  sort_order: string;
  status: "active" | "archived";
  parent_id: string;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  sort_order: "",
  status: "active",
  parent_id: "",
};

const DESC_MAX = 500;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

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

function descendantIds(items: Category[], rootId: string): Set<string> {
  const out = new Set<string>();
  const walk = (id: string) => {
    for (const c of items.filter((x) => x.parent_id === id)) {
      out.add(c.id);
      walk(c.id);
    }
  };
  walk(rootId);
  return out;
}

function parentOptions(items: Category[], editingId: string | null) {
  const blocked = editingId ? descendantIds(items, editingId) : new Set<string>();
  if (editingId) blocked.add(editingId);
  return items.filter((c) => !blocked.has(c.id));
}

/** Ẩn các mục có tổ tiên đang được thu gọn */
function hideCollapsed(list: Category[], all: Category[], collapsed: Set<string>) {
  return list.filter((cat) => {
    let pid = cat.parent_id;
    while (pid) {
      if (collapsed.has(pid)) return false;
      pid = all.find((x) => x.id === pid)?.parent_id ?? null;
    }
    return true;
  });
}

/** Ảnh danh mục (nếu API có trả về) */
function categoryImage(cat: Category): string | null {
  const c = cat as Category & { image_url?: string | null; image?: string | null };
  return c.image_url ?? c.image ?? null;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

type AdvancedFilter = {
  hasProducts: "" | "with" | "empty";
  depthLevel: "" | "root" | "sub" | "leaf";
  sortBy: "name_asc" | "product_count_desc" | "sort_order" | "status";
};

const emptyAdvancedFilter: AdvancedFilter = {
  hasProducts: "",
  depthLevel: "",
  sortBy: "sort_order",
};

function Thumb({ cat, className }: { cat: Category; className?: string }) {
  const src = categoryImage(cat);
  return src ? (
    <img
      src={src}
      alt={cat.name}
      className={cn("size-10 shrink-0 rounded-md border border-border/60 object-cover", className)}
    />
  ) : (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-md border border-border/60 bg-secondary/60 text-muted-foreground",
        className,
      )}
    >
      {!cat.parent_id && (cat.child_count ?? 0) === 0 ? (
        <Tag className="size-4" />
      ) : (
        <Folder className="size-4" />
      )}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-sm font-semibold",
        active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60" : "bg-slate-100 text-slate-600 border border-slate-200",
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-500" : "bg-slate-400")} />
      {active ? "Hiển thị" : "Đã lưu trữ"}
    </span>
  );
}

/** Card section dùng trong form (tiêu đề + đường kẻ + nội dung) */
function FormCard({
  title,
  children,
  headerAction,
  bodyClassName,
}: {
  title: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="overflow-hidden rounded-xs border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className=" admin-section-title">{title}</h2>
        {headerAction}
      </div>
      <div className={cn("p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-medium">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </span>
  );
}

export function CategoriesManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const route = resolveAdminPath(location.pathname);

  const [items, setItems] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "active" | "archived">("all");
  const [advFilter, setAdvFilter] = useState<AdvancedFilter>(emptyAdvancedFilter);
  const [draftAdv, setDraftAdv] = useState<AdvancedFilter>(emptyAdvancedFilter);
  const [draftTab, setDraftTab] = useState<"all" | "active" | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedSeeded, setCollapsedSeeded] = useState(false);
  // Cây danh mục bên trái: mặc định mở hết
  const [treeCollapsed, setTreeCollapsed] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  // Form: ảnh, slug thủ công, card "Thông tin bổ sung", kéo thả
  const [image, setImage] = useState<string | null>(null);
  const [imageDirty, setImageDirty] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [infoOpen, setInfoOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.categories("all");
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không tải được danh mục");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mặc định: thu gọn các mục cha trong bảng
  useEffect(() => {
    if (collapsedSeeded || items.length === 0) return;
    const parents = items.filter((c) => (c.child_count ?? 0) > 0).map((c) => c.id);
    if (parents.length) setCollapsed(new Set(parents));
    setCollapsedSeeded(true);
  }, [items, collapsedSeeded]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, query, advFilter]);

  // Chọn trong cây -> mở các cha trong bảng và cuộn tới dòng tương ứng
  useEffect(() => {
    if (!focusId) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      let pid = items.find((x) => x.id === focusId)?.parent_id ?? null;
      while (pid) {
        next.delete(pid);
        pid = items.find((x) => x.id === pid)?.parent_id ?? null;
      }
      return next;
    });
    const t = setTimeout(() => {
      document.getElementById(`cat-row-${focusId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
    return () => clearTimeout(t);
  }, [focusId, items]);

  const advFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (tab !== "all") {
      chips.push({
        key: "status",
        label: tab === "active" ? "Đang hiển thị" : "Đã lưu trữ",
        clear: () => setTab("all"),
      });
    }
    if (advFilter.hasProducts) {
      chips.push({
        key: "hp",
        label: advFilter.hasProducts === "with" ? "Có sản phẩm" : "Không có SP",
        clear: () => setAdvFilter((f) => ({ ...f, hasProducts: "" })),
      });
    }
    if (advFilter.depthLevel) {
      const labels: Record<string, string> = { root: "Danh mục gốc", sub: "Danh mục con", leaf: "Danh mục lá" };
      chips.push({
        key: "depth",
        label: labels[advFilter.depthLevel] ?? advFilter.depthLevel,
        clear: () => setAdvFilter((f) => ({ ...f, depthLevel: "" })),
      });
    }
    if (advFilter.sortBy !== "sort_order") {
      const labels: Record<string, string> = { name_asc: "Tên A→Z", product_count_desc: "Nhiều SP nhất", status: "Trạng thái" };
      chips.push({
        key: "sort",
        label: `Sắp xếp: ${labels[advFilter.sortBy] ?? advFilter.sortBy}`,
        clear: () => setAdvFilter((f) => ({ ...f, sortBy: "sort_order" })),
      });
    }
    return chips;
  }, [advFilter, tab]);

  const filtered = useMemo(() => {
    let list = items;
    if (tab === "active") list = list.filter((c) => c.status === "active");
    if (tab === "archived") list = list.filter((c) => c.status === "archived");
    if (advFilter.hasProducts === "with") list = list.filter((c) => (c.product_count ?? 0) > 0);
    if (advFilter.hasProducts === "empty") list = list.filter((c) => (c.product_count ?? 0) === 0);
    if (advFilter.depthLevel === "root") list = list.filter((c) => !c.parent_id);
    if (advFilter.depthLevel === "sub") list = list.filter((c) => !!c.parent_id && (c.child_count ?? 0) > 0);
    if (advFilter.depthLevel === "leaf") list = list.filter((c) => c.is_leaf);
    if (advFilter.sortBy === "name_asc") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    else if (advFilter.sortBy === "product_count_desc") list = [...list].sort((a, b) => (b.product_count ?? 0) - (a.product_count ?? 0));
    else if (advFilter.sortBy === "status") list = [...list].sort((a, b) => a.status.localeCompare(b.status));
    const q = query.trim().toLowerCase();
    if (q) {
      return list.filter((c) => `${c.name} ${c.slug}`.toLowerCase().includes(q));
    }
    return hideCollapsed(list, items, collapsed);
  }, [items, tab, query, collapsed, advFilter]);

  const treeItems = useMemo(() => hideCollapsed(items, items, treeCollapsed), [items, treeCollapsed]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someFilteredSelected = filtered.some((c) => selected.has(c.id));
  const selectedCount = filtered.filter((c) => selected.has(c.id)).length;

  function openCreateInternal(parentId?: string | null) {
    setEditing(null);
    setForm({ ...emptyForm, parent_id: parentId ?? "" });
    setImage(null);
    setImageDirty(false);
    setSlugTouched(false);
    setView("form");
  }

  function openEditInternal(cat: Category) {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      sort_order: String(cat.sort_order),
      status: cat.status === "archived" ? "archived" : "active",
      parent_id: cat.parent_id ?? "",
    });
    setImage(categoryImage(cat));
    setImageDirty(false);
    setSlugTouched(true);
    setView("form");
  }

  function backToListInternal() {
    setView("list");
    setEditing(null);
    setForm(emptyForm);
    setImage(null);
    setImageDirty(false);
  }

  function openCreate(parentId?: string | null) {
    openCreateInternal(parentId);
    navigate({ to: "/danhmuc/them" });
  }

  function openEdit(cat: Category) {
    openEditInternal(cat);
    navigate({ to: `/danhmuc/sua/${cat.id}` });
  }

  function backToList() {
    backToListInternal();
    navigate({ to: "/danhmuc" });
  }

  // Đồng bộ state với URL
  useEffect(() => {
    if (route.tabId === "categories") {
      if (route.action === "create") {
        if (view !== "form" || editing !== null) {
          openCreateInternal();
        }
      } else if (route.action === "edit" || (route.subParam && route.subParam !== "them")) {
        const param = route.subParam;
        if (param && items.length > 0) {
          const match = items.find(
            (c) => c.id === param || c.slug.toLowerCase() === param.toLowerCase()
          );
          if (match && editing?.id !== match.id) {
            openEditInternal(match);
          }
        }
      } else {
        if (view !== "list") {
          backToListInternal();
        }
      }
    }
  }, [route.tabId, route.action, route.subParam, items]);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTree(id: string) {
    setTreeCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function pickImage(file?: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      toast.error("Chỉ hỗ trợ ảnh PNG, JPG, WEBP hoặc GIF");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast.error("Ảnh tối đa 5MB");
      return;
    }
    setUploadingImage(true);
    try {
      const res = await adminApi.uploadCategoryMedia(file);
      setImage(res.url);
      setImageDirty(true);
      toast.success("Đã tải ảnh đại diện lên");
    } catch (err: unknown) {
      // Fallback preview local nếu upload API chưa phản hồi
      const reader = new FileReader();
      reader.onload = () => {
        setImage(String(reader.result));
        setImageDirty(true);
      };
      reader.readAsDataURL(file);
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Tải ảnh lên máy chủ thất bại, sử dụng ảnh tạm thời");
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage() {
    setImage(null);
    setImageDirty(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Đã sao chép ID");
    } catch {
      toast.error("Không sao chép được");
    }
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Nhập tên danh mục");
      return;
    }
    setSaving(true);
    try {
      // ponytail: omit optionals when empty — exactOptionalPropertyTypes rejects `prop?: T` assigned `T | undefined`
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        parent_id: form.parent_id || null,
        slug: form.slug.trim() || slugify(form.name),
        ...(form.sort_order ? { sort_order: Number(form.sort_order) } : {}),
        ...(imageDirty ? { image_url: image || null } : {}),
      };
      if (editing) {
        await adminApi.updateCategory(editing.id, payload);
        toast.success("Đã cập nhật danh mục");
      } else {
        await adminApi.createCategory(payload);
        toast.success("Đã thêm danh mục");
      }
      backToList();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function archive(cat: Category) {
    if (cat.status === "archived") {
      toast.message("Danh mục đã được lưu trữ");
      return;
    }
    const kids = cat.child_count ?? 0;
    const ok = await confirm({
      title: "Ẩn / lưu trữ danh mục?",
      description:
        kids > 0
          ? `"${cat.name}" và ${kids} danh mục con sẽ không còn hiện trên cửa hàng trực tuyến. Sản phẩm gắn kèm vẫn giữ nguyên.`
          : `"${cat.name}" sẽ không còn hiện trên cửa hàng trực tuyến. Sản phẩm gắn kèm vẫn giữ nguyên.`,
      confirmLabel: "Lưu trữ",
    });
    if (!ok) return;
    try {
      await adminApi.deleteCategory(cat.id, false);
      toast.success("Đã lưu trữ danh mục");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(cat.id);
        return next;
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Lưu trữ thất bại");
    }
  }

  async function destroy(cat: Category) {
    const ok = await confirm({
      title: "Xóa vĩnh viễn?",
      description:
        cat.product_count > 0 || (cat.child_count ?? 0) > 0
          ? `"${cat.name}" (và nhánh con nếu có) đang gắn sản phẩm hoặc còn con — API sẽ từ chối nếu nhánh còn SP. Xóa cả nhánh khi trống.`
          : `Xóa vĩnh viễn "${cat.name}" và toàn bộ danh mục con? Không hoàn tác.`,
      confirmLabel: cat.product_count > 0 ? "Thử xóa" : "Xóa vĩnh viễn",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteCategory(cat.id, true);
      toast.success("Đã xóa danh mục");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(cat.id);
        return next;
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Xóa thất bại");
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
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const c of filtered) next.delete(c.id);
      } else {
        for (const c of filtered) next.add(c.id);
      }
      return next;
    });
  }

  async function bulkArchive() {
    const targets = filtered.filter((c) => selected.has(c.id) && c.status !== "archived");
    if (!targets.length) {
      toast.message("Không có danh mục nào cần ẩn trong lựa chọn.");
      return;
    }
    const ok = await confirm({
      title: "Ẩn hàng loạt?",
      description: `Lưu trữ ${targets.length} danh mục đã chọn (kèm nhánh con)?`,
      confirmLabel: `Ẩn ${targets.length}`,
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      let n = 0;
      for (const c of targets) {
        await adminApi.deleteCategory(c.id, false);
        n += 1;
      }
      toast.success(`Đã lưu trữ ${n} danh mục`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Ẩn hàng loạt thất bại");
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDestroy() {
    const targets = filtered.filter((c) => selected.has(c.id));
    if (!targets.length) return;
    const ok = await confirm({
      title: "Xóa vĩnh viễn hàng loạt?",
      description: `Xóa ${targets.length} danh mục (kèm nhánh con nếu trống SP)? Mục còn SP sẽ báo lỗi.`,
      confirmLabel: `Xóa ${targets.length}`,
      destructive: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      let n = 0;
      for (const c of targets) {
        try {
          await adminApi.deleteCategory(c.id, true);
          n += 1;
        } catch {
          /* continue */
        }
      }
      toast.success(n ? `Đã xóa ${n} danh mục` : "Không xóa được mục nào");
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Xóa hàng loạt thất bại");
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* FORM VIEW — theo design: header + các card section                  */
  /* ------------------------------------------------------------------ */
  if (view === "form") {
    const meta = editing as (Category & { created_at?: string | null; updated_at?: string | null }) | null;
    const inputCls = "mt-2 h-9 rounded-xs border-border/70 bg-white px-3.5 text-sm";

    return (
      <div className="space-y-5 font-sans pb-12">
        {confirmDialog}

        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-8.5 rounded-xs border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              onClick={backToList}
              aria-label="Quay lại danh mục"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-slate-900 admin-page-title">
                {editing ? "Chỉnh sửa danh mục" : "Tạo danh mục mới"}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {editing ? "Cập nhật thông tin danh mục sản phẩm" : "Thêm danh mục sản phẩm mới vào hệ thống"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-xs border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              onClick={backToList}
            >
              Hủy
            </Button>
            <Button
              className="h-9 gap-1.5 rounded-xs bg-[#6d3df0] px-4 text-sm font-medium text-white shadow-xs hover:bg-[#5a2fd6] transition-colors disabled:opacity-60 cursor-pointer"
              disabled={saving}
              onClick={save}
            >
              <Check className="size-3.5" />
              <span>{saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo danh mục"}</span>
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {/* Thông tin cơ bản */}
          <FormCard title="Thông tin cơ bản">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <FieldLabel required>Tên danh mục</FieldLabel>
                <Input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      slug: slugTouched ? f.slug : slugify(name),
                    }));
                  }}
                  placeholder="Nhập tên danh mục"
                />
                <span className="mt-1.5 block text-sm text-muted-foreground">
                  Ví dụ: Dresses, Outerwear, Bags…
                </span>
              </label>

              <label className="block">
                <FieldLabel required>Đường dẫn</FieldLabel>
                <Input
                  className={inputCls}
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((f) => ({ ...f, slug: e.target.value }));
                  }}
                  placeholder="Nhập đường dẫn danh mục"
                />
                <span className="mt-1.5 block text-sm text-muted-foreground">
                  {editing
                    ? `Dùng trong URL: /collections/${form.slug || "…"}`
                    : "Tự động tạo từ tên danh mục, dùng trong URL"}
                </span>
              </label>
            </div>

            <label className="mt-5 block">
              <FieldLabel>Mô tả</FieldLabel>
              <textarea
                className="mt-2 min-h-28 w-full resize-y rounded-xs border border-input bg-white p-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                value={form.description}
                maxLength={DESC_MAX}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Nhập mô tả danh mục (tùy chọn)"
              />
              <span className="mt-1.5 block text-right text-sm text-muted-foreground">
                {form.description.length}/{DESC_MAX}
              </span>
            </label>
          </FormCard>

          {/* Danh mục cha */}
          <FormCard title="Danh mục cha">
            <label className="block">
              <FieldLabel>Danh mục cha</FieldLabel>
              <div className="relative mt-2">
                <select
                  className="h-9 w-full appearance-none rounded-xs border border-input bg-white px-3 pr-10 text-sm outline-none focus:ring-1 focus:ring-ring"
                  value={form.parent_id}
                  onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
                >
                  <option value="">Không có (Danh mục gốc)</option>
                  {parentOptions(items, editing?.id ?? null).map((c) => {
                    const d = c.depth ?? 0;
                    return (
                      <option key={c.id} value={c.id}>
                        {"\u00A0\u00A0\u00A0".repeat(d)}
                        {d > 0 ? "↳ " : ""}
                        {c.name}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
              <span className="mt-1.5 block text-sm text-muted-foreground">
                Chọn danh mục cha nếu đây là danh mục con
              </span>
            </label>
          </FormCard>

          {/* Hình ảnh */}
          <FormCard title="Hình ảnh">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
              <div>
                <FieldLabel>Ảnh đại diện</FieldLabel>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => pickImage(e.target.files?.[0])}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !uploadingImage && fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!uploadingImage) fileRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!uploadingImage) setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (!uploadingImage) pickImage(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "mt-2 flex h-40 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xs border border-dashed px-4 text-center transition-colors",
                    dragOver ? "border-primary bg-accent/30" : "border-border bg-white hover:bg-secondary/30",
                    uploadingImage && "opacity-70 cursor-wait",
                  )}
                >
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <span className="text-sm font-medium text-foreground">Đang tải ảnh lên máy chủ…</span>
                    </div>
                  ) : image ? (
                    <div className="relative">
                      <img src={image} alt="Ảnh đại diện" className="size-[72px] rounded-xs object-cover border border-border/70" />
                      <button
                        type="button"
                        aria-label="Xóa ảnh"
                        className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full border border-border bg-white text-foreground shadow-sm hover:bg-secondary cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage();
                        }}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="grid size-9 place-items-center rounded-full bg-secondary/70 text-muted-foreground">
                      <Upload className="size-4" />
                    </span>
                  )}
                  {!uploadingImage && (
                    <span className="text-sm text-muted-foreground">
                      Kéo thả ảnh vào đây hoặc click để tải lên
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Hoặc nhập URL hình ảnh trực tiếp:
                  </label>
                  <Input
                    type="url"
                    value={image || ""}
                    onChange={(e) => {
                      setImage(e.target.value.trim() || null);
                      setImageDirty(true);
                    }}
                    placeholder="https://... (ảnh đại diện cho danh mục)"
                    className="h-9 rounded-xs text-sm"
                  />
                </div>

                <span className="mt-2 block text-sm text-muted-foreground">
                  PNG, JPG, WEBP hoặc GIF. Kích thước tối đa 5MB. Tỷ lệ khuyến nghị 1:1.
                </span>
              </div>

              <div>
                <FieldLabel>Xem trước</FieldLabel>
                <div className="mt-2 grid h-40 place-items-center overflow-hidden rounded-xs bg-secondary/50 border border-border/50">
                  {image ? (
                    <img src={image} alt="Xem trước" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-9 text-muted-foreground/50" strokeWidth={1.25} />
                  )}
                </div>
              </div>
            </div>
          </FormCard>

          {/* Hiển thị */}
          <FormCard title="Hiển thị">
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.status === "active"}
                aria-label="Hiển thị danh mục này"
                onClick={() =>
                  setForm((f) => ({ ...f, status: f.status === "active" ? "archived" : "active" }))
                }
                className={cn(
                  "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  form.status === "active" ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "inline-block size-5 rounded-full bg-white shadow transition-transform",
                    form.status === "active" ? "translate-x-[22px]" : "translate-x-0.5",
                  )}
                />
              </button>
              <div>
                <p className="text-sm font-medium">Hiển thị danh mục này</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Danh mục sẽ hiển thị trên trang web và trong hệ thống
                </p>
              </div>
            </div>
          </FormCard>

          {/* Thông tin bổ sung (chỉ khi chỉnh sửa) */}
          {editing && (
            <FormCard
              title="Thông tin bổ sung"
              bodyClassName="p-0"
              headerAction={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={infoOpen ? "Thu gọn" : "Mở rộng"}
                  aria-expanded={infoOpen}
                  onClick={() => setInfoOpen((v) => !v)}
                >
                  {infoOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </Button>
              }
            >
              {infoOpen && (
                <div className="grid text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <dl className="space-y-3 p-6">
                    <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                      <dt className="text-muted-foreground">ID</dt>
                      <dd className="flex min-w-0 items-center gap-2">
                        <span className="truncate tabular-nums text-sm">{editing.id}</span>
                        <button
                          type="button"
                          aria-label="Sao chép ID"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => copyId(editing.id)}
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </dd>
                    </div>
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="text-muted-foreground">Ngày tạo</dt>
                      <dd>{formatDateTime(meta?.created_at)}</dd>
                    </div>
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="text-muted-foreground">Ngày cập nhật</dt>
                      <dd>{formatDateTime(meta?.updated_at)}</dd>
                    </div>
                  </dl>
                  <dl className="space-y-3 border-t border-border p-6 md:border-l md:border-t-0">
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <dt className="text-muted-foreground">Số sản phẩm</dt>
                      <dd className="tabular-nums">{editing.product_count ?? 0}</dd>
                    </div>
                    <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                      <dt className="text-muted-foreground">Trạng thái</dt>
                      <dd
                        className={cn(
                          "inline-flex items-center gap-1.5 text-sm",
                          editing.status === "active" ? "text-emerald-600" : "text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            editing.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/50",
                          )}
                        />
                        {editing.status === "active" ? "Đang hiển thị" : "Đã lưu trữ"}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </FormCard>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* LIST VIEW — theo design: header + cây danh mục + bảng               */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-5 font-sans pb-12">
      {confirmDialog}

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-slate-900 admin-page-title">Danh mục</h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-sm font-semibold">Sắp xếp danh mục sản phẩm cho cửa hàng của bạn.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            onClick={() => {
              setAdvFilter(emptyAdvancedFilter);
              setDraftAdv(emptyAdvancedFilter);
              toast.message("Đang xem theo thứ tự mặc định");
            }}
          >
            <ArrowUpDown className="size-3.5" />
            <span>Sắp xếp lại</span>
          </Button>
          <Button asChild className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-3.5 text-sm font-semibold text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer">
            <a
              href="/danhmuc/them"
              onClick={(e) => {
                e.preventDefault();
                openCreate();
              }}
            >
              <Plus className="size-3.5" />
              <span>Thêm danh mục</span>
            </a>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ============ Category tree ============ */}
        <aside className="rounded-xs border border-border bg-card">
          <div className="flex items-center justify-between px-5 pb-2 pt-5">
            <h2 className="text-slate-950 admin-section-title">Cây danh mục</h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Tùy chọn cây">
                  <MoreVertical className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 p-1">
                <button
                  type="button"
                  className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
                  onClick={() => setTreeCollapsed(new Set())}
                >
                  Mở rộng tất cả
                </button>
                <button
                  type="button"
                  className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-secondary"
                  onClick={() =>
                    setTreeCollapsed(new Set(items.filter((c) => (c.child_count ?? 0) > 0).map((c) => c.id)))
                  }
                >
                  Thu gọn tất cả
                </button>
              </PopoverContent>
            </Popover>
          </div>

          <nav className="max-h-[calc(100vh-14rem)] overflow-y-auto px-3 pb-4">
            {loading && <p className="px-3 py-6 text-sm text-muted-foreground">Đang tải…</p>}
            {treeItems.map((cat) => {
              const depth = cat.depth ?? 0;
              const hasKids = (cat.child_count ?? 0) > 0;
              const open = !treeCollapsed.has(cat.id);
              const active = focusId === cat.id;
              const Icon = !hasKids && depth === 0 ? Tag : Folder;
              return (
                <div key={cat.id} className="relative">
                  {depth > 0 && (
                    <span
                      aria-hidden
                      className="absolute bottom-0 top-0 w-px bg-border"
                      style={{ left: 22 + (depth - 1) * 24 }}
                    />
                  )}
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-md py-2 pr-3 text-sm transition-colors",
                      active ? "bg-accent/60 font-medium text-foreground" : "text-foreground/85 hover:bg-secondary/60",
                      archivedClass(cat),
                    )}
                    style={{ paddingLeft: 8 + depth * 20 }}
                  >
                    {hasKids ? (
                      <button
                        type="button"
                        aria-label={open ? "Thu gọn" : "Mở rộng"}
                        className="grid size-5 shrink-0 place-items-center rounded-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleTree(cat.id)}
                      >
                        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    ) : depth > 0 ? (
                      <div className="flex size-5 shrink-0 items-center justify-center text-muted-foreground/45">
                        <CornerDownRight className="size-3" />
                      </div>
                    ) : (
                      <span className="size-5 shrink-0" />
                    )}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      onClick={() => setFocusId(cat.id)}
                    >
                      {categoryImage(cat) ? (
                        <img
                          src={categoryImage(cat)!}
                          alt=""
                          className="size-4.5 shrink-0 rounded-xs object-cover border border-border/60"
                        />
                      ) : (
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className={cn("truncate text-sm", depth === 0 ? "font-semibold text-slate-950" : "font-semibold text-slate-800")}>{cat.name}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ============ Table card ============ */}
        <section className="min-w-0 overflow-hidden rounded-xs border border-border bg-card">
          {/* Toolbar */}
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 rounded-xs border-border/70 bg-white pl-9 pr-9 text-sm"
                  placeholder="Tìm danh mục theo tên hoặc đường dẫn…"
                />
                {query && (
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setQuery("")}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <Popover onOpenChange={(o) => o && (setDraftAdv(advFilter), setDraftTab(tab))}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Bộ lọc"
                    className={cn(
                      "relative size-10 shrink-0 rounded-lg border-border/70 bg-white",
                      advFilterChips.length > 0 && "border-primary/40 bg-accent/40",
                    )}
                  >
                    <SlidersHorizontal className="size-4" />
                    {advFilterChips.length > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex size-4 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {advFilterChips.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-0 shadow-xl">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold">Bộ lọc nâng cao</p>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium">Trạng thái</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([["all", "Tất cả"], ["active", "Hiển thị"], ["archived", "Lưu trữ"]] as const).map(([v, l]) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setDraftTab(v)}
                            className={cn(
                              "rounded-md border px-2 py-1.5 text-sm transition-colors",
                              draftTab === v
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
                      <span className="text-sm font-medium">Sản phẩm</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([["", "Tất cả"], ["with", "Có SP"], ["empty", "Không có"]] as const).map(([v, l]) => (
                          <button
                            key={v || "all"}
                            type="button"
                            onClick={() => setDraftAdv((f) => ({ ...f, hasProducts: v }))}
                            className={cn(
                              "rounded-md border px-2 py-1.5 text-sm transition-colors",
                              draftAdv.hasProducts === v
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
                      <span className="text-sm font-medium">Cấp danh mục</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([
                          ["", "Tất cả"],
                          ["root", "Gốc (cấp 1)"],
                          ["sub", "Có danh mục con"],
                          ["leaf", "Danh mục lá"],
                        ] as const).map(([v, l]) => (
                          <button
                            key={v || "all"}
                            type="button"
                            onClick={() => setDraftAdv((f) => ({ ...f, depthLevel: v }))}
                            className={cn(
                              "rounded-md border px-2 py-1.5 text-sm transition-colors",
                              draftAdv.depthLevel === v
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
                        className="h-8 w-full rounded-md border border-input bg-white px-3 text-sm outline-none"
                        value={draftAdv.sortBy}
                        onChange={(e) =>
                          setDraftAdv((f) => ({ ...f, sortBy: e.target.value as AdvancedFilter["sortBy"] }))
                        }
                      >
                        <option value="sort_order">Thứ tự mặc định</option>
                        <option value="name_asc">Tên A→Z</option>
                        <option value="product_count_desc">Nhiều sản phẩm nhất</option>
                        <option value="status">Trạng thái</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-border px-4 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDraftAdv(emptyAdvancedFilter);
                        setAdvFilter(emptyAdvancedFilter);
                        setDraftTab("all");
                        setTab("all");
                      }}
                    >
                      Xóa lọc
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setAdvFilter(draftAdv);
                        setTab(draftTab);
                      }}
                    >
                      Áp dụng
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {advFilterChips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {advFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-white px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/40"
                  >
                    {chip.label}
                    <X className="size-3 opacity-60" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setAdvFilter(emptyAdvancedFilter);
                    setDraftAdv(emptyAdvancedFilter);
                    setTab("all");
                  }}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Xóa tất cả
                </button>
              </div>
            )}
          </div>

          {/* Bulk actions */}
          {selectedCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
              <span className="text-sm font-medium">Đã chọn {selectedCount}</span>
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold tracking-tight text-slate-700">
                  <th className="w-12 px-4 py-3.5">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      className="size-4 rounded-xs accent-[#6941c6]"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                      }}
                      onChange={toggleAllFiltered}
                    />
                  </th>
                  <th className="px-2 py-3.5 text-sm font-semibold tracking-tight text-slate-700">Tên</th>
                  <th className="px-3 py-3.5 text-sm font-semibold tracking-tight text-slate-700">Đường dẫn</th>
                  <th className="px-3 py-3.5 text-sm font-semibold tracking-tight text-slate-700">Sản phẩm</th>
                  <th className="px-3 py-3.5 text-sm font-semibold tracking-tight text-slate-700">Hiển thị</th>
                  <th className="px-3 py-3.5 text-center text-sm font-semibold tracking-tight text-slate-700">Thứ tự</th>
                  <th className="px-4 py-3.5 text-center text-sm font-semibold tracking-tight text-slate-700">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat) => {
                  const checked = selected.has(cat.id);
                  const hasKids = (cat.child_count ?? 0) > 0;
                  const isCollapsed = collapsed.has(cat.id);
                  const depth = cat.depth ?? 0;
                  const archived = cat.status === "archived";
                  const focused = focusId === cat.id;
                  return (
                    <tr
                      key={cat.id}
                      id={`cat-row-${cat.id}`}
                      className={cn(
                        "group border-b border-border/70 transition-colors last:border-b-0",
                        checked || focused ? "bg-purple-50/40" : "hover:bg-slate-50/70",
                        archived && "opacity-60",
                      )}
                    >
                      <td className="px-4 py-2.5 align-middle">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${cat.name}`}
                          className="size-4 rounded-xs accent-[#6941c6]"
                          checked={checked}
                          onChange={() => toggleOne(cat.id)}
                        />
                      </td>
                      <td className="px-2 py-2.5 align-middle" style={{ paddingLeft: 8 + depth * 36 }}>
                        <div className="flex min-w-0 items-center gap-2.5">
                          {hasKids ? (
                            <button
                              type="button"
                              className="grid size-5 shrink-0 place-items-center rounded-xs text-muted-foreground hover:text-foreground transition-transform duration-200"
                              aria-label={isCollapsed ? "Mở rộng" : "Thu gọn"}
                              onClick={() => toggleCollapse(cat.id)}
                            >
                              {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                            </button>
                          ) : depth > 0 ? (
                            <div className="flex size-5 shrink-0 items-center justify-center text-muted-foreground/60">
                              <CornerDownRight className="size-3.5 text-muted-foreground/75" />
                            </div>
                          ) : (
                            <span className="size-5 shrink-0" />
                          )}
                          <Thumb cat={cat} className={depth > 0 ? "size-9" : undefined} />
                          <div className="min-w-0">
                            <a
                              href={`/danhmuc/sua/${cat.id}`}
                              className="block max-w-full truncate text-left text-sm font-semibold text-slate-950 hover:text-[#6941c6] hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                openEdit(cat);
                              }}
                            >
                              {cat.name}
                            </a>
                            <p className="mt-0.5 max-w-[16rem] truncate text-sm font-medium text-slate-600">
                              {cat.description || (hasKids ? `${cat.child_count} mục con` : "—")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-middle text-sm tabular-nums font-semibold text-slate-700">{cat.slug}</td>
                      <td className="px-3 py-2.5 align-middle tabular-nums text-sm font-semibold text-slate-950">
                        {cat.product_count ?? 0}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <StatusPill status={cat.status} />
                      </td>
                      <td className="px-3 py-2.5 text-center align-middle tabular-nums text-sm font-semibold text-slate-800">
                        {cat.sort_order}
                      </td>
                      <td className="px-4 py-2.5 text-center align-middle">
                        <Popover open={menuId === cat.id} onOpenChange={(o) => setMenuId(o ? cat.id : null)}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Thao tác với ${cat.name}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-52 p-1">
                            <MenuItem
                              icon={<Pencil className="size-3.5" />}
                              label="Chỉnh sửa"
                              onClick={() => {
                                setMenuId(null);
                                openEdit(cat);
                              }}
                            />
                            <MenuItem
                              icon={<Plus className="size-3.5" />}
                              label="Thêm danh mục con"
                              onClick={() => {
                                setMenuId(null);
                                openCreate(cat.id);
                              }}
                            />
                            {!archived && (
                              <MenuItem
                                icon={<Archive className="size-3.5" />}
                                label="Ẩn / lưu trữ"
                                onClick={() => {
                                  setMenuId(null);
                                  archive(cat);
                                }}
                              />
                            )}
                            <MenuItem
                              icon={<Trash2 className="size-3.5" />}
                              label="Xóa"
                              destructive
                              onClick={() => {
                                setMenuId(null);
                                destroy(cat);
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
            {!loading && filtered.length === 0 && (
              <div className="grid h-48 place-items-center text-sm text-muted-foreground">
                Không tìm thấy danh mục.
              </div>
            )}
            {loading && (
              <div className="grid h-48 place-items-center text-sm text-muted-foreground">Đang tải…</div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Hiển thị {filtered.length} / {items.length} danh mục
              {selectedCount > 0 ? ` · đã chọn ${selectedCount}` : ""}
            </span>
          </div>
        </section>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-xs text-muted-foreground">
        <span>© 2026 ÉLANE · Modern Femininity</span>
        <span>Danh mục · cây đa cấp</span>
      </footer>
    </div>
  );
}

function archivedClass(cat: Category) {
  return cat.status === "archived" ? "opacity-60" : "";
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