import { useState } from "react";
import {
  ArrowRight, BadgeCheck, BarChart3, CheckCircle2, ChevronRight, Clock, ExternalLink, FileText,
  Info, Layers, MessageCircle, MoreHorizontal, Package, Send, ShieldCheck, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CHANNEL_META } from "../mock";
import type { ChannelId, SocialCtx } from "../types";
import { ChannelLogo, PageHeader, card } from "../ui";
import { DEFAULT_CFG, DEFAULT_CONTENT, flowOf, type Cfg, type ContentCfg } from "./channelFlow";
import { ApiConfigStep, ConfigAside, ConfigStep, ConnectStep, InfoPanel, ReadyAside, ReviewStep, StepBar, type ApiConfigPayload } from "./AddChannelSteps";

const GRID: ChannelId[] = ["facebook", "instagram", "tiktok", "shopee", "lazada", "zalo", "website", "youtube"];
const TOTAL = GRID.length + 1; // + "Kênh khác"
const POPULAR: ChannelId[] = ["facebook"];
const BENEFITS = [
  { icon: Package, title: "Đồng bộ sản phẩm", desc: "Quản lý sản phẩm tập trung, cập nhật tồn kho real-time." },
  { icon: FileText, title: "Quản lý đơn hàng", desc: "Tất cả đơn hàng từ các kênh về một nơi." },
  { icon: Send, title: "Tự động đăng nội dung", desc: "Lên lịch và đăng bài hàng loạt trên nhiều kênh." },
  { icon: MessageCircle, title: "Quản lý tin nhắn tập trung", desc: "Trả lời khách hàng nhanh chóng, không bỏ sót." },
  { icon: BarChart3, title: "Báo cáo hiệu quả", desc: "Theo dõi doanh số, lượt tiếp cận và hiệu quả từng kênh." },
];

/* ───────────── Thẻ kênh ở bước 1 ───────────── */
function ChannelCard({ id, done, onPick, onMenu }: { id: ChannelId; done: boolean; onPick: () => void; onMenu: () => void }) {
  const m = CHANNEL_META[id];
  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-4">
      <div className="pointer-events-none absolute right-0 top-0 size-32 bg-gradient-to-bl from-violet-50/80 to-transparent" />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-2">
          <ChannelLogo id={id} size="lg" />
          {m.comingSoon ? <Badge tone="amber">Sắp ra mắt</Badge>
            : done ? <Badge tone="green" icon={<CheckCircle2 className="size-3" />}>Đã kết nối</Badge>
              : POPULAR.includes(id) ? <Badge tone="blue" icon={<BadgeCheck className="size-3" />}>Phổ biến</Badge> : null}
        </div>
        <button aria-label="Tùy chọn" onClick={onMenu} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><MoreHorizontal className="size-5" /></button>
      </div>
      <h3 className="relative mt-3 font-semibold">{m.name}</h3>
      <p className="relative mt-1 min-h-[2.5rem] text-xs leading-5 text-slate-500">{m.desc}</p>
      {m.comingSoon ? (
        <Button disabled variant="outline" className="relative mt-3 w-full gap-2"><Clock className="size-4" />Sắp ra mắt</Button>
      ) : done ? (
        <Button disabled variant="outline" className="relative mt-3 w-full gap-2 bg-slate-50"><CheckCircle2 className="size-4" />Đã kết nối</Button>
      ) : (
        <Button variant="outline" onClick={onPick} className="relative mt-3 w-full border-violet-200 font-medium text-[#6941c6] hover:bg-violet-50 hover:text-[#6941c6]">
          Kết nối<ArrowRight className="absolute right-3 size-4" />
        </Button>
      )}
    </div>
  );
}

/* ───────────── Trang chính ───────────── */
export function AddChannelPage({ ctx }: { ctx: SocialCtx }) {
  const [selected, setSelected] = useState<ChannelId | null>(ctx.wizardChannel);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(() => {
    if (ctx.wizardChannel === "instagram" || ctx.wizardChannel === "facebook") {
      return Boolean(ctx.settings?.appId && ctx.settings.hasAppSecret && ctx.settings.hasWebhookVerifyToken);
    }
    return false;
  });
  // Quay lại từ OAuth (Instagram): kênh đã kết nối thì coi như đã đăng nhập
  const [loggedIn, setLoggedIn] = useState(() => !!ctx.channels.find((c) => c.id === ctx.wizardChannel)?.connected);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [content, setContent] = useState<ContentCfg>(DEFAULT_CONTENT);

  const meta = selected ? CHANNEL_META[selected] : null;
  const flow = selected ? flowOf(selected) : null;
  const account = flow?.accounts.find((a) => a.id === accountId) ?? null;
  const patch = (p: Partial<Cfg>) => setCfg((c) => ({ ...c, ...p }));

  const connected = ctx.channels.filter((c) => c.connected);
  const pct = Math.min(100, Math.round((connected.length / TOTAL) * 100));

  function pick(id: ChannelId) {
    setSelected(id); setStep(1); setApiConfigured(false); setLoggedIn(false); setAccountId(null); setCfg(DEFAULT_CFG); setContent(DEFAULT_CONTENT);
  }
  function pickAccount(accId: string) {
    const a = flow?.accounts.find((x) => x.id === accId);
    if (!a) return;
    setAccountId(accId); patch({ name: a.name });
  }
  async function authorize() {
    if (!selected || !meta) return;
    if (selected === "instagram") { await ctx.connectChannel("instagram"); return; } // luồng OAuth thật, sẽ chuyển trang
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900)); // TODO(api): mở OAuth/đăng nhập của từng kênh
    setBusy(false); setLoggedIn(true);
    toast.success(`Đã đăng nhập ${meta.name}`);
  }
  async function saveApi(payload: ApiConfigPayload) {
    if (!selected) return;
    setBusy(true);
    try {
      if (selected === "instagram" || selected === "facebook") {
        await adminApi.updateSocialSettings({
          appId: payload.appId,
          graphVersion: payload.graphVersion,
          redirectUri: payload.redirectUri || null,
          ...(payload.appSecret ? { appSecret: payload.appSecret } : {}),
          ...(payload.webhookVerifyToken ? { webhookVerifyToken: payload.webhookVerifyToken } : {}),
        });
        await ctx.reloadSettings();
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      setApiConfigured(true);
      setStep(2);
      toast.success(`Đã lưu cấu hình API ${meta?.name ?? "kênh"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu cấu hình API");
    } finally { setBusy(false); }
  }
  async function finish() {
    if (!selected || !meta) return;
    setBusy(true);
    try {
      const alreadyConnected = ctx.channels.some((channel) => channel.id === selected && channel.connected);
      if (!alreadyConnected) await ctx.connectChannel(selected); // TODO(api): lưu `accountId`, `cfg`, `content` cùng lúc
      toast.success(`Đã kết nối ${meta.name}`);
      ctx.go("connect");
    } finally { setBusy(false); }
  }

  const ready = !!selected && !!meta && !!flow;

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <PageHeader onBack={() => (step > 1 ? setStep(step - 1) : ctx.go("connect"))} title={meta ? `Kết nối ${meta.name}` : "Kết nối kênh bán hàng"} desc="Cấu hình API, đăng nhập, thiết lập đồng bộ rồi hoàn tất kết nối." />
      {ready && <StepBar current={step} onGo={setStep} />}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ───────── Cột chính ───────── */}
        <div className="min-w-0 space-y-5">
          {step === 1 && !ready && (
            <section className={cn(card, "p-5")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Chọn kênh muốn kết nối</h2>
                  <p className="mt-1 text-sm text-slate-500">Chọn một hoặc nhiều kênh bán hàng để bắt đầu kết nối với ÉLANE.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Chúng tôi sẽ liên hệ lại với bạn")} className="gap-2 border-violet-200 text-xs text-slate-700">
                  <Info className="size-4 text-[#6941c6]" />Không tìm thấy kênh bạn cần?<ChevronRight className="size-4 text-[#6941c6]" />
                </Button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {GRID.map((id) => {
                  const done = !!ctx.channels.find((c) => c.id === id)?.connected;
                  return (
                    <ChannelCard key={id} id={id} done={done} onPick={() => pick(id)}
                      onMenu={() => (done ? ctx.go("channel-manage", { channel: id }) : toast.info(`Hướng dẫn kết nối ${CHANNEL_META[id].name} sẽ được bổ sung`))} />
                  );
                })}
                <div className="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-4">
                  <div className="pointer-events-none absolute right-0 top-0 size-32 bg-gradient-to-bl from-violet-50/80 to-transparent" />
                  <div className="relative flex items-start justify-between">
                    <span className="grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500"><MoreHorizontal className="size-6" /></span>
                    <button aria-label="Tùy chọn" onClick={() => toast.info("Chúng tôi sẽ liên hệ lại với bạn")} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><MoreHorizontal className="size-5" /></button>
                  </div>
                  <h3 className="relative mt-3 font-semibold">Kênh khác</h3>
                  <p className="relative mt-1 min-h-[2.5rem] text-xs leading-5 text-slate-500">Liên hệ để tích hợp thêm kênh bán hàng theo nhu cầu.</p>
                  <Button variant="outline" onClick={() => toast.info("Chúng tôi sẽ liên hệ lại với bạn")} className="relative mt-3 w-full gap-2 text-slate-900">Liên hệ<ExternalLink className="size-4" /></Button>
                </div>
              </div>
            </section>
          )}

          {ready && step === 1 && (
            <ApiConfigStep id={selected} name={meta.name} configured={apiConfigured} busy={busy}
              initial={{ appId: ctx.settings?.appId, graphVersion: ctx.settings?.graphVersion, redirectUri: ctx.settings?.redirectUri }}
              onSave={(payload) => void saveApi(payload)} onBack={() => ctx.go("connect")} />
          )}
          {ready && step === 2 && (
            <ConnectStep id={selected} name={meta.name} flow={flow} loggedIn={loggedIn} busy={busy} accountId={accountId}
              onLogin={() => void authorize()} onPick={pickAccount} onBack={() => setStep(1)} onNext={() => setStep(3)} />
          )}
          {ready && step === 3 && (
            <ConfigStep id={selected} name={meta.name} flow={flow} cfg={cfg} patch={patch} accountId={accountId}
              onAccount={pickAccount} onBack={() => setStep(2)} onNext={() => setStep(4)} />
          )}
          {ready && step === 4 && (
            <ReviewStep id={selected} name={meta.name} flow={flow} cfg={cfg} content={content} setContent={setContent} account={account} goStep={setStep} />
          )}
        </div>

        {/* ───────── Sidebar phải (đổi theo bước) ───────── */}
        <aside className="space-y-4">
          {step === 1 && !ready && <OverviewAside ctx={ctx} connected={connected.map((c) => c.id)} pct={pct} />}
          {ready && step === 1 && <InfoPanel id={selected} name={meta.name} desc={meta.desc} flow={flow} popular={POPULAR.includes(selected)} />}
          {ready && step === 2 && <InfoPanel id={selected} name={meta.name} desc={meta.desc} flow={flow} popular={POPULAR.includes(selected)} />}
          {ready && step === 3 && <ConfigAside flow={flow} cfg={cfg} patch={patch} account={account} />}
          {ready && step === 4 && <ReadyAside flow={flow} name={cfg.name} account={account} busy={busy} onBack={() => setStep(3)} onFinish={() => void finish()} />}
        </aside>
      </div>
    </div>
  );
}

/* ───────────── Sidebar bước 1 (giữ như cũ) ───────────── */
function OverviewAside({ ctx, connected, pct }: { ctx: SocialCtx; connected: ChannelId[]; pct: number }) {
  return (
    <>
      <section className={cn(card, "bg-gradient-to-br from-violet-50/70 to-white p-4")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg border border-violet-100 bg-white text-[#6941c6]"><Layers className="size-5" /></span>
            <h3 className="font-semibold">Tổng quan kết nối</h3>
          </div>
          <Button variant="outline" size="sm" onClick={() => ctx.go("connect")} className="border-violet-200 text-xs text-[#6941c6]">Xem tất cả</Button>
        </div>
        <p className="mt-4"><span className="text-3xl font-bold text-[#6941c6]">{connected.length}</span><span className="text-xl text-slate-600"> / {TOTAL}</span></p>
        <p className="text-sm text-slate-500">kênh đã được kết nối</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#6941c6] transition-all" style={{ width: `${pct}%` }} /></div>
        {connected.length > 0 && (
          <ul className="mt-4 space-y-2">
            {connected.map((id) => (
              <li key={id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="flex items-center gap-2 text-sm"><ChannelLogo id={id} size="sm" />{CHANNEL_META[id].name}</span>
                <span className="flex items-center gap-2">
                  <Badge tone="green" icon={<CheckCircle2 className="size-3" />}>Đã kết nối</Badge>
                  <button aria-label="Tùy chọn" onClick={() => ctx.go("channel-manage", { channel: id })} className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="size-4" /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex gap-3 rounded-lg border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-amber-500 shadow-sm"><ShieldCheck className="size-5" /></span>
        <div>
          <h3 className="text-sm font-semibold text-amber-800">Kết nối an toàn &amp; bảo mật</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">ÉLANE chỉ yêu cầu các quyền cần thiết thông qua cơ chế OAuth chính thức từ các nền tảng. Thông tin tài khoản của bạn luôn được mã hóa và bảo mật tuyệt đối.</p>
          <button onClick={() => toast.info("Hướng dẫn chi tiết sẽ được bổ sung")} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#6941c6] hover:underline">Tìm hiểu thêm<ArrowRight className="size-3.5" /></button>
        </div>
      </section>

      <section className={cn(card, "p-4")}>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-violet-50 text-[#6941c6]"><Zap className="size-5" /></span>
          <h3 className="font-semibold">Lợi ích khi kết nối đa kênh</h3>
        </div>
        <ul className="mt-4 space-y-4">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"><Icon className="size-5" /></span>
              <div><p className="text-sm font-semibold">{title}</p><p className="text-xs leading-5 text-slate-500">{desc}</p></div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
