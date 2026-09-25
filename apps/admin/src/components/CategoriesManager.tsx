import { Archive, ChevronDown, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function CategoriesManager() {
  const [items, setItems] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "active" | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedSeeded, setCollapsedSeeded] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.categories("all");
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được danh mục");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Default: collapse all parents so list starts as roots only
  useEffect(() => {
    if (collapsedSeeded || items.length === 0) return;
    const parents = items.filter((c) => (c.child_count ?? 0) > 0).map((c) => c.id);
    if (parents.length) setCollapsed(new Set(parents));
    setCollapsedSeeded(true);
  }, [items, collapsedSeeded]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, query]);

  const filtered = useMemo(() => {
    let list = items;
    if (tab === "active") list = list.filter((c) => c.status === "active");
    if (tab === "archived") list = list.filter((c) => c.status === "archived");
    const q = query.trim().toLowerCase();
    if (q) {
      return list.filter((c) => `${c.name} ${c.slug}`.toLowerCase().includes(q));
    }
    return list.filter((cat) => {
      let pid = cat.parent_id;
      while (pid) {
        if (collapsed.has(pid)) return false;
        pid = items.find((x) => x.id === pid)?.parent_id ?? null;
      }
      return true;
    });
  }, [items, tab, query, collapsed]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someFilteredSelected = filtered.some((c) => selected.has(c.id));
  const selectedCount = filtered.filter((c) => selected.has(c.id)).length;

  const metrics = useMemo(
    () => [
      { label: "Tổng danh mục", value: String(items.length), note: "Tất cả trạng thái" },
      {
        label: "Đang hiển thị",
        value: String(items.filter((c) => c.status === "active").length),
        note: "Public storefront",
      },
      {
        label: "Đã ẩn / lưu trữ",
        value: String(items.filter((c) => c.status === "archived").length),
        note: "Không còn trên menu",
      },
    ],
    [items],
  );

  function openCreate(parentId?: string | null) {
    setEditing(null);
    setForm({ ...emptyForm, parent_id: parentId ?? "" });
    setView("form");
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      sort_order: String(cat.sort_order),
      status: cat.status === "archived" ? "archived" : "active",
      parent_id: cat.parent_id ?? "",
    });
    setView("form");
  }

  function backToList() {
    setView("list");
    setEditing(null);
    setForm(emptyForm);
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
        ...(form.sort_order ? { sort_order: Number(form.sort_order) } : {}),
      };
      if (editing) {
        await adminApi.updateCategory(editing.id, payload);
        toast.success("Đã cập nhật danh mục");
      } else {
        await adminApi.createCategory(payload);
        toast.success("Đã thêm danh mục");
      }
      setView("list");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
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
          ? `"${cat.name}" và ${kids} danh mục con sẽ không còn hiện trên storefront. Sản phẩm gắn kèm vẫn giữ nguyên.`
          : `"${cat.name}" sẽ không còn hiện trên storefront. Sản phẩm gắn kèm vẫn giữ nguyên.`,
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
      toast.error(e instanceof Error ? e.message : "Lưu trữ thất bại");
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
        for (const c of filtered) next.delete(c.id);
        return next;
      }
      const next = new Set(prev);
      for (const c of filtered) next.add(c.id);
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
      toast.error(e instanceof Error ? e.message : "Ẩn hàng loạt thất bại");
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
      toast.error(e instanceof Error ? e.message : "Xóa hàng loạt thất bại");
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
            Danh mục
          </button>
          <span aria-hidden>›</span>
          <span className="text-foreground">
            {editing
              ? `Chỉnh sửa danh mục${editing.name ? ` · ${editing.name}` : ""}`
              : "Thêm danh mục"}
          </span>
        </nav>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="section-label text-primary">{editing ? "Chỉnh sửa" : "Tạo mới"}</p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl">
              {editing ? editing.name : "Thêm danh mục"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {editing
                ? "Cập nhật tên, danh mục cha và trạng thái hiển thị."
                : "Thêm danh mục gốc trên menu hoặc danh mục con trong cây."}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={backToList}>
              Quay lại
            </Button>
            <Button disabled={saving} onClick={save}>
              {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo danh mục"}
            </Button>
          </div>
        </div>

        <section className="mt-8 grid gap-8 border-t border-border pt-8 lg:grid-cols-2">
          <div className="space-y-6">
            <label className="block">
              <span className="text-xs font-medium">Tên danh mục</span>
              <Input
                className="mt-2"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
                    name,
                    slug: editing ? f.slug : slugify(name),
                  }));
                }}
                placeholder="Ví dụ: Áo sơ mi"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium">Slug</span>
              <Input
                className="mt-2 font-mono text-sm"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="ao-so-mi"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium">Mô tả</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-input bg-[#f7f4ef] p-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả ngắn…"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium">Thứ tự</span>
                <Input
                  className="mt-2"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  placeholder="Tự động"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium">Trạng thái</span>
                <select
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-[#f7f4ef] px-3 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as "active" | "archived" }))
                  }
                >
                  <option value="active">Đang hiển thị</option>
                  <option value="archived">Đã lưu trữ</option>
                </select>
              </label>
            </div>

            <div className="flex gap-2 border-t border-border pt-6">
              <Button disabled={saving} onClick={save}>
                {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo danh mục"}
              </Button>
              <Button variant="outline" onClick={backToList}>
                Hủy
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium">Danh mục cha</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Chọn gốc để hiện trên menu chính; chọn cha để tạo danh mục con bên dưới.
            </p>
            <div className="mt-2 max-h-[28rem] overflow-y-auto rounded-md border border-border lg:max-h-[calc(100vh-22rem)]">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, parent_id: "" }))}
                className={cn(
                  "flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-sm transition-colors",
                  !form.parent_id ? "bg-accent/40 font-medium" : "hover:bg-secondary/50",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full border",
                    !form.parent_id
                      ? "border-foreground bg-foreground"
                      : "border-muted-foreground/40",
                  )}
                >
                  {!form.parent_id ? (
                    <span className="size-1.5 rounded-full bg-background" />
                  ) : null}
                </span>
                <span>
                  <span className="block">Gốc (menu chính)</span>
                  <span className="text-[11px] text-muted-foreground">Không có danh mục cha</span>
                </span>
              </button>
              {parentOptions(items, editing?.id ?? null).map((c) => {
                const selected = form.parent_id === c.id;
                const depth = c.depth ?? 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, parent_id: c.id }))}
                    className={cn(
                      "flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left text-sm last:border-b-0 transition-colors",
                      selected ? "bg-accent/40 font-medium" : "hover:bg-secondary/50",
                    )}
                    style={{ paddingLeft: 12 + depth * 16 }}
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
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {c.slug}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[11px] text-muted-foreground">
          <span>© 2026 ÉLANE · Modern Femininity</span>
          <span>Danh mục · form</span>
        </footer>
      </>
    );
  }

  return (
    <>
      {confirmDialog}
      <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label text-primary">Cấu trúc cửa hàng</p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus /> Thêm danh mục
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
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {(
              [
                ["all", "Tất cả"],
                ["active", "Đang hiển thị"],
                ["archived", "Đã lưu trữ"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                variant={tab === id ? "default" : "ghost"}
                size="sm"
                onClick={() => setTab(id)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              placeholder="Tìm danh mục…"
            />
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
            <span className="text-xs font-medium">Đã chọn {selectedCount}</span>
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
          <table className="w-full min-w-[640px] text-left text-sm">
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
                <th className="px-3 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Danh mục
                </th>
                <th className="w-24 px-3 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  SP
                </th>
                <th className="w-16 px-3 py-3 text-right text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  TT
                </th>
                <th className="w-28 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((cat) => {
                const checked = selected.has(cat.id);
                const hasKids = (cat.child_count ?? 0) > 0;
                const isCollapsed = collapsed.has(cat.id);
                const depth = cat.depth ?? 0;
                const isRootGroup = depth === 0 && hasKids;
                const archived = cat.status === "archived";
                return (
                  <tr
                    key={cat.id}
                    className={cn(
                      "group border-t border-border/70 transition-colors",
                      isRootGroup && "bg-secondary/40",
                      !isRootGroup && depth > 0 && "bg-background",
                      checked && "bg-accent/25",
                      !checked && "hover:bg-secondary/30",
                      archived && "opacity-60",
                    )}
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${cat.name}`}
                        checked={checked}
                        onChange={() => toggleOne(cat.id)}
                      />
                    </td>
                    <td
                      className="py-2.5 pr-3 align-middle"
                      style={{ paddingLeft: 8 + depth * 20 }}
                    >
                      <div className="flex min-w-0 items-start gap-1.5">
                        {hasKids ? (
                          <button
                            type="button"
                            className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                            aria-label={isCollapsed ? "Mở rộng" : "Thu gọn"}
                            onClick={() => toggleCollapse(cat.id)}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="size-4" />
                            ) : (
                              <ChevronDown className="size-4" />
                            )}
                          </button>
                        ) : (
                          <span
                            className="mt-2 ml-2.5 size-1.5 shrink-0 rounded-full bg-border"
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            className={cn(
                              "block max-w-full truncate text-left hover:underline",
                              isRootGroup || hasKids
                                ? "font-semibold tracking-tight"
                                : "font-normal",
                            )}
                            onClick={() => openEdit(cat)}
                          >
                            {cat.name}
                          </button>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                            {cat.slug}
                            {hasKids ? ` · ${cat.child_count} mục con` : ""}
                            {archived ? " · đã lưu trữ" : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground align-middle">
                      {cat.is_leaf ? cat.product_count : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground align-middle">
                      {String(cat.sort_order).padStart(2, "0")}
                    </td>
                    <td className="px-2 py-2.5 align-middle">
                      <div
                        className={cn(
                          "flex justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100",
                          hasKids && "opacity-100",
                        )}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Thêm con ${cat.name}`}
                          onClick={() => openCreate(cat.id)}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                        {cat.status !== "archived" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Ẩn ${cat.name}`}
                            onClick={() => archive(cat)}
                          >
                            <Archive className="size-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Xóa ${cat.name}`}
                          onClick={() => destroy(cat)}
                        >
                          <Trash2 className="size-3.5 text-primary" />
                        </Button>
                      </div>
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
            <div className="grid h-48 place-items-center text-sm text-muted-foreground">
              Đang tải…
            </div>
          )}
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
        <span>Danh mục · cây đa cấp</span>
      </footer>
    </>
  );
}
