import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ClipboardList,
  ExternalLink,
  MessageCircle,
  MoreHorizontal,
  Package,
  PenSquare,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANNEL_META, MOCK_ACTIVITIES, PERMISSIONS } from "../mock";
import type { ChannelAccount, ChannelId, SocialCtx } from "../types";
import { Avatar, ChannelLogo, Dot, PageHeader, Pill, card, fmt } from "../ui";

const ORDER: ChannelId[] = ["facebook", "instagram", "tiktok", "shopee", "website", "zalo"];
const TONE: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-600",
  blue: "bg-blue-100 text-blue-600",
  violet: "bg-violet-100 text-violet-600",
  orange: "bg-orange-100 text-orange-500",
};

/** Màu nền mờ phía sau logo trang trí ở card "Kênh có thể kết nối". */
const ART_TINT: Record<ChannelId, string> = {
  facebook: "from-blue-100 to-sky-50",
  instagram: "from-fuchsia-100 to-orange-50",
  tiktok: "from-rose-100 to-cyan-50",
  shopee: "from-orange-100 to-amber-50",
  website: "from-violet-100 to-indigo-50",
  zalo: "from-sky-100 to-blue-50",
};

const FEATURE_TOGGLES = [
  { key: "products", label: "Đồng bộ sản phẩm", icon: Package, tone: "bg-blue-100 text-blue-600" },
  { key: "orders", label: "Đồng bộ đơn hàng", icon: ClipboardList, tone: "bg-emerald-100 text-emerald-600" },
  { key: "posts", label: "Tự động đăng bài", icon: PenSquare, tone: "bg-violet-100 text-violet-600" },
  { key: "replies", label: "Trả lời tin nhắn", icon: MessageCircle, tone: "bg-rose-100 text-rose-500" },
] as const;

/** Các trường tuỳ chọn – nếu ChannelAccount chưa có thì dùng giá trị mặc định. */
type ChannelExtra = ChannelAccount & {
  posts?: number;
  followersGrowth?: number;
  postsGrowth?: number;
};

export function ConnectPage({ ctx }: { ctx: SocialCtx }) {
  const { channels, go } = ctx;
  const [selected, setSelected] = useState<ChannelId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const list = ORDER.map((id) => channels.find((c) => c.id === id)).filter(Boolean) as ChannelAccount[];
  const connected = list.filter((c) => c.connected);
  const available = list.filter((c) => !c.connected);
  const current = selected ? channels.find((c) => c.id === selected) : undefined;
  const visibleConnected = showAll ? connected : connected.slice(0, 1);

  return (
    <div className="space-y-6 pb-8 text-slate-900">
      <PageHeader
        onBack={() => go("overview")}
        title="Kết nối kênh bán hàng"
        desc="Kết nối và quản lý các kênh bán hàng của ELANE để đồng bộ sản phẩm, đơn hàng, tin nhắn và tự động đăng bài."
        actions={
          <Button variant="outline" onClick={() => toast.info("Hướng dẫn kết nối sẽ được bổ sung")} className="gap-2 bg-white">
            <BookOpen className="size-4" />
            Hướng dẫn kết nối kênh
          </Button>
        }
      />

      {/* ───────── Hàng trên: Kênh đã kết nối + Mở rộng kênh bán hàng ───────── */}
      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {connected.length > 0 && (
          <section className={cn(card, "p-5")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Kênh đã kết nối ({connected.length})</h2>
                <p className="mt-0.5 text-sm text-slate-500">Các kênh đang hoạt động và được đồng bộ dữ liệu.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAll((v) => !v)}
                className="border-violet-200 bg-white text-[#6941c6] hover:bg-violet-50 hover:text-[#6941c6]"
              >
                {showAll ? "Thu gọn" : "Xem tất cả"}
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {visibleConnected.map((c) => (
                <ConnectedChannel
                  key={c.id}
                  ctx={ctx}
                  channel={c}
                  open={selected === c.id}
                  onToggle={() => setSelected(selected === c.id ? null : c.id)}
                />
              ))}
            </div>
          </section>
        )}

        <ExpandPromo canChannelWrite={ctx.canChannelWrite} />
      </div>

      {/* ───────── Kênh có thể kết nối ───────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Kênh có thể kết nối ({available.length})</h2>
          <p className="text-sm text-slate-500">Chọn nền tảng bạn muốn kết nối để bắt đầu.</p>
        </div>
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {available.map((c) => {
            const m = CHANNEL_META[c.id];
            return (
              <article key={c.id} className={cn(card, "relative flex flex-col overflow-hidden p-5 transition-colors hover:border-slate-300")}>
                <div className="flex items-start gap-3">
                  <ChannelLogo id={c.id} size="lg" />
                  <div className="min-w-0 flex-1 pr-24">
                    <h3 className="font-semibold">{m.name}</h3>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{m.desc}</p>
                  </div>
                  <div className="absolute right-5 top-5">
                    <Pill tone="slate">
                      <Dot />
                      Chưa kết nối
                    </Pill>
                  </div>
                </div>

                <div className="relative mt-4 min-h-[128px] flex-1">
                  <ul className="relative z-10 space-y-2">
                    {m.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-slate-600">
                        <Check className="size-3.5 shrink-0 rounded-full bg-slate-200 p-0.5 text-slate-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <ChannelArt id={c.id} />
                </div>

                {ctx.canChannelWrite && <Button
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    go("add-channel", { wizardChannel: c.id });
                  }}
                  className="relative z-10 mt-4 w-full gap-2 border-[#6941c6]/50 bg-white font-semibold text-[#6941c6] hover:bg-violet-50 hover:text-[#6941c6]"
                >
                  Kết nối {m.name}
                  <ArrowRight className="size-4" />
                </Button>}
              </article>
            );
          })}
        </div>
      </section>

      {current?.connected && <ChannelSummary ctx={ctx} channel={current} />}
    </div>
  );
}

/* ═════════════════════════ Kênh đã kết nối ═════════════════════════ */

function ConnectedChannel({ ctx, channel: c, open, onToggle }: { ctx: SocialCtx; channel: ChannelAccount; open: boolean; onToggle: () => void }) {
  const m = CHANNEL_META[c.id];
  const x = c as ChannelExtra;
  const [menu, setMenu] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({ products: true, orders: true, posts: true, replies: true });

  return (
    <article className={cn("rounded-xl border border-slate-200 bg-white", open && "border-[#6941c6] ring-1 ring-[#6941c6]/20")}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4 p-4">
        <ChannelLogo id={c.id} size="lg" />

        {/* Thông tin tài khoản */}
        <div className="min-w-[210px] flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{m.name}</h3>
            <Pill tone="green">
              <Dot />
              Đang hoạt động
            </Pill>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Avatar src={c.avatarUrl} className="size-8" label={c.accountName?.charAt(0).toUpperCase()} />
            <span className="truncate text-sm text-slate-700">{c.handle ?? c.accountName}</span>
            <a href={c.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#6941c6]">
              <ExternalLink className="size-3.5" />
            </a>
          </div>
          <p className="mt-2 text-xs text-slate-500">Kết nối lần cuối: {c.connectedAt}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Đồng bộ tự động: <span className="text-emerald-600">Bật</span>
          </p>
        </div>

        {/* Chỉ số */}
        <dl className="grid grid-cols-3 gap-6 self-center border-l border-slate-100 pl-6 text-sm">
          <Stat label="Người theo dõi" value={fmt(c.followers)} delta={`${x.followersGrowth ?? 2.5}%`} />
          <Stat label="Bài viết gần đây" value={fmt(x.posts ?? 124)} delta={`${x.postsGrowth ?? 12}%`} />
          <Stat label="Đơn hàng" value={c.orders ? fmt(c.orders) : "0"} delta={c.orders ? undefined : "—"} muted={!c.orders} />
        </dl>

        {/* Hành động */}
        <div className="relative ml-auto flex items-center gap-2 self-start">
          <Button size="sm" variant="outline" onClick={() => void ctx.refreshAll()} className="gap-1.5 bg-white">
            <RefreshCw className="size-3.5" />
            Đồng bộ
          </Button>
          <Button size="sm" onClick={() => ctx.go("channel-manage", { channel: c.id })} className="gap-1.5 bg-[#6941c6] hover:bg-[#5b36b0]">
            <Settings2 className="size-3.5" />
            Quản lý
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMenu((v) => !v)} aria-label="Thêm tuỳ chọn" className="bg-white px-2">
            <MoreHorizontal className="size-4" />
          </Button>
          {menu && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
              <button
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  setMenu(false);
                  ctx.go("channel-manage", { channel: c.id });
                }}
              >
                Quản lý kênh
              </button>
              <button
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  setMenu(false);
                  ctx.go("add-channel", { wizardChannel: c.id });
                }}
              >
                Kết nối lại
              </button>
              <button
                className="block w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  setMenu(false);
                  if (window.confirm(`Ngắt kết nối ${m.name}? Dữ liệu sẽ không còn được đồng bộ.`)) ctx.disconnectChannel(c.id);
                }}
              >
                Ngắt kết nối
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4 thiết lập tự động */}
      <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURE_TOGGLES.map(({ key, label, icon: Icon, tone }) => {
          const on = flags[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFlags((f) => ({ ...f, [key]: !f[key] }))}
              className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 text-left shadow-[0_2px_8px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition-shadow hover:shadow-[0_4px_12px_rgba(15,23,42,0.12)]"
            >
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", tone)}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{label}</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", on ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                {on ? "Bật" : "Tắt"}
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function Stat({ label, value, delta, muted }: { label: string; value: string; delta?: string; muted?: boolean }) {
  return (
    <div>
      <dt className="whitespace-nowrap text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
      {delta && (
        <span className={cn("mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium", muted ? "text-slate-400" : "text-emerald-600")}>
          {!muted && <ArrowUp className="size-3" />}
          {delta}
        </span>
      )}
    </div>
  );
}

/* ═════════════════════════ Card "Mở rộng kênh bán hàng" ═════════════════════════ */

function Floating({ className, children }: { className: string; children: ReactNode }) {
  return <div className={cn("absolute origin-center drop-shadow-md", className)}>{children}</div>;
}

function ExpandPromo({ canChannelWrite }: { canChannelWrite: boolean }) {
  return (
    <aside className={cn(card, "p-3")}>
      <div className="flex h-full flex-col rounded-xl bg-gradient-to-b from-violet-100 via-violet-50 to-violet-100/70 p-5">
        {/* Minh hoạ */}
        <div className="relative mx-auto h-[190px] w-full max-w-[300px]">
          {/* Màn hình */}
          <div className="absolute left-1/2 top-9 w-[168px] -translate-x-1/2">
            <div className="rounded-lg border-[5px] border-violet-200 bg-white p-2 shadow-md">
              <svg viewBox="0 0 120 60" className="h-[72px] w-full" fill="none">
                {[10, 24, 38, 52, 66, 80, 94].map((x, i) => (
                  <rect key={x} x={x} y={52 - (i + 2) * 5} width="8" height={(i + 2) * 5} rx="1.5" className="fill-violet-100" />
                ))}
                <polyline points="6,46 24,36 42,40 62,22 82,28 112,8" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="mx-auto h-3 w-10 bg-violet-200" />
            <div className="mx-auto h-1.5 w-20 rounded-full bg-violet-200" />
          </div>

          <Floating className="left-[44px] top-0 scale-[0.8]"><ChannelLogo id="instagram" size="lg" /></Floating>
          <Floating className="right-[46px] top-1 scale-[0.8]"><ChannelLogo id="facebook" size="lg" /></Floating>
          <Floating className="right-0 top-[52px] scale-[0.8]"><ChannelLogo id="tiktok" size="lg" /></Floating>
          <Floating className="left-0 top-[78px] scale-[0.8]"><ChannelLogo id="website" size="lg" /></Floating>
          <Floating className="bottom-[2px] right-[14px] scale-[0.8]"><ChannelLogo id="shopee" size="lg" /></Floating>
        </div>

        <h3 className="mt-3 text-lg font-semibold">Mở rộng kênh bán hàng</h3>
        <p className="mt-1.5 text-sm leading-5 text-slate-500">Kết nối thêm các nền tảng khác để tăng doanh số và quản lý tập trung trên một hệ thống.</p>
        {canChannelWrite && <Button
          variant="outline"
          onClick={() => toast.info("Tính năng sẽ sớm được bổ sung")}
          className="mt-4 w-fit gap-2 border-[#6941c6]/50 bg-white font-medium text-[#6941c6] hover:bg-violet-50 hover:text-[#6941c6]"
        >
          Tìm hiểu thêm
          <ArrowRight className="size-4" />
        </Button>}
      </div>
    </aside>
  );
}

/* ═════════════════════════ Logo trang trí ═════════════════════════ */

function ChannelArt({ id }: { id: ChannelId }) {
  return (
    <div className="pointer-events-none absolute -bottom-3 -right-5 grid size-40 place-items-center" aria-hidden>
      <div className={cn("absolute inset-2 rounded-full bg-gradient-to-br opacity-80 blur-md", ART_TINT[id])} />
      <div className="relative rotate-[8deg] scale-[2.1] drop-shadow-xl">
        <ChannelLogo id={id} size="lg" />
      </div>
    </div>
  );
}

/* ═════════════════════════ Panel cấu hình kênh ═════════════════════════ */

/** Panel "Cấu hình kênh X" ở cuối trang kết nối. */
function ChannelSummary({ ctx, channel: c }: { ctx: SocialCtx; channel: ChannelAccount }) {
  const m = CHANNEL_META[c.id];
  const disconnect = () => {
    if (window.confirm(`Ngắt kết nối ${m.name}? Dữ liệu sẽ không còn được đồng bộ.`)) ctx.disconnectChannel(c.id);
  };
  return (
    <section className={cn(card, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ChannelLogo id={c.id} size="lg" />
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              Cấu hình kênh {m.name}
              <Pill tone="green">
                <Dot />
                Đã kết nối
              </Pill>
            </h2>
            <p className="text-sm text-slate-500">Quản lý kết nối, đồng bộ dữ liệu và thiết lập tự động.</p>
          </div>
        </div>
        <Button variant="outline" onClick={disconnect} className="border-rose-200 text-rose-600 hover:bg-rose-50">
          Ngắt kết nối
        </Button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Thông tin kết nối</h3>
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <Avatar src={c.avatarUrl} className="size-12" label={c.accountName ? c.accountName.charAt(0).toUpperCase() : undefined} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{c.accountName}</p>
              <p className="truncate text-xs text-slate-500">{c.handle}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => ctx.go("add-channel", { wizardChannel: c.id })} className="border-violet-200 text-[#6941c6]">
              Kết nối lại
            </Button>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-slate-500">ID</dt>
              <dd className="mt-1 text-sm font-medium">{c.pageId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ngày kết nối</dt>
              <dd className="mt-1 text-sm font-medium">{c.connectedAt}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Trạng thái</dt>
              <dd className="mt-1 flex items-center gap-1 text-sm font-medium text-emerald-600">
                <Dot />
                Đang hoạt động
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Quyền đã cấp</h3>
          <ul className="mt-3 space-y-2">
            {PERMISSIONS.slice(0, 5).map((p) => (
              <li key={p.title} className="flex items-center gap-2 text-sm text-slate-700">
                <Check className="size-4 rounded-full bg-emerald-500 p-0.5 text-white" />
                {p.title}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold">Hoạt động gần đây</h3>
          <ul className="mt-3 space-y-2.5">
            {MOCK_ACTIVITIES.map((a) => (
              <li key={a.text} className="flex items-center gap-2 text-xs">
                <span className={cn("grid size-5 place-items-center rounded", TONE[a.tone])}>
                  <Dot />
                </span>
                <span className="flex-1 text-slate-700">{a.text}</span>
                <span className="text-slate-400">{a.time}</span>
              </li>
            ))}
          </ul>
          <button onClick={() => void ctx.refreshAll()} className="mt-3 text-xs font-medium text-[#6941c6] hover:underline">
            Đồng bộ dữ liệu mới nhất →
          </button>
        </div>
      </div>
    </section>
  );
}
