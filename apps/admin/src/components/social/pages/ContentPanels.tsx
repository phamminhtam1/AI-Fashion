import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Check, Copy, Link2, List, ListOrdered, Pencil, Play, Plus, RefreshCw, Shirt, Smile, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AGES, AUDIENCES, CAMPAIGN_GOALS, CH_NAME, CONTENT_CHANNELS, CTAS, GOALS, MOCK_PRODUCTS, SEGMENTS, STYLES, TINTS, TONES, type Product, type Variant } from "../mock";
import type { AiPreset, ChannelId } from "../types";
import { areaCls, ChannelLogo, Field, inputCls, Pill, card, vnd } from "../ui";
import { fmtDuration, MediaView, Placeholder, type MediaItem } from "./ContentPreview";

const MAX_CAPTION = 2200;
const MAX_TAGS = 30;
const MAX_MEDIA = 10;
const box = "rounded-lg border border-slate-200 p-4";
const copy = async (v: string, label: string) => { await navigator.clipboard.writeText(v); toast.success(`Đã sao chép ${label}`); };
const optional = <span className="font-normal text-slate-400">(tùy chọn)</span>;

const Checkbox = ({ on }: { on: boolean }) => (
  <span className={cn("grid size-4 shrink-0 place-items-center rounded border", on ? "border-[#6941c6] bg-[#6941c6] text-white" : "border-slate-300 bg-white")}>{on && <Check className="size-3" />}</span>
);

/** Chip chọn kênh đăng – dùng chung cho cả hai phương thức. */
function ChannelChip({ id, on, onToggle, className }: { id: ChannelId; on: boolean; onToggle: (id: ChannelId) => void; className?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onToggle(id)}
      className={cn("flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium", on ? "border-violet-300 bg-violet-50 text-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50", className)}>
      <Checkbox on={on} /><ChannelLogo id={id} size="xs" />{CH_NAME[id]}
    </button>
  );
}

/* =====================================================================
 * AI: 2. Nhập thông tin
 * ===================================================================== */
export interface AiForm { picked: string[]; goal: string; style: string; tone: string; audience: string; extra: string }

export function AiInputPanel({ form, upd, preset, targets, onToggleChannel, busy, hasResult, onGenerate, onSeeAll }: {
  form: AiForm; upd: (p: Partial<AiForm>) => void; preset: AiPreset; targets: ChannelId[]; onToggleChannel: (id: ChannelId) => void;
  busy: boolean; hasResult: boolean; onGenerate: () => void; onSeeAll: () => void;
}) {
  const toggleProduct = (id: string) => upd({ picked: form.picked.includes(id) ? form.picked.filter((x) => x !== id) : [...form.picked, id] });
  const extraHint = preset === "topic" ? "Ví dụ: Phối đồ công sở mùa thu" : preset === "idea" ? "Ví dụ: Giới thiệu đầm lụa mới cho tiệc tối..." : "Nhấn mạnh chất liệu cao cấp, form dáng tôn dáng, phù hợp đi làm, đi cafe.";
  return (
    <section className={cn(card, "space-y-5 p-5")}>
      <div>
        <h2 className="text-lg font-semibold">2. Nhập thông tin để AI tạo nội dung</h2>
        <p className="mt-1 text-sm text-slate-500">Cung cấp thông tin về sản phẩm và định hướng, AI sẽ tự động tạo gợi ý nội dung phù hợp với thương hiệu ÉLANE.</p>
      </div>

      <Field label={<>Chọn sản phẩm / BST {preset === "product" && <span className="text-rose-500">*</span>}</>}
        hint={<button type="button" onClick={onSeeAll} className="text-xs font-medium text-[#6941c6] hover:underline">Xem tất cả</button>}>
        <div className="grid grid-cols-4 gap-2">
          {MOCK_PRODUCTS.map((p) => {
            const on = form.picked.includes(p.id);
            return (
              <button key={p.id} type="button" aria-pressed={on} onClick={() => toggleProduct(p.id)} title={p.name}
                className={cn("min-w-0 rounded-lg border p-1 text-left", on ? "border-[#6941c6] bg-violet-50/50 ring-1 ring-[#6941c6]" : "border-slate-200 hover:border-violet-200")}>
                <div className={cn("relative grid aspect-[3/4] place-items-center rounded-md bg-gradient-to-br text-slate-500", p.tint)}>
                  <Shirt className="size-6" />
                  {on && <span className="absolute left-1 top-1"><Checkbox on /></span>}
                </div>
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-slate-700">{p.name}</p>
                <p className="mt-0.5 text-[11px] font-semibold">{vnd(p.price)}</p>
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mục tiêu content"><select value={form.goal} onChange={(e) => upd({ goal: e.target.value })} className={inputCls}>{GOALS.map((g) => <option key={g}>{g}</option>)}</select></Field>
        <Field label="Phong cách nội dung"><select value={form.style} onChange={(e) => upd({ style: e.target.value })} className={inputCls}>{STYLES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Tông giọng"><select value={form.tone} onChange={(e) => upd({ tone: e.target.value })} className={inputCls}>{TONES.map((t) => <option key={t}>{t}</option>)}</select></Field>

      <Field label="Đối tượng khách hàng">
        <div className="flex flex-wrap gap-2">{AUDIENCES.map((a) => (
          <button key={a} type="button" aria-pressed={form.audience === a} onClick={() => upd({ audience: a })}
            className={cn("rounded-md border px-3 py-2 text-xs font-medium", form.audience === a ? "border-violet-300 bg-violet-50 text-[#6941c6]" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>{a}</button>
        ))}</div>
      </Field>

      <Field label="Kênh đăng">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">{CONTENT_CHANNELS.map((id) => <ChannelChip key={id} id={id} on={targets.includes(id)} onToggle={onToggleChannel} />)}</div>
      </Field>

      <Field label={<>{preset === "product" ? "Thông tin bổ sung" : "Chủ đề / ý tưởng của bạn"} {preset === "product" && optional}</>}>
        <div className="relative">
          <textarea value={form.extra} maxLength={500} onChange={(e) => upd({ extra: e.target.value })} rows={4} className={areaCls} placeholder={extraHint} />
          <span className="absolute bottom-2 right-3 text-xs text-slate-400">{form.extra.length}/500</span>
        </div>
      </Field>

      <Button onClick={onGenerate} disabled={busy} className="h-11 w-full gap-2 bg-[#6941c6] hover:bg-[#5b36b0]">
        <Sparkles className={cn("size-4", busy && "animate-pulse")} />{busy ? "AI đang viết..." : hasResult ? "Tạo lại với thông tin mới" : "Tạo content với AI"}
      </Button>
    </section>
  );
}

/* =====================================================================
 * AI: 3. Kết quả gợi ý
 * ===================================================================== */
type ResultTab = "caption" | "hashtag" | "cta" | "media";

export function AiResultPanel({ variants, active, onActive, editing, onEdit, onPatch, busy, onRegenerate, cta, onCta, products }: {
  variants: Variant[]; active: number; onActive: (i: number) => void; editing: boolean; onEdit: (i: number) => void;
  onPatch: (i: number, p: Partial<Variant>) => void; busy: boolean; onRegenerate: () => void; cta: string; onCta: (v: string) => void; products: Product[];
}) {
  const [tab, setTab] = useState<ResultTab>("caption");
  const [mediaOn, setMediaOn] = useState<number[]>([0]); // TODO(api): gợi ý ảnh/media lấy từ thư viện sản phẩm khi có API
  const refs = useRef<Partial<Record<ResultTab, HTMLElement | null>>>({});
  const go = (t: ResultTab) => { setTab(t); refs.current[t]?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const hasResult = variants.length > 0;
  const hashtags = variants[active]?.hashtags ?? [];
  const tabs: { id: ResultTab; label: string }[] = [{ id: "caption", label: `Caption (${variants.length})` }, { id: "hashtag", label: "Hashtag" }, { id: "cta", label: "CTA" }, { id: "media", label: "Hình ảnh/Media" }];
  const tile = (i: number) => products[i % Math.max(products.length, 1)]?.tint ?? TINTS[i % TINTS.length];

  return (
    <section className={cn(card, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">3. Kết quả gợi ý từ AI</h2>
        {hasResult && <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-[#6941c6]"><Sparkles className="size-3.5" />Đã tạo {variants.length} phiên bản nội dung</span>}
      </div>

      {!hasResult ? (
        <div className="grid place-items-center px-4 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-violet-50 text-[#6941c6]"><Sparkles className="size-6" /></span>
          <p className="mt-3 text-sm font-medium text-slate-700">Chưa có nội dung gợi ý</p>
          <p className="mt-1 text-sm text-slate-400">Nhập thông tin ở bước 2 rồi bấm “Tạo content với AI”.</p>
        </div>
      ) : (
        <>
          <div role="tablist" className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs sm:text-sm">
            {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)} className={cn("flex-1 whitespace-nowrap rounded-md px-2 py-1.5 font-medium", tab === t.id ? "bg-white text-[#6941c6] shadow-sm" : "text-slate-500 hover:text-slate-700")}>{t.label}</button>)}
          </div>

          <div ref={(el) => { refs.current.caption = el; }} className="mt-5 flex items-start justify-between gap-3">
            <div><h3 className="text-sm font-semibold">Gợi ý caption</h3><p className="mt-0.5 text-xs text-slate-500">AI đã tạo {variants.length} phiên bản caption dựa trên thông tin của bạn. Bạn có thể chỉnh sửa trước khi đăng.</p></div>
            <Button size="sm" variant="outline" disabled={busy} onClick={onRegenerate} className="shrink-0 gap-1.5 border-violet-200 text-[#6941c6]"><RefreshCw className={cn("size-3.5", busy && "animate-spin")} />Tạo lại nội dung</Button>
          </div>

          <div className="mt-3 space-y-3">
            {variants.map((v, i) => (
              <div key={v.id} onClick={() => onActive(i)} className={cn("cursor-pointer rounded-lg border p-4 transition-colors", active === i ? "border-[#6941c6] bg-violet-50/30" : "border-slate-200 hover:border-violet-200")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><h4 className="text-sm font-semibold">{v.label}</h4>{i === 0 && <Pill tone="violet">Đề xuất</Pill>}</div>
                  <span className="text-xs text-slate-400">{v.caption.length}/2,200</span>
                </div>
                {editing && active === i
                  ? <textarea value={v.caption} maxLength={MAX_CAPTION} onClick={(e) => e.stopPropagation()} onChange={(e) => onPatch(i, { caption: e.target.value })} rows={8} className={cn(areaCls, "mt-2")} />
                  : <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{v.caption}</p>}
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); void copy(v.caption, "caption"); }} className="gap-1.5 border-violet-200 text-[#6941c6]"><Copy className="size-3.5" />Sao chép</Button>
                  <Button size="icon" variant="outline" aria-label={editing && active === i ? "Xong chỉnh sửa" : "Chỉnh sửa caption"} onClick={(e) => { e.stopPropagation(); onEdit(i); }} className="size-8">
                    {editing && active === i ? <Check className="size-4" /> : <Pencil className="size-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div ref={(el) => { refs.current.hashtag = el; }} className={box}>
              <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Hashtag gợi ý</h3><Button size="sm" variant="outline" onClick={() => void copy(hashtags.join(" "), "hashtag")} className="h-7 gap-1 border-violet-200 px-2 text-xs text-[#6941c6]"><Copy className="size-3" />Sao chép</Button></div>
              <div className="mt-3 flex flex-wrap gap-1.5">{hashtags.map((h) => <span key={h} className="rounded bg-violet-50 px-2 py-1 text-[11px] text-[#6941c6]">{h}</span>)}</div>
            </div>
            <div ref={(el) => { refs.current.cta = el; }} className={box}>
              <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">CTA gợi ý</h3><Button size="sm" variant="outline" onClick={() => void copy(cta, "CTA")} className="h-7 gap-1 border-violet-200 px-2 text-xs text-[#6941c6]"><Copy className="size-3" />Sao chép</Button></div>
              <div role="radiogroup" className="mt-3 space-y-2">{CTAS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cta === c} onClick={() => onCta(c)} className="flex w-full items-center gap-2 text-left text-xs text-slate-700">
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border", cta === c ? "border-[#6941c6]" : "border-slate-300")}>{cta === c && <span className="size-2 rounded-full bg-[#6941c6]" />}</span>{c}
                </button>
              ))}</div>
            </div>
          </div>

          <div ref={(el) => { refs.current.media = el; }} className={cn(box, "mt-3")}>
            <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Hình ảnh/Media gợi ý (4)</h3>
              <Button size="sm" variant="outline" onClick={() => toast.info("Tạo thêm ảnh gợi ý sẽ nối với API tạo ảnh")} className="h-7 gap-1 border-violet-200 px-2 text-xs text-[#6941c6]"><Plus className="size-3" />Tạo thêm</Button></div>
            <div className="mt-3 grid grid-cols-5 gap-2">{[0, 1, 2, 3, 4].map((i) => {
              const on = mediaOn.includes(i);
              return (
                <button key={i} type="button" aria-pressed={on} aria-label={`Ảnh gợi ý ${i + 1}`} onClick={() => setMediaOn((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]))}
                  className={cn("relative aspect-[3/4] overflow-hidden rounded-md", on && "ring-2 ring-[#6941c6]")}>
                  <Placeholder tint={tile(i)} />
                  {on && <span className="absolute left-1 top-1"><Checkbox on /></span>}
                  {i === 4 && <span className="absolute inset-0 grid place-items-center bg-slate-900/45 text-sm font-semibold text-white">+2</span>}
                </button>
              );
            })}</div>
          </div>
        </>
      )}
    </section>
  );
}

/* =====================================================================
 * Tự soạn: 2. Soạn nội dung & thiết lập thông tin
 * ===================================================================== */
export interface ManualForm {
  productId: string | null; campaign: string; segment: string; age: string; style: string; note: string;
  text: string; hashtags: string[]; cta: string; link: string;
}
const LINKS = ["Link sản phẩm", "Link website", "Link tin nhắn"];
const EMOJIS = ["✨", "🖤", "🤍", "🌿", "🛍", "💼", "👗", "🔥"];

function Box({ title, hint, children, className }: { title: ReactNode; hint?: string; children: ReactNode; className?: string }) {
  return <div className={cn(box, className)}><h3 className="text-sm font-semibold">{title}</h3>{hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}<div className="mt-3">{children}</div></div>;
}

export function ManualComposer({ form, upd, product, onPickProduct, media, onFiles, onRemoveMedia, targets, onToggleChannel }: {
  form: ManualForm; upd: (p: Partial<ManualForm>) => void; product?: Product; onPickProduct: () => void;
  media: MediaItem[]; onFiles: (files: File[]) => void; onRemoveMedia: (id: string) => void; targets: ChannelId[]; onToggleChannel: (id: ChannelId) => void;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [emoji, setEmoji] = useState(false);
  const [adding, setAdding] = useState(false);
  const [tag, setTag] = useState("");

  const caret = () => { const el = ta.current; const v = form.text; return { el, v, s: el?.selectionStart ?? v.length, e: el?.selectionEnd ?? v.length }; };
  function insert(text: string) {
    const { el, v, s, e } = caret();
    const next = v.slice(0, s) + text + v.slice(e);
    if (next.length > MAX_CAPTION) return;
    upd({ text: next });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + text.length, s + text.length); });
  }
  function listify(kind: "bullet" | "number") {
    const { v, s, e } = caret();
    const from = s === 0 ? 0 : v.lastIndexOf("\n", s - 1) + 1;
    const end = v.indexOf("\n", e);
    const to = end === -1 ? v.length : end;
    const lines = v.slice(from, to).split("\n").map((l, i) => (kind === "bullet" ? `• ${l}` : `${i + 1}. ${l}`));
    const next = v.slice(0, from) + lines.join("\n") + v.slice(to);
    if (next.length <= MAX_CAPTION) upd({ text: next });
  }
  function addTag() {
    const t = `#${tag.trim().replace(/^#+/, "").replace(/\s+/g, "")}`;
    if (t.length > 1 && !form.hashtags.some((h) => h.toLowerCase() === t.toLowerCase()) && form.hashtags.length < MAX_TAGS) upd({ hashtags: [...form.hashtags, t] });
    setTag(""); setAdding(false);
  }
  const pick = (e: ChangeEvent<HTMLInputElement>) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; };
  const tools = [
    { label: "Danh sách dấu đầu dòng", icon: List, run: () => listify("bullet") },
    { label: "Danh sách đánh số", icon: ListOrdered, run: () => listify("number") },
    { label: "Chèn liên kết", icon: Link2, run: () => insert("https://") },
    { label: "Chèn emoji", icon: Smile, run: () => setEmoji((x) => !x) },
  ];

  return (
    <section className={cn(card, "p-5")}>
      <h2 className="text-lg font-semibold">2. Soạn nội dung & thiết lập thông tin</h2>
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {/* ---- Cột trái ---- */}
        <div className="space-y-4">
          <Box title={<>Thông tin sản phẩm / BST <span className="text-rose-500">*</span></>}>
            {product ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
                <div className={cn("grid h-16 w-12 shrink-0 place-items-center rounded-md bg-gradient-to-br text-slate-500", product.tint)}><Shirt className="size-5" /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{product.name}</p><p className="text-xs text-slate-400">{product.sku}</p>
                  <div className="mt-1 flex items-center gap-2"><span className="text-sm font-bold">{vnd(product.price)}</span>{product.inStock ? <Pill tone="green">Còn hàng</Pill> : <Pill tone="rose">Hết hàng</Pill>}</div></div>
                <button type="button" aria-label="Bỏ chọn sản phẩm" onClick={() => upd({ productId: null })} className="grid size-7 place-items-center self-start rounded-full hover:bg-slate-100"><X className="size-4" /></button>
              </div>
            ) : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">Chưa chọn sản phẩm nào</p>}
            <div className="mt-2 grid grid-cols-5 gap-2">
              {product && [0, 1, 2, 3].map((i) => <div key={i} className="aspect-[3/4] overflow-hidden rounded-md"><Placeholder tint={i === 0 ? product.tint : TINTS[i % TINTS.length]} /></div>)}
              <button type="button" onClick={onPickProduct} className={cn("grid aspect-[3/4] place-items-center rounded-md border border-dashed border-violet-300 bg-violet-50/40 text-[11px] font-medium text-[#6941c6] hover:bg-violet-50", !product && "col-span-2 aspect-auto py-6")}>
                <span className="grid justify-items-center gap-1 text-center"><Plus className="size-4" />{product ? "Thêm sản phẩm" : "Chọn sản phẩm"}</span>
              </button>
            </div>
          </Box>

          <Box title="Media đính kèm" hint={`Tải ảnh/video để sử dụng trong bài đăng (tối đa ${MAX_MEDIA} file)`}>
            <div className="grid grid-cols-5 gap-2">
              {media.map((m) => (
                <div key={m.id} className="group relative aspect-[3/4] overflow-hidden rounded-md bg-slate-100">
                  <MediaView item={m} />
                  {m.kind === "video" && <><Play className="absolute left-1.5 top-1.5 size-3.5 fill-white text-white drop-shadow" />{m.duration != null && <span className="absolute bottom-1 right-1 rounded bg-slate-900/70 px-1 text-[10px] text-white">{fmtDuration(m.duration)}</span>}</>}
                  <button type="button" aria-label={`Xóa ${m.name}`} onClick={() => onRemoveMedia(m.id)} className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"><X className="size-3" /></button>
                </div>
              ))}
              {media.length < MAX_MEDIA && (
                <label className={cn("grid aspect-[3/4] cursor-pointer place-items-center rounded-md border border-dashed border-violet-300 bg-violet-50/40 text-center text-[11px] font-medium text-[#6941c6] hover:bg-violet-50 focus-within:ring-2 focus-within:ring-[#6941c6]", media.length === 0 && "col-span-2 aspect-auto py-6")}>
                  <input type="file" accept="image/*,video/*" multiple onChange={pick} className="sr-only" />
                  <span className="grid justify-items-center gap-1"><Plus className="size-4" /><span>Tải media<br />(Ảnh/Video)</span></span>
                </label>
              )}
            </div>
          </Box>

          <Box title="Gắn thẻ sản phẩm trong media" hint="Chọn vị trí sản phẩm hiển thị trên ảnh (tùy chọn)">
            <div className="flex items-center gap-3">
              <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md">{media[0]?.kind === "image" ? <MediaView item={media[0]} /> : <Placeholder tint={product?.tint} />}</div>
              <Button type="button" variant="outline" onClick={() => toast.info("Gắn thẻ sản phẩm trên ảnh sẽ nối với API sản phẩm")} className="gap-1.5 border-violet-200 text-[#6941c6]"><Plus className="size-4" />Thêm thẻ sản phẩm</Button>
            </div>
          </Box>

          {/* TODO(api): gửi kèm brief (mục tiêu, đối tượng, ghi chú duyệt) khi createSocialContent hỗ trợ. */}
          <div className="space-y-3">
            <Field label="Mục tiêu chiến dịch"><select value={form.campaign} onChange={(e) => upd({ campaign: e.target.value })} className={inputCls}>{CAMPAIGN_GOALS.map((g) => <option key={g}>{g}</option>)}</select></Field>
            <div className="grid grid-cols-[1.4fr_1fr] gap-3">
              <Field label="Đối tượng khách hàng"><select value={form.segment} onChange={(e) => upd({ segment: e.target.value })} className={inputCls}>{SEGMENTS.map((g) => <option key={g}>{g}</option>)}</select></Field>
              <Field label="Độ tuổi"><select value={form.age} onChange={(e) => upd({ age: e.target.value })} className={inputCls}>{AGES.map((g) => <option key={g}>{g}</option>)}</select></Field>
            </div>
            <Field label="Giọng văn / Phong cách"><select value={form.style} onChange={(e) => upd({ style: e.target.value })} className={inputCls}>{STYLES.map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label={<>Ghi chú {optional}</>}>
              <div className="relative"><textarea value={form.note} maxLength={500} onChange={(e) => upd({ note: e.target.value })} rows={3} className={areaCls} placeholder="Thêm ghi chú cho team duyệt (ví dụ: yêu cầu chỉnh sửa, thời điểm đăng...)" /><span className="absolute bottom-2 right-3 text-xs text-slate-400">{form.note.length}/500</span></div>
            </Field>
          </div>
        </div>

        {/* ---- Cột phải ---- */}
        <div className="space-y-4">
          <Box title={<>Nội dung bài viết <span className="text-rose-500">*</span></>}>
            <div className="overflow-hidden rounded-md border border-slate-200 focus-within:border-[#6941c6]">
              <div className="flex items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
                {tools.map(({ label, icon: Icon, run }) => <button key={label} type="button" aria-label={label} title={label} onClick={run} className="grid size-7 place-items-center rounded text-slate-600 hover:bg-white"><Icon className="size-4" /></button>)}
              </div>
              {emoji && <div className="flex flex-wrap gap-1 border-b border-slate-200 px-2 py-1.5">{EMOJIS.map((em) => <button key={em} type="button" onClick={() => insert(em)} className="grid size-7 place-items-center rounded text-base hover:bg-slate-100">{em}</button>)}</div>}
              <textarea ref={ta} value={form.text} maxLength={MAX_CAPTION} onChange={(e) => upd({ text: e.target.value })} rows={11} aria-label="Nội dung bài viết"
                placeholder="Viết caption cho bài đăng…" className="block w-full resize-y bg-white p-3 text-sm outline-none" />
              <p className="px-3 pb-2 text-right text-xs text-slate-400">{form.text.length}/2,200</p>
            </div>
          </Box>

          <Box title="Hashtag">
            <div className="flex flex-wrap gap-1.5">
              {form.hashtags.map((h) => (
                <span key={h} className="inline-flex items-center gap-1 rounded bg-violet-50 py-1 pl-2 pr-1 text-xs text-[#6941c6]">{h}
                  <button type="button" aria-label={`Xóa ${h}`} onClick={() => upd({ hashtags: form.hashtags.filter((x) => x !== h) })} className="grid size-4 place-items-center rounded hover:bg-violet-100"><X className="size-3" /></button></span>
              ))}
              {form.hashtags.length === 0 && !adding && <span className="text-xs text-slate-400">Chưa có hashtag</span>}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              {adding
                ? <input autoFocus value={tag} onChange={(e) => setTag(e.target.value)} onBlur={addTag} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } if (e.key === "Escape") { setTag(""); setAdding(false); } }} placeholder="#hashtag" className="h-8 w-40 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-[#6941c6]" />
                : <Button type="button" size="sm" variant="outline" disabled={form.hashtags.length >= MAX_TAGS} onClick={() => setAdding(true)} className="gap-1 border-violet-200 text-[#6941c6]"><Plus className="size-3.5" />Thêm hashtag</Button>}
              <span className="text-xs text-slate-400">{form.hashtags.length}/{MAX_TAGS}</span>
            </div>
          </Box>

          <Box title="Kêu gọi hành động (CTA)">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={form.cta} onChange={(e) => upd({ cta: e.target.value })} placeholder="Mua ngay" className={inputCls} aria-label="CTA" />
              <select value={form.link} onChange={(e) => upd({ link: e.target.value })} className={cn(inputCls, "w-40")} aria-label="Loại liên kết">{LINKS.map((l) => <option key={l}>{l}</option>)}</select>
            </div>
          </Box>

          <Box title="Chọn kênh đăng">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{CONTENT_CHANNELS.map((id) => <ChannelChip key={id} id={id} on={targets.includes(id)} onToggle={onToggleChannel} />)}</div>
          </Box>
        </div>
      </div>
    </section>
  );
}
