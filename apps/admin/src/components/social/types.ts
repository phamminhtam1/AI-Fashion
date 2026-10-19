import type { Dispatch, SetStateAction } from "react";
import type { SocialOverview, SocialContentItem, SocialPlatformSettings } from "@/lib/api";

export type SocialPage =
  | "overview" | "connect" | "channel-manage" | "add-channel"
  | "ai-content" | "posts" | "messages" | "comments";

/** Dùng cho sidebar của admin layout: các mục con của "Kênh bán hàng". */
export const SOCIAL_NAV: { id: SocialPage; label: string }[] = [
  { id: "connect", label: "Kết nối kênh" },
  { id: "channel-manage", label: "Quản lý kênh" },
  { id: "ai-content", label: "AI Content" },
  { id: "posts", label: "Bài viết" },
  { id: "messages", label: "Tin nhắn" },
  { id: "comments", label: "Bình luận" },
];

export type ChannelId = "facebook" | "instagram" | "tiktok" | "shopee" | "website" | "zalo" | "lazada" | "youtube";
export type ChannelKind = "social" | "marketplace" | "website";
export type ConfigTab = "general" | "products" | "posting" | "automation" | "inbox" | "permissions" | "webhook" | "logs";
export type AiPreset = "product" | "topic" | "idea";

export interface ChannelAccount {
  id: ChannelId;
  connected: boolean;
  status: "active" | "paused" | "error";
  accountName: string;
  handle: string;
  url: string;
  pageId: string;
  connectedAt: string;
  avatarUrl?: string | null;
  followers: number; followersDelta: number;
  engagement: number; engagementDelta: number;
  orders: number; ordersDelta: number;
  conversion: number; conversionDelta: number;
  revenue: number; revenueDelta: number;
}

export interface GoOptions {
  channel?: ChannelId;       // kênh đang xem ở trang cấu hình
  tab?: ConfigTab;           // tab mở sẵn ở trang cấu hình
  preset?: AiPreset;         // chế độ mở sẵn ở AI Content
  wizardChannel?: ChannelId; // kênh chọn sẵn khi thêm kênh
}

export interface SocialCtx {
  data: SocialOverview;
  settings: SocialPlatformSettings | null;
  reloadSettings: () => Promise<void>;
  channels: ChannelAccount[];
  setChannels: Dispatch<SetStateAction<ChannelAccount[]>>;
  activeChannel: ChannelId;
  configTab: ConfigTab;
  aiPreset: AiPreset;
  wizardChannel: ChannelId | null;
  go: (page: SocialPage, opts?: GoOptions) => void;
  reload: (quiet?: boolean, fresh?: boolean) => Promise<void>;
  refreshAll: () => Promise<void>;
  connectChannel: (id: ChannelId) => Promise<void>;
  disconnectChannel: (id: ChannelId) => void;
  approve: (item: SocialContentItem, publishNow: boolean) => Promise<void>;
  retryReply: (id: string) => Promise<void>;
}
