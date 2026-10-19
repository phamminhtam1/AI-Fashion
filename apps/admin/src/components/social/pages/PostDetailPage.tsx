import { useState, type ComponentType, type ReactNode } from "react";
import {
  Activity, AlertTriangle, AlignLeft, ArrowLeft, BarChart3, Calendar, CalendarClock, CheckCircle2,
  ChevronDown, Clock, ExternalLink, Eye, FileText, Hash, Heart, Info, Link2, MessageSquare,
  MoreVertical, RefreshCw, Repeat, Send, Settings, Share2, ShoppingBag, Sparkles, User, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHANNEL_META } from "../mock";
import { ChannelLogo, Modal, card } from "../ui";
import type { PostItem } from "../useUpcomingPosts";
import { ACTIONS, MENUS, toState, type ActionId, type PostState } from "./postActions";

/* ═════════════════════════ Kiểu dữ liệu ═════════════════════════ */

type HistoryEvent = {
  at: string;
  by: string;
  title: string;
  desc?: string | undefined;
  kind: "content" | "review";
  waiting?: boolean | undefined;
  note?: string | undefined;
};

export type PostView = PostItem & {
  state?: PostState;
  format?: string;
  timeSub?: string;
  metrics?: { views: string; likes: string; comments: string };
  error?: string;
  // Các trường dưới đây là tuỳ chọn – chưa có thì dùng nội dung mẫu bên dưới.
  images?: string[];
  hashtags?: string[];
  cta?: { label: string; url: string };
  products?: { id: string; name: string; code: string; img: string }[];
  history?: HistoryEvent[];
  creator?: string;
  createdAt?: string;
  contentType?: string;
  note?: { text: string; updatedAt: string };
  forecast?: { reach: string; engagement: string; rate: string };
};

interface Props {
  post: PostView;
  onBack: () => void;
  /** key chính là ActionId (xem postActions.ts). */
  onAction?: (key: string, post: PostView) => void;
}

/* ═════════════════════════ Lịch sử thao tác ═════════════════════════ */

function buildRealHistory(item: PostView["item"], state: PostState): HistoryEvent[] {
  if (!item) return [];
  const events: HistoryEvent[] = [];
  const createdDate = item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Vừa xong";
  const creator = (item as any)?.creatorName || "ÉLANE Admin";
  const approver = (item as any)?.approvedByName || "Quản lý";

  events.push({
    at: createdDate,
    by: creator,
    title: item.source === "ai" ? "Tạo bởi AI Content" : "Đã tạo bài viết",
    desc: `Tạo bài viết với ${item.mediaUrls?.length || 0} hình ảnh/video.`,
    kind: "content",
  });

  if (state === "pending") {
    events.push({
      at: item.updatedAt ? new Date(item.updatedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : createdDate,
      by: creator,
      title: "Đã gửi yêu cầu duyệt",
      desc: "Bài viết đang chờ quản lý xem xét và phê duyệt.",
      kind: "review",
      waiting: true,
      note: item.lastError ? `Ghi chú trước đó: ${item.lastError}` : undefined,
    });
  }

  if (item.approvedAt || state === "approved" || state === "scheduled" || state === "published") {
    const approvedDate = item.approvedAt ? new Date(item.approvedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : createdDate;
    events.push({
      at: approvedDate,
      by: approver,
      title: "Đã phê duyệt nội dung",
      desc: item.scheduledAt ? `Đã duyệt và lên lịch đăng vào ${new Date(item.scheduledAt).toLocaleString("vi-VN")}.` : "Nội dung đạt chuẩn, sẵn sàng để xuất bản.",
      kind: "review",
    });
  }

  if (item.scheduledAt && (state === "scheduled" || state === "approved")) {
    const schedDate = new Date(item.scheduledAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
    events.push({
      at: schedDate,
      by: "Hệ thống tự động",
      title: "Lịch đăng tự động",
      desc: `Dự kiến xuất bản lên Instagram vào ${schedDate}.`,
      kind: "review",
      waiting: state === "scheduled",
    });
  }

  if (state === "published" || item.publishedAt) {
    const pubDate = item.publishedAt ? new Date(item.publishedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : createdDate;
    events.push({
      at: pubDate,
      by: "Hệ thống Instagram",
      title: "Đã đăng bài viết thành công",
      desc: item.externalPostId ? `ID bài viết Instagram: ${item.externalPostId}` : "Bài viết đã xuất bản công khai trên kênh Instagram.",
      kind: "review",
    });
  }

  if (state === "failed") {
    const failDate = item.updatedAt ? new Date(item.updatedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : createdDate;
    events.push({
      at: failDate,
      by: "Hệ thống",
      title: "Đăng bài thất bại",
      desc: item.lastError || "Không thể kết nối hoặc xuất bản lên Instagram API.",
      kind: "review",
      waiting: false,
      note: item.lastError || undefined,
    });
  }

  if (state === "draft" && item.lastError) {
    const changeDate = item.updatedAt ? new Date(item.updatedAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : createdDate;
    events.push({
      at: changeDate,
      by: approver,
      title: "Yêu cầu chỉnh sửa",
      desc: "Quản lý đã yêu cầu điều chỉnh lại nội dung trước khi duyệt lại.",
      kind: "review",
      waiting: false,
      note: item.lastError,
    });
  }

  return events;
}

const extractTags = (s?: string) => s?.match(/#[\p{L}\p{N}_]+/gu) ?? [];

const extractCta = (caption?: string): { label: string; url: string } | undefined => {
  if (!caption) return undefined;
  const lines = caption.split(/\n+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("👉") || trimmed.startsWith("🔗")) {
      const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
      const url = urlMatch ? urlMatch[0] : "https://elane.vn/san-pham";
      const rawLabel = trimmed.replace(urlMatch ? urlMatch[0] : "", "").replace(/^[👉🔗\s*-]+/, "").replace(/[-–—:]\s*$/, "").trim();
      const label = rawLabel || "Xem thêm sản phẩm";
      return { label: label.endsWith("→") ? label : `${label} →`, url };
    }
    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      const url = urlMatch[0];
      const rawLabel = trimmed.replace(url, "").replace(/^[👉🔗\s*-]+/, "").replace(/[-–—:]\s*$/, "").trim();
      const label = rawLabel || "Khám phá ngay";
      return { label: label.endsWith("→") ? label : `${label} →`, url };
    }
  }
  return undefined;
};

function extractProductsFromCaption(caption?: string, mediaUrls?: string[]): { id: string; name: string; code: string; img: string }[] {
  if (!caption) return [];
  const matches = [...caption.matchAll(/[“"]([^"”]+)[”"]/g)];
  if (!matches.length) return [];
  return matches.map((m, idx) => {
    const name = m[1].trim();
    const img = mediaUrls?.[idx] || mediaUrls?.[0] || "";
    return {
      id: `extracted-${idx + 1}`,
      name,
      code: `SP-${String(idx + 1).padStart(2, "0")}`,
      img,
    };
  });
}

const BADGE: Record<PostState, { label: string; icon: ComponentType<{ className?: string }>; cls: string }> = {
  draft: { label: "Bản nháp", icon: FileText, cls: "bg-slate-100 text-slate-600" },
  pending: { label: "Chờ duyệt", icon: Clock, cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Đã duyệt", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700" },
  scheduled: { label: "Đã lên lịch", icon: CalendarClock, cls: "bg-violet-100 text-violet-700" },
  published: { label: "Đã đăng", icon: CheckCircle2, cls: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Lỗi đăng", icon: AlertTriangle, cls: "bg-rose-100 text-rose-700" },
};

/** Nút chính trên header theo trạng thái (riêng trang chi tiết). */
const DETAIL_PRIMARY: Partial<Record<PostState, { id: ActionId; label: string; cls?: string }>> = {
  draft: { id: "send_review", label: "Gửi duyệt" },
  approved: { id: "publish_now", label: "Đăng ngay" },
  scheduled: { id: "reschedule", label: "Đổi lịch đăng" },
  published: { id: "view_original", label: "Xem bài gốc" },
  failed: { id: "retry", label: "Thử đăng lại", cls: "bg-rose-600 hover:bg-rose-700" },
};

/* ═════════════════════════ Thành phần nhỏ ═════════════════════════ */

function CardTitle({ icon: Icon, children, right }: { icon: ComponentType<{ className?: string }>; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold text-slate-900">
        <Icon className="size-5 text-slate-500" />
        {children}
      </h2>
      {right}
    </div>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="h-8 bg-white px-3 text-xs font-semibold text-slate-700">
      Chỉnh sửa
    </Button>
  );
}

function FieldLabel({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
      <Icon className="size-4 text-slate-500" />
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: ComponentType<{ className?: string }>; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3 py-2 text-sm">
      <span className="flex items-center gap-2.5 text-slate-600"><Icon className="size-4 text-slate-400" />{label}</span>
      <div className="min-w-0 font-medium text-slate-800">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-[#6941c6]" : "bg-slate-300")}
    >
      <span className={cn("absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
    </button>
  );
}

/* ═════════════════════════ Trang chi tiết ═════════════════════════ */

export function PostDetailPage({ post, onBack, onAction }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<"all" | "content" | "review">("all");
  const [crossPost, setCrossPost] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [aiAssist, setAiAssist] = useState(true);

  const state: PostState = post.state ?? toState(String(post.status));
  const badge = BADGE[state];
  const StatusIcon = badge.icon;
  const channelInfo = CHANNEL_META[post.channel];

  const images = (post.item?.mediaUrls && post.item.mediaUrls.length > 0)
    ? post.item.mediaUrls
    : post.images && post.images.length > 0
    ? post.images
    : post.thumb
    ? [post.thumb]
    : [];

  const rawCaption = post.caption || post.item?.caption || "";

  // 1. Nút kêu gọi hành động (CTA)
  const itemMeta = (post.item as any)?.metadata;
  const cta = post.cta
    ?? itemMeta?.cta
    ?? (rawCaption ? extractCta(rawCaption) : undefined);

  // 2. Sản phẩm được gắn thẻ
  const parsedProducts = extractProductsFromCaption(rawCaption, images);
  const products = (post.products && post.products.length > 0)
    ? post.products
    : (itemMeta?.products && itemMeta.products.length > 0)
    ? itemMeta.products
    : parsedProducts;

  // 3. Hashtag
  const extractedTags = extractTags(rawCaption);
  const tags = (post.hashtags && post.hashtags.length > 0)
    ? post.hashtags
    : (itemMeta?.hashtags && itemMeta.hashtags.length > 0)
    ? itemMeta.hashtags
    : extractedTags;

  // 4. Đoạn văn caption sạch (lọc bỏ các dòng chỉ chứa hashtag hoặc CTA để không bị trùng lặp)
  const rawParagraphs = rawCaption ? rawCaption.split(/\n+/).map((s) => s.trim()).filter(Boolean) : [];
  const cleanParagraphs = rawParagraphs.filter((line) => {
    if (line.startsWith("👉") || line.startsWith("🔗")) return false;
    if (line.startsWith("#") && line.split(/\s+/).every((w) => w.startsWith("#"))) return false;
    return true;
  });
  const paragraphs = cleanParagraphs.length > 0
    ? cleanParagraphs
    : rawParagraphs.length > 0
    ? rawParagraphs
    : [post.title || "Chưa có nội dung bài viết"];

  const history = (post.history ?? buildRealHistory(post.item, state)).filter((e) => historyFilter === "all" || e.kind === historyFilter);

  const realViews = Number((post.item as any)?.views || 0);
  const realLikes = Number((post.item as any)?.likes || 0);
  const realComments = Number((post.item as any)?.comments || 0);
  const realShares = Number((post.item as any)?.shares || 0);
  const realEngagement = realLikes + realComments + realShares;
  const realRate = realViews > 0 ? `${((realEngagement / realViews) * 100).toFixed(1)}%` : "0%";

  const isPublished = state === "published";
  const forecast = isPublished
    ? { reach: String(realViews), engagement: String(realEngagement), rate: realRate }
    : (post.forecast ?? { reach: "Chưa có", engagement: "Chưa có", rate: "—" });

  const creator = (post.item as any)?.creatorName || post.creator || "ÉLANE Admin";
  const createdDate = post.item?.createdAt ? new Date(post.item.createdAt).toLocaleString("vi-VN") : post.createdAt || "—";
  const scheduledDate = post.item?.scheduledAt ? new Date(post.item.scheduledAt).toLocaleString("vi-VN") : post.time || "Chưa đặt lịch";

  const note = post.item?.lastError
    ? { text: `Ghi chú / Lỗi: ${post.item.lastError}`, updatedAt: post.item?.updatedAt ? new Date(post.item.updatedAt).toLocaleString("vi-VN") : "Vừa xong" }
    : post.note ?? { text: "Nội dung bài viết được quản lý trực tiếp trong hệ thống ÉLANE Social Hub.", updatedAt: createdDate };

  const showBrandOverlay = false;
  const extraImages = Math.max(0, images.length - 4);

  /** Gửi hành động lên trang cha. */
  const fire = (key: ActionId) => (onAction ? onAction(key, post) : toast.info(`${ACTIONS[key].label} sẽ được bổ sung`));
  const run = (key: ActionId) => {
    switch (key) {
      case "preview":
        return setShowPreviewModal(true);
      case "view_original":
        return post.permalink ? void window.open(post.permalink, "_blank", "noreferrer") : toast.info("Bài viết chưa có liên kết gốc");
      case "view_error":
        return toast.error(post.error ?? post.item?.lastError ?? "Không có thông tin lỗi chi tiết");
      case "delete":
        return fire("delete");
      default:
        return fire(key);
    }
  };

  const primary = DETAIL_PRIMARY[state];
  const PrimaryIcon = primary ? ACTIONS[primary.id].icon : Send;
  const menuIds = MENUS[state];

  return (
    <div className="space-y-5 pb-12 text-slate-900">
      {/* ───────── HEADER ───────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label="Quay lại danh sách"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chi tiết bài viết</h1>
            <p className="mt-0.5 text-sm text-slate-500">Xem chi tiết nội dung, lịch đăng và lịch sử phê duyệt của bài viết.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", badge.cls)}>
            <StatusIcon className="size-3.5" />
            {badge.label}
          </span>

          <Button variant="outline" onClick={() => setShowPreviewModal(true)} className="h-10 gap-2 bg-white px-4 text-sm font-medium text-slate-800">
            <Eye className="size-4" />
            Xem preview
          </Button>

          {state === "pending" ? (
            <div className="relative inline-flex h-10 items-stretch rounded-lg bg-[#6941c6]">
              <button
                type="button"
                onClick={() => run("approve_publish")}
                className="flex items-center gap-2 rounded-l-lg px-4 text-sm font-medium text-white hover:bg-[#5b36b0]"
              >
                <Send className="size-4" />
                Duyệt & đăng
              </button>
              <div className="my-2 w-px bg-white/25" />
              <button
                type="button"
                onClick={() => setPrimaryOpen((v) => !v)}
                className="rounded-r-lg px-3 text-white hover:bg-[#5b36b0]"
                aria-label="Tùy chọn phê duyệt"
                aria-expanded={primaryOpen}
              >
                <ChevronDown className="size-4" />
              </button>

              {primaryOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setPrimaryOpen(false)} />
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-sm shadow-xl">
                    <button type="button" onClick={() => { setPrimaryOpen(false); run("approve"); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50">
                      <CheckCircle2 className="size-4 text-emerald-500" />
                      Chỉ phê duyệt (chưa đăng)
                    </button>
                    <button type="button" onClick={() => { setPrimaryOpen(false); run("schedule"); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-50">
                      <CalendarClock className="size-4 text-[#6941c6]" />
                      Duyệt & lên lịch đăng
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : primary ? (
            <Button onClick={() => run(primary.id)} className={cn("h-10 gap-2 bg-[#6941c6] px-4 text-sm font-medium hover:bg-[#5b36b0]", primary.cls)}>
              {primary.id === "retry" ? <RefreshCw className="size-4" /> : <PrimaryIcon className="size-4" />}
              {primary.label}
            </Button>
          ) : null}

          {/* Menu ba chấm theo trạng thái */}
          <div className="relative">
            <Button variant="outline" onClick={() => setMenuOpen((v) => !v)} className="size-10 bg-white p-0 text-slate-700" aria-label="Thao tác khác" aria-expanded={menuOpen}>
              <MoreVertical className="size-4" />
            </Button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-sm shadow-xl">
                  {menuIds.map((id, i) => {
                    const a = ACTIONS[id];
                    const Icon = a.icon;
                    const prevId = i > 0 ? menuIds[i - 1] : undefined;
                    return (
                      <div key={id}>
                        {a.danger && prevId && !ACTIONS[prevId]?.danger && <div className="my-1.5 border-t border-slate-100" />}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { setMenuOpen(false); run(id); }}
                          className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", a.danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-800 hover:bg-slate-50")}
                        >
                          <Icon className="size-4 shrink-0" />
                          {a.label}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ───────── LƯỚI 2 CỘT ───────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ===== Cột trái ===== */}
        <div className="space-y-5">
          {/* Nội dung bài viết */}
          <section className={cn(card, "p-5")}>
            <CardTitle icon={FileText}>Nội dung bài viết</CardTitle>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Thư viện ảnh */}
              <div className="flex gap-2.5 self-start">
                <div className="relative aspect-[3/4] flex-1 overflow-hidden rounded-xl bg-stone-100">
                  {images.length > 0 ? (
                    <img src={images[activeImg] ?? images[0]} alt={post.title} className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-sm text-slate-400">Chưa có hình ảnh</div>
                  )}
                  {showBrandOverlay && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/65 via-black/15 to-black/20 p-5 font-serif text-white">
                      <p className="text-xs font-sans font-semibold tracking-[0.35em] text-white/90">É L A N E</p>
                      <div>
                        <p className="text-[10px] font-sans tracking-[0.3em] uppercase text-white/80">Bộ sưu tập</p>
                        <p className="mt-1 text-3xl font-serif italic leading-[1.05]">Thu Đông<br />2024</p>
                        <p className="mt-3 text-[9px] font-sans uppercase leading-4 tracking-[0.2em] text-white/85">Thanh lịch trong<br />từng khoảnh khắc</p>
                      </div>
                    </div>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="flex w-[124px] shrink-0 flex-col gap-2.5">
                    {images.slice(1, 4).map((img, idx) => {
                      const isLast = idx === 2 && extraImages > 0;
                      return (
                        <button
                          key={img + idx}
                          type="button"
                          onClick={() => setActiveImg(idx + 1)}
                          className={cn("relative min-h-0 flex-1 overflow-hidden rounded-lg bg-slate-100 transition hover:opacity-90", activeImg === idx + 1 && "ring-2 ring-[#6941c6]")}
                        >
                          <img src={img} alt="" className="size-full object-cover" />
                          {isLast && <span className="absolute inset-0 grid place-items-center bg-black/55 text-lg font-semibold text-white">+{extraImages}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Caption, hashtag, CTA, sản phẩm */}
              <div className="min-w-0 space-y-4">
                <div>
                  <FieldLabel icon={FileText}>Nội dung caption</FieldLabel>
                  <div className="mt-2 max-h-56 space-y-2.5 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>

                <div>
                  <FieldLabel icon={Hash}>Hashtag</FieldLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.length ? tags.map((tag: string) => (
                      <span key={tag} className="rounded-full border border-violet-100/70 bg-violet-50 px-3 py-1 text-xs font-medium text-[#6941c6]">{tag}</span>
                    )) : <span className="text-xs text-slate-400">Chưa có hashtag</span>}
                  </div>
                </div>

                {cta && (
                  <div>
                    <FieldLabel icon={Link2}>Nút kêu gọi hành động (CTA)</FieldLabel>
                    <a
                      href={cta.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-[#f8f6fc] p-3.5 transition hover:bg-violet-100/70 hover:border-violet-200"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{cta.label}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 font-normal">{cta.url}</p>
                      </div>
                      <ExternalLink className="size-4 shrink-0 text-[#6941c6]" />
                    </a>
                  </div>
                )}

                {products.length > 0 && (
                  <div>
                    <FieldLabel icon={ShoppingBag}>Sản phẩm được gắn thẻ ({products.length})</FieldLabel>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {products.map((prod: { id: string; name: string; code: string; img: string }) => (
                        <div key={prod.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/80 p-2 transition hover:border-violet-200 hover:bg-violet-50/30">
                          <img src={prod.img} alt={prod.name} className="size-11 shrink-0 rounded-lg object-cover bg-white border border-slate-100" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-800" title={prod.name}>{prod.name}</p>
                            <p className="mt-0.5 text-[11px] font-mono text-slate-400">{prod.code}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Lịch sử phê duyệt */}
          <section className={cn(card, "p-5")}>
            <CardTitle
              icon={Clock}
              right={
                <label className="relative inline-flex items-center">
                  <select
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value as typeof historyFilter)}
                    className="h-10 appearance-none rounded-lg border border-slate-200 bg-white pl-3.5 pr-9 text-sm text-slate-700 outline-none hover:bg-slate-50"
                  >
                    <option value="all">Tất cả hoạt động</option>
                    <option value="content">Nội dung</option>
                    <option value="review">Phê duyệt & đăng</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 size-4 text-slate-500" />
                </label>
              }
            >
              Lịch sử phê duyệt
            </CardTitle>

            <div className="relative mt-5">
              <span className="absolute bottom-3 left-[5px] top-3 w-px bg-slate-200" />
              <span className="absolute bottom-3 left-[163px] top-3 w-px bg-slate-200" />
              <ul className="space-y-5">
                {history.map((ev, i) => (
                  <li key={i} className="grid grid-cols-[148px_30px_minmax(0,1fr)] items-start">
                    <div className="relative pl-6 text-xs">
                      <span className="absolute left-0 top-1 z-10 size-2.5 rounded-full bg-slate-300 ring-2 ring-white" />
                      <p className="text-slate-600">{ev.at}</p>
                      <p className="mt-0.5 text-slate-500">{ev.by}</p>
                    </div>
                    <div className="flex justify-center">
                      <span className={cn("relative z-10 mt-0.5 size-3.5 rounded-full ring-2 ring-white", ev.waiting ? "bg-amber-400" : "bg-[#6941c6]")} />
                    </div>
                    <div className={cn("min-w-0", ev.note && "flex items-start gap-4")}>
                      <div className={cn(ev.note && "shrink-0")}>
                        <p className="text-sm font-semibold text-slate-900">{ev.title}</p>
                        {ev.desc && <p className="mt-0.5 text-xs text-slate-500">{ev.desc}</p>}
                      </div>
                      {ev.note && (
                        <p className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{ev.note}</p>
                      )}
                    </div>
                  </li>
                ))}
                {!history.length && <li className="py-4 text-center text-sm text-slate-400">Không có hoạt động nào.</li>}
              </ul>
            </div>
          </section>
        </div>

        {/* ===== Cột phải ===== */}
        <div className="space-y-5">
          {/* Thông tin bài viết */}
          <section className={cn(card, "p-5")}>
            <CardTitle icon={FileText}>Thông tin bài viết</CardTitle>
            <div className="mt-3">
              <InfoRow icon={Share2} label="Kênh">
                <span className="flex items-center gap-2"><ChannelLogo id={post.channel} size="xs" />{channelInfo?.name ?? post.channel}</span>
              </InfoRow>
              <InfoRow icon={Activity} label="Trạng thái">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", badge.cls)}>
                  <StatusIcon className="size-3.5" />
                  {badge.label}
                </span>
              </InfoRow>
              <InfoRow icon={Calendar} label="Ngày tạo">{createdDate}</InfoRow>
              <InfoRow icon={User} label="Người tạo">{creator}</InfoRow>
              <InfoRow icon={CalendarClock} label="Lịch đăng">{scheduledDate}</InfoRow>
              <InfoRow icon={AlignLeft} label="Loại nội dung">{post.item?.mediaType === "REELS" ? "Video Reels" : "Bài viết • Hình ảnh"}</InfoRow>
            </div>
          </section>

          {/* Thiết lập đăng */}
          <section className={cn(card, "p-5")}>
            <CardTitle icon={Settings} right={<EditButton onClick={() => toast.info("Mở cài đặt thiết lập đăng")} />}>Thiết lập đăng</CardTitle>
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-[170px_minmax(0,1fr)_auto] items-center gap-3">
                <span className="flex items-center gap-2.5 text-slate-700"><Repeat className="size-4 text-slate-400" />Đăng chéo nền tảng</span>
                <span className="flex items-center gap-2 text-slate-600">
                  <ChannelLogo id="facebook" size="xs" />
                  <ChannelLogo id="tiktok" size="xs" />
                  Facebook, TikTok
                </span>
                <Toggle checked={crossPost} onChange={setCrossPost} label="Đăng chéo nền tảng" />
              </div>
              <div className="grid grid-cols-[170px_minmax(0,1fr)_auto] items-center gap-3">
                <span className="flex items-center gap-2.5 text-slate-700"><MessageSquare className="size-4 text-slate-400" />Tự động trả lời bình luận</span>
                <span className="text-slate-600">Bật (theo mẫu AI)</span>
                <Toggle checked={autoReply} onChange={setAutoReply} label="Tự động trả lời bình luận" />
              </div>
              <div className="grid grid-cols-[170px_minmax(0,1fr)_auto] items-center gap-3">
                <span className="flex items-center gap-2.5 text-slate-700"><Sparkles className="size-4 text-[#6941c6]" />Hỗ trợ bởi AI</span>
                <span className="text-slate-600">Tối ưu caption, hashtag</span>
                <Toggle checked={aiAssist} onChange={setAiAssist} label="Hỗ trợ bởi AI" />
              </div>
            </div>
          </section>

          {/* Hiệu quả dự kiến / thực tế */}
          <section className={cn(card, "p-5")}>
            <CardTitle
              icon={BarChart3}
              right={<span className="flex items-center gap-1.5 text-xs text-slate-500"><Info className="size-3.5" />{isPublished ? "Số liệu thực tế từ Instagram" : "Dựa trên dữ liệu các bài tương tự"}</span>}
            >
              {isPublished ? "Hiệu quả bài viết" : "Hiệu quả dự kiến"}
            </CardTitle>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: Eye, color: "text-[#6941c6]", value: forecast.reach, label: isPublished ? "Lượt tiếp cận" : "Lượt tiếp cận ước tính" },
                { icon: Users, color: "text-[#6941c6]", value: forecast.engagement, label: isPublished ? "Tổng tương tác" : "Lượt tương tác ước tính" },
                { icon: Heart, color: "text-rose-500", value: forecast.rate, label: "Tỷ lệ tương tác" },
              ].map((k) => (
                <div key={k.label} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <k.icon className={cn("size-5 shrink-0", k.color)} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{k.value}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{k.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Ghi chú nội bộ */}
          <section className={cn(card, "p-5")}>
            <CardTitle icon={FileText} right={<EditButton onClick={() => toast.info("Chỉnh sửa ghi chú nội bộ")} />}>Ghi chú nội bộ</CardTitle>
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{note.text}</div>
            <p className="mt-3 text-xs text-slate-400">Cập nhật lần cuối: {note.updatedAt}</p>
          </section>
        </div>
      </div>

      {/* ───────── MODAL XEM PREVIEW ───────── */}
      {showPreviewModal && (
        <Modal open={showPreviewModal} onClose={() => setShowPreviewModal(false)} maxW="max-w-md">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ChannelLogo id={post.channel} size="sm" />
                <h3 className="text-sm font-bold text-slate-900">Xem preview trên {channelInfo?.name}</h3>
              </div>
              <button type="button" onClick={() => setShowPreviewModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Đóng">
                <X className="size-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-slate-100 p-3">
                <div className="size-8 rounded-full bg-slate-900 text-center font-serif text-[10px] font-bold leading-8 text-white">É</div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">elane.official</p>
                  <p className="text-[10px] text-slate-400">{channelInfo?.name}</p>
                </div>
              </div>

              <div className="aspect-square bg-slate-100">
                {images[activeImg] && <img src={images[activeImg]} alt="" className="size-full object-cover" />}
              </div>

              <div className="p-3 text-xs text-slate-800">
                <p className="font-semibold text-slate-900">{post.title}</p>
                <p className="mt-1 line-clamp-3 text-slate-600">{paragraphs[0]}</p>
                {tags.length > 0 && <p className="mt-2 text-[11px] font-medium text-[#6941c6]">{tags.slice(0, 3).join(" ")}</p>}
              </div>
            </div>

            <Button onClick={() => setShowPreviewModal(false)} className="w-full bg-[#6941c6] text-xs font-semibold hover:bg-[#5b36b0]">
              Đóng xem trước
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
