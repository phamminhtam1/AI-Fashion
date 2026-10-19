import { useState } from "react";
import {
  ArrowRight, BadgeCheck, BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, ExternalLink,
  Headphones, Info, Loader2, Package, RefreshCw, Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChannelId } from "../types";
import { ChannelLogo, Switch, card } from "../ui";
import {
  CATEGORIES, COLLECTIONS, EXTRAS, SAMPLE_PRODUCTS,
  type Cfg, type ChannelFlow, type ContentCfg, type ExtraKey, type FlowAccount,
} from "./channelFlow";

/* ───────────── Helpers & primitives ───────────── */
const VIOLET = "bg-[#6941c6] hover:bg-[#5b36b0]";
const FIELD = "w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#6941c6] focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50";
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "")}K` : `${n}`);
const soon = () => toast.info("Tính năng này sẽ được bổ sung");

type BadgeTone = "blue" | "green" | "amber" | "slate";
const TONE: Record<BadgeTone, string> = {
  blue: "bg-blue-50 text-blue-600", green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-100 text-amber-700", slate: "bg-slate-100 text-slate-500",
};
export function Badge({ tone, icon, children }: { tone: BadgeTone; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[tone])}>
      {icon}{children}
    </span>
  );
}

function StepAvatar({ name, cls = "size-12 text-base" }: { name: string; cls?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-violet-100 font-semibold text-[#6941c6]", cls)}>
      {name.replace(/^@/, "").charAt(0).toUpperCase()}
    </span>
  );
}
const Tick = ({ on = true }: { on?: boolean }) => (
  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-white", on ? "bg-emerald-500" : "bg-slate-400")}>
    {on ? <Check className="size-3" strokeWidth={3} /> : <Info className="size-3" strokeWidth={3} />}
  </span>
);
const Radio = ({ on }: { on: boolean }) => (
  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", on ? "border-[#6941c6] bg-[#6941c6]" : "border-slate-300 bg-white")}>
    {on && <Check className="size-3 text-white" strokeWidth={3} />}
  </span>
);
function Checkbox({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-start gap-3 text-left">
      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded border", on ? "border-[#6941c6] bg-[#6941c6]" : "border-slate-300 bg-white")}>
        {on && <Check className="size-3.5 text-white" strokeWidth={3} />}
      </span>
      <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-slate-500">{desc}</span></span>
    </button>
  );
}
function SelectBox({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, "h-10 appearance-none pr-9")}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-slate-500" />
    </div>
  );
}
const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="mb-1.5 block text-xs font-medium text-slate-700">{children}{required && <span className="text-red-500"> *</span>}</label>
);
const Counter = ({ n, max }: { n: number; max: number }) => <span className="mt-1 block text-right text-xs text-slate-400">{n}/{max}</span>;

function Head({ id, title, desc, right }: { id: ChannelId; title: string; desc: string; right?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="flex items-center gap-3">
        <ChannelLogo id={id} size="lg" />
        <div><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-slate-500">{desc}</p></div>
      </div>
      {right}
    </header>
  );
}
function Block({ n, title, desc, action, children }: { n: number; title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="px-5 py-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><h3 className="font-semibold">{n}. {title}</h3>{desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}
const EditBtn = ({ onClick, children = "Chỉnh sửa" }: { onClick: () => void; children?: React.ReactNode }) => (
  <Button variant="outline" size="sm" onClick={onClick} className="shrink-0 gap-1.5 text-xs">{children}</Button>
);
function Footer({ onBack, onNext, nextLabel = "Tiếp tục", disabled, busy, icon, wide }: {
  onBack: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean; busy?: boolean; icon?: React.ReactNode; wide?: boolean;
}) {
  return (
    <footer className="flex items-center justify-between gap-3 p-5">
      <Button variant="outline" onClick={onBack}>Quay lại</Button>
      <Button onClick={onNext} disabled={disabled || busy} className={cn("gap-2", VIOLET, wide && "flex-1")}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : icon}{nextLabel}<ArrowRight className="size-4" />
      </Button>
    </footer>
  );
}

/* ───────────── Stepper ───────────── */
const STEPS = [
  { title: "Cấu hình API", sub: "Nhập thông tin tích hợp" },
  { title: "Đăng nhập", sub: "Xác thực và cấp quyền" },
  { title: "Đồng bộ & thiết lập", sub: "Chọn dữ liệu cần đồng bộ" },
  { title: "Hoàn tất", sub: "Kiểm tra và kết nối" },
];
export function StepBar({ current, onGo }: { current: number; onGo: (n: number) => void }) {
  return (
    <ol className={cn(card, "social-connect-stepper flex items-center px-5 py-3")}>
      {STEPS.map((s, i) => {
        const n = i + 1, active = n === current, done = n < current;
        return (
          <li key={s.title} className={cn("flex min-w-0 items-center", i < STEPS.length - 1 && "flex-1")}>
            <button
              type="button" disabled={!done} onClick={() => onGo(n)} aria-current={active ? "step" : undefined}
              className={cn("group flex shrink-0 items-center gap-2 bg-transparent text-left", done && "cursor-pointer")}
            >
              <span className={cn(
                "social-step-dot grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-all duration-300",
                active && "is-active bg-[#6941c6] text-white shadow-[0_0_0_4px_rgba(105,65,198,0.12)]",
                done && "bg-[#6941c6] text-white group-hover:scale-105",
                !active && !done && "bg-slate-100 text-slate-500",
              )}>
                {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
              </span>
              <span className={cn("hidden whitespace-nowrap text-sm font-semibold sm:block", active || done ? "text-[#6941c6]" : "text-slate-500")}>{s.title}</span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="relative mx-3 h-px min-w-5 flex-1 overflow-hidden bg-slate-200" aria-hidden="true">
                <span className={cn("social-step-line absolute inset-y-0 left-0 bg-[#6941c6]", done ? "is-complete w-full" : "w-0")} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ═════════════ BƯỚC 1 · Cấu hình API ═════════════ */
export type ApiConfigPayload = {
  appId: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphVersion: string;
  redirectUri: string;
};

export function ApiConfigStep({ id, name, configured, initial, busy, onSave, onBack }: {
  id: ChannelId;
  name: string;
  configured: boolean;
  initial: Partial<ApiConfigPayload>;
  busy: boolean;
  onSave: (payload: ApiConfigPayload) => void;
  onBack: () => void;
}) {
  const isMeta = id === "facebook" || id === "instagram";
  const [form, setForm] = useState<ApiConfigPayload>({
    appId: initial.appId ?? "",
    appSecret: "",
    webhookVerifyToken: "",
    graphVersion: initial.graphVersion ?? (isMeta ? "v23.0" : "v1"),
    redirectUri: initial.redirectUri ?? "",
  });
  const valid = Boolean(
    form.appId.trim()
    && (configured || form.appSecret.trim())
    && (!isMeta || configured || form.webhookVerifyToken.trim()),
  );

  return (
    <section className={cn(card, "overflow-hidden")}>
      <Head id={id} title={`Cấu hình API ${name}`} desc="Hoàn tất cấu hình kỹ thuật trước khi đăng nhập tài khoản." />
      <Block n={1} title="Thông tin ứng dụng" desc={`Nhập thông tin từ trang dành cho nhà phát triển của ${name}.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label required>{isMeta ? "Meta App ID" : "Client ID / API Key"}</Label><input value={form.appId} onChange={(e) => setForm({ ...form, appId: e.target.value })} className={cn(FIELD, "h-10")} placeholder="Nhập mã ứng dụng" /></div>
          <div><Label required>App Secret</Label><input type="password" value={form.appSecret} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} className={cn(FIELD, "h-10")} placeholder={configured ? "Để trống để giữ khóa hiện tại" : "Nhập khóa bí mật"} /></div>
          {isMeta && <div><Label>Graph API version</Label><input value={form.graphVersion} onChange={(e) => setForm({ ...form, graphVersion: e.target.value })} className={cn(FIELD, "h-10")} /></div>}
          <div><Label>{isMeta ? "Webhook Verify Token" : "Webhook Secret"}</Label><input type="password" value={form.webhookVerifyToken} onChange={(e) => setForm({ ...form, webhookVerifyToken: e.target.value })} className={cn(FIELD, "h-10")} placeholder={configured ? "Để trống để giữ token hiện tại" : "Nhập hoặc tự tạo token"} /></div>
        </div>
      </Block>
      <Block n={2} title="Đường dẫn xác thực" desc="Sao chép đường dẫn này vào phần OAuth/Redirect của nền tảng.">
        <input value={form.redirectUri} onChange={(e) => setForm({ ...form, redirectUri: e.target.value })} className={cn(FIELD, "h-10")} placeholder="https://.../oauth/callback" />
        <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/70 p-3 text-xs leading-5 text-slate-600">Sau khi lưu thành công, bước đăng nhập mới được mở. Bạn sẽ không cần quay sang trang cấu hình khác.</div>
      </Block>
      <Footer onBack={onBack} onNext={() => onSave(form)} disabled={!valid} busy={busy} nextLabel={configured ? "Lưu và tiếp tục" : "Lưu cấu hình API"} />
    </section>
  );
}

/* ═════════════ BƯỚC 2 · Kết nối tài khoản ═════════════ */
export function ConnectStep({ id, name, flow, loggedIn, busy, accountId, onLogin, onPick, onBack, onNext }: {
  id: ChannelId; name: string; flow: ChannelFlow; loggedIn: boolean; busy: boolean; accountId: string | null;
  onLogin: () => void; onPick: (id: string) => void; onBack: () => void; onNext: () => void;
}) {
  const [q, setQ] = useState("");
  const list = flow.accounts.filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase()));
  const rows = Math.ceil(flow.permissions.length / 2);

  return (
    <section className={cn(card, "overflow-hidden")}>
      <Head id={id} title={`Kết nối ${name}`} desc={flow.tagline}
        right={<Button variant="outline" size="sm" onClick={soon} className="gap-2"><BookOpen className="size-4" />Xem hướng dẫn</Button>} />

      <Block n={1} title="Đăng nhập tài khoản" desc={`Bạn sẽ được chuyển đến ${name} để đăng nhập và cấp quyền truy cập cho ÉLANE.`}>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-violet-100 bg-violet-50/60 p-4">
          <div className="flex items-center gap-3">
            <ChannelLogo id={id} size="lg" />
            <div><p className="font-semibold">{flow.loginTitle}</p><p className="max-w-md text-xs text-slate-500">{flow.loginDesc}</p></div>
          </div>
          {loggedIn ? (
            <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-600"><CheckCircle2 className="size-4" />Đã đăng nhập</span>
          ) : (
            <Button onClick={onLogin} disabled={busy} className={cn("gap-2", VIOLET)}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}{flow.loginCta}{!busy && <ExternalLink className="size-4" />}
            </Button>
          )}
        </div>
      </Block>

      <Block n={2} title={`Chọn ${flow.accountLabel}`} desc={`Sau khi đăng nhập, chọn ${flow.accountLabel} bạn muốn kết nối với ÉLANE.`}>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-3 size-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Tìm kiếm ${flow.accountLabel}...`} className={cn(FIELD, "h-10 pl-9")} />
        </div>
        <div className={cn("overflow-hidden rounded-lg border border-slate-200", !loggedIn && "opacity-60")}>
          {list.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Không tìm thấy {flow.accountLabel} phù hợp.</p>}
          {list.map((a) => {
            const on = a.id === accountId;
            return (
              <button key={a.id} type="button" disabled={!loggedIn} onClick={() => onPick(a.id)}
                className={cn("grid w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 grid-cols-[20px_48px_minmax(0,1fr)] sm:grid-cols-[20px_48px_minmax(0,1fr)_130px_130px]",
                  on ? "bg-violet-50/70 ring-1 ring-inset ring-[#6941c6]" : "hover:bg-slate-50")}>
                <Radio on={on} />
                <StepAvatar name={a.name} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2"><b className="truncate text-sm font-semibold">{a.name}</b>{a.suggested && <Badge tone="blue">Đề xuất</Badge>}</span>
                  <span className="text-xs text-slate-500">{a.category}</span>
                </span>
                <span className="hidden sm:block"><b className="block text-sm font-semibold">{a.followers.toLocaleString("en-US")}</b><span className="text-xs text-slate-500">{flow.followersLabel}</span></span>
                <span className="hidden sm:block"><b className="block text-sm font-semibold">{a.posts.toLocaleString("en-US")}</b><span className="text-xs text-slate-500">{flow.postsLabel}</span></span>
              </button>
            );
          })}
        </div>
        {!loggedIn && <p className="mt-2 text-xs text-slate-500">Đăng nhập ở bước 1 để xem danh sách {flow.accountLabel} của bạn.</p>}
      </Block>

      <Block n={3} title="Cấp quyền truy cập" desc="ÉLANE cần các quyền sau để hoạt động. Bạn có thể điều chỉnh sau trong phần cấu hình.">
        <ul className="grid gap-x-6 gap-y-4 rounded-lg border border-slate-200 p-4 sm:grid-flow-col sm:grid-cols-2" style={{ gridTemplateRows: `repeat(${rows}, auto)` }}>
          {flow.permissions.map((p) => (
            <li key={p.title} className="flex items-start gap-3"><Tick on={!p.optional} /><span><b className="block text-sm font-medium">{p.title}</b><span className="text-xs text-slate-500">{p.desc}</span></span></li>
          ))}
        </ul>
      </Block>

      <Footer onBack={onBack} onNext={onNext} disabled={!loggedIn || !accountId} />
    </section>
  );
}

export function InfoPanel({ id, name, desc, flow, popular }: { id: ChannelId; name: string; desc: string; flow: ChannelFlow; popular: boolean }) {
  return (
    <>
      <section className={cn(card, "p-5")}>
        <h3 className="text-base font-semibold">Thông tin kênh</h3>
        <div className="mt-4 flex items-start gap-3">
          <ChannelLogo id={id} size="lg" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">{name}{popular && <Badge tone="green">Phổ biến</Badge>}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
          </div>
        </div>
        <h4 className="mt-5 text-sm font-semibold">Tính năng chính</h4>
        <ul className="mt-3 space-y-2.5">{flow.features.map((f) => <li key={f} className="flex items-center gap-2.5 text-sm"><Tick />{f}</li>)}</ul>
      </section>

      <section className={cn(card, "p-5")}>
        <h3 className="flex items-center gap-2 text-base font-semibold"><span className="grid size-6 place-items-center rounded-full bg-amber-500 text-xs font-bold text-white">!</span>Lưu ý</h3>
        <ul className="mt-4 space-y-2.5">
          {flow.notes.map((n) => <li key={n} className="flex items-start gap-2.5 text-sm text-slate-600"><Check className="mt-0.5 size-4 shrink-0 rounded-full bg-slate-200 p-0.5 text-slate-500" strokeWidth={3} />{n}</li>)}
        </ul>
      </section>

      <section className="rounded-lg border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet-100 text-[#6941c6]"><Headphones className="size-6" /></span>
          <div><h3 className="font-semibold">Cần hỗ trợ?</h3><p className="mt-1 text-xs leading-5 text-slate-500">Xem hướng dẫn chi tiết hoặc liên hệ đội ngũ hỗ trợ nếu gặp khó khăn trong quá trình kết nối.</p></div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={soon} className="border-violet-200 bg-white text-[#6941c6] hover:bg-violet-50 hover:text-[#6941c6]">Xem hướng dẫn</Button>
          <button onClick={() => toast.info("Chúng tôi sẽ liên hệ lại với bạn")} className="inline-flex items-center gap-1 text-sm font-medium text-[#6941c6] hover:underline">Liên hệ hỗ trợ<ArrowRight className="size-4" /></button>
        </div>
      </section>
    </>
  );
}

/* ═════════════ BƯỚC 3 · Cấu hình ═════════════ */
export function ConfigStep({ id, name, flow, cfg, patch, accountId, onAccount, onBack, onNext }: {
  id: ChannelId; name: string; flow: ChannelFlow; cfg: Cfg; patch: (p: Partial<Cfg>) => void;
  accountId: string | null; onAccount: (id: string) => void; onBack: () => void; onNext: () => void;
}) {
  let n = 1;
  const nSync = flow.commerce ? ++n : 0;
  const nPost = flow.canPost ? ++n : 0;
  const nPerm = ++n;
  const categories = Array.from(new Set([cfg.category, ...CATEGORIES]));

  return (
    <section className={cn(card, "overflow-hidden")}>
      <Head id={id} title={`Cấu hình kênh – ${name}`} desc={`Thiết lập các tùy chọn đồng bộ, quản lý nội dung và tự động hóa cho kênh ${name}.`}
        right={<div className="flex items-center gap-2"><Badge tone="green">Đã kết nối</Badge><Button variant="outline" size="sm" onClick={() => toast.success("Kết nối hoạt động bình thường")}>Kiểm tra kết nối</Button></div>} />

      <Block n={1} title="Thông tin cơ bản">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label required>Tên hiển thị</Label>
              <input value={cfg.name} maxLength={50} onChange={(e) => patch({ name: e.target.value })} className={cn(FIELD, "h-10")} />
              <Counter n={cfg.name.length} max={50} />
            </div>
            <div>
              <Label required>{cap(flow.accountLabel)}</Label>
              <div className="flex gap-2">
                <SelectBox className="flex-1" value={accountId ?? ""} onChange={onAccount} options={flow.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.externalId})` }))} />
                <Button variant="outline" size="icon" aria-label="Làm mới danh sách" onClick={() => toast.info("Đã làm mới danh sách")}><RefreshCw className="size-4" /></Button>
              </div>
            </div>
            <div>
              <Label>Danh mục</Label>
              <SelectBox value={cfg.category} onChange={(v) => patch({ category: v })} options={categories.map((c) => ({ value: c, label: c }))} />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Mô tả (tùy chọn)</Label>
              <textarea value={cfg.desc} maxLength={200} rows={4} onChange={(e) => patch({ desc: e.target.value })} className={cn(FIELD, "resize-none py-2")} />
              <Counter n={cfg.desc.length} max={200} />
            </div>
            <div>
              <Label>Logo &amp; ảnh bìa</Label>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
                <div>
                  <p className="mb-1 text-xs text-slate-500">Ảnh đại diện</p>
                  <div className="flex items-center gap-3">
                    <StepAvatar name={cfg.name || name} cls="size-16 text-xl" />
                    <div><Button variant="outline" size="sm" onClick={soon} className="border-violet-200 text-[#6941c6]">Thay đổi</Button><p className="mt-1 text-[11px] text-slate-400">JPG, PNG (tối đa 2MB)</p></div>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-slate-500">Ảnh bìa</p>
                  <div className="relative h-16 rounded-lg bg-gradient-to-br from-stone-200 via-stone-100 to-violet-100">
                    <Button variant="outline" size="sm" onClick={soon} className="absolute bottom-1.5 right-1.5 h-7 bg-white text-xs text-[#6941c6]">Thay đổi</Button>
                  </div>
                  <p className="mt-1 text-right text-[11px] text-slate-400">JPG, PNG (tối đa 10MB)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Block>

      {flow.commerce && (
        <Block n={nSync} title="Đồng bộ sản phẩm">
          <div className="overflow-hidden rounded-lg border border-violet-100">
            <div className="flex items-center gap-4 bg-violet-50/70 p-4">
              <Switch checked={cfg.syncProducts} onChange={(v) => patch({ syncProducts: v })} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Đồng bộ sản phẩm từ ÉLANE lên {flow.shopName}</p>
                <p className="text-xs text-slate-500">Tự động cập nhật sản phẩm, giá, tồn kho và hình ảnh từ hệ thống.</p>
              </div>
              <Button variant="outline" size="sm" onClick={soon} className="hidden gap-1.5 border-violet-200 bg-white text-[#6941c6] sm:inline-flex"><BookOpen className="size-4" />Xem hướng dẫn</Button>
            </div>
            {cfg.syncProducts && (
              <div className="p-4">
                <p className="mb-2 text-sm font-medium">Chọn bộ sưu tập / danh mục sản phẩm</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {COLLECTIONS.map((c) => (
                    <button key={c.id} type="button" role="radio" aria-checked={cfg.collection === c.id} onClick={() => patch({ collection: c.id })}
                      className={cn("flex items-start gap-3 rounded-lg border p-3 text-left", cfg.collection === c.id ? "border-[#6941c6] bg-violet-50/60" : "border-slate-200 hover:bg-slate-50")}>
                      <Radio on={cfg.collection === c.id} />
                      <span><b className="block text-sm font-medium">{c.title}</b><span className="text-xs text-slate-500">{c.desc}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Block>
      )}

      {flow.canPost && (
        <Block n={nPost} title="Tự động đăng bài">
          <div className="flex items-center gap-4 rounded-lg bg-violet-50/70 p-4">
            <Switch checked={cfg.autoPost} onChange={(v) => patch({ autoPost: v })} />
            <div>
              <p className="text-sm font-semibold">Cho phép tự động đăng bài theo lịch</p>
              <p className="text-xs text-slate-500">Đăng bài từ hệ thống ÉLANE lên {name} theo thời gian đã lên lịch.</p>
            </div>
          </div>
        </Block>
      )}

      <Block n={nPerm} title="Quyền truy cập và dữ liệu">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {flow.permissions.filter((p) => !p.optional).slice(0, 4).map(({ icon: Icon, title, desc }) => (
            <li key={title} className="relative flex items-start gap-3 rounded-lg border border-slate-200 p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><Icon className="size-4" /></span>
              <span><b className="block text-sm font-medium leading-5">{title}</b><span className="text-xs text-slate-500">{desc}</span></span>
              <span className="absolute right-2 top-2"><Tick /></span>
            </li>
          ))}
        </ul>
      </Block>

      <Footer onBack={onBack} onNext={onNext} disabled={!cfg.name.trim()} />
    </section>
  );
}

/* Khung trang xem trước, dùng chung cho bước 3 & 4 */
function MiniPage({ flow, name, followers, verified, tab, onTab, children }: {
  flow: ChannelFlow; name: string; followers: number; verified?: boolean; tab: number; onTab?: (i: number) => void; children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid h-28 place-items-center bg-gradient-to-br from-stone-200 via-stone-100 to-violet-100 font-serif text-lg tracking-[0.25em] text-stone-500">ÉLANE</div>
      <div className="-mt-9 flex items-end gap-3 px-4">
        <StepAvatar name={name} cls="size-[72px] border-4 border-white text-2xl" />
        <div className="min-w-0 pb-1">
          <p className="flex items-center gap-1.5 truncate font-semibold">{name || "—"}{verified && <BadgeCheck className="size-4 shrink-0 fill-blue-500 text-white" />}</p>
          <p className="text-xs text-slate-500">{compact(followers)} {flow.followersLabel.toLowerCase()}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2 px-4">
        <span className="flex-1 rounded-md bg-blue-600 py-1.5 text-center text-xs font-medium text-white">{flow.previewActions[0]}</span>
        <span className="flex-1 rounded-md bg-slate-100 py-1.5 text-center text-xs font-medium text-slate-700">{flow.previewActions[1]}</span>
        <span className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">···</span>
      </div>
      <div className="mt-3 flex overflow-x-auto border-b border-slate-200 px-2 text-xs">
        {flow.previewTabs.map((t, i) => (
          <button key={t} type="button" onClick={() => onTab?.(i)} className={cn("whitespace-nowrap px-3 py-2", i === tab ? "border-b-2 border-[#6941c6] font-medium text-[#6941c6]" : "text-slate-500", !onTab && "cursor-default")}>{t}</button>
        ))}
      </div>
      {children}
    </div>
  );
}
function Placeholder({ flow }: { flow: ChannelFlow }) {
  if (flow.commerce) {
    return (
      <div className="grid grid-cols-3 gap-2 p-3">
        {SAMPLE_PRODUCTS.map(([nm, price]) => (
          <div key={nm}>
            <span className="grid aspect-[4/5] place-items-center rounded bg-gradient-to-br from-stone-100 to-stone-200 text-stone-400"><Package className="size-6" /></span>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4">{nm}</p><p className="text-[11px] font-medium">{price}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3 p-3">
      {[0, 1, 2].map((i) => <div key={i} className="flex gap-3"><span className="size-12 shrink-0 rounded bg-slate-100" /><span className="flex-1 space-y-2 pt-1"><span className="block h-2 w-3/4 rounded bg-slate-100" /><span className="block h-2 w-1/2 rounded bg-slate-100" /></span></div>)}
    </div>
  );
}
const shopTab = (f: ChannelFlow) => Math.max(0, f.previewTabs.findIndex((t) => /Cửa hàng|Sản phẩm/.test(t)));

export function ConfigAside({ flow, cfg, patch, account }: { flow: ChannelFlow; cfg: Cfg; patch: (p: Partial<Cfg>) => void; account: FlowAccount | null }) {
  const [view, setView] = useState("desktop");
  const setExtra = (k: ExtraKey, v: boolean) => patch({ extras: { ...cfg.extras, [k]: v } });
  return (
    <>
      <section className={cn(card, "p-5")}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">Xem trước {flow.accountLabel}<ExternalLink className="size-4 text-[#6941c6]" /></h3>
          <SelectBox className="w-28" value={view} onChange={setView} options={[{ value: "desktop", label: "Desktop" }, { value: "mobile", label: "Mobile" }]} />
        </div>
        <div className={cn(view === "mobile" && "mx-auto max-w-[260px]")}>
          <MiniPage flow={flow} name={cfg.name} followers={account?.followers ?? 0} tab={shopTab(flow)}><Placeholder flow={flow} /></MiniPage>
        </div>
      </section>

      {flow.commerce && (
        <section className={cn(card, "p-5")}>
          <h3 className="text-sm font-semibold">Thiết lập bổ sung (tùy chọn)</h3>
          <div className="mt-3 space-y-3">
            {EXTRAS.map((e) => <Checkbox key={e.key} on={cfg.extras[e.key]} onChange={(v) => setExtra(e.key, v)} label={e.label} desc={e.desc} />)}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-violet-100 bg-violet-50/70 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-[#6941c6]" />
          <div>
            <h3 className="text-sm font-semibold text-[#53389e]">Lưu ý quan trọng</h3>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
              <li>Đảm bảo {flow.accountLabel} có quyền quản lý đầy đủ.</li>
              <li>Việc đồng bộ dữ liệu có thể mất vài phút.</li>
              <li>Bạn có thể thay đổi cấu hình này bất kỳ lúc nào.</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

/* ═════════════ BƯỚC 4 · Hoàn tất ═════════════ */
export function ReviewStep({ id, name, flow, cfg, content, setContent, account, goStep }: {
  id: ChannelId; name: string; flow: ChannelFlow; cfg: Cfg; content: ContentCfg; setContent: (c: ContentCfg) => void;
  account: FlowAccount | null; goStep: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const collection = COLLECTIONS.find((c) => c.id === cfg.collection)?.title ?? "";
  const sync: [string, boolean, string][] = [
    ...(flow.commerce ? ([
      ["Đồng bộ sản phẩm", cfg.syncProducts, `${collection} · Cập nhật mỗi 30 phút`],
      ["Đồng bộ giá và tồn kho", cfg.syncProducts && (cfg.extras.price || cfg.extras.stock), "Lấy từ hệ thống ÉLANE"],
      ["Đồng bộ đơn hàng", cfg.syncProducts, `Đồng bộ đơn từ ${flow.shopName} về ÉLANE`],
      ["Đồng bộ hình ảnh", cfg.syncProducts && cfg.extras.images, "Sử dụng hình ảnh sản phẩm từ hệ thống"],
    ] as [string, boolean, string][]) : []),
    ...(flow.canPost ? ([["Tự động đăng bài", cfg.autoPost, "Theo lịch đã thiết lập"]] as [string, boolean, string][]) : []),
  ];
  const contentRows: [string, string, keyof ContentCfg | null][] = [
    ["Danh mục nội dung", cfg.category, null],
    ["Tông giọng thương hiệu", content.tone, "tone"],
    ["Đối tượng khách hàng", content.audience, "audience"],
    ["Mục tiêu", content.goal, "goal"],
  ];

  return (
    <section className={cn(card, "overflow-hidden")}>
      <Head id={id} title={`Hoàn tất thiết lập kênh ${name}`} desc="Vui lòng kiểm tra lại các thông tin đã thiết lập trước khi hoàn tất." />

      <Block n={1} title="Thông tin kênh" action={<EditBtn onClick={() => goStep(3)} />}>
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <StepAvatar name={cfg.name} cls="size-20 text-2xl" />
          <div className="min-w-0 space-y-1 text-xs text-slate-600">
            <p className="flex items-center gap-2 text-base font-semibold text-slate-900">{cfg.name}<Badge tone="green">Đã kết nối</Badge></p>
            <p>{flow.idLabel}: {account?.externalId}</p>
            <p>Danh mục: {cfg.category}</p>
            <p className="line-clamp-2">Mô tả: {cfg.desc || "—"}</p>
          </div>
        </div>
      </Block>

      <Block n={2} title="Quyền truy cập" action={<EditBtn onClick={() => goStep(2)} />}>
        <ul className="grid gap-x-6 gap-y-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {flow.permissions.map((p) => (
            <li key={p.title} className="flex items-start gap-3"><Tick on={!p.optional} /><span><b className="block text-sm font-medium">{p.title}</b><span className="text-xs text-slate-500">{p.desc}</span></span></li>
          ))}
        </ul>
      </Block>

      <Block n={3} title="Thiết lập đồng bộ" action={<EditBtn onClick={() => goStep(3)} />}>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
          {sync.map(([label, on, note]) => (
            <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[200px_80px_1fr]">
              <span>{label}</span>
              <span><Badge tone={on ? "green" : "slate"}>{on ? "Đã bật" : "Đã tắt"}</Badge></span>
              <span className="col-span-2 text-slate-600 sm:col-span-1">{note}</span>
            </div>
          ))}
        </div>
      </Block>

      <Block n={4} title="Thiết lập nội dung" action={<EditBtn onClick={() => setEditing(!editing)}>{editing ? "Xong" : "Chỉnh sửa"}</EditBtn>}>
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
          {contentRows.map(([label, value, key]) => (
            <div key={label} className="grid items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[200px_1fr]">
              <span>{label}</span>
              {editing && key ? <input value={value} onChange={(e) => setContent({ ...content, [key]: e.target.value })} className={cn(FIELD, "h-8")} /> : <span className="text-slate-600">{value}</span>}
            </div>
          ))}
        </div>
      </Block>
      <div className="h-3" />
    </section>
  );
}

export function ReadyAside({ flow, name, account, busy, onBack, onFinish }: {
  flow: ChannelFlow; name: string; account: FlowAccount | null; busy: boolean; onBack: () => void; onFinish: () => void;
}) {
  const [tab, setTab] = useState(0);
  const next = ([
    flow.canPost && ["Tạo bài viết đầu tiên", "Sử dụng AI hoặc tự soạn nội dung"],
    flow.canPost && ["Thiết lập lịch đăng", "Tạo lịch đăng tự động cho kênh"],
    flow.commerce && ["Đồng bộ sản phẩm", "Kiểm tra và điều chỉnh danh sách sản phẩm"],
    !flow.canPost && ["Kiểm tra đơn hàng đầu tiên", "Theo dõi đơn đồng bộ về ÉLANE"],
    ["Khám phá các tính năng khác", "Bình luận, tin nhắn, analytics..."],
  ].filter(Boolean)) as [string, string][];

  return (
    <>
      <section className={cn(card, "p-5")}>
        <h3 className="mb-4 text-base font-semibold">Xem trước kênh sau khi kết nối</h3>
        <MiniPage flow={flow} name={name} followers={account?.followers ?? 0} verified tab={tab} onTab={setTab}><Placeholder flow={flow} /></MiniPage>
        <div className="mt-4 flex items-start gap-3 rounded-lg bg-violet-50/80 p-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#6941c6] text-white"><Check className="size-4" strokeWidth={3} /></span>
          <div><p className="text-sm font-semibold">Kênh đã sẵn sàng</p><p className="text-xs leading-5 text-slate-600">Bạn có thể bắt đầu tạo nội dung{flow.canPost ? ", đăng bài" : ""}{flow.commerce ? " và đồng bộ sản phẩm" : ""} ngay bây giờ.</p></div>
        </div>
      </section>

      <section className={cn(card, "p-5")}>
        <h3 className="text-base font-semibold">Các bước tiếp theo</h3>
        <ol className="mt-4 space-y-3.5">
          {next.map(([t, d], i) => (
            <li key={t} className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-50 text-sm font-semibold text-[#6941c6]">{i + 1}</span>
              <div><p className="text-sm font-semibold">{t}</p><p className="text-xs text-slate-500">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className={cn(card)}>
        <Footer onBack={onBack} onNext={onFinish} busy={busy} wide nextLabel="Hoàn tất kết nối kênh" icon={<Check className="size-4" />} />
      </section>
    </>
  );
}
