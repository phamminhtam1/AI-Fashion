import { useState } from "react";
import { ArrowRight, Bookmark, ChevronLeft, ChevronRight, Globe, Heart, Loader2, MessageCircle, MoreHorizontal, Music2, Play, Send, Share2, Shirt, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CH_NAME, CONTENT_CHANNELS, TINTS, type Product } from "../mock";
import type { ChannelId } from "../types";
import { Avatar, ChannelLogo, Field, card, inputCls } from "../ui";

export type PublishMode = "now" | "schedule";
export type Device = "desktop" | "mobile";
export interface MediaItem { id: string; kind: "image" | "video"; url: string; name: string; duration?: number }
/** Nội dung đang soạn – dùng chung cho xem trước và gửi duyệt, bất kể tạo bằng AI hay tự soạn. */
export interface Draft { title: string; caption: string; hashtags: string[]; cta: string }

export const fmtDuration = (s?: number) => (s == null ? "" : `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`);

/* ---------- Media ---------- */
export function MediaView({ item, className }: { item?: MediaItem; className?: string }) {
  if (item?.kind === "image") return <img src={item.url} alt={item.name} className={cn("size-full object-cover", className)} />;
  if (item?.kind === "video") return <video src={item.url} muted preload="metadata" className={cn("size-full object-cover", className)} />;
  return null;
}
export const Placeholder = ({ tint, className }: { tint?: string; className?: string }) => (
  <div className={cn("grid size-full place-items-center bg-gradient-to-br text-slate-400", tint ?? TINTS[0], className)}><Shirt className="size-5" /></div>
);

type MediaLayout = "adaptive" | "carousel" | "portrait";

function resolvePreviewMedia(products: Product[], media: MediaItem[]): MediaItem[] {
  if (media.length > 0) return media;
  return products.flatMap((product) => product.imageUrl ? [{
    id: `product-${product.id}`,
    kind: "image" as const,
    url: product.imageUrl,
    name: product.name,
  }] : []);
}

function EmptyMedia({ draft }: { draft: Draft }) {
  return (
    <div className="relative size-full bg-gradient-to-br from-stone-100 via-stone-50 to-violet-100 p-4">
      <p className="font-serif text-[10px] tracking-[0.22em] text-slate-500">ÉLANE</p>
      <p className="mt-2 max-w-[80%] font-serif text-lg leading-tight text-slate-800">{draft.title || "Modern Office Look"}</p>
      {draft.cta && <span className="absolute bottom-3 left-3 rounded-sm bg-slate-900 px-2 py-1 text-[9px] font-semibold uppercase text-white">{draft.cta}</span>}
    </div>
  );
}

/**
 * Facebook/gallery: 1 full, 2 columns, 3 with a large lead image, 4 as 2x2,
 * 5+ as one large + four thumbnails. Instagram/TikTok keep one active slide.
 */
function PreviewMedia({ draft, products, media, ratio = "aspect-[16/9]", className, layout = "adaptive" }: {
  draft: Draft; products: Product[]; media: MediaItem[]; ratio?: string; className?: string; layout?: MediaLayout;
}) {
  const items = resolvePreviewMedia(products, media);
  const count = items.length;
  const [activeIndex, setActiveIndex] = useState(0);

  if (layout === "carousel" || layout === "portrait") {
    const currentIndex = count > 0 ? Math.min(activeIndex, count - 1) : 0;
    const current = items[currentIndex];
    return (
      <div className={cn("relative overflow-hidden bg-slate-100", layout === "portrait" ? "aspect-[9/16] rounded-xl" : ratio, className)}>
        {current ? <MediaView item={current} /> : <EmptyMedia draft={draft} />}
        {current?.kind === "video" && <span className="pointer-events-none absolute inset-0 grid place-items-center"><span className="grid size-12 place-items-center rounded-full bg-black/45"><Play className="ml-0.5 size-6 fill-white text-white" /></span></span>}
        {count > 1 && (
          <>
            <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">{currentIndex + 1}/{count}</span>
            {currentIndex > 0 && <button type="button" aria-label="Ảnh trước" onClick={() => setActiveIndex(currentIndex - 1)} className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/65"><ChevronLeft className="size-5" /></button>}
            {currentIndex < count - 1 && <button type="button" aria-label="Ảnh tiếp theo" onClick={() => setActiveIndex(currentIndex + 1)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/65"><ChevronRight className="size-5" /></button>}
            <div className="absolute bottom-2 left-1/2 flex max-w-[70%] -translate-x-1/2 gap-1 rounded-full bg-black/35 px-2 py-1">
              {items.slice(0, 7).map((item, index) => <button type="button" aria-label={`Xem ảnh ${index + 1}`} onClick={() => setActiveIndex(index)} key={item.id} className={cn("size-1.5 rounded-full", index === currentIndex ? "bg-white" : "bg-white/50")} />)}
              {count > 7 && <span className="text-[8px] leading-[6px] text-white">+{count - 7}</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  if (count === 0) return <div className={cn("overflow-hidden rounded-md", ratio, className)}><EmptyMedia draft={draft} /></div>;

  const visible = items.slice(0, count >= 5 ? 5 : count);
  const gridClass = count === 1
    ? "grid-cols-1 grid-rows-1"
    : count === 2
      ? "grid-cols-2 grid-rows-1"
      : count === 3
        ? "grid-cols-2 grid-rows-2"
        : count === 4
          ? "grid-cols-2 grid-rows-2"
          : "grid-cols-4 grid-rows-2";

  const cellClass = (index: number) => {
    if (count === 3 && index === 0) return "row-span-2";
    if (count >= 5 && index === 0) return "col-span-2 row-span-2";
    return "";
  };

  return (
    <div className={cn("grid gap-1 overflow-hidden rounded-md bg-slate-100", gridClass, ratio, className)}>
      {visible.map((item, index) => (
        <div key={item.id} className={cn("relative min-h-0 overflow-hidden bg-slate-100", cellClass(index))}>
          <MediaView item={item} />
          {item.kind === "video" && <Play className="absolute left-2 top-2 size-4 fill-white text-white drop-shadow" />}
          {index === 4 && count > 5 && <span className="absolute inset-0 grid place-items-center bg-slate-950/55 text-xl font-semibold text-white">+{count - 5}</span>}
        </div>
      ))}
    </div>
  );
}

/* ---------- Thẻ xem trước theo kênh ---------- */
interface CardProps { draft: Draft; products: Product[]; media: MediaItem[] }
const EMPTY_HINT = "Nội dung xem trước sẽ hiển thị ở đây khi bạn tạo hoặc nhập nội dung.";

function FacebookPreview({ draft, products, media }: CardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2.5">
        <Avatar label="ÉLANE" className="size-10 text-[8px]" />
        <div className="min-w-0 flex-1 leading-tight"><p className="text-sm font-semibold">ÉLANE Fashion</p><p className="flex items-center gap-1 text-xs text-slate-400">Vừa xong · <Globe className="size-3" /></p></div>
        <MoreHorizontal className="size-5 text-slate-400" />
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-800">
        {draft.caption ? <p className="whitespace-pre-line">{draft.caption}</p> : <p className="text-slate-400">{EMPTY_HINT}</p>}
        {draft.cta && draft.caption && <p>👉 {draft.cta}</p>}
        {draft.hashtags.length > 0 && <p className="text-[#1b74e4]">{draft.hashtags.slice(0, 10).join(" ")}</p>}
      </div>
      <PreviewMedia draft={draft} products={products} media={media} className="mt-3" />
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="grid size-4 place-items-center rounded-full bg-[#1b74e4] text-white"><ThumbsUp className="size-2.5 fill-white" /></span><Heart className="-ml-2 size-4 fill-rose-500 text-rose-500" />1.2K</span>
        <span>128 bình luận · 58 lượt chia sẻ</span>
      </div>
      <div className="mt-2 grid grid-cols-3 border-t border-slate-100 pt-2 text-sm text-slate-600">
        <span className="flex items-center justify-center gap-1.5"><ThumbsUp className="size-4" />Thích</span>
        <span className="flex items-center justify-center gap-1.5"><MessageCircle className="size-4" />Bình luận</span>
        <span className="flex items-center justify-center gap-1.5"><Share2 className="size-4" />Chia sẻ</span>
      </div>
    </div>
  );
}

function InstagramPreview({ draft, products, media }: CardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2"><Avatar label="É" className="size-8 text-xs" /><div className="leading-tight"><p className="text-xs font-semibold">elane.official</p><p className="text-[10px] text-slate-400">Hà Nội, Việt Nam</p></div><MoreHorizontal className="ml-auto size-5 text-slate-400" /></div>
      <PreviewMedia draft={draft} products={products} media={media} className="mt-2 rounded-none" ratio="aspect-square" layout="carousel" />
      <div className="mt-2 flex items-center gap-3 text-slate-800"><Heart className="size-5 fill-rose-500 text-rose-500" /><MessageCircle className="size-5" /><Send className="size-5" /><Bookmark className="ml-auto size-5" /></div>
      <p className="mt-1 text-xs font-semibold">1.2K lượt thích</p>
      <p className="mt-1 line-clamp-6 whitespace-pre-line text-xs text-slate-700">{draft.caption ? <><b>elane.official</b> {draft.caption}</> : <span className="text-slate-400">{EMPTY_HINT}</span>}</p>
      {draft.hashtags.length > 0 && <p className="mt-1 text-xs text-[#00376b]">{draft.hashtags.slice(0, 10).join(" ")}</p>}
    </div>
  );
}

function TikTokPreview({ draft, products, media }: CardProps) {
  return (
    <div className="mx-auto max-w-[330px] overflow-hidden rounded-xl bg-slate-950 text-white shadow-sm">
      <div className="relative">
        <PreviewMedia draft={draft} products={products} media={media} layout="portrait" className="rounded-none" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent p-4 pt-20">
          <p className="text-sm font-semibold">@elane.official</p>
          <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs leading-5">{draft.caption || EMPTY_HINT}</p>
          {draft.hashtags.length > 0 && <p className="mt-1 line-clamp-2 text-xs font-medium">{draft.hashtags.slice(0, 6).join(" ")}</p>}
          <p className="mt-3 flex items-center gap-2 text-[11px]"><Music2 className="size-3.5" /> Âm thanh gốc · ÉLANE</p>
        </div>
        <div className="absolute bottom-20 right-3 flex flex-col items-center gap-4 text-[10px]">
          <span className="grid size-9 place-items-center rounded-full bg-black/35"><Heart className="size-5 fill-white" /></span>
          <span className="grid size-9 place-items-center rounded-full bg-black/35"><MessageCircle className="size-5 fill-white" /></span>
          <span className="grid size-9 place-items-center rounded-full bg-black/35"><Share2 className="size-5 fill-white" /></span>
        </div>
      </div>
    </div>
  );
}

function GenericPreview({ channel, draft, products, media }: CardProps & { channel: ChannelId }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2"><ChannelLogo id={channel} size="sm" /><div className="leading-tight"><p className="text-sm font-semibold">ÉLANE · {CH_NAME[channel]}</p><p className="text-xs text-slate-400">Xem trước cơ bản</p></div></div>
      <PreviewMedia draft={draft} products={products} media={media} className="mt-3" />
      <p className="mt-3 line-clamp-6 whitespace-pre-line text-sm text-slate-700">{draft.caption || <span className="text-slate-400">{EMPTY_HINT}</span>}</p>
      {draft.hashtags.length > 0 && <p className="mt-1 text-sm text-[#6941c6]">{draft.hashtags.slice(0, 10).join(" ")}</p>}
    </div>
  );
}

export function PreviewPanel({ title, channel, onChannel, device, onDevice, draft, products, media }: CardProps & {
  title: string; channel: ChannelId; onChannel: (c: ChannelId) => void; device: Device; onDevice: (d: Device) => void;
}) {
  const props = { draft, products, media };
  return (
    <section className={cn(card, "p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <label className="flex items-center gap-2 text-xs text-slate-500">Xem trước trên thiết bị
          <select value={device} onChange={(e) => onDevice(e.target.value as Device)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[#6941c6]">
            <option value="desktop">Desktop</option><option value="mobile">Mobile</option>
          </select>
        </label>
      </div>
      <div role="tablist" className="mt-3 flex gap-1 overflow-x-auto border-b border-slate-200">
        {CONTENT_CHANNELS.map((id) => (
          <button key={id} role="tab" aria-selected={channel === id} onClick={() => onChannel(id)}
            className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-xs font-medium", channel === id ? "border-[#6941c6] bg-violet-50 text-[#6941c6]" : "border-transparent text-slate-500 hover:text-slate-700")}>
            <ChannelLogo id={id} size="xs" />{CH_NAME[id]}
          </button>
        ))}
      </div>
      <div className={cn("mx-auto mt-4", device === "mobile" && "max-w-[340px]")}>
        {channel === "facebook" ? <FacebookPreview {...props} /> : channel === "instagram" ? <InstagramPreview {...props} /> : channel === "tiktok" ? <TikTokPreview {...props} /> : <GenericPreview channel={channel} {...props} />}
      </div>
    </section>
  );
}

/* ---------- Thời gian đăng + nút hành động ---------- */
function RadioRow({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" role="radio" aria-checked={checked} onClick={onClick} className="flex w-full items-center gap-3 text-left text-sm">
      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", checked ? "border-[#6941c6]" : "border-slate-300")}>{checked && <span className="size-2.5 rounded-full bg-[#6941c6]" />}</span>
      {children}
    </button>
  );
}

export function SchedulePanel({ mode, onMode, date, onDate, time, onTime, mediaUrl, onMediaUrl, unsupported, busy, onCancel, onDraft, onSubmit, onPublishNow }: {
  mode: PublishMode; onMode: (m: PublishMode) => void; date: string; onDate: (v: string) => void; time: string; onTime: (v: string) => void;
  mediaUrl: string; onMediaUrl: (v: string) => void; unsupported: boolean; busy: boolean; onCancel: () => void; onDraft: () => void; onSubmit: () => void; onPublishNow?: () => void;
}) {
  return (
    <section className={cn(card, "p-5")}>
      <h3 className="text-sm font-semibold">Thời gian đăng</h3>
      <div role="radiogroup" className="mt-3 space-y-3">
        <RadioRow checked={mode === "now"} onClick={() => onMode("now")}>Đăng ngay sau khi duyệt</RadioRow>
        <RadioRow checked={mode === "schedule"} onClick={() => onMode("schedule")}>Lên lịch đăng sau khi duyệt</RadioRow>
        {mode === "schedule" && (
          <div className="grid grid-cols-[1.3fr_1fr] gap-2 pl-8">
            <input type="date" aria-label="Ngày đăng" value={date} onChange={(e) => onDate(e.target.value)} className={inputCls} />
            <input type="time" aria-label="Giờ đăng" value={time} onChange={(e) => onTime(e.target.value)} className={inputCls} />
          </div>
        )}
      </div>
      <div className="mt-4">
        <Field label={<span className="text-sm font-semibold">Ảnh bài viết (URL công khai)</span>}
          hint="Tự động lấy ảnh từ sản phẩm đã chọn, hoặc nhập link ảnh công khai bên dưới.">
          <input value={mediaUrl} onChange={(e) => onMediaUrl(e.target.value)} placeholder="https://..." className={inputCls} />
        </Field>
      </div>
      {unsupported && <p className="mt-3 text-xs text-amber-700">Hiện chỉ Instagram đăng được qua API; các kênh còn lại sẽ được bổ sung sau.</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={busy}>Hủy</Button>
        <Button variant="outline" onClick={onDraft} disabled={busy}>Lưu nháp</Button>
        {onPublishNow && (
          <Button variant="outline" onClick={onPublishNow} disabled={busy} className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
            Duyệt & Đăng ngay
          </Button>
        )}
        <Button onClick={onSubmit} disabled={busy} className="ml-auto flex-1 gap-2 bg-[#6941c6] hover:bg-[#5b36b0] sm:flex-none">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === "schedule" ? "Gửi duyệt & Lên lịch" : "Gửi duyệt bài viết"}{!busy && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </section>
  );
}
