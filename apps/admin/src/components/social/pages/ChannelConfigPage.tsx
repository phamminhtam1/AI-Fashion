import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, MoreHorizontal, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Sparkline } from "../charts";
import { CHANNEL_META, CONFIG_TABS, MOCK_ACTIVITIES, PERMISSIONS } from "../mock";
import type { ChannelAccount, ConfigTab, SocialCtx } from "../types";
import { areaCls, Avatar, ChannelLogo, Delta, Dot, Empty, Field, inputCls, PageHeader, Pill, Section, Switch, card, fmt } from "../ui";

const TOGGLES: Partial<Record<ConfigTab, { title: string; desc: string; items: { label: string; desc: string; on: boolean }[] }>> = {
  products: { title: "Đồng bộ sản phẩm", desc: "Chọn dữ liệu sản phẩm được đồng bộ lên kênh.", items: [
    { label: "Tự động đồng bộ sản phẩm mới", desc: "Sản phẩm vừa tạo sẽ được đẩy lên kênh.", on: true },
    { label: "Đồng bộ giá và khuyến mãi", desc: "Cập nhật giá khi thay đổi trong ELANE.", on: true },
    { label: "Đồng bộ tồn kho", desc: "Ẩn sản phẩm khi hết hàng.", on: false }] },
  posting: { title: "Cài đặt đăng bài", desc: "Quy tắc đăng bài tự động.", items: [
    { label: "Tự động đăng bài đã duyệt", desc: "Bài được duyệt sẽ đăng đúng lịch.", on: true },
    { label: "Yêu cầu duyệt trước khi đăng", desc: "Nội dung AI luôn cần người duyệt.", on: true },
    { label: "Đăng vào khung giờ vàng", desc: "Gợi ý giờ có tương tác cao nhất.", on: false }] },
  automation: { title: "Tự động hóa", desc: "Các tác vụ ELANE xử lý thay bạn.", items: [
    { label: "Đồng bộ đơn hàng tự động", desc: "Đơn từ kênh được đưa vào mục Orders.", on: true },
    { label: "Gắn thẻ nguồn đơn hàng", desc: "Đo chuyển đổi theo từng bài viết.", on: true }] },
  inbox: { title: "Tin nhắn & bình luận", desc: "AI hỗ trợ chăm sóc khách hàng.", items: [
    { label: "AI tự trả lời tin nhắn", desc: "Trả lời câu hỏi thường gặp về sản phẩm, giá, size.", on: true },
    { label: "AI tự trả lời bình luận", desc: "Phản hồi bình luận công khai.", on: true },
    { label: "Chuyển cho nhân viên khi khiếu nại", desc: "Các trường hợp nhạy cảm không tự trả lời.", on: true }] },
};

export function ChannelConfigPage({ ctx }: { ctx: SocialCtx }) {
  const c = ctx.channels.find((x) => x.id === ctx.activeChannel) ?? ctx.channels[0];
  const m = CHANNEL_META[c.id];
  const [tab, setTab] = useState<ConfigTab>(ctx.configTab);
  useEffect(() => setTab(ctx.configTab), [ctx.configTab, ctx.activeChannel]);

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <PageHeader onBack={() => ctx.go("connect")}
        title={<>Cấu hình kênh – {m.name}{c.connected ? <Pill tone="green"><Dot />Đã kết nối</Pill> : <Pill tone="slate"><Dot />Chưa kết nối</Pill>}</>}
        desc={c.connected ? "Quản lý cài đặt, đồng bộ dữ liệu và tự động hóa cho kênh này." : "Cấu hình API, webhook và thiết lập trước khi kết nối tài khoản."}
        actions={<>
          {!c.connected && <Button onClick={() => void ctx.connectChannel(c.id)} className="bg-[#6941c6] hover:bg-[#5b36b0]">Kết nối ngay</Button>}
          {c.connected && <Button variant="outline" onClick={() => toast.success("Kết nối đang hoạt động bình thường")}>Kiểm tra kết nối</Button>}
          <Button variant="outline" aria-label="Thêm" onClick={() => setTab("logs")}><MoreHorizontal className="size-4" /></Button>
        </>} />
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className={cn(card, "h-fit p-4")}>
          <ChannelLogo id={c.id} size="lg" />
          <p className="mt-3 font-semibold">{m.name}</p>
          {c.connected ? (
            <>
              <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#6941c6]">{c.accountName}<ExternalLink className="size-3" /></a>
              <p className="mt-2 text-xs"><span className="text-emerald-600">● Đã kết nối</span><br /><span className="text-slate-400">Kết nối lần cuối: {c.connectedAt}</span></p>
              <Button size="sm" variant="outline" onClick={() => ctx.go("add-channel", { wizardChannel: c.id })} className="mt-3 w-full border-violet-200 text-[#6941c6]">Đổi tài khoản</Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-500">Kênh chưa liên kết tài khoản.</p>
              <Button size="sm" onClick={() => void ctx.connectChannel(c.id)} className="mt-3 w-full bg-[#6941c6] hover:bg-[#5b36b0]">Kết nối ngay</Button>
            </>
          )}
          <nav className="mt-4 flex gap-1 overflow-x-auto border-t border-slate-100 pt-3 lg:flex-col">
            {CONFIG_TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={cn("whitespace-nowrap rounded-md px-3 py-2 text-left text-sm", tab === t.id ? "border-l-2 border-[#6941c6] bg-violet-50 font-semibold text-[#6941c6]" : "text-slate-600 hover:bg-slate-50")}>{t.label}</button>)}
          </nav>
        </aside>
        <div className="min-w-0 space-y-5">
          {tab === "general" && <General c={c} ctx={ctx} />}
          {TOGGLES[tab] && <ToggleTab key={tab} cfg={TOGGLES[tab]!} />}
          {tab === "permissions" && <Permissions />}
          {tab === "webhook" && <Webhook ctx={ctx} c={c} />}
          {tab === "logs" && <Section title="Nhật ký hoạt động"><ul className="divide-y divide-slate-100">{MOCK_ACTIVITIES.map((a) => <li key={a.text} className="flex justify-between py-3 text-sm"><span>{a.text}</span><span className="text-slate-400">{a.time}</span></li>)}</ul></Section>}
        </div>
      </div>
    </div>
  );
}

function General({ c, ctx }: { c: ChannelAccount; ctx: SocialCtx }) {
  const m = CHANNEL_META[c.id];
  const [name, setName] = useState(c.accountName);
  const [desc, setDesc] = useState("Thời trang công sở nữ hiện đại, thanh lịch và bền vững.");
  const stats = [
    { label: "Lượt theo dõi", value: fmt(c.followers), delta: c.followersDelta, color: "#7c3aed" },
    { label: "Lượt tương tác (30 ngày)", value: fmt(c.engagement), delta: c.engagementDelta, color: "#3b82f6" },
    { label: "Tin nhắn", value: "1,245", delta: 12.3, color: "#10b981" },
  ];
  return <>
    <Section title="Thông tin chung" desc="Thông tin cơ bản và trạng thái kết nối của kênh.">
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Field label="Tên hiển thị *" hint={<span className="text-xs text-slate-400">{name.length}/50</span>}><input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label={c.id === "facebook" ? "Fanpage *" : "Tài khoản *"}><div className="flex gap-2"><select className={inputCls}><option>{c.accountName} ({c.pageId})</option></select><Button variant="outline" aria-label="Tải lại" onClick={() => toast.success("Đã tải lại danh sách")}><RefreshCw className="size-4" /></Button></div></Field>
          <Field label="Danh mục"><select className={inputCls}><option>Thời trang & Phụ kiện</option><option>Mỹ phẩm</option><option>Khác</option></select></Field>
          <Field label="Mô tả (tùy chọn)" hint={<span className="text-xs text-slate-400">{desc.length}/200</span>}><textarea value={desc} maxLength={200} rows={3} onChange={(e) => setDesc(e.target.value)} className={areaCls} /></Field>
          <Button onClick={() => toast.success("Đã lưu thay đổi (dữ liệu mẫu)")} className="bg-[#6941c6] hover:bg-[#5b36b0]">Lưu thay đổi</Button> {/* TODO(api): PATCH /admin/social/channels/:id */}
        </div>
        <div>
          <h3 className="text-sm font-semibold">Logo & ảnh bìa</h3>
          <div className="mt-3 flex items-center gap-3"><Avatar className="size-16 text-lg" /><div><Button size="sm" variant="outline" className="border-violet-200 text-[#6941c6]">Thay đổi</Button><p className="mt-1 text-xs text-slate-400">JPG, PNG (tối đa 2MB)</p></div></div>
          <div className="mt-4 grid h-32 place-items-center rounded-lg bg-gradient-to-br from-stone-100 to-stone-300 font-serif text-lg tracking-widest text-slate-700">ÉLANE</div>
          <div className="mt-2 flex items-center justify-between"><Button size="sm" variant="outline" className="border-violet-200 text-[#6941c6]">Thay đổi</Button><p className="text-xs text-slate-400">JPG, PNG (tối đa 10MB)</p></div>
        </div>
      </div>
    </Section>
    <Section title="Trạng thái kết nối" action={<><Pill tone="green"><Dot />Hoạt động</Pill><Button size="sm" variant="outline" onClick={() => void ctx.refreshAll()} className="border-violet-200 text-[#6941c6]">Cập nhật dữ liệu</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">{stats.map((s) => <div key={s.label} className="rounded-lg border border-slate-200 p-4"><p className="text-xs text-slate-500">{s.label}</p><div className="mt-2 flex items-end justify-between"><div><p className="text-xl font-semibold tabular-nums">{s.value}</p><Delta value={s.delta} /></div><Sparkline data={[3, 4, 3.5, 5, 4.4, 6, 7]} color={s.color} className="h-9 w-20" /></div></div>)}</div>
    </Section>
    <Permissions compact />
    <Section title="Ngắt kết nối" desc={`Ngắt kết nối sẽ dừng đồng bộ dữ liệu và tự động đăng bài.`} action={<Button variant="outline" onClick={() => window.confirm(`Ngắt kết nối ${m.name}?`) && ctx.disconnectChannel(c.id)} className="border-rose-200 text-rose-600 hover:bg-rose-50">Ngắt kết nối</Button>}>{null}</Section>
  </>;
}

function Permissions({ compact }: { compact?: boolean }) {
  return (
    <Section title="Quyền đã cấp" desc="Các quyền mà ELANE được cấp để quản lý kênh." action={<Button size="sm" variant="outline" onClick={() => toast.info("Sẽ chuyển sang trang cấp quyền của kênh")} className="border-violet-200 text-[#6941c6]">{compact ? "Chỉnh sửa quyền" : "Cấp lại quyền"}</Button>}>
      <ul className="grid gap-4 md:grid-cols-2">{PERMISSIONS.map((p) => <li key={p.title} className="flex items-start gap-3"><Check className="mt-0.5 size-5 shrink-0 rounded-full bg-emerald-500 p-1 text-white" /><div><p className="text-sm font-medium">{p.title}</p><p className="text-xs text-slate-500">{p.desc}</p></div></li>)}</ul>
    </Section>
  );
}

function ToggleTab({ cfg }: { cfg: NonNullable<(typeof TOGGLES)[ConfigTab]> }) {
  const [on, setOn] = useState(cfg.items.map((i) => i.on));
  return (
    <Section title={cfg.title} desc={cfg.desc} action={<Button size="sm" onClick={() => toast.success("Đã lưu (dữ liệu mẫu)")} className="bg-[#6941c6] hover:bg-[#5b36b0]">Lưu</Button>}>
      <ul className="divide-y divide-slate-100">{cfg.items.map((it, i) => <li key={it.label} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-medium">{it.label}</p><p className="text-xs text-slate-500">{it.desc}</p></div><Switch checked={on[i]} onChange={(v) => setOn(on.map((x, j) => (j === i ? v : x)))} /></li>)}</ul>
    </Section>
  );
}

/** Cấu hình Meta (Facebook/Instagram) – dùng API thật từ code cũ. */
function Webhook({ ctx, c }: { ctx: SocialCtx; c: ChannelAccount }) {
  const { settings } = ctx;
  const isMeta = c.id === "facebook" || c.id === "instagram";
  const [form, setForm] = useState({ appId: "", appSecret: "", webhookVerifyToken: "", graphVersion: "v23.0", redirectUri: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (settings) setForm((o) => ({ ...o, appId: settings.appId, graphVersion: settings.graphVersion, redirectUri: settings.redirectUri })); }, [settings]);

  if (!isMeta) return <Section title="Webhook & API" desc="Khóa API và webhook của kênh này."><Empty>Chưa có API cho kênh {CHANNEL_META[c.id].name}. Phần này sẽ được bổ sung.</Empty></Section>;

  async function save() {
    setSaving(true);
    try {
      await adminApi.updateSocialSettings({
        appId: form.appId, graphVersion: form.graphVersion, redirectUri: form.redirectUri || null,
        ...(form.appSecret ? { appSecret: form.appSecret } : {}),
        ...(form.webhookVerifyToken ? { webhookVerifyToken: form.webhookVerifyToken } : {}),
      });
      await ctx.reloadSettings();
      setForm((o) => ({ ...o, appSecret: "", webhookVerifyToken: "" }));
      toast.success("Đã lưu cấu hình Meta an toàn");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Không thể lưu cấu hình Meta"); }
    finally { setSaving(false); }
  }
  const copy = async (v: string, label: string) => { await navigator.clipboard.writeText(v); toast.success(`Đã sao chép ${label}`); };
  const saved = <span className="font-normal text-emerald-600">· Đã lưu</span>;

  return (
    <Section title="Webhook & API" desc="Thiết lập một lần. App Secret và Verify Token được mã hóa trước khi lưu.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meta App ID"><Input value={form.appId} onChange={(e) => setForm({ ...form, appId: e.target.value })} placeholder="123456789..." /></Field>
        <Field label="Graph API version"><Input value={form.graphVersion} onChange={(e) => setForm({ ...form, graphVersion: e.target.value })} placeholder="v23.0" /></Field>
        <Field label={<>App Secret {settings?.hasAppSecret && saved}</>}><Input type="password" value={form.appSecret} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} placeholder={settings?.hasAppSecret ? "Để trống để giữ secret hiện tại" : "Nhập App Secret"} /></Field>
        <Field label={<>Webhook Verify Token {settings?.hasWebhookVerifyToken && saved}</>}><div className="flex gap-2"><Input type="password" value={form.webhookVerifyToken} onChange={(e) => setForm({ ...form, webhookVerifyToken: e.target.value })} placeholder={settings?.hasWebhookVerifyToken ? "Để trống để giữ token hiện tại" : "Tự đặt một chuỗi bí mật"} /><Button type="button" variant="outline" onClick={() => setForm({ ...form, webhookVerifyToken: crypto.randomUUID().replaceAll("-", "") })}>Tạo</Button></div></Field>
      </div>
      <div className="mt-4 space-y-4">
        <Field label="OAuth Redirect URI"><div className="flex gap-2"><Input value={form.redirectUri} onChange={(e) => setForm({ ...form, redirectUri: e.target.value })} /><Button variant="outline" aria-label="Sao chép" onClick={() => void copy(form.redirectUri, "Redirect URI")}><Copy className="size-4" /></Button></div></Field>
        {settings?.webhookUrl && <Field label="Webhook Callback URL"><div className="flex gap-2"><Input readOnly value={settings.webhookUrl} className="bg-slate-50" /><Button variant="outline" aria-label="Sao chép" onClick={() => void copy(settings.webhookUrl, "Webhook URL")}><Copy className="size-4" /></Button></div></Field>}
      </div>
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Trong Meta Developer, thêm Redirect URI vào Facebook Login và Callback URL vào Webhooks. Sau khi lưu, quay lại bấm “Kết nối Instagram”.</div>
      <div className="mt-5 flex justify-end"><Button onClick={() => void save()} disabled={saving || !form.appId} className="bg-[#6941c6] hover:bg-[#5b36b0]">{saving ? "Đang lưu..." : "Lưu cấu hình"}</Button></div>
    </Section>
  );
}
