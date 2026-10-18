import { useState } from "react";
import {
  ArrowRight, BadgeCheck, BarChart3, Check, CheckCircle2, ChevronRight, Clock, ExternalLink, FileText,
  Info, Layers, Loader2, MessageCircle, MoreHorizontal, Package, Send, ShieldCheck, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANNEL_META, PERMISSIONS } from "../mock";
import type { ChannelId, SocialCtx } from "../types";
import { ChannelLogo, PageHeader, Switch, card } from "../ui";

const STEPS = [{ title: "Chọn kênh" }, { title: "Kết nối tài khoản" }, { title: "Cấu hình" }, { title: "Hoàn tất" }];
const GRID: ChannelId[] = ["facebook", "instagram", "tiktok", "shopee", "lazada", "zalo", "website", "youtube"];
const TOTAL = GRID.length + 1; // + "Kênh khác"
const POPULAR: ChannelId[] = ["facebook"];
const OPTIONS = ["Đồng bộ sản phẩm", "Đồng bộ đơn hàng", "Tự động đăng bài", "Tự động trả lời tin nhắn & bình luận"];
const BENEFITS = [
  { icon: Package, title: "Đồng bộ sản phẩm", desc: "Quản lý sản phẩm tập trung, cập nhật tồn kho real-time." },
  { icon: FileText, title: "Quản lý đơn hàng", desc: "Tất cả đơn hàng từ các kênh về một nơi." },
  { icon: Send, title: "Tự động đăng nội dung", desc: "Lên lịch và đăng bài hàng loạt trên nhiều kênh." },
  { icon: MessageCircle, title: "Quản lý tin nhắn tập trung", desc: "Trả lời khách hàng nhanh chóng, không bỏ sót." },
  { icon: BarChart3, title: "Báo cáo hiệu quả", desc: "Theo dõi doanh số, lượt tiếp cận và hiệu quả từng kênh." },
];

function StepBar({ steps, current }: { steps: { title: string }[]; current: number }) {
  return (
    <ol className={cn(card, "flex items-center px-6 py-4")}>
      {steps.map((s, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <li key={s.title} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
            <span className="flex shrink-0 items-center gap-3">
              <span className={cn(
                "grid size-9 place-items-center rounded-full text-sm font-semibold",
                active || done ? "bg-[#6941c6] text-white" : "bg-violet-100 text-[#6941c6]",
              )}>
                {done ? <Check className="size-4" /> : n}
              </span>
              <span className={cn("text-sm font-medium", active || done ? "text-[#6941c6]" : "text-slate-700")}>{s.title}</span>
            </span>
            {i < steps.length - 1 && <span className="mx-4 h-0 flex-1 border-t-2 border-dotted border-violet-200" />}
          </li>
        );
      })}
    </ol>
  );
}

type BadgeTone = "blue" | "green" | "amber";
const TONE: Record<BadgeTone, string> = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-100 text-amber-700",
};
function Badge({ tone, icon, children }: { tone: BadgeTone; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[tone])}>
      {icon}{children}
    </span>
  );
}

export function AddChannelPage({ ctx }: { ctx: SocialCtx }) {
  const [selected, setSelected] = useState<ChannelId | null>(ctx.wizardChannel);
  const [step, setStep] = useState(ctx.wizardChannel ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<boolean[]>([true, true, false, true]);
  const meta = selected ? CHANNEL_META[selected] : null;

  const connected = ctx.channels.filter((c) => c.connected);
  const pct = Math.min(100, Math.round((connected.length / TOTAL) * 100));

  const pick = (id: ChannelId) => { setSelected(id); setStep(2); };
  async function authorize() {
    if (!selected) return;
    if (selected === "instagram") { await ctx.connectChannel("instagram"); return; } // luồng OAuth thật, sẽ chuyển trang
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900)); // TODO(api): mở OAuth/đăng nhập của từng kênh
    setBusy(false); setStep(3);
  }
  async function finish() {
    if (!selected) return;
    await ctx.connectChannel(selected); // TODO(api): lưu cấu hình `opts` cùng lúc
    setStep(4);
  }

  function ChannelCard({ id }: { id: ChannelId }) {
    const m = CHANNEL_META[id];
    const done = !!ctx.channels.find((c) => c.id === id)?.connected;
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
          <button
            aria-label="Tùy chọn"
            onClick={() => (done ? ctx.go("channel-config", { channel: id }) : toast.info(`Hướng dẫn kết nối ${m.name} sẽ được bổ sung`))}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <MoreHorizontal className="size-5" />
          </button>
        </div>
        <h3 className="relative mt-3 font-semibold">{m.name}</h3>
        <p className="relative mt-1 min-h-[2.5rem] text-xs leading-5 text-slate-500">{m.desc}</p>
        {m.comingSoon ? (
          <Button disabled variant="outline" className="relative mt-3 w-full gap-2"><Clock className="size-4" />Sắp ra mắt</Button>
        ) : done ? (
          <Button disabled variant="outline" className="relative mt-3 w-full gap-2 bg-slate-50"><CheckCircle2 className="size-4" />Đã kết nối</Button>
        ) : (
          <Button variant="outline" onClick={() => pick(id)} className="relative mt-3 w-full border-violet-200 font-medium text-[#6941c6] hover:bg-violet-50 hover:text-[#6941c6]">
            Kết nối<ArrowRight className="absolute right-3 size-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <PageHeader onBack={() => (step > 1 && step < 4 ? setStep(step - 1) : ctx.go("connect"))} title="Thêm kênh bán hàng" desc="Kết nối các kênh bán hàng để đồng bộ sản phẩm, quản lý nội dung và tự động đăng bài." />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ───────── Cột chính ───────── */}
        <div className="min-w-0 space-y-5">
          <StepBar steps={STEPS} current={step} />

          {step === 1 && (
            <section className={cn(card, "p-5")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Chọn kênh muốn kết nối</h2>
                  <p className="mt-1 text-sm text-slate-500">Chọn một hoặc nhiều kênh bán hàng để bắt đầu kết nối với ELANE.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Chúng tôi sẽ liên hệ lại với bạn")} className="gap-2 border-violet-200 text-xs text-slate-700">
                  <Info className="size-4 text-[#6941c6]" />Không tìm thấy kênh bạn cần?<ChevronRight className="size-4 text-[#6941c6]" />
                </Button>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {GRID.map((id) => <ChannelCard key={id} id={id} />)}
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

          {step === 2 && meta && selected && (
            <section className={cn(card, "mx-auto max-w-2xl p-6")}>
              <div className="flex items-center gap-3"><ChannelLogo id={selected} size="lg" /><div><h2 className="text-lg font-semibold">Kết nối tài khoản {meta.name}</h2><p className="text-sm text-slate-500">Bạn sẽ được chuyển sang {meta.name} để cấp quyền cho ELANE.</p></div></div>
              <h3 className="mt-5 text-sm font-semibold">ELANE sẽ được cấp các quyền</h3>
              <ul className="mt-2 space-y-2">{PERMISSIONS.slice(0, 4).map((p) => <li key={p.title} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 rounded-full bg-emerald-500 p-0.5 text-white" /><span><b className="font-medium">{p.title}</b> <span className="text-slate-500">– {p.desc}</span></span></li>)}</ul>
              <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setStep(1)}>Chọn kênh khác</Button>
                <Button onClick={() => void authorize()} disabled={busy} className="gap-2 bg-[#6941c6] hover:bg-[#5b36b0]">{busy && <Loader2 className="size-4 animate-spin" />}Đăng nhập với {meta.name}</Button></div>
            </section>
          )}

          {step === 3 && meta && (
            <section className={cn(card, "mx-auto max-w-2xl p-6")}>
              <h2 className="text-lg font-semibold">Cấu hình kênh {meta.name}</h2><p className="mt-1 text-sm text-slate-500">Chọn những gì ELANE sẽ tự động thực hiện. Bạn có thể thay đổi sau.</p>
              <ul className="mt-4 divide-y divide-slate-100">{OPTIONS.map((o, i) => <li key={o} className="flex items-center justify-between py-3 text-sm"><span>{o}</span><Switch checked={opts[i]} onChange={(v) => setOpts(opts.map((x, j) => (j === i ? v : x)))} /></li>)}</ul>
              <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setStep(2)}>Quay lại</Button><Button onClick={() => void finish()} className="bg-[#6941c6] hover:bg-[#5b36b0]">Hoàn tất kết nối</Button></div>
            </section>
          )}

          {step === 4 && meta && selected && (
            <section className={cn(card, "mx-auto max-w-lg p-8 text-center")}>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check className="size-7" /></span>
              <h2 className="mt-4 text-lg font-semibold">Đã kết nối {meta.name}</h2><p className="mt-1 text-sm text-slate-500">Dữ liệu sẽ bắt đầu đồng bộ trong vài phút.</p>
              <div className="mt-6 flex justify-center gap-2"><Button variant="outline" onClick={() => { setSelected(null); setStep(1); }}>Kết nối kênh khác</Button><Button onClick={() => ctx.go("channel-config", { channel: selected })} className="bg-[#6941c6] hover:bg-[#5b36b0]">Cấu hình kênh</Button></div>
            </section>
          )}
        </div>

        {/* ───────── Sidebar phải ───────── */}
        <aside className="space-y-4">
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
                {connected.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="flex items-center gap-2 text-sm"><ChannelLogo id={c.id} size="sm" />{CHANNEL_META[c.id].name}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone="green" icon={<CheckCircle2 className="size-3" />}>Đã kết nối</Badge>
                      <button aria-label="Tùy chọn" onClick={() => ctx.go("channel-config", { channel: c.id })} className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="size-4" /></button>
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
              <p className="mt-1 text-xs leading-5 text-slate-600">ELANE chỉ yêu cầu các quyền cần thiết thông qua cơ chế OAuth chính thức từ các nền tảng. Thông tin tài khoản của bạn luôn được mã hóa và bảo mật tuyệt đối.</p>
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
        </aside>
      </div>
    </div>
  );
}