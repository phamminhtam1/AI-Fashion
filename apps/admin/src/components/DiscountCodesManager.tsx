import { Filter, Plus, RefreshCw, Search, SlidersHorizontal, Tag, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  adminApi,
  type DiscountCode,
  type DiscountCodeInput,
} from "@/lib/api";

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

function timingBadge(c: DiscountCode) {
  const now = new Date();
  const starts = c.starts_at ? new Date(c.starts_at) : null;
  const ends = c.ends_at ? new Date(c.ends_at) : null;
  if (ends && ends < now) return { label: "Hết hạn", style: "bg-red-50 text-red-600 border-red-200" };
  if (starts && starts > now) return { label: "Chưa bắt đầu", style: "bg-blue-50 text-blue-600 border-blue-200" };
  if (!ends) return { label: "Không hết hạn", style: "bg-secondary text-muted-foreground border-border" };
  return { label: "Đang chạy", style: "bg-emerald-50 text-emerald-600 border-emerald-200" };
}

function usageProgress(c: DiscountCode) {
  if (c.usage_limit == null) return null;
  const pct = Math.min(100, Math.round((c.usage_count / c.usage_limit) * 100));
  return pct;
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
  status: "all" | "active" | "disabled";
  type: "" | "percent" | "fixed";
  timing: "" | "active_now" | "upcoming" | "expired" | "no_expiry";
  usage: "" | "unused" | "partial" | "exhausted";
  dateFrom: string;
  dateTo: string;
  sortBy: string;
};

const emptyFilters: FilterState = {
  status: "all",
  type: "",
  timing: "",
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

export function DiscountCodesManager() {
  const [items, setItems] = useState<DiscountCode[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(emptyFilters);
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
        ...(filters.status !== "all" ? { status: filters.status } : {}),
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.timing ? { timing: filters.timing } : {}),
        ...(filters.usage ? { usage: filters.usage } : {}),
        ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
        ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
        ...(filters.sortBy !== "created_at_desc" ? { sort_by: filters.sortBy } : {}),
      });
      setItems(res.items);
      setTotal(res.total ?? res.items.length);
      setStats(res.stats ?? {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được mã giảm giá");
    } finally {
      setLoading(false);
    }
  }, [filters, query]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.status !== "all") n++;
    if (filters.type) n++;
    if (filters.timing) n++;
    if (filters.usage) n++;
    if (filters.dateFrom || filters.dateTo) n++;
    if (filters.sortBy !== "created_at_desc") n++;
    return n;
  }, [filters]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (filters.status !== "all") {
      chips.push({
        key: "status",
        label: `Trạng thái: ${filters.status === "active" ? "Đang bật" : "Đã tắt"}`,
        clear: () => setFilters((f) => ({ ...f, status: "all" })),
      });
    }
    if (filters.type) {
      chips.push({
        key: "type",
        label: `Loại: ${filters.type === "percent" ? "Phần trăm" : "Số tiền cố định"}`,
        clear: () => setFilters((f) => ({ ...f, type: "" })),
      });
    }
    if (filters.timing) {
      const labels: Record<string, string> = {
        active_now: "Đang chạy", upcoming: "Chưa bắt đầu", expired: "Đã hết hạn", no_expiry: "Không hết hạn",
      };
      chips.push({
        key: "timing",
        label: `Thời gian: ${labels[filters.timing] ?? filters.timing}`,
        clear: () => setFilters((f) => ({ ...f, timing: "" })),
      });
    }
    if (filters.usage) {
      const labels: Record<string, string> = { unused: "Chưa dùng", partial: "Đang dùng", exhausted: "Hết lượt" };
      chips.push({
        key: "usage",
        label: `Sử dụng: ${labels[filters.usage] ?? filters.usage}`,
        clear: () => setFilters((f) => ({ ...f, usage: "" })),
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      chips.push({
        key: "date",
        label: `Tạo: ${filters.dateFrom || "…"} – ${filters.dateTo || "…"}`,
        clear: () => setFilters((f) => ({ ...f, dateFrom: "", dateTo: "" })),
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
        ...(form.type === "percent" ? { max_discount_vnd: form.max_discount_vnd ?? null } : { max_discount_vnd: null }),
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

  function applyDraft() {
    setFilters(draftFilters);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setDraftFilters(emptyFilters);
    setQueryInput("");
    setQuery("");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Tăng trưởng</p>
          <h1 className="mt-1 font-serif text-3xl font-normal">Mã giảm giá</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Tạo mã phần trăm hoặc số tiền cố định, giới hạn đơn tối thiểu và lượt dùng.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Làm mới
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Tạo mã
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Tổng mã", value: (stats["active"] ?? 0) + (stats["disabled"] ?? 0), note: "Trong hệ thống", accent: true },
          { label: "Đang bật", value: stats["active"] ?? 0, note: "Có thể áp dụng", accent: false },
          { label: "Đã tắt", value: stats["disabled"] ?? 0, note: "Vô hiệu hóa", accent: false },
        ].map((m) => (
          <div
            key={m.label}
            className={cn("rounded-md border p-4", m.accent ? "border-accent bg-accent/25" : "border-border")}
          >
            <p className="section-label">{m.label}</p>
            <p className="mt-2 font-serif text-3xl">{m.value}</p>
            <p className={cn("mt-1 text-xs", m.accent ? "text-primary" : "text-muted-foreground")}>{m.note}</p>
          </div>
        ))}
      </div>

      {/* Filter toolbar */}
      <div className="overflow-hidden rounded-md border border-border">
        <div className="border-b border-border bg-secondary/20 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Status tabs */}
            <div className="flex shrink-0 gap-0.5 rounded-md border border-border/70 bg-[#f7f4ef] p-0.5">
              {([
                ["all", "Tất cả", (stats["active"] ?? 0) + (stats["disabled"] ?? 0)],
                ["active", "Đang bật", stats["active"] ?? 0],
                ["disabled", "Đã tắt", stats["disabled"] ?? 0],
              ] as const).map(([id, label, cnt]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, status: id }))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors",
                    filters.status === id
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 font-mono text-[10px] leading-none inline-flex items-center justify-center min-w-4 h-4 transition-all",
                      filters.status === id
                        ? "bg-white text-stone-950 font-bold shadow-xs"
                        : "bg-secondary text-muted-foreground border border-border/70",
                    )}
                  >
                    {cnt}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 border-border/70 bg-[#f7f4ef] pl-9 pr-9"
                placeholder="Tìm mã hoặc tên…"
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

            {/* Advanced filter popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 shrink-0 gap-1.5 border-border/70 bg-[#f7f4ef]",
                    activeFilterCount > 0 && "border-primary/40 bg-accent/40",
                  )}
                >
                  <SlidersHorizontal className="size-3.5" />
                  Bộ lọc
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[340px] p-0 shadow-xl">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Bộ lọc nâng cao</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Kết hợp nhiều điều kiện lọc mã giảm giá.</p>
                </div>
                <div className="space-y-4 p-4">
                  {/* Discount type */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">Loại ưu đãi</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { v: "", l: "Tất cả" },
                        { v: "percent", l: "Phần trăm" },
                        { v: "fixed", l: "Số tiền" },
                      ].map(({ v, l }) => (
                        <button
                          key={v || "all"}
                          type="button"
                          onClick={() => setDraftFilters((f) => ({ ...f, type: v as FilterState["type"] }))}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-xs transition-colors",
                            draftFilters.type === v
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-[#f7f4ef] text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timing filter */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">Trạng thái thời gian</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { v: "", l: "Tất cả" },
                        { v: "active_now", l: "Đang chạy" },
                        { v: "upcoming", l: "Chưa bắt đầu" },
                        { v: "expired", l: "Đã hết hạn" },
                        { v: "no_expiry", l: "Không hết hạn" },
                      ].map(({ v, l }) => (
                        <button
                          key={v || "all"}
                          type="button"
                          onClick={() => setDraftFilters((f) => ({ ...f, timing: v as FilterState["timing"] }))}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-xs transition-colors",
                            draftFilters.timing === v
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-[#f7f4ef] text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Usage filter */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">Lượt sử dụng</span>
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
                            "rounded-md border px-2 py-1.5 text-xs transition-colors",
                            draftFilters.usage === v
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-[#f7f4ef] text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date range */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">Ngày tạo</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Từ</label>
                        <Input
                          type="date"
                          value={draftFilters.dateFrom}
                          onChange={(e) => setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Đến</label>
                        <Input
                          type="date"
                          value={draftFilters.dateTo}
                          onChange={(e) => setDraftFilters((f) => ({ ...f, dateTo: e.target.value }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sort */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">Sắp xếp</span>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-[#f7f4ef] px-3 text-xs outline-none"
                      value={draftFilters.sortBy}
                      onChange={(e) => setDraftFilters((f) => ({ ...f, sortBy: e.target.value }))}
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
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
                      setDraftFilters({ ...emptyFilters, status: filters.status });
                      setFilters({ ...emptyFilters, status: filters.status });
                    }}
                  >
                    Xóa lọc
                  </Button>
                  <Button type="button" size="sm" onClick={applyDraft}>
                    Áp dụng
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
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
                onClick={resetFilters}
                className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
              >
                Xóa tất cả
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-secondary/55 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Mã</th>
                <th className="px-4 py-3 font-medium">Tên</th>
                <th className="px-4 py-3 font-medium">Loại / Ưu đãi</th>
                <th className="px-4 py-3 font-medium">Đơn tối thiểu</th>
                <th className="px-4 py-3 font-medium">Lượt dùng</th>
                <th className="px-4 py-3 font-medium">Thời gian</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Đang tải…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <div className="grid place-items-center gap-2">
                      <Tag className="size-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium">Không tìm thấy mã giảm giá</p>
                      <p className="text-xs text-muted-foreground">Thử điều chỉnh bộ lọc hoặc tạo mã mới</p>
                      {activeFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={resetFilters} className="mt-1">
                          Xóa bộ lọc
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((c) => {
                  const badge = timingBadge(c);
                  const pct = usageProgress(c);
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium tracking-wide">{c.code}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{formatValue(c)}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {c.type === "percent" ? "Phần trăm" : "Số tiền cố định"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.min_order_vnd ? formatVnd(c.min_order_vnd) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className="text-xs font-medium">{formatUsage(c)}</span>
                          {pct !== null && (
                            <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
                              <div
                                className={cn(
                                  "h-1.5 rounded-full transition-all",
                                  pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-amber-400" : "bg-emerald-400",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <span className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            badge.style,
                          )}>
                            {badge.label}
                          </span>
                          {c.ends_at && (
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(c.ends_at).toLocaleDateString("vi-VN")}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          c.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-border bg-secondary text-muted-foreground",
                        )}>
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Hiển thị {items.length} / {total} mã
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-border bg-background p-6 shadow-lg rounded-lg">
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
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
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
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
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
