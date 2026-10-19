import type { ComponentType } from "react";
import {
  AlertCircle, BarChart3, CalendarClock, CalendarDays, CalendarX, CheckCircle2, Copy, ExternalLink,
  Eye, MessageSquare, Pencil, RotateCcw, Send, Trash2, XCircle,
} from "lucide-react";
import type { PostStatus } from "../mock";

/** 6 trạng thái hiển thị của bài viết. */
export type PostState = "draft" | "pending" | "approved" | "scheduled" | "published" | "failed";

export type ActionId =
  | "preview" | "edit" | "edit_reapprove" | "duplicate" | "send_review" | "approve" | "request_changes" | "reject" | "delete"
  | "schedule" | "publish_now" | "view_schedule" | "reschedule" | "cancel_schedule"
  | "view_original" | "view_insights" | "view_error" | "retry"
  | "approve_publish" | "view_detail";

export const ACTIONS: Record<ActionId, { label: string; icon: ComponentType<{ className?: string }>; danger?: boolean }> = {
  preview: { label: "Xem trước", icon: Eye },
  edit: { label: "Chỉnh sửa", icon: Pencil },
  edit_reapprove: { label: "Chỉnh sửa (duyệt lại)", icon: Pencil },
  duplicate: { label: "Nhân bản", icon: Copy },
  send_review: { label: "Gửi duyệt", icon: Send },
  approve: { label: "Phê duyệt", icon: CheckCircle2 },
  request_changes: { label: "Yêu cầu sửa", icon: MessageSquare },
  reject: { label: "Từ chối", icon: XCircle, danger: true },
  delete: { label: "Xóa", icon: Trash2, danger: true },
  schedule: { label: "Lên lịch", icon: CalendarClock },
  publish_now: { label: "Đăng ngay", icon: Send },
  view_schedule: { label: "Xem lịch đăng", icon: CalendarDays },
  reschedule: { label: "Đổi lịch", icon: CalendarClock },
  cancel_schedule: { label: "Hủy lịch", icon: CalendarX, danger: true },
  view_original: { label: "Xem bài gốc", icon: ExternalLink },
  view_insights: { label: "Xem hiệu quả", icon: BarChart3 },
  view_error: { label: "Xem lỗi", icon: AlertCircle },
  retry: { label: "Thử đăng lại", icon: RotateCcw },
  approve_publish: { label: "Duyệt & đăng", icon: Send },
  view_detail: { label: "Xem chi tiết", icon: Eye },
};

/** Menu ba chấm theo trạng thái bài viết (trạng thái nào cũng có 'Xem chi tiết', bỏ 'Xem trước', danger luôn nằm cuối). */
export const MENUS: Record<PostState, ActionId[]> = {
  draft: ["view_detail", "edit", "duplicate", "send_review", "delete"],
  pending: ["view_detail", "edit", "approve", "request_changes", "reject", "delete"],
  approved: ["view_detail", "edit_reapprove", "schedule", "publish_now", "duplicate", "delete"],
  scheduled: ["view_detail", "view_schedule", "reschedule", "cancel_schedule", "duplicate", "delete"],
  published: ["view_detail", "view_original", "view_insights", "duplicate", "delete"],
  failed: ["view_detail", "view_error", "retry", "edit", "duplicate", "delete"],
};

/** Nút chính ở mỗi dòng của danh sách bài viết. */
export const PRIMARY: Record<PostState, { id: ActionId; label: string; violet?: boolean }> = {
  draft: { id: "send_review", label: "Gửi duyệt", violet: true },
  pending: { id: "approve_publish", label: "Duyệt & đăng", violet: true },
  approved: { id: "schedule", label: "Lên lịch" },
  scheduled: { id: "view_schedule", label: "Xem lịch" },
  published: { id: "view_detail", label: "Xem chi tiết" },
  failed: { id: "retry", label: "Thử đăng lại" },
};

/** Trạng thái API → trạng thái hiển thị. */
export function toState(raw: string): PostState {
  if (raw === "draft") return "draft";
  if (raw === "pending" || raw === "pending_approval" || raw === "in_review") return "pending";
  if (raw === "approved" || raw === "publishing") return "approved";
  if (raw === "scheduled") return "scheduled";
  if (raw === "published") return "published";
  return "failed";
}

/** Trạng thái hiển thị → PostStatus của mock (không có "scheduled"/"draft"). */
export const toStatus = (s: PostState): PostStatus =>
  s === "draft" || s === "pending" ? "pending" : s === "approved" || s === "scheduled" ? "approved" : s;
