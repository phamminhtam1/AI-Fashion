import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  Calendar, CalendarClock, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Eye, Filter, Heart,
  Image as ImageIcon, MessageCircle, MoreHorizontal, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, Send, Sparkles,
  Trash2, X, XCircle, AlertCircle, ExternalLink, Link2, ArrowLeft, FileText, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi, type SocialContentItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveAdminPath } from "@/lib/routes";
import { CHANNEL_META, type PostRow, type PostStatus } from "../mock";
import type { ChannelId, SocialCtx } from "../types";
import { ChannelLogo, Empty, PageHeader, Pill, Modal, card } from "../ui";
import { PostDetailPage } from "./PostDetailPage";
import { ACTIONS, MENUS, PRIMARY, toState, toStatus, type ActionId, type PostState } from "./postActions";

import { PostItem, useUpcomingPosts, extractCleanCaptionLines, mapStatus } from "../useUpcomingPosts";
import { PostThumb, PostStatusPill } from "../PostShared";



/* ═════════════════════════ Dòng hiển thị ═════════════════════════ */

type Kind = "image" | "video" | "article";
type PostView = PostItem & {
  state: PostState;
  kind: Kind;
  format: string;
  sub: string;
  metrics?: { views: string; likes: string; comments: string };
  error?: string;
};

/** Các trường API có thể trả thêm. Chưa có thì dùng giá trị suy ra. */
type ContentExtra = SocialContentItem & {
  scheduledAt?: string | null;
  createdAt?: string;
  views?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  format?: string;
  errorMessage?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtDateTime = (d: Date) => `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

function subLabel(state: PostState, created?: string) {
  if (state === "draft") return "Bản nháp";
  if (state === "pending") return created ? `Đã tạo ${created}` : "Chờ duyệt";
  if (state === "approved") return "Đã duyệt";
  if (state === "scheduled") return "Lên lịch";
  if (state === "published") return "Đã đăng";
  return "Đăng lỗi";
}

function enrich(p: PostItem): PostView {
  const x = p.item as ContentExtra;
  const state = toState(x?.status ?? p.status);
  const first = x?.mediaUrls?.[0] ?? "";
  const kind: Kind = (x?.mediaType === "REELS" || /\.(mp4|mov|webm)(\?|$)/i.test(first)) ? "video" : first ? "image" : "article";
  const raw = x?.scheduledAt ?? x?.createdAt;
  const at = raw ? new Date(raw) : undefined;
  const created = x?.createdAt ? fmtDate(new Date(x.createdAt)) : undefined;
  const hasMetrics = state === "published" || (x?.views != null && x.views > 0) || (x?.likes != null && x.likes > 0) || (x?.comments != null && x.comments > 0);
  const res: PostView = {
    ...p,
    state,
    kind,
    format: x?.format ?? (kind === "video" ? "Video Reels" : (x?.mediaUrls?.length ?? 0) > 1 || x?.mediaType === "CAROUSEL" ? "Album Carousel" : kind === "image" ? "Post • Hình ảnh" : "Bài viết"),
    time: x?.scheduledAt ? fmtDateTime(new Date(x.scheduledAt)) : at ? fmtDateTime(at) : "Chưa đặt lịch",
    sub: subLabel(state, created),
    ...(hasMetrics ? { metrics: { views: compact(x?.views ?? 0), likes: compact(x?.likes ?? 0), comments: compact(x?.comments ?? 0) } } : {}),
    ...(state === "failed" ? { error: x?.lastError ?? x?.errorMessage ?? "Đăng bài thất bại" } : {}),
  };
  return res;
}

/* ═════════════════════════ Hằng số giao diện ═════════════════════════ */

type TabId = "all" | PostState;
const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "draft", label: "Bản nháp" },
  { id: "pending", label: "Chờ duyệt" },
  { id: "approved", label: "Đã duyệt" },
  { id: "scheduled", label: "Đã lên lịch" },
  { id: "published", label: "Đã đăng" },
  { id: "failed", label: "Lỗi" },
];
const PLATFORMS: ChannelId[] = ["instagram", "facebook", "tiktok", "shopee", "website"];
const KINDS: { id: Kind | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" }, { id: "image", label: "Hình ảnh" }, { id: "video", label: "Video" }, { id: "article", label: "Bài viết" },
];
const COLS = "grid grid-cols-[36px_minmax(360px,2.3fr)_minmax(160px,0.9fr)_120px_170px_minmax(170px,0.9fr)_190px] items-center gap-x-6";

/** Các hành động chỉ cần mở trang chi tiết. */
const OPEN_DETAIL: ActionId[] = ["view_detail", "view_schedule", "view_error", "preview", "view_insights"];

/* ═════════════════════════ Thành phần nhỏ ═════════════════════════ */

function Thumb({ post }: { post: PostView }) {
  const mediaCount = post.item?.mediaUrls?.length ?? 1;
  return (
    <div className="relative shrink-0">
      <PostThumb post={post} className="size-[54px]" />
      {mediaCount > 1 && (
        <span className="absolute bottom-1 right-1 flex items-center justify-center rounded bg-black/75 px-1 py-0.5 text-[10px] font-semibold text-white leading-none shadow-sm">
          +{mediaCount}
        </span>
      )}
      {post.kind === "video" && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-6 place-items-center rounded-full bg-black/55"><Play className="size-3 fill-white text-white" /></span>
        </span>
      )}
    </div>
  );
}

function RowMenu({ post, onRun }: { post: PostView; onRun: (id: ActionId, p: PostView) => void }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ids = MENUS[post.state];

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [pos]);

  // Render menu qua portal để tọa độ viewport không bị ảnh hưởng bởi transform/zoom
  // của layout cha, đồng thời tránh bị vùng overflow của bảng cắt mất.
  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    if (pos) return setPos(null);
    const r = e.currentTarget.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = ids.length * 36 + 20;
    const gap = 6;
    const viewportPadding = 8;
    const top = r.bottom + gap + menuHeight > window.innerHeight
      ? Math.max(viewportPadding, r.top - gap - menuHeight)
      : r.bottom + gap;
    const left = Math.min(
      window.innerWidth - menuWidth - viewportPadding,
      Math.max(viewportPadding, r.right - menuWidth),
    );
    setPos({ top, left });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={toggle} aria-label="Thêm tuỳ chọn" aria-expanded={!!pos} className="size-9 bg-white px-0">
        <MoreHorizontal className="size-4" />
      </Button>
      {pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} />
          <div role="menu" style={{ top: pos.top, left: pos.left }} className="fixed z-50 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {ids.map((id, i) => {
              const a = ACTIONS[id];
              const Icon = a.icon;
              const prevId = i > 0 ? ids[i - 1] : undefined;
              return (
                <div key={id}>
                  {a.danger && prevId && !ACTIONS[prevId]?.danger && <div className="my-1 border-t border-slate-100" />}
                  {id === "view_detail" ? (
                    <a
                      href={`/kenhbanhang/baiviet/chitiet/${encodeURIComponent(post.id)}`}
                      role="menuitem"
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                          e.preventDefault();
                          setPos(null);
                          onRun(id, post);
                        }
                      }}
                      className="flex h-9 w-full items-center gap-2.5 px-3 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {a.label}
                    </a>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setPos(null); onRun(id, post); }}
                      className={cn("flex h-9 w-full items-center gap-2.5 px-3 text-left text-[13px]", a.danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-50")}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {a.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}

function CreateMenu({ onAi, onManual }: { onAi: () => void; onManual: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex">
      <Button onClick={onAi} className="gap-2 rounded-r-none bg-[#6941c6] hover:bg-[#5b36b0]">
        <Plus className="size-4" />
        Tạo nội dung
      </Button>
      <Button onClick={() => setOpen((v) => !v)} aria-label="Các cách tạo nội dung" className="rounded-l-none border-l border-white/25 bg-[#6941c6] px-2.5 hover:bg-[#5b36b0]">
        <ChevronDown className="size-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-sm shadow-xl">
            <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50" onClick={() => { setOpen(false); onAi(); }}>
              <Sparkles className="size-4 text-[#6941c6]" />Tạo bằng AI
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50" onClick={() => { setOpen(false); onManual(); }}>
              <Pencil className="size-4 text-slate-500" />Tạo thủ công
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ScheduleModal({
  post,
  onClose,
  onConfirm,
  loading,
}: {
  post: PostView;
  onClose: () => void;
  onConfirm: (dateStr: string) => Promise<void>;
  loading: boolean;
}) {
  const defaultDate = post.item?.scheduledAt
    ? new Date(new Date(post.item.scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : new Date(Date.now() + 3600000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [val, setVal] = useState(defaultDate);

  const setShortcut = (hoursFromNow: number) => {
    const target = new Date(Date.now() + hoursFromNow * 3600000);
    setVal(new Date(target.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  };

  const setTomorrowMorning = () => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
    setVal(new Date(target.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  };

  const setTonightPrime = () => {
    const target = new Date();
    if (target.getHours() >= 20) target.setDate(target.getDate() + 1);
    target.setHours(20, 0, 0, 0);
    setVal(new Date(target.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  };

  return (
    <Modal open onClose={onClose} maxW="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-5 text-[#6941c6]" />
            <h3 className="text-base font-bold text-slate-900">
              {post.state === "scheduled" ? "Đổi lịch đăng bài" : "Lên lịch đăng bài viết"}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <PostThumb post={post} className="size-14" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-semibold text-slate-900">{post.title}</p>
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{post.caption || "Chưa có caption"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700">Chọn thời gian đăng (giờ Việt Nam):</label>
          <input
            type="datetime-local"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-500">Gợi ý nhanh:</label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShortcut(1)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
              +1 giờ nữa
            </button>
            <button type="button" onClick={() => setShortcut(3)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
              +3 giờ nữa
            </button>
            <button type="button" onClick={setTonightPrime} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
              Tối nay 20:00
            </button>
            <button type="button" onClick={setTomorrowMorning} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
              Sáng mai 09:00
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>Hủy</Button>
          <Button onClick={() => onConfirm(new Date(val).toISOString())} disabled={loading || !val} className="bg-[#6941c6] hover:bg-[#5b36b0]">
            {loading ? "Đang lưu..." : "Xác nhận lên lịch"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FeedbackModal({
  post,
  mode,
  onClose,
  onConfirm,
  loading,
}: {
  post: PostView;
  mode: "reject" | "request_changes";
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  loading: boolean;
}) {
  const [note, setNote] = useState("");
  const isReject = mode === "reject";

  return (
    <Modal open onClose={onClose} maxW="max-w-md">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            {isReject ? <XCircle className="size-5 text-rose-600" /> : <MessageCircle className="size-5 text-amber-600" />}
            <h3 className="text-base font-bold text-slate-900">
              {isReject ? "Từ chối bài viết" : "Yêu cầu chỉnh sửa bài viết"}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600">
          {isReject
            ? "Bài viết sẽ được chuyển về trạng thái Bản nháp kèm lý do từ chối để cập nhật lại."
            : "Nhập phản hồi chi tiết để tác giả chỉnh sửa nội dung/hình ảnh trước khi duyệt lại."}
        </p>

        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isReject ? "Nhập lý do từ chối duyệt bài..." : "Nhập yêu cầu cụ thể (VD: Thay ảnh 2, sửa lại hashtag...)"}
          className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
        />

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>Hủy</Button>
          <Button
            onClick={() => onConfirm(note)}
            disabled={loading}
            className={isReject ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
          >
            {loading ? "Đang xử lý..." : isReject ? "Xác nhận từ chối" : "Gửi yêu cầu sửa"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({
  post,
  onClose,
  onConfirm,
  loading,
}: {
  post: PostView;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}) {
  const isPublishedOnInstagram = Boolean(post.state === "published" || post.item?.externalPostId || post.item?.permalink);
  const permalink = post.item?.permalink || (post as any).permalink;

  return (
    <Modal open onClose={onClose} maxW="max-w-sm">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600">
              <Trash2 className="size-4" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="text-base font-semibold text-slate-900">Xóa bài viết?</h3>
              <p className="mt-1 text-sm text-slate-500">Thao tác này không thể hoàn tác.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="-mr-1 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="line-clamp-2 border-l-2 border-slate-200 pl-3 text-sm leading-6 text-slate-700">
          {post.title}
        </p>

        {isPublishedOnInstagram && (
          <div className="rounded-xl bg-amber-50 p-3.5">
            <div className="flex items-start gap-2.5">
              <ChannelLogo id="instagram" size="xs" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-950">Bài vẫn còn trên Instagram</p>
                <p className="mt-1 text-xs leading-5 text-amber-900/75">Bạn cần xóa riêng trên Instagram.</p>
              </div>
            </div>
            {permalink && (
              <a
                href={permalink}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 inline-flex items-center gap-1.5 pl-7 text-xs font-semibold text-pink-600 hover:underline"
              >
                Mở trên Instagram <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose} disabled={loading} className="w-full">Hủy</Button>
          <Button
            onClick={() => void onConfirm()}
            disabled={loading}
            className="w-full bg-rose-600 text-white hover:bg-rose-700"
          >
            {loading ? "Đang xóa..." : "Xóa bài viết"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditPostModal({
  post,
  onClose,
  onSave,
  loading,
}: {
  post: PostView;
  onClose: () => void;
  onSave: (payload: { title: string; caption: string; mediaUrls: string[]; status?: string; metadata?: any }) => Promise<void>;
  loading: boolean;
}) {
  const itemMeta = (post.item as any)?.metadata;
  const [title, setTitle] = useState(post.title);
  const [caption, setCaption] = useState(post.caption || post.item?.caption || "");
  const [mediaUrls, setMediaUrls] = useState<string[]>(post.item?.mediaUrls?.length ? [...post.item.mediaUrls] : post.thumb ? [post.thumb] : []);
  const [newUrl, setNewUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState((post as any).cta?.label || itemMeta?.cta?.label || "Khám phá ngay →");
  const [ctaUrl, setCtaUrl] = useState((post as any).cta?.url || itemMeta?.cta?.url || "https://elane.vn/collections/thu-dong-2024");
  const [statusChoice, setStatusChoice] = useState<string>(post.state);

  const addImage = () => {
    if (newUrl.trim()) {
      setMediaUrls((prev) => [...prev, newUrl.trim()]);
      setNewUrl("");
    }
  };

  const removeImage = (idx: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Modal open onClose={onClose} maxW="max-w-2xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Pencil className="size-5 text-[#6941c6]" />
            <h3 className="text-base font-bold text-slate-900">Chỉnh sửa bài viết</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Tiêu đề bài viết:</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Nội dung caption & hashtag:</label>
              <span className="text-[11px] text-slate-400">{caption.length} ký tự</span>
            </div>
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-700">Tên nút CTA:</label>
              <input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="VD: Khám phá ngay →"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#6941c6]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Liên kết nút CTA (URL):</label>
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://elane.vn/collections/..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#6941c6]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Hình ảnh / Video ({mediaUrls.length}):</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="group relative size-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <img src={url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Dán URL hình ảnh mới..."
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none"
              />
              <Button type="button" size="sm" variant="outline" onClick={addImage} className="h-8 text-xs">
                Thêm ảnh
              </Button>
            </div>
          </div>

          {post.state === "draft" && (
            <div>
              <label className="text-xs font-semibold text-slate-700">Trạng thái sau khi lưu:</label>
              <div className="mt-1 flex gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="statusChoice"
                    checked={statusChoice === "draft"}
                    onChange={() => setStatusChoice("draft")}
                  />
                  <span>Giữ làm bản nháp</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="statusChoice"
                    checked={statusChoice === "pending"}
                    onChange={() => setStatusChoice("pending")}
                  />
                  <span>Gửi duyệt ngay</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>Hủy</Button>
          <Button
            onClick={() => onSave({
              title,
              caption,
              mediaUrls,
              status: statusChoice,
              metadata: {
                ...itemMeta,
                cta: { label: ctaLabel.trim() || "Khám phá ngay →", url: ctaUrl.trim() || "https://elane.vn" },
              },
            })}
            disabled={loading || !title.trim()}
            className="bg-[#6941c6] hover:bg-[#5b36b0]"
          >
            {loading ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CalendarScheduleModal({
  posts,
  onClose,
  onSelectPost,
}: {
  posts: PostView[];
  onClose: () => void;
  onSelectPost: (id: string) => void;
}) {
  const scheduledOrPublished = useMemo(() => {
    return posts.filter((p) => p.state === "scheduled" || p.state === "published" || p.item?.scheduledAt);
  }, [posts]);

  return (
    <Modal open onClose={onClose} maxW="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-[#6941c6]" />
            <h3 className="text-base font-bold text-slate-900">Lịch đăng bài viết</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Danh sách các bài viết đã lên lịch tự động xuất bản hoặc đã xuất bản theo thời gian.
        </p>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {scheduledOrPublished.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Chưa có bài viết nào được lên lịch đăng. Hãy tạo bài viết và chọn Lên lịch!
            </div>
          ) : (
            scheduledOrPublished.map((p) => (
              <div
                key={p.id}
                onClick={() => { onClose(); onSelectPost(p.id); }}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-[#6941c6] hover:shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PostThumb post={p} className="size-12" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ChannelLogo id={p.channel} size="xs" />
                      <p className="truncate text-sm font-semibold text-slate-900">{p.title}</p>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{p.caption || "Chưa có caption"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-800">{p.time}</p>
                    <span className="text-[11px] text-slate-500">{p.sub}</span>
                  </div>
                  <PostStatusPill status={p.state} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button onClick={onClose} variant="outline">Đóng</Button>
        </div>
      </div>
    </Modal>
  );
}

function ManualCreateModal({
  onClose,
  onCreate,
  loading,
}: {
  onClose: () => void;
  onCreate: (payload: { title: string; caption: string; mediaUrls: string[]; status: "draft" | "pending"; metadata?: any }) => Promise<void>;
  loading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Khám phá ngay →");
  const [ctaUrl, setCtaUrl] = useState("https://elane.vn/collections/thu-dong-2024");

  const addImage = () => {
    if (newUrl.trim()) {
      setMediaUrls((prev) => [...prev, newUrl.trim()]);
      setNewUrl("");
    }
  };

  const removeImage = (idx: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Modal open onClose={onClose} maxW="max-w-xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Pencil className="size-5 text-[#6941c6]" />
            <h3 className="text-base font-bold text-slate-900">Tạo bài viết thủ công</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700">Tiêu đề bài viết *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Ra mắt BST Mùa Hè 2024..."
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Nội dung caption & hashtag</label>
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Nhập nội dung bài viết đăng lên kênh..."
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-700">Nút kêu gọi hành động (CTA):</label>
              <input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="VD: Khám phá ngay →"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#6941c6]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Liên kết nút CTA (URL):</label>
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://elane.vn/collections/..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#6941c6]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Hình ảnh sản phẩm (URL công khai) *</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="group relative size-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <img src={url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Dán URL hình ảnh (VD: https://...)..."
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none"
              />
              <Button type="button" size="sm" variant="outline" onClick={addImage} className="h-8 text-xs">
                Thêm ảnh
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>Hủy</Button>
          <Button
            variant="outline"
            onClick={() => onCreate({
              title,
              caption,
              mediaUrls,
              status: "draft",
              metadata: {
                cta: { label: ctaLabel.trim() || "Khám phá ngay →", url: ctaUrl.trim() || "https://elane.vn" },
              },
            })}
            disabled={loading || !title.trim()}
          >
            Lưu bản nháp
          </Button>
          <Button
            onClick={() => onCreate({
              title,
              caption,
              mediaUrls,
              status: "pending",
              metadata: {
                cta: { label: ctaLabel.trim() || "Khám phá ngay →", url: ctaUrl.trim() || "https://elane.vn" },
              },
            })}
            disabled={loading || !title.trim() || !mediaUrls.length}
            className="bg-[#6941c6] hover:bg-[#5b36b0]"
          >
            {loading ? "Đang lưu..." : "Gửi duyệt ngay"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function pageNumbers(page: number, pages: number) {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  return Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
}

/* ═════════════════════════ Trang ═════════════════════════ */

export function PostsPage({ ctx, initialPostId }: { ctx: SocialCtx; initialPostId?: string | null }) {
  const navigate = useNavigate();
  const location = useLocation();

  const upcoming = useUpcomingPosts(ctx);
  const posts = useMemo<PostView[]>(
    () => upcoming.map(enrich),
    [upcoming],
  );

  // Lấy postId từ URL hoặc query parameters (?postId= hoặc ?id=)
  const route = useMemo(() => resolveAdminPath(location.pathname), [location.pathname]);
  const urlPostId = useMemo(() => {
    if (route.tabId === "social" && (route.subParam === "baiviet" || route.subParam === "posts" || route.action === "detail")) {
      if (route.detailId) return route.detailId;
    }
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const q = searchParams.get("postId") || searchParams.get("id");
      if (q) return q;
    }
    return initialPostId || null;
  }, [route, initialPostId]);

  const [openId, setOpenId] = useState<string | null>(urlPostId);

  // Luôn đồng bộ openId khi URL thay đổi (browser back/forward, click link)
  useEffect(() => {
    setOpenId(urlPostId);
  }, [urlPostId]);

  const openPostDetail = useCallback((id: string) => {
    setOpenId(id);
    const targetUrl = `/kenhbanhang/baiviet/chitiet/${encodeURIComponent(id)}`;
    if (location.pathname !== targetUrl) {
      navigate({ to: targetUrl as unknown as "/" });
    }
  }, [location.pathname, navigate]);

  const closePostDetail = useCallback(() => {
    setOpenId(null);
    if (location.pathname !== "/kenhbanhang/baiviet") {
      navigate({ to: "/kenhbanhang/baiviet" as unknown as "/" });
    }
  }, [location.pathname, navigate]);

  const [tab, setTab] = useState<TabId>("all");
  const [channel, setChannel] = useState<ChannelId | "all">("all");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [showFilter, setShowFilter] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Modal states
  const [scheduleTarget, setScheduleTarget] = useState<PostView | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<{ post: PostView; mode: "reject" | "request_changes" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PostView | null>(null);
  const [editTarget, setEditTarget] = useState<PostView | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showManualCreate, setShowManualCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncAllMetrics = async () => {
    setSyncingAll(true);
    try {
      toast.info("Đang đồng bộ chỉ số tất cả bài viết từ Instagram...");
      const res = await adminApi.syncSocialMetrics();
      toast.success(`Đã đồng bộ chỉ số thành công (${res.synced} bài viết)!`);
      await ctx.reload(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đồng bộ chỉ số thất bại");
    } finally {
      setSyncingAll(false);
    }
  };

  const tabCount = (id: TabId) => (id === "all" ? posts.length : posts.filter((p) => p.state === id).length);
  const channelCount = (id: ChannelId) => posts.filter((p) => p.channel === id).length;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) =>
      (tab === "all" || p.state === tab) &&
      (channel === "all" || p.channel === channel) &&
      (kind === "all" || p.kind === kind) &&
      (!q || p.title.toLowerCase().includes(q) || (p.caption ?? "").toLowerCase().includes(q)),
    );
  }, [posts, tab, channel, kind, query]);

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, pages);
  const start = (cur - 1) * pageSize;
  const rows = list.slice(start, start + pageSize);

  const allChecked = rows.length > 0 && rows.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); rows.forEach((p) => (allChecked ? n.delete(p.id) : n.add(p.id))); return n; });
  const toggleOne = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const run = async (id: ActionId, p: PostView) => {
    if (OPEN_DETAIL.includes(id)) return openPostDetail(p.id);
    switch (id) {
      case "view_original":
        if (p.permalink) window.open(p.permalink, "_blank", "noreferrer");
        else toast.info("Bài viết chưa có liên kết gốc");
        break;

      case "duplicate":
        if (!ctx.canContentWrite) {
          toast.error("Bạn không có quyền chỉnh sửa nội dung");
          break;
        }
        try {
          await adminApi.duplicateSocialContent(p.id);
          toast.success("Đã nhân bản bài viết thành bản nháp mới");
          await ctx.reload(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Không thể nhân bản bài viết");
        }
        break;

      case "send_review":
        if (!ctx.canContentWrite) {
          toast.error("Bạn không có quyền gửi duyệt bài viết");
          break;
        }
        try {
          await adminApi.sendSocialContentForReview(p.id);
          toast.success("Đã gửi bài viết để duyệt");
          await ctx.reload(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Không thể gửi duyệt");
        }
        break;

      case "approve":
        if (!ctx.canPublish) {
          toast.error("Bạn không có quyền phê duyệt bài viết");
          break;
        }
        try {
          await adminApi.approveSocialContent(p.id, { publishNow: false });
          toast.success("Đã phê duyệt bài viết");
          await ctx.reload(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Không thể phê duyệt bài viết");
        }
        break;

      case "approve_publish":
      case "publish_now":
        if (!ctx.canPublish) {
          toast.error("Bạn không có quyền xuất bản bài viết");
          break;
        }
        setActionLoading(true);
        try {
          toast.info("Đang xuất bản bài viết lên Instagram...");
          await adminApi.approveSocialContent(p.id, { publishNow: true });
          toast.success("Đã đăng bài viết lên Instagram thành công!");
          await ctx.reload(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Không thể đăng bài viết");
          await ctx.reload(true);
        } finally {
          setActionLoading(false);
        }
        break;

      case "retry":
        if (!ctx.canPublish) {
          toast.error("Bạn không có quyền đăng lại bài viết");
          break;
        }
        setActionLoading(true);
        try {
          toast.info("Đang thử đăng lại bài viết...");
          await adminApi.retrySocialPublish(p.id);
          toast.success("Đã gửi yêu cầu đăng lại thành công");
          await ctx.reload(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Thử lại thất bại");
          await ctx.reload(true);
        } finally {
          setActionLoading(false);
        }
        break;

      case "cancel_schedule":
        if (!ctx.canPublish) {
          toast.error("Bạn không có quyền hủy lịch đăng");
          break;
        }
        try {
          await adminApi.cancelScheduleSocialContent(p.id);
          toast.success("Đã hủy lịch đăng");
          await ctx.reload(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Không thể hủy lịch đăng");
        }
        break;

      case "unapprove":
        if (!ctx.canPublish) {
          toast.error("Bạn không có quyền hủy phê duyệt bài viết");
          break;
        }
        try {
          await adminApi.unapproveSocialContent(p.id);
          toast.success("Đã hủy phê duyệt bài viết");
          await ctx.reload(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Không thể hủy phê duyệt bài viết");
        }
        break;

      case "sync_metrics":
        try {
          toast.info("Đang đồng bộ chỉ số bài viết từ Instagram...");
          await adminApi.syncPostMetrics(p.id);
          toast.success("Đã đồng bộ chỉ số mới nhất từ Instagram!");
          await ctx.reload(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Đồng bộ chỉ số thất bại");
        }
        break;

      case "schedule":
      case "reschedule":
        if (!ctx.canPublish) {
          toast.error("Bạn không có quyền lên lịch đăng");
          break;
        }
        setScheduleTarget(p);
        break;

      case "reject":
        if (!ctx.canContentWrite) {
          toast.error("Bạn không có quyền từ chối bài viết");
          break;
        }
        setFeedbackTarget({ post: p, mode: "reject" });
        break;

      case "request_changes":
        if (!ctx.canContentWrite) {
          toast.error("Bạn không có quyền yêu cầu chỉnh sửa");
          break;
        }
        setFeedbackTarget({ post: p, mode: "request_changes" });
        break;

      case "delete":
        if (!ctx.canContentWrite) {
          toast.error("Bạn không có quyền xóa bài viết");
          break;
        }
        setDeleteTarget(p);
        break;

      case "edit":
      case "edit_reapprove":
        if (!ctx.canContentWrite) {
          toast.error("Bạn không có quyền chỉnh sửa bài viết");
          break;
        }
        setEditTarget(p);
        break;

      default:
        toast.info(`${ACTIONS[id]?.label || id} được thực hiện`);
    }
  };

  const handleConfirmSchedule = async (scheduledAt: string) => {
    if (!scheduleTarget) return;
    setActionLoading(true);
    try {
      await adminApi.rescheduleSocialContent(scheduleTarget.id, scheduledAt);
      toast.success("Đã lên lịch đăng bài viết thành công");
      setScheduleTarget(null);
      await ctx.reload(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể lên lịch bài viết");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmFeedback = async (note: string) => {
    if (!feedbackTarget) return;
    setActionLoading(true);
    try {
      if (feedbackTarget.mode === "reject") {
        await adminApi.rejectSocialContent(feedbackTarget.post.id, note);
        toast.success("Đã từ chối bài viết");
      } else {
        await adminApi.requestChangesSocialContent(feedbackTarget.post.id, note);
        toast.success("Đã gửi yêu cầu chỉnh sửa bài viết");
      }
      setFeedbackTarget(null);
      await ctx.reload(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể gửi phản hồi");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async (force = false) => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await adminApi.deleteSocialContent(deleteTarget.id, force);
      if (res.deletedOnInstagram) {
        toast.success("Đã xóa bài viết trên hệ thống và Instagram thành công");
      } else if (force) {
        toast.info("Đã xóa bài viết khỏi hệ thống nội bộ");
      } else {
        toast.success("Đã xóa bài viết thành công");
      }
      if (openId === deleteTarget.id) closePostDetail();
      setDeleteTarget(null);
      await ctx.reload(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể xóa bài viết";
      toast.error(msg);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmEdit = async (payload: { title: string; caption: string; mediaUrls: string[]; status?: string; metadata?: any }) => {
    if (!editTarget) return;
    setActionLoading(true);
    try {
      await adminApi.updateSocialContent(editTarget.id, {
        title: payload.title,
        caption: payload.caption,
        mediaUrls: payload.mediaUrls,
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.metadata ? { metadata: payload.metadata } : {}),
      });
      toast.success("Đã cập nhật bài viết thành công");
      setEditTarget(null);
      await ctx.reload(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể cập nhật bài viết");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmManualCreate = async (payload: { title: string; caption: string; mediaUrls: string[]; status: "draft" | "pending"; metadata?: any }) => {
    setActionLoading(true);
    try {
      await adminApi.createSocialContent({
        title: payload.title,
        caption: payload.caption,
        mediaType: payload.mediaUrls.length > 1 ? "CAROUSEL" : "IMAGE",
        mediaUrls: payload.mediaUrls,
        source: "manual",
        status: payload.status,
        ...(payload.metadata ? { metadata: payload.metadata } : {}),
      });
      toast.success(payload.status === "pending" ? "Đã tạo bài viết và gửi duyệt" : "Đã lưu bản nháp thành công");
      setShowManualCreate(false);
      await ctx.reload(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thể tạo bài viết");
    } finally {
      setActionLoading(false);
    }
  };

  const modals = (
    <>
      {scheduleTarget && (
        <ScheduleModal
          post={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          onConfirm={handleConfirmSchedule}
          loading={actionLoading}
        />
      )}
      {feedbackTarget && (
        <FeedbackModal
          post={feedbackTarget.post}
          mode={feedbackTarget.mode}
          onClose={() => setFeedbackTarget(null)}
          onConfirm={handleConfirmFeedback}
          loading={actionLoading}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          post={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          loading={actionLoading}
        />
      )}
      {editTarget && (
        <EditPostModal
          post={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleConfirmEdit}
          loading={actionLoading}
        />
      )}
      {showCalendarModal && (
        <CalendarScheduleModal
          posts={posts}
          onClose={() => setShowCalendarModal(false)}
          onSelectPost={(id) => openPostDetail(id)}
        />
      )}
      {showManualCreate && (
        <ManualCreateModal
          onClose={() => setShowManualCreate(false)}
          onCreate={handleConfirmManualCreate}
          loading={actionLoading}
        />
      )}
    </>
  );

  const openPost = openId ? posts.find((p) => p.id === openId) : undefined;
  if (openId) {
    if (openPost) {
      return (
        <>
          <PostDetailPage
            post={{ ...openPost, timeSub: openPost.sub }}
            onBack={closePostDetail}
            actionLoading={actionLoading}
            onAction={(key) => run(key as ActionId, openPost)}
          />
          {modals}
        </>
      );
    }
    if (posts.length === 0) {
      return (
        <div className="flex min-h-[460px] flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 animate-spin text-[#6941c6]" />
          <p className="text-sm text-slate-500">Đang tải chi tiết bài viết…</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-[460px] flex-col items-center justify-center gap-4 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
          <FileText className="size-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Không tìm thấy bài viết</h2>
          <p className="mt-1 text-sm text-slate-500">Bài viết với mã &ldquo;{openId}&rdquo; không tồn tại hoặc đã bị xóa.</p>
        </div>
        <Button onClick={closePostDetail} variant="outline" className="gap-2">
          <ArrowLeft className="size-4" />
          Quay lại danh sách bài viết
        </Button>
      </div>
    );
  }

  const chip = (active: boolean) =>
    cn("inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
      active ? "border-[#6941c6] bg-violet-50 text-[#6941c6]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50");

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      {actionLoading && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/25 p-4 backdrop-blur-[2px]" role="status" aria-live="polite"><div className="flex w-full max-w-xs flex-col items-center rounded-2xl border border-white/70 bg-white px-6 py-5 text-center shadow-2xl"><span className="grid size-12 place-items-center rounded-full bg-violet-100 text-[#6941c6]"><RefreshCw className="size-6 animate-spin" /></span><p className="mt-3 text-sm font-semibold text-slate-900">Đang xử lý bài viết…</p><p className="mt-1 text-xs leading-5 text-slate-500">Đang gửi yêu cầu lên nền tảng. Vui lòng chờ.</p></div></div>}
      <PageHeader
        onBack={() => ctx.go("overview")}
        title="Bài viết & lịch đăng"
        desc="Duyệt, lên lịch và theo dõi hiệu quả bài viết trên các kênh bán hàng."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={syncingAll}
              onClick={handleSyncAllMetrics}
              className="gap-2 bg-white text-slate-700 hover:border-[#6941c6] hover:bg-violet-50 hover:text-[#6941c6]"
              title="Đồng bộ lại toàn bộ chỉ số thực tế từ Instagram"
            >
              <RefreshCw className={cn("size-4", syncingAll && "animate-spin text-[#6941c6]")} />
              {syncingAll ? "Đang đồng bộ..." : "Đồng bộ chỉ số"}
            </Button>
            <Button variant="outline" onClick={() => setShowCalendarModal(true)} className="gap-2 bg-white">
              <CalendarDays className="size-4" />
              Xem lịch đăng
            </Button>
            {ctx.canContentWrite && <CreateMenu onAi={() => ctx.go("ai-content")} onManual={() => setShowManualCreate(true)} />}
          </div>
        }
      />

      <section className={cn(card, "space-y-4 p-5")}>
        {/* Tabs trạng thái */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setPage(1); }}
              className={cn(
                "whitespace-nowrap rounded-lg border-b-2 px-4 py-2 text-sm transition-colors",
                tab === t.id ? "border-[#6941c6] bg-violet-50 font-semibold text-[#6941c6]" : "border-transparent bg-slate-50 font-medium text-slate-700 hover:bg-slate-100",
              )}
            >
              {t.label} ({tabCount(t.id)})
            </button>
          ))}
        </div>

        {/* Nền tảng + tìm kiếm */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative inline-flex items-center">
            <select
              value={channel}
              onChange={(e) => { setChannel(e.target.value as ChannelId | "all"); setPage(1); }}
              className="h-10 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#6941c6]/30"
            >
              <option value="all">Tất cả nền tảng</option>
              {PLATFORMS.map((id) => <option key={id} value={id}>{CHANNEL_META[id].name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 size-4 text-slate-500" />
          </label>

          {PLATFORMS.map((id) => (
            <button key={id} onClick={() => { setChannel(channel === id ? "all" : id); setPage(1); }} className={chip(channel === id)}>
              <ChannelLogo id={id} size="xs" />
              {CHANNEL_META[id].name} ({channelCount(id)})
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <div className="relative w-[230px]">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Tìm kiếm bài viết..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-[#6941c6]/30"
              />
            </div>
            <button onClick={() => setShowFilter((v) => !v)} className={cn(chip(showFilter || kind !== "all"), "relative")}>
              <Filter className="size-4" />
              Bộ lọc
              {kind !== "all" && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-[#6941c6]" />}
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <span className="mr-1 font-medium text-slate-700">Loại nội dung:</span>
            {KINDS.map((k) => (
              <button key={k.id} onClick={() => { setKind(k.id); setPage(1); }} className={cn("rounded-lg border px-3 py-1.5 font-medium", kind === k.id ? "border-[#6941c6] bg-white text-[#6941c6]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                {k.label}
              </button>
            ))}
            {kind !== "all" && <button onClick={() => setKind("all")} className="ml-auto text-xs font-medium text-[#6941c6] hover:underline">Xóa bộ lọc</button>}
          </div>
        )}

        {selected.size > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-violet-50 px-4 py-2 text-sm text-[#6941c6]">
            <span className="font-medium">Đã chọn {selected.size} bài viết</span>
            <button onClick={() => setSelected(new Set())} className="font-medium hover:underline">Bỏ chọn</button>
          </div>
        )}

        {/* Bảng */}
        <div className="overflow-x-auto">
          <div className="min-w-[1360px]">
            <div className={cn(COLS, "rounded-lg bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-800")}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" className="size-[18px] rounded border-slate-300 accent-[#6941c6]" />
              <span>Nội dung</span>
              <span>Nền tảng</span>
              <span>Trạng thái</span>
              <span>Thời gian</span>
              <span>Chỉ số</span>
              <span>Thao tác</span>
            </div>

            {rows.map((p) => {
              const primary = PRIMARY[p.state];
              const captionLines = (p.caption || p.item?.caption || "")
                .split(/\n+/)
                .map((s) => s.trim())
                .filter((line) => line && !line.startsWith("👉") && !line.startsWith("🔗") && !line.startsWith("#"));
              const captionTitle = captionLines[0] || p.title || "Chưa có nội dung";
              const captionSubtitle = captionLines.slice(1).join(" ") || p.title || p.time;

              return (
                <div key={p.id} className={cn(COLS, "border-b border-slate-100 px-4 py-3 text-sm last:border-b-0", selected.has(p.id) && "bg-violet-50/40")}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} aria-label={`Chọn ${p.title}`} className="size-[18px] rounded border-slate-300 accent-[#6941c6]" />

                  <a
                    href={`/kenhbanhang/baiviet/chitiet/${encodeURIComponent(p.id)}`}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                        e.preventDefault();
                        openPostDetail(p.id);
                      }
                    }}
                    className="group flex min-w-0 items-center gap-3 text-left cursor-pointer"
                  >
                    <Thumb post={p} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold group-hover:text-[#6941c6] transition-colors" title={captionTitle}>{captionTitle}</p>
                      <p className="mt-1 truncate text-xs text-slate-500" title={captionSubtitle}>{captionSubtitle}</p>
                    </div>
                  </a>

                  <div className="flex items-center gap-2.5">
                    <ChannelLogo id={p.channel} size="xs" />
                    <div className="min-w-0">
                      <p className="truncate text-slate-800">{CHANNEL_META[p.channel].name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{p.format}</p>
                    </div>
                  </div>

                  <div><PostStatusPill status={p.state} /></div>

                  <div>
                    <p className="text-slate-700">{p.time}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Clock className="size-3.5" />{p.sub}</p>
                  </div>

                  <div className="text-slate-600">
                    {p.metrics ? (
                      <span
                        onClick={() => openPostDetail(p.id)}
                        className="flex cursor-pointer items-center gap-3.5 transition-opacity hover:opacity-80"
                        title="Bấm để xem chi tiết hiệu quả bài viết"
                      >
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-700" title="Lượt tiếp cận (Reach)">
                          <Eye className="size-3.5 text-[#6941c6]" />
                          {p.metrics.views}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-700" title="Lượt thích (Likes)">
                          <Heart className="size-3.5 text-rose-500 fill-rose-50" />
                          {p.metrics.likes}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-700" title="Bình luận (Comments)">
                          <MessageCircle className="size-3.5 text-blue-500" />
                          {p.metrics.comments}
                        </span>
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </div>

                  <div className="flex items-center gap-2">
                    {primary.id === "view_detail" ? (
                      <a
                        href={`/kenhbanhang/baiviet/chitiet/${encodeURIComponent(p.id)}`}
                        onClick={(e) => {
                          if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                            e.preventDefault();
                            openPostDetail(p.id);
                          }
                        }}
                        className="inline-flex h-9 w-[125px] items-center justify-center rounded-lg border border-[#6941c6] bg-white text-sm font-medium text-[#6941c6] shadow-2xs transition-colors hover:bg-[#6941c6] hover:text-white"
                      >
                        {primary.label}
                      </a>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => run(primary.id, p)}
                        className={cn("h-9 w-[125px] bg-white text-sm font-medium", primary.violet ? "border-[#6941c6] bg-[#6941c6] text-white shadow-sm hover:border-[#5b36b0] hover:bg-[#5b36b0] hover:text-white hover:shadow-md" : "border-slate-200 text-slate-800")}
                      >
                        {primary.label}
                      </Button>
                    )}
                    <RowMenu post={p} onRun={run} />
                  </div>
                </div>
              );
            })}

            {!rows.length && <Empty>Chưa có bài viết nào.</Empty>}
          </div>
        </div>

        {/* Phân trang */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm text-slate-500">
          <span>Hiển thị {total ? start + 1 : 0} - {Math.min(start + pageSize, total)} trong tổng {total} bài viết</span>
          <div className="flex items-center gap-2">
            <span className="mr-1">Số dòng mỗi trang</span>
            <label className="relative inline-flex items-center">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="h-10 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm text-slate-800 outline-none"
              >
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-slate-500" />
            </label>
            <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Trang trước" className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft className="size-4" />
            </button>
            {pageNumbers(cur, pages).map((n) => (
              <button key={n} onClick={() => setPage(n)} className={cn("grid size-10 place-items-center rounded-full text-sm font-medium", n === cur ? "bg-[#6941c6] text-white" : "text-slate-700 hover:bg-slate-100")}>
                {n}
              </button>
            ))}
            <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Trang sau" className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </section>
      {modals}
    </div>
  );
}
