import { MoreHorizontal, Plus, Ruler, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { adminApi, type SizeChart, type SizeRow } from "@/lib/api";
import { useConfirmDialog } from "@/components/ConfirmDialog";

const MEAS_CODES = [
  { code: "bust", label: "Ngực" },
  { code: "waist", label: "Eo" },
  { code: "hip", label: "Mông" },
] as const;

type SizeForm = { code: string; label: string; sort_order: string };
type ChartForm = {
  name: string;
  unit: string;
  instructions: string;
  /** sizeId → measurement_code → {min,max} */
  grid: Record<string, Record<string, { min: string; max: string }>>;
};

const emptySize: SizeForm = { code: "", label: "", sort_order: "" };

function emptyGrid(sizeList: SizeRow[]): ChartForm["grid"] {
  const g: ChartForm["grid"] = {};
  for (const s of sizeList.filter((x) => x.code !== "ONE_SIZE")) {
    g[s.id] = {};
    for (const m of MEAS_CODES) g[s.id]![m.code] = { min: "", max: "" };
  }
  return g;
}

export function SizesManager() {
  const [tab, setTab] = useState<"sizes" | "charts">("sizes");
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [charts, setCharts] = useState<SizeChart[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [sizeSheet, setSizeSheet] = useState(false);
  const [editingSize, setEditingSize] = useState<SizeRow | null>(null);
  const [sizeForm, setSizeForm] = useState<SizeForm>(emptySize);

  const [chartSheet, setChartSheet] = useState(false);
  const [editingChart, setEditingChart] = useState<SizeChart | null>(null);
  const [chartForm, setChartForm] = useState<ChartForm>({
    name: "",
    unit: "cm",
    instructions: "",
    grid: {},
  });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sz, ch] = await Promise.all([adminApi.sizes(), adminApi.sizeCharts()]);
      setSizes(sz.items);
      setCharts(ch.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được size");
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

  const filteredSizes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sizes;
    return sizes.filter((s) => `${s.code} ${s.label}`.toLowerCase().includes(q));
  }, [sizes, query]);

  const filteredCharts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return charts;
    return charts.filter((c) => c.name.toLowerCase().includes(q));
  }, [charts, query]);

  const filteredRows = tab === "sizes" ? filteredSizes : filteredCharts;
  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.id));
  const someFilteredSelected = filteredRows.some((r) => selected.has(r.id));
  const selectedCount = filteredRows.filter((r) => selected.has(r.id)).length;

  function openCreateSize() {
    setEditingSize(null);
    setSizeForm(emptySize);
    setSizeSheet(true);
  }

  function openEditSize(row: SizeRow) {
    setEditingSize(row);
    setSizeForm({
      code: row.code,
      label: row.label,
      sort_order: String(row.sort_order),
    });
    setSizeSheet(true);
  }

  async function saveSize() {
    if (!sizeForm.label.trim()) {
      toast.error("Nhập nhãn size");
      return;
    }
    setSaving(true);
    try {
      // ponytail: omit optionals when empty — exactOptionalPropertyTypes rejects `prop?: T` assigned `T | undefined`
      const payload = {
        label: sizeForm.label.trim(),
        ...(sizeForm.code.trim() ? { code: sizeForm.code.trim() } : {}),
        ...(sizeForm.sort_order ? { sort_order: Number(sizeForm.sort_order) } : {}),
      };
      if (editingSize) {
        await adminApi.updateSize(editingSize.id, payload);
        toast.success("Đã cập nhật size");
      } else {
        await adminApi.createSize(payload);
        toast.success("Đã thêm size");
      }
      setSizeSheet(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function removeSize(row: SizeRow) {
    const ok = await confirm({
      title: "Xóa size?",
      description: `Xóa mã size "${row.label}" (${row.code})?`,
      confirmLabel: "Xóa size",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteSize(row.id);
      toast.success("Đã xóa size");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xóa thất bại");
    }
  }

  function openCreateChart() {
    setEditingChart(null);
    setChartForm({
      name: "",
      unit: "cm",
      instructions: "",
      grid: emptyGrid(sizes),
    });
    setChartSheet(true);
  }

  function openEditChart(ch: SizeChart) {
    setEditingChart(ch);
    const grid = emptyGrid(sizes);
    for (const m of ch.measurements) {
      if (!grid[m.size_id]) grid[m.size_id] = {};
      grid[m.size_id]![m.measurement_code] = {
        min: String(m.min_value),
        max: String(m.max_value),
      };
    }
    setChartForm({
      name: ch.name,
      unit: ch.unit,
      instructions: ch.instructions ?? "",
      grid,
    });
    setChartSheet(true);
  }

  function buildMeasurements() {
    const out: Array<{
      size_id: string;
      measurement_code: string;
      min_value: number;
      max_value: number;
    }> = [];
    for (const [sizeId, cells] of Object.entries(chartForm.grid)) {
      for (const [code, cell] of Object.entries(cells)) {
        if (cell.min === "" && cell.max === "") continue;
        const min = Number(cell.min);
        const max = Number(cell.max || cell.min);
        if (Number.isNaN(min) || Number.isNaN(max)) continue;
        out.push({ size_id: sizeId, measurement_code: code, min_value: min, max_value: max });
      }
    }
    return out;
  }

  async function saveChart() {
    if (!chartForm.name.trim()) {
      toast.error("Nhập tên bảng size");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: chartForm.name.trim(),
        unit: chartForm.unit || "cm",
        instructions: chartForm.instructions.trim() || null,
        measurements: buildMeasurements(),
      };
      if (editingChart) {
        await adminApi.updateSizeChart(editingChart.id, payload);
        toast.success("Đã cập nhật bảng size");
      } else {
        await adminApi.createSizeChart(payload);
        toast.success("Đã tạo bảng size");
      }
      setChartSheet(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function removeChart(ch: SizeChart) {
    const ok = await confirm({
      title: "Xóa bảng size?",
      description: `Xóa bảng "${ch.name}"?`,
      confirmLabel: "Xóa bảng",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteSizeChart(ch.id);
      toast.success("Đã xóa bảng size");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(ch.id);
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
        for (const r of filteredRows) next.delete(r.id);
        return next;
      }
      const next = new Set(prev);
      for (const r of filteredRows) next.add(r.id);
      return next;
    });
  }

  async function bulkDelete() {
    if (tab === "sizes") {
      const targets = filteredSizes.filter((s) => selected.has(s.id));
      const blocked = targets.filter((s) => s.variant_count > 0);
      const deletable = targets.filter((s) => s.variant_count === 0);
      if (!deletable.length) {
        toast.message(
          blocked.length
            ? "Các size đã chọn đang được dùng ở biến thể — không thể xóa."
            : "Chưa chọn size nào.",
        );
        return;
      }
      const ok = await confirm({
        title: "Xóa size hàng loạt?",
        description:
          blocked.length > 0
            ? `Xóa ${deletable.length} size (bỏ qua ${blocked.length} size đang dùng).`
            : `Xóa ${deletable.length} size đã chọn?`,
        confirmLabel: `Xóa ${deletable.length}`,
        destructive: true,
      });
      if (!ok) return;
      setBulkBusy(true);
      try {
        let n = 0;
        for (const s of deletable) {
          await adminApi.deleteSize(s.id);
          n += 1;
        }
        toast.success(`Đã xóa ${n} size`);
        setSelected(new Set());
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Xóa hàng loạt thất bại");
        await load();
      } finally {
        setBulkBusy(false);
      }
      return;
    }

    const targets = filteredCharts.filter((c) => selected.has(c.id));
    const blocked = targets.filter((c) => (c.product_count ?? 0) > 0);
    const deletable = targets.filter((c) => (c.product_count ?? 0) === 0);
    if (!deletable.length) {
      toast.message(
        blocked.length
          ? "Các bảng size đã chọn đang gắn sản phẩm — không thể xóa."
          : "Chưa chọn bảng nào.",
      );
      return;
    }
    const ok = await confirm({
      title: "Xóa bảng size hàng loạt?",
      description:
        blocked.length > 0
          ? `Xóa ${deletable.length} bảng (bỏ qua ${blocked.length} bảng đang gắn SP).`
          : `Xóa ${deletable.length} bảng size đã chọn?`,
      confirmLabel: `Xóa ${deletable.length}`,
      destructive: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      let n = 0;
      for (const c of deletable) {
        await adminApi.deleteSizeChart(c.id);
        n += 1;
      }
      toast.success(`Đã xóa ${n} bảng size`);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Xóa hàng loạt thất bại");
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  const apparelSizes = sizes.filter((s) => s.code !== "ONE_SIZE");

  return (
    <>
      {confirmDialog}
      <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label text-primary">Thuộc tính catalog</p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Quản lý mã size (XS–XL, Free size) và bảng đo gắn vào sản phẩm.
          </p>
        </div>
        <Button onClick={tab === "sizes" ? openCreateSize : openCreateChart}>
          <Plus /> {tab === "sizes" ? "Thêm size" : "Thêm bảng size"}
        </Button>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Mã size", value: String(sizes.length), note: "XS–XL + Free size" },
          { label: "Bảng size", value: String(charts.length), note: "Đơn vị chuẩn cm" },
          {
            label: "SP đang gắn",
            value: String(charts.reduce((n, c) => n + (c.product_count ?? 0), 0)),
            note: "Qua size_chart_id",
          },
        ].map((m, i) => (
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
          <div className="flex gap-1">
            <Button
              variant={tab === "sizes" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("sizes")}
            >
              Mã size
            </Button>
            <Button
              variant={tab === "charts" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab("charts")}
            >
              Bảng size
            </Button>
          </div>
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              placeholder="Tìm…"
            />
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
            <span className="text-xs font-medium">Đã chọn {selectedCount}</span>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkDelete}>
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

        {tab === "sizes" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
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
                  {["Mã", "Nhãn", "Thứ tự", "Biến thể", ""].map((c) => (
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
                {filteredSizes.map((row, idx) => {
                  const checked = selected.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t border-border hover:bg-secondary/35",
                        checked && "bg-accent/20",
                      )}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${row.label}`}
                          checked={checked}
                          onChange={() => toggleOne(row.id)}
                        />
                      </td>
                      <td className="px-2 py-3.5 text-center text-xs tabular-nums text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">{row.code}</td>
                      <td className="px-4 py-3.5 font-medium">{row.label}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{row.sort_order}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{row.variant_count}</td>
                      <td className="px-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Sửa ${row.label}`}
                            onClick={() => openEditSize(row)}
                          >
                            <MoreHorizontal />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Xóa ${row.label}`}
                            disabled={row.variant_count > 0}
                            onClick={() => removeSize(row)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && filteredSizes.length === 0 && (
              <div className="grid h-48 place-items-center text-sm text-muted-foreground">
                Chưa có size.
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
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
                  {["Tên bảng", "Đơn vị", "Số đo", "Sản phẩm", ""].map((c) => (
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
                {filteredCharts.map((ch, idx) => {
                  const checked = selected.has(ch.id);
                  return (
                    <tr
                      key={ch.id}
                      className={cn(
                        "border-t border-border hover:bg-secondary/35",
                        checked && "bg-accent/20",
                      )}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${ch.name}`}
                          checked={checked}
                          onChange={() => toggleOne(ch.id)}
                        />
                      </td>
                      <td className="px-2 py-3.5 text-center text-xs tabular-nums text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5 font-medium">
                        <span className="inline-flex items-center gap-2">
                          <Ruler className="size-3.5 text-muted-foreground" />
                          {ch.name}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{ch.unit}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {ch.measurements.length}
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{ch.product_count ?? 0}</td>
                      <td className="px-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Sửa ${ch.name}`}
                            onClick={() => openEditChart(ch)}
                          >
                            <MoreHorizontal />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Xóa ${ch.name}`}
                            disabled={(ch.product_count ?? 0) > 0}
                            onClick={() => removeChart(ch)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!loading && filteredCharts.length === 0 && (
              <div className="grid h-48 place-items-center text-sm text-muted-foreground">
                Chưa có bảng size.
              </div>
            )}
          </div>
        )}
        {loading && (
          <div className="grid h-48 place-items-center text-sm text-muted-foreground">
            Đang tải…
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            Hiển thị {filteredRows.length} mục
            {selectedCount > 0 ? ` · đã chọn ${selectedCount}` : ""}
          </span>
        </div>
      </section>

      <Sheet open={sizeSheet} onOpenChange={setSizeSheet}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <p className="section-label text-primary">{editingSize ? "Chỉnh sửa" : "Tạo mới"}</p>
            <SheetTitle className="font-serif text-2xl">Mã size</SheetTitle>
            <SheetDescription>Mã dùng cho SKU; nhãn hiện trên storefront.</SheetDescription>
          </SheetHeader>
          <div className="mt-7 space-y-5">
            <label className="block">
              <span className="text-xs font-medium">Nhãn</span>
              <Input
                className="mt-2"
                value={sizeForm.label}
                onChange={(e) => setSizeForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="XS"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Mã (tuỳ chọn)</span>
              <Input
                className="mt-2 font-mono text-sm"
                value={sizeForm.code}
                onChange={(e) => setSizeForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="Tự tạo từ nhãn"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Thứ tự</span>
              <Input
                className="mt-2"
                type="number"
                value={sizeForm.sort_order}
                onChange={(e) => setSizeForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </label>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" disabled={saving} onClick={saveSize}>
                {saving ? "Đang lưu…" : editingSize ? "Lưu" : "Tạo size"}
              </Button>
              <Button variant="outline" onClick={() => setSizeSheet(false)}>
                Hủy
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={chartSheet} onOpenChange={setChartSheet}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <p className="section-label text-primary">{editingChart ? "Chỉnh sửa" : "Tạo mới"}</p>
            <SheetTitle className="font-serif text-2xl">Bảng size</SheetTitle>
            <SheetDescription>
              Nhập khoảng đo (min–max) theo từng size. Để trống ô nếu không dùng.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-7 space-y-5">
            <label className="block">
              <span className="text-xs font-medium">Tên bảng</span>
              <Input
                className="mt-2"
                value={chartForm.name}
                onChange={(e) => setChartForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Bảng size tiêu chuẩn nữ"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium">Đơn vị</span>
                <Input
                  className="mt-2"
                  value={chartForm.unit}
                  onChange={(e) => setChartForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium">Hướng dẫn đo</span>
              <textarea
                className="mt-2 min-h-20 w-full rounded-md border border-input bg-transparent p-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                value={chartForm.instructions}
                onChange={(e) => setChartForm((f) => ({ ...f, instructions: e.target.value }))}
              />
            </label>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-secondary/55">
                  <tr>
                    <th className="px-3 py-2">Size</th>
                    {MEAS_CODES.map((m) => (
                      <th key={m.code} className="px-3 py-2 text-center" colSpan={2}>
                        {m.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="px-3 py-1" />
                    {MEAS_CODES.flatMap((m) => [
                      <th
                        key={`${m.code}-min`}
                        className="px-1 py-1 text-[9px] font-normal text-muted-foreground"
                      >
                        min
                      </th>,
                      <th
                        key={`${m.code}-max`}
                        className="px-1 py-1 text-[9px] font-normal text-muted-foreground"
                      >
                        max
                      </th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {apparelSizes.map((sz) => (
                    <tr key={sz.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{sz.label}</td>
                      {MEAS_CODES.map((m) => {
                        const cell = chartForm.grid[sz.id]?.[m.code] ?? { min: "", max: "" };
                        return (
                          <td key={m.code} className="px-1 py-1" colSpan={2}>
                            <div className="flex gap-1">
                              <Input
                                className="h-8 w-16 px-2 text-xs"
                                type="number"
                                aria-label={`${sz.label} ${m.label} min`}
                                value={cell.min}
                                onChange={(e) =>
                                  setChartForm((f) => ({
                                    ...f,
                                    grid: {
                                      ...f.grid,
                                      [sz.id]: {
                                        ...f.grid[sz.id],
                                        [m.code]: { ...cell, min: e.target.value },
                                      },
                                    },
                                  }))
                                }
                                placeholder="min"
                              />
                              <Input
                                className="h-8 w-16 px-2 text-xs"
                                type="number"
                                aria-label={`${sz.label} ${m.label} max`}
                                value={cell.max}
                                onChange={(e) =>
                                  setChartForm((f) => ({
                                    ...f,
                                    grid: {
                                      ...f.grid,
                                      [sz.id]: {
                                        ...f.grid[sz.id],
                                        [m.code]: { ...cell, max: e.target.value },
                                      },
                                    },
                                  }))
                                }
                                placeholder="max"
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="flex-1" disabled={saving} onClick={saveChart}>
                {saving ? "Đang lưu…" : editingChart ? "Lưu bảng" : "Tạo bảng"}
              </Button>
              <Button variant="outline" onClick={() => setChartSheet(false)}>
                Hủy
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[11px] text-muted-foreground">
        <span>© 2026 ÉLANE · Modern Femininity</span>
        <span>Size & bảng đo · Phase 1</span>
      </footer>
    </>
  );
}
