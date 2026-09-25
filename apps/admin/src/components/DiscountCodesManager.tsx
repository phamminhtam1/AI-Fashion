import { Plus, Search, Tag } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  adminApi,
  type DiscountCode,
  type DiscountCodeInput,
} from "@/lib/api";

type StatusFilter = "all" | "active" | "disabled";

function formatVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "₫";
}

function formatValue(c: DiscountCode) {
  return c.type === "percent" ? `${c.value}%` : formatVnd(c.value);
}

function formatUsage(c: DiscountCode) {
  const lim = c.usage_limit == null ? "∞" : String(c.usage_limit);
  return `${c.usage_count}/${lim}`;
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

export function DiscountCodesManager() {
  const [items, setItems] = useState<DiscountCode[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [form, setForm] = useState<DiscountCodeInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.discountCodes({
        status: status === "all" ? undefined : status,
        q: query.trim() || undefined,
      });
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được mã giảm giá");
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setStartsLocal("");
    setEndsLocal("");
    setOpen(true);
  }

  function openEdit(c: DiscountCode) {
    setEditing(c);
    setForm({
      code: c.code,
      name: c.name,
      type: c.type === "fixed" ? "fixed" : "percent",
      value: c.value,
      min_order_vnd: c.min_order_vnd,
      max_discount_vnd: c.max_discount_vnd,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      usage_limit: c.usage_limit,
      status: c.status === "disabled" ? "disabled" : "active",
    });
    setStartsLocal(toLocalInput(c.starts_at));
    setEndsLocal(toLocalInput(c.ends_at));
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body: DiscountCodeInput = {
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        starts_at: fromLocalInput(startsLocal),
        ends_at: fromLocalInput(endsLocal),
        max_discount_vnd: form.type === "percent" ? form.max_discount_vnd : null,
      };
      if (editing) {
        await adminApi.patchDiscountCode(editing.id, body);
        toast.success("Đã cập nhật mã");
      } else {
        await adminApi.createDiscountCode(body);
        toast.success("Đã tạo mã");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function disable(c: DiscountCode) {
    try {
      await adminApi.deleteDiscountCode(c.id);
      toast.success("Đã vô hiệu hóa");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không vô hiệu hóa được");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Tăng trưởng</p>
          <h1 className="mt-1 font-serif text-3xl font-normal">Mã giảm giá</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Tạo mã phần trăm hoặc số tiền cố định, giới hạn đơn tối thiểu và lượt dùng.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Tạo mã
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm mã hoặc tên…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-md border border-border p-1">
          {(
            [
              ["all", "Tất cả"],
              ["active", "Đang bật"],
              ["disabled", "Đã tắt"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatus(id)}
              className={cn(
                "rounded px-3 py-1.5 text-xs",
                status === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Mã</th>
              <th className="px-4 py-3 font-medium">Tên</th>
              <th className="px-4 py-3 font-medium">Ưu đãi</th>
              <th className="px-4 py-3 font-medium">Đơn tối thiểu</th>
              <th className="px-4 py-3 font-medium">Lượt dùng</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Đang tải…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Tag className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Chưa có mã giảm giá
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium tracking-wide">{c.code}</td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">{formatValue(c)}</td>
                  <td className="px-4 py-3">{c.min_order_vnd ? formatVnd(c.min_order_vnd) : "—"}</td>
                  <td className="px-4 py-3">{formatUsage(c)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-xs",
                        c.status === "active" ? "text-emerald-700" : "text-muted-foreground",
                      )}
                    >
                      {c.status === "active" ? "Đang bật" : "Đã tắt"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      Sửa
                    </Button>
                    {c.status === "active" && (
                      <Button variant="ghost" size="sm" onClick={() => void disable(c)}>
                        Tắt
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-border bg-background p-6 shadow-lg">
            <h2 className="font-serif text-2xl">{editing ? "Sửa mã" : "Tạo mã"}</h2>
            <div className="mt-5 grid gap-3">
              <label className="grid gap-1 text-xs">
                Mã
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="WELCOME10"
                />
              </label>
              <label className="grid gap-1 text-xs">
                Tên
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Chào khách mới"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs">
                  Loại
                  <select
                    className="h-10 border border-border bg-background px-3 text-sm"
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, type: e.target.value as "percent" | "fixed" }))
                    }
                  >
                    <option value="percent">Phần trăm</option>
                    <option value="fixed">Số tiền cố định</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs">
                  Giá trị {form.type === "percent" ? "(%)" : "(₫)"}
                  <Input
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) || 0 }))}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-xs">
                Đơn tối thiểu (₫)
                <Input
                  type="number"
                  value={form.min_order_vnd ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, min_order_vnd: Number(e.target.value) || 0 }))
                  }
                />
              </label>
              {form.type === "percent" && (
                <label className="grid gap-1 text-xs">
                  Trần giảm (₫, để trống = không giới hạn)
                  <Input
                    type="number"
                    value={form.max_discount_vnd ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        max_discount_vnd: e.target.value === "" ? null : Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
              )}
              <label className="grid gap-1 text-xs">
                Giới hạn lượt dùng (để trống = không giới hạn)
                <Input
                  type="number"
                  value={form.usage_limit ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      usage_limit: e.target.value === "" ? null : Number(e.target.value) || 0,
                    }))
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs">
                  Bắt đầu
                  <Input
                    type="datetime-local"
                    value={startsLocal}
                    onChange={(e) => setStartsLocal(e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  Kết thúc
                  <Input
                    type="datetime-local"
                    value={endsLocal}
                    onChange={(e) => setEndsLocal(e.target.value)}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-xs">
                Trạng thái
                <select
                  className="h-10 border border-border bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as "active" | "disabled" }))
                  }
                >
                  <option value="active">Đang bật</option>
                  <option value="disabled">Đã tắt</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
                Hủy
              </Button>
              <Button onClick={() => void save()} disabled={saving || !form.code.trim() || !form.name.trim()}>
                {saving ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
