import type { LucideIcon } from "lucide-react";
import {
  BarChart3, Globe, Megaphone, MessageCircle, MessageSquare, Newspaper, Package, PenSquare,
  ShoppingBag, Store, UserRound, Video,
} from "lucide-react";
import type { ChannelId } from "../types";

/* ───────────── Kiểu dữ liệu ───────────── */
export type FlowAccount = {
  id: string; name: string; category: string; followers: number; posts: number; suggested?: boolean; externalId: string;
};
export type FlowPermission = { icon: LucideIcon; title: string; desc: string; optional?: boolean };

export type ChannelFlow = {
  tagline: string;          // mô tả dưới tiêu đề ở bước 2
  accountLabel: string;     // "Fanpage", "gian hàng", "kênh YouTube"... (viết thường giữa câu)
  idLabel: string;          // "ID Page", "Shop ID"...
  followersLabel: string;
  postsLabel: string;
  loginTitle: string;
  loginDesc: string;
  loginCta: string;
  features: string[];       // "Tính năng chính" (sidebar bước 2)
  notes: string[];          // "Lưu ý" (sidebar bước 2)
  commerce: boolean;        // có đồng bộ sản phẩm / đơn hàng không
  canPost: boolean;         // có tự động đăng bài không
  shopName: string | null;  // "Facebook Shop", "Shopee"...
  accounts: FlowAccount[];  // TODO(api): lấy danh sách thật sau khi OAuth
  permissions: FlowPermission[];
  previewTabs: string[];
  previewActions: [string, string]; // [nút chính, nút phụ] trong khung xem trước
};

export type ExtraKey = "stock" | "price" | "images" | "hideOos";
export type Collection = "all" | "category" | "manual";
export type Cfg = {
  name: string; desc: string; category: string;
  syncProducts: boolean; collection: Collection; autoPost: boolean;
  extras: Record<ExtraKey, boolean>;
};
export type ContentCfg = { tone: string; audience: string; goal: string };

/* ───────────── Hằng số dùng chung ───────────── */
export const CATEGORIES = ["Thời trang & Phụ kiện", "Mỹ phẩm & Làm đẹp", "Nhà cửa & Đời sống", "Cộng đồng", "Khác"];

export const COLLECTIONS: { id: Collection; title: string; desc: string }[] = [
  { id: "all", title: "Tất cả sản phẩm", desc: "Đồng bộ toàn bộ sản phẩm đang hoạt động." },
  { id: "category", title: "Chọn danh mục", desc: "Chỉ đồng bộ các danh mục được chọn." },
  { id: "manual", title: "Chọn thủ công", desc: "Tự chọn sản phẩm cụ thể." },
];

export const EXTRAS: { key: ExtraKey; label: string; desc: string }[] = [
  { key: "stock", label: "Đồng bộ tồn kho theo thời gian thực", desc: "Tự động cập nhật số lượng khi có thay đổi." },
  { key: "price", label: "Đồng bộ giá sản phẩm", desc: "Cập nhật giá khi có khuyến mãi hoặc thay đổi." },
  { key: "images", label: "Đồng bộ hình ảnh", desc: "Sử dụng ảnh sản phẩm từ hệ thống ÉLANE." },
  { key: "hideOos", label: "Tự động ẩn sản phẩm hết hàng", desc: "Ẩn sản phẩm trên kênh khi hết hàng." },
];

export const DEFAULT_CFG: Cfg = {
  name: "",
  desc: "Thời trang công sở nữ hiện đại, thanh lịch và bền vững.",
  category: "Thời trang & Phụ kiện",
  syncProducts: true, collection: "all", autoPost: true,
  extras: { stock: true, price: true, images: false, hideOos: false },
};
export const DEFAULT_CONTENT: ContentCfg = {
  tone: "Thân thiện, truyền cảm hứng",
  audience: "Nữ công sở (25–35)",
  goal: "Giới thiệu sản phẩm, tăng tương tác và chuyển đổi",
};

export const SAMPLE_PRODUCTS: [string, string][] = [
  ["Áo blazer nữ công sở", "1.290.000đ"],
  ["Đầm suông thanh lịch", "890.000đ"],
  ["Quần tây ống rộng", "790.000đ"],
];

/* ───────────── Helper ───────────── */
type Row = [name: string, category: string, followers: number, posts: number, externalId?: string];
const mk = (rows: Row[]): FlowAccount[] =>
  rows.map(([name, category, followers, posts, externalId], i) => ({
    id: `acc-${i}`, name, category, followers, posts, suggested: i === 0,
    externalId: externalId ?? String(1029384756 - i * 7919),
  }));

const SAFE_NOTE = "ÉLANE chỉ truy cập các thông tin cần thiết, không đăng bài khi chưa được bạn cho phép.";
const DISCONNECT_NOTE = "Bạn có thể ngắt kết nối bất kỳ lúc nào trong phần cấu hình kênh.";

/* ───────────── Cấu hình từng kênh ───────────── */
export const CHANNEL_FLOW: Record<string, ChannelFlow> = {
  facebook: {
    tagline: "Quản lý Fanpage, đăng bài, trả lời tin nhắn, bình luận và theo dõi hiệu quả marketing.",
    accountLabel: "Fanpage", idLabel: "ID Page", followersLabel: "Người theo dõi", postsLabel: "Bài viết gần đây",
    loginTitle: "Kết nối thông qua Facebook",
    loginDesc: "Hệ thống sẽ yêu cầu quyền cần thiết để quản lý Fanpage, bài viết, tin nhắn và bình luận.",
    loginCta: "Đăng nhập với Facebook",
    features: ["Đăng bài (ảnh, video, link, reel)", "Quản lý comment và tin nhắn", "Đồng bộ sản phẩm (Facebook Shop)", "Xem thống kê bài viết", "Tự động đăng theo lịch"],
    notes: ["Bạn cần có quyền quản trị viên (Admin) của Fanpage.", SAFE_NOTE, DISCONNECT_NOTE, "Nếu không thấy Fanpage, hãy kiểm tra lại quyền quản trị viên."],
    commerce: true, canPost: true, shopName: "Facebook Shop",
    accounts: mk([["ÉLANE Fashion", "Thời trang nữ", 12450, 124], ["ÉLANE Official", "Thời trang nữ", 8320, 56], ["ÉLANE Woman", "Cộng đồng", 5180, 32]]),
    permissions: [
      { icon: PenSquare, title: "Quản lý và đăng bài trên Fanpage", desc: "Tạo, chỉnh sửa và đăng nội dung" },
      { icon: UserRound, title: "Truy cập thông tin trang", desc: "Tên trang, hình ảnh, thông tin cơ bản" },
      { icon: MessageSquare, title: "Đọc và trả lời tin nhắn", desc: "Quản lý hội thoại với khách hàng" },
      { icon: BarChart3, title: "Xem thống kê bài viết", desc: "Lượt tiếp cận, tương tác và hiệu quả" },
      { icon: MessageCircle, title: "Đọc và quản lý bình luận", desc: "Trả lời, ẩn hoặc xóa bình luận" },
      { icon: Megaphone, title: "Quản lý quảng cáo (tùy chọn)", desc: "Tạo và quản lý chiến dịch quảng cáo", optional: true },
    ],
    previewTabs: ["Bài viết", "Giới thiệu", "Cửa hàng", "Ảnh", "Video"],
    previewActions: ["Nhắn tin", "Thích"],
  },

  instagram: {
    tagline: "Quản lý tài khoản Business, đăng bài và reel, trả lời tin nhắn, bình luận và theo dõi hiệu quả nội dung.",
    accountLabel: "tài khoản Instagram", idLabel: "ID Instagram", followersLabel: "Người theo dõi", postsLabel: "Bài viết gần đây",
    loginTitle: "Kết nối thông qua Instagram",
    loginDesc: "Hệ thống sẽ yêu cầu quyền cần thiết để quản lý bài viết, tin nhắn và bình luận.",
    loginCta: "Đăng nhập với Instagram",
    features: ["Đăng ảnh, carousel và reel", "Quản lý bình luận và tin nhắn (DM)", "Đồng bộ sản phẩm (Instagram Shopping)", "Xem thống kê nội dung", "Tự động đăng theo lịch"],
    notes: ["Tài khoản cần là loại Business hoặc Creator.", "Tài khoản cần được liên kết với một Fanpage Facebook.", SAFE_NOTE, DISCONNECT_NOTE],
    commerce: true, canPost: true, shopName: "Instagram Shopping",
    accounts: [] as FlowAccount[],
    permissions: [
      { icon: PenSquare, title: "Đăng bài và reel", desc: "Tạo, lên lịch và đăng nội dung" },
      { icon: UserRound, title: "Truy cập thông tin tài khoản", desc: "Tên, ảnh đại diện, thông tin cơ bản" },
      { icon: MessageSquare, title: "Đọc và trả lời tin nhắn", desc: "Quản lý hội thoại (DM) với khách hàng" },
      { icon: BarChart3, title: "Xem thống kê nội dung", desc: "Lượt tiếp cận, tương tác và hiệu quả" },
      { icon: MessageCircle, title: "Đọc và quản lý bình luận", desc: "Trả lời, ẩn hoặc xóa bình luận" },
      { icon: ShoppingBag, title: "Quản lý sản phẩm (tùy chọn)", desc: "Đồng bộ danh mục sản phẩm", optional: true },
    ],
    previewTabs: ["Bài viết", "Reels", "Cửa hàng", "Được gắn thẻ"],
    previewActions: ["Theo dõi", "Nhắn tin"],
  },

  tiktok: {
    tagline: "Đăng video theo lịch, quản lý bình luận và đồng bộ sản phẩm, đơn hàng với TikTok Shop.",
    accountLabel: "tài khoản TikTok", idLabel: "ID TikTok", followersLabel: "Người theo dõi", postsLabel: "Video gần đây",
    loginTitle: "Kết nối thông qua TikTok",
    loginDesc: "Hệ thống sẽ yêu cầu quyền cần thiết để quản lý video, TikTok Shop và đơn hàng.",
    loginCta: "Đăng nhập với TikTok",
    features: ["Đăng video theo lịch", "Quản lý bình luận", "Đồng bộ sản phẩm lên TikTok Shop", "Đồng bộ đơn hàng về ÉLANE", "Xem thống kê video"],
    notes: ["Cần có TikTok Shop đã được duyệt để đồng bộ sản phẩm.", SAFE_NOTE, DISCONNECT_NOTE, "Nếu không thấy tài khoản, hãy kiểm tra lại quyền quản lý."],
    commerce: true, canPost: true, shopName: "TikTok Shop",
    accounts: mk([["@elane.vn", "Thời trang nữ", 25600, 96], ["@elane.style", "Thời trang nữ", 7800, 40]]),
    permissions: [
      { icon: Video, title: "Đăng và quản lý video", desc: "Tải lên, lên lịch và đăng video" },
      { icon: UserRound, title: "Truy cập thông tin tài khoản", desc: "Tên, ảnh đại diện, thông tin cơ bản" },
      { icon: MessageCircle, title: "Đọc và quản lý bình luận", desc: "Trả lời, ẩn hoặc xóa bình luận" },
      { icon: BarChart3, title: "Xem thống kê video", desc: "Lượt xem, tương tác và hiệu quả" },
      { icon: ShoppingBag, title: "Quản lý sản phẩm và đơn hàng", desc: "Đồng bộ lên TikTok Shop" },
      { icon: Megaphone, title: "Quản lý quảng cáo (tùy chọn)", desc: "Tạo và quản lý chiến dịch quảng cáo", optional: true },
    ],
    previewTabs: ["Video", "Cửa hàng", "Đã thích"],
    previewActions: ["Theo dõi", "Tin nhắn"],
  },

  shopee: {
    tagline: "Đồng bộ sản phẩm, tồn kho và đơn hàng, quản lý tin nhắn khách hàng ngay trong ÉLANE.",
    accountLabel: "gian hàng", idLabel: "Shop ID", followersLabel: "Người theo dõi", postsLabel: "Sản phẩm đang bán",
    loginTitle: "Kết nối thông qua Shopee",
    loginDesc: "Hệ thống sẽ yêu cầu quyền cần thiết để quản lý sản phẩm, đơn hàng và tin nhắn.",
    loginCta: "Đăng nhập với Shopee",
    features: ["Đồng bộ sản phẩm và tồn kho", "Đồng bộ đơn hàng về ÉLANE", "Cập nhật giá và khuyến mãi", "Quản lý tin nhắn khách hàng", "Theo dõi doanh số theo gian hàng"],
    notes: ["Bạn cần là chủ gian hàng hoặc có quyền quản trị.", "ÉLANE chỉ truy cập các thông tin cần thiết, không thay đổi gian hàng khi chưa được bạn cho phép.", DISCONNECT_NOTE, "Nếu không thấy gian hàng, hãy kiểm tra tài khoản Shopee đang đăng nhập."],
    commerce: true, canPost: false, shopName: "Shopee",
    accounts: mk([["ÉLANE Official Store", "Thời trang nữ", 32400, 486], ["ÉLANE Outlet", "Thời trang nữ", 6100, 152]]),
    permissions: [
      { icon: Package, title: "Quản lý sản phẩm", desc: "Tạo, chỉnh sửa giá và tồn kho" },
      { icon: Store, title: "Truy cập thông tin gian hàng", desc: "Tên shop, logo, thông tin cơ bản" },
      { icon: ShoppingBag, title: "Quản lý đơn hàng", desc: "Nhận và cập nhật trạng thái đơn" },
      { icon: BarChart3, title: "Xem dữ liệu bán hàng", desc: "Doanh số, lượt xem và chuyển đổi" },
      { icon: MessageSquare, title: "Đọc và trả lời tin nhắn", desc: "Chat với khách hàng" },
      { icon: Megaphone, title: "Quản lý khuyến mãi (tùy chọn)", desc: "Tạo và cập nhật chương trình giảm giá", optional: true },
    ],
    previewTabs: ["Sản phẩm", "Danh mục", "Đánh giá"],
    previewActions: ["Theo dõi", "Chat"],
  },

  lazada: {
    tagline: "Đồng bộ sản phẩm, tồn kho và đơn hàng, quản lý tin nhắn khách hàng ngay trong ÉLANE.",
    accountLabel: "gian hàng", idLabel: "Seller ID", followersLabel: "Người theo dõi", postsLabel: "Sản phẩm đang bán",
    loginTitle: "Kết nối thông qua Lazada",
    loginDesc: "Hệ thống sẽ yêu cầu quyền cần thiết để quản lý sản phẩm, đơn hàng và tin nhắn.",
    loginCta: "Đăng nhập với Lazada",
    features: ["Đồng bộ sản phẩm và tồn kho", "Đồng bộ đơn hàng về ÉLANE", "Cập nhật giá và khuyến mãi", "Quản lý tin nhắn khách hàng", "Theo dõi doanh số theo gian hàng"],
    notes: ["Bạn cần là chủ gian hàng hoặc có quyền quản trị.", "ÉLANE chỉ truy cập các thông tin cần thiết, không thay đổi gian hàng khi chưa được bạn cho phép.", DISCONNECT_NOTE, "Nếu không thấy gian hàng, hãy kiểm tra tài khoản Lazada Seller đang đăng nhập."],
    commerce: true, canPost: false, shopName: "Lazada",
    accounts: mk([["ÉLANE Flagship Store", "Thời trang nữ", 15800, 320], ["ÉLANE Mall", "Thời trang nữ", 4200, 96]]),
    permissions: [
      { icon: Package, title: "Quản lý sản phẩm", desc: "Tạo, chỉnh sửa giá và tồn kho" },
      { icon: Store, title: "Truy cập thông tin gian hàng", desc: "Tên shop, logo, thông tin cơ bản" },
      { icon: ShoppingBag, title: "Quản lý đơn hàng", desc: "Nhận và cập nhật trạng thái đơn" },
      { icon: BarChart3, title: "Xem dữ liệu bán hàng", desc: "Doanh số, lượt xem và chuyển đổi" },
      { icon: MessageSquare, title: "Đọc và trả lời tin nhắn", desc: "Chat với khách hàng" },
    ],
    previewTabs: ["Sản phẩm", "Bộ sưu tập", "Đánh giá"],
    previewActions: ["Theo dõi", "Chat"],
  },

  zalo: {
    tagline: "Đăng bài viết, gửi tin nhắn và chăm sóc khách hàng qua Zalo Official Account.",
    accountLabel: "Zalo OA", idLabel: "OA ID", followersLabel: "Người quan tâm", postsLabel: "Bài viết gần đây",
    loginTitle: "Kết nối thông qua Zalo",
    loginDesc: "Hệ thống sẽ yêu cầu quyền cần thiết để quản lý Zalo OA, bài viết và tin nhắn.",
    loginCta: "Đăng nhập với Zalo",
    features: ["Đăng bài viết trên Zalo OA", "Gửi tin nhắn và broadcast", "Quản lý hội thoại tập trung", "Chăm sóc khách hàng tự động", "Xem thống kê OA"],
    notes: ["Bạn cần là quản trị viên của Zalo OA.", "OA cần được xác thực để gửi tin broadcast.", SAFE_NOTE, DISCONNECT_NOTE],
    commerce: false, canPost: true, shopName: null,
    accounts: mk([["ÉLANE Fashion OA", "Thời trang nữ", 9800, 64], ["ÉLANE Care", "Chăm sóc khách hàng", 3200, 18]]),
    permissions: [
      { icon: PenSquare, title: "Quản lý và đăng bài viết", desc: "Tạo, chỉnh sửa và đăng nội dung" },
      { icon: UserRound, title: "Truy cập thông tin OA", desc: "Tên, ảnh đại diện, thông tin cơ bản" },
      { icon: MessageSquare, title: "Đọc và gửi tin nhắn", desc: "Quản lý hội thoại với khách hàng" },
      { icon: BarChart3, title: "Xem thống kê OA", desc: "Lượt quan tâm, tương tác và hiệu quả" },
      { icon: Megaphone, title: "Gửi tin broadcast (tùy chọn)", desc: "Gửi thông báo hàng loạt cho người quan tâm", optional: true },
    ],
    previewTabs: ["Bài viết", "Giới thiệu", "Dịch vụ"],
    previewActions: ["Nhắn tin", "Quan tâm"],
  },

  website: {
    tagline: "Đồng bộ sản phẩm, đơn hàng và đăng bài blog lên website của bạn.",
    accountLabel: "website", idLabel: "Tên miền", followersLabel: "Lượt truy cập/tháng", postsLabel: "Bài blog",
    loginTitle: "Kết nối website của bạn",
    loginDesc: "Xác thực tên miền để ÉLANE đồng bộ sản phẩm và đăng bài lên website.",
    loginCta: "Xác thực website",
    features: ["Đồng bộ sản phẩm lên website", "Đồng bộ đơn hàng về ÉLANE", "Đăng bài blog theo lịch", "Cập nhật giá và tồn kho", "Theo dõi lượt truy cập"],
    notes: ["Bạn cần có quyền quản trị website.", "Website cần hỗ trợ kết nối API hoặc plugin ÉLANE.", SAFE_NOTE, DISCONNECT_NOTE],
    commerce: true, canPost: true, shopName: "website",
    accounts: mk([["elane.vn", "Website thương mại điện tử", 42000, 36, "elane.vn"], ["blog.elane.vn", "Blog", 12500, 58, "blog.elane.vn"]]),
    permissions: [
      { icon: Package, title: "Quản lý sản phẩm", desc: "Tạo, chỉnh sửa giá và tồn kho" },
      { icon: Globe, title: "Truy cập thông tin website", desc: "Tên miền, tiêu đề, thông tin cơ bản" },
      { icon: ShoppingBag, title: "Nhận đơn hàng", desc: "Đồng bộ đơn từ website về ÉLANE" },
      { icon: Newspaper, title: "Đăng bài blog", desc: "Tạo, chỉnh sửa và đăng nội dung" },
      { icon: BarChart3, title: "Xem thống kê truy cập", desc: "Lượt xem, nguồn truy cập và chuyển đổi" },
    ],
    previewTabs: ["Trang chủ", "Sản phẩm", "Blog"],
    previewActions: ["Mua ngay", "Liên hệ"],
  },

  youtube: {
    tagline: "Đăng video, quản lý bình luận và theo dõi hiệu quả kênh YouTube.",
    accountLabel: "kênh YouTube", idLabel: "ID kênh", followersLabel: "Người đăng ký", postsLabel: "Video",
    loginTitle: "Kết nối thông qua Google",
    loginDesc: "Hệ thống sẽ yêu cầu quyền cần thiết để quản lý video và bình luận trên kênh YouTube.",
    loginCta: "Đăng nhập với YouTube",
    features: ["Đăng video và Shorts theo lịch", "Quản lý bình luận", "Cập nhật tiêu đề, mô tả, thẻ", "Xem thống kê kênh", "Tự động đăng theo lịch"],
    notes: ["Bạn cần là chủ sở hữu hoặc quản lý của kênh.", SAFE_NOTE, DISCONNECT_NOTE, "Nếu không thấy kênh, hãy kiểm tra tài khoản Google đang đăng nhập."],
    commerce: false, canPost: true, shopName: null,
    accounts: mk([["ÉLANE Fashion TV", "Thời trang & Làm đẹp", 21500, 74], ["ÉLANE Behind The Scenes", "Cộng đồng", 3900, 22]]),
    permissions: [
      { icon: Video, title: "Đăng và quản lý video", desc: "Tải lên, lên lịch và cập nhật video" },
      { icon: UserRound, title: "Truy cập thông tin kênh", desc: "Tên kênh, ảnh đại diện, thông tin cơ bản" },
      { icon: MessageCircle, title: "Đọc và quản lý bình luận", desc: "Trả lời, ẩn hoặc xóa bình luận" },
      { icon: BarChart3, title: "Xem YouTube Analytics", desc: "Lượt xem, thời gian xem và đăng ký" },
    ],
    previewTabs: ["Trang chủ", "Video", "Shorts", "Giới thiệu"],
    previewActions: ["Đăng ký", "Tham gia"],
  },
};

export const flowOf = (id: ChannelId): ChannelFlow => CHANNEL_FLOW[id] ?? CHANNEL_FLOW.website;
