import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type SocialContentItem, type SocialOverview, type SocialPlatformSettings } from "@/lib/api";
import { MOCK_CHANNELS, newAccount } from "./social/mock";
import type { AiPreset, ChannelAccount, ChannelId, ConfigTab, GoOptions, SocialCtx, SocialPage } from "./social/types";
import { DashboardPage } from "./social/pages/DashboardPage";
import { ConnectPage } from "./social/pages/ConnectPage";
import { AddChannelPage } from "./social/pages/AddChannelPage";
import { AiContentPage } from "./social/pages/AiContentPage";
import { PostsPage } from "./social/pages/PostsPage";
import { CommentsPage, MessagesPage } from "./social/pages/InboxPages";
import { ChannelManagePage } from "./social/pages/ChannelManagePage";

export { SOCIAL_NAV } from "./social/types";
export type { SocialPage } from "./social/types";

const EMPTY: SocialOverview = { connections: [], content: [], interactions: [], metrics: [] };
const ALL_CHANNELS: ChannelId[] = ["instagram", "facebook", "tiktok", "shopee", "website", "zalo", "lazada", "youtube"];
const blankAccount = (id: ChannelId): ChannelAccount => ({
  id,
  connected: false,
  status: "active",
  accountName: "",
  handle: "",
  url: "",
  pageId: "—",
  connectedAt: "—",
  followers: 0,
  followersDelta: 0,
  engagement: 0,
  engagementDelta: 0,
  orders: 0,
  ordersDelta: 0,
  conversion: 0,
  conversionDelta: 0,
  revenue: 0,
  revenueDelta: 0,
});
const INITIAL: ChannelAccount[] = ALL_CHANNELS.map((id) => blankAccount(id));

interface Props {
  /** Trang đang mở. Bỏ trống để component tự quản lý; truyền vào nếu muốn đồng bộ với router/sidebar. */
  page?: SocialPage;
  onPageChange?: (page: SocialPage) => void;
}

export function SocialCommerceManager({ page: controlled, onPageChange }: Props = {}) {
  const [data, setData] = useState<SocialOverview>(EMPTY);
  const [settings, setSettings] = useState<SocialPlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [innerPage, setInnerPage] = useState<SocialPage>("overview");
  const [activeChannel, setActiveChannel] = useState<ChannelId>("instagram");
  const [configTab, setConfigTab] = useState<ConfigTab>("general");
  const [aiPreset, setAiPreset] = useState<AiPreset>("product");
  const [wizardChannel, setWizardChannel] = useState<ChannelId | null>(null);
  const [local, setLocal] = useState<ChannelAccount[]>(INITIAL);
  const page = controlled ?? innerPage;

  /* ---------- Tải dữ liệu (API có sẵn) ---------- */
  const load = useCallback(async (quiet = false, fresh = false) => {
    if (!quiet) setLoading(true);
    try { setData(await adminApi.socialOverview(fresh)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Không tải được Social Hub"); }
    finally { setLoading(false); }
  }, []);

  const loadSettings = useCallback(async () => {
    try { setSettings(await adminApi.socialSettings()); }
    catch { /* Overview vẫn dùng được khi chưa cấu hình Meta. */ }
  }, []);

  useEffect(() => { void load(); void loadSettings(); }, [load, loadSettings]);

  /* ---------- Kênh: Instagram theo kết nối thật từ database/Meta, các kênh chưa tích hợp để chưa kết nối ---------- */
  const connection = data.connections[0];
  const channels = useMemo<ChannelAccount[]>(() => {
    return ALL_CHANNELS.map((id) => {
      if (id === "instagram") {
        if (connection && connection.status === "active") {
          return {
            ...blankAccount("instagram"),
            connected: true,
            status: "active",
            accountName: connection.accountName || `@${connection.username}`,
            handle: `@${connection.username}`,
            url: `https://instagram.com/${connection.username}`,
            pageId: connection.instagramUserId || connection.pageId || "—",
            connectedAt: connection.createdAt ? new Date(connection.createdAt).toLocaleString("vi-VN") : "Vừa xong",
            followers: connection.followers ?? 0,
            avatarUrl: connection.avatarUrl ?? null,
          };
        }
        return blankAccount("instagram");
      }
      const foundLocal = local.find((c) => c.id === id);
      if (foundLocal && foundLocal.connected) return foundLocal;
      return blankAccount(id);
    });
  }, [connection, local]);

  const go = useCallback((next: SocialPage, opts?: GoOptions) => {
    if (opts?.channel) setActiveChannel(opts.channel);
    setConfigTab(opts?.tab ?? "general");
    setAiPreset(opts?.preset ?? "product");
    setWizardChannel(opts?.wizardChannel ?? null);
    setInnerPage(next);
    onPageChange?.(next);
  }, [onPageChange]);

  /* ---------- Hành động ---------- */
  const connectChannel = useCallback(async (id: ChannelId) => {
    if (id === "instagram") {
      if (!settings?.appId || !settings.hasAppSecret || !settings.hasWebhookVerifyToken) {
        toast.info("Hãy nhập cấu hình Meta trước khi kết nối Instagram");
        go("add-channel", { wizardChannel: "instagram" });
        return;
      }
      try { const { url } = await adminApi.instagramConnectUrl(); window.location.assign(url); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Không thể bắt đầu kết nối Instagram"); }
      return;
    }
    // TODO(api): kết nối thật cho Facebook/TikTok/Shopee/Zalo/... – hiện chỉ đánh dấu đã kết nối (mẫu)
    setLocal((old) => (old.some((c) => c.id === id) ? old.map((c) => (c.id === id ? newAccount(id) : c)) : [...old, newAccount(id)]));
    toast.success("Đã kết nối kênh (dữ liệu mẫu)");
  }, [settings, go]);

  const disconnectChannel = useCallback((id: ChannelId) => {
    if (id === "instagram") { toast.info("Chưa có API ngắt kết nối Instagram"); return; }
    setLocal((old) => old.map((c) => (c.id === id ? blankAccount(id) : c))); // TODO(api): DELETE /admin/social/channels/:id
    toast.success("Đã ngắt kết nối");
    go("connect");
  }, [go]);

  const refreshAll = useCallback(async () => {
    try {
      if (data.connections.length) await adminApi.syncSocialMetrics();
      await load(false, true);
      toast.success("Đã đồng bộ dữ liệu mới nhất");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể đồng bộ dữ liệu"); }
  }, [data.connections.length, load]);

  const approve = useCallback(async (item: SocialContentItem, publishNow: boolean) => {
    if (!item.mediaUrls.length) { toast.error("Hãy thêm URL ảnh hoặc video trước khi duyệt đăng"); return; }
    try {
      await adminApi.approveSocialContent(item.id, { publishNow, scheduledAt: publishNow ? null : new Date(Date.now() + 3600_000).toISOString() });
      await load(true);
      toast.success(publishNow ? "Đang gửi bài lên Instagram" : "Đã duyệt và lên lịch sau 1 giờ");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể duyệt nội dung"); }
  }, [load]);

  const retryReply = useCallback(async (id: string) => {
    try { await adminApi.retrySocialAiReply(id); await load(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "AI chưa thể trả lời lại"); }
  }, [load]);

  if (loading) return <div className="grid min-h-[460px] place-items-center"><Loader2 className="size-7 animate-spin text-[#6941c6]" /></div>;

  const ctx: SocialCtx = {
    data, settings, reloadSettings: loadSettings, channels, setChannels: setLocal, activeChannel, configTab, aiPreset, wizardChannel,
    go, reload: load, refreshAll, connectChannel, disconnectChannel, approve, retryReply,
  };

  let content;
  switch (page) {
    case "connect": content = <ConnectPage ctx={ctx} />; break;
    case "channel-manage": content = <ChannelManagePage key={activeChannel} ctx={ctx} />; break;
    case "add-channel": content = <AddChannelPage key={wizardChannel ?? "new"} ctx={ctx} />; break;
    case "ai-content": content = <AiContentPage key={aiPreset} ctx={ctx} />; break;
    case "posts": content = <PostsPage ctx={ctx} />; break;
    case "messages": content = <MessagesPage ctx={ctx} />; break;
    case "comments": content = <CommentsPage ctx={ctx} />; break;
    default: content = <DashboardPage ctx={ctx} />;
  }
  return <div className="social-commerce-ui font-sans text-sm">{content}</div>;
}
