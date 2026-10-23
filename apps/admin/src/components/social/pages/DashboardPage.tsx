import { useMemo, useState } from "react";
import { BarChart3, Calendar, CalendarClock, ChevronDown, Filter, Hash, Image as ImageIcon, FileText, LayoutGrid, Lightbulb, MoreHorizontal, Plus, RefreshCw, Search, ShoppingBag, ShoppingCart, Users, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RevenueOrdersChart, Sparkline, Donut } from "../charts";
import { CHANNEL_META, DATE_RANGES, KPI_MOCK } from "../mock";
import type { ChannelAccount, ChannelId, SocialCtx } from "../types";
import { ChannelLogo, Delta, Dot, Pill, PageHeader, card, fmt, inputCls, usd } from "../ui";
import { useUpcomingPosts } from "../useUpcomingPosts";
import { PostStatusPill, PostThumb } from "../PostShared";

const KPI_STYLE: Record<string, { icon: typeof Users; bg: string; fg: string; line: string }> = {
  revenue: { icon: ShoppingBag, bg: "bg-violet-100", fg: "text-violet-600", line: "#7c3aed" },
  orders: { icon: ShoppingCart, bg: "bg-sky-100", fg: "text-sky-600", line: "#3b82f6" },
  engagement: { icon: Users, bg: "bg-emerald-100", fg: "text-emerald-600", line: "#10b981" },
  conversion: { icon: Filter, bg: "bg-orange-100", fg: "text-orange-500", line: "#f59e0b" },
};

const QUICK = [
  { label: "Ý tưởng bài viết", icon: Lightbulb, to: "topic" },
  { label: "Viết nội dung", icon: FileText, to: "idea" },
  { label: "Tạo hình ảnh", icon: ImageIcon, to: "product" },
  { label: "Gợi ý hashtag", icon: Hash, to: "idea" },
  { label: "Lập lịch đăng", icon: CalendarClock, to: "posts" },
] as const;

function Stat({ value, delta }: { value: string; delta: number }) {
  return <div><p className="text-sm font-medium tabular-nums">{value}</p><Delta value={delta} /></div>;
}

export function DashboardPage({ ctx }: { ctx: SocialCtx }) {
  const { channels, go, refreshAll } = ctx;
  const [tab, setTab] = useState<ChannelId | "all">("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [range, setRange] = useState(DATE_RANGES[0]); // TODO(api): truyền range vào API KPI/bảng
  const upcoming = useUpcomingPosts(ctx).filter((p) => p.status !== "published" && p.status !== "failed").slice(0, 5);

  const connected = useMemo(() => channels.filter((c) => c.connected), [channels]);
  const rows = connected.filter((c) =>
    (tab === "all" || c.id === tab) && (status === "all" || c.status === status) && (kind === "all" || CHANNEL_META[c.id].kind === kind) &&
    `${CHANNEL_META[c.id].name} ${c.accountName} ${c.handle}`.toLowerCase().includes(q.toLowerCase()));

  const donut = connected.map((c) => ({ label: CHANNEL_META[c.id].name.replace(" Shop", ""), value: c.conversion, color: CHANNEL_META[c.id].color })).sort((a, b) => b.value - a.value);
  const bars = connected.map((c) => ({ label: CHANNEL_META[c.id].name.replace(" Shop", ""), revenue: c.revenue, orders: c.orders }));

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <PageHeader title="Kênh bán hàng" desc="Quản lý đa kênh, tạo nội dung với AI, theo dõi hiệu quả và tự động hóa tương tác."
        actions={<>
          <Button variant="outline" onClick={() => void refreshAll()} className="gap-2"><RefreshCw className="size-4" />Đồng bộ</Button>
          <label className="relative"><Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <select value={range} onChange={(e) => setRange(e.target.value)} className="h-10 appearance-none rounded-md border border-slate-200 bg-white pl-9 pr-9 text-sm font-medium outline-none focus:border-[#6941c6]">{DATE_RANGES.map((r) => <option key={r}>{r}</option>)}</select></label>
        </>} />

      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_MOCK.map((k) => {
          const s = KPI_STYLE[k.key]; const Icon = s.icon;
          return (
            <div key={k.key} className={cn(card, "flex items-center gap-4 p-4")}>
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl", s.bg, s.fg)}><Icon className="size-6" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-500">{k.label}</p>
                <div className="flex items-end justify-between gap-2"><p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p><Sparkline data={k.spark} color={s.line} className="h-9 w-24 shrink-0" /></div>
                <p className="mt-1 flex items-center gap-2 text-xs text-slate-400"><span className="rounded bg-emerald-50 px-1.5 py-0.5"><Delta value={k.delta} /></span>So với 30 ngày trước</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {/* Bảng kênh */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4">
              <div className="flex gap-1 overflow-x-auto">
                <button onClick={() => setTab("all")} className={cn("flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold", tab === "all" ? "border-[#6941c6] text-[#6941c6]" : "border-transparent text-slate-600 hover:text-slate-900")}><LayoutGrid className="size-4" />Tất cả ({connected.length})</button>
                {connected.map((c) => <button key={c.id} onClick={() => setTab(c.id)} className={cn("flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium", tab === c.id ? "border-[#6941c6] text-[#6941c6]" : "border-transparent text-slate-600 hover:text-slate-900")}><ChannelLogo id={c.id} size="xs" />{CHANNEL_META[c.id].name.replace(" Shop", "")}</button>)}
              </div>
              {ctx.canChannelWrite && <Button size="sm" variant="outline" onClick={() => go("connect")} className="gap-1.5 border-violet-200 bg-violet-50 text-[#6941c6] hover:bg-violet-100"><Plus className="size-4" />Kết nối kênh</Button>}
            </div>
            <div className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
              <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kiếm kênh..." className="pl-9" /></div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inputCls, "sm:w-44")}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="paused">Tạm dừng</option><option value="error">Lỗi kết nối</option></select>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={cn(inputCls, "sm:w-44")}><option value="all">Tất cả loại kênh</option><option value="social">Mạng xã hội</option><option value="marketplace">Sàn TMĐT</option><option value="website">Website</option></select>
              <Button variant="outline" onClick={() => { setQ(""); setStatus("all"); setKind("all"); setTab("all"); }} className="gap-2"><Filter className="size-4" />Lọc</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs font-medium text-slate-500"><tr className="border-y border-slate-100">
                  <th className="w-10 py-3 pl-4"><input type="checkbox" aria-label="Chọn tất cả" /></th><th className="py-3">Kênh</th><th>Trạng thái</th><th>Người theo dõi</th><th>Tương tác (30 ngày)</th><th>Đơn hàng</th><th>Tỷ lệ chuyển đổi</th><th>Doanh thu</th><th className="pr-4 text-center">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((c) => <Row key={c.id} c={c} onOpen={() => go("connect", { channel: c.id })} />)}
                  {!rows.length && <tr><td colSpan={9} className="p-8 text-center text-slate-400">Không có kênh phù hợp.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {/* Biểu đồ */}
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <section className={cn(card, "p-5")}>
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Hiệu quả theo kênh</h2>
                <div className="flex gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><i className="size-3 rounded-sm bg-violet-300" />Doanh thu (USD)</span><span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-[#6941c6]" />Đơn hàng</span></div></div>
              <div className="mt-3"><RevenueOrdersChart items={bars} /></div>
            </section>
            <section className={cn(card, "p-5")}>
              <h2 className="text-lg font-semibold">Tỷ lệ chuyển đổi theo kênh</h2>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
                <Donut items={donut} value="3.6%" label="Tỷ lệ chuyển đổi trung bình" />
                <ul className="space-y-2.5 text-sm">{donut.map((d) => <li key={d.label} className="flex items-center gap-3"><i className="size-2.5 rounded-full" style={{ background: d.color }} /><span className="w-20 text-slate-600">{d.label}</span><span className="font-medium tabular-nums">{d.value.toFixed(1)}%</span></li>)}</ul>
              </div>
            </section>
          </div>
        </div>

        {/* Cột phải */}
        <aside className="space-y-5">
          <section className={cn(card, "p-5")}>
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-violet-100 text-[#6941c6]"><Bot className="size-5" /></span>
              <div className="min-w-0 flex-1"><div className="flex items-center justify-between"><h2 className="font-semibold">AI Content Assistant</h2><span className="rounded-full bg-[#6941c6] px-2 py-0.5 text-[11px] font-semibold text-white">Beta</span></div>
                <p className="mt-1 text-xs text-slate-500">Tạo nội dung hấp dẫn, phù hợp với từng kênh bán hàng bằng AI.</p></div>
            </div>
            {ctx.canContentWrite && <Button onClick={() => go("ai-content")} className="mt-4 w-full gap-2 bg-[#6941c6] hover:bg-[#5b36b0]"><Plus className="size-4" />Tạo content với AI</Button>}
            {ctx.canContentWrite && <div className="mt-3 grid grid-cols-2 gap-2">
              {QUICK.map(({ label, icon: Icon, to }) => (
                <button key={label} onClick={() => (to === "posts" ? go("posts") : go("ai-content", { preset: to }))} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700 hover:border-violet-300 hover:bg-violet-50">
                  <Icon className="size-4 shrink-0 text-[#6941c6]" /><span className="truncate">{label}</span></button>))}
            </div>}
          </section>

          <section className={cn(card, "p-5")}>
            <div className="flex items-center justify-between"><h2 className="font-semibold">Bài viết sắp đăng</h2><button onClick={() => go("posts")} className="text-xs font-medium text-[#6941c6] hover:underline">Xem tất cả →</button></div>
            <ul className="mt-3 space-y-3">
              {upcoming.map((p) => (
                <li key={p.id}>
                  <a
                    href={`/kenhbanhang/baiviet/chitiet/${encodeURIComponent(p.id)}`}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                        e.preventDefault();
                        window.history.pushState(null, "", `/kenhbanhang/baiviet/chitiet/${encodeURIComponent(p.id)}`);
                        go("posts");
                      }
                    }}
                    className="group flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-slate-50 cursor-pointer"
                  >
                    <PostThumb post={p} className="size-14 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium group-hover:text-[#6941c6] transition-colors">
                        <ChannelLogo id={p.channel} size="xs" />
                        <span className="truncate">{p.title}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{p.time}</p>
                    </div>
                    <PostStatusPill status={p.status} />
                  </a>
                </li>
              ))}
              {!upcoming.length && <li className="py-4 text-center text-sm text-slate-400">Chưa có bài viết nào được lên lịch.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ c, onOpen }: { c: ChannelAccount; onOpen: () => void }) {
  const tone = c.status === "active" ? "green" : c.status === "paused" ? "amber" : "rose";
  const text = c.status === "active" ? "Đang hoạt động" : c.status === "paused" ? "Tạm dừng" : "Lỗi kết nối";
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="py-3 pl-4"><input type="checkbox" aria-label={`Chọn ${CHANNEL_META[c.id].name}`} /></td>
      <td className="py-3"><div className="flex items-center gap-3"><ChannelLogo id={c.id} /><div><p className="font-semibold">{CHANNEL_META[c.id].name}</p><p className="text-xs text-slate-500">{c.id === "facebook" || c.id === "shopee" ? c.accountName : c.handle}</p></div></div></td>
      <td><Pill tone={tone}><Dot />{text}</Pill></td>
      <td><Stat value={fmt(c.followers)} delta={c.followersDelta} /></td>
      <td><Stat value={fmt(c.engagement)} delta={c.engagementDelta} /></td>
      <td><Stat value={fmt(c.orders)} delta={c.ordersDelta} /></td>
      <td><Stat value={`${c.conversion.toFixed(1)}%`} delta={c.conversionDelta} /></td>
      <td><Stat value={usd(c.revenue)} delta={c.revenueDelta} /></td>
      <td className="pr-4"><div className="flex items-center justify-center gap-2">
        <button onClick={onOpen} aria-label="Xem hiệu quả" className="grid size-9 place-items-center rounded-md border border-slate-200 text-[#6941c6] hover:bg-violet-50"><BarChart3 className="size-4" /></button>
        <button onClick={onOpen} aria-label="Cấu hình kênh" className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"><MoreHorizontal className="size-4" /></button></div></td>
    </tr>
  );
}
