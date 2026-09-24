import { MoreHorizontal, Palette, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi, type ColorRow } from "@/lib/api";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type FormState = { code: string; name: string; hex: string };
const emptyForm: FormState = { code: "", name: "", hex: "#000000" };

export function ColorsManager() {
  const [items, setItems] = useState<ColorRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<ColorRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.colors();
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được màu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.hex ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setView("form");
  }

  function openEdit(c: ColorRow) {
    setEditing(c);
    setForm({
      code: c.code,
      name: c.name,
      hex: c.hex ?? "#000000",
    });
    setView("form");
  }

  function backToList() {
    setView("list");
    setEditing(null);
    setForm(emptyForm);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Nhập tên màu");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        hex: form.hex.trim() || null,
      };
      if (editing) {
        await adminApi.updateColor(editing.id, body);
        toast.success("Đã cập nhật màu");
      } else {
        await adminApi.createColor(body);
        toast.success("Đã thêm màu");
      }
      await load();
      backToList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: ColorRow) {
    if (c.variant_count > 0) {
      toast.error(`Màu đang dùng ở ${c.variant_count} biến thể — không thể xóa`);
      return;
    }
    const ok = await confirm({
      title: "Xóa màu?",
      description: `Xóa màu "${c.name}"?`,
      confirmLabel: "Xóa màu",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteColor(c.id);
      toast.success("Đã xóa màu");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xóa thất bại");
    }
  }

  if (view === "form") {
    return (
      <>
        {confirmDialog}
        <nav className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <button type="button" className="hover:text-foreground hover:underline" onClick={backToList}>
            Mảng màu
          </button>
          <span aria-hidden>›</span>
          <span className="text-foreground">{editing ? editing.name : "Thêm màu"}</span>
        </nav>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="section-label text-primary">{editing ? "Chỉnh sửa" : "Tạo mới"}</p>
            <h2 className="mt-1 font-serif text-2xl sm:text-3xl">
              {editing ? editing.name : "Thêm màu"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Màu dùng cho biến thể sản phẩm (mã + tên + hex).
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={backToList}>
              Quay lại
            </Button>
            <Button disabled={saving} onClick={save}>
              {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo màu"}
            </Button>
          </div>
        </div>

        <section className="mt-8 grid max-w-2xl gap-6 border-t border-border pt-8">
          <div className="flex items-center gap-4">
            <span
              className="size-14 shrink-0 rounded-md border border-border shadow-inner"
              style={{ backgroundColor: form.hex || "#ccc" }}
              aria-hidden
            />
            <label className="block min-w-0 flex-1">
              <span className="text-xs font-medium">Mã hex</span>
              <div className="mt-2 flex gap-2">
                <Input
                  type="color"
                  className="h-9 w-14 cursor-pointer p-1"
                  value={/^#[0-9A-Fa-f]{6}$/.test(form.hex) ? form.hex : "#000000"}
                  onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value.toUpperCase() }))}
                  aria-label="Chọn màu"
                />
                <Input
                  className="font-mono"
                  value={form.hex}
                  onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value }))}
                  placeholder="#1A1A1A"
                />
              </div>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium">Tên màu</span>
            <Input
              className="mt-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ví dụ: Đen"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium">Mã (slug)</span>
            <Input
              className="mt-2 font-mono text-sm"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="Tự tạo từ tên nếu để trống"
            />
          </label>
          <div className="flex gap-2 border-t border-border pt-6">
            <Button disabled={saving} onClick={save}>
              {saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Tạo màu"}
            </Button>
            <Button variant="outline" onClick={backToList}>
              Hủy
            </Button>
          </div>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[11px] text-muted-foreground">
          <span>© 2026 ÉLANE · Modern Femininity</span>
          <span>Mảng màu · form</span>
        </footer>
      </>
    );
  }

  return (
    <>
      {confirmDialog}
      <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label text-primary">Thuộc tính catalog</p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Danh sách màu dùng khi tạo biến thể sản phẩm.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus /> Thêm màu
        </Button>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-accent bg-accent/25 p-5">
          <p className="section-label">Tổng màu</p>
          <p className="mt-3 font-serif text-3xl">{loading ? "…" : items.length}</p>
          <p className="mt-1 text-xs text-primary">Trong hệ thống</p>
        </div>
        <div className="rounded-md border border-border p-5">
          <p className="section-label">Đang dùng</p>
          <p className="mt-3 font-serif text-3xl">
            {loading ? "…" : items.filter((c) => c.variant_count > 0).length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Có gắn biến thể</p>
        </div>
        <div className="rounded-md border border-border p-5">
          <p className="section-label">Chưa dùng</p>
          <p className="mt-3 font-serif text-3xl">
            {loading ? "…" : items.filter((c) => c.variant_count === 0).length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Có thể xóa</p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">Danh sách màu</p>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              placeholder="Tìm màu…"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/55 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Màu</th>
                <th className="px-4 py-3 text-left">Mã</th>
                <th className="px-4 py-3 text-left">Hex</th>
                <th className="px-4 py-3 text-right">Biến thể</th>
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {loading ? "Đang tải…" : "Chưa có màu."}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-t border-border hover:bg-secondary/35"
                    onClick={() => openEdit(c)}
                  >
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-2.5 font-medium">
                        <span
                          className="size-5 rounded-full border border-border"
                          style={{ backgroundColor: c.hex ?? "#ccc" }}
                        />
                        {c.name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{c.code}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                      {c.hex ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right">{c.variant_count}</td>
                    <td className="px-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Sửa">
                          <MoreHorizontal />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={c.variant_count > 0}
                          onClick={() => remove(c)}
                          aria-label="Xóa"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[11px] text-muted-foreground">
        <span>© 2026 ÉLANE · Modern Femininity</span>
        <span className="inline-flex items-center gap-1">
          <Palette className="size-3" /> Mảng màu · list
        </span>
      </footer>
    </>
  );
}
