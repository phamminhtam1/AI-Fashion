import { useEffect, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Activity, AlertTriangle, AlignLeft, ArrowLeft, BarChart3, Bookmark, Calendar, CalendarClock, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, ExternalLink, Eye, FileText, Hash, Heart, Info, Link2, MessageCircle, MessageSquareText,
  Loader2, MoreVertical, RefreshCw, Repeat, Send, Settings, Share2, ShoppingBag, Sparkles, TrendingUp, User, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CHANNEL_META } from "../mock";
import { ChannelLogo, Modal } from "../ui";
import type { PostItem } from "../useUpcomingPosts";
import { ACTIONS, MENUS, toState, type ActionId, type PostState } from "./postActions";

/* ═════════════════════════ Design tokens (đo trực tiếp từ design) ═════════════════════════ */

/** Tím thương hiệu của nút chính / hashtag / link. */
const BRAND = "#512ebb";
const BRAND_HOVER = "#4526a3";
/** Tím của toggle + chấm timeline. */
const ACCENT = "#5f23c8";

/** Khung card: nền trắng, viền 1px rất nhạt, bo 12px, bóng gần như không thấy. */
const panel = "rounded-xl border border-[#eceef4] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
/** Padding trong card: 18px hai bên, 16px trên, 18px dưới. */
const panelPad = "px-[18px] pt-4 pb-[18px]";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

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
  actionLoading?: boolean;
  /** key chính là ActionId (xem postActions.ts). */
  onAction?: (key: string, post: PostView) => void;
}

/* ═════════════════════════ Định dạng ngày giờ: dd/MM/yyyy HH:mm ═════════════════════════ */

const pad2 = (n: number) => String(n).padStart(2, "0");

function fmtDateTime(v?: string | number | Date | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/* ═════════════════════════ Lịch sử thao tác ═════════════════════════ */

function buildRealHistory(item: PostView["item"], state: PostState): HistoryEvent[] {
  if (!item) return [];
  const events: HistoryEvent[] = [];
  const createdDate = fmtDateTime(item.createdAt) || "Vừa xong";
  const updatedDate = fmtDateTime(item.updatedAt) || createdDate;
  const creator = (item as any)?.creatorName || "ÉLANE Admin";
  const approver = (item as any)?.approvedByName || "Quản lý";

  events.push({
    at: createdDate,
    by: creator,
    title: item.source === "ai" ? "Tạo bởi AI Content" : "Đã tạo bài viết",
    desc: `Tạo bài viết mới với ${item.mediaUrls?.length || 0} hình ảnh.`,
    kind: "content",
  });

  if (state === "pending") {
    events.push({
      at: updatedDate,
      by: creator,
      title: "Đã gửi duyệt",
      desc: "Gửi bài viết để quản lý phê duyệt.",
      kind: "review",
    });
    events.push({
      at: updatedDate,
      by: approver,
      title: "Đang chờ duyệt",
      kind: "review",
      waiting: true,
      note: item.lastError || undefined,
    });
  }

  if (item.approvedAt || state === "approved" || state === "scheduled" || state === "published") {
    const approvedDate = fmtDateTime(item.approvedAt) || createdDate;
    events.push({
      at: approvedDate,
      by: approver,
      title: "Đã phê duyệt nội dung",
      desc: item.scheduledAt ? `Đã duyệt và lên lịch đăng vào ${fmtDateTime(item.scheduledAt)}.` : "Nội dung đạt chuẩn, sẵn sàng để xuất bản.",
      kind: "review",
    });
  }

  if (item.scheduledAt && (state === "scheduled" || state === "approved")) {
    const schedDate = fmtDateTime(item.scheduledAt);
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
    const pubDate = fmtDateTime(item.publishedAt) || createdDate;
    events.push({
      at: pubDate,
      by: "Hệ thống Instagram",
      title: "Đã đăng bài viết thành công",
      desc: item.externalPostId ? `ID bài viết Instagram: ${item.externalPostId}` : "Bài viết đã xuất bản công khai trên kênh Instagram.",
      kind: "review",
    });
  }

  if (state === "failed") {
    events.push({
      at: updatedDate,
      by: "Hệ thống",
      title: "Đăng bài thất bại",
      desc: item.lastError || "Không thể kết nối hoặc xuất bản lên Instagram API.",
      kind: "review",
      waiting: false,
      note: item.lastError || undefined,
    });
  }

  if (state === "draft" && item.lastError) {
    events.push({
      at: updatedDate,
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
    const name = m[1]?.trim() || "";
    const img = mediaUrls?.[idx] || mediaUrls?.[0] || "";
    return {
      id: `extracted-${idx + 1}`,
      name,
      code: `SP-${String(idx + 1).padStart(2, "0")}`,
      img,
    };
  });
}

const BADGE: Record<PostState, { label: string; icon: IconType; cls: string; iconCls?: string }> = {
  draft: { label: "Bản nháp", icon: FileText, cls: "bg-slate-100 text-slate-600" },
  pending: { label: "Chờ duyệt", icon: Clock, cls: "bg-[#fef3d4] text-[#7e3b01]", iconCls: "text-[#e19629]" },
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

/**
 * Nhóm của từng mục trong menu ba chấm – đổi nhóm thì có đường kẻ ngăn cách:
 * 0 = thao tác thường · 1 = xem (lịch sử / lỗi / insight…) · 2 = huỷ lịch · 3 = nguy hiểm (xoá).
 * Nếu id trong postActions.ts của bạn đặt khác (vd. "cancel_schedule") thì sửa lại ở đây.
 */
const menuGroup = (id: ActionId): number => {
  if (ACTIONS[id]?.danger) return 3;
  if (id.startsWith("view_")) return 1;
  if (id.includes("cancel")) return 2;
  return 0;
};

/* ═════════════════════════ Thành phần nhỏ ═════════════════════════ */

function CardTitle({ icon: Icon, children, right }: { icon: IconType; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[#0b0c24]">
        <Icon className="size-5 text-[#0b0c24]" strokeWidth={1.75} />
        {children}
      </h2>
      {right}
    </div>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="h-7 rounded-lg border-[#e3e5ec] bg-white px-3 text-xs font-medium text-[#0b0c24] shadow-none">
      Chỉnh sửa
    </Button>
  );
}

function FieldLabel({ icon: Icon, children }: { icon: IconType; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold leading-4 text-[#0b0c24]">
      <Icon className="size-4 text-[#23253f]" strokeWidth={1.75} />
      {children}
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: IconType; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[148px_minmax(0,1fr)] items-center gap-3 py-[7px] text-[13px]">
      <span className="flex items-center gap-3 text-[#2a2d45]">
        <Icon className="size-[18px] shrink-0 text-[#2a2d45]" strokeWidth={1.6} />
        {label}
      </span>
      <div className="min-w-0 font-medium text-[#0b0c24]">{children}</div>
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
      style={checked ? { backgroundColor: ACCENT } : undefined}
      className={cn("relative h-5 w-[34px] shrink-0 rounded-full transition-colors", !checked && "bg-slate-300")}
    >
      <span className={cn("absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform", checked && "translate-x-[14px]")} />
    </button>
  );
}

/** Ô số liệu (dự kiến + thực tế): nền xám nhạt, icon màu không có khung, số 15px. */
function MetricTile({ icon: Icon, iconCls, value, label }: { icon: IconType; iconCls: string; value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-auto items-center gap-3 rounded-xl bg-[#f4f5f9] px-3.5 py-3">
      <Icon className={cn("size-6 shrink-0", iconCls)} strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-5 text-[#0b0c24]">{value}</p>
        <p className="truncate text-[11px] leading-4 text-[#5a5e75]">{label}</p>
      </div>
    </div>
  );
}

/* ═════════════════════════ Trang chi tiết ═════════════════════════ */

export function PostDetailPage({ post, onBack, onAction, actionLoading = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
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
  const permalink = post.permalink || (post.item as any)?.permalink || null;

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

  const isPublished = state === "published";

  const [syncingMetrics, setSyncingMetrics] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState<{
    reach: number;
    impressions: number;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
    lastSyncedAt: string | null;
  }>(() => {
    const it = post.item as any;
    const views = Number(it?.views || 0);
    return {
      reach: Number(it?.reach ?? views),
      impressions: Number(it?.impressions ?? views),
      likes: Number(it?.likes ?? 0),
      comments: Number(it?.comments ?? 0),
      saves: Number(it?.saves ?? 0),
      shares: Number(it?.shares ?? 0),
      lastSyncedAt: it?.lastSyncedAt || null,
    };
  });

  const handleSyncMetrics = async () => {
    if (!isPublished) {
      toast.info("Bài viết chưa xuất bản lên Instagram nên chưa thể đồng bộ chỉ số.");
      return;
    }
    if (!post.item?.externalPostId) {
      toast.error("Không tìm thấy ID bài viết Meta tương ứng để đồng bộ.");
      return;
    }
    setSyncingMetrics(true);
    try {
      const res = await adminApi.syncPostMetrics(post.id);
      if (res.data) {
        setLiveMetrics({
          reach: res.data.reach,
          impressions: res.data.impressions,
          likes: res.data.likes,
          comments: res.data.comments,
          saves: res.data.saves,
          shares: res.data.shares,
          lastSyncedAt: res.data.lastSyncedAt,
        });
        toast.success("Đã đồng bộ chỉ số mới nhất từ Instagram!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đồng bộ chỉ số thất bại");
    } finally {
      setSyncingMetrics(false);
    }
  };

  const totalInteractions = liveMetrics.likes + liveMetrics.comments + liveMetrics.saves + liveMetrics.shares;
  const baseDenominator = liveMetrics.reach || liveMetrics.impressions || (isPublished ? 0 : 1000);
  const liveEngagementRate = baseDenominator > 0
    ? `${((totalInteractions / baseDenominator) * 100).toFixed(1)}%`
    : "0.0%";

  const creator = (post.item as any)?.creatorName || post.creator || "ÉLANE Admin";
  const createdDate = fmtDateTime(post.item?.createdAt) || post.createdAt || "—";
  const scheduledDate = fmtDateTime(post.item?.scheduledAt) || post.time || "Chưa đặt lịch";

  const contentTypeLabel = post.contentType
    ?? itemMeta?.contentType
    ?? (post.item?.mediaType === "REELS"
      ? "Video Reels"
      : (post.item?.mediaUrls?.length ?? 0) > 1 || post.item?.mediaType === "CAROUSEL"
        ? `Album Carousel (${post.item?.mediaUrls?.length ?? 0} media)`
        : "Bài viết • Hình ảnh");

  const note = post.item?.lastError
    ? { text: `Ghi chú / Lỗi: ${post.item.lastError}`, updatedAt: fmtDateTime(post.item?.updatedAt) || "Vừa xong" }
    : post.note ?? { text: "Nội dung bài viết được quản lý trực tiếp trong hệ thống ÉLANE Social Hub.", updatedAt: createdDate };
  const noteEditor = (post.item as any)?.updatedByName || creator;

  const forecast = {
    reach: post.forecast?.reach ?? "8.2K – 12K",
    engagement: post.forecast?.engagement ?? "350 – 650",
    rate: post.forecast?.rate ?? "3% – 6%",
  };

  const showBrandOverlay = false;
  // Ảnh thứ 4 trở đi gộp vào ô "+N" ở thumbnail cuối (5 ảnh → "+2").
  const extraImages = images.length > 4 ? images.length - 3 : 0;

  /** Gửi hành động lên trang cha. */
  const fire = (key: ActionId) => {
    if (actionLoading) return;
    return onAction ? onAction(key, post) : toast.info(`${ACTIONS[key].label} sẽ được bổ sung`);
  };
  const run = (key: ActionId) => {
    switch (key) {
      case "preview":
        return setShowPreviewModal(true);
      case "view_original":
        return permalink ? void window.open(permalink, "_blank", "noreferrer") : toast.info("Bài viết chưa có liên kết gốc");
      case "view_insights":
        if (isPublished) {
          handleSyncMetrics();
          const el = document.getElementById("post-metrics-section");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        return toast.info("Bài viết chưa xuất bản nên chưa có chỉ số tương tác");
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

  useEffect(() => {
    if (!menuPos) return;
    const close = () => setMenuPos(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuPos]);

  const toggleMenu = (event: MouseEvent<HTMLButtonElement>) => {
    if (menuPos) return setMenuPos(null);
    const rect = event.currentTarget.getBoundingClientRect();
    // Menu căn mép phải theo mép phải của vùng nội dung (như design), không theo nút ba chấm.
    const rightEdge = rootRef.current?.getBoundingClientRect().right ?? rect.right;
    const menuWidth = 176;
    const breaks = menuIds.filter((id, i) => i > 0 && menuGroup(menuIds[i - 1] as ActionId) !== menuGroup(id)).length;
    const menuHeight = menuIds.length * 36 + breaks * 9 + 12;
    const gap = 6;
    const viewportPadding = 8;
    const top = rect.bottom + gap + menuHeight > window.innerHeight
      ? Math.max(viewportPadding, rect.top - gap - menuHeight)
      : rect.bottom + gap;
    const left = Math.min(
      window.innerWidth - menuWidth - viewportPadding,
      Math.max(viewportPadding, rightEdge - menuWidth),
    );
    setMenuPos({ top, left });
  };

  const settingRowLabel = "flex items-center gap-3 text-[13px] text-[#23253f]";
  const settingRowValue = "text-[13px] text-[#4a4e66]";

  return (
    <div ref={rootRef} className="space-y-5 pb-12 text-[#0b0c24]">
      {actionLoading && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/25 p-4 backdrop-blur-[2px]" role="status" aria-live="polite"><div className="flex w-full max-w-xs flex-col items-center rounded-2xl border border-white/70 bg-white px-6 py-5 text-center shadow-2xl"><span className="grid size-12 place-items-center rounded-full bg-violet-100 text-[#512ebb]"><Loader2 className="size-6 animate-spin" /></span><p className="mt-3 text-sm font-semibold text-slate-900">Đang xử lý bài viết…</p><p className="mt-1 text-xs leading-5 text-slate-500">Đang gửi yêu cầu lên nền tảng. Vui lòng chờ.</p></div></div>}

      {/* ───────── HEADER ───────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pr-[15px]">
        <div className="flex items-start gap-[22px]">
          <button
            type="button"
            onClick={onBack}
            className="grid size-[42px] shrink-0 place-items-center rounded-lg border border-[#e3e5ec] bg-white text-[#0b0c24] transition hover:bg-slate-50"
            aria-label="Quay lại danh sách"
          >
            <ArrowLeft className="size-[18px]" strokeWidth={1.75} />
          </button>
          <div>
            <h1 className="text-2xl font-bold leading-8 tracking-tight text-black">Chi tiết bài viết</h1>
            <p className="mt-0.5 text-[13px] text-slate-600">Xem chi tiết nội dung, lịch đăng và lịch sử phê duyệt của bài viết.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3.5">
          <span className={cn("mr-[11px] inline-flex h-[30px] items-center gap-1.5 rounded-full px-[13px] text-xs font-semibold", badge.cls)}>
            <StatusIcon className={cn("size-4", badge.iconCls)} strokeWidth={1.75} />
            {badge.label}
          </span>

          <Button variant="outline" onClick={() => setShowPreviewModal(true)} className="h-10 gap-[11px] rounded-lg border-[#e3e5ec] bg-white px-[22px] text-sm font-medium text-[#0b0c24] shadow-none">
            <Eye className="size-[18px]" strokeWidth={1.75} />
            Xem preview
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              const shareUrl = permalink || (typeof window !== "undefined" ? `${window.location.origin}/kenhbanhang/baiviet/chitiet/${encodeURIComponent(post.id)}` : "");
              if (shareUrl) {
                navigator.clipboard.writeText(shareUrl);
                toast.success(permalink ? "Đã sao chép liên kết bài viết công khai!" : "Đã sao chép liên kết chi tiết bài viết!");
              }
            }}
            className="h-10 gap-2 rounded-lg border-[#e3e5ec] bg-white px-4 text-sm font-medium text-[#0b0c24] shadow-none hover:bg-slate-50"
            title="Sao chép liên kết bài viết"
          >
            <Copy className="size-4 text-slate-600" strokeWidth={1.75} />
            <span className="hidden sm:inline">Sao chép link</span>
          </Button>

          {state === "pending" ? (
            <div className="relative inline-flex h-10 items-stretch rounded-lg" style={{ backgroundColor: BRAND }}>
              <button
                type="button"
                onClick={() => run("approve_publish")}
                style={{ ["--hv" as string]: BRAND_HOVER }}
                className="flex items-center gap-[11px] rounded-l-lg pl-[22px] pr-2.5 text-sm font-medium text-white hover:bg-[var(--hv)]"
              >
                <Send className="size-[18px]" strokeWidth={1.75} />
                Duyệt & đăng
              </button>
              <button
                type="button"
                onClick={() => setPrimaryOpen((v) => !v)}
                style={{ ["--hv" as string]: BRAND_HOVER }}
                className="rounded-r-lg pl-2.5 pr-[22px] text-white hover:bg-[var(--hv)]"
                aria-label="Tùy chọn phê duyệt"
                aria-expanded={primaryOpen}
              >
                <ChevronDown className="size-4" />
              </button>

              {primaryOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setPrimaryOpen(false)} />
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-72 overflow-hidden rounded-xl border border-[#eceef4] bg-white py-1.5 shadow-[0_10px_30px_-6px_rgba(16,24,40,0.18)]">
                    <button type="button" onClick={() => { setPrimaryOpen(false); run("approve"); }} className="flex h-9 w-full items-center gap-[11px] whitespace-nowrap px-4 text-[13px] text-[#23253f] hover:bg-slate-50">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-500" strokeWidth={1.75} />
                      Chỉ phê duyệt (chưa đăng)
                    </button>
                    <button type="button" onClick={() => { setPrimaryOpen(false); run("schedule"); }} className="flex h-9 w-full items-center gap-[11px] whitespace-nowrap px-4 text-[13px] text-[#23253f] hover:bg-slate-50">
                      <CalendarClock className="size-4 shrink-0" style={{ color: BRAND }} strokeWidth={1.75} />
                      Duyệt & lên lịch đăng
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : primary ? (
            <Button
              onClick={() => run(primary.id)}
              style={primary.cls ? undefined : { backgroundColor: BRAND }}
              className={cn("h-10 gap-[11px] rounded-lg px-[22px] text-sm font-medium hover:opacity-90", primary.cls)}
            >
              {primary.id === "retry" ? <RefreshCw className="size-[18px]" strokeWidth={1.75} /> : <PrimaryIcon className="size-[18px]" strokeWidth={1.75} />}
              {primary.label}
            </Button>
          ) : null}

          {/* Menu ba chấm theo trạng thái */}
          <div>
            <Button variant="outline" onClick={toggleMenu} className="size-10 rounded-lg border-[#e3e5ec] bg-white p-0 text-[#0b0c24] shadow-none" aria-label="Thao tác khác" aria-expanded={!!menuPos}>
              <MoreVertical className="size-[18px]" strokeWidth={1.75} />
            </Button>

            {menuPos && createPortal(
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuPos(null)} />
                <div role="menu" style={{ top: menuPos.top, left: menuPos.left }} className="fixed z-50 w-44 overflow-hidden rounded-xl border border-[#eceef4] bg-white py-1.5 shadow-[0_10px_30px_-6px_rgba(16,24,40,0.18)]">
                  {menuIds.map((id, i) => {
                    const a = ACTIONS[id];
                    const Icon = a.icon;
                    const prevId = i > 0 ? menuIds[i - 1] : undefined;
                    const hasBreak = prevId !== undefined && menuGroup(prevId) !== menuGroup(id);
                    return (
                      <div key={id}>
                        {hasBreak && <div className="my-1 border-t border-[#eceef4]" />}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => { setMenuPos(null); run(id); }}
                          className={cn("flex h-9 w-full items-center gap-[11px] px-4 text-left text-[13px]", a.danger ? "text-[#f0294d] hover:bg-rose-50" : "text-[#23253f] hover:bg-slate-50")}
                        >
                          <Icon className="size-4 shrink-0" />
                          {a.label}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>,
              document.body,
            )}
          </div>
        </div>
      </div>

      {/* ───────── LƯỚI 2 CỘT ───────── */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ===== Cột trái ===== */}
        <div className="space-y-3.5">
          {/* Nội dung bài viết */}
          <section className={cn(panel, "px-[18px] pt-4 pb-5")}>
            <CardTitle icon={FileText}>Nội dung bài viết</CardTitle>

            <div className="mt-5 grid grid-cols-1 gap-[22px] md:grid-cols-[minmax(0,390fr)_minmax(0,411fr)]">
              {/* Thư viện ảnh */}
              <div className="self-start">
                <div className="flex gap-2">
                  <div className="relative aspect-[258/335] flex-1 overflow-hidden rounded-[10px] bg-stone-100">
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
                    <div className="flex w-[124px] shrink-0 flex-col gap-2">
                      {images.slice(1, 4).map((img, idx) => {
                        const isLast = idx === 2 && extraImages > 0;
                        return (
                          <button
                            key={img + idx}
                            type="button"
                            onClick={() => setActiveImg(idx + 1)}
                            style={activeImg === idx + 1 ? { ["--tw-ring-color" as string]: BRAND } : undefined}
                            className={cn("relative min-h-0 flex-1 overflow-hidden rounded-[10px] bg-slate-100 transition hover:opacity-90", activeImg === idx + 1 && "ring-2")}
                          >
                            <img src={img} alt="" className="size-full object-cover" />
                            {isLast && <span className="absolute inset-0 grid place-items-center bg-black/55 text-lg font-semibold text-white">+{extraImages}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Caption, hashtag, CTA, sản phẩm */}
              <div className="flex min-w-0 flex-col gap-4">
                <div>
                  <FieldLabel icon={FileText}>Nội dung caption</FieldLabel>
                  <div className="mt-1.5 max-h-80 space-y-2.5 overflow-y-auto rounded-xl bg-[#f6f7fb] px-3 py-3 text-[13px] leading-[18px] text-[#14163a]">
                    {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>

                <div className="pb-2">
                  <FieldLabel icon={Hash}>Hashtag</FieldLabel>
                  <div className="mt-2.5 flex flex-wrap gap-x-[7px] gap-y-2">
                    {tags.length ? tags.map((tag: string) => (
                      <span key={tag} className="rounded-full bg-[#f2effe] px-3 py-[3px] text-xs font-medium" style={{ color: BRAND }}>{tag}</span>
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
                      className="mt-2.5 flex items-center justify-between gap-3 rounded-xl bg-[#f2effe] py-2.5 pl-5 pr-4 transition hover:bg-[#ebe6fd]"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-[18px] text-[#0b0c24]">{cta.label}</p>
                        <p className="truncate text-[13px] leading-[18px] text-[#5a5e75]">{cta.url}</p>
                      </div>
                      <ExternalLink className="size-[18px] shrink-0" style={{ color: BRAND }} strokeWidth={1.75} />
                    </a>
                  </div>
                )}

                {products.length > 0 && (
                  <div>
                    <FieldLabel icon={ShoppingBag}>Sản phẩm được gắn thẻ ({products.length})</FieldLabel>
                    <div className="mt-2.5 flex flex-wrap gap-3">
                      {products.map((prod: { id: string; name: string; code: string; img: string }) => (
                        <a
                          key={prod.id}
                          href={`/sanpham/chitiet/${encodeURIComponent(prod.id)}`}
                          title={`Xem chi tiết ${prod.name}`}
                          className="flex min-w-0 flex-auto items-center gap-2.5 rounded-lg bg-[#f5f6fa] p-1 pr-3 transition hover:bg-[#eef0f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#512ebb]/40"
                        >
                          <div className="h-[38px] w-[34px] shrink-0 overflow-hidden rounded-md bg-slate-100">
                            <img src={prod.img} alt={prod.name} className="size-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium leading-4 text-[#14163a]">{prod.name}</p>
                            <p className="mt-0.5 text-[11px] leading-4 text-[#7b7f95]">{prod.code}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Lịch sử phê duyệt */}
          <section className={cn(panel, panelPad)}>
            <CardTitle
              icon={Clock}
              right={
                <label className="relative inline-flex items-center">
                  <select
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value as typeof historyFilter)}
                    className="h-8 min-w-[149px] appearance-none rounded-lg border border-[#e3e5ec] bg-white pl-3 pr-8 text-[13px] text-[#23253f] outline-none hover:bg-slate-50"
                  >
                    <option value="all">Tất cả hoạt động</option>
                    <option value="content">Nội dung</option>
                    <option value="review">Phê duyệt & đăng</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-[#23253f]" strokeWidth={1.75} />
                </label>
              }
            >
              Lịch sử phê duyệt
            </CardTitle>

            <div className="relative mt-4">
              <span className="absolute bottom-2 left-[18px] top-2 w-px bg-slate-200" />
              <span className="absolute bottom-2 left-[180px] top-2 w-px bg-slate-200" />
              <ul className="space-y-2">
                {history.map((ev, i) => (
                  <li key={i} className="grid grid-cols-[153px_28px_minmax(0,1fr)] items-start pl-[13px]">
                    <div className="relative pl-[30px] text-xs leading-[18px]">
                      <span className="absolute left-0 top-1 z-10 size-2.5 rounded-full bg-slate-300 ring-2 ring-white" />
                      <p className="text-[#2b2e47]">{ev.at}</p>
                      <p className="text-[#5a5e75]">{ev.by}</p>
                    </div>
                    <div className="flex justify-center">
                      <span
                        style={ev.waiting ? undefined : { backgroundColor: ACCENT }}
                        className={cn("relative z-10 mt-1 size-[11px] rounded-full ring-2 ring-white", ev.waiting && "bg-[#f5af0f]")}
                      />
                    </div>
                    <div className={cn("min-w-0 pl-[13px]", ev.note && "flex items-start gap-3")}>
                      <div className={cn(ev.note && "shrink-0")}>
                        <p className="text-[13px] font-semibold leading-[18px] text-[#0b0c24]">{ev.title}</p>
                        {ev.desc && <p className="text-xs leading-[17px] text-[#5b5e71]">{ev.desc}</p>}
                      </div>
                      {ev.note && (
                        <p className="min-w-0 flex-1 rounded-lg border border-[#fbe3a0] bg-[#fef4da] px-3 py-2 text-xs leading-[17px] text-[#33364d]">{ev.note}</p>
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
        <div className="space-y-3.5">
          {/* Thông tin bài viết */}
          <section className={cn(panel, panelPad)}>
            <CardTitle icon={FileText}>Thông tin bài viết</CardTitle>
            <div className="mt-2.5">
              <InfoRow icon={Share2} label="Kênh">
                <span className="flex items-center gap-2"><ChannelLogo id={post.channel} size="xs" />{channelInfo?.name ?? post.channel}</span>
              </InfoRow>
              <InfoRow icon={Activity} label="Trạng thái">
                <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold", badge.cls)}>
                  <StatusIcon className={cn("size-4", badge.iconCls)} strokeWidth={1.75} />
                  {badge.label}
                </span>
              </InfoRow>
              <InfoRow icon={Calendar} label="Ngày tạo">{createdDate}</InfoRow>
              <InfoRow icon={User} label="Người tạo">{creator}</InfoRow>
              <InfoRow icon={Calendar} label="Lịch đăng">{scheduledDate}</InfoRow>
              <InfoRow icon={AlignLeft} label="Loại nội dung">{contentTypeLabel}</InfoRow>
              {permalink && (
                <InfoRow icon={ExternalLink} label="Liên kết bài viết">
                  <div className="flex items-center gap-2">
                    <a
                      href={permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-[190px] items-center gap-1.5 truncate text-[13px] font-semibold hover:underline"
                      style={{ color: BRAND }}
                      title={`Mở bài viết: ${permalink}`}
                    >
                      <span className="truncate">{permalink}</span>
                      <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(permalink);
                        toast.success("Đã sao chép liên kết bài viết công khai!");
                      }}
                      className="grid size-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Sao chép liên kết"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </InfoRow>
              )}
              <InfoRow icon={Link2} label="Đường dẫn nội bộ">
                <div className="flex items-center gap-2">
                  <span className="max-w-[190px] truncate font-mono text-xs text-slate-500" title={`/kenhbanhang/baiviet/chitiet/${post.id}`}>
                    /kenhbanhang/baiviet/chitiet/{post.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const detailUrl = typeof window !== "undefined" ? `${window.location.origin}/kenhbanhang/baiviet/chitiet/${encodeURIComponent(post.id)}` : "";
                      if (detailUrl) {
                        navigator.clipboard.writeText(detailUrl);
                        toast.success("Đã sao chép liên kết chi tiết bài viết!");
                      }
                    }}
                    className="grid size-6 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Sao chép liên kết quản trị"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </InfoRow>
            </div>
          </section>

          {/* Thiết lập đăng */}
          <section className={cn(panel, panelPad)}>
            <CardTitle icon={Settings} right={<EditButton onClick={() => toast.info("Mở cài đặt thiết lập đăng")} />}>Thiết lập đăng</CardTitle>
            <div className="mt-[18px] space-y-[19px]">
              <div className="grid grid-cols-[156px_minmax(0,1fr)_auto] items-center gap-3">
                <span className={settingRowLabel}><Repeat className="size-[18px] shrink-0 text-[#2a2d45]" strokeWidth={1.6} />Đăng chéo nền tảng</span>
                <span className={cn("flex items-center gap-2", settingRowValue)}>
                  <ChannelLogo id="facebook" size="xs" />
                  <ChannelLogo id="tiktok" size="xs" />
                  <span className="ml-0.5">Facebook, TikTok</span>
                </span>
                <Toggle checked={crossPost} onChange={setCrossPost} label="Đăng chéo nền tảng" />
              </div>
              <div className="grid grid-cols-[194px_minmax(0,1fr)_auto] items-center gap-3">
                <span className={settingRowLabel}><MessageSquareText className="size-[18px] shrink-0 text-[#2a2d45]" strokeWidth={1.6} />Tự động trả lời bình luận</span>
                <span className={settingRowValue}>Bật (theo mẫu AI)</span>
                <Toggle checked={autoReply} onChange={setAutoReply} label="Tự động trả lời bình luận" />
              </div>
              <div className="grid grid-cols-[194px_minmax(0,1fr)_auto] items-center gap-3">
                <span className={settingRowLabel}><Sparkles className="size-[18px] shrink-0 text-fuchsia-500" strokeWidth={1.6} />Hỗ trợ bởi AI</span>
                <span className={settingRowValue}>Tối ưu caption, hashtag</span>
                <Toggle checked={aiAssist} onChange={setAiAssist} label="Hỗ trợ bởi AI" />
              </div>
            </div>
          </section>

          {/* Hiệu quả dự kiến / thực tế */}
          <section id="post-metrics-section" className={cn(panel, panelPad)}>
            <CardTitle
              icon={BarChart3}
              right={
                isPublished ? (
                  <div className="flex items-center gap-2">
                    {liveMetrics.lastSyncedAt && (
                      <span className="hidden text-[11px] text-[#7b7f95] sm:inline">
                        Đồng bộ: {new Date(liveMetrics.lastSyncedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSyncMetrics}
                      disabled={syncingMetrics}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#e3e5ec] bg-white px-2.5 text-xs font-medium text-[#0b0c24] transition-colors hover:border-[#512ebb] hover:bg-violet-50 hover:text-[#512ebb] disabled:opacity-50"
                      title="Lấy dữ liệu tương tác thực tế từ Meta Graph API"
                    >
                      <RefreshCw className={cn("size-3.5", syncingMetrics && "animate-spin text-[#512ebb]")} />
                      {syncingMetrics ? "Đang đồng bộ..." : "Đồng bộ real-time"}
                    </button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-[#55567a]">
                    <Info className="size-4" strokeWidth={1.6} />
                    Dựa trên dữ liệu các bài tương tự
                  </span>
                )
              }
            >
              {isPublished ? "Hiệu quả bài viết trên Instagram" : "Hiệu quả dự kiến"}
            </CardTitle>

            {isPublished ? (
              <>
                <div className="mt-3.5 grid grid-cols-2 gap-[11px] sm:grid-cols-3">
                  <MetricTile icon={Eye} iconCls="text-[#5f23c8]" value={liveMetrics.reach.toLocaleString("vi-VN")} label="Lượt tiếp cận" />
                  <MetricTile icon={TrendingUp} iconCls="text-indigo-500" value={liveMetrics.impressions.toLocaleString("vi-VN")} label="Lượt hiển thị" />
                  <MetricTile icon={Heart} iconCls="text-rose-500" value={liveMetrics.likes.toLocaleString("vi-VN")} label="Lượt thích" />
                  <MetricTile icon={MessageCircle} iconCls="text-blue-500" value={liveMetrics.comments.toLocaleString("vi-VN")} label="Bình luận" />
                  <MetricTile icon={Bookmark} iconCls="text-amber-500" value={liveMetrics.saves.toLocaleString("vi-VN")} label="Lượt lưu" />
                  <MetricTile icon={Share2} iconCls="text-emerald-500" value={liveMetrics.shares.toLocaleString("vi-VN")} label="Chia sẻ" />
                </div>

                <div className="mt-[11px] flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f2effe] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#2a2d45]">Tổng tương tác trực tiếp:</span>
                    <span className="text-[13px] font-semibold" style={{ color: BRAND }}>{totalInteractions.toLocaleString("vi-VN")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#2a2d45]">Tỷ lệ tương tác (ER):</span>
                    <span className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold" style={{ color: BRAND }}>
                      {liveEngagementRate}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-3.5 flex flex-wrap gap-[11px]">
                <MetricTile icon={Eye} iconCls="text-[#5f23c8]" value={forecast.reach} label="Lượt tiếp cận ước tính" />
                <MetricTile icon={Users} iconCls="text-[#5f23c8]" value={forecast.engagement} label="Lượt tương tác ước tính" />
                <MetricTile icon={Heart} iconCls="text-rose-500" value={forecast.rate} label="Tỷ lệ tương tác" />
              </div>
            )}
          </section>

          {/* Ghi chú nội bộ */}
          <section className={cn(panel, panelPad)}>
            <CardTitle icon={FileText} right={<EditButton onClick={() => toast.info("Chỉnh sửa ghi chú nội bộ")} />}>Ghi chú nội bộ</CardTitle>
            <div className="mt-3.5 whitespace-pre-line rounded-lg bg-[#f4f5f9] px-4 py-3.5 text-[13px] leading-[19px] text-[#14163a]">{note.text}</div>
            <p className="mt-3.5 text-xs text-[#5a6278]">Cập nhật lần cuối: {note.updatedAt} bởi {noteEditor}</p>
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

              <div className="relative aspect-square bg-slate-100">
                {images[activeImg] && <img src={images[activeImg]} alt="" className="size-full object-cover" />}
                {images.length > 1 && <>
                  <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold text-white shadow-xs">{activeImg + 1}/{images.length}</span>
                  {activeImg > 0 && <button type="button" aria-label="Ảnh trước" onClick={() => setActiveImg((i) => i - 1)} className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/65 shadow-xs"><ChevronLeft className="size-4" /></button>}
                  {activeImg < images.length - 1 && <button type="button" aria-label="Ảnh tiếp theo" onClick={() => setActiveImg((i) => i + 1)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/65 shadow-xs"><ChevronRight className="size-4" /></button>}
                  <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-xs shadow-xs">
                    {images.slice(0, 7).map((_, i) => {
                      const isCurrent = i === activeImg;
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Xem ảnh ${i + 1}`}
                          onClick={() => setActiveImg(i)}
                          className="group flex size-2.5 items-center justify-center p-0 appearance-none bg-transparent border-0 cursor-pointer"
                        >
                          <span
                            className={cn(
                              "block rounded-full transition-all duration-200",
                              isCurrent
                                ? "size-1.5 bg-white shadow-xs scale-125"
                                : "size-1.5 bg-white/50 group-hover:bg-white/80"
                            )}
                          />
                        </button>
                      );
                    })}
                    {images.length > 7 && <span className="text-[9px] font-semibold leading-none text-white/90">+{images.length - 7}</span>}
                  </div>
                </>}
              </div>

              <div className="p-3 text-xs text-slate-800">
                <p className="font-semibold text-slate-900">{post.title}</p>
                <p className="mt-1 whitespace-pre-line text-slate-600">{cleanParagraphs.join("\n\n")}</p>
                {tags.length > 0 && <p className="mt-2 text-[11px] font-medium" style={{ color: BRAND }}>{tags.slice(0, 3).join(" ")}</p>}
              </div>
            </div>

            <Button onClick={() => setShowPreviewModal(false)} style={{ backgroundColor: BRAND }} className="w-full text-xs font-semibold hover:opacity-90">
              Đóng xem trước
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
