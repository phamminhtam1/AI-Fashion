import { useEffect, useState, type ReactNode } from "react";
import {
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  EyeOff,
  Facebook as FacebookIcon,
  Forward,
  Heart,
  Image as ImageIcon,
  Instagram as InstagramIcon,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { adminApi, type SocialConversation, type SocialInboxComment } from "@/lib/api";
import type { ChannelId, SocialCtx } from "../types";
import { PageHeader, card, inputCls } from "../ui";

/* ======================================================================
   Kiểu dữ liệu
   ====================================================================== */
type InboxTab = "messages" | "comments";
type ChannelFilter = "all" | ChannelId;
type CommentStatus = "pending" | "done" | "hidden";
type TagTone = "violet" | "blue" | "red" | "slate";

interface Tag {
  label: string;
  tone: TagTone;
}

interface PostInfo {
  title: string;
  description: string;
  /** URL ảnh. Để "" sẽ hiện ô ảnh placeholder. images[0] là ảnh chính. */
  images: string[];
  postedAt: string;
  likes: string;
  comments: string;
  shares: string;
  saves: string;
}

interface Reply {
  author: string;
  handle: string;
  text: string;
  time: string;
}

interface RelatedComment {
  id: string;
  name: string;
  handle: string;
  channel: ChannelId;
  time: string;
  message: string;
}

interface CommentItem {
  id: string;
  name: string;
  handle: string;
  channel: ChannelId;
  avatar?: string;
  message: string;
  time: string;
  status: CommentStatus;
  post?: PostInfo;
  replies: Reply[];
  related?: RelatedComment[];
  escalationReason?: string;
  real?: boolean;
}

interface ChatMessage {
  from: "customer" | "staff" | "ai";
  text: string;
  time: string;
  images?: string[];
}

interface Thread {
  id: string;
  name: string;
  handle: string;
  channel: ChannelId;
  avatar?: string;
  online?: boolean;
  preview: string;
  time: string;
  unread: number;
  tags: Tag[];
  messages: ChatMessage[];
}

/* ======================================================================
   Hằng số giao diện (lấy từ design)
   ====================================================================== */
const TABS: { id: InboxTab; label: string }[] = [
  { id: "messages", label: "Tin nhắn" },
  { id: "comments", label: "Bình luận" },
];

const CHANNEL_CHIPS: { id: ChannelFilter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
];

const CHANNEL_NAME: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  shopee: "Shopee",
};

const STATUS_CHIPS: { id: "all" | CommentStatus; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chưa trả lời" },
  { id: "done", label: "Đã xử lý" },
  { id: "hidden", label: "Đã ẩn" },
];

const STATUS_LABEL: Record<CommentStatus, string> = {
  pending: "Chưa trả lời",
  done: "Đã xử lý",
  hidden: "Đã ẩn",
};

const STATUS_STYLE: Record<CommentStatus, string> = {
  pending: "bg-[#fff1df] text-[#f27a0a]",
  done: "bg-[#e3f6e8] text-[#1fa24a]",
  hidden: "bg-[#fde7ea] text-[#e03a52]",
};

const TAG_STYLE: Record<TagTone, string> = {
  violet: "bg-[#ece7ff] text-[#6941c6]",
  blue: "bg-[#e0efff] text-[#2b7de9]",
  red: "bg-[#fde7ea] text-[#e03a52]",
  slate: "bg-slate-100 text-slate-700",
};

const AVATAR_TONES = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
];

const TIKTOK_PATH =
  "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";


/* ======================================================================
   Helpers
   ====================================================================== */
function formatInboxTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function nowTime() {
  return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function toComment(item: SocialInboxComment): CommentItem {
  const handle = item.authorUsername || "instagram_user";
  const status: CommentStatus = item.status === "hidden" ? "hidden" : item.status === "replied" || item.status === "ignored" ? "done" : "pending";
  const post = item.post ? {
    title: item.post.title,
    description: item.post.caption,
    images: item.post.mediaUrls,
    postedAt: formatInboxTime(item.post.publishedAt || item.post.createdAt),
    likes: String(item.post.likes ?? 0), comments: String(item.post.comments ?? 0), shares: String(item.post.shares ?? 0), saves: String(item.post.saves ?? 0),
  } : undefined;
  return { id: item.id, name: handle, handle, channel: "instagram", message: item.message, time: formatInboxTime(item.createdAt), status, post,
    replies: item.aiReply ? [{ author: "ÉLANE", handle: "elane.official", text: item.aiReply, time: item.repliedAt ? formatInboxTime(item.repliedAt) : "" }] : [], escalationReason: item.escalationReason || undefined, real: true };
}

function toThread(item: SocialConversation): Thread {
  const messages = item.messages.map((message) => ({ from: message.direction === "outbound" ? "staff" as const : "customer" as const, text: message.text, time: formatInboxTime(message.createdAt) }));
  const latest = messages[messages.length - 1];
  return { id: item.id, name: item.name, handle: item.handle, channel: item.channel, online: false, preview: latest?.text || "", time: formatInboxTime(item.updatedAt), unread: item.unread, tags: [], messages };
}

function relatedFor(item: CommentItem, all: CommentItem[]): RelatedComment[] {
  if (item.related) return item.related;
  return all
    .filter((i) => i.id !== item.id)
    .slice(0, 3)
    .map((i) => ({ id: i.id, name: i.name, handle: i.handle, channel: i.channel, time: i.time, message: i.message }));
}

/* ======================================================================
   Thành phần dùng chung
   ====================================================================== */
function ChannelLogo({ id, size = 20, round = false, className }: { id: ChannelId; size?: number; round?: boolean; className?: string }) {
  const glyph = Math.round(size * 0.6);
  const shape = round || id === "facebook" ? "rounded-full" : "rounded-md";
  const style =
    id === "instagram"
      ? { width: size, height: size, background: "linear-gradient(45deg,#fdb43c,#ee2a7b 55%,#6228d7)" }
      : { width: size, height: size };
  const bg = id === "facebook" ? "bg-[#1877f2]" : id === "tiktok" ? "bg-black" : id === "instagram" ? "" : "bg-[#ee4d2d]";
  return (
    <span style={style} className={cn("inline-grid shrink-0 place-items-center text-white", shape, bg, className)}>
      {id === "facebook" ? (
        <FacebookIcon width={glyph} height={glyph} fill="currentColor" strokeWidth={0} />
      ) : id === "instagram" ? (
        <InstagramIcon width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} strokeWidth={2.2} />
      ) : id === "tiktok" ? (
        <svg viewBox="0 0 24 24" width={glyph} height={glyph} fill="currentColor" aria-hidden>
          <path d={TIKTOK_PATH} />
        </svg>
      ) : (
        <span className="text-[10px] font-bold leading-none">S</span>
      )}
    </span>
  );
}

function Avatar({ name, src, size = 50, channel, badge, className }: { name: string; src?: string; size?: number; channel?: ChannelId; badge?: number; className?: string }) {
  const clean = name.replace(/^@/, "").trim();
  const initial = (clean.slice(0, 1) || "?").toUpperCase();
  const tone = AVATAR_TONES[[...clean].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="size-full rounded-full object-cover" />
      ) : (
        <span className={cn("grid size-full place-items-center rounded-full font-semibold", tone)} style={{ fontSize: Math.round(size * 0.38) }}>
          {initial}
        </span>
      )}
      {channel && <ChannelLogo id={channel} round size={badge ?? Math.round(size * 0.4)} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white" />}
    </span>
  );
}

function BrandAvatar() {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-black font-serif text-[7px] font-semibold tracking-wider text-white">
      ÉLANE
    </span>
  );
}

function Picture({ src, className, alt = "" }: { src?: string; className?: string; alt?: string }) {
  if (src) return <img src={src} alt={alt} className={cn("object-cover", className)} />;
  return (
    <span className={cn("grid place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400", className)}>
      <ImageIcon className="size-5" />
    </span>
  );
}

function StatusPill({ status, className }: { status: CommentStatus; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-3 text-[13px] font-medium", STATUS_STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="grid h-full min-h-[200px] place-items-center p-6 text-center text-sm text-slate-400">{children}</div>;
}

function TabIcon({ kind, active }: { kind: InboxTab; active: boolean }) {
  const line = active ? "#fff" : "currentColor";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === "messages" ? (
        <>
          <path d="M5 3h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7.5L7 21v-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M7.5 8h9M7.5 12h5.5" stroke={line} />
        </>
      ) : (
        <>
          <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" />
          <circle cx="8" cy="12" r="1" fill={line} stroke="none" />
          <circle cx="12" cy="12" r="1" fill={line} stroke="none" />
          <circle cx="16" cy="12" r="1" fill={line} stroke="none" />
        </>
      )}
    </svg>
  );
}

function InboxHeader({ ctx, tab }: { ctx: SocialCtx; tab: InboxTab }) {
  return (
    <div>
      <PageHeader
        title={tab === "messages" ? "Tin nhắn" : "Bình luận"}
        desc={tab === "messages" ? "Theo dõi và trả lời tin nhắn từ các kênh bán hàng." : "Quản lý và phản hồi bình luận trên các bài đăng."}
        onBack={() => ctx.go("overview")}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => ctx.go("channel-manage", { tab: "inbox" })}
            className="gap-2 border-violet-200 bg-violet-50 text-[#6941c6] hover:bg-violet-100 hover:text-[#6941c6]"
          >
            <Settings />
            Cài đặt tự động trả lời
          </Button>
        }
      />
      <div className="mt-4 flex w-fit border-b border-slate-200">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => ctx.go(item.id)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors",
                active ? "border-[#6941c6] font-semibold text-[#6941c6]" : "border-transparent font-medium text-slate-500 hover:text-slate-800",
              )}
            >
              <TabIcon kind={item.id} active={active} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="mt-3 flex gap-2">
      <label className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-500" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(inputCls, "pl-10")}
        />
      </label>
      <button
        type="button"
        aria-label="Bộ lọc"
        onClick={() => toast.info("Bộ lọc nâng cao đang được cập nhật")}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xs border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      >
        <SlidersHorizontal className="size-[18px]" />
      </button>
    </div>
  );
}

function ChannelChips({ value, onChange, className }: { value: ChannelFilter; onChange: (v: ChannelFilter) => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {CHANNEL_CHIPS.map((chip) => {
        const active = value === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            className={cn(
              "inline-flex h-9 items-center rounded-xs border text-[13px] font-medium",
              chip.id === "all" ? "px-3 text-sm" : "gap-1.5 px-2",
              active ? "border-[#6941c6] bg-[#f3efff] text-[#6941c6]" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
            )}
          >
            {chip.id !== "all" && <ChannelLogo id={chip.id} size={20} />}
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

function TagChip({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
  return (
    <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium", TAG_STYLE[tag.tone])}>
      {tag.label}
      <button type="button" onClick={onRemove} aria-label={`Xóa ${tag.label}`} className="opacity-80 hover:opacity-100">
        <X className="size-3.5" strokeWidth={2.2} />
      </button>
    </span>
  );
}

function AddChip({ label, onAdd }: { label: string; onAdd: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const commit = () => {
    const v = value.trim();
    if (v) onAdd(v);
    setValue("");
    setOpen(false);
  };
  if (open) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        placeholder={label}
         className="h-8 w-36 rounded-xs border border-[#6941c6] px-2.5 text-sm outline-none"
      />
    );
  }
  return (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xs border border-[#6941c6] bg-white px-3 text-sm font-medium text-[#6941c6] hover:bg-[#f4f0ff]">
      <Plus className="size-4" />
      {label}
    </button>
  );
}

function PostPlatformRow({ post }: { post: PostInfo }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      <ChannelLogo id="instagram" size={24} />
      <span>Instagram</span>
      <span className="text-slate-400">•</span>
      <span className="text-slate-500">Đăng ngày {post.postedAt}</span>
    </div>
  );
}

function PostStats({ post }: { post: PostInfo }) {
  const stats = [
    { Icon: Heart, value: post.likes },
    { Icon: MessageCircle, value: post.comments },
    { Icon: Forward, value: post.shares },
    { Icon: Bookmark, value: post.saves },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-slate-600">
      {stats.map(({ Icon, value }, index) => (
        <span key={index} className="inline-flex items-center gap-2">
          <Icon className="size-5 text-slate-600" strokeWidth={1.7} />
          {value}
        </span>
      ))}
    </div>
  );
}

/* ======================================================================
   BÌNH LUẬN
   ====================================================================== */
function CommentList({
  items,
  selectedId,
  onSelect,
  query,
  setQuery,
}: {
  items: CommentItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  query: string;
  setQuery: (v: string) => void;
}) {
  return (
    <section className={cn(card, "flex max-h-[560px] min-h-0 flex-col overflow-hidden lg:max-h-none")}>
      <div className="shrink-0 p-4 pb-3">
       <h2 className="text-lg font-semibold leading-7 text-slate-900">Bình luận cần xử lý</h2>
        <ListSearch value={query} onChange={setQuery} placeholder="Tìm kiếm bình luận..." />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.map((item) => {
          const active = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "relative flex w-full items-center gap-4 border-b border-slate-100 px-4 py-2.5 text-left transition-colors",
                active ? "bg-[#efebff]" : "hover:bg-slate-50",
              )}
            >
               {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-[#6941c6]" />}
              <Avatar name={item.name} src={item.avatar} channel={item.channel} size={50} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold leading-5 text-slate-900">{item.name}</span>
                <span className="mt-0.5 block truncate text-sm leading-5 text-slate-700">{item.message}</span>
                <span className="mt-0.5 block truncate text-xs leading-4 text-slate-400">{item.post?.title ?? "Bình luận Instagram"}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="text-sm leading-5 text-slate-500">{item.time}</span>
                <StatusPill status={item.status} className="-mt-0.5" />
              </span>
            </button>
          );
        })}
        {!items.length && <Empty>Không có bình luận phù hợp.</Empty>}
      </div>
    </section>
  );
}

function CommentDetail({
  item,
  draft,
  setDraft,
  onSend,
  onSuggest,
  onHide,
  onDelete,
  onDone,
  onRetry,
}: {
  item?: CommentItem;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  onSuggest: () => void;
  onHide: () => void;
  onDelete: () => void;
  onDone: () => void;
  onRetry: () => void;
}) {
  return (
    <section className={cn(card, "flex min-h-[520px] min-w-0 flex-col overflow-hidden lg:min-h-0")}>
      <div className="flex shrink-0 items-center justify-between p-4 pb-0">
         <h2 className="text-lg font-semibold leading-7 text-slate-900">Chi tiết bình luận</h2>
         <button type="button" aria-label="Thao tác khác" onClick={() => toast.info("Đã mở thêm thao tác bình luận")} className="grid size-7 place-items-center rounded-xs border border-slate-200 text-slate-600 hover:bg-slate-50">
          <MoreVertical className="size-4" />
        </button>
      </div>

      {!item ? (
        <Empty>Chọn một bình luận để xem chi tiết.</Empty>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
          {item.post && (
            <div className="rounded-lg border border-slate-200 p-3.5">
              <div className="flex gap-4">
                 <Picture src={item.post.images[0]} alt={item.post.title} className="size-[170px] shrink-0 rounded-xs" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold leading-6 text-slate-900">{item.post.title}</h3>
                  <p className="mt-1.5 text-sm leading-[21px] text-slate-500">{item.post.description}</p>
                  <div className="mt-3 flex gap-2.5">
                    {item.post.images.slice(0, 4).map((src, index) => (
                       <Picture key={index} src={src} className="size-[68px] rounded-xs" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <PostPlatformRow post={item.post} />
              </div>
              <div className="mt-2.5">
                <PostStats post={item.post} />
              </div>
            </div>
          )}

          <div className={cn("flex items-start gap-3", item.post && "mt-3.5")}>
            <Avatar name={item.name} src={item.avatar} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 max-w-full rounded-xl bg-[#f1f1f6] px-3.5 py-2.5">
                  <p className="truncate text-[15px] leading-5">
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <span className="ml-2 text-sm text-slate-500">@{item.handle}</span>
                  </p>
                  <p className="mt-1 text-base leading-6 text-slate-800">{item.message}</p>
                </div>
                <button type="button" aria-label="Thao tác bình luận" className="mt-2.5 shrink-0 text-slate-500 hover:text-slate-800">
                  <MoreHorizontal className="size-5" />
                </button>
              </div>
              <p className="mt-1.5 pl-0.5 text-sm text-slate-500">{item.time}</p>
            </div>
          </div>

          {item.replies.map((reply, index) => (
            <div key={index} className="ml-11 mt-5 flex items-start gap-3">
              <BrandAvatar />
              <div className="min-w-0 flex-1">
                <div className="rounded-xl bg-[#ebe6ff] px-3.5 py-2.5">
                  <p className="text-[15px] leading-5">
                    <span className="font-bold text-slate-900">{reply.author}</span>
                    <span className="ml-2 text-sm text-slate-500">@{reply.handle}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-line text-base leading-6 text-slate-800">{reply.text}</p>
                </div>
                {reply.time && <p className="mt-1.5 pl-0.5 text-sm text-slate-500">{reply.time}</p>}
              </div>
            </div>
          ))}

          {item.escalationReason && (
            <div className="ml-11 mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              <span>Cần nhân viên xử lý: {item.escalationReason}</span>
               <button type="button" onClick={onRetry} className="shrink-0 font-semibold text-[#6941c6] hover:underline">
                Thử AI lại
              </button>
            </div>
          )}

          <div className="mt-3.5 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSend();
                }}
                placeholder="Viết phản hồi công khai..."
                 className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm text-slate-900 caret-[#6941c6] outline-none placeholder:text-slate-400"
              />
               <button type="button" onClick={onSuggest} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xs border border-[#6941c6] bg-white px-3 text-sm font-medium text-[#6941c6] hover:bg-[#f4f0ff]">
                <Sparkles className="size-4" />
                Gợi ý trả lời
                <ChevronDown className="size-4" />
              </button>
            </div>
             <div className="mt-2 flex h-[88px] items-end justify-between rounded-xs border border-slate-200 p-3">
              <div className="flex items-center gap-4 text-slate-600">
                <button type="button" aria-label="Biểu tượng cảm xúc" onClick={() => toast.info("Chọn biểu tượng cảm xúc")}>
                  <Smile className="size-[22px]" strokeWidth={1.7} />
                </button>
                <button type="button" aria-label="Chèn hình ảnh" onClick={() => toast.info("Chọn hình ảnh để đính kèm")}>
                  <ImageIcon className="size-[22px]" strokeWidth={1.7} />
                </button>
                <button type="button" aria-label="Chèn GIF" onClick={() => toast.info("Chọn GIF để đính kèm")} className="rounded border border-slate-500 px-1 text-[10px] font-bold leading-4 text-slate-600">
                  GIF
                </button>
              </div>
             <button type="button" onClick={onSend} className="h-9 min-w-[86px] rounded-xs bg-[#6941c6] px-5 text-sm font-semibold text-white hover:bg-[#5b36b0]">
                Trả lời
              </button>
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2.5">
             <button type="button" onClick={onHide} className="inline-flex h-9 items-center gap-2 rounded-xs border border-[#ff8a1f] bg-white px-3.5 text-sm font-semibold text-[#f26d00] hover:bg-orange-50">
                <EyeOff className="size-5" />
                Ẩn bình luận
              </button>
             <button type="button" onClick={onDelete} className="inline-flex h-9 items-center gap-2 rounded-xs border border-[#ef4444] bg-white px-3.5 text-sm font-semibold text-[#e11d2e] hover:bg-red-50">
                <Trash2 className="size-5" />
                Xóa
              </button>
            </div>
             <button type="button" onClick={onDone} className="inline-flex h-9 items-center gap-2 rounded-xs border border-[#22a447] bg-white px-3.5 text-sm font-semibold text-[#1f9a43] hover:bg-green-50">
              <span className="grid size-5 place-items-center rounded-full bg-[#22a447]">
                <Check className="size-3 text-white" strokeWidth={3.2} />
              </span>
              Đánh dấu đã xử lý
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function CommentSidebar({
  post,
  autoReply,
  setAutoReply,
  keywords,
  onAddKeyword,
  onRemoveKeyword,
  related,
  onSelect,
}: {
  post?: PostInfo;
  autoReply: boolean;
  setAutoReply: (v: boolean) => void;
  keywords: Tag[];
  onAddKeyword: (v: string) => void;
  onRemoveKeyword: (index: number) => void;
  related: RelatedComment[];
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const description = post ? (expanded || post.description.length <= 72 ? post.description : `${post.description.slice(0, 70).trim()}...`) : "";
  return (
    <aside className="flex min-h-0 min-w-0 flex-col gap-3 lg:overflow-y-auto">
      <div className={cn(card, "shrink-0 p-4")}>
        <h2 className="text-lg font-semibold leading-7 text-slate-900">Thông tin bài đăng</h2>
        {post ? (
          <>
            <div className="mt-3 flex gap-3.5">
               <Picture src={post.images[0]} alt={post.title} className="size-[111px] shrink-0 rounded-xs" />
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-bold leading-5 text-slate-900">{post.title}</h3>
                <p className="mt-1.5 text-sm leading-[21px] text-slate-500">
                  {description}
                  {!expanded && post.description.length > 72 && (
                     <button type="button" onClick={() => setExpanded(true)} className="ml-1.5 font-medium text-[#6941c6] hover:underline">
                      Xem thêm
                    </button>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <PostPlatformRow post={post} />
            </div>
            <div className="mt-3">
              <PostStats post={post} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Chưa có thông tin bài đăng.</p>
        )}
      </div>

      <div className={cn(card, "flex shrink-0 items-center justify-between gap-4 p-4")}>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-7 text-slate-900">Tự động trả lời</h2>
          <p className="mt-0.5 text-sm text-slate-500">Tự động phản hồi bình luận chứa từ khóa</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoReply}
          aria-label="Tự động trả lời"
          onClick={() => setAutoReply(!autoReply)}
           className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", autoReply ? "bg-[#6941c6]" : "bg-slate-300")}
        >
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", autoReply ? "left-[22px]" : "left-0.5")} />
        </button>
      </div>

      <div className={cn(card, "shrink-0 p-4")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold leading-7 text-slate-900">Từ khóa cần chú ý</h2>
          <AddChip label="Thêm từ khóa" onAdd={onAddKeyword} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {keywords.map((tag, index) => (
            <TagChip key={`${tag.label}-${index}`} tag={tag} onRemove={() => onRemoveKeyword(index)} />
          ))}
          {!keywords.length && <p className="text-sm text-slate-400">Chưa có từ khóa nào.</p>}
        </div>
      </div>

      <div className={cn(card, "shrink-0 p-4")}>
        <h2 className="text-lg font-semibold leading-7 text-slate-900">Bình luận liên quan ({related.length})</h2>
        <ul className="mt-2 divide-y divide-slate-100">
          {related.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item.id)} className="flex w-full items-start gap-3 py-3 text-left">
                <Avatar name={item.name} channel={item.channel} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm leading-5">
                      <span className="font-semibold text-slate-900">{item.name}</span>
                      <span className="ml-1.5 text-xs text-slate-500">@{item.handle}</span>
                    </span>
                    <span className="shrink-0 text-xs leading-5 text-slate-500">{item.time}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-slate-600">{item.message}</span>
                    <MoreHorizontal className="size-4 shrink-0 text-slate-500" />
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!related.length && <li className="py-3 text-sm text-slate-400">Chưa có bình luận liên quan.</li>}
        </ul>
      </div>
    </aside>
  );
}

export function CommentsPage({ ctx }: { ctx: SocialCtx }) {
  const [source, setSource] = useState<CommentItem[]>([]);
  const [overrides, setOverrides] = useState<Record<string, CommentStatus | "deleted">>({});
  const [sent, setSent] = useState<Record<string, Reply[]>>({});
  const [selectedId, setSelectedId] = useState<string | undefined>(source[0]?.id);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CommentStatus>("all");
  const [draft, setDraft] = useState("");
  const [autoReply, setAutoReply] = useState(Boolean(ctx.data.connections[0]?.autoReplyEnabled));
  const [keywords, setKeywords] = useState<Array<Tag & { id: string }>>([]);

  useEffect(() => {
    let active = true;
    adminApi.socialInboxComments().then((rows) => {
      if (active) setSource(rows.filter((row) => row.status !== "deleted").map(toComment));
    }).catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Không tải được bình luận"); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    adminApi.socialReplyKeywords().then((rows) => {
      if (active) setKeywords(rows.map((row) => ({ id: row.id, label: row.keyword, tone: "violet" })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const items: CommentItem[] = source
    .filter((i) => overrides[i.id] !== "deleted")
    .map((i) => {
      const o = overrides[i.id];
      return { ...i, status: o && o !== "deleted" ? o : i.status, replies: [...i.replies, ...(sent[i.id] ?? [])] };
    });

  const q = query.trim().toLowerCase();
  const filtered = items.filter(
    (i) =>
      (channel === "all" || i.channel === channel) &&
      (statusFilter === "all" || i.status === statusFilter) &&
      (!q || `${i.name} ${i.handle} ${i.message}`.toLowerCase().includes(q)),
  );
  const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0];

  const counts = {
    all: items.length,
    pending: items.filter((i) => i.status === "pending").length,
    done: items.filter((i) => i.status === "done").length,
    hidden: items.filter((i) => i.status === "hidden").length,
  };

  const setStatus = async (status: CommentStatus | "deleted", message: string) => {
    if (!selected) return;
    const action = status === "done" ? "resolve" : status;
    try {
      await adminApi.updateSocialComment(selected.id, action);
      setOverrides((all) => ({ ...all, [selected.id]: status }));
      toast.success(message);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể cập nhật bình luận"); }
  };

  const send = async () => {
    const text = draft.trim();
    if (!selected || !text) return;
    try {
      await adminApi.replySocialComment(selected.id, text);
      setSent((all) => ({ ...all, [selected.id]: [...(all[selected.id] ?? []), { author: "ÉLANE", handle: "elane.official", text, time: nowTime() }] }));
      setOverrides((all) => ({ ...all, [selected.id]: "done" }));
      setDraft(""); toast.success("Đã gửi phản hồi");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể gửi phản hồi"); }
  };

  const suggest = () => {
    if (!selected) return;
    setDraft(`Chào ${selected.name.replace(/^@/, "")}! Cảm ơn bạn đã quan tâm đến sản phẩm của ÉLANE. Bạn nhắn tin trực tiếp để shop tư vấn thêm nhé!`);
  };

  const retry = () => {
    if (!selected) return;
    void ctx.retryReply(selected.id);
  };

  return (
    <div className="text-slate-900 lg:flex lg:h-[calc(111.111dvh-88px)] lg:min-h-[720px] lg:flex-col">
      <InboxHeader ctx={ctx} tab="comments" />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ChannelChips value={channel} onChange={setChannel} />
        <span className="hidden h-7 w-px bg-slate-200 sm:block" />
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_CHIPS.map((chip) => {
            const active = statusFilter === chip.id;
            return (
              <button key={chip.id} type="button" onClick={() => setStatusFilter(chip.id)} className={cn(
                "h-9 rounded-xs px-3 text-sm transition-colors",
                active ? "bg-[#ede8ff] font-semibold text-[#6941c6]" : "bg-slate-50 font-medium text-slate-600 hover:bg-slate-100",
              )}>
                {chip.label} ({counts[chip.id]})
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(280px,340px)]">
        <CommentList
          items={filtered}
          selectedId={selected?.id}
          onSelect={setSelectedId}
          query={query}
          setQuery={setQuery}
        />
        <CommentDetail
          item={selected}
          draft={draft}
          setDraft={setDraft}
          onSend={send}
          onSuggest={suggest}
          onHide={() => void setStatus("hidden", "Đã ẩn bình luận")}
          onDelete={() => void setStatus("deleted", "Đã xóa bình luận")}
          onDone={() => void setStatus("done", "Đã đánh dấu đã xử lý")}
          onRetry={retry}
        />
        <CommentSidebar
          post={selected?.post}
          autoReply={autoReply}
          setAutoReply={(enabled) => {
            const connection = ctx.data.connections[0];
            if (!connection) return toast.error("Chưa có kênh Instagram để cấu hình tự động trả lời");
            void adminApi.setSocialAutoReply(connection.id, enabled).then(() => { setAutoReply(enabled); toast.success(enabled ? "Đã bật tự động trả lời" : "Đã tắt tự động trả lời"); }).catch((error) => toast.error(error instanceof Error ? error.message : "Không thể cập nhật cấu hình"));
          }}
          keywords={keywords}
          onAddKeyword={(label) => void adminApi.addSocialReplyKeyword(label, ctx.data.connections[0]?.id).then((row) => { setKeywords((all) => [...all, { id: row.id, label: row.keyword, tone: "violet" }]); toast.success("Đã thêm từ khóa"); }).catch((error) => toast.error(error instanceof Error ? error.message : "Không thể thêm từ khóa"))}
          onRemoveKeyword={(index) => { const keyword = keywords[index]; if (!keyword) return; void adminApi.deleteSocialReplyKeyword(keyword.id).then(() => setKeywords((all) => all.filter((_, i) => i !== index))).catch((error) => toast.error(error instanceof Error ? error.message : "Không thể xóa từ khóa")); }}
          related={selected ? relatedFor(selected, items) : []}
          onSelect={(id) => {
            if (items.some((i) => i.id === id)) setSelectedId(id);
          }}
        />
      </div>
    </div>
  );
}

/* ======================================================================
   TIN NHẮN
   ====================================================================== */
function ConversationList({
  threads,
  selectedId,
  onSelect,
  query,
  setQuery,
}: {
  threads: Thread[];
  selectedId?: string;
  onSelect: (thread: Thread) => void;
  query: string;
  setQuery: (v: string) => void;
}) {
  return (
    <section className={cn(card, "flex max-h-[560px] min-h-0 flex-col overflow-hidden lg:max-h-none")}>
      <div className="shrink-0 p-4 pb-3">
        <h2 className="text-lg font-semibold leading-7 text-slate-900">Hộp thư</h2>
        <ListSearch value={query} onChange={setQuery} placeholder="Tìm kiếm tin nhắn..." />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.map((thread) => {
          const active = selectedId === thread.id;
          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelect(thread)}
              className={cn(
                "relative flex w-full items-center gap-4 border-b border-slate-100 px-4 py-[13px] text-left transition-colors",
                active ? "bg-[#efebff]" : "hover:bg-slate-50",
              )}
            >
               {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-[#6941c6]" />}
              <Avatar name={thread.name} src={thread.avatar} channel={thread.channel} size={50} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold leading-5 text-slate-900">{thread.name}</span>
                <span className="mt-0.5 block truncate text-sm leading-5 text-slate-600">{thread.preview}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-sm leading-5 text-slate-500">{thread.time}</span>
                {thread.unread > 0 ? (
                  <span className="grid size-[22px] place-items-center rounded-full bg-[#6941c6] text-xs font-semibold text-white">{thread.unread}</span>
                ) : (
                  <span className="size-[22px]" />
                )}
              </span>
            </button>
          );
        })}
        {!threads.length && <Empty>Không tìm thấy hội thoại.</Empty>}
      </div>
    </section>
  );
}

function ConversationPane({ thread, draft, setDraft, onSend }: { thread?: Thread; draft: string; setDraft: (v: string) => void; onSend: () => void }) {
  if (!thread) {
    return (
      <section className={cn(card, "min-h-[520px] lg:min-h-0")}>
        <Empty>Chọn một cuộc trò chuyện để bắt đầu xử lý.</Empty>
      </section>
    );
  }
  return (
    <section className={cn(card, "flex min-h-[520px] min-w-0 flex-col overflow-hidden lg:min-h-0")}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={thread.name} src={thread.avatar} channel={thread.channel} size={60} badge={22} />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-6 text-slate-900">{thread.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <ChannelLogo id={thread.channel} size={20} />
                {CHANNEL_NAME[thread.channel] ?? thread.channel}
              </span>
              {thread.online && (
                <span className="inline-flex items-center gap-2 text-[#16a34a]">
                  <span className="size-2.5 rounded-full bg-[#22c55e]" />
                  Đang hoạt động
                </span>
              )}
            </div>
          </div>
        </div>
         <button type="button" aria-label="Thao tác hội thoại" onClick={() => toast.info("Đã mở thêm thao tác hội thoại")} className="grid size-9 shrink-0 place-items-center rounded-xs border border-slate-200 text-slate-600 hover:bg-slate-50">
          <MoreVertical className="size-[18px]" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div className="flex justify-center">
          <span className="rounded-full bg-slate-100 px-4 py-1 text-sm text-slate-600">Hôm nay</span>
        </div>
        {thread.messages.map((message, index) => {
          const mine = message.from !== "customer";
          return (
            <div key={`${message.time}-${index}`} className={cn("flex items-start gap-3", mine ? "justify-end" : "justify-start")}>
              {!mine && <Avatar name={thread.name} src={thread.avatar} size={40} />}
              <div className={cn("flex min-w-0 max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
                <div className={cn("rounded-xl px-3.5 py-2.5 text-base leading-6 text-slate-800", mine ? "bg-[#e9e4ff]" : "bg-[#f1f1f6]")}>
                  {message.from === "ai" && (
                 <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-[#6941c6]">
                      <Sparkles className="size-3" />
                      AI đã trả lời
                    </p>
                  )}
                  <p className="whitespace-pre-line">{message.text}</p>
                  {message.images && message.images.length > 0 && (
                    <div className="mt-2 flex gap-2">
                      {message.images.map((src, i) => (
                         <Picture key={i} src={src} className="size-[94px] rounded-xs" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  {message.time}
                   {mine && <CheckCheck className="size-[18px] text-[#6941c6]" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 px-4 py-3">
        <div className="flex items-center gap-0.5 text-slate-600">
          {[
            { Icon: ImageIcon, label: "Hình ảnh" },
            { Icon: Paperclip, label: "Đính kèm" },
            { Icon: Smile, label: "Biểu tượng cảm xúc" },
          ].map(({ Icon, label }) => (
             <button key={label} type="button" aria-label={label} onClick={() => toast.info(`${label} sẽ được mở tại đây`)} className="grid size-8 place-items-center rounded-xs hover:bg-slate-100">
              <Icon className="size-[22px]" strokeWidth={1.7} />
            </button>
          ))}
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          placeholder="Nhập tin nhắn..."
           className={cn(inputCls, "min-w-0 flex-1 px-3.5")}
        />
         <button type="button" onClick={onSend} className="h-9 shrink-0 rounded-xs bg-[#6941c6] px-5 text-sm font-semibold text-white hover:bg-[#5b36b0]">
          Gửi
        </button>
      </div>
    </section>
  );
}

function ConversationInfo({ thread }: { thread?: Thread }) {
  return (
    <aside className={cn(card, "min-h-0 min-w-0 overflow-y-auto p-5")}>
      <h2 className="text-lg font-semibold leading-7 text-slate-900">Thông tin cuộc trò chuyện</h2>
      {!thread ? (
        <p className="mt-4 text-sm text-slate-400">Chưa chọn cuộc trò chuyện.</p>
      ) : (
        <>
          <div className="mt-5 flex items-start gap-5">
            <Avatar name={thread.name} src={thread.avatar} channel={thread.channel} size={100} badge={26} />
            <div className="min-w-0 pt-1">
              <p className="truncate text-lg font-bold leading-6 text-slate-900">{thread.name}</p>
              <p className="mt-1 truncate text-base text-slate-500">@{thread.handle}</p>
              <p className="mt-2 flex items-center gap-2 text-base text-slate-600">
                <ChannelLogo id={thread.channel} size={22} />
                {CHANNEL_NAME[thread.channel] ?? thread.channel}
              </p>
              {thread.online && (
                <p className="mt-2 flex items-center gap-2 text-[15px] text-[#16a34a]">
                  <span className="size-2.5 rounded-full bg-[#22c55e]" />
                  Đang hoạt động
                </p>
              )}
            </div>
          </div>

           <button type="button" onClick={() => toast.info("Mở trang cá nhân trên mạng xã hội")} className="mt-5 inline-flex items-center gap-2.5 text-sm font-medium text-[#6941c6] hover:underline">
            <ExternalLink className="size-5" />
            Xem trang cá nhân
          </button>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold leading-7 text-slate-900">Thẻ cuộc trò chuyện</h3>
            </div>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {thread.tags.map((tag, index) => (
                <span key={`${tag.label}-${index}`} className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium", TAG_STYLE[tag.tone])}>{tag.label}</span>
              ))}
              {!thread.tags.length && <p className="text-sm text-slate-400">Chưa có thẻ nào.</p>}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

export function MessagesPage({ ctx }: { ctx: SocialCtx }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [id, setId] = useState<string | undefined>();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("all");

  useEffect(() => {
    let active = true;
    adminApi.socialConversations().then((rows) => {
      if (!active) return;
      const next = rows.map(toThread);
      setThreads(next);
      setId((current) => current && next.some((thread) => thread.id === current) ? current : next[0]?.id);
    }).catch((error) => { if (active) toast.error(error instanceof Error ? error.message : "Không tải được tin nhắn"); });
    return () => { active = false; };
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = threads.filter((thread) => {
    const haystack = `${thread.name} ${thread.preview} ${thread.messages.map((m) => m.text).join(" ")}`.toLowerCase();
    return (!q || haystack.includes(q)) && (channel === "all" || thread.channel === channel);
  });
  const selected = filtered.find((thread) => thread.id === id) ?? filtered[0];

  const patchSelected = (fn: (thread: Thread) => Thread) => {
    if (!selected) return;
    setThreads((all) => all.map((thread) => (thread.id === selected.id ? fn(thread) : thread)));
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !selected) return;
    try {
      await adminApi.sendSocialMessage(selected.id, text);
      patchSelected((thread) => ({ ...thread, unread: 0, preview: text, time: "Vừa xong", messages: [...thread.messages, { from: "staff", text, time: nowTime() }] }));
      setDraft("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể gửi tin nhắn"); }
  };

  const selectThread = (thread: Thread) => {
    setId(thread.id);
    setThreads((all) => all.map((item) => (item.id === thread.id ? { ...item, unread: 0 } : item)));
  };

  return (
    <div className="text-slate-900 lg:flex lg:h-[calc(111.111dvh-88px)] lg:min-h-[720px] lg:flex-col">
      <InboxHeader ctx={ctx} tab="messages" />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ChannelChips value={channel} onChange={setChannel} />
      </div>
      <div className="mt-5 grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(280px,340px)]">
        <ConversationList threads={filtered} selectedId={selected?.id} onSelect={selectThread} query={query} setQuery={setQuery} />
        <ConversationPane thread={selected} draft={draft} setDraft={setDraft} onSend={send} />
        <ConversationInfo thread={selected} />
      </div>
      {!threads.length && <p className="mt-3 shrink-0 text-xs text-slate-400">Chưa có tin nhắn từ kênh đã kết nối.</p>}
    </div>
  );
}
