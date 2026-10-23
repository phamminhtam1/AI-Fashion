import { adminErrorMessage } from "@/lib/admin-language";
import {
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Ruler,
  Search,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { adminApi, type Category, type SizeChart, type SizeRow } from "@/lib/api";
import { useConfirmDialog } from "@/components/ConfirmDialog";

const MEAS_CODES = [
  { code: "bust", label: "Ngực" },
  { code: "waist", label: "Eo" },
  { code: "hip", label: "Mông" },
  { code: "shoulder", label: "Vai" },
  { code: "length", label: "Dài áo" },
] as const;

/** Các cột luôn hiện; shoulder/length chỉ hiện khi bảng có dữ liệu */
const ALWAYS_COLS = new Set<string>(["bust", "waist", "hip"]);

type ChartForm = {
  name: string;
  unit: string;
  instructions: string;
  /** sizeId → measurement_code → {min,max} */
  grid: Record<string, Record<string, { min: string; max: string }>>;
};

function emptyGrid(sizeList: SizeRow[]): ChartForm["grid"] {
  const g: ChartForm["grid"] = {};
  for (const s of sizeList.filter((x) => x.code !== "ONE_SIZE")) {
    g[s.id] = {};
    for (const m of MEAS_CODES) g[s.id]![m.code] = { min: "", max: "" };
  }
  return g;
}

/** Các field tuỳ chọn mà API có thể trả về cho bảng size */
type ChartExtra = SizeChart & {
  image_url?: string | null;
  image?: string | null;
  description?: string | null;
  is_default?: boolean;
  status?: string;
  category_ids?: string[];
  categories?: Array<{ id: string; name: string }>;
};

function chartImage(c: SizeChart) {
  const x = c as ChartExtra;
  return x.image_url ?? x.image ?? null;
}

/** undefined = API không trả field danh mục (đừng ghi đè khi lưu) */
function appliedIdsOf(c: SizeChart): string[] | undefined {
  const x = c as ChartExtra;
  if (Array.isArray(x.category_ids)) return x.category_ids;
  if (Array.isArray(x.categories)) return x.categories.map((k) => k.id);
  return undefined;
}

function formatRange(min: number, max: number) {
  return min === max ? String(min) : `${min} – ${max}`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ChartThumb({ chart, className }: { chart: SizeChart; className?: string }) {
  const src = chartImage(chart);
  return src ? (
    <img
      src={src}
      alt={chart.name}
      className={cn("size-12 shrink-0 rounded-xs border border-border/60 object-cover", className)}
    />
  ) : (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-xs border border-border/60 bg-secondary/60 text-muted-foreground",
        className,
      )}
    >
      <Ruler className="size-4" />
    </span>
  );
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
        "flex w-full items-center gap-2 rounded-xs px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-secondary cursor-pointer",
        destructive && "text-destructive hover:bg-destructive/10",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xs border border-border/80 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-slate-900 admin-subsection-title">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

export function SizesManager({ permissions = [] }: { permissions?: string[] }) {
  const canWrite = permissions.includes("*") || permissions.includes("product.write");
  const [detailTab, setDetailTab] = useState<"measurements" | "settings">("measurements");
  const [sizes, setSizes] = useState<SizeRow[]>([]);
  const [charts, setCharts] = useState<SizeChart[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [catOpen, setCatOpen] = useState(false);
  const [catDraft, setCatDraft] = useState<Set<string>>(new Set());

  const [chartSheet, setChartSheet] = useState(false);
  const [editingChart, setEditingChart] = useState<SizeChart | null>(null);
  const [chartForm, setChartForm] = useState<ChartForm>({
    name: "",
    unit: "cm",
    instructions: "",
    grid: {},
  });
  const [saving, setSaving] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const location = useLocation();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sz, ch] = await Promise.all([adminApi.sizes(), adminApi.sizeCharts()]);
      setSizes(sz.items);
      setCharts(ch.items);
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Không tải được bảng kích cỡ");
    } finally {
      setLoading(false);
    }
    // Danh mục dùng cho "Danh mục áp dụng" — lỗi không chặn trang
    try {
      const res = await adminApi.categoryOptions("all");
      setAllCategories(res.items);
    } catch {
      /* bỏ qua */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredCharts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return charts;
    return charts.filter((c) => c.name.toLowerCase().includes(q));
  }, [charts, query]);

  const activeChart = useMemo(
    () => charts.find((c) => c.id === activeChartId) ?? filteredCharts[0] ?? null,
    [charts, filteredCharts, activeChartId],
  );

  // Size dùng làm các dòng của bảng số đo (chỉ đọc)
  const apparelSizes = useMemo(() => sizes.filter((s) => s.code !== "ONE_SIZE"), [sizes]);

  const activeCols = useMemo(() => {
    if (!activeChart) return MEAS_CODES.filter((m) => ALWAYS_COLS.has(m.code));
    return MEAS_CODES.filter(
      (m) =>
        ALWAYS_COLS.has(m.code) ||
        activeChart.measurements.some((x) => x.measurement_code === m.code),
    );
  }, [activeChart]);

  const measurementMap = useMemo(() => {
    const map = new Map<string, { min: number; max: number }>();
    if (activeChart) {
      for (const m of activeChart.measurements) {
        map.set(`${m.size_id}:${m.measurement_code}`, { min: m.min_value, max: m.max_value });
      }
    }
    return map;
  }, [activeChart]);

  const extra = activeChart as ChartExtra | null;
  const isActiveStatus = extra ? extra.status !== "archived" : true;
  const appliedIds = activeChart ? appliedIdsOf(activeChart) ?? [] : [];
  const appliedCategories = appliedIds
    .map((id) => allCategories.find((c) => c.id === id))
    .filter((c): c is Category => !!c);

  const openCreateChartInternal = useCallback((currentSizes: SizeRow[]) => {
    setEditingChart(null);
    setChartForm({
      name: "",
      unit: "cm",
      instructions: "",
      grid: emptyGrid(currentSizes),
    });
    setChartSheet(true);
  }, []);

  const openEditChartInternal = useCallback((ch: SizeChart, currentSizes: SizeRow[]) => {
    setEditingChart(ch);
    const grid = emptyGrid(currentSizes);
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
  }, []);

  // Đồng bộ state với URL
  useEffect(() => {
    const rawPath = location.pathname.toLowerCase();
    if (!rawPath.includes("bangsize") && !rawPath.includes("sizes") && !rawPath.includes("kichthuoc")) {
      return;
    }

    if (rawPath.includes("thembang") || rawPath.includes("/them")) {
      openCreateChartInternal(sizes);
    } else if (rawPath.includes("suabang/") || rawPath.includes("/sua/")) {
      const id = rawPath.split(/suabang\/|\/sua\//)[1]?.split("/")[0];
      const found = charts.find((c) => c.id === id);
      if (found) {
        setActiveChartId(found.id);
        openEditChartInternal(found, sizes);
      }
    } else {
      setChartSheet(false);
    }
  }, [location.pathname, sizes, charts, openCreateChartInternal, openEditChartInternal]);

  function openCreateChart() {
    navigate({ to: "/bangsize/thembang" });
  }

  function openEditChart(ch: SizeChart) {
    navigate({ to: `/bangsize/suabang/${ch.id}` });
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
      toast.error("Nhập tên bảng kích cỡ");
      return;
    }
    setSaving(true);
    try {
      const keepIds = editingChart ? appliedIdsOf(editingChart) : undefined;
      const payload = {
        name: chartForm.name.trim(),
        unit: chartForm.unit || "cm",
        instructions: chartForm.instructions.trim() || null,
        measurements: buildMeasurements(),
        ...(keepIds ? { category_ids: keepIds } : {}),
      };
      if (editingChart) {
        await adminApi.updateSizeChart(editingChart.id, payload);
        toast.success("Đã cập nhật bảng kích cỡ");
      } else {
        await adminApi.createSizeChart(payload);
        toast.success("Đã tạo bảng kích cỡ");
      }
      setChartSheet(false);
      navigate({ to: "/bangsize" });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  /** Cập nhật danh mục áp dụng (cần backend nhận `category_ids`) */
  async function saveCategoryIds(chart: SizeChart, ids: string[]) {
    try {
      const payload = {
        name: chart.name,
        unit: chart.unit,
        instructions: chart.instructions ?? null,
        measurements: chart.measurements.map((m) => ({
          size_id: m.size_id,
          measurement_code: m.measurement_code,
          min_value: m.min_value,
          max_value: m.max_value,
        })),
        category_ids: ids,
      };
      await adminApi.updateSizeChart(chart.id, payload);
      toast.success("Đã cập nhật danh mục áp dụng");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Cập nhật thất bại");
    }
  }

  async function removeChart(ch: SizeChart) {
    if ((ch.product_count ?? 0) > 0) {
      toast.message("Bảng kích cỡ đang gắn sản phẩm — không thể xóa.");
      return;
    }
    const ok = await confirm({
      title: "Xóa bảng kích cỡ?",
      description: `Xóa bảng "${ch.name}"?`,
      confirmLabel: "Xóa bảng",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteSizeChart(ch.id);
      toast.success("Đã xóa bảng kích cỡ");
      if (activeChartId === ch.id) setActiveChartId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Xóa thất bại");
    }
  }

  function exportCurrent() {
    if (!activeChart) {
      toast.message("Chưa có bảng kích cỡ để xuất.");
      return;
    }
    const header = ["Kích cỡ", ...activeCols.map((c) => `${c.label} (${activeChart.unit})`)];
    const rows = apparelSizes.map((s) => [
      s.label,
      ...activeCols.map((c) => {
        const v = measurementMap.get(`${s.id}:${c.code}`);
        return v ? formatRange(v.min, v.max) : "";
      }),
    ]);
    downloadCsv(`${activeChart.name}.csv`, [header, ...rows]);
  }

  return (
    <div className="space-y-5 font-sans pb-12">
      {confirmDialog}

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-slate-900 admin-page-title">Bảng kích cỡ</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý mẫu bảng kích cỡ cho từng loại trang phục.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            onClick={exportCurrent}
          >
            <Download className="size-3.5 text-slate-500" />
            <span>Xuất file</span>
          </Button>
          {canWrite && <Button asChild className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer">
            <a
              href="/bangsize/thembang"
              onClick={(e) => {
                e.preventDefault();
                openCreateChart();
              }}
            >
              <Plus className="size-3.5" />
              <span>Thêm bảng kích cỡ</span>
            </a>
            </Button>}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ============ Danh sách mẫu bảng size ============ */}
        <aside className="rounded-xs border border-border/80 bg-card p-3.5">
          <h2 className="px-1 pb-2 pt-0.5 text-slate-900 admin-section-title">Mẫu bảng kích cỡ</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8.5 rounded-xs border-border/70 bg-white pl-8 text-sm"
              placeholder="Tìm bảng kích cỡ…"
            />
          </div>

          <div className="mt-3 max-h-[calc(100vh-18rem)] space-y-2 overflow-y-auto pr-0.5">
            {filteredCharts.map((ch) => {
              const active = activeChart?.id === ch.id;
              return (
                <div
                  key={ch.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xs border p-2 transition-colors",
                    active
                      ? "border-[#6941c6]/60 bg-[#f4f3ff]"
                      : "border-border/70 bg-white hover:bg-secondary/40",
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                    onClick={() => {
                      setActiveChartId(ch.id);
                      setDetailTab("measurements");
                    }}
                  >
                    <ChartThumb chart={ch} className="size-10" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-950">{ch.name}</span>
                      <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
                        {ch.product_count ?? 0} sản phẩm liên kết
                      </span>
                    </span>
                  </button>
                  <Popover open={menuId === ch.id} onOpenChange={(o) => setMenuId(o ? ch.id : null)}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 rounded-xs text-slate-500 hover:text-slate-800"
                        aria-label={`Thao tác với ${ch.name}`}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-44 p-1 rounded-xs">
                      <MenuItem
                        icon={<Pencil className="size-3.5" />}
                        label="Chỉnh sửa"
                        onClick={() => {
                          setMenuId(null);
                          openEditChart(ch);
                        }}
                      />
                      <MenuItem
                        icon={<Trash2 className="size-3.5" />}
                        label="Xóa"
                        destructive
                        onClick={() => {
                          setMenuId(null);
                          removeChart(ch);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              );
            })}
            {!loading && filteredCharts.length === 0 && (
              <p className="grid h-32 place-items-center text-sm text-muted-foreground">
                Chưa có bảng kích cỡ.
              </p>
            )}
            {loading && (
              <p className="grid h-32 place-items-center text-sm text-muted-foreground">Đang tải…</p>
            )}
          </div>
        </aside>

        {/* ============ Chi tiết bảng size ============ */}
        <section className="min-w-0 rounded-xs border border-border/80 bg-card p-4 sm:p-5">
          {!activeChart ? (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground">
              {loading ? "Đang tải…" : "Chọn một bảng kích cỡ để xem chi tiết."}
            </div>
          ) : (
            <>
              {/* Header chi tiết */}
              <div className="flex items-start gap-3.5">
                <ChartThumb chart={activeChart} className="size-14" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-slate-900 admin-section-title">{activeChart.name}</h2>
                    {extra?.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <Star className="size-3 fill-current" />
                        Mặc định
                      </span>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        isActiveStatus
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          isActiveStatus ? "bg-emerald-500" : "bg-muted-foreground/50",
                        )}
                      />
                      {isActiveStatus ? "Hoạt động" : "Đã lưu trữ"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {extra?.description ||
                      `Bảng kích cỡ tiêu chuẩn · đơn vị ${activeChart.unit} · ${activeChart.product_count ?? 0} sản phẩm liên kết`}
                  </p>
                </div>
                <Popover open={menuId === "detail"} onOpenChange={(o) => setMenuId(o ? "detail" : null)}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0 rounded-xs border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
                      aria-label="Thao tác"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-44 p-1 rounded-xs">
                    <MenuItem
                      icon={<Pencil className="size-3.5" />}
                      label="Chỉnh sửa"
                      onClick={() => {
                        setMenuId(null);
                        openEditChart(activeChart);
                      }}
                    />
                    <MenuItem
                      icon={<Trash2 className="size-3.5" />}
                      label="Xóa"
                      destructive
                      onClick={() => {
                        setMenuId(null);
                        removeChart(activeChart);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Tabs */}
              <div className="mt-4 flex gap-5 border-b border-border">
                {(
                  [
                    ["measurements", "Số đo"],
                    ["settings", "Cài đặt"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDetailTab(id)}
                    className={cn(
                      "-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors cursor-pointer",
                      detailTab === id
                        ? "border-[#6941c6] text-[#6941c6] font-semibold"
                        : "border-transparent text-slate-500 hover:text-slate-900",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {detailTab === "measurements" ? (
                <div className="mt-4 space-y-4">
                  {/* Số đo theo size */}
                  <SectionCard
                    title="Số đo theo kích cỡ"
                    description={`Tất cả số đo tính bằng ${activeChart.unit === "cm" ? "xen-ti-mét (cm)" : activeChart.unit}.`}
                    action={
                      <Button
                        variant="outline"
                        className="h-8 gap-1.5 rounded-xs border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                        onClick={() => openEditChart(activeChart)}
                      >
                        <Pencil className="size-3 text-slate-500" />
                        <span>Sửa bảng</span>
                      </Button>
                    }
                  >
                    <div className="overflow-x-auto rounded-xs border border-border">
                      <table className="w-full min-w-[580px] border-collapse text-center text-sm">
                        <thead className="bg-slate-50/80 border-y border-slate-200 text-slate-700 font-semibold tracking-tight text-sm">
                          <tr>
                            <th className="border-b border-r border-border px-3 py-2.5 font-semibold tracking-tight text-slate-700">Kích cỡ</th>
                            {activeCols.map((c, i) => (
                              <th
                                key={c.code}
                                className={cn(
                                  "border-b border-border px-3 py-2.5 font-semibold tracking-tight text-slate-700",
                                  i < activeCols.length - 1 && "border-r",
                                )}
                              >
                                <span className="block text-sm">{c.label}</span>
                                <span className="block text-sm font-semibold text-slate-500">
                                  {activeChart.unit}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {apparelSizes.map((s, ri) => (
                            <tr key={s.id} className={cn("hover:bg-slate-50/70 transition-colors", ri > 0 && "border-t border-border")}>
                              <td className="border-r border-border px-3 py-2 text-sm font-semibold text-slate-950">{s.label}</td>
                              {activeCols.map((c, i) => {
                                const v = measurementMap.get(`${s.id}:${c.code}`);
                                return (
                                  <td
                                    key={c.code}
                                    className={cn(
                                      "px-3 py-2 text-sm font-semibold tabular-nums text-slate-900",
                                      i < activeCols.length - 1 && "border-r border-border",
                                    )}
                                  >
                                    {v ? formatRange(v.min, v.max) : "—"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>

                  {/* Danh mục áp dụng */}
                  <SectionCard
                    title="Danh mục áp dụng"
                    description="Bảng size này sẽ hiện trên sản phẩm thuộc các danh mục sau."
                    action={
                      <Popover
                        open={catOpen}
                        onOpenChange={(o) => {
                          setCatOpen(o);
                          if (o) setCatDraft(new Set(appliedIds));
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-8 gap-1.5 rounded-xs border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                          >
                            <Tag className="size-3 text-slate-500" />
                            <span>Quản lý danh mục</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 p-0 shadow-xl rounded-xs">
                          <div className="border-b border-border px-3.5 py-2.5">
                            <p className="text-sm font-semibold">Chọn danh mục</p>
                          </div>
                          <div className="max-h-64 overflow-y-auto py-1">
                            {allCategories.length === 0 && (
                              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                Chưa có danh mục.
                              </p>
                            )}
                            {allCategories.map((c) => (
                              <label
                                key={c.id}
                                className="flex cursor-pointer items-center gap-2.5 py-1.5 pr-3 text-sm hover:bg-secondary/50"
                                style={{ paddingLeft: 14 + (c.depth ?? 0) * 14 }}
                              >
                                <input
                                  type="checkbox"
                                  className="size-3.5 rounded-xs"
                                  checked={catDraft.has(c.id)}
                                  onChange={() =>
                                    setCatDraft((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(c.id)) next.delete(c.id);
                                      else next.add(c.id);
                                      return next;
                                    })
                                  }
                                />
                                <span className="truncate">{c.name}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-end gap-2 border-t border-border px-3 py-2">
                            <Button type="button" variant="ghost" size="sm" className="h-7 text-sm rounded-xs" onClick={() => setCatOpen(false)}>
                              Hủy
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 text-sm rounded-xs bg-[#6941c6] text-white hover:bg-[#53389e]"
                              onClick={() => {
                                setCatOpen(false);
                                saveCategoryIds(activeChart, Array.from(catDraft));
                              }}
                            >
                              Áp dụng
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    }
                  >
                    {appliedCategories.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {appliedCategories.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-2 rounded-xs border border-border bg-secondary/40 py-1 pl-2.5 pr-2 text-sm"
                          >
                            {c.name}
                            <button
                              type="button"
                              aria-label={`Bỏ ${c.name}`}
                              className="text-muted-foreground hover:text-foreground cursor-pointer"
                              onClick={() =>
                                saveCategoryIds(
                                  activeChart,
                                  appliedIds.filter((id) => id !== c.id),
                                )
                              }
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Chưa áp dụng cho danh mục nào.</p>
                    )}
                  </SectionCard>

                  {/* Ghi chú */}
                  <SectionCard
                    title={
                      <>
                        Ghi chú <span className="font-normal">(tuỳ chọn)</span>
                      </>
                    }
                    description="Thông tin bổ sung giúp khách chọn đúng size."
                    action={
                      <Button
                        variant="outline"
                        className="h-8 gap-1.5 rounded-xs border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                        onClick={() => openEditChart(activeChart)}
                      >
                        <Pencil className="size-3 text-slate-500" />
                        <span>Sửa ghi chú</span>
                      </Button>
                    }
                  >
                    <div className="whitespace-pre-line rounded-xs border border-border bg-secondary/30 px-3 py-2.5 text-sm text-foreground/85">
                      {activeChart.instructions?.trim() || (
                        <span className="text-muted-foreground">Chưa có ghi chú.</span>
                      )}
                    </div>
                  </SectionCard>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <SectionCard
                    title="Thông tin bảng kích cỡ"
                    action={
                      <Button
                        variant="outline"
                        className="h-8 gap-1.5 rounded-xs border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                        onClick={() => openEditChart(activeChart)}
                      >
                        <Pencil className="size-3 text-slate-500" />
                        <span>Chỉnh sửa</span>
                      </Button>
                    }
                  >
                    <dl className="grid gap-2 text-sm sm:grid-cols-[140px_1fr]">
                      <dt className="text-muted-foreground">Tên bảng</dt>
                      <dd className="font-medium text-slate-900">{activeChart.name}</dd>
                      <dt className="text-muted-foreground">Đơn vị</dt>
                      <dd className="font-medium text-slate-900">{activeChart.unit}</dd>
                      <dt className="text-muted-foreground">Số ô số đo</dt>
                      <dd className="tabular-nums font-medium text-slate-900">{activeChart.measurements.length}</dd>
                      <dt className="text-muted-foreground">Sản phẩm liên kết</dt>
                      <dd className="tabular-nums font-medium text-slate-900">{activeChart.product_count ?? 0}</dd>
                    </dl>
                  </SectionCard>

                  <SectionCard
                    title="Xóa bảng kích cỡ"
                    description={
                      (activeChart.product_count ?? 0) > 0
                        ? "Bảng đang gắn sản phẩm nên chưa thể xóa."
                        : "Hành động này không thể hoàn tác."
                    }
                    action={
                      <Button
                        variant="outline"
                        className="h-8 gap-1.5 rounded-xs border-destructive/40 bg-white px-3 text-sm font-medium text-destructive hover:bg-destructive/10 shadow-2xs transition-colors"
                        disabled={(activeChart.product_count ?? 0) > 0}
                        onClick={() => removeChart(activeChart)}
                      >
                        <Trash2 className="size-3" />
                        <span>Xóa bảng</span>
                      </Button>
                    }
                  >
                    <span className="sr-only">Vùng nguy hiểm</span>
                  </SectionCard>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* ============ Sheet: Thêm / sửa bảng size ============ */}
      <Sheet
        open={chartSheet}
        onOpenChange={(open) => {
          setChartSheet(open);
          if (!open) navigate({ to: "/bangsize" });
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle className=" admin-section-title">
              {editingChart ? "Chỉnh sửa bảng kích cỡ" : "Thêm bảng kích cỡ"}
            </SheetTitle>
            <SheetDescription>
              Nhập khoảng đo (nhỏ nhất–lớn nhất) theo từng kích cỡ. Để trống ô nếu không dùng.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Tên bảng</span>
                <Input
                  className="mt-1.5 h-8.5 rounded-xs text-sm"
                  value={chartForm.name}
                  onChange={(e) => setChartForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Áo nữ"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Đơn vị</span>
                <Input
                  className="mt-1.5 h-8.5 rounded-xs text-sm"
                  value={chartForm.unit}
                  onChange={(e) => setChartForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Ghi chú</span>
              <textarea
                className="mt-1.5 min-h-20 w-full rounded-xs border border-input bg-white p-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                value={chartForm.instructions}
                onChange={(e) => setChartForm((f) => ({ ...f, instructions: e.target.value }))}
                placeholder="Số đo có thể chênh 1–2 cm tuỳ chất liệu vải…"
              />
            </label>

            <div className="overflow-x-auto rounded-xs border border-border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-secondary/55">
                  <tr>
                    <th className="px-3 py-2">Kích cỡ</th>
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
                        className="px-1 py-1 text-xs font-normal text-muted-foreground"
                      >
                        nhỏ nhất
                      </th>,
                      <th
                        key={`${m.code}-max`}
                        className="px-1 py-1 text-xs font-normal text-muted-foreground"
                      >
                        lớn nhất
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
                                className="h-8 w-14 px-2 text-sm"
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
                                placeholder="nhỏ nhất"
                              />
                              <Input
                                className="h-8 w-14 px-2 text-sm"
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
                                placeholder="lớn nhất"
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
              <Button
                className="h-9 flex-1 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer"
                disabled={saving}
                onClick={saveChart}
              >
                {saving ? "Đang lưu…" : editingChart ? "Lưu bảng" : "Tạo bảng"}
              </Button>
              <Button asChild variant="outline" className="h-9 rounded-xs border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors">
                <a
                  href="/bangsize"
                  onClick={(e) => {
                    e.preventDefault();
                    setChartSheet(false);
                    navigate({ to: "/bangsize" });
                  }}
                >
                  Hủy
                </a>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-xs text-muted-foreground">
        <span>© 2026 ÉLANE · Modern Femininity</span>
        <span>Kích cỡ & bảng đo · Giai đoạn 1</span>
      </footer>
    </div>
  );
}
