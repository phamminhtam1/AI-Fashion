import { useMemo, useState } from "react";
import { CalendarClock, ExternalLink, Image as ImageIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import type { SocialContentItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOCK_POSTS, USE_MOCK_FALLBACK, type PostRow, type PostStatus } from "../mock";
import type { SocialCtx } from "../types";
import { ChannelLogo, Dot, Empty, PageHeader, Pill, card } from "../ui";

export type PostItem = PostRow & { item?: SocialContentItem; caption?: string };

const STATUS: Record<string, { label: string; tone: "amber" | "green" | "violet" | "rose" | "slate" }> = {
  draft: { label: "Bản nháp", tone: "slate" }, pending: { label: "Chờ duyệt", tone: "amber" }, approved: { label: "Đã duyệt", tone: "green" },
  published: { label: "Đã đăng", tone: "violet" }, failed: { label: "Lỗi", tone: "rose" },
};
export function PostStatusPill({ status }: { status: PostStatus }) {
  const s = STATUS[status];
  return <Pill tone={s.tone}>{status === "pending" || status === "approved" ? null : <Dot />}{s.label}</Pill>;
}

export function PostThumb({ post, className }: { post: PostItem; className?: string }) {
  return post.thumb
    ? <img src={post.thumb} alt="" className={cn("shrink-0 rounded-md object-cover", className)} />
    : <span className={cn("grid shrink-0 place-items-center rounded-md bg-gradient-to-br from-violet-50 to-stone-100 text-violet-300", className)}><ImageIcon className="size-5" /></span>;
}

const mapStatus = (s: string): PostStatus => (s === "draft" ? "pending" : s === "approved" || s === "scheduled" || s === "publishing" ? "approved" : s === "published" ? "published" : "failed");

/** Bài viết thật từ API; nếu trống thì dùng data mẫu (xem USE_MOCK_FALLBACK). */
export function useUpcomingPosts(ctx: SocialCtx): PostItem[] {
  const content = ctx.data.content;
  return useMemo(() => {
    if (!content.length) return USE_MOCK_FALLBACK ? MOCK_POSTS : [];
    return content.map((item) => {
      const x = item as SocialContentItem & { scheduledAt?: string | null; createdAt?: string };
      const at = x.scheduledAt ?? x.createdAt;
      return { id: item.id, title: item.title, caption: item.caption, channel: "instagram" as const, status: mapStatus(item.status), thumb: item.mediaUrls[0], permalink: item.permalink,
        time: at ? new Date(at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Chưa đặt lịch", real: true, item };
    });
  }, [content]);
}

const TABS: { id: PostStatus | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" }, { id: "pending", label: "Chờ duyệt" }, { id: "approved", label: "Đã duyệt" }, { id: "published", label: "Đã đăng" }, { id: "failed", label: "Lỗi" },
];

export function PostsPage({ ctx }: { ctx: SocialCtx }) {
  const posts = useUpcomingPosts(ctx);
  const [tab, setTab] = useState<PostStatus | "all">("all");
  const list = posts.filter((p) => tab === "all" || p.status === tab);

  const act = (p: PostItem, now: boolean) => (p.item ? void ctx.approve(p.item, now) : toast.info("Đây là dữ liệu mẫu – chưa nối API bài viết"));

  return (
    <div className="space-y-5 pb-8 text-slate-900">
      <PageHeader onBack={() => ctx.go("overview")} title="Bài viết" desc="Duyệt, lên lịch và theo dõi bài viết trên các kênh bán hàng."
        actions={<Button onClick={() => ctx.go("ai-content")} className="gap-2 bg-[#6941c6] hover:bg-[#5b36b0]"><Plus className="size-4" />Tạo nội dung</Button>} />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={cn("whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold", tab === t.id ? "border-[#6941c6] text-[#6941c6]" : "border-transparent text-slate-500 hover:text-slate-900")}>{t.label} ({t.id === "all" ? posts.length : posts.filter((p) => p.status === t.id).length})</button>)}
      </div>
      <section className={cn(card, "divide-y divide-slate-100")}>
        {list.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
            <PostThumb post={p} className="size-14" />
            <div className="min-w-0 flex-1 basis-56">
              <p className="flex items-center gap-2 font-semibold"><ChannelLogo id={p.channel} size="xs" /><span className="truncate">{p.title}</span></p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{p.caption ?? p.time}</p>
            </div>
            <span className="text-xs text-slate-500">{p.time}</span>
            <PostStatusPill status={p.status} />
            {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" aria-label="Mở bài viết" className="text-slate-400 hover:text-[#6941c6]"><ExternalLink className="size-4" /></a>}
            {p.status === "pending" && <>
              <Button size="sm" variant="outline" onClick={() => act(p, false)} className="gap-1"><CalendarClock className="size-3.5" />Lên lịch</Button>
              <Button size="sm" onClick={() => act(p, true)}>Duyệt & đăng</Button></>}
          </div>))}
        {!list.length && <Empty>Chưa có bài viết nào.</Empty>}
      </section>
    </div>
  );
}
