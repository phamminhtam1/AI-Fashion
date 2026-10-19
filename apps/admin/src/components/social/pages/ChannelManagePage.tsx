import { useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowUp, ChevronDown, ClipboardCheck, ClipboardList, Copy, Crown,
  ExternalLink, Eye, FileClock, FolderSync, Heart, Info, LayoutGrid, Lock, MessageCircle,
  Package, PenSquare, RefreshCw, ShoppingBag, Sparkles, Unplug, BadgeCheck, Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANNEL_META } from "../mock";
import type { ChannelId, SocialCtx } from "../types";
import { ChannelLogo, card, fmt } from "../ui";

type ManageTab = "overview" | "sync" | "posts" | "automation" | "inbox" | "security" | "logs";

const TABS: { id: ManageTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Tổng quan", icon: LayoutGrid },
  { id: "sync", label: "Đồng bộ", icon: FolderSync },
  { id: "posts", label: "Đăng bài", icon: PenSquare },
  { id: "automation", label: "AI & Tự động hóa", icon: Sparkles },
  { id: "inbox", label: "Tin nhắn & Bình luận", icon: MessageCircle },
  { id: "security", label: "Quyền & Bảo mật", icon: Lock },
  { id: "logs", label: "Nhật ký hoạt động", icon: FileClock },
];

const OUTLINE_VIOLET =
  "h-8 border-violet-200 bg-white px-3 text-xs font-medium text-[#6941c6] hover:bg-violet-50 hover:text-[#6941c6]";

/* ───────────── Công tắc xanh (Bật/Tắt) ───────────── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-emerald-500" : "bg-slate-300")}
    >
      <span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

/* ───────────── Pill tăng trưởng ↑ 2.5% ───────────── */
function Delta({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600">
      <ArrowUp className="size-3" />
      {value}
    </span>
  );
}

/* ───────────── Biểu đồ xu hướng (đường cong mượt) ───────────── */
const TREND = [
  { date: "13/06", k: 7.3 },
  { date: "14/06", k: 6.2 },
  { date: "15/06", k: 7.5 },
  { date: "16/06", k: 12.2 },
  { date: "17/06", k: 12.8 },
  { date: "18/06", k: 14 },
  { date: "19/06", k: 14.6 },
];

/** Catmull-Rom → Bezier để đường cong mượt. */
function smoothPath(pts: [number, number][]) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function TrendChart() {
  const pts = TREND.map((p, i) => [40 + i * 76, 160 - p.k * 9] as [number, number]);
  const line = smoothPath([[28, pts[0][1]], ...pts, [530, pts[pts.length - 1][1]]]);
  const area = `${line} L 530 160 L 28 160 Z`;

  return (
    <svg viewBox="0 0 540 185" className="mt-4 h-auto w-full select-none" role="img" aria-label="Xu hướng người theo dõi 7 ngày qua">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[["15K", 25], ["10K", 70], ["5K", 115], ["0", 160]].map(([label, y]) => (
        <g key={label}>
          <text x="0" y={Number(y) + 4} fill="#94a3b8" fontSize="10">{label}</text>
          <line x1="28" x2="530" y1={y} y2={y} stroke="#f1f5f9" />
        </g>
      ))}
      <path d={area} fill="url(#trendFill)" />
      <path d={line} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
      {TREND.map((p, i) => (
        <text key={p.date} x={40 + i * 76} y="180" fill="#94a3b8" fontSize="11" textAnchor="middle">{p.date}</text>
      ))}
    </svg>
  );
}

/* ───────────── Hàng đồng bộ dữ liệu ───────────── */
function SyncRow({ icon: Icon, tone, title, desc, time, on, setOn }: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  desc: string;
  time: string;
  on: boolean;
  setOn: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tone)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">Lần đồng bộ: {time}</p>
      </div>
      <div className="flex items-center gap-2">
        <Toggle checked={on} onChange={setOn} />
        <span className={cn("w-6 text-xs font-semibold", on ? "text-emerald-600" : "text-slate-400")}>{on ? "Bật" : "Tắt"}</span>
      </div>
    </div>
  );
}

const POSTS = [
  { title: "BST Thu Đông 2026", date: "12/06/2024 14:00", likes: "1.2K", comments: 56, img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80" },
  { title: "Phối đồ công sở hiện đại", date: "12/06/2024 13:45", likes: "980", comments: 34, img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80" },
  { title: "Tips mix đồ hàng tuần", date: "12/06/2024 13:20", likes: "2.1K", comments: 120, img: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&h=120&q=80" },
];

const ACTIVITIES = [
  { icon: ShoppingBag, tone: "text-emerald-600 bg-emerald-50", text: "Đồng bộ sản phẩm thành công", time: "12/06/2024 14:00" },
  { icon: PenSquare, tone: "text-indigo-600 bg-indigo-50", text: "Bài viết đã được đăng", time: "12/06/2024 13:45" },
  { icon: MessageCircle, tone: "text-rose-500 bg-rose-50", text: "Nhận 12 bình luận mới", time: "12/06/2024 13:20" },
  { icon: ClipboardCheck, tone: "text-emerald-600 bg-emerald-50", text: "Đồng bộ đơn hàng thành công", time: "12/06/2024 12:10" },
  { icon: Sparkles, tone: "text-indigo-600 bg-indigo-50", text: "Trả lời tin nhắn tự động", time: "12/06/2024 11:30" },
  { icon: Package, tone: "text-emerald-600 bg-emerald-50", text: "Cập nhật tồn kho thành công", time: "12/06/2024 10:15" },
  { icon: AlertCircle, tone: "text-rose-500 bg-rose-50", text: "Có lỗi kết nối API (đã tự động thử lại)", time: "12/06/2024 09:45" },
];

export function ChannelManagePage({ ctx }: { ctx: SocialCtx }) {
  const [tab, setTab] = useState<ManageTab>("overview");
  const [period, setPeriod] = useState("7 ngày qua");

  // Kênh hiện tại đang quản lý (ưu tiên activeChannel hoặc instagram nếu chưa có)
  const channelId: ChannelId = ctx.activeChannel || "instagram";
  const channel = ctx.channels.find((c) => c.id === channelId) ?? {
    id: channelId,
    connected: true,
    status: "active" as const,
    accountName: "ÉLANE Fashion",
    handle: "@elane.shop.vn",
    url: "https://instagram.com/elane.fashion",
    pageId: "178414002938475",
    connectedAt: "19/10/2026 00:47",
    followers: 12450,
    followersDelta: 2.5,
    engagement: 124,
    engagementDelta: 12,
    orders: 0,
    ordersDelta: 0,
    conversion: 0,
    conversionDelta: 0,
    revenue: 0,
    revenueDelta: 0,
  };

  const meta = CHANNEL_META[channelId];

  const [syncProducts, setSyncProducts] = useState(true);
  const [syncOrders, setSyncOrders] = useState(true);
  const [syncStock, setSyncStock] = useState(true);

  const appId = ctx.settings?.appId || "2547170562468599";
  const graphVersion = ctx.settings?.graphVersion || "v23.0";

  function copyAppId() {
    navigator.clipboard.writeText(appId);
    toast.success("Đã sao chép App ID");
  }

  function handleDisconnect() {
    if (window.confirm(`Bạn có chắc chắn muốn ngắt kết nối ${meta.name}? Dữ liệu sẽ dừng đồng bộ.`)) {
      ctx.disconnectChannel(channelId);
      toast.success(`Đã ngắt kết nối ${meta.name}`);
      ctx.go("connect");
    }
  }

  return (
    <div className="space-y-5 pb-12 text-slate-900">
      {/* ───────── HEADER ───────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => ctx.go("connect")}
            className="mt-1.5 grid size-8 place-items-center rounded-lg text-slate-700 hover:bg-slate-100"
            aria-label="Quay lại"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Quản lý kênh – {meta.name}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Đang hoạt động
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý cấu hình, đồng bộ dữ liệu và tự động hóa cho kênh {meta.name} của ÉLANE.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void ctx.refreshAll()} className="h-9 gap-2 bg-white text-sm font-medium text-slate-800">
            <RefreshCw className="size-4" />
            Đồng bộ ngay
          </Button>
          <Button variant="outline" asChild className="h-9 gap-2 bg-white text-sm font-medium text-slate-800">
            <a href={channel.url || "#"} target="_blank" rel="noreferrer">
              Xem trên {meta.name}
              <ExternalLink className="size-4" />
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={handleDisconnect}
            className="h-9 gap-2 border-rose-300 bg-white text-sm font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <Unplug className="size-4" />
            Ngắt kết nối
          </Button>
        </div>
      </div>

      {/* ───────── HERO CARD ───────── */}
      <section className={cn(card, "p-5")}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)_minmax(0,360px)]">
          {/* Cột 1: thông tin tài khoản */}
          <div className="flex flex-col">
            <div className="flex items-start gap-4">
              <div className="size-[68px] shrink-0">
                <div className="origin-top-left scale-[1.4]">
                  <ChannelLogo id={channelId} size="lg" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-lg font-bold">{channel.accountName || "ÉLANE Fashion"}</h2>
                  <BadgeCheck className="size-[18px] shrink-0 fill-blue-500 text-white" />
                </div>
                <a
                  href={channel.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-[#6941c6]"
                >
                  {channel.handle || "@elane.shop.vn"}
                  <ExternalLink className="size-3" />
                </a>
                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                  <div>
                    <dt className="text-[11px] text-slate-400">Loại tài khoản</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">Business</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-400">Danh mục</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">Thời trang &amp; Phụ kiện</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-400">Kết nối lần cuối</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">{channel.connectedAt || "19/10/2026 00:47"}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="mt-auto pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => ctx.go("add-channel", { wizardChannel: channelId })}
                className={OUTLINE_VIOLET}
              >
                Đổi tài khoản
              </Button>
            </div>
          </div>

          {/* Cột 2: 3 chỉ số */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 border-slate-100 lg:border-x">
            <div className="flex flex-col justify-center px-5 lg:px-6">
              <p className="text-2xl font-bold tabular-nums">{fmt(channel.followers || 12450)}</p>
              <p className="mt-0.5 text-sm text-slate-600">Người theo dõi</p>
              <div className="mt-2"><Delta value="2.5%" /></div>
              <p className="mt-1.5 text-xs text-slate-400">so với 7 ngày trước</p>
            </div>
            <div className="flex flex-col justify-center px-5 lg:px-6">
              <p className="text-2xl font-bold tabular-nums">124</p>
              <p className="mt-0.5 text-sm text-slate-600">Bài viết gần đây</p>
              <div className="mt-2"><Delta value="12%" /></div>
              <p className="mt-1.5 text-xs text-slate-400">so với 7 ngày trước</p>
            </div>
            <div className="flex flex-col justify-center px-5 lg:px-6">
              <p className="text-2xl font-bold tabular-nums">0</p>
              <p className="mt-0.5 text-sm text-slate-600">Đơn hàng</p>
              <p className="mt-2 text-sm text-slate-400">—</p>
              <p className="mt-1.5 text-xs text-slate-400">Chưa có dữ liệu</p>
            </div>
          </div>

          {/* Cột 3: trạng thái kết nối */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Trạng thái kết nối</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success("Kết nối ổn định và dữ liệu đã được xác thực")}
                className="h-8 gap-1.5 bg-white px-3 text-xs font-medium text-slate-800"
              >
                <Info className="size-3.5" />
                Kiểm tra kết nối
              </Button>
            </div>
            <ul className="mt-3 space-y-2.5 text-sm">
              {[
                ["OAuth:", "Hoạt động"],
                ["Webhook:", "Đã xác minh"],
                ["Quyền truy cập:", "Đầy đủ"],
                ["Tự động đồng bộ:", "Bật"],
              ].map(([label, value]) => (
                <li key={label} className="flex items-center gap-2.5">
                  <Check className="size-[18px] shrink-0 rounded-full bg-emerald-500 p-[3px] text-white" />
                  <span className="text-slate-700">
                    {label} <span className="font-semibold text-emerald-600">{value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────── TAB BAR ───────── */}
      <nav className={cn(card, "flex items-stretch justify-between overflow-x-auto p-0")}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-6 py-4 text-sm font-medium transition-colors",
                active
                  ? "border-[#6941c6] bg-violet-50 text-[#6941c6]"
                  : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon className={cn("size-4", active ? "text-[#6941c6]" : "text-slate-400")} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* ───────── TAB TỔNG QUAN ───────── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* Hàng 1 */}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
            {/* Hiệu quả kênh */}
            <section className={cn(card, "p-5")}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Hiệu quả kênh</h3>
                <div className="relative">
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="h-8 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50"
                  >
                    <option>7 ngày qua</option>
                    <option>30 ngày qua</option>
                    <option>Tháng này</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-slate-500" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: Heart, color: "fill-rose-500 text-rose-500", value: "12,450", label: "Người theo dõi", delta: "2.5%" },
                  { icon: Eye, color: "text-blue-600", value: "86,320", label: "Lượt tiếp cận", delta: "18%" },
                  { icon: MessageCircle, color: "fill-blue-600 text-blue-600", value: "2,460", label: "Lượt tương tác", delta: "12%" },
                  { icon: ShoppingBag, color: "text-rose-600", value: "124", label: "Click vào shop", delta: "8%" },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <k.icon className={cn("size-4", k.color)} />
                    <p className="mt-2 text-base font-bold tabular-nums">{k.value}</p>
                    <p className="text-[11px] text-slate-500">{k.label}</p>
                    <div className="mt-1.5"><Delta value={k.delta} /></div>
                  </div>
                ))}
              </div>

              <TrendChart />
            </section>

            {/* Quyền và tính năng */}
            <section className={cn(card, "flex flex-col p-5")}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">Quyền và tính năng</h3>
                <Button variant="outline" size="sm" onClick={() => toast.info("Đang kiểm tra và đồng bộ lại quyền...")} className={OUTLINE_VIOLET}>
                  Cập nhật quyền
                </Button>
              </div>

              <ul className="mt-4 space-y-3.5">
                {[
                  "Quản lý nội dung trang (đăng bài, story, reels)",
                  "Đọc và trả lời tin nhắn",
                  "Đọc và quản lý bình luận",
                  "Truy cập thông tin thống kê",
                  "Quản lý quảng cáo (tùy chọn)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check className="mt-0.5 size-[18px] shrink-0 rounded-full bg-emerald-500 p-[3px] text-white" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex items-start gap-3 rounded-xl border border-violet-100 bg-violet-50/70 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-500">
                  <Crown className="size-5 fill-amber-400" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold">Quyền đầy đủ</h4>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Tài khoản đã được cấp đầy đủ quyền cần thiết để sử dụng tất cả tính năng của hệ thống.
                  </p>
                </div>
              </div>
            </section>

            {/* Tích hợp Meta App */}
            <section className={cn(card, "flex flex-col p-5")}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">Tích hợp Meta App</h3>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">Đã cấu hình</span>
                  <ChevronDown className="size-4 text-slate-400" />
                </div>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                Thông tin Meta App dùng chung cho tất cả tài khoản Instagram.
              </p>

              <div className="mt-4 space-y-3.5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">App ID</label>
                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 pl-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{appId}</span>
                    <button
                      type="button"
                      onClick={copyAppId}
                      title="Sao chép"
                      className="ml-2 grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-800"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Graph API version</label>
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">{graphVersion}</div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Webhook</label>
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Đã xác minh
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => ctx.go("add-channel", { wizardChannel: channelId })}
                className="mt-auto w-full bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Xem chi tiết cấu hình
              </Button>
            </section>
          </div>

          {/* Hàng 2 */}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            {/* Đồng bộ dữ liệu */}
            <section className={cn(card, "p-5")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Đồng bộ dữ liệu</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Tự động đồng bộ sản phẩm, đơn hàng và thông tin.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Mở cài đặt đồng bộ nâng cao")} className={OUTLINE_VIOLET}>
                  Cấu hình
                </Button>
              </div>

              <div className="mt-3 divide-y divide-slate-100">
                <SyncRow icon={ShoppingBag} tone="bg-emerald-50 text-emerald-600" title="Sản phẩm" desc="Đồng bộ sản phẩm từ hệ thống lên Instagram Shop." time="19/10/2026 14:00" on={syncProducts} setOn={setSyncProducts} />
                <SyncRow icon={ClipboardCheck} tone="bg-violet-50 text-[#6941c6]" title="Đơn hàng" desc="Đồng bộ đơn hàng từ Instagram về hệ thống." time="19/10/2026 13:30" on={syncOrders} setOn={setSyncOrders} />
                <SyncRow icon={ClipboardList} tone="bg-violet-50 text-[#6941c6]" title="Tồn kho" desc="Cập nhật tồn kho tự động." time="19/10/2026 12:10" on={syncStock} setOn={setSyncStock} />
              </div>
            </section>

            {/* Lịch đăng gần đây */}
            <section className={cn(card, "p-5")}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Lịch đăng gần đây</h3>
                <Button variant="outline" size="sm" onClick={() => ctx.go("posts")} className={OUTLINE_VIOLET}>
                  Xem tất cả
                </Button>
              </div>

              <div className="mt-4 space-y-3.5">
                {POSTS.map((p) => (
                  <div key={p.title} className="flex items-center gap-3">
                    <img src={p.img} alt={p.title} loading="lazy" className="size-[52px] shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{p.date}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-1.5">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Đã đăng</span>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Heart className="size-3.5" />{p.likes}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="size-3.5" />{p.comments}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Hoạt động gần đây */}
            <section className={cn(card, "p-5")}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Hoạt động gần đây</h3>
                <Button variant="outline" size="sm" onClick={() => setTab("logs")} className={OUTLINE_VIOLET}>
                  Xem tất cả
                </Button>
              </div>

              <ul className="mt-4 space-y-3">
                {ACTIVITIES.map((a) => (
                  <li key={a.text} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={cn("grid size-[22px] shrink-0 place-items-center rounded-md", a.tone)}>
                        <a.icon className="size-3" />
                      </span>
                      <span className="truncate text-slate-700">{a.text}</span>
                    </div>
                    <span className="shrink-0 text-slate-400">{a.time}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* ───────── CÁC TAB KHÁC ───────── */}
      {tab === "sync" && (
        <section className={cn(card, "p-6")}>
          <h2 className="text-lg font-semibold">Cấu hình đồng bộ dữ liệu</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý cơ chế đồng bộ danh mục, tồn kho và đơn hàng hai chiều giữa ÉLANE và {meta.name}.
          </p>
          <div className="mt-6 space-y-4">
            {[
              { t: "Đồng bộ sản phẩm", d: "Tự động đồng bộ sản phẩm mới và cập nhật giá bán.", v: syncProducts, s: setSyncProducts },
              { t: "Đồng bộ đơn hàng", d: "Kéo đơn hàng từ nền tảng về trung tâm quản trị ÉLANE.", v: syncOrders, s: setSyncOrders },
              { t: "Đồng bộ tồn kho tức thời", d: "Cập nhật số lượng tồn theo thời gian thực để tránh oversell.", v: syncStock, s: setSyncStock },
            ].map((r) => (
              <div key={r.t} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                <div>
                  <p className="font-semibold">{r.t}</p>
                  <p className="text-xs text-slate-500">{r.d}</p>
                </div>
                <Toggle checked={r.v} onChange={r.s} />
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "posts" && (
        <section className={cn(card, "p-6 text-center")}>
          <PenSquare className="mx-auto size-12 text-[#6941c6]" />
          <h2 className="mt-3 text-lg font-semibold">Quản lý bài viết và lịch đăng</h2>
          <p className="mt-1 text-sm text-slate-500">Xem và lên lịch các bài viết được đăng tải lên {meta.name}.</p>
          <Button onClick={() => ctx.go("posts")} className="mt-5 bg-[#6941c6] hover:bg-[#5b36b0]">
            Mở trang Quản lý bài viết
          </Button>
        </section>
      )}

      {tab === "automation" && (
        <section className={cn(card, "p-6 text-center")}>
          <Sparkles className="mx-auto size-12 text-[#6941c6]" />
          <h2 className="mt-3 text-lg font-semibold">AI &amp; Tự động hóa nội dung</h2>
          <p className="mt-1 text-sm text-slate-500">Sử dụng trí tuệ nhân tạo để tạo bài viết, caption và tự động trả lời khách hàng.</p>
          <Button onClick={() => ctx.go("ai-content")} className="mt-5 bg-[#6941c6] hover:bg-[#5b36b0]">
            Khám phá Content Studio AI
          </Button>
        </section>
      )}

      {tab === "inbox" && (
        <section className={cn(card, "p-6 text-center")}>
          <MessageCircle className="mx-auto size-12 text-[#6941c6]" />
          <h2 className="mt-3 text-lg font-semibold">Tin nhắn &amp; Bình luận tập trung</h2>
          <p className="mt-1 text-sm text-slate-500">Tất cả hội thoại và bình luận từ {meta.name} được gom về một nơi.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Button onClick={() => ctx.go("messages")} className="bg-[#6941c6] hover:bg-[#5b36b0]">Quản lý tin nhắn</Button>
            <Button variant="outline" onClick={() => ctx.go("comments")}>Quản lý bình luận</Button>
          </div>
        </section>
      )}

      {tab === "security" && (
        <section className={cn(card, "p-6")}>
          <h2 className="text-lg font-semibold">Quyền truy cập &amp; Bảo mật</h2>
          <p className="mt-1 text-sm text-slate-500">ÉLANE sử dụng token OAuth được mã hóa theo tiêu chuẩn ngân hàng.</p>
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-xs leading-6 text-slate-600">
            Token kết nối được cấp quyền qua OAuth chính thức. Bạn có thể kiểm tra hoặc thu hồi quyền truy cập bất kỳ lúc nào từ bảng điều khiển của {meta.name}.
          </div>
        </section>
      )}

      {tab === "logs" && (
        <section className={cn(card, "p-6")}>
          <h2 className="text-lg font-semibold">Nhật ký hoạt động chi tiết</h2>
          <p className="mt-1 text-sm text-slate-500">Lịch sử các lần đồng bộ và gọi API với {meta.name}.</p>
          <div className="mt-4 divide-y divide-slate-100 text-xs">
            {[
              { time: "19/10/2026 14:00", event: "Đồng bộ 248 sản phẩm thành công" },
              { time: "19/10/2026 13:45", event: "Đăng bài viết mới 'BST Thu Đông 2026'" },
              { time: "19/10/2026 13:30", event: "Kiểm tra đơn hàng mới (0 đơn mới)" },
              { time: "19/10/2026 12:10", event: "Cập nhật tồn kho tự động" },
            ].map((log) => (
              <div key={log.time} className="flex items-center justify-between py-3">
                <span className="font-mono text-slate-500">{log.time}</span>
                <span className="text-slate-800">{log.event}</span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Thành công</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}