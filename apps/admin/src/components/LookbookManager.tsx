import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { adminErrorMessage } from "@/lib/admin-language";
import { resolveAdminPath } from "@/lib/routes";
import { adminApi, type AdminLookbookItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { LookbookForm } from "./LookbookForm";
import { formatDateParts, StatusPill, type LookbookExt } from "./lookbook-shared";

/**
 * Router: /lookbook            -> danh sách
 *         /lookbook/them       -> trang thêm mới
 *         /lookbook/:id|:slug  -> trang chỉnh sửa
 */
export function LookbookManager() {
  const location = useLocation();
  const route = resolveAdminPath(location.pathname);

  if (route.action === "create") return <LookbookForm key="create" mode="create" />;
  if (route.subParam) {
    return <LookbookForm key={route.subParam} mode="edit" lookbookKey={route.subParam} />;
  }
  return <LookbookList />;
}

/* -------------------------------------------------------------------------- */
/*  LIST VIEW                                                                 */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 8;
function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  iconClass,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  trend?: number;
  iconClass?: string;
}) {
  const up = (trend ?? 0) >= 0;
  return (
    <div className="flex items-start gap-3 rounded-xs border border-slate-200/90 bg-white p-5 shadow-xs">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xs border border-slate-200 bg-slate-50 text-slate-700",
          iconClass,
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold uppercase tracking-tight text-slate-700">{label}</p>
        <p className="mt-1 admin-metric font-semibold">{value}</p>
        {trend !== undefined && (
          <p
            className={cn(
              "mt-1 inline-flex items-center gap-0.5 text-xs font-medium",
              up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500",
            )}
          >
            {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {up ? "+" : ""}
            {trend.toFixed(1)}%
          </p>
        )}
        <p className="text-xs text-muted-foreground">So với tháng trước</p>
      </div>
    </div>
  );
}

function LookbookList() {
  const { confirm, ConfirmDialogElement } = useConfirmDialog();
  const navigate = useNavigate();

  const [lookbooks, setLookbooks] = useState<LookbookExt[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);

  // Selection & Preview
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<AdminLookbookItem[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await adminApi.lookbooks();
      setLookbooks((res.items || []) as LookbookExt[]);
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Tải dữ liệu thất bại");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, seasonFilter, statusFilter, dateFilter]);

  const stats = useMemo(
    () => ({
      total: lookbooks.length,
      published: lookbooks.filter((l) => l.status === "published").length,
      draft: lookbooks.filter((l) => l.status !== "published").length,
      views: lookbooks.reduce((acc, l) => acc + (l.view_count || 0), 0),
    }),
    [lookbooks],
  );

  const seasonOptions = useMemo(
    () => Array.from(new Set(lookbooks.map((l) => l.season).filter(Boolean))) as string[],
    [lookbooks],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lookbooks.filter((l) => {
      if (q && !l.title.toLowerCase().includes(q) && !l.slug.toLowerCase().includes(q)) return false;
      if (seasonFilter !== "all" && l.season !== seasonFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (dateFilter && !(l.created_at || "").startsWith(dateFilter)) return false;
      return true;
    });
  }, [lookbooks, search, seasonFilter, statusFilter, dateFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const previewLb = lookbooks.find((l) => l.id === previewId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!previewLb) {
      setPreviewItems([]);
      return;
    }
    let cancelled = false;
    adminApi
      .lookbook(previewLb.id)
      .then((d) => !cancelled && setPreviewItems(d.items || []))
      .catch(() => !cancelled && setPreviewItems([]));
    return () => {
      cancelled = true;
    };
  }, [previewLb?.id]);

  const previewProductCount =
    previewLb?.product_count ??
    new Set(
      [
        ...(previewLb?.attached_products || []).map((p) => p.id),
        ...previewItems.map((i) => i.product_id).filter(Boolean),
      ],
    ).size;

  const goCreate = () => navigate({ to: "/lookbook/them" });
  const goEdit = (lb: LookbookExt) => navigate({ to: `/lookbook/${lb.id}` });

  const handleDelete = async (lb: LookbookExt) => {
    const ok = await confirm({
      title: `Xóa lookbook "${lb.title}"?`,
      description: "Thao tác này sẽ xóa lookbook cùng toàn bộ hình ảnh bên trong khỏi hệ thống.",
      confirmLabel: "Xóa vĩnh viễn",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteLookbook(lb.id);
      toast.success(`Đã xóa lookbook "${lb.title}"`);
      setCheckedIds((ids) => ids.filter((id) => id !== lb.id));
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Xóa thất bại");
    }
  };

  const handleBulkDelete = async () => {
    const ok = await confirm({
      title: `Xóa ${checkedIds.length} lookbook đã chọn?`,
      description: "Toàn bộ hình ảnh bên trong các lookbook này cũng sẽ bị xóa vĩnh viễn.",
      confirmLabel: "Xóa tất cả",
      destructive: true,
    });
    if (!ok) return;
    setBulkDeleting(true);
    try {
      await adminApi.deleteLookbooks(checkedIds);
      toast.success(`Đã xóa ${checkedIds.length} lookbook`);
      setCheckedIds([]);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? adminErrorMessage(err) : "Xóa thất bại");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = () => {
    const header = ["Tên", "Slug", "Mùa", "Số hình ảnh", "Sản phẩm", "Lượt xem", "Ngày tạo", "Trạng thái"];
    const rows = filtered.map((l) => [
      l.title,
      l.slug,
      l.season ?? "",
      l.item_count ?? 0,
      l.product_count ?? 0,
      l.view_count ?? 0,
      l.created_at ?? "",
      l.status ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lookbook_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allChecked = pageItems.length > 0 && pageItems.every((l) => checkedIds.includes(l.id));
  const toggleAll = () =>
    setCheckedIds((ids) =>
      allChecked
        ? ids.filter((id) => !pageItems.some((l) => l.id === id))
        : Array.from(new Set([...ids, ...pageItems.map((l) => l.id)])),
    );
  const toggleOne = (id: string) =>
    setCheckedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const selectClass =
    "h-9 rounded-xs border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-5 pb-12 font-sans">
      {ConfirmDialogElement}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <AdminPageHeader
          title="Bộ ảnh"
          description="Quản lý bộ sưu tập lookbook, hình ảnh chiến dịch và sản phẩm gắn kèm."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0} className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-medium">
            <Download className="mr-1.5 size-3.5" />
            Xuất dữ liệu
          </Button>
          <Button onClick={goCreate} className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white hover:bg-[#53389e]">
            <Plus className="mr-1.5 size-3.5" />
            Thêm lookbook
          </Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BookOpen} label="Tổng bộ ảnh" value={stats.total} />
        <MetricCard
          icon={CheckCircle2}
          label="Đã xuất bản"
          value={stats.published}
          iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <MetricCard icon={FileText} label="Bản nháp" value={stats.draft} />
        <MetricCard
          icon={Eye}
          label="Tổng lượt xem"
          value={stats.views.toLocaleString("vi-VN")}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* TABLE */}
        <div className="min-w-0 rounded-xs border border-slate-200/90 bg-white shadow-xs">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm theo tên lookbook..."
                className="h-9 pl-9 text-sm"
              />
            </div>
            <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} className={selectClass}>
              <option value="all">Tất cả mùa</option>
              {seasonOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
              <option value="all">Tất cả trạng thái</option>
              <option value="published">Đã xuất bản</option>
              <option value="scheduled">Sắp ra mắt</option>
              <option value="draft">Bản nháp</option>
            </select>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Chọn ngày"
              className="h-9 w-auto text-sm"
            />
            <Button variant="outline" size="sm" className="size-9 p-0" onClick={loadData} disabled={loading} title="Làm mới">
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>

          {checkedIds.length > 0 && (
            <div className="flex items-center justify-between border-b border-border bg-primary/5 px-4 py-2 text-sm">
              <span className="font-medium">Đã chọn {checkedIds.length} lookbook</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCheckedIds([])}>
                  Bỏ chọn
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                >
                  {bulkDeleting ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 size-3.5" />
                  )}
                  Xóa đã chọn
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-sm">
              <thead className="bg-slate-50/80">
                <tr className="border-b border-slate-200 text-left text-sm font-semibold tracking-tight text-slate-700">
                  <th className="w-12 py-3.5 pl-4">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" />
                  </th>
                  <th className="w-20 px-4 py-3.5">Hình ảnh</th>
                  <th className="px-4 py-3.5">Tên bộ sưu tập</th>
                  <th className="w-32 px-4 py-3.5">Mùa</th>
                  <th className="w-28 px-4 py-3.5 text-center">Số ảnh</th>
                  <th className="w-28 px-4 py-3.5 text-center">Sản phẩm</th>
                  <th className="w-36 px-4 py-3.5">Ngày tạo</th>
                  <th className="w-36 px-4 py-3.5">Trạng thái</th>
                  <th className="w-16 py-3.5 pr-3" />
                </tr>
              </thead>
              <tbody>
                {loading && lookbooks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin" />
                    </td>
                  </tr>
                ) : pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <BookOpen className="mx-auto size-10 stroke-[1.25] text-muted-foreground/60" />
                      <p className="mt-3 font-medium">
                        {lookbooks.length === 0 ? "Chưa có lookbook nào" : "Không tìm thấy lookbook phù hợp"}
                      </p>
                      <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                        {lookbooks.length === 0
                          ? "Tạo lookbook đầu tiên để giới thiệu câu chuyện thời trang của thương hiệu."
                          : "Thử đổi từ khóa hoặc bỏ bớt bộ lọc."}
                      </p>
                      {lookbooks.length === 0 && (
                        <Button size="sm" className="mt-4" onClick={goCreate}>
                          <Plus className="mr-1.5 size-3.5" />
                          Thêm lookbook
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  pageItems.map((lb) => {
                    const created = formatDateParts(lb.created_at);
                    const active = previewLb?.id === lb.id;
                    return (
                      <tr
                        key={lb.id}
                        onClick={() => setPreviewId(lb.id)}
                        className={cn(
                          "cursor-pointer border-b border-border/60 transition-colors last:border-0",
                          active ? "bg-primary/5" : "hover:bg-muted/40",
                        )}
                      >
                        <td className="py-4 pl-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checkedIds.includes(lb.id)}
                            onChange={() => toggleOne(lb.id)}
                            aria-label={`Chọn ${lb.title}`}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <img
                            src={lb.cover_image_url}
                            alt={lb.title}
                            className="h-11 w-16 rounded-xs border border-slate-200 bg-slate-100 object-cover"
                          />
                        </td>
                        <td className="min-w-0 px-4 py-4">
                          <p className="truncate font-medium text-foreground">{lb.title}</p>
                          {lb.subtitle && (
                            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{lb.subtitle}</p>
                          )}
                        </td>
                        <td className="px-4 py-4">{lb.season || "—"}</td>
                        <td className="px-4 py-4 text-center tabular-nums">{lb.item_count ?? 0}</td>
                        <td className="px-4 py-4 text-center tabular-nums">{lb.product_count ?? 0}</td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {created ? (
                            <>
                              <p>{created.date}</p>
                              <p className="text-xs text-muted-foreground">{created.time}</p>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill status={lb.status} />
                        </td>
                        <td className="py-4 pr-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="size-8 p-0" aria-label="Thao tác">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => goEdit(lb)}>
                                <Pencil className="mr-2 size-3.5" />
                                Chỉnh sửa
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <a href={`/lookbook/${lb.slug}`} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 size-3.5" />
                                  Xem trên website
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(lb)}
                              >
                                <Trash2 className="mr-2 size-3.5" />
                                Xóa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} trong{" "}
                {filtered.length} lookbook
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="size-7 p-0"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ArrowLeft className="size-3" />
                </Button>
                <span className="px-2">
                  {page} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="size-7 p-0"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* PREVIEW PANEL */}
        {previewLb && (
          <aside className="space-y-4 rounded-xs border border-border bg-card p-4 xl:sticky xl:top-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xs bg-secondary">
              <img src={previewLb.cover_image_url} alt={previewLb.title} className="h-full w-full object-cover" />
              <a
                href={previewLb.cover_image_url}
                target="_blank"
                rel="noreferrer"
                title="Xem ảnh lớn"
                className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-xs bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
              >
                <Maximize2 className="size-3.5" />
              </a>
            </div>

            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="admin-subsection-title">{previewLb.title}</h3>
                <StatusPill status={previewLb.status} />
              </div>
              {previewLb.subtitle && <p className="mt-1 text-sm text-muted-foreground">{previewLb.subtitle}</p>}
            </div>

            <dl className="space-y-2.5 text-sm">
              {[
                { icon: Sun, label: "Mùa", value: previewLb.season || "—" },
                {
                  icon: CalendarDays,
                  label: "Ngày xuất bản",
                  value: formatDateParts(previewLb.published_at || previewLb.created_at)?.date ?? "—",
                },
                { icon: ImageIcon, label: "Số hình ảnh", value: `${previewLb.item_count ?? previewItems.length} hình` },
                { icon: Tag, label: "Sản phẩm gắn kèm", value: `${previewProductCount} sản phẩm` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="size-3.5" />
                    {label}
                  </dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            {previewLb.description && (
              <div>
                <p className="text-sm font-semibold">Mô tả</p>
                <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                  {previewLb.description}
                </p>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <p className="font-semibold">
                  Hình ảnh trong bộ sưu tập ({previewLb.item_count ?? previewItems.length})
                </p>
                <button
                  type="button"
                  onClick={() => goEdit(previewLb)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Xem tất cả
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {previewItems.slice(0, 4).map((it) => (
                  <img
                    key={it.id}
                    src={it.image_url}
                    alt={it.title || ""}
                    className="aspect-[3/4] w-full rounded-xs bg-secondary object-cover"
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => goEdit(previewLb)}>
                <Pencil className="mr-1.5 size-3.5" />
                Chỉnh sửa
              </Button>
              <Button asChild>
                <a href={`/lookbook/${previewLb.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 size-3.5" />
                  Xem trên website
                </a>
              </Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
