import { useMemo } from "react";
import type { SocialContentItem } from "@/lib/api";
import type { PostRow, PostStatus } from "./mock";
import type { SocialCtx } from "./types";

export type PostItem = PostRow & {
  item?: SocialContentItem;
  caption?: string;
};

export const mapStatus = (s: string): PostStatus =>
  s === "draft"
    ? "draft"
    : s === "approved" || s === "scheduled" || s === "publishing"
    ? "approved"
    : s === "published"
    ? "published"
    : s === "failed"
    ? "failed"
    : "pending";

/**
 * Trích xuất đoạn caption sạch (loại bỏ dòng CTA và hashtag).
 */
export function extractCleanCaptionLines(caption?: string): string[] {
  if (!caption) return [];
  return caption
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((line) => line && !line.startsWith("👉") && !line.startsWith("🔗") && !line.startsWith("#"));
}

/**
 * Lấy danh sách bài viết thật từ API xã hội.
 */
export function useUpcomingPosts(ctx: SocialCtx): PostItem[] {
  const content = ctx.data.content;
  return useMemo(() => {
    return content.map((item) => {
      const at = item.scheduledAt ?? item.createdAt;
      const cleanLines = extractCleanCaptionLines(item.caption);
      // Ưu tiên hiển thị Nội dung caption làm title thực tế nếu title cũ bị lệch
      const realTitle = cleanLines[0] || item.title || "Chưa có tiêu đề";

      const res: PostItem = {
        id: item.id,
        title: realTitle,
        caption: item.caption,
        channel: "instagram" as const,
        status: mapStatus(item.status),
        permalink: item.permalink,
        time: at ? new Date(at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Chưa đặt lịch",
        real: true,
        item,
        ...(item.mediaUrls?.[0] ? { thumb: item.mediaUrls[0] } : {}),
      };
      return res;
    });
  }, [content]);
}
