import { useState } from "react";
import { BookOpen, Check, ExternalLink, MoreHorizontal, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANNEL_META, CONFIG_TABS, MOCK_ACTIVITIES, PERMISSIONS } from "../mock";
import type { ChannelAccount, ChannelId, ConfigTab, SocialCtx } from "../types";
import { Avatar, ChannelLogo, Dot, PageHeader, Pill, card, fmt } from "../ui";

const ORDER: ChannelId[] = ["facebook", "instagram", "tiktok", "shopee", "website", "zalo"];
const TONE: Record<string, string> = { emerald: "bg-emerald-100 text-emerald-600", blue: "bg-blue-100 text-blue-600", violet: "bg-violet-100 text-violet-600", orange: "bg-orange-100 text-orange-500" };

export function ConnectPage({ ctx }: { ctx: SocialCtx }) {
  const { channels, go, activeChannel } = ctx;
  const connectedFirst = channels.find((c) => c.connected)?.id || activeChannel;
  const [selected, setSelected] = useState<ChannelId>(connectedFirst);
  const list = ORDER.map((id) => channels.find((c) => c.id === id)).filter(Boolean) as ChannelAccount[];
  const current = channels.find((c) => c.id === selected) || channels.find((c) => c.connected);

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <PageHeader onBack={() => go("overview")} title="Kết nối kênh bán hàng" desc="Kết nối và quản lý các kênh bán hàng của ELANE để đồng bộ sản phẩm, đơn hàng, tin nhắn và tự động đăng bài."
        actions={<>
          <Button variant="outline" onClick={() => toast.info("Hướng dẫn kết nối sẽ được bổ sung")} className="gap-2"><BookOpen className="size-4" />Hướng dẫn kết nối kênh</Button>
          <Button onClick={() => go("add-channel")} className="gap-2 bg-[#6941c6] hover:bg-[#5b36b0]"><Plus className="size-4" />Thêm kênh</Button>
        </>} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => {
          const m = CHANNEL_META[c.id];
          return (
            <article key={c.id} onClick={() => c.connected && setSelected(c.id)}
              className={cn(card, "flex flex-col p-5 transition-colors", c.connected && "cursor-pointer", selected === c.id && c.connected ? "border-[#6941c6] ring-1 ring-[#6941c6]/30" : "hover:border-slate-300")}>
              <div className="flex items-start gap-3">
                <ChannelLogo id={c.id} size="lg" />
                <div className="min-w-0 flex-1"><h2 className="font-semibold">{m.name}</h2><p className="mt-0.5 text-xs text-slate-500">{m.desc}</p></div>
                {c.connected ? <Pill tone="green"><Dot />Đã kết nối</Pill> : <Pill tone="slate"><Dot />Chưa kết nối</Pill>}
              </div>

              {c.connected ? <>
                <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <Avatar src={c.avatarUrl} label={c.accountName ? c.accountName.charAt(0).toUpperCase() : undefined} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.accountName}</p>
                    <a href={c.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 truncate text-xs text-slate-500 hover:text-[#6941c6]">{c.handle}<ExternalLink className="size-3" /></a></div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); go("channel-config", { channel: c.id }); }} className="border-violet-200 text-[#6941c6]">Quản lý</Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div><p className="text-lg font-semibold tabular-nums">{fmt(c.followers)}</p><p className="text-xs text-slate-500">{c.id === "website" ? "Khách truy cập" : "Người theo dõi"}</p></div>
                  <div className="border-l border-slate-100 pl-4"><p className="text-lg font-semibold tabular-nums">{c.conversion.toFixed(1)}%</p><p className="text-xs text-slate-500">Tỷ lệ chuyển đổi</p></div>
                </div>
                <ul className="mt-4 space-y-1.5">{m.features.map((f) => <li key={f} className="flex items-center gap-2 text-xs text-slate-600"><Check className="size-3.5 rounded-full bg-emerald-500 p-0.5 text-white" />{f}</li>)}</ul>
                <div className="mt-auto flex justify-end gap-2 pt-4">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); go("channel-config", { channel: c.id }); }} className="gap-1.5"><Settings className="size-3.5" />Cấu hình</Button>
                  <Button size="sm" variant="outline" aria-label="Thêm tùy chọn" onClick={(e) => { e.stopPropagation(); setSelected(c.id); }}><MoreHorizontal className="size-4" /></Button>
                </div>
              </> : <>
                <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <ChannelLogo id={c.id} size="lg" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Chưa kết nối kênh {m.name}</p><p className="text-xs text-slate-500">Kết nối để quản lý tin nhắn và gửi thông báo.</p></div>
                  <Button size="sm" onClick={() => go("add-channel", { wizardChannel: c.id })} className="bg-[#6941c6] hover:bg-[#5b36b0]">Kết nối ngay</Button>
                </div>
                <ul className="mt-4 space-y-1.5">{m.features.map((f) => <li key={f} className="flex items-center gap-2 text-xs text-slate-500"><Check className="size-3.5 rounded-full bg-slate-200 p-0.5 text-slate-500" />{f}</li>)}</ul>
                <div className="mt-auto flex justify-end gap-2 pt-4">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); go("channel-config", { channel: c.id, tab: "webhook" }); }} className="gap-1.5"><Settings className="size-3.5" />Cấu hình API</Button>
                </div>
              </>}
            </article>
          );
        })}
      </div>

      {current?.connected && <ChannelSummary ctx={ctx} channel={current} />}
    </div>
  );
}

/** Panel "Cấu hình kênh X" ở cuối trang kết nối. */
function ChannelSummary({ ctx, channel: c }: { ctx: SocialCtx; channel: ChannelAccount }) {
  const m = CHANNEL_META[c.id];
  const open = (tab: ConfigTab) => ctx.go("channel-config", { channel: c.id, tab });
  const disconnect = () => { if (window.confirm(`Ngắt kết nối ${m.name}? Dữ liệu sẽ không còn được đồng bộ.`)) ctx.disconnectChannel(c.id); };
  return (
    <section className={cn(card, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3"><ChannelLogo id={c.id} size="lg" />
          <div><h2 className="flex items-center gap-2 text-lg font-semibold">Cấu hình kênh {m.name}<Pill tone="green"><Dot />Đã kết nối</Pill></h2><p className="text-sm text-slate-500">Quản lý kết nối, đồng bộ dữ liệu và thiết lập tự động.</p></div></div>
        <Button variant="outline" onClick={disconnect} className="border-rose-200 text-rose-600 hover:bg-rose-50">Ngắt kết nối</Button>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {CONFIG_TABS.slice(0, 6).map((t, i) => <button key={t.id} onClick={() => open(t.id)} className={cn("whitespace-nowrap rounded-md px-3 py-2 text-left text-sm", i === 0 ? "border-l-2 border-[#6941c6] bg-violet-50 font-semibold text-[#6941c6]" : "text-slate-600 hover:bg-slate-50")}>{t.label}</button>)}
        </nav>
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold">Thông tin kết nối</h3>
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3"><Avatar src={c.avatarUrl} className="size-12" label={c.accountName ? c.accountName.charAt(0).toUpperCase() : undefined} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.accountName}</p><p className="truncate text-xs text-slate-500">{c.handle}</p></div>
              <Button size="sm" variant="outline" onClick={() => open("general")} className="border-violet-200 text-[#6941c6]">Đổi tài khoản</Button></div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-slate-500">ID</dt><dd className="mt-1 text-sm font-medium">{c.pageId}</dd></div><div><dt className="text-slate-500">Ngày kết nối</dt><dd className="mt-1 text-sm font-medium">{c.connectedAt}</dd></div><div><dt className="text-slate-500">Trạng thái</dt><dd className="mt-1 flex items-center gap-1 text-sm font-medium text-emerald-600"><Dot />Đang hoạt động</dd></div></dl>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between"><h3 className="font-semibold">Quyền đã cấp</h3><Button size="sm" variant="outline" onClick={() => open("permissions")} className="border-violet-200 text-[#6941c6]">Cấp lại quyền</Button></div>
            <ul className="mt-3 space-y-2">{PERMISSIONS.slice(0, 5).map((p) => <li key={p.title} className="flex items-center gap-2 text-sm text-slate-700"><Check className="size-4 rounded-full bg-emerald-500 p-0.5 text-white" />{p.title}</li>)}</ul>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold">Hoạt động gần đây</h3>
            <ul className="mt-3 space-y-2.5">{MOCK_ACTIVITIES.map((a) => <li key={a.text} className="flex items-center gap-2 text-xs"><span className={cn("grid size-5 place-items-center rounded", TONE[a.tone])}><Dot /></span><span className="flex-1 text-slate-700">{a.text}</span><span className="text-slate-400">{a.time}</span></li>)}</ul>
            <button onClick={() => open("logs")} className="mt-3 text-xs font-medium text-[#6941c6] hover:underline">Xem tất cả hoạt động →</button>
          </div>
        </div>
      </div>
    </section>
  );
}
