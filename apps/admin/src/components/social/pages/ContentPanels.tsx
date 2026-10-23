import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Eye, FolderHeart, GripVertical, Images, Link2, List, ListOrdered, Pencil, Play, Plus, RefreshCw, Shirt, Smile, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AGES, AUDIENCES, CAMPAIGN_GOALS, CH_NAME, CONTENT_CHANNELS, CTAS, GOALS, MOCK_PRODUCTS, SEGMENTS, STYLES, TONES, type Collection, type Product, type Variant } from "../mock";
import type { AiPreset, ChannelId } from "../types";
import { areaCls, ChannelLogo, Field, inputCls, Pill, card, vnd } from "../ui";
import { fmtDuration, formatFullCta, MediaView, Placeholder, type MediaItem } from "./ContentPreview";

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

export interface AiKeyInfo {
  active: boolean;
  message?: string;
  key?: {
    id: string;
    label: string;
    provider: string;
    creditsRemaining: number | null;
  };
}

export function AiInputPanel({
  form,
  upd,
  preset,
  targets,
  onToggleChannel,
  busy,
  hasResult,
  onGenerate,
  onSeeAll,
  aiKey,
  onManageKeys,
  products = MOCK_PRODUCTS,
  selectedLookbook,
  onClearLookbook,
  productImages = [],
  selectedProductImageIds = [],
  onToggleProductImage,
}: {
  form: AiForm;
  upd: (p: Partial<AiForm>) => void;
  preset: AiPreset;
  targets: ChannelId[];
  onToggleChannel: (id: ChannelId) => void;
  busy: boolean;
  hasResult: boolean;
  onGenerate: () => void;
  onSeeAll: () => void;
  aiKey?: AiKeyInfo | null;
  onManageKeys?: () => void;
  products?: Product[];
  selectedLookbook?: Collection | null;
  onClearLookbook?: () => void;
  featuredFirst?: boolean;
  productImages?: MediaItem[];
  selectedProductImageIds?: string[];
  onToggleProductImage?: (id: string) => void;
}) {
  const toggleProduct = (id: string) => upd({ picked: form.picked.includes(id) ? form.picked.filter((x) => x !== id) : [...form.picked, id] });
  const extraHint = preset === "topic" ? "Ví dụ: Phối đồ công sở mùa thu" : preset === "idea" ? "Ví dụ: Giới thiệu đầm lụa mới cho tiệc tối..." : "Nhấn mạnh chất liệu cao cấp, form dáng tôn dáng, phù hợp đi làm, đi cafe.";

  // Chỉ hiển thị các sản phẩm đã chọn (giữ đúng thứ tự người dùng đã chọn)
  const pickedProducts = useMemo(() => {
    return form.picked
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));
  }, [products, form.picked]);

  const sliderRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  };

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(() => checkScroll());
    ro.observe(el);

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) && el.scrollWidth > el.clientWidth) {
        if (
          (e.deltaY > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 2) ||
          (e.deltaY < 0 && el.scrollLeft > 2)
        ) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      el.removeEventListener("scroll", checkScroll);
      el.removeEventListener("wheel", handleWheel);
      ro.disconnect();
    };
  }, [pickedProducts]);

  const scrollSlider = (direction: "left" | "right") => {
    const el = sliderRef.current;
    if (!el) return;
    const distance = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === "left" ? -distance : distance, behavior: "smooth" });
  };

  return (
    <section className={cn(card, "w-full min-w-0 max-w-full overflow-hidden space-y-5 p-5")}>
      <div>
        <h2 className="text-lg font-semibold">2. Nhập thông tin để AI tạo nội dung</h2>
      </div>

      <Field
        label={
          <>
            Chọn sản phẩm / BST {preset === "product" && <span className="text-rose-500">*</span>}
            {form.picked.length > 0 && (
              <span className="ml-2 font-normal text-xs text-violet-700">
                (Đã chọn {form.picked.length})
              </span>
            )}
          </>
        }
        hint={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSeeAll}
              className="text-xs font-semibold text-[#6941c6] hover:underline flex items-center gap-1"
            >
              Xem tất cả &rarr;
            </button>
          </div>
        }
      >
        {selectedLookbook && (
          <div className="mb-2.5 flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <FolderHeart className="size-4 shrink-0 text-[#6941c6]" />
              <span className="truncate">
                BST đang chọn: <strong className="text-slate-900">{selectedLookbook.title}</strong>
                {selectedLookbook.season && (
                  <span className="ml-1 text-violet-700 font-medium">({selectedLookbook.season})</span>
                )}
              </span>
            </div>
            {onClearLookbook && (
              <button
                type="button"
                onClick={onClearLookbook}
                className="ml-2 shrink-0 text-[11px] text-slate-500 hover:text-slate-800 underline"
              >
                Bỏ chọn BST
              </button>
            )}
          </div>
        )}

        {pickedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
            <Shirt className="size-7 text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-700">Chưa chọn sản phẩm nào</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onSeeAll}
              className="mt-3 h-8 gap-1.5 border-violet-200 text-xs text-[#6941c6] hover:bg-violet-50"
            >
              <Plus className="size-3.5" />
              Chọn sản phẩm
            </Button>
          </div>
        ) : (
          <div className="relative w-full min-w-0 max-w-full">
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollSlider("left")}
                aria-label="Trượt xem sản phẩm trước"
                className="!min-h-0 absolute left-1 top-[38%] -translate-y-1/2 z-10 grid size-7 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur-xs transition-all hover:bg-white hover:scale-110 active:scale-95"
              >
                <ChevronLeft className="size-4 text-slate-700" />
              </button>
            )}

            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollSlider("right")}
                aria-label="Trượt xem sản phẩm tiếp theo"
                className="!min-h-0 absolute right-1 top-[38%] -translate-y-1/2 z-10 grid size-7 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur-xs transition-all hover:bg-white hover:scale-110 active:scale-95"
              >
                <ChevronRight className="size-4 text-slate-700" />
              </button>
            )}

            <div
              ref={sliderRef}
              className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1.5 pt-0.5 scroll-smooth"
              style={{ scrollbarWidth: "thin" }}
            >
              {pickedProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={true}
                  onClick={() => toggleProduct(p.id)}
                  title={`${p.name} (Bấm để bỏ chọn)`}
                  className={cn(
                    "!min-h-0 group relative w-[calc((100%-24px)/4)] min-w-[90px] max-w-[130px] shrink-0 rounded-lg border p-1 text-left transition-all",
                    "border-[#6941c6] bg-violet-50/50 ring-1 ring-[#6941c6]"
                  )}
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-slate-100">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className={cn("grid size-full place-items-center bg-gradient-to-br text-slate-500", p.tint)}>
                        <Shirt className="size-6" />
                      </div>
                    )}
                    <span className="absolute left-1 top-1">
                      <Checkbox on />
                    </span>
                    {p.category && (
                      <span className="absolute bottom-1 right-1 rounded bg-slate-900/60 px-1 py-0.5 text-[8px] font-medium text-white backdrop-blur-xs">
                        {p.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight text-slate-700">
                    {p.name}
                  </p>
                  <div className="mt-0.5 flex items-center justify-between text-[10px]">
                    <span className="truncate text-slate-400 max-w-[45px]">{p.sku}</span>
                    <span className="font-semibold text-slate-900">{vnd(p.price)}</span>
                  </div>
                </button>
              ))}

              <button
                type="button"
                onClick={onSeeAll}
                title="Chọn thêm sản phẩm khác"
                className="!min-h-0 group flex w-[calc((100%-24px)/4)] min-w-[90px] max-w-[130px] shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-violet-300 bg-violet-50/30 p-2 text-center transition-colors hover:border-[#6941c6] hover:bg-violet-50"
              >
                <div className="grid size-7 place-items-center rounded-full bg-white text-[#6941c6] shadow-xs group-hover:scale-105 transition-transform">
                  <Plus className="size-3.5" />
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-[#6941c6]">Thêm SP</span>
              </button>
            </div>
          </div>
        )}
      </Field>

      {pickedProducts.length > 0 && productImages.length > 0 && (
        <Field
          label={<>Chọn ảnh sản phẩm gửi cho AI <span className="font-normal text-slate-400">({selectedProductImageIds.length}/10)</span></>}
          hint="AI sẽ dùng các ảnh được đánh dấu làm hình ảnh tham chiếu khi tạo nội dung."
        >
          <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {pickedProducts.map((product) => {
              const images = productImages.filter((item) => item.productId === product.id);
              if (images.length === 0) return null;
              const selectedCount = images.filter((item) => selectedProductImageIds.includes(item.id)).length;
              return (
                <div key={product.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-semibold text-slate-700" title={product.name}>{product.name}</p>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                      {selectedCount}/{images.length} ảnh
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {images.map((item) => {
                      const selected = selectedProductImageIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onToggleProductImage?.(item.id)}
                          className={cn(
                            "group relative aspect-[3/4] overflow-hidden rounded-lg border-2 bg-slate-100 transition",
                            selected ? "border-[#6941c6] ring-2 ring-violet-100" : "border-transparent hover:border-violet-200",
                          )}
                          title={`${selected ? "Bỏ chọn" : "Chọn"} ${item.name}`}
                        >
                          <MediaView item={item} />
                          <span className="absolute left-1.5 top-1.5"><Checkbox on={selected} /></span>
                          {selected && <span className="absolute inset-x-1.5 bottom-1.5 rounded bg-[#6941c6]/90 px-1 py-0.5 text-center text-[9px] font-semibold text-white">Gửi cho AI</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Field>
      )}

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
type ResultTab = "content" | "media";

export function AiResultPanel({
  variants,
  active,
  onActive,
  editing,
  onEdit,
  onPatch,
  busy,
  onRegenerate,
  cta,
  onCta,
  ctaLink,
  onCtaLink,
  suggestedLinks = [],
  media,
  selectedMediaIds,
  onSelectedMediaIds,
  onFiles,
  onChooseLibrary,
  keyUsed,
}: {
  variants: Variant[];
  active: number;
  onActive: (i: number) => void;
  editing: boolean;
  onEdit: (i: number) => void;
  onPatch: (i: number, p: Partial<Variant>) => void;
  busy: boolean;
  onRegenerate: () => void;
  cta: string;
  onCta: (v: string) => void;
  ctaLink?: string;
  onCtaLink?: (url: string) => void;
  suggestedLinks?: { label: string; url: string }[];
  media: MediaItem[];
  selectedMediaIds: string[];
  onSelectedMediaIds: (ids: string[]) => void;
  onFiles: (files: File[]) => void;
  onChooseLibrary: () => void;
  keyUsed?: { label?: string; provider?: string } | null;
}) {
  const [tab, setTab] = useState<ResultTab>("content");
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [generatingStep, setGeneratingStep] = useState(0);
  const mediaInput = useRef<HTMLInputElement>(null);
  const hasResult = variants.length > 0;
  const hashtags = variants[active]?.hashtags ?? [];
  const tabs: { id: ResultTab; label: string }[] = [
    { id: "content", label: `Caption, Hashtag & CTA (${variants.length})` },
    { id: "media", label: "Hình ảnh/Media" },
  ];
  const selectedCount = selectedMediaIds.filter((id) => media.some((item) => item.id === id)).length;
  const toggleMedia = (id: string) => onSelectedMediaIds(selectedMediaIds.includes(id) ? selectedMediaIds.filter((item) => item !== id) : [...selectedMediaIds, id].slice(0, MAX_MEDIA));
  const moveMedia = (id: string, direction: -1 | 1) => {
    const from = selectedMediaIds.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= selectedMediaIds.length) return;
    const next = [...selectedMediaIds];
    [next[from], next[to]] = [next[to]!, next[from]!];
    onSelectedMediaIds(next);
  };

  const generatingMessages = [
    "Đang phân tích sản phẩm và hình ảnh...",
    "Đang kết hợp mục tiêu, phong cách và tông giọng...",
    "Đang viết caption phù hợp từng nền tảng...",
    "Đang hoàn thiện hashtag và lời kêu gọi hành động...",
  ];

  useEffect(() => {
    if (!busy) {
      setGeneratingStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setGeneratingStep((step) => (step + 1) % generatingMessages.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [busy]);

  return (
    <section className={cn(card, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">3. Kết quả gợi ý từ AI</h2>

        </div>
        {hasResult && <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-[#6941c6]"><Sparkles className="size-3.5" />Đã tạo {variants.length} phiên bản nội dung</span>}
      </div>

      {busy ? (
        <div className="ai-generating-state relative mt-5 overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 px-5 py-10 text-center">
          <div className="ai-generating-orbit mx-auto grid size-16 place-items-center rounded-2xl bg-white text-[#6941c6] shadow-[0_12px_35px_rgba(105,65,198,0.18)] ring-1 ring-violet-100">
            <Sparkles className="ai-generating-sparkle size-7" />
            <span className="absolute size-2 rounded-full bg-fuchsia-400" />
          </div>
          <p className="mt-5 text-sm font-semibold text-slate-800">AI đang tạo bài viết cho bạn</p>
          <p key={generatingStep} className="ai-generating-message mt-1.5 text-xs text-slate-500" aria-live="polite">
            {generatingMessages[generatingStep]}
          </p>
          <div className="mx-auto mt-5 flex max-w-xs items-center gap-2">
            {generatingMessages.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100 transition-colors duration-300",
                  index <= generatingStep && "bg-violet-200",
                )}
              >
                <span className={cn("block h-full rounded-full bg-[#6941c6] transition-all duration-500", index < generatingStep ? "w-full" : index === generatingStep ? "ai-generating-progress w-full" : "w-0")} />
              </span>
            ))}
          </div>
          <div className="mt-5 flex justify-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((index) => <span key={index} className="ai-generating-dot size-1.5 rounded-full bg-[#6941c6]" style={{ animationDelay: `${index * 160}ms` }} />)}
          </div>
        </div>
      ) : !hasResult ? (
        <div className="grid place-items-center px-4 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-violet-50 text-[#6941c6]"><Sparkles className="size-6" /></span>
          <p className="mt-3 text-sm font-medium text-slate-700">Chưa có nội dung gợi ý</p>
          <p className="mt-1 text-sm text-slate-400">Nhập thông tin ở bước 2 rồi bấm “Tạo content với AI”.</p>
        </div>
      ) : (
        <>
          <div role="tablist" className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs sm:text-sm">
            {tabs.map((t) => <button key={t.id} id={`ai-result-tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls={`ai-result-panel-${t.id}`} onClick={() => setTab(t.id)} className={cn("flex-1 whitespace-nowrap rounded-md px-2 py-1.5 font-medium transition-colors", tab === t.id ? "bg-white text-[#6941c6] shadow-sm" : "text-slate-500 hover:bg-white/60 hover:text-slate-700")}>{t.label}</button>)}
          </div>

          {tab === "content" && (
            <div id="ai-result-panel-content" role="tabpanel" aria-labelledby="ai-result-tab-content" className="mt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Gợi ý nội dung (Caption, Hashtag & CTA)</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    AI đã tạo {variants.length} phiên bản nội dung hoàn chỉnh. Bạn có thể chỉnh sửa và sao chép trước khi đăng.
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={onRegenerate} className="shrink-0 gap-1.5 border-violet-200 text-[#6941c6]">
                  <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
                  Tạo lại nội dung
                </Button>
              </div>

              <div className="mt-3 space-y-3">
                {variants.map((v, i) => {
                  const isCurrent = active === i;
                  const isEditingThis = editing && isCurrent;
                  const fullCta = formatFullCta(cta, ctaLink);
                  const fullPost = [
                    v.caption,
                    fullCta ? `👉 ${fullCta}` : "",
                    (v.hashtags || []).join(" "),
                  ].filter(Boolean).join("\n\n");

                  return (
                    <div
                      key={v.id}
                      onClick={() => onActive(i)}
                      className={cn(
                        "cursor-pointer rounded-lg border p-4 transition-colors",
                        isCurrent ? "border-[#6941c6] bg-violet-50/20 shadow-xs" : "border-slate-200 hover:border-violet-200"
                      )}
                    >
                      {/* Tiêu đề phiên bản & Độ dài */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-slate-800">{v.label}</h4>
                          {i === 0 && <Pill tone="violet">Đề xuất</Pill>}
                        </div>
                        <span className="text-xs text-slate-400">{v.caption.length}/2,200 ký tự</span>
                      </div>

                      {/* Phần 1: Caption */}
                      <div className="mt-2.5">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-medium text-slate-700">Caption:</span>
                          {!isEditingThis && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void copy(v.caption, "caption");
                              }}
                              className="text-[11px] text-slate-400 hover:text-[#6941c6] inline-flex items-center gap-1"
                              title="Chỉ sao chép caption"
                            >
                              <Copy className="size-3" />
                              Copy caption
                            </button>
                          )}
                        </div>
                        {isEditingThis ? (
                          <textarea
                            value={v.caption}
                            maxLength={MAX_CAPTION}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onPatch(i, { caption: e.target.value })}
                            rows={6}
                            placeholder="Nhập nội dung caption..."
                            className={cn(areaCls, "mt-1.5 text-xs sm:text-sm")}
                          />
                        ) : (
                          <p className="mt-1 whitespace-pre-line text-xs sm:text-sm text-slate-700">{v.caption}</p>
                        )}
                      </div>

                      {/* Phần 2: CTA (Kêu gọi hành động & Link) */}
                      <div className="mt-3 rounded-md border border-slate-100 bg-slate-50/80 p-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">Lời kêu gọi hành động (CTA):</span>
                          {!isEditingThis && fullCta && (
                            <button
                              type="button"
                              onClick={() => void copy(fullCta, "CTA")}
                              className="text-[11px] text-slate-400 hover:text-[#6941c6] inline-flex items-center gap-1"
                              title="Sao chép CTA kèm link"
                            >
                              <Copy className="size-3" />
                              Copy CTA
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {CTAS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => onCta(c)}
                              className={cn(
                                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                                cta === c
                                  ? "border-[#6941c6] bg-violet-100/70 font-semibold text-[#6941c6]"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
                              )}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                        {isEditingThis && (
                          <input
                            type="text"
                            value={cta}
                            onChange={(e) => onCta(e.target.value)}
                            placeholder="Hoặc nhập CTA tùy chỉnh..."
                            className={cn(inputCls, "mt-2 h-7 text-xs")}
                          />
                        )}

                        {/* Link đính kèm CTA */}
                        <div className="mt-2.5 border-t border-slate-200/60 pt-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                              <Link2 className="size-3 text-[#6941c6]" />
                              Link đính kèm CTA:
                            </span>
                            {ctaLink && (
                              <button
                                type="button"
                                onClick={() => void copy(ctaLink, "link CTA")}
                                className="text-[11px] text-slate-400 hover:text-[#6941c6] inline-flex items-center gap-1"
                                title="Sao chép link"
                              >
                                <Copy className="size-3" />
                                Copy link
                              </button>
                            )}
                          </div>

                          {suggestedLinks && suggestedLinks.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {suggestedLinks.map((item) => (
                                <button
                                  key={item.url}
                                  type="button"
                                  onClick={() => onCtaLink?.(item.url)}
                                  className={cn(
                                    "rounded border px-2 py-0.5 text-[11px] transition-colors truncate max-w-[240px]",
                                    ctaLink === item.url
                                      ? "border-[#6941c6] bg-violet-100/80 font-medium text-[#6941c6]"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"
                                  )}
                                  title={item.url}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="mt-1.5 flex items-center gap-1.5">
                            <input
                              type="url"
                              value={ctaLink || ""}
                              onChange={(e) => onCtaLink?.(e.target.value)}
                              placeholder="https://elane.vn/... (link sản phẩm / BST / inbox hoặc web)"
                              className={cn(inputCls, "h-7 text-xs flex-1 font-mono text-[11px]")}
                            />
                            {ctaLink && (
                              <button
                                type="button"
                                onClick={() => onCtaLink?.("")}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded"
                                title="Xóa link"
                              >
                                <X className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Phần 3: Hashtag */}
                      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">Hashtags:</span>
                          {!isEditingThis && v.hashtags?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => void copy(v.hashtags.join(" "), "hashtag")}
                              className="text-[11px] text-slate-400 hover:text-[#6941c6] inline-flex items-center gap-1"
                              title="Chỉ sao chép hashtag"
                            >
                              <Copy className="size-3" />
                              Copy hashtag
                            </button>
                          )}
                        </div>
                        {isEditingThis ? (
                          <input
                            type="text"
                            value={v.hashtags.join(" ")}
                            onChange={(e) => {
                              const tags = e.target.value
                                .split(/[\s,]+/)
                                .filter(Boolean)
                                .map((t) => (t.startsWith("#") ? t : `#${t}`));
                              onPatch(i, { hashtags: tags });
                            }}
                            placeholder="#Elane #ThoiTrangNu..."
                            className={cn(inputCls, "mt-1.5 h-8 text-xs")}
                          />
                        ) : (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {v.hashtags?.length > 0 ? (
                              v.hashtags.map((h) => (
                                <span key={h} className="rounded-md bg-violet-50 px-2 py-0.5 text-xs text-[#6941c6]">
                                  {h}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">Chưa có hashtag</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Thao tác Sao chép & Chỉnh sửa */}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-[11px] text-slate-400">
                          {isCurrent ? "Đang áp dụng vào bản xem trước" : "Bấm để chọn phiên bản này"}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              void copy(fullPost, "toàn bộ bài viết");
                            }}
                            className="gap-1.5 border-violet-200 text-[#6941c6] hover:bg-violet-50"
                          >
                            <Copy className="size-3.5" />
                            Sao chép toàn bộ
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            aria-label={isEditingThis ? "Xong chỉnh sửa" : "Chỉnh sửa bài viết"}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(i);
                            }}
                            className="size-8"
                          >
                            {isEditingThis ? <Check className="size-4" /> : <Pencil className="size-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "media" && (
            <div id="ai-result-panel-media" role="tabpanel" aria-labelledby="ai-result-tab-media" className={cn(box, "mt-5")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="text-sm font-semibold">Hình ảnh/Media</h3><p className="mt-0.5 text-xs text-slate-500">Chọn và sắp xếp media dùng cho bài viết.</p></div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={onChooseLibrary} className="h-8 gap-1.5"><Images className="size-3.5" />Chọn từ thư viện</Button>
                  <Button size="sm" variant="outline" onClick={() => mediaInput.current?.click()} className="h-8 gap-1.5 border-violet-200 text-[#6941c6]"><Upload className="size-3.5" />Tải ảnh lên</Button>
                  <input ref={mediaInput} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(event) => { onFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs">
                <span className="font-medium text-slate-700">Đã chọn {selectedCount}/{media.length} media</span>
                <span className="text-slate-500">Tối đa {MAX_MEDIA} · Thứ tự từ trái sang phải</span>
              </div>

              {media.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{media.map((item, index) => {
                  const on = selectedMediaIds.includes(item.id);
                  const order = selectedMediaIds.indexOf(item.id);
                  return (
                    <div key={item.id} className={cn("group relative aspect-[3/4] overflow-hidden rounded-md border bg-slate-100", on ? "border-[#6941c6] ring-2 ring-[#6941c6]/20" : "border-slate-200")}>
                      <button type="button" aria-pressed={on} aria-label={`${on ? "Bỏ chọn" : "Chọn"} ${item.name}`} onClick={() => toggleMedia(item.id)} className="absolute inset-0 z-10"><span className="sr-only">{on ? "Bỏ chọn" : "Chọn"}</span></button>
                      <MediaView item={item} />
                      <span className="absolute left-2 top-2 z-20 pointer-events-none"><Checkbox on={on} /></span>
                      {on && <span className="absolute right-2 top-2 z-20 grid size-5 place-items-center rounded-full bg-[#6941c6] text-[10px] font-semibold text-white">{order + 1}</span>}
                      <div className="absolute inset-x-0 bottom-0 z-20 flex translate-y-full items-center justify-between bg-slate-950/70 p-1.5 text-white transition group-hover:translate-y-0">
                        <button type="button" aria-label="Xem ảnh lớn" onClick={() => setPreviewMedia(item)} className="grid size-7 place-items-center rounded hover:bg-white/15"><Eye className="size-3.5" /></button>
                        {on && <div className="flex items-center"><button type="button" aria-label="Chuyển sang trái" disabled={order === 0} onClick={() => moveMedia(item.id, -1)} className="grid size-7 place-items-center rounded hover:bg-white/15 disabled:opacity-30"><ChevronLeft className="size-4" /></button><GripVertical className="size-3.5 text-white/60" /><button type="button" aria-label="Chuyển sang phải" disabled={order === selectedMediaIds.length - 1} onClick={() => moveMedia(item.id, 1)} className="grid size-7 place-items-center rounded hover:bg-white/15 disabled:opacity-30"><ChevronRight className="size-4" /></button></div>}
                      </div>
                      {item.kind === "video" && <Play className="pointer-events-none absolute left-1/2 top-1/2 z-20 size-8 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow" />}
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6 text-left text-[10px] text-white group-hover:opacity-0">{item.name || `Media ${index + 1}`}</span>
                    </div>
                  );
                })}</div>
              ) : (
                <div className="mt-4 grid place-items-center rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center"><Images className="size-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-600">Chưa có media</p><p className="mt-1 text-xs text-slate-400">Chọn sản phẩm từ thư viện hoặc tải ảnh lên.</p></div>
              )}

              {variants[active]?.visualBrief && <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50/50 p-3"><p className="text-xs font-semibold text-[#6941c6]">Gợi ý bố cục từ AI</p><p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-600">{variants[active]?.visualBrief}</p></div>}

              {previewMedia && <div role="dialog" aria-modal="true" aria-label="Xem media" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-6" onClick={() => setPreviewMedia(null)}><div className="relative max-h-full max-w-4xl overflow-hidden rounded-lg bg-white p-2 shadow-xl" onClick={(event) => event.stopPropagation()}><MediaView item={previewMedia} className="max-h-[80vh] w-auto object-contain" /><button type="button" aria-label="Đóng" onClick={() => setPreviewMedia(null)} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-black/60 text-white"><X className="size-4" /></button></div></div>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* =====================================================================
 * Tự soạn: 2. Soạn nội dung & thiết lập thông tin
 * ===================================================================== */
export interface ManualForm {
  productIds: string[]; campaign: string; segment: string; age: string; style: string; note: string;
  text: string; hashtags: string[]; cta: string; link: string;
}
const LINKS = ["Link sản phẩm", "Link website", "Link tin nhắn"];
const EMOJIS = ["✨", "🖤", "🤍", "🌿", "🛍", "💼", "👗", "🔥"];

function Box({ title, hint, children, className }: { title: ReactNode; hint?: string; children: ReactNode; className?: string }) {
  return <div className={cn(box, className)}><h3 className="text-sm font-semibold">{title}</h3>{hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}<div className="mt-3">{children}</div></div>;
}

export function ManualComposer({ form, upd, products, onPickProduct, lookbook, onClearLookbook, media, onFiles, onRemoveMedia, productImages = [], selectedProductImageIds = [], onToggleProductImage, targets, onToggleChannel }: {
  form: ManualForm; upd: (p: Partial<ManualForm>) => void; products: Product[]; onPickProduct: () => void;
  lookbook?: Collection | null; onClearLookbook?: () => void;
  media: MediaItem[]; onFiles: (files: File[]) => void; onRemoveMedia: (id: string) => void; targets: ChannelId[]; onToggleChannel: (id: ChannelId) => void;
  productImages?: MediaItem[]; selectedProductImageIds?: string[]; onToggleProductImage?: (id: string) => void;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [emoji, setEmoji] = useState(false);
  const [adding, setAdding] = useState(false);
  const [tag, setTag] = useState("");
  const firstProduct = products[0];

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
          <Box
            title={
              <div className="flex items-center justify-between">
                <span>
                  Thông tin sản phẩm / BST <span className="text-rose-500">*</span>
                </span>
                {products.length > 0 && (
                  <button
                    type="button"
                    onClick={onPickProduct}
                    className="text-xs font-semibold text-[#6941c6] hover:underline"
                  >
                    Đổi sản phẩm
                  </button>
                )}
              </div>
            }
          >
            {lookbook && (
              <div className="mb-2.5 flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50/70 p-2.5 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderHeart className="size-4 shrink-0 text-[#6941c6]" />
                  <span className="truncate">
                    BST: <strong className="text-slate-900">{lookbook.title}</strong>
                    {lookbook.season && <span className="ml-1 text-violet-700 font-medium">({lookbook.season})</span>}
                  </span>
                </div>
                {onClearLookbook && (
                  <button
                    type="button"
                    onClick={onClearLookbook}
                    className="ml-2 shrink-0 text-[11px] text-slate-500 hover:text-slate-800 underline"
                  >
                    Bỏ chọn
                  </button>
                )}
              </div>
            )}
            {products.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="size-full object-cover" /> : <div className={cn("grid size-full place-items-center bg-gradient-to-br text-slate-500", product.tint)}><Shirt className="size-6" /></div>}
                        {product.category && <span className="absolute bottom-1 right-1 rounded bg-slate-900/60 px-1 py-0.5 text-[8px] font-medium text-white backdrop-blur-xs">{product.category}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-400">Mã SKU: {product.sku}</p>
                        <div className="mt-1 flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{vnd(product.price)}</span>{product.inStock ? <Pill tone="green">Còn hàng</Pill> : <Pill tone="rose">Hết hàng</Pill>}</div>
                      </div>
                      <button type="button" aria-label={`Bỏ chọn ${product.name}`} onClick={() => upd({ productIds: form.productIds.filter((id) => id !== product.id) })} className="grid size-7 place-items-center self-start rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700"><X className="size-4" /></button>
                    </div>
                  ))}
                  </div>

                {productImages.length > 0 && (
                  <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {products.map((product) => {
                      const images = productImages.filter((item) => item.productId === product.id);
                      if (images.length === 0) return null;
                      const selectedCount = images.filter((item) => selectedProductImageIds.includes(item.id)).length;
                      return <div key={product.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                        <div className="mb-2 flex items-center justify-between gap-2"><p className="min-w-0 truncate text-xs font-semibold text-slate-700">Ảnh: {product.name}</p><span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200">{selectedCount}/{images.length} ảnh</span></div>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">{images.map((item) => {
                        const selected = selectedProductImageIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onToggleProductImage?.(item.id)}
                            className={cn(
                              "group relative aspect-[3/4] overflow-hidden rounded-lg border-2 bg-slate-100 transition",
                              selected ? "border-[#6941c6] ring-2 ring-violet-100" : "border-transparent hover:border-violet-200",
                            )}
                            title={`${selected ? "Bỏ chọn" : "Chọn"} ${item.name}`}
                          >
                            <MediaView item={item} />
                            <span className="absolute left-1.5 top-1.5"><Checkbox on={selected} /></span>
                            {selected && <span className="absolute inset-x-1 bottom-1 rounded bg-[#6941c6]/90 px-1 py-0.5 text-center text-[8px] font-semibold text-white">Trong bài viết</span>}
                          </button>
                        );
                        })}</div>
                      </div>;
                    })}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onPickProduct}
                className="w-full rounded-lg border border-dashed border-violet-300 bg-violet-50/40 p-4 text-center transition-colors hover:bg-violet-50"
              >
                <div className="flex flex-col items-center gap-1.5 text-xs text-[#6941c6] font-medium">
                  <Plus className="size-5" />
                  <span>Chọn sản phẩm từ danh mục kho ÉLANE hoặc BST</span>
                </div>
              </button>
            )}
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
              <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md">{media[0]?.kind === "image" ? <MediaView item={media[0]} /> : <Placeholder tint={firstProduct?.tint} />}</div>
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
            <Field label="Giọng văn / Phong cách"><select value={form.style} onChange={(e) => upd({ style: e.target.value })} className={inputCls}>{STYLES.map((s) => <option key={s}>{s}</option>)}</select></Field>
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
