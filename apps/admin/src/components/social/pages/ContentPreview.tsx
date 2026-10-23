import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, ChevronLeft, ChevronRight, Globe, Heart, Loader2, MessageCircle, MoreHorizontal, Music2, Play, Search, Send, Share2, Shirt, ShoppingBag, ShoppingCart, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CH_NAME, CONTENT_CHANNELS, TINTS, type Product } from "../mock";
import type { ChannelAccount, ChannelId } from "../types";
import { Avatar, ChannelLogo, Field, card, inputCls } from "../ui";

export type PublishMode = "now" | "schedule";
export type Device = "desktop" | "mobile";
export interface MediaItem { id: string; kind: "image" | "video"; url: string; name: string; duration?: number; productId?: string }
export interface Draft { title: string; caption: string; hashtags: string[]; cta: string; ctaLink?: string }

export function formatFullCta(cta: string, ctaLink?: string): string {
  if (!cta && !ctaLink) return "";
  if (!cta) return ctaLink?.trim() || "";
  const link = ctaLink?.trim();
  if (link && !cta.includes(link)) {
    return `${cta}: ${link}`;
  }
  return cta;
}

export function renderCtaText(cta: string, ctaLink?: string, linkClassName = "text-[#00376b] hover:underline") {
  if (!cta && !ctaLink) return null;
  const link = ctaLink?.trim();
  if (!cta && link) {
    return <>👉 <span className={linkClassName}>{link}</span></>;
  }
  const ctaHasLink = link && !cta.includes(link);
  return (
    <>
      👉 {cta}
      {ctaHasLink && (
        <>: <span className={linkClassName}>{link}</span></>
      )}
    </>
  );
}

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
            <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white shadow-xs">{currentIndex + 1}/{count}</span>
            {currentIndex > 0 && (
              <button
                type="button"
                aria-label="Ảnh trước"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(currentIndex - 1);
                }}
                className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/65 shadow-xs"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            {currentIndex < count - 1 && (
              <button
                type="button"
                aria-label="Ảnh tiếp theo"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(currentIndex + 1);
                }}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/65 shadow-xs"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
            <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
              {items.slice(0, 7).map((item, index) => {
                const isCurrent = index === currentIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`Xem ảnh ${index + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex(index);
                    }}
                    className="group flex size-2.5 items-center justify-center p-0 appearance-none bg-transparent border-0 cursor-pointer"
                  >
                    <span
                      className={cn(
                        "block rounded-full transition-all duration-200",
                        isCurrent
                          ? "size-1.5 scale-125 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
                          : "size-1.5 bg-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.7)] group-hover:bg-white"
                      )}
                    />
                  </button>
                );
              })}
              {count > 7 && <span className="text-[9px] font-semibold leading-none text-white/90">+{count - 7}</span>}
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
interface CardProps { draft: Draft; products: Product[]; media: MediaItem[]; account?: ChannelAccount }
const EMPTY_HINT = "Nội dung xem trước sẽ hiển thị ở đây khi bạn tạo hoặc nhập nội dung.";

const accountName = (account: ChannelAccount | undefined, fallback: string) => account?.accountName || fallback;
const accountHandle = (account: ChannelAccount | undefined, fallback = "@elane.official") => account?.handle || fallback;

function FacebookPreview({ draft, products, media, account }: CardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2.5">
        <Avatar label="ÉLANE" className="size-10 text-[8px]" />
        <div className="min-w-0 flex-1 leading-tight"><p className="truncate text-sm font-semibold">{accountName(account, "ÉLANE Fashion")}</p><p className="flex items-center gap-1 text-xs text-slate-400">Vừa xong · <Globe className="size-3" /></p></div>
        <MoreHorizontal className="size-5 text-slate-400" />
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-800">
        {draft.caption ? <p className="whitespace-pre-line">{draft.caption}</p> : <p className="text-slate-400">{EMPTY_HINT}</p>}
        {draft.cta && draft.caption && <p className="font-medium text-slate-800">{renderCtaText(draft.cta, draft.ctaLink, "text-[#1b74e4] hover:underline")}</p>}
        {draft.hashtags.length > 0 && <p className="text-[#1b74e4]">{draft.hashtags.slice(0, 10).join(" ")}</p>}
      </div>
      <PreviewMedia draft={draft} products={products} media={media} className="mt-3" />
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="grid size-4 place-items-center rounded-full bg-[#1b74e4] text-white"><ThumbsUp className="size-2.5 fill-white" /></span><Heart className="-ml-2 size-4 fill-rose-500 text-rose-500" />0</span>
        <span>0 bình luận · 0 lượt chia sẻ</span>
      </div>
      <div className="mt-2 grid grid-cols-3 border-t border-slate-100 pt-2 text-sm text-slate-600">
        <span className="flex items-center justify-center gap-1.5"><ThumbsUp className="size-4" />Thích</span>
        <span className="flex items-center justify-center gap-1.5"><MessageCircle className="size-4" />Bình luận</span>
        <span className="flex items-center justify-center gap-1.5"><Share2 className="size-4" />Chia sẻ</span>
      </div>
    </div>
  );
}

function InstagramPreview({ draft, products, media, account }: CardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2"><Avatar label="É" className="size-8 text-xs" /><div className="min-w-0 leading-tight"><p className="truncate text-xs font-semibold">{accountHandle(account).replace(/^@/, "")}</p><p className="text-[10px] text-slate-400">Hà Nội, Việt Nam</p></div><MoreHorizontal className="ml-auto size-5 shrink-0 text-slate-400" /></div>
      <PreviewMedia draft={draft} products={products} media={media} className="mt-2 rounded-none" ratio="aspect-square" layout="carousel" />
      <div className="mt-2 flex items-center gap-3 text-slate-800"><Heart className="size-5 fill-rose-500 text-rose-500" /><MessageCircle className="size-5" /><Send className="size-5" /><Bookmark className="ml-auto size-5" /></div>
      <p className="mt-1 text-xs font-semibold">0 lượt thích</p>
      <div className="mt-1 space-y-1 text-xs text-slate-700">
        <p className="line-clamp-6 whitespace-pre-line">{draft.caption ? <><b>{accountHandle(account).replace(/^@/, "")}</b> {draft.caption}</> : <span className="text-slate-400">{EMPTY_HINT}</span>}</p>
        {draft.cta && draft.caption && <p className="font-semibold text-slate-900">{renderCtaText(draft.cta, draft.ctaLink, "text-[#00376b] hover:underline font-normal")}</p>}
        {draft.hashtags.length > 0 && <p className="text-[#00376b]">{draft.hashtags.slice(0, 10).join(" ")}</p>}
      </div>
    </div>
  );
}

function TikTokPreview({ draft, products, media, account }: CardProps) {
  return (
    <div className="mx-auto max-w-[330px] overflow-hidden rounded-xl bg-slate-950 text-white shadow-sm">
      <div className="relative">
        <PreviewMedia draft={draft} products={products} media={media} layout="portrait" className="rounded-none" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent p-4 pt-20">
          <p className="text-sm font-semibold">{accountHandle(account, "@elane.fashion")}</p>
          <div className="mt-1 space-y-1 text-xs leading-5">
            <p className="line-clamp-4 whitespace-pre-line">{draft.caption || EMPTY_HINT}</p>
            {draft.cta && draft.caption && <p className="font-semibold text-white">{renderCtaText(draft.cta, draft.ctaLink, "text-white underline font-normal")}</p>}
            {draft.hashtags.length > 0 && <p className="line-clamp-2 font-medium text-white/90">{draft.hashtags.slice(0, 6).join(" ")}</p>}
          </div>
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

function ShopeePreview({ draft, products, media, account }: CardProps) {
  const firstProduct = products[0];
  const price = firstProduct?.price ? new Intl.NumberFormat("vi-VN").format(firstProduct.price) + "₫" : null;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#f5f5f5] shadow-sm">
      <div className="bg-[#ee4d2d] px-3 py-2.5 text-white">
        <div className="flex items-center gap-2"><ShoppingBag className="size-5" /><p className="min-w-0 flex-1 truncate text-sm font-semibold">{accountName(account, "ÉLANE Official Store")}</p><ShoppingCart className="size-5" /></div>
        <div className="mt-2 flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-xs text-slate-400"><Search className="size-3.5" />Tìm trong Shop</div>
      </div>
      <div className="bg-white p-3">
        <div className="flex items-center gap-2"><Avatar label="É" className="size-8 text-xs" /><div><p className="text-xs font-semibold">{accountName(account, "ÉLANE Official Store")}</p><p className="text-[10px] text-slate-400">Vừa xong</p></div></div>
        <div className="mt-2 space-y-1 text-sm leading-5 text-slate-700">
          <p className="line-clamp-5 whitespace-pre-line">{draft.caption || EMPTY_HINT}</p>
          {draft.cta && draft.caption && <p className="text-xs font-semibold text-[#ee4d2d]">{renderCtaText(draft.cta, draft.ctaLink, "text-[#ee4d2d] underline font-normal")}</p>}
          {draft.hashtags.length > 0 && <p className="line-clamp-2 text-xs text-[#ee4d2d]">{draft.hashtags.slice(0, 8).join(" ")}</p>}
        </div>
        <PreviewMedia draft={draft} products={products} media={media} className="mt-3" ratio="aspect-square" layout="carousel" />
        {firstProduct && <div className="mt-2 flex items-center justify-between rounded-md border border-orange-100 bg-orange-50 px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{firstProduct.name}</p><p className="mt-0.5 text-xs font-semibold text-[#ee4d2d]">{price || "Xem giá sản phẩm"}</p></div><button type="button" className="ml-3 shrink-0 rounded bg-[#ee4d2d] px-2.5 py-1.5 text-[11px] font-semibold text-white">Mua ngay</button></div>}
      </div>
    </div>
  );
}

function WebsitePreview({ draft, products, media }: CardProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><p className="font-serif text-base font-semibold tracking-[0.18em] text-slate-900">ÉLANE</p><div className="flex gap-3 text-[10px] font-medium uppercase tracking-wide text-slate-500"><span>Sản phẩm</span><span>Bộ sưu tập</span></div></div>
      <PreviewMedia draft={draft} products={products} media={media} ratio="aspect-[16/9]" className="rounded-none" layout="carousel" />
      <article className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6941c6]">Phong cách ÉLANE</p>
        <h3 className="mt-1 font-serif text-xl leading-tight text-slate-900">{draft.title || "Bài viết mới từ ÉLANE"}</h3>
        <p className="mt-2 line-clamp-5 whitespace-pre-line text-sm leading-6 text-slate-600">{draft.caption || EMPTY_HINT}</p>
        {draft.hashtags.length > 0 && <p className="mt-2 line-clamp-2 text-xs text-slate-400">{draft.hashtags.slice(0, 8).join(" ")}</p>}
        {draft.cta && (
          <a
            href={draft.ctaLink || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            {draft.cta}
            <ArrowRight className="size-3.5" />
          </a>
        )}
      </article>
    </div>
  );
}

function GenericPreview({ channel, draft, products, media }: CardProps & { channel: ChannelId }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2"><ChannelLogo id={channel} size="sm" /><div className="leading-tight"><p className="text-sm font-semibold">ÉLANE · {CH_NAME[channel]}</p><p className="text-xs text-slate-400">Xem trước cơ bản</p></div></div>
      <PreviewMedia draft={draft} products={products} media={media} className="mt-3" />
      <div className="mt-3 space-y-1.5 text-sm text-slate-700">
        <p className="line-clamp-6 whitespace-pre-line">{draft.caption || <span className="text-slate-400">{EMPTY_HINT}</span>}</p>
        {draft.cta && draft.caption && <p className="text-xs font-semibold text-slate-900">{renderCtaText(draft.cta, draft.ctaLink, "text-[#6941c6] hover:underline font-normal")}</p>}
        {draft.hashtags.length > 0 && <p className="mt-1 text-sm text-[#6941c6]">{draft.hashtags.slice(0, 10).join(" ")}</p>}
      </div>
    </div>
  );
}

export function PreviewPanel({ title, channel, onChannel, device, onDevice, draft, products, media, targets, accounts }: CardProps & {
  title: string; channel: ChannelId; onChannel: (c: ChannelId) => void; device: Device; onDevice: (d: Device) => void;
  targets: ChannelId[]; accounts: ChannelAccount[];
}) {
  const visibleChannels = CONTENT_CHANNELS.filter((id) => targets.includes(id));
  const previewChannels = visibleChannels.length > 0 ? visibleChannels : CONTENT_CHANNELS;
  useEffect(() => {
    if (!previewChannels.includes(channel)) onChannel(previewChannels[0]);
  }, [channel, onChannel, previewChannels.join("|")]);
  const account = accounts.find((item) => item.id === channel);
  const props = { draft, products, media, account };
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
        {previewChannels.map((id) => (
          <button key={id} role="tab" aria-selected={channel === id} onClick={() => onChannel(id)}
            className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-xs font-medium", channel === id ? "border-[#6941c6] bg-violet-50 text-[#6941c6]" : "border-transparent text-slate-500 hover:text-slate-700")}>
            <ChannelLogo id={id} size="xs" />{CH_NAME[id]}
          </button>
        ))}
      </div>
      <div className={cn("mx-auto mt-4", device === "mobile" && "max-w-[340px]")}>
        {channel === "facebook" ? <FacebookPreview {...props} /> : channel === "instagram" ? <InstagramPreview {...props} /> : channel === "tiktok" ? <TikTokPreview {...props} /> : channel === "shopee" ? <ShopeePreview {...props} /> : channel === "website" ? <WebsitePreview {...props} /> : <GenericPreview channel={channel} {...props} />}
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
