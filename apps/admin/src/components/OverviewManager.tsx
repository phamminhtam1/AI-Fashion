import { PaymentStatusBadge, OrderStatusBadge } from "./OrderStatusBadges";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Image as ImageIcon,
  Package,
  ShoppingBag,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { adminErrorMessage } from "@/lib/admin-language";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { OverviewExt } from "./overview-shared";

type OverviewManagerProps = {
  onNavigate: (section: string) => void;
  onNavigateToOrder?: (orderNumber: string) => void;
  onNavigateToInventoryProduct?: (productId: string, productName: string) => void;
  onCreate?: () => void;
  userName?: string;
};

type Tone = "green" | "amber" | "blue" | "purple" | "red" | "gray";

const PURPLE = "#6d4aff";
const PURPLE_SOFT = "#c9b9ff";
const DONUT_COLORS = ["#7755e7", "#ec4899", "#f5b94c", "#60a5fa", "#9ca3af"];
const CHANNEL_FRAME = ["Website", "Shopee", "TikTok Shop", "Facebook", "Khác"];

const TONE: Record<Tone, { pill: string; dot: string }> = {
  green: { pill: "border border-emerald-200/80 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  amber: { pill: "border border-amber-200/80 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  blue: { pill: "border border-blue-200/80 bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  purple: { pill: "border border-purple-200 bg-purple-50 text-[#6941c6]", dot: "bg-[#6941c6]" },
  red: { pill: "border border-rose-200/80 bg-rose-50 text-rose-700", dot: "bg-rose-500" },
  gray: { pill: "border border-slate-200 bg-slate-100 text-slate-700", dot: "bg-slate-400" },
};

const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Đang xử lý", tone: "amber" },
  confirmed: { label: "Đã xác nhận", tone: "blue" },
  shipping: { label: "Đang giao", tone: "purple" },
  delivered: { label: "Đã giao", tone: "green" },
  completed: { label: "Hoàn tất", tone: "green" },
  cancelled: { label: "Đã hủy", tone: "red" },
};

const GENERIC_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Đang diễn ra", tone: "green" },
  scheduled: { label: "Sắp diễn ra", tone: "blue" },
  ended: { label: "Đã kết thúc", tone: "gray" },
  published: { label: "Đã xuất bản", tone: "green" },
  draft: { label: "Bản nháp", tone: "purple" },
};

const formatVnd = (value?: number | null) => `${Number(value ?? 0).toLocaleString("vi-VN")} ₫`;
const formatNum = (value?: number | null) => Number(value ?? 0).toLocaleString("vi-VN");
const compactAxis = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}tr` : value >= 1_000 ? `${Math.round(value / 1_000)}k` : String(value);
const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

const fmtDM = (iso?: string | null) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const minutes = Math.max(1, Math.round(diff / 60_000));
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.025)]", className)}>{children}</section>;
}

function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <header className="flex h-[54px] items-center justify-between gap-3 border-b border-slate-100 px-4"><h2 className="truncate admin-section-title text-slate-950">{title}</h2>{action}</header>;
}

function ViewAll({ onClick }: { onClick: () => void }) {
  return <Button variant="ghost" size="sm" onClick={onClick} className="h-9 shrink-0 gap-1 rounded-sm px-3 text-sm font-medium text-violet-700 hover:bg-violet-50">Xem tất cả <ArrowRight className="size-3" /></Button>;
}

function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold tracking-tight shadow-2xs", TONE[tone].pill)}>
      <span className={cn("size-1.5 rounded-full", TONE[tone].dot)} />
      {children}
    </span>
  );
}

function Thumb({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  return src
    ? <img src={src} alt={alt} className={cn("shrink-0 rounded-sm bg-slate-100 object-cover", className)} />
    : <span className={cn("flex shrink-0 items-center justify-center rounded-sm bg-slate-100 text-slate-300", className)}><ImageIcon className="size-3.5" /></span>;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").filter(Boolean).slice(-2).map((word) => word[0]).join("").toUpperCase();
  return <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-700">{initials || "?"}</span>;
}

function Trend({ value }: { value?: number }) {
  if (value === undefined) return <span className="text-xs text-slate-400">Chưa đủ dữ liệu</span>;
  const up = value >= 0;
  return <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-emerald-600" : "text-rose-600")}>{up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}{Math.abs(value).toFixed(1)}%</span>;
}

function MetricCard({ icon: Icon, label, value, trend, series, color, tint }: { icon: LucideIcon; label: string; value: string; trend?: number; series: number[]; color: string; tint: string }) {
  const points = (series.length > 1 ? series : [0, 0]).map((point, index) => ({ point, index }));
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-sm", tint)}><Icon className="size-[18px]" /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-500">{label}</p><p className="mt-0.5 truncate admin-metric text-slate-950 tabular-nums">{value}</p><div className="mt-1 flex items-center gap-1.5"><Trend value={trend} /><span className="truncate text-xs text-slate-400">so với kỳ trước</span></div></div>
      <div className="hidden h-12 w-16 shrink-0 2xl:block"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points}><Area type="monotone" dataKey="point" stroke={color} strokeWidth={1.7} fill="transparent" dot={false} /></AreaChart></ResponsiveContainer></div>
    </div>
  );
}

function PlaceholderRows({ columns, rows = 3 }: { columns: number; rows?: number }) {
  return <>{Array.from({ length: rows }).map((_, row) => <tr key={row} className="border-t border-slate-100">{Array.from({ length: columns }).map((__, column) => <td key={column} className="px-3.5 py-3"><span className={cn("block h-2 rounded-full bg-slate-100", column === 0 ? "w-4/5" : "w-3/5")} /></td>)}</tr>)}</>;
}

const th = "px-3.5 py-3 text-left text-sm font-semibold tracking-tight text-slate-700";
const td = "px-3.5 py-3 align-middle text-sm text-slate-900";

export function OverviewManager({ onNavigate, onNavigateToOrder, userName = "Admin" }: OverviewManagerProps) {
  const [data, setData] = useState<OverviewExt | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 29);
    return { from: toInputDate(from), to: toInputDate(to) };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const response = (await adminApi.overview({ from: range.from, to: range.to })) as OverviewExt;
        if (!cancelled) setData(response);
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? adminErrorMessage(error) : "Không tải được dữ liệu tổng quan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [range.from, range.to]);

  const daily = useMemo(() => (data?.revenue_by_day ?? []).filter((item) => item.date >= range.from && item.date <= range.to).map((item) => {
    const parts = item.date.split("-");
    return { ...item, label: parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date };
  }), [data?.revenue_by_day, range.from, range.to]);

  const categories = data?.revenue_by_category ?? [];
  const topProducts = data?.top_products ?? [];
  const channels = data?.sales_channels ?? [];
  const promotions = data?.active_promotions ?? [];
  const posts = data?.recent_posts ?? [];
  const lookbooks = data?.recent_lookbooks ?? [];
  const recentOrders = (data?.recent_orders ?? []).slice(0, 5);
  const trends = data?.trends ?? {};
  const revenueSeries = daily.slice(-12).map((item) => item.revenue);
  const orderSeries = daily.slice(-12).map((item) => item.orders);
  const productSeries: number[] = [];
  const customerSeries: number[] = [];

  const goOrder = (orderNumber: string) => onNavigateToOrder ? onNavigateToOrder(orderNumber) : onNavigate("orders");
  const statusOf = (status: string) => GENERIC_STATUS[status] ?? { label: status, tone: "gray" as Tone };

  return (
    <div className="overview-dashboard mx-auto max-w-[1720px] space-y-3.5 pb-8">
      <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div><h1 className="admin-page-title text-slate-950">Xin chào, {userName}! <span aria-hidden>👋</span></h1><p className="mt-1 text-sm text-slate-500">Tổng quan hoạt động kinh doanh và nội dung thương hiệu ÉLANE.</p></div>
        <div className="inline-flex h-9 w-fit items-center gap-2 rounded-sm border border-slate-200 bg-white px-3 shadow-[0_1px_2px_rgba(15,23,42,0.025)]"><CalendarDays className="size-3.5 text-slate-400" /><input type="date" value={range.from} max={range.to} onChange={(event) => event.target.value && setRange((current) => ({ ...current, from: event.target.value }))} className="w-[125px] bg-transparent text-sm font-medium text-slate-700 outline-none" aria-label="Từ ngày" /><span className="text-slate-300">—</span><input type="date" value={range.to} min={range.from} onChange={(event) => event.target.value && setRange((current) => ({ ...current, to: event.target.value }))} className="w-[125px] bg-transparent text-sm font-medium text-slate-700 outline-none" aria-label="Đến ngày" /></div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={WalletCards} label="Tổng doanh thu" value={loading ? "…" : formatVnd(data?.total_revenue_vnd)} trend={trends.revenue} series={revenueSeries} color="#7c3aed" tint="bg-violet-50 text-violet-600" />
        <MetricCard icon={ShoppingBag} label="Đơn hàng mới" value={loading ? "…" : formatNum(data?.total_orders)} trend={trends.orders} series={orderSeries} color="#3b82f6" tint="bg-blue-50 text-blue-600" />
        <MetricCard icon={Users} label="Khách hàng mới" value={loading ? "…" : formatNum(data?.new_customers)} trend={trends.customers} series={customerSeries} color="#10b981" tint="bg-emerald-50 text-emerald-600" />
        <MetricCard icon={Package} label="Sản phẩm đã bán" value={loading ? "…" : formatNum(data?.total_items_sold)} trend={trends.items} series={productSeries} color="#f59e0b" tint="bg-amber-50 text-amber-600" />
      </section>

      <section className="overview-charts">
        <Card>
          <CardHeader title="Doanh thu & Đơn hàng" action={<span className="rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">Theo ngày</span>} />
          <div className="px-3 pb-3 pt-2"><div className="mb-1.5 flex justify-center gap-5 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-violet-300" />Doanh thu (₫)</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-violet-600" />Số đơn hàng</span></div><div className="overview-chart">
            {daily.length === 0 ? <div className="flex h-full items-center justify-center text-xs text-slate-400">Chưa có dữ liệu trong khoảng thời gian này.</div> : <ResponsiveContainer width="100%" height="100%"><ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="2 3" vertical={false} stroke="#e9edf3" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7c8798", fontSize: 12 }} minTickGap={20} /><YAxis yAxisId="money" axisLine={false} tickLine={false} tick={{ fill: "#7c8798", fontSize: 12 }} tickFormatter={compactAxis} width={44} /><YAxis yAxisId="orders" orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#7c8798", fontSize: 12 }} width={28} allowDecimals={false} /><Tooltip content={({ active, payload }) => { if (!active || !payload?.length) return null; const item = payload[0].payload; return <div className="rounded-sm bg-slate-950 px-3 py-2 text-white shadow-xl"><p className="text-xs text-white/60">{item.label}</p><p className="mt-0.5 text-xs font-semibold">{formatVnd(item.revenue)}</p><p className="text-xs text-white/60">{formatNum(item.orders)} đơn</p></div>; }} /><Bar yAxisId="money" dataKey="revenue" fill={PURPLE_SOFT} radius={[2, 2, 0, 0]} maxBarSize={13} /><Line yAxisId="orders" type="monotone" dataKey="orders" stroke={PURPLE} strokeWidth={1.8} dot={{ r: 2.5, fill: "white", stroke: PURPLE, strokeWidth: 1.5 }} /></ComposedChart></ResponsiveContainer>}
          </div></div>
        </Card>

        <Card>
          <CardHeader title="Tỷ lệ doanh thu theo danh mục" action={<span className="rounded-sm border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">Theo doanh thu</span>} />
          <div className="flex min-h-[294px] items-center gap-4 p-4">
            <div className="overview-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories.length ? categories : [{ name: "Chưa có dữ liệu", percent: 100 }]} dataKey="percent" nameKey="name" innerRadius={50} outerRadius={77} paddingAngle={categories.length ? 1 : 0} stroke="none">{(categories.length ? categories : [{ name: "", percent: 100 }]).map((item, index) => <Cell key={item.name || index} fill={categories.length ? DONUT_COLORS[index % DONUT_COLORS.length] : "#eef0f4"} />)}</Pie></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="max-w-[90px] truncate text-sm tabular-nums text-slate-950">{formatVnd(data?.total_revenue_vnd)}</strong><span className="text-xs text-slate-400">Tổng doanh thu</span></div></div>
            <ul className="min-w-0 flex-1 space-y-3">{categories.length ? categories.slice(0, 5).map((item, index) => <li key={item.name} className="flex items-center justify-between gap-2 text-sm"><span className="flex min-w-0 items-center gap-2 text-slate-600"><span className="size-2 shrink-0 rounded-full" style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }} /><span className="truncate">{item.name}</span></span><strong className="tabular-nums text-slate-800">{item.percent.toFixed(1)}%</strong></li>) : Array.from({ length: 5 }).map((_, index) => <li key={index} className="flex items-center justify-between gap-3"><span className="h-2 w-20 rounded-full bg-slate-100" /><span className="h-2 w-8 rounded-full bg-slate-100" /></li>)}</ul>
          </div>
        </Card>
      </section>

      <section className="overview-operations">
        <Card>
          <CardHeader title="Sản phẩm bán chạy" action={<ViewAll onClick={() => onNavigate("products")} />} />
          <div className="overflow-x-auto"><table className="w-full min-w-[490px] table-fixed text-sm"><colgroup><col className="w-8" /><col /><col className="w-[100px]" /><col className="w-[68px]" /><col className="w-[108px]" /></colgroup><thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold tracking-tight text-slate-700"><tr><th className={th}>#</th><th className={th}>Sản phẩm</th><th className={th}>Danh mục</th><th className={cn(th, "text-center")}>Đã bán</th><th className={cn(th, "text-right")}>Doanh thu</th></tr></thead><tbody className="divide-y divide-slate-100">{topProducts.length ? topProducts.slice(0, 5).map((product, index) => <tr key={product.id} className="hover:bg-slate-50"><td className={cn(td, "font-medium text-slate-400")}>{index + 1}</td><td className={td}><div className="flex min-w-0 items-center gap-2.5"><Thumb src={product.image_url} alt={product.name} className="h-9 w-8" /><div className="min-w-0"><p className="truncate font-semibold text-slate-950">{product.name}</p><p className="truncate text-xs font-medium text-slate-400">{product.sku || "Chưa có SKU"}</p></div></div></td><td className={cn(td, "truncate font-medium text-slate-600")}>{product.category}</td><td className={cn(td, "text-center font-semibold tabular-nums text-slate-950")}>{formatNum(product.sold)}</td><td className={cn(td, "text-right font-semibold tabular-nums text-slate-950")}>{formatVnd(product.revenue_vnd)}</td></tr>) : <PlaceholderRows columns={5} rows={5} />}</tbody></table></div>
        </Card>

        <Card>
          <CardHeader title="Kênh bán hàng" action={<span className="text-xs text-slate-400">Theo đơn hàng</span>} />
          <div className="space-y-3.5 p-4">{(channels.length ? channels : CHANNEL_FRAME.map((name, index) => ({ key: String(index), name, percent: 0, orders: 0 }))).map((channel, index) => <div key={channel.key} className="overview-channel"><span className={cn("flex size-[22px] items-center justify-center rounded-sm font-semibold", ["bg-violet-100 text-violet-700", "bg-orange-100 text-orange-700", "bg-slate-900 text-white", "bg-blue-100 text-blue-700", "bg-slate-100 text-slate-600"][index % 5])}>{channel.name.slice(0, 1)}</span><span className="truncate font-medium text-slate-700">{channel.name}</span><span className="h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, channel.percent)}%` }} /></span><strong className="text-right font-semibold tabular-nums text-slate-950">{channels.length ? `${channel.percent.toFixed(1)}%` : "—"}</strong><span className="text-right font-medium tabular-nums text-slate-500">{channels.length ? `${formatNum(channel.orders)} đơn` : "—"}</span></div>)}</div>
        </Card>

        <Card>
          <CardHeader title="Đơn hàng gần đây" action={<ViewAll onClick={() => onNavigate("orders")} />} />
          <div className="overflow-x-auto"><table className="w-full min-w-[750px] table-fixed text-sm"><colgroup><col style={{width: "14%"}} /><col style={{width: "19%"}} /><col style={{width: "16%"}} /><col style={{width: "15%"}} /><col style={{width: "14%"}} /><col style={{width: "12%"}} /><col style={{width: "10%"}} /></colgroup><thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold tracking-tight text-slate-700"><tr><th className={th}>Mã đơn</th><th className={th}>Khách hàng</th><th className={th}>Phương thức</th><th className={th}>Thanh toán</th><th className={cn(th, "text-right")}>Số tiền</th><th className={th}>Trạng thái</th><th className={cn(th, "text-right")}>Thời gian</th></tr></thead><tbody className="divide-y divide-slate-100">{recentOrders.length ? recentOrders.map((order) => { return <tr key={order.id} onClick={() => goOrder(order.order_number)} className="cursor-pointer transition-colors hover:bg-slate-50"><td className={cn(td, "truncate font-semibold text-violet-700 hover:underline")}>#{order.order_number}</td><td className={td}><div className="flex min-w-0 items-center gap-2"><Avatar name={order.customer_name} /><span className="truncate font-semibold text-slate-950">{order.customer_name}</span></div></td><td className={cn(td, "font-medium text-slate-600")}>{{ cod: "Thanh toán khi nhận", bank: "Chuyển khoản", bank_transfer: "Chuyển khoản", card: "Thẻ", cash: "Tiền mặt" }[order.payment_method] ?? "Khác"}</td><td className={td}><PaymentStatusBadge status={order.payment_status} orderStatus={order.status} /></td><td className={cn(td, "whitespace-nowrap text-right font-semibold tabular-nums text-slate-950")}>{formatVnd(order.grand_total_vnd)}</td><td className={td}><OrderStatusBadge status={order.status} fulfillmentStatus={order.fulfillment_status} paymentStatus={order.payment_status} /></td><td className={cn(td, "truncate text-right font-medium text-slate-500 tabular-nums")}>{timeAgo(order.placed_at)}</td></tr>; }) : <PlaceholderRows columns={7} rows={5} />}</tbody></table></div>
        </Card>
      </section>

      <section className="overview-content">
        <Card>
          <CardHeader title="Khuyến mãi đang diễn ra" action={<ViewAll onClick={() => onNavigate("promotions")} />} />
          <div className="overflow-x-auto"><table className="w-full min-w-[430px] table-fixed text-sm"><colgroup><col /><col style={{width: 90}} /><col style={{width: 135}} /></colgroup><thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold tracking-tight text-slate-700"><tr><th className={th}>Tên chương trình</th><th className={th}>Giảm giá</th><th className={th}>Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-100">{promotions.length ? promotions.slice(0, 3).map((promotion) => { const status = statusOf(promotion.status); return <tr key={promotion.id}><td className={td}><div className="flex min-w-0 items-center gap-2.5"><Thumb src={promotion.image_url} alt={promotion.name} className="h-9 w-11" /><div className="min-w-0"><p className="truncate font-semibold text-slate-950">{promotion.name}</p><p className="truncate text-xs font-medium text-slate-500">{fmtDM(promotion.start_at)} – {fmtDM(promotion.end_at)}</p></div></div></td><td className={cn(td, "font-semibold text-violet-700")}>{promotion.discount_label}</td><td className={td}><StatusPill tone={status.tone}>{status.label}</StatusPill></td></tr>; }) : <PlaceholderRows columns={3} />}</tbody></table></div>
        </Card>

        <Card>
          <CardHeader title="Bài đăng ÉLANEwoman mới nhất" action={<ViewAll onClick={() => onNavigate("elanewoman")} />} />
          <div className="overflow-x-auto"><table className="w-full min-w-[420px] table-fixed text-sm"><colgroup><col /><col style={{width: 85}} /><col style={{width: 135}} /></colgroup><thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold tracking-tight text-slate-700"><tr><th className={th}>Bài viết</th><th className={cn(th, "text-right")}>Lượt xem</th><th className={th}>Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-100">{posts.length ? posts.slice(0, 3).map((post) => { const status = statusOf(post.status); return <tr key={post.id}><td className={td}><div className="flex items-center gap-2.5"><Thumb src={post.image_url} alt={post.title} className="h-9 w-12" /><p className="line-clamp-2 font-semibold leading-5 text-slate-950">{post.title}</p></div></td><td className={cn(td, "text-right font-medium tabular-nums text-slate-600")}>{formatNum(post.views)}</td><td className={td}><StatusPill tone={status.tone}>{status.label}</StatusPill></td></tr>; }) : <PlaceholderRows columns={3} />}</tbody></table></div>
        </Card>

        <Card>
          <CardHeader title="Bộ ảnh mới nhất" action={<ViewAll onClick={() => onNavigate("lookbook")} />} />
          <div className="overflow-x-auto"><table className="w-full min-w-[450px] table-fixed text-sm"><colgroup><col /><col style={{width: 85}} /><col style={{width: 135}} /></colgroup><thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold tracking-tight text-slate-700"><tr><th className={th}>Bộ ảnh / Mùa</th><th className={cn(th, "text-right")}>Lượt xem</th><th className={th}>Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-100">{lookbooks.length ? lookbooks.slice(0, 3).map((lookbook) => { const status = statusOf(lookbook.status); return <tr key={lookbook.id}><td className={td}><div className="flex items-center gap-2.5"><Thumb src={lookbook.cover_image_url} alt={lookbook.title} className="h-9 w-12" /><div className="min-w-0"><p className="truncate font-semibold text-slate-950">{lookbook.title}</p><p className="truncate text-xs font-medium text-slate-500">{lookbook.season || "—"}</p></div></div></td><td className={cn(td, "text-right font-medium tabular-nums text-slate-600")}>{formatNum(lookbook.views)}</td><td className={td}><StatusPill tone={status.tone}>{status.label}</StatusPill></td></tr>; }) : <PlaceholderRows columns={3} />}</tbody></table></div>
        </Card>
      </section>
    </div>
  );
}






