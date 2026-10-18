import { useEffect, useRef, useState } from "react";
import { BookOpen, MoreHorizontal, PenLine, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AUDIENCES, CAMPAIGN_GOALS, CH_NAME, CTAS, GOALS, MOCK_PRODUCTS, MOCK_VARIANTS, SEGMENTS, STYLES, TONES, AGES, type Variant } from "../mock";
import type { AiPreset, ChannelId, SocialCtx } from "../types";
import { Modal, PageHeader, Stepper, card, vnd } from "../ui";
import { AiInputPanel, AiResultPanel, ManualComposer, type AiForm, type ManualForm } from "./ContentPanels";
import { PreviewPanel, SchedulePanel, type Device, type Draft, type MediaItem, type PublishMode } from "./ContentPreview";

type Method = "ai" | "manual";

const METHODS: { id: Method; icon: typeof Sparkles; title: string; desc: string }[] = [
  { id: "ai", icon: Sparkles, title: "AI tạo nội dung", desc: "Dựa trên sản phẩm, chủ đề, mục tiêu và phong cách thương hiệu." },
  { id: "manual", icon: PenLine, title: "Người tự tạo nội dung", desc: "Tự viết caption, tải ảnh/video và thiết lập thông tin." },
];
const STEPS: Record<Method, { title: string; desc: string }[]> = {
  ai: [{ title: "Chọn phương thức", desc: "Chọn cách tạo content" }, { title: "Tạo nội dung", desc: "AI tạo và gợi ý nội dung theo brief" }, { title: "Xem trước & chỉnh sửa", desc: "Tùy chỉnh theo từng kênh" }, { title: "Gửi duyệt & Lên lịch", desc: "Chọn thời gian và phê duyệt" }],
  manual: [{ title: "Chọn phương thức", desc: "Chọn phương thức tạo content" }, { title: "Tạo nội dung", desc: "Soạn nội dung và media" }, { title: "Xem trước & chỉnh sửa", desc: "Tùy chỉnh theo từng kênh" }, { title: "Gửi duyệt & Lên lịch", desc: "Chọn thời gian và phê duyệt" }],
};
const DESC: Record<Method, string> = {
  ai: "Tạo nội dung marketing bằng AI hoặc tự soạn, xem trước trên nhiều kênh và gửi duyệt để đăng bài.",
  manual: "Tạo nội dung marketing bằng cách tự soạn, tải media và tùy chỉnh theo từng kênh.",
};
const VERSION_COUNT = 3;

/** Mặc định: 1 giờ nữa, làm tròn đầu giờ → [yyyy-mm-dd, hh:mm] theo giờ địa phương. */
const inHour = (): [string, string] => {
  const d = new Date(Date.now() + 3600_000); d.setMinutes(0, 0, 0);
  const [date, time] = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16).split("T");
  return [date, time];
};
const readDuration = (url: string) => new Promise<number | undefined>((resolve) => {
  const v = document.createElement("video");
  v.preload = "metadata";
  v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : undefined);
  v.onerror = () => resolve(undefined);
  v.src = url;
});

const initialAi = (preset: AiPreset): AiForm => ({ picked: preset === "product" ? ["p1"] : [], goal: GOALS[0], style: STYLES[0], tone: TONES[0], audience: AUDIENCES[0], extra: "" });
const initialManual = (): ManualForm => ({ productId: "p1", campaign: CAMPAIGN_GOALS[0], segment: SEGMENTS[0], age: AGES[1], style: STYLES[0], note: "", text: "", hashtags: [], cta: "Mua ngay", link: "Link sản phẩm" });

export function AiContentPage({ ctx }: { ctx: SocialCtx }) {
  const [method, setMethod] = useState<Method>("ai");
  const [ai, setAi] = useState<AiForm>(() => initialAi(ctx.aiPreset));
  const [manual, setManual] = useState<ManualForm>(initialManual);
  const [targets, setTargets] = useState<ChannelId[]>(["facebook", "instagram", "tiktok"]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");

  const [variants, setVariants] = useState<Variant[]>([]);
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState(false);
  const [aiCta, setAiCta] = useState(CTAS[0]);
  const [generating, setGenerating] = useState(false);

  const [previewCh, setPreviewCh] = useState<ChannelId>("facebook");
  const [device, setDevice] = useState<Device>("desktop");
  const [publishMode, setPublishMode] = useState<PublishMode>("schedule");
  const [[date, time], setWhen] = useState<[string, string]>(inHour);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(false);
  const [picker, setPicker] = useState(false);

  /* Giải phóng URL tạm của file đã tải lên khi rời trang. */
  const mediaRef = useRef(media);
  mediaRef.current = media;
  useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL(m.url)), []);

  const updAi = (p: Partial<AiForm>) => setAi((f) => ({ ...f, ...p }));
  const updManual = (p: Partial<ManualForm>) => setManual((f) => ({ ...f, ...p }));
  const toggleChannel = (id: ChannelId) => setTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const aiProducts = MOCK_PRODUCTS.filter((p) => ai.picked.includes(p.id));
  const manualProduct = MOCK_PRODUCTS.find((p) => p.id === manual.productId);
  const current = variants[active];

  const draft: Draft = method === "ai"
    ? { title: current?.title ?? "", caption: current?.caption ?? "", hashtags: current?.hashtags ?? [], cta: current ? aiCta : "" }
    : { title: manualProduct?.name ?? "", caption: manual.text, hashtags: manual.hashtags, cta: manual.cta.trim() };
  const hasContent = Boolean(draft.caption.trim());
  const step = hasContent ? 3 : 2;

  /* ---------- AI ---------- */
  async function generate() {
    const subjects = aiProducts.map((p) => p.name).join(", ");
    const extra = ai.extra.trim();
    if (!subjects && !extra) return toast.error(ctx.aiPreset === "product" ? "Hãy chọn ít nhất một sản phẩm" : "Hãy chọn sản phẩm hoặc nhập chủ đề/ý tưởng");
    setGenerating(true);
    const brief = [
      `Mục tiêu: ${ai.goal}`, subjects && `Sản phẩm: ${subjects}`, extra && `Chủ đề / ý tưởng / thông tin bổ sung: ${extra}`,
      `Đối tượng khách hàng: ${ai.audience}`, `Kênh đăng: ${targets.map((t) => CH_NAME[t]).join(", ")}`,
    ].filter(Boolean).join("\n");
    const jobs = Array.from({ length: VERSION_COUNT }, (_, i) => adminApi.generateSocialContent({ brief: `${brief}\nĐây là phiên bản ${i + 1}/${VERSION_COUNT}, hãy chọn góc tiếp cận khác các phiên bản còn lại.`, tone: `${ai.style}, ${ai.tone}` }));
    const done = await Promise.allSettled(jobs);
    const ok = done.flatMap((r, i) => (r.status === "fulfilled" ? [{ r: r.value, i }] : []));
    const next: Variant[] = ok.length
      ? ok.map(({ r, i }) => ({ id: `v${i + 1}`, label: `Phiên bản ${i + 1}`, tags: ai.style.replace(", ", " • "), title: r.title, caption: r.caption, hashtags: r.hashtags }))
      : MOCK_VARIANTS.slice(0, VERSION_COUNT); // API lỗi/chưa có → dùng data mẫu để xem giao diện
    if (!ok.length) toast.warning("Chưa gọi được AI, đang hiển thị nội dung mẫu");
    else toast.success("AI đã tạo nội dung nháp");
    setVariants(next); setActive(0); setEditing(false); setGenerating(false);
  }
  const patchVariant = (i: number, p: Partial<Variant>) => setVariants((vs) => vs.map((v, k) => (k === i ? { ...v, ...p } : v)));
  const editVariant = (i: number) => { if (i === active) setEditing((e) => !e); else { setActive(i); setEditing(true); } };

  /* ---------- Tự soạn: media ---------- */
  async function addFiles(files: File[]) {
    const valid = files.filter((f) => /^(image|video)\//.test(f.type));
    const room = 10 - media.length;
    if (valid.length < files.length) toast.warning("Chỉ hỗ trợ file ảnh hoặc video");
    if (valid.length > room) toast.warning(`Tối đa 10 file, còn ${Math.max(room, 0)} chỗ trống`);
    const added = await Promise.all(valid.slice(0, Math.max(room, 0)).map(async (f): Promise<MediaItem> => {
      const url = URL.createObjectURL(f);
      const kind = f.type.startsWith("video/") ? "video" : "image";
      return { id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`, kind, url, name: f.name, duration: kind === "video" ? await readDuration(url) : undefined };
    }));
    setMedia((m) => [...m, ...added].slice(0, 10));
  }
  const removeMedia = (id: string) => setMedia((m) => { const t = m.find((x) => x.id === id); if (t) URL.revokeObjectURL(t.url); return m.filter((x) => x.id !== id); });

  /* ---------- Gửi duyệt / lưu nháp ---------- */
  async function submit(approve: boolean) {
    if (!hasContent) return toast.error(method === "ai" ? "Hãy tạo nội dung bằng AI trước" : "Hãy nhập nội dung bài viết");
    if (!targets.length) return toast.error("Hãy chọn ít nhất một kênh đăng");
    const url = mediaUrl.trim();
    if (approve && !url) return toast.error("Hãy thêm URL ảnh hoặc video công khai trước khi duyệt đăng");
    let scheduledAt: string | null = null;
    if (approve && publishMode === "schedule") {
      const d = new Date(`${date}T${time}`);
      if (Number.isNaN(d.getTime())) return toast.error("Thời gian đăng không hợp lệ");
      scheduledAt = d.toISOString();
    }
    setSaving(true);
    try {
      const caption = [draft.caption.trim(), draft.cta && `👉 ${draft.cta}`, draft.hashtags.join(" ")].filter(Boolean).join("\n\n");
      const created = await adminApi.createSocialContent({
        connectionId: ctx.data.connections[0]?.id ?? null, title: draft.title || draft.caption.trim().slice(0, 60),
        caption, mediaType: "IMAGE", mediaUrls: url ? [url] : [], source: method === "ai" ? "ai_assisted" : "manual", // TODO(api): xác nhận "manual" là giá trị hợp lệ của source
      });
      const id = (created as unknown as { id?: string } | undefined)?.id;
      if (approve && id) await adminApi.approveSocialContent(id, { publishNow: publishMode === "now", scheduledAt });
      await ctx.reload(true);
      toast.success(approve ? (id ? (publishMode === "now" ? "Đã duyệt và gửi đăng" : "Đã duyệt và lên lịch đăng") : "Đã lưu bài – hãy duyệt tại mục Bài viết") : "Đã lưu bản nháp");
      ctx.go("posts");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Không thể lưu nội dung"); }
    finally { setSaving(false); }
  }

  function reset() {
    media.forEach((m) => URL.revokeObjectURL(m.url));
    setAi(initialAi(ctx.aiPreset)); setManual(initialManual()); setMedia([]); setMediaUrl("");
    setVariants([]); setActive(0); setEditing(false); setAiCta(CTAS[0]); setMenu(false);
  }

  const previewProducts = method === "ai" ? aiProducts : manualProduct ? [manualProduct] : [];

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <PageHeader onBack={() => ctx.go("posts")} title="Tạo content mới" desc={DESC[method]}
        actions={<>
          <Button variant="outline" disabled={saving} onClick={() => void submit(false)} className="gap-2"><Save className="size-4" />Lưu nháp</Button>
          <Button variant="outline" onClick={() => toast.info("Hướng dẫn sử dụng sẽ được bổ sung")} className="gap-2"><BookOpen className="size-4" />Xem hướng dẫn</Button>
          <div className="relative">
            <Button variant="outline" size="icon" aria-label="Thêm tùy chọn" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><MoreHorizontal className="size-4" /></Button>
            {menu && <div className="absolute right-0 top-11 z-20 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-md"><button type="button" onClick={reset} className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50">Làm mới biểu mẫu</button></div>}
          </div>
        </>} />
      <Stepper steps={STEPS[method]} current={step} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(340px,1fr)]">
        {/* ---------- Cột trái: phương thức + nhập liệu ---------- */}
        <div className="min-w-0 space-y-5">
          <section className={cn(card, "p-5")}>
            <h2 className="text-lg font-semibold">1. Chọn phương thức tạo content</h2>
            <div role="radiogroup" className="mt-4 grid gap-3 sm:grid-cols-2">
              {METHODS.map(({ id, icon: Icon, title, desc }) => {
                const on = method === id;
                return (
                  <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setMethod(id)}
                    className={cn("flex items-center gap-3 rounded-lg border p-4 text-left transition-colors", on ? "border-[#6941c6] bg-violet-50 ring-1 ring-[#6941c6]" : "border-slate-200 hover:border-violet-200")}>
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-violet-50 text-[#6941c6]"><Icon className="size-6" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{desc}</span></span>
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", on ? "border-[#6941c6]" : "border-slate-300")}>{on && <span className="size-2.5 rounded-full bg-[#6941c6]" />}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {method === "ai" ? (
            <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1fr]">
              <AiInputPanel form={ai} upd={updAi} preset={ctx.aiPreset} targets={targets} onToggleChannel={toggleChannel} busy={generating} hasResult={variants.length > 0}
                onGenerate={() => void generate()} onSeeAll={() => toast.info("Danh sách đầy đủ sẽ nối với API sản phẩm")} />
              <AiResultPanel variants={variants} active={active} onActive={(i) => { setActive(i); setEditing(false); }} editing={editing} onEdit={editVariant} onPatch={patchVariant}
                busy={generating} onRegenerate={() => void generate()} cta={aiCta} onCta={setAiCta} products={aiProducts} />
            </div>
          ) : (
            <ManualComposer form={manual} upd={updManual} product={manualProduct} onPickProduct={() => setPicker(true)} media={media} onFiles={(f) => void addFiles(f)} onRemoveMedia={removeMedia}
              targets={targets} onToggleChannel={toggleChannel} />
          )}
        </div>

        {/* ---------- Cột phải: xem trước + lịch đăng ---------- */}
        <aside className="min-w-0 space-y-5">
          <PreviewPanel title={method === "ai" ? "4. Xem trước trên các kênh" : "3. Xem trước theo kênh"} channel={previewCh} onChannel={setPreviewCh} device={device} onDevice={setDevice}
            draft={draft} products={previewProducts} media={method === "manual" ? media : []} />
          <SchedulePanel mode={publishMode} onMode={setPublishMode} date={date} onDate={(v) => setWhen([v, time])} time={time} onTime={(v) => setWhen([date, v])}
            mediaUrl={mediaUrl} onMediaUrl={setMediaUrl} unsupported={targets.some((t) => t !== "instagram")} busy={saving}
            onCancel={() => ctx.go("posts")} onDraft={() => void submit(false)} onSubmit={() => void submit(true)} />
        </aside>
      </div>

      <Modal open={picker} onClose={() => setPicker(false)} maxW="max-w-md">
        <h2 className="text-lg font-semibold">Chọn sản phẩm / BST</h2>
        <ul className="mt-4 space-y-2">
          {MOCK_PRODUCTS.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { updManual({ productId: p.id }); setPicker(false); }}
                className={cn("flex w-full items-center gap-3 rounded-lg border p-2 text-left hover:bg-slate-50", manual.productId === p.id ? "border-[#6941c6] bg-violet-50/50" : "border-slate-200")}>
                <span className={cn("h-14 w-11 shrink-0 rounded-md bg-gradient-to-br", p.tint)} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p.name}</span><span className="block text-xs text-slate-400">{p.sku}</span></span>
                <span className="text-sm font-semibold">{vnd(p.price)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end"><Button variant="outline" onClick={() => setPicker(false)}>Đóng</Button></div>
      </Modal>
    </div>
  );
}
