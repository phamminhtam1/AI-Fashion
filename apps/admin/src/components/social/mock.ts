/**
 * DỮ LIỆU MẪU – thay bằng API thật khi sẵn sàng.
 * Mỗi khối có ghi chú TODO(api) cho biết endpoint cần nối.
 */
import type { ChannelAccount, ChannelId, ChannelKind } from "./types";

/** Khi API chưa trả dữ liệu (danh sách trống), hiển thị data mẫu để xem giao diện. Đặt false khi go-live. */
export const USE_MOCK_FALLBACK = true;

/* ---------- Danh mục kênh (tĩnh) ---------- */
export interface ChannelMeta {
  name: string; kind: ChannelKind; desc: string; features: string[]; color: string; comingSoon?: boolean;
}
export const CHANNEL_META: Record<ChannelId, ChannelMeta> = {
  facebook: { name: "Facebook", kind: "social", color: "#3b82f6", desc: "Quản lý Fanpage, đăng bài, trả lời tin nhắn, bình luận tự động.", features: ["Đồng bộ sản phẩm", "Đồng bộ đơn hàng", "Tự động đăng bài", "Trả lời tin nhắn tự động"] },
  instagram: { name: "Instagram", kind: "social", color: "#ec4899", desc: "Đăng bài, Reels, Story và liên kết sản phẩm.", features: ["Đồng bộ sản phẩm (Instagram Shop)", "Tự động đăng bài", "Trả lời tin nhắn tự động", "Đồng bộ bình luận"] },
  tiktok: { name: "TikTok Shop", kind: "social", color: "#7c3aed", desc: "Đăng video, Livestream, quản lý sản phẩm và đơn hàng.", features: ["Đồng bộ sản phẩm", "Đồng bộ đơn hàng", "Tự động đăng video", "Trả lời tin nhắn tự động"] },
  shopee: { name: "Shopee", kind: "marketplace", color: "#f59e0b", desc: "Đồng bộ sản phẩm, đơn hàng và tự động cập nhật tồn kho.", features: ["Đồng bộ sản phẩm", "Đồng bộ đơn hàng", "Cập nhật tồn kho tự động", "Tự động trả lời tin nhắn"] },
  website: { name: "Website", kind: "website", color: "#94a3b8", desc: "Đồng bộ sản phẩm, bài viết và theo dõi hành vi khách hàng.", features: ["Đồng bộ sản phẩm", "Theo dõi hành vi (Pixel)", "Hiển thị bài viết tự động", "Đồng bộ đơn hàng"] },
  zalo: { name: "Zalo OA", kind: "social", color: "#0068ff", desc: "Chăm sóc khách hàng, gửi tin nhắn ZNS và thông báo.", features: ["Gửi tin nhắn chăm sóc khách hàng", "Gửi thông báo đơn hàng", "Tự động trả lời tin nhắn", "Tích hợp ZNS"] },
  lazada: { name: "Lazada", kind: "marketplace", color: "#f97316", desc: "Đồng bộ sản phẩm, đơn hàng và tồn kho.", features: ["Đồng bộ sản phẩm", "Đồng bộ đơn hàng", "Cập nhật tồn kho tự động", "Tự động trả lời tin nhắn"] },
  youtube: { name: "YouTube", kind: "social", color: "#ef4444", desc: "Đăng video, xây dựng thương hiệu và gắn sản phẩm.", features: [], comingSoon: true },
};

/* ---------- Kênh đã kết nối ---------- */
// TODO(api): GET /admin/social/channels  → ChannelAccount[]
const base = { status: "active" as const, connected: true, connectedAt: "12/06/2024 10:30" };
export const MOCK_CHANNELS: ChannelAccount[] = [
  { ...base, id: "facebook", accountName: "ELANE Fashion", handle: "@elane.official", url: "https://facebook.com/elane.official", pageId: "1029384756", followers: 12450, followersDelta: 5.2, engagement: 8420, engagementDelta: 28.5, orders: 124, ordersDelta: 16.3, conversion: 3.1, conversionDelta: 0.5, revenue: 4320, revenueDelta: 18.1 },
  { ...base, id: "instagram", accountName: "Instagram", handle: "@elane.official", url: "https://instagram.com/elane.official", pageId: "17841400000", followers: 28600, followersDelta: 8.3, engagement: 15240, engagementDelta: 35.2, orders: 186, ordersDelta: 24.6, conversion: 4.2, conversionDelta: 1.1, revenue: 6820, revenueDelta: 26.4 },
  { ...base, id: "tiktok", accountName: "ELANE Official", handle: "@elane.fashion", url: "https://tiktok.com/@elane.fashion", pageId: "7120003", followers: 45200, followersDelta: 12.5, engagement: 32680, engagementDelta: 48.1, orders: 312, ordersDelta: 36.7, conversion: 5.8, conversionDelta: 1.8, revenue: 12450, revenueDelta: 42.3 },
  { ...base, id: "shopee", accountName: "ELANE Official Store", handle: "shopee.vn/elane", url: "https://shopee.vn/elane", pageId: "SP-88231", followers: 18350, followersDelta: 6.1, engagement: 9420, engagementDelta: 22.4, orders: 146, ordersDelta: 19.8, conversion: 3.9, conversionDelta: 0.9, revenue: 5780, revenueDelta: 21.6 },
  { ...base, id: "website", accountName: "elane.vn", handle: "elane.vn", url: "https://elane.vn", pageId: "WEB-01", followers: 8920, followersDelta: 4.2, engagement: 5680, engagementDelta: 16.7, orders: 98, ordersDelta: 12.5, conversion: 2.8, conversionDelta: 0.6, revenue: 3120, revenueDelta: 14.1 },
  { ...base, id: "zalo", connected: false, accountName: "", handle: "", url: "", pageId: "", connectedAt: "", followers: 0, followersDelta: 0, engagement: 0, engagementDelta: 0, orders: 0, ordersDelta: 0, conversion: 0, conversionDelta: 0, revenue: 0, revenueDelta: 0 },
];

/** Hồ sơ rỗng khi người dùng hoàn tất wizard "Thêm kênh" (mock). */
export function newAccount(id: ChannelId): ChannelAccount {
  const now = new Date().toLocaleString("vi-VN");
  return { ...MOCK_CHANNELS[5], id, connected: true, status: "active", accountName: `ELANE ${CHANNEL_META[id].name}`, handle: "@elane.official", url: "https://elane.vn", pageId: "—", connectedAt: now };
}

/* ---------- KPI trang tổng quan ---------- */
// TODO(api): GET /admin/social/kpis?from=&to=
export const KPI_MOCK = [
  { key: "revenue", label: "Tổng doanh thu từ Social", value: "$12,450.00", delta: 18.2, spark: [3, 4, 3.5, 5, 4.6, 6, 5.5, 7.2, 8] },
  { key: "orders", label: "Đơn hàng từ Social", value: "342", delta: 15.6, spark: [4, 3, 5, 4, 6.5, 5, 7, 6, 8] },
  { key: "engagement", label: "Tổng tương tác", value: "24,580", delta: 32.8, spark: [2, 3, 2.6, 4, 3.5, 5, 6, 5.4, 7.5] },
  { key: "conversion", label: "Tỷ lệ chuyển đổi", value: "3.6%", delta: 0.8, spark: [4, 4.5, 3.8, 5, 4.2, 6, 5, 5.6, 6.8] },
];
export const DATE_RANGES = ["01/06/2024 - 30/06/2024", "7 ngày qua", "30 ngày qua", "Quý này"];

/* ---------- Bài viết ---------- */
export type PostStatus = "draft" | "pending" | "approved" | "published" | "failed";
export interface PostRow { id: string; title: string; channel: ChannelId; time: string; status: PostStatus; thumb?: string; permalink?: string | null; real: boolean; }
// TODO(api): GET /admin/social/posts?status=
export const MOCK_POSTS: PostRow[] = [
  { id: "m1", title: "Bộ sưu tập Thu Đông 2024 🍂", channel: "instagram", time: "12/06/2024 10:00", status: "pending", real: false },
  { id: "m2", title: "Ưu đãi cuối tuần - Giảm 30%", channel: "facebook", time: "12/06/2024 14:00", status: "approved", real: false },
  { id: "m3", title: "Mix & Match cùng ÉLANE ✨", channel: "tiktok", time: "12/06/2024 18:00", status: "pending", real: false },
  { id: "m4", title: "Behind the scenes", channel: "instagram", time: "13/06/2024 10:00", status: "approved", real: false },
  { id: "m5", title: "Sản phẩm mới cập bến", channel: "shopee", time: "13/06/2024 14:00", status: "pending", real: false },
];

/* ---------- Bình luận ---------- */
export interface CommentRow { id: string; author: string; message: string; createdAt: string; status: string; aiReply?: string | null; escalationReason?: string | null; real: boolean; }
// TODO(api): GET /admin/social/comments
export const MOCK_COMMENTS: CommentRow[] = [
  { id: "c1", author: "linh.nguyen", message: "Áo blazer này còn size M không shop?", createdAt: new Date().toISOString(), status: "replied", aiReply: "Chào bạn, mẫu blazer hiện còn size M. Bạn nhắn tin để ELANE hỗ trợ đặt hàng nhé!", real: false },
  { id: "c2", author: "thu.trang_", message: "Mình muốn đổi trả đơn hôm qua, bị lỗi đường may.", createdAt: new Date().toISOString(), status: "escalated", escalationReason: "Khiếu nại đổi trả – cần nhân viên xử lý", real: false },
  { id: "c3", author: "minh.anh.style", message: "Giá bộ set này bao nhiêu ạ?", createdAt: new Date().toISOString(), status: "new", real: false },
];

/* ---------- Tin nhắn ---------- */
export interface Thread { id: string; channel: ChannelId; name: string; preview: string; time: string; unread: number; messages: { from: "customer" | "ai" | "staff"; text: string; time: string }[]; }
// TODO(api): GET /admin/social/messages, POST /admin/social/messages/:id/reply
export const MOCK_THREADS: Thread[] = [
  { id: "t1", channel: "facebook", name: "Nguyễn Thị Hà", preview: "Cho mình hỏi set vest này có ship COD không?", time: "10:42", unread: 2, messages: [
    { from: "customer", text: "Cho mình hỏi set vest này có ship COD không?", time: "10:41" },
    { from: "ai", text: "Chào chị Hà, ELANE có hỗ trợ giao hàng COD toàn quốc. Chị cho em xin size và địa chỉ nhận hàng nhé!", time: "10:42" }] },
  { id: "t2", channel: "instagram", name: "mai.phuong", preview: "Mẫu đầm lụa còn màu đỏ không shop?", time: "09:15", unread: 0, messages: [
    { from: "customer", text: "Mẫu đầm lụa còn màu đỏ không shop?", time: "09:14" },
    { from: "ai", text: "Dạ mẫu đầm lụa màu đỏ hiện còn size S và M ạ.", time: "09:15" }] },
  { id: "t3", channel: "tiktok", name: "hoang_yen", preview: "Mình cần tư vấn phối đồ đi tiệc", time: "Hôm qua", unread: 1, messages: [
    { from: "customer", text: "Mình cần tư vấn phối đồ đi tiệc", time: "20:03" }] },
  { id: "t4", channel: "shopee", name: "Trần Bảo Ngọc", preview: "Đơn của mình bao giờ giao vậy?", time: "Hôm qua", unread: 0, messages: [
    { from: "customer", text: "Đơn của mình bao giờ giao vậy?", time: "15:20" },
    { from: "staff", text: "Đơn của chị đang trên đường giao, dự kiến 2 ngày nữa ạ.", time: "15:32" }] },
];

/* ---------- Cấu hình kênh ---------- */
export const PERMISSIONS = [
  { title: "Quản lý nội dung trang", desc: "Đăng bài, chỉnh sửa và xóa bài viết" },
  { title: "Quản lý bình luận", desc: "Trả lời, ẩn hoặc xóa bình luận" },
  { title: "Đọc và trả lời tin nhắn", desc: "Quản lý tin nhắn và bình luận" },
  { title: "Truy cập thông tin thống kê", desc: "Xem số liệu tương tác và hiệu quả" },
  { title: "Quản lý quảng cáo (tùy chọn)", desc: "Tạo và quản lý chiến dịch quảng cáo" },
];
// TODO(api): GET /admin/social/channels/:id/activities
export const MOCK_ACTIVITIES = [
  { text: "Đăng bài thành công", time: "12/06/2024 14:00", tone: "emerald" },
  { text: "Trả lời tin nhắn tự động", time: "12/06/2024 13:45", tone: "blue" },
  { text: "Đồng bộ sản phẩm", time: "12/06/2024 13:20", tone: "violet" },
  { text: "Nhận bình luận mới", time: "12/06/2024 12:10", tone: "orange" },
  { text: "Đồng bộ đơn hàng", time: "12/06/2024 11:30", tone: "emerald" },
];
export const CONFIG_TABS = [
  { id: "general", label: "Thông tin chung" }, { id: "products", label: "Đồng bộ sản phẩm" },
  { id: "posting", label: "Cài đặt đăng bài" }, { id: "automation", label: "Tự động hóa" },
  { id: "inbox", label: "Tin nhắn & bình luận" }, { id: "permissions", label: "Quản lý quyền" },
  { id: "webhook", label: "Webhook & API" }, { id: "logs", label: "Nhật ký hoạt động" },
] as const;

/* ---------- AI Content ---------- */
// TODO(api): GET /admin/products?limit=12
export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  tint: string;
  inStock: boolean;
  imageUrl?: string | null;
  category?: string | null;
  description?: string | null;
  slug?: string;
  colorsCount?: number;
  sizesCount?: number;
  variantsCount?: number;
}

export interface Collection {
  id: string;
  title: string;
  slug?: string;
  season?: string | null;
  coverImageUrl?: string | null;
  itemCount?: number;
  description?: string | null;
  attachedProductIds?: string[];
}

export const MOCK_PRODUCTS: Product[] = [
  { id: "p1", name: "Áo blazer nữ công sở", sku: "EL-BZ-001", price: 548000, tint: "from-stone-200 to-stone-300", inStock: true },
  { id: "p2", name: "Quần tây suông lưng cao", sku: "EL-TR-002", price: 498000, tint: "from-slate-100 to-slate-300", inStock: true },
  { id: "p3", name: "Áo sơ mi lụa tối giản", sku: "EL-SH-003", price: 428000, tint: "from-rose-50 to-rose-200", inStock: true },
  { id: "p4", name: "Set vest thanh lịch", sku: "EL-ST-004", price: 1290000, tint: "from-amber-100 to-amber-200", inStock: true },
];
/** Màu nền thay cho ảnh khi chưa có media thật. */
export const TINTS = ["from-stone-200 to-stone-300", "from-rose-100 to-rose-200", "from-slate-100 to-slate-300", "from-amber-100 to-amber-200"];
/** Các kênh có thể chọn khi tạo content (thứ tự hiển thị). */
export const CONTENT_CHANNELS: ChannelId[] = ["facebook", "instagram", "tiktok", "shopee", "website"];
export const CH_NAME: Record<ChannelId, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", shopee: "Shopee", website: "Website", zalo: "Zalo", lazada: "Lazada", youtube: "YouTube" };
export const AUDIENCES = ["Nữ công sở", "18-25", "25-35", "35-45", "Khác"];
export const CAMPAIGN_GOALS = ["Tăng nhận diện thương hiệu", "Thúc đẩy doanh số", "Tăng tương tác", "Ra mắt sản phẩm mới", "Khuyến mãi theo mùa"];
export const SEGMENTS = ["Nữ công sở", "Nữ sinh viên", "Nam công sở", "Mẹ & bé", "Khác"];
export const AGES = ["18-25", "25-35", "35-45", "45+"];
export const CTAS = ["Mua ngay", "Khám phá BST", "Xem thêm sản phẩm", "Tư vấn ngay"];
export const GOALS = ["Giới thiệu sản phẩm", "Khuyến mãi", "Bộ sưu tập", "Kiến thức thời trang", "Tăng tương tác", "Khác"];
export const STYLES = ["Thanh lịch, hiện đại", "Trẻ trung, năng động", "Sang trọng, tối giản"];
export const TONES = ["Thân thiện, truyền cảm hứng", "Chuyên nghiệp, tin cậy", "Vui tươi, gần gũi"];
export interface Variant { id: string; label: string; tags: string; title: string; caption: string; hashtags: string[]; visualBrief?: string; }
export const MOCK_VARIANTS: Variant[] = [1, 2, 3].map((n) => ({
  id: `v${n}`, label: `Phiên bản ${n}`, tags: ["Thanh lịch • Hiện đại • Truyền cảm hứng", "Trẻ trung • Gần gũi", "Sang trọng • Tối giản"][n - 1],
  title: "Modern Office Look",
  caption: "Thanh lịch trong từng khoảnh khắc ✨\nSet blazer cao cấp từ ÉLANE – lựa chọn hoàn hảo cho nàng hiện đại, vừa chuyên nghiệp nơi công sở, vừa tự tin dạo phố.\n\n🌿 Chất liệu cao cấp, form dáng chuẩn\n🤍 Dễ phối đồ, phù hợp nhiều hoàn cảnh\n🛍 Khám phá ngay tại ÉLANE!",
  hashtags: ["#Elane", "#OfficeLook", "#Thoitrangnu", "#Blazer", "#Thanhlich", "#ModernStyle", "#WomenStyle", "#OOTD", "#FashionDaily", "#CongSo", "#ThoiTrangCongSo", "#ElegantStyle"],
}));
