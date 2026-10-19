import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostStatus } from "./mock";
import { Pill } from "./ui";
import type { PostItem } from "./useUpcomingPosts";

const STATUS: Record<string, { label: string; tone: "amber" | "green" | "violet" | "rose" | "slate" }> = {
  draft: { label: "Bản nháp", tone: "slate" },
  pending: { label: "Chờ duyệt", tone: "amber" },
  approved: { label: "Đã duyệt", tone: "green" },
  scheduled: { label: "Đã lên lịch", tone: "violet" },
  published: { label: "Đã đăng", tone: "green" },
  failed: { label: "Lỗi", tone: "rose" },
};

export function PostStatusPill({ status }: { status: PostStatus | "scheduled" | "draft" }) {
  const s = STATUS[status];
  return <Pill tone={s?.tone ?? "slate"}>{s?.label ?? status}</Pill>;
}

export function PostThumb({ post, className }: { post: PostItem; className?: string }) {
  return post.thumb ? (
    <img
      src={post.thumb}
      alt=""
      className={cn("shrink-0 rounded-md object-cover object-top", className)}
      onError={(e) => {
        (e.currentTarget as HTMLElement).style.display = "none";
      }}
    />
  ) : (
    <span className={cn("grid shrink-0 place-items-center rounded-md bg-gradient-to-br from-violet-50 to-stone-100 text-violet-300", className)}>
      <ImageIcon className="size-5" />
    </span>
  );
}
