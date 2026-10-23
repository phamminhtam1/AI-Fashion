import { adminErrorMessage, adminLabel } from "@/lib/admin-language";
import {
  Archive,
  BarChart3,
  Bell,
  Blocks,
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Columns3,
  Compass,
  CreditCard,
  FileText,
  GalleryVerticalEnd,
  Home,
  KeyRound,
  LayoutGrid,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Package,
  Palette,
  Plus,
  Ruler,
  Search,
  Share2,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { adminApi, clearAdminApiCache } from "@/lib/api";
import { resolveAdminPath, getAdminUrl, ADMIN_ROUTES } from "@/lib/routes";
import { CategoriesManager } from "@/components/CategoriesManager";
import { ProductsManager } from "@/components/ProductsManager";
import { SizesManager } from "@/components/SizesManager";
import { InventoryManager, type InventorySeed } from "@/components/InventoryManager";
import { CustomersManager } from "@/components/CustomersManager";
import { DiscountCodesManager } from "@/components/DiscountCodesManager";
import { OrdersManager } from "@/components/OrdersManager";
import { ElaneWomanManager } from "@/components/ElaneWomanManager";
import { LookbookManager } from "@/components/LookbookManager";
import { AiKeysManager } from "@/components/AiKeysManager";
import { OverviewManager } from "@/components/OverviewManager";
import { SocialCommerceManager, type SocialPage } from "@/components/SocialCommerceManager";
import { RolesManager } from "@/components/RolesManager";

type Me = { account_id: string; email: string; full_name: string; employee_code: string | null; avatar_url: string | null; job_title: string | null; role_name: string | null; permissions: string[] };

export function AuthGate() {
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState("admin@elane.local");
  const [password, setPassword] = useState("Trang1234@");

  const refreshMe = useCallback(async () => {
    clearAdminApiCache();
    const next = await adminApi.me();
    setMe((current) => current && JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, []);

  useEffect(() => {
    adminApi
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Đang tải Trung tâm quản trị…
      </div>
    );
  }

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <form
          className="w-full max-w-md rounded-xs border border-border bg-background p-8"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await adminApi.login(email, password);
              await refreshMe();
              toast.success("Đăng nhập thành công");
            } catch (err) {
              toast.error(err instanceof Error ? adminErrorMessage(err) : "Đăng nhập thất bại");
            }
          }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.04em] text-primary">ÉLANE · QUẢN TRỊ</p>
          <h1 className="mt-3 font-sans admin-page-title">Đăng nhập</h1>
          <p className="mt-2 text-sm text-muted-foreground">Trung tâm quản trị — trung tâm điều hành thương mại.</p>
          <label className="mt-8 block text-sm font-medium">Email</label>
          <Input className="mt-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="mt-4 block text-sm font-medium">Mật khẩu</label>
          <Input className="mt-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" className="mt-8 w-full">
            Vào trang quản trị
          </Button>
        </form>
      </div>
    );
  }

  return (
    <AdminApp
      me={me}
      onMeRefresh={refreshMe}
      onLogout={async () => {
        await adminApi.logout().catch(() => {});
        setMe(null);
      }}
    />
  );
}

type NavItem = { id: string; label: string; icon: LucideIcon; count?: number };
type ModuleConfig = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  tabs: string[];
  metrics: Array<{ label: string; value: string; note: string }>;
  columns: string[];
  rows: string[][];
};

const operations: NavItem[] = [
  { id: "overview", label: "Tổng quan", icon: Home },
  { id: "orders", label: "Đơn hàng", icon: ShoppingBag, count: 12 },
  { id: "products", label: "Sản phẩm", icon: Package },
  { id: "categories", label: "Danh mục", icon: LayoutGrid },
  { id: "sizes", label: "Bảng kích cỡ", icon: Ruler },
  { id: "inventory", label: "Kho hàng", icon: Boxes, count: 5 },
  { id: "customers", label: "Khách hàng", icon: Users },
  { id: "promotions", label: "Khuyến mãi", icon: Tag },
  { id: "social", label: "Kênh bán hàng", icon: Share2 },
];
const content: NavItem[] = [
  { id: "elanewoman", label: "ÉLANEwoman", icon: GalleryVerticalEnd },
  { id: "collections", label: "Bộ sưu tập", icon: Sparkles },
  { id: "lookbook", label: "Bộ ảnh", icon: GalleryVerticalEnd },
  { id: "journal", label: "Tạp chí", icon: BookOpen, count: 3 },
  { id: "pages", label: "Trang nội dung", icon: FileText },
  { id: "reviews", label: "Đánh giá", icon: MessageSquareText, count: 8 },
  { id: "newsletter", label: "Bản tin", icon: Mail },
];
const system: NavItem[] = [
  { id: "ai_keys", label: "Quản lý khóa AI", icon: KeyRound },
  { id: "reports", label: "Báo cáo", icon: BarChart3 },
  { id: "settings", label: "Cài đặt", icon: Settings },
  { id: "roles", label: "Phân quyền", icon: ShieldCheck },
  { id: "audit", label: "Nhật ký", icon: ClipboardList },
];
const allItems = [...operations, ...content, ...system];

const modulePermissions: Record<string, string[]> = {
  overview: ["dashboard.read", "product.read"],
  orders: ["order.read"],
  products: ["product.read"],
  categories: ["category.read"],
  sizes: ["product.read"],
  inventory: ["inventory.read"],
  customers: ["customer.read"],
  promotions: ["promotion.read"],
  social: ["channel.read"],
  elanewoman: ["product.read"],
  collections: ["content.read", "product.read"],
  lookbook: ["content.read", "product.read"],
  journal: ["content.read"],
  pages: ["content.read"],
  reviews: ["content.read"],
  newsletter: ["content.read"],
  ai_keys: ["settings.read", "settings.write"],
  reports: ["report.read"],
  settings: ["settings.read"],
  roles: ["role.manage", "staff.manage"],
  audit: ["audit.read"],
};

const moduleWritePermissions: Record<string, string[]> = {
  orders: ["order.write"],
  products: ["product.write"],
  categories: ["category.write"],
  sizes: ["product.write"],
  inventory: ["inventory.receive", "inventory.issue", "inventory.adjust.request"],
  customers: ["customer.write"],
  promotions: ["promotion.write"],
  social: ["channel.write", "content.write"],
  elanewoman: ["product.write"],
  collections: ["content.write", "product.write"],
  lookbook: ["product.write"],
  journal: ["content.write"],
  pages: ["content.write"],
  reviews: ["content.write"],
  newsletter: ["content.write"],
  ai_keys: ["settings.write"],
  settings: ["settings.write"],
  roles: ["role.manage", "staff.manage"],
};

function canAccessModule(moduleId: string, permissions: string[]) {
  if (permissions.includes("*")) return true;
  return (modulePermissions[moduleId] ?? []).some((permission) => permissions.includes(permission));
}

function canInteractModule(moduleId: string, permissions: string[]) {
  if (permissions.includes("*")) return true;
  return (moduleWritePermissions[moduleId] ?? []).some((permission) => permissions.includes(permission));
}

const configs: Record<string, ModuleConfig> = {
  orders: {
    eyebrow: "Vận hành bán hàng",
    title: "Đơn hàng",
    description: "Theo dõi thanh toán, đóng gói, giao nhận và đổi trả.",
    action: "Tạo đơn hàng",
    tabs: ["Tất cả", "Chờ xác nhận", "Đang xử lý", "Đang giao", "Hoàn tất", "Đổi trả"],
    metrics: [
      { label: "Đơn hôm nay", value: "0", note: "Chưa có dữ liệu" },
      { label: "Chờ xử lý", value: "0", note: "—" },
      { label: "Đang giao", value: "0", note: "—" },
    ],
    columns: ["Mã đơn", "Khách hàng", "Sản phẩm", "Tổng tiền", "Thanh toán", "Trạng thái"],
    rows: [],
  },
  products: {
    eyebrow: "Danh mục thương mại",
    title: "Sản phẩm",
    description: "Quản lý thông tin, biến thể, hình ảnh, giá bán và trạng thái hiển thị.",
    action: "Thêm sản phẩm",
    tabs: ["Tất cả", "Đang bán", "Bản nháp", "Hết hàng", "Đã ẩn"],
    metrics: [
      { label: "Tổng sản phẩm", value: "248", note: "226 đang bán" },
      { label: "Biến thể", value: "1.482", note: "Màu × kích thước" },
      { label: "Giá trị tồn", value: "3,84 tỷ", note: "Theo giá vốn" },
    ],
    columns: ["Sản phẩm", "SKU", "Danh mục", "Giá bán", "Tồn kho", "Trạng thái"],
    rows: [
      ["Đầm lụa hai dây Noir", "EL-DR-041", "Váy / Đầm", "1.890.000₫", "42", "Đang bán"],
      ["Đầm suông linen Aurora", "EL-DR-040", "Váy / Đầm", "1.290.000₫", "67", "Đang bán"],
      ["Áo sơ mi lụa Ivory", "EL-TP-038", "Áo", "990.000₫", "114", "Đang bán"],
      ["Áo len Cashmere Soft", "EL-TP-036", "Áo", "1.190.000₫", "18", "Sắp hết"],
      ["Set tweed Parisienne", "EL-ST-032", "Set bộ", "2.490.000₫", "0", "Hết hàng"],
    ],
  },
  inventory: {
    eyebrow: "Kho vận",
    title: "Kho hàng",
    description: "Theo dõi tồn theo màu, kích thước và lịch sử điều chỉnh.",
    action: "Tạo phiếu nhập",
    tabs: ["Tổng quan", "Sắp hết", "Hết hàng", "Phiếu nhập", "Điều chỉnh"],
    metrics: [
      { label: "Tổng tồn", value: "4.862", note: "1.482 biến thể" },
      { label: "Sắp hết", value: "18", note: "Cần xử lý trong tuần" },
      { label: "Đang nhập", value: "326", note: "2 phiếu dự kiến" },
    ],
    columns: ["Sản phẩm", "Biến thể", "SKU", "Khả dụng", "Đã giữ", "Mức tồn"],
    rows: [
      ["Áo len Cashmere Soft", "Nâu / S", "EL-TP-036-BR-S", "2", "4", "Nguy cấp"],
      ["Chân váy Champagne", "Kem / M", "EL-SK-029-CR-M", "3", "1", "Sắp hết"],
      ["Đầm lụa Noir", "Đen / XS", "EL-DR-041-BK-XS", "5", "2", "Sắp hết"],
      ["Blazer oversize Noir", "Đen / L", "EL-OW-026-BK-L", "12", "3", "Ổn định"],
      ["Quần linen Dune", "Be / M", "EL-PT-031-BE-M", "38", "6", "Ổn định"],
    ],
  },
  customers: {
    eyebrow: "Quan hệ khách hàng",
    title: "Khách hàng",
    description: "Hồ sơ, hành vi mua sắm và phân khúc thành viên ÉLANE.",
    action: "Thêm khách hàng",
    tabs: ["Tất cả", "Mới", "Thân thiết", "VIP", "Cần chăm sóc"],
    metrics: [
      { label: "Tổng khách hàng", value: "0", note: "—" },
      { label: "Khách quay lại", value: "0", note: "—" },
      { label: "Giá trị vòng đời", value: "0", note: "—" },
    ],
    columns: ["Khách hàng", "Phân khúc", "Số đơn", "Tổng chi tiêu", "Đơn gần nhất", "Trạng thái"],
    rows: [],
  },
  promotions: {
    eyebrow: "Tăng trưởng",
    title: "Khuyến mãi",
    description: "Thiết lập mã ưu đãi, lịch giảm giá và điều kiện áp dụng.",
    action: "Tạo khuyến mãi",
    tabs: ["Đang chạy", "Sắp diễn ra", "Đã kết thúc", "Mã giảm giá"],
    metrics: [
      { label: "Doanh thu hỗ trợ", value: "684 triệu", note: "24,1% tổng doanh thu" },
      { label: "Mã đã dùng", value: "1.284", note: "Trong 30 ngày" },
      { label: "Chi phí ưu đãi", value: "92 triệu", note: "3,2% doanh thu" },
    ],
    columns: ["Chiến dịch", "Loại", "Ưu đãi", "Thời gian", "Lượt dùng", "Trạng thái"],
    rows: [
      ["Ưu đãi giữa mùa", "Giảm theo sản phẩm", "Đến 30%", "15–30/09", "842", "Đang chạy"],
      ["WELCOME10", "Mã đơn đầu", "10%", "Không giới hạn", "312", "Đang chạy"],
      ["ÉLANE Privé", "Theo phân khúc", "15%", "20–24/09", "—", "Sắp diễn ra"],
      ["Miễn phí vận chuyển từ 1 triệu", "Vận chuyển", "100% phí vận chuyển", "Không giới hạn", "1.924", "Đang chạy"],
    ],
  },
  collections: {
    eyebrow: "Biên tập thương hiệu",
    title: "Bộ sưu tập",
    description: "Sắp xếp câu chuyện mùa, sản phẩm và trải nghiệm ra mắt.",
    action: "Tạo bộ sưu tập",
    tabs: ["Đã xuất bản", "Bản nháp", "Đã lên lịch", "Lưu trữ"],
    metrics: [
      { label: "Đang hiển thị", value: "8", note: "3 bộ sưu tập mùa" },
      { label: "Sản phẩm gắn", value: "164", note: "66% danh mục" },
      { label: "Lượt xem", value: "84,2K", note: "30 ngày gần nhất" },
    ],
    columns: ["Bộ sưu tập", "Mùa", "Sản phẩm", "Cập nhật", "Hiệu quả", "Trạng thái"],
    rows: [
      ["Thu / Đông 2026", "AW26", "50", "Hôm nay", "32,4K lượt xem", "Đã xuất bản"],
      ["La Parisienne", "Bộ ảnh biên tập", "18", "18/09/2026", "18,7K lượt xem", "Đã xuất bản"],
      ["Thanh lịch công sở", "Thiết yếu", "26", "14/09/2026", "14,2K lượt xem", "Đã xuất bản"],
      ["Dạ tiệc mùa lễ hội", "FW26", "32", "12/09/2026", "—", "Bản nháp"],
    ],
  },
  lookbook: {
    eyebrow: "Thư viện hình ảnh",
    title: "Bộ ảnh",
    description: "Quản lý bộ ảnh, thứ tự khung hình và trạng thái xuất bản.",
    action: "Tải bộ ảnh",
    tabs: ["Tất cả", "Đã xuất bản", "Đang duyệt", "Bản nháp"],
    metrics: [
      { label: "Bộ ảnh", value: "24", note: "8 bộ trong AW26" },
      { label: "Khung hình", value: "486", note: "42 ảnh chưa dùng" },
      { label: "Lượt tương tác", value: "12,8%", note: "+2,4 điểm" },
    ],
    columns: ["Bộ ảnh", "Bộ sưu tập", "Khung hình", "Người phụ trách", "Cập nhật", "Trạng thái"],
    rows: [
      ["Phong cách mùa đông", "AW26", "18", "Linh Hà", "Hôm nay", "Sẵn sàng"],
      ["La Parisienne", "Bộ ảnh biên tập", "24", "Mai Phương", "18/09/2026", "Đã xuất bản"],
      ["Phom dáng mềm mại", "Thanh lịch công sở", "16", "An Nhiên", "14/09/2026", "Đang duyệt"],
      ["Sắc đen về đêm", "Dạ tiệc mùa lễ hội", "21", "Mai Phương", "12/09/2026", "Bản nháp"],
    ],
  },
  journal: {
    eyebrow: "Tòa soạn ÉLANE",
    title: "Tạp chí",
    description: "Lên lịch bài viết về phong cách, xu hướng và chăm sóc sản phẩm.",
    action: "Viết bài mới",
    tabs: ["Tất cả", "Đã xuất bản", "Chờ duyệt", "Đã lên lịch", "Bản nháp"],
    metrics: [
      { label: "Bài đã đăng", value: "126", note: "8 bài tháng này" },
      { label: "Đang chờ duyệt", value: "3", note: "Cần xử lý hôm nay" },
      { label: "Thời gian đọc", value: "4:32", note: "Trung bình mỗi phiên" },
    ],
    columns: ["Tiêu đề", "Chuyên mục", "Tác giả", "Lịch đăng", "Lượt đọc", "Trạng thái"],
    rows: [
      ["5 cách phối blazer mùa thu", "Phong cách", "Mai Phương", "22/09 · 09:00", "—", "Đã lên lịch"],
      ["Chất liệu cashmere và cách bảo quản", "Chăm sóc", "An Nhiên", "20/09 · 08:00", "8.420", "Đã xuất bản"],
      ["Bảng màu của La Parisienne", "Xu hướng", "Linh Hà", "19/09 · 10:30", "6.218", "Đã xuất bản"],
      ["Tủ đồ công sở tinh giản", "Hướng dẫn", "Mai Phương", "—", "—", "Chờ duyệt"],
    ],
  },
  pages: {
    eyebrow: "Nội dung trang web",
    title: "Trang nội dung",
    description: "Quản lý thông tin thương hiệu, hỗ trợ, chính sách và cửa hàng.",
    action: "Tạo trang",
    tabs: ["Tất cả", "Thương hiệu", "Hỗ trợ", "Chính sách", "Cửa hàng"],
    metrics: [
      { label: "Trang công khai", value: "14", note: "Tất cả hoạt động" },
      { label: "Cập nhật gần đây", value: "4", note: "Trong 7 ngày" },
      { label: "Điểm SEO", value: "94", note: "Tối ưu tốt" },
    ],
    columns: ["Trang", "Nhóm", "Đường dẫn", "Cập nhật", "SEO", "Trạng thái"],
    rows: [
      ["Về chúng tôi", "Thương hiệu", "/gioi-thieu", "18/09/2026", "96/100", "Đã xuất bản"],
      ["Hướng dẫn chọn kích cỡ", "Hỗ trợ", "/huong-dan-chon-size", "17/09/2026", "92/100", "Đã xuất bản"],
      ["Chính sách đổi trả", "Chính sách", "/chinh-sach/doi-tra", "15/09/2026", "95/100", "Đã xuất bản"],
      ["Hệ thống cửa hàng", "Cửa hàng", "/cua-hang", "12/09/2026", "90/100", "Đã xuất bản"],
    ],
  },
  reviews: {
    eyebrow: "Chất lượng cộng đồng",
    title: "Đánh giá",
    description: "Duyệt nhận xét, phản hồi khách hàng và theo dõi chất lượng sản phẩm.",
    action: "Xuất đánh giá",
    tabs: ["Chờ duyệt", "Đã duyệt", "Có phản hồi", "Đã ẩn"],
    metrics: [
      { label: "Điểm trung bình", value: "4,8/5", note: "Từ 2.842 đánh giá" },
      { label: "Chờ duyệt", value: "8", note: "2 đánh giá cần chú ý" },
      { label: "Tỷ lệ phản hồi", value: "92%", note: "Trong vòng 24 giờ" },
    ],
    columns: ["Khách hàng", "Sản phẩm", "Điểm", "Nhận xét", "Ngày gửi", "Trạng thái"],
    rows: [
      ["Mai Anh", "Đầm lụa Noir", "5 sao", "Chất lụa đẹp, dáng rất tôn người", "Hôm nay", "Chờ duyệt"],
      ["Thu Hương", "Blazer Noir", "4 sao", "Form đẹp, tay hơi dài", "Hôm nay", "Chờ duyệt"],
      ["Ngọc Diễm", "Set tweed Parisienne", "5 sao", "Đóng gói rất chỉn chu", "Hôm qua", "Đã phản hồi"],
      ["Minh Thư", "Áo lụa Ivory", "5 sao", "Màu sắc giống ảnh", "18/09/2026", "Đã duyệt"],
    ],
  },
  newsletter: {
    eyebrow: "Kênh trực tiếp",
    title: "Bản tin",
    description: "Quản lý người đăng ký, mẫu email và hiệu quả gửi.",
    action: "Tạo chiến dịch",
    tabs: ["Chiến dịch", "Người đăng ký", "Mẫu email", "Phân khúc"],
    metrics: [
      { label: "Người đăng ký", value: "12.480", note: "+386 tháng này" },
      { label: "Tỷ lệ mở", value: "42,8%", note: "Cao hơn 6,2% ngành" },
      { label: "Tỷ lệ nhấp", value: "8,4%", note: "+1,1 điểm" },
    ],
    columns: ["Chiến dịch", "Đối tượng", "Đã gửi", "Tỷ lệ mở", "Tỷ lệ nhấp", "Trạng thái"],
    rows: [
      ["Phong cách mùa đông", "Toàn bộ thành viên", "12.120", "46,2%", "9,8%", "Đã gửi"],
      ["Quyền mua sớm dành cho thành viên Privé", "ÉLANE Privé", "842", "58,4%", "14,2%", "Đã gửi"],
      ["Ưu đãi giữa mùa", "Khách hoạt động", "9.420", "—", "—", "Đã lên lịch"],
      ["Chuỗi chào mừng · 01", "Khách mới", "Tự động", "52,1%", "12,6%", "Đang chạy"],
    ],
  },
  reports: {
    eyebrow: "Phân tích kinh doanh",
    title: "Báo cáo",
    description: "Đo lường doanh thu, sản phẩm, khách hàng và hiệu suất kênh bán.",
    action: "Xuất báo cáo",
    tabs: ["Doanh thu", "Sản phẩm", "Khách hàng", "Kênh bán", "Đổi trả"],
    metrics: [
      { label: "Doanh thu ròng", value: "2,84 tỷ", note: "+18,4% tháng này" },
      { label: "Lợi nhuận gộp", value: "64,2%", note: "+1,8 điểm" },
      { label: "Tỷ lệ đổi trả", value: "4,1%", note: "Trong ngưỡng mục tiêu" },
    ],
    columns: ["Chỉ số", "Tháng này", "Tháng trước", "Thay đổi", "Mục tiêu", "Đánh giá"],
    rows: [
      ["Doanh thu thuần", "2.840.000.000₫", "2.398.000.000₫", "+18,4%", "2,7 tỷ", "Vượt mục tiêu"],
      ["Số đơn", "1.284", "1.196", "+7,4%", "1.250", "Vượt mục tiêu"],
      ["Giá trị đơn TB", "2.212.000₫", "2.005.000₫", "+10,3%", "2,1 triệu", "Tốt"],
      ["Tỷ lệ chuyển đổi", "4,7%", "4,4%", "+0,3 điểm", "5,0%", "Cần cải thiện"],
    ],
  },
  settings: {
    eyebrow: "Cấu hình cửa hàng",
    title: "Cài đặt",
    description: "Thông tin thương hiệu, thanh toán, vận chuyển và quy tắc bán hàng.",
    action: "Lưu thay đổi",
    tabs: ["Thông tin chung", "Thanh toán", "Vận chuyển", "Đổi trả", "Thông báo"],
    metrics: [
      { label: "Phương thức thanh toán", value: "4", note: "COD, thẻ và ví điện tử" },
      { label: "Đơn vị vận chuyển", value: "3", note: "Tất cả đang hoạt động" },
      { label: "Ngưỡng miễn phí ship", value: "1 triệu", note: "Áp dụng toàn quốc" },
    ],
    columns: ["Thiết lập", "Giá trị hiện tại", "Phạm vi", "Cập nhật bởi", "Lần cuối", "Trạng thái"],
    rows: [
      ["Tên thương hiệu", "ÉLANE", "Toàn hệ thống", "Linh Hà", "18/09/2026", "Hoạt động"],
      ["Miễn phí vận chuyển", "Từ 1.000.000₫", "Việt Nam", "Thu Vân", "17/09/2026", "Hoạt động"],
      ["Thời hạn đổi trả", "30 ngày", "Mọi đơn hàng", "Thu Vân", "15/09/2026", "Hoạt động"],
      ["Đường dây nóng", "1900 0000", "Website", "Linh Hà", "12/09/2026", "Hoạt động"],
    ],
  },
  roles: {
    eyebrow: "Quản trị hệ thống",
    title: "Phân quyền",
    description: "Quản lý thành viên nội bộ và phạm vi truy cập theo vai trò.",
    action: "Mời thành viên",
    tabs: ["Thành viên", "Vai trò", "Quyền truy cập", "Lời mời"],
    metrics: [
      { label: "Thành viên", value: "12", note: "10 đang hoạt động" },
      { label: "Vai trò", value: "4", note: "Phân tách theo nghiệp vụ" },
      { label: "Lời mời chờ", value: "2", note: "Hết hạn sau 5 ngày" },
    ],
    columns: ["Thành viên", "Vai trò", "Phạm vi", "Đăng nhập gần nhất", "Bảo mật", "Trạng thái"],
    rows: [
      ["Linh Hà", "Quản trị viên", "Toàn hệ thống", "2 phút trước", "2FA", "Hoạt động"],
      ["Thu Vân", "Vận hành", "Đơn hàng & Kho", "18 phút trước", "2FA", "Hoạt động"],
      ["Mai Phương", "Biên tập viên", "Nội dung", "1 giờ trước", "2FA", "Hoạt động"],
      ["An Nhiên", "CSKH", "Khách hàng & Đánh giá", "Hôm qua", "Mật khẩu", "Hoạt động"],
    ],
  },
  audit: {
    eyebrow: "Kiểm soát nội bộ",
    title: "Nhật ký hoạt động",
    description: "Theo dõi thay đổi quan trọng và lịch sử thao tác của đội ngũ.",
    action: "Tải nhật ký",
    tabs: ["Tất cả", "Bán hàng", "Nội dung", "Hệ thống", "Bảo mật"],
    metrics: [
      { label: "Hoạt động hôm nay", value: "284", note: "Từ 8 thành viên" },
      { label: "Thay đổi quan trọng", value: "6", note: "Đã được ghi nhận" },
      { label: "Cảnh báo bảo mật", value: "0", note: "Hệ thống an toàn" },
    ],
    columns: ["Thời gian", "Thành viên", "Hành động", "Đối tượng", "Chi tiết", "Kết quả"],
    rows: [
      ["09:42", "Thu Vân", "Cập nhật trạng thái", "Đơn #EL-20481", "Đóng gói → Đang giao", "Thành công"],
      ["09:31", "Mai Phương", "Xuất bản", "Bài tạp chí", "Chăm sóc cashmere", "Thành công"],
      ["09:18", "Linh Hà", "Thay đổi giá", "EL-DR-041", "1.790.000₫ → 1.890.000₫", "Thành công"],
      ["08:54", "An Nhiên", "Phản hồi đánh giá", "Đánh giá #RV-842", "Phản hồi công khai", "Thành công"],
    ],
  },
};

const productConfig = configs["products"]!;
configs["categories"] = {
  ...productConfig,
  eyebrow: "Cấu trúc cửa hàng",
  title: "Danh mục",
  description: "Sắp xếp nhóm sản phẩm, thứ tự hiển thị và bộ lọc.",
  action: "Thêm danh mục",
  tabs: ["Sản phẩm", "Theo dịp", "Bộ lọc", "Đã ẩn"],
  metrics: [
    { label: "Danh mục", value: "13", note: "7 danh mục chính" },
    { label: "Theo dịp", value: "3", note: "Công sở, Dự tiệc, Casual" },
    { label: "Chưa phân loại", value: "2", note: "Cần xử lý" },
  ],
  columns: ["Danh mục", "Đường dẫn", "Sản phẩm", "Thứ tự", "Hiển thị", "Trạng thái"],
  rows: [
    ["Váy / Đầm", "/danh-muc/vay-dam", "68", "01", "Menu & trang chủ", "Đang hiển thị"],
    ["Áo", "/danh-muc/ao", "46", "02", "Menu & trang chủ", "Đang hiển thị"],
    ["Quần", "/danh-muc/quan", "32", "03", "Menu & trang chủ", "Đang hiển thị"],
    ["Chân váy", "/danh-muc/chan-vay", "28", "04", "Menu & trang chủ", "Đang hiển thị"],
    ["Phụ kiện", "/danh-muc/phu-kien", "18", "07", "Danh mục điều hướng", "Đang hiển thị"],
  ],
};

export function AdminApp({ me, onMeRefresh, onLogout }: { me: Me; onMeRefresh: () => Promise<void>; onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const syncPermissions = () => {
      if (document.visibilityState === "visible") void onMeRefresh().catch(() => undefined);
    };
    const interval = window.setInterval(syncPermissions, 10000);
    window.addEventListener("focus", syncPermissions);
    document.addEventListener("visibilitychange", syncPermissions);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", syncPermissions);
      document.removeEventListener("visibilitychange", syncPermissions);
    };
  }, [onMeRefresh]);

  // Parse path to active tab, action, subParam, detailId
  const { tabId: routeTabId, action: routeAction, subParam: routeSubParam, detailId: routeDetailId } = resolveAdminPath(location.pathname);
  const active = routeTabId;

  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<string[] | null>(null);
  const [orderMeta, setOrderMeta] = useState<
    Record<string, { id: string; payment_method: string; payment_status: string }>
  >({});
  const [liveConfigs, setLiveConfigs] = useState(configs);
  const [inventorySeed, setInventorySeed] = useState<InventorySeed | null>(null);
  const [orderSeed, setOrderSeed] = useState<string | null>(null);

  const socialSubPage = useMemo<SocialPage>(() => {
    if (active !== "social") return "overview";
    if (routeAction === "create") return "add-channel";
    if (routeAction === "detail") return "posts";
    if (!routeSubParam) return "overview";
    const map: Record<string, SocialPage> = {
      ketnoi: "connect",
      connect: "connect",
      quanly: "channel-manage",
      "channel-manage": "channel-manage",
      cauhinh: "channel-manage",
      "channel-config": "channel-manage",
      "ai-content": "ai-content",
      ai: "ai-content",
      baiviet: "posts",
      posts: "posts",
      tinnhan: "messages",
      messages: "messages",
      binhluan: "comments",
      comments: "comments",
      themkenh: "add-channel",
      "add-channel": "add-channel",
    };
    return map[routeSubParam.toLowerCase()] ?? "overview";
  }, [active, routeAction, routeSubParam]);

  const handleSocialPageChange = useCallback(
    (next: SocialPage) => {
      setMobileOpen(false);
      setQuery("");
      const slugMap: Record<SocialPage, string | null> = {
        overview: null,
        connect: "ketnoi",
        "channel-manage": "quanly",
        "add-channel": "them",
        "ai-content": "ai-content",
        posts: "baiviet",
        messages: "tinnhan",
        comments: "binhluan",
      };
      const sub = slugMap[next];
      navigate({ to: sub ? `/kenhbanhang/${sub}` : "/kenhbanhang" });
    },
    [navigate],
  );

  const title = allItems.find((item) => item.id === active)?.label ?? "Tổng quan";
  const currentConfig = liveConfigs[active] ?? productConfig;
  const accessibleModuleIds = useMemo(
    () => new Set(allItems.filter((item) => canAccessModule(item.id, me.permissions)).map((item) => item.id)),
    [me.permissions],
  );
  const fallbackModule = allItems.find((item) => accessibleModuleIds.has(item.id))?.id ?? "overview";

  useEffect(() => {
    if (!accessibleModuleIds.has(active)) {
      toast.error("Bạn không có quyền truy cập mục này");
      navigate({ to: getAdminUrl(fallbackModule) });
    }
  }, [accessibleModuleIds, active, fallbackModule, navigate]);

  useEffect(() => {
    const writeRoute = routeAction === "create" || routeAction === "edit";
    const routePermission = active === "social" && routeAction === "create" ? "channel.write" : null;
    const canWriteRoute = routePermission
      ? me.permissions.includes("*") || me.permissions.includes(routePermission)
      : active === "orders" && routeAction === "create"
        ? (me.permissions.includes("*") || (me.permissions.includes("order.write") && me.permissions.includes("order.customer.read")))
      : canInteractModule(active, me.permissions);
    if (writeRoute && !canWriteRoute) {
      toast.error("Bạn không có quyền thực hiện thao tác này");
      navigate({ to: getAdminUrl(active) });
    }
  }, [active, me.permissions, navigate, routeAction]);

  const CUSTOM_MANAGER_TABS = useMemo(
    () =>
      new Set([
        "overview",
        "products",
        "orders",
        "categories",
        "inventory",
        "sizes",
        "customers",
        "promotions",
        "social",
        "elanewoman",
        "lookbook",
        "ai_keys",
        "roles",
      ]),
    [],
  );

  // Auto-open create sheet ONLY for generic fallback modules (not for specialized managers)
  useEffect(() => {
    if (routeAction === "create" && !CUSTOM_MANAGER_TABS.has(active)) {
      setCreateOpen(true);
    } else {
      setCreateOpen(false);
    }
  }, [routeAction, active, CUSTOM_MANAGER_TABS]);

  // Sync subParam to orderSeed when URL is e.g. /donhang/ELN181489
  useEffect(() => {
    if (active === "orders") {
      setOrderSeed(routeSubParam ?? null);
    }
  }, [active, routeSubParam]);

  useEffect(() => {
    // Hydrate Phase 1 modules with API data
    Promise.all([
      canAccessModule("overview", me.permissions) ? adminApi.overview() : Promise.resolve(null),
      canAccessModule("products", me.permissions) ? adminApi.products({ limit: 20 }) : Promise.resolve(null),
      canAccessModule("inventory", me.permissions) ? adminApi.inventory() : Promise.resolve(null),
      (me.permissions.includes("*") || me.permissions.includes("staff.manage")) ? adminApi.staff() : Promise.resolve(null),
      canAccessModule("audit", me.permissions) ? adminApi.audit() : Promise.resolve(null),
      canAccessModule("orders", me.permissions) ? adminApi.orders().catch(() => ({
        items: [] as Array<{
          id: string;
          order_number: string;
          customer_name: string;
          grand_total_vnd: number;
          payment_method: string;
          payment_status: string;
          status: string;
          placed_at: string;
        }>,
      })) : Promise.resolve(null),
    ])
      .then(([overview, products, inventory, staff, audit, orderList]) => {
        if (orderList) {
          setOrderMeta(
            Object.fromEntries(
              orderList.items.map((o) => [
                o.order_number,
                {
                  id: o.id,
                  payment_method: o.payment_method,
                  payment_status: o.payment_status ?? "unpaid",
                },
              ]),
            ),
          );
        }
        setLiveConfigs((prev) => {
          const next = { ...prev };
          if (next.orders && orderList) {
            const statusLabel: Record<string, string> = {
              pending: "Chờ xác nhận",
              confirmed: "Đã duyệt",
              cancelled: "Đã hủy",
            };
            const payCell = (method: string, status: string) => {
              if (method === "cod") return "COD";
              if (method === "bank" && status === "awaiting") return "CK · chờ";
              if (method === "bank" && status === "paid") return "CK · đã TT";
              if (method === "bank") return "Chuyển khoản";
              return method;
            };
            next.orders = {
              ...next.orders,
              metrics: [
                { label: "Tổng đơn", value: String(orderList.items.length), note: "Từ hệ thống" },
                {
                  label: "Chờ xử lý",
                  value: String(orderList.items.filter((o) => o.status === "pending").length),
                  note: "Chờ xác nhận",
                },
                {
                  label: "Đã duyệt",
                  value: String(orderList.items.filter((o) => o.status === "confirmed").length),
                  note: "Đã xác nhận",
                },
              ],
              rows: orderList.items.map((o) => [
                o.order_number,
                o.customer_name,
                "—",
                `${Number(o.grand_total_vnd).toLocaleString("vi-VN")}₫`,
                payCell(o.payment_method, o.payment_status ?? "unpaid"),
                statusLabel[o.status] ?? adminLabel(o.status),
              ]),
            };
          }
          if (next.products && overview && products) {
            next.products = {
              ...next.products,
              metrics: [
                {
                  label: "Tổng sản phẩm",
                  value: String(overview.published_products + overview.draft_products),
                  note: `${overview.published_products} đang bán`,
                },
                { label: "Bản nháp", value: String(overview.draft_products), note: "Chưa công khai" },
                { label: "SKU sắp hết", value: String(overview.low_stock_skus), note: "Theo ngưỡng đặt hàng lại" },
              ],
              rows: products.items.slice(0, 20).map((p) => [
                String(p.name),
                String((p.variants as Array<{ sku?: string }> | undefined)?.[0]?.sku ?? "—"),
                String((p.category as { name?: string } | null)?.name ?? "—"),
                `${Number(p.price_vnd).toLocaleString("vi-VN")}₫`,
                "—",
                p.status === "published" ? "Đang bán" : p.status === "draft" ? "Bản nháp" : String(p.status),
              ]),
            };
          }
          if (next.inventory && overview && inventory) {
            next.inventory = {
              ...next.inventory,
              metrics: [
                { label: "SKU theo dõi", value: String(inventory.items.length), note: "Kho MAIN" },
                { label: "Sắp hết", value: String(overview.low_stock_skus), note: "Cần xử lý" },
                { label: "Phiếu nháp", value: String(overview.pending_inventory_docs), note: "Chờ ghi sổ" },
              ],
              rows: inventory.items.slice(0, 20).map((i) => [
                String(i.sku),
                "—",
                String(i.sku),
                String(i.available),
                String(i.reserved),
                Number(i.available) <= Number(i.reorder_point) ? "Sắp hết" : "Ổn định",
              ]),
            };
          }
          if (next.roles && staff) {
            next.roles = {
              ...next.roles,
              metrics: [
                { label: "Thành viên", value: String(staff.items.length), note: "Từ API" },
                next.roles.metrics[1]!,
                next.roles.metrics[2]!,
              ],
              rows: staff.items.map((s) => [
                String(s.full_name),
                "Nhân viên",
                "Toàn hệ thống",
                "—",
                "Phiên đăng nhập",
                String(s.status) === "active" ? "Hoạt động" : String(s.status),
              ]),
            };
          }
          if (next.audit && audit) {
            next.audit = {
              ...next.audit,
              rows: audit.items.slice(0, 20).map((a) => [
                new Date(String(a.occurred_at ?? a.occurredAt ?? Date.now())).toLocaleString("vi-VN"),
                me.full_name,
                String(a.action),
                `${a.resource_type}/${a.resource_id}`,
                "—",
                "Thành công",
              ]),
            };
          }
          if (next.settings) {
            next.settings = {
              ...next.settings,
              rows: [
                ["Tên thương hiệu", "ÉLANE", "Toàn hệ thống", me.full_name, "Hôm nay", "Hoạt động"],
                ...next.settings.rows.slice(1),
              ],
            };
          }
          return next;
        });
      })
      .catch((e) => toast.error(e instanceof Error ? adminErrorMessage(e) : "Không tải được dữ liệu API"));
  }, [me.full_name, me.permissions]);

  // Navigate cleanly via URL
  const choose = (id: string) => {
    setMobileOpen(false);
    setQuery("");
    if (!accessibleModuleIds.has(id)) {
      toast.error("Bạn không có quyền truy cập mục này");
      return;
    }
    const targetUrl = getAdminUrl(id);
    navigate({ to: targetUrl });
  };

  const handleOpenCreate = () => {
    if (!canInteractModule(active, me.permissions)) {
      toast.error("Bạn chỉ có quyền xem mục này");
      return;
    }
    if (active === "products") {
      navigate({ to: "/sanpham/themsanpham" });
    } else if (active === "categories") {
      navigate({ to: "/danhmuc/them" });
    } else if (active === "inventory") {
      navigate({ to: "/khohang/taophieu" });
    } else if (active === "sizes") {
      navigate({ to: "/bangsize/thembang" });
    } else if (active === "promotions") {
      navigate({ to: "/khuyenmai/them" });
    } else if (active === "lookbook") {
      navigate({ to: "/lookbook/them" });
    } else if (active === "elanewoman") {
      navigate({ to: "/elanewoman/them" });
    } else if (active === "ai_keys") {
      navigate({ to: "/ai-keys/them" });
    } else {
      setCreateOpen(true);
      navigate({ to: getAdminUrl(active, "create") });
    }
  };

  const handleCloseCreate = (open: boolean) => {
    setCreateOpen(open);
    if (!open && routeAction === "create") {
      navigate({ to: getAdminUrl(active) });
    }
  };

  const goInventoryForProduct = (opts?: { productId?: string; productName?: string }) => {
    if (!accessibleModuleIds.has("inventory")) {
      toast.error("Bạn không có quyền truy cập kho hàng");
      return;
    }
    if (!me.permissions.includes("*") && !me.permissions.includes("inventory.receive")) {
      toast.error("Bạn không có quyền tạo phiếu nhập kho");
      return;
    }
    if (opts?.productId) {
      setInventorySeed({
        productId: opts.productId,
        productName: opts.productName,
        docType: "receipt",
      });
      setMobileOpen(false);
      setQuery("");
      navigate({ to: "/khohang/taophieu" });
    } else {
      choose("inventory");
    }
  };

  const goInventoryWithSeed = (seed: InventorySeed) => {
    if (!accessibleModuleIds.has("inventory")) {
      toast.error("Bạn không có quyền truy cập kho hàng");
      return;
    }
    const requiredPermission = seed.docType === "issue" ? "inventory.issue" : seed.docType === "adjustment" ? "inventory.adjust.request" : "inventory.receive";
    if (!me.permissions.includes("*") && !me.permissions.includes(requiredPermission)) {
      toast.error("Bạn không có quyền tạo loại phiếu kho này");
      return;
    }
    setInventorySeed(seed);
    setMobileOpen(false);
    setQuery("");
    navigate({ to: "/khohang/taophieu" });
  };

  const openDetail = (row: string[]) => {
    setSelectedRow(row);
    setDetailOpen(true);
  };

  return (
    <div className="admin-app min-h-screen bg-[#f8f9fa] text-slate-900">
      <Sidebar
        active={active}
        onChoose={choose}
        me={me}
        allowedIds={accessibleModuleIds}
        onLogout={onLogout}
        socialPage={socialSubPage}
        onSocialPageChange={handleSocialPageChange}
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[260px]"
      />
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <Sidebar
        active={active}
        onChoose={choose}
        me={me}
        allowedIds={accessibleModuleIds}
        onLogout={onLogout}
        socialPage={socialSubPage}
        onSocialPageChange={handleSocialPageChange}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] shadow-2xl transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        close={() => setMobileOpen(false)}
      />
      <main className="min-h-screen min-w-0 flex flex-col lg:ml-[260px]">
        {/* Top Header Bar matching mockup */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-5 lg:px-6">
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden shrink-0 size-9 rounded-xs border-slate-200"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu"
            >
              <Menu className="size-4" />
            </Button>
            {/* Global Search with ⌘ K */}
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm sản phẩm, đơn hàng, khách hàng..."
                className="h-10 w-full rounded-xs border-slate-200 bg-slate-50/70 pl-10 pr-12 text-sm text-slate-800 placeholder:text-slate-400 shadow-2xs focus:border-[#6941c6] focus:bg-white focus:ring-1 focus:ring-[#6941c6] transition-all"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-xs border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-medium text-slate-400 shadow-2xs">
                ⌘ K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notification Bell */}
            <button
              type="button"
              className="relative flex size-9 items-center justify-center rounded-xs border border-slate-200/80 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            {/* User Profile matching mockup */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-xs p-1 hover:bg-slate-50 transition-colors text-left focus:outline-hidden"
                >
                  <div className="size-9 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                    <img
                      src={me.avatar_url ?? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"}
                      alt={me.full_name || "Tài khoản quản trị"}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="hidden sm:block min-w-0 leading-tight">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {me.full_name || "Tài khoản quản trị"}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{me.role_name || me.job_title || "Nhân viên"}</p>
                  </div>
                  <ChevronDown className="size-3.5 text-slate-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xs p-1 shadow-lg">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900">{me.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{me.email}</p>
                </div>
                <DropdownMenuItem onClick={() => choose("settings")} className="cursor-pointer text-sm">
                  Cài đặt tài khoản
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-sm text-rose-600">
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Body */}
        <div className="min-w-0 flex-1 px-4 py-4 sm:px-5 lg:px-6 lg:py-4">
          <div key={active} className="admin-page-motion min-w-0">
          {active === "overview" ? (
            <OverviewManager
              userName={me?.full_name || me?.email?.split("@")[0] || "Admin"}
              onNavigate={choose}
              onNavigateToOrder={(orderNumber) => {
                setOrderSeed(orderNumber);
                navigate({ to: `/donhang/${orderNumber}` });
              }}
              onNavigateToInventoryProduct={(productId, productName) => {
                goInventoryForProduct({ productId, productName });
              }}
              onCreate={handleOpenCreate}
            />
          ) : active === "orders" ? (
            <OrdersManager
              permissions={me.permissions}
              onNavigateToInventory={goInventoryWithSeed}
              targetOrderNumber={routeSubParam ?? orderSeed}
              onOrderConsumed={() => setOrderSeed(null)}
            />
          ) : active === "categories" ? (
            <CategoriesManager permissions={me.permissions} />
          ) : active === "products" ? (
            <ProductsManager
              permissions={me.permissions}
              onNavigate={(section, opts) => {
                if (section === "inventory") goInventoryForProduct(opts);
                else choose(section);
              }}
            />
          ) : active === "inventory" ? (
            <InventoryManager
              permissions={me.permissions}
              seed={inventorySeed}
              onSeedConsumed={() => setInventorySeed(null)}
            />
          ) : active === "sizes" ? (
            <SizesManager permissions={me.permissions} />
          ) : active === "customers" ? (
            <CustomersManager
              permissions={me.permissions}
              onNavigateToOrder={(orderNumber) => {
                setOrderSeed(orderNumber);
                navigate({ to: `/donhang/${orderNumber}` });
              }}
            />
          ) : active === "promotions" ? (
            <DiscountCodesManager permissions={me.permissions} />
          ) : active === "social" ? (
            <SocialCommerceManager permissions={me.permissions} page={socialSubPage} onPageChange={handleSocialPageChange} initialPostId={routeDetailId} />
          ) : active === "elanewoman" ? (
            <ElaneWomanManager permissions={me.permissions} />
          ) : active === "lookbook" ? (
            <LookbookManager permissions={me.permissions} />
          ) : active === "ai_keys" ? (
            <AiKeysManager />
          ) : active === "roles" ? (
            <RolesManager permissions={me.permissions} onPermissionsChanged={onMeRefresh} />
          ) : currentConfig ? (
            <ModulePage
              config={currentConfig}
              query={query}
              setQuery={setQuery}
              onCreate={handleOpenCreate}
              onDetail={openDetail}
              activeTabId={active}
            />
          ) : null}
          </div>
        </div>
      </main>

      <DetailSheet
        open={detailOpen}
        setOpen={setDetailOpen}
        row={selectedRow}
        section={title}
        orderMeta={orderMeta}
        onMarkedPaid={() => {
          void adminApi.orders().then((orderList) => {
            setOrderMeta(
              Object.fromEntries(
                orderList.items.map((o) => [
                  o.order_number,
                  {
                    id: o.id,
                    payment_method: o.payment_method,
                    payment_status: o.payment_status ?? "unpaid",
                  },
                ]),
              ),
            );
          });
        }}
      />
      {!CUSTOM_MANAGER_TABS.has(active) && (
        <CreateSheet open={createOpen} setOpen={handleCloseCreate} section={title} />
      )}
    </div>
  );
}

function Sidebar({
  active,
  onChoose,
  className,
  close,
  me,
  allowedIds,
  onLogout,
  socialPage,
  onSocialPageChange,
}: {
  active: string;
  onChoose: (id: string) => void;
  className?: string;
  close?: () => void;
  me: Me;
  allowedIds: Set<string>;
  onLogout: () => void;
  socialPage?: SocialPage;
  onSocialPageChange?: (p: SocialPage) => void;
}) {
  const initials = me.full_name
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <aside className={cn("admin-sidebar flex h-screen min-h-0 flex-col overflow-hidden border-r border-slate-200/90 bg-white p-4", className)}>
      {/* Brand Header matching mockup */}
      <div className="flex items-center justify-between px-2 pt-1 pb-3">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onChoose("overview");
          }}
          className="cursor-pointer"
        >
          <p className="font-sans admin-metric font-semibold tracking-tight text-slate-900">ÉLANE</p>
        </a>
        {close ? (
          <Button variant="ghost" size="icon" onClick={close} className="size-8 rounded-xs text-slate-400">
            <X className="size-4" />
          </Button>
        ) : (
          <button
            type="button"
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xs border border-slate-200/80 hover:bg-slate-50 transition-colors"
            title="Thu gọn"
          >
            <Columns3 className="size-4" />
          </button>
        )}
      </div>

      {/* Nav Menu */}
      <nav className="mt-2 flex-1 overflow-y-auto pr-1 sidebar-scroll">
        <NavGroup
          label="Vận hành"
          items={operations}
          allowedIds={allowedIds}
          active={active}
          choose={onChoose}
          socialPage={socialPage}
          onSocialPageChange={onSocialPageChange}
        />
        <NavGroup label="Thư viện" items={content} allowedIds={allowedIds} active={active} choose={onChoose} />
        <NavGroup label="Hệ thống" items={system} allowedIds={allowedIds} active={active} choose={onChoose} />
      </nav>

      {/* Bottom Profile */}
      <div className="mt-3 border-t border-slate-100 pt-3 flex items-center justify-between px-1">
        <button
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left hover:bg-slate-50 p-1.5 rounded-xs transition-colors cursor-pointer"
          onClick={() => onChoose("roles")}
          disabled={!allowedIds.has("roles")}
          aria-hidden={!allowedIds.has("roles")}
        >
          <div className="size-8 overflow-hidden rounded-full bg-slate-900 font-sans text-sm text-white grid place-items-center">
            {me.avatar_url ? <img src={me.avatar_url} alt={me.full_name} className="size-full object-cover" /> : initials || "EL"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{me.full_name}</p>
            <p className="truncate text-xs text-slate-400">{me.role_name || me.job_title || "Nhân viên"}</p>
          </div>
        </button>
        <Button variant="ghost" size="icon" aria-label="Đăng xuất" onClick={onLogout} className="size-8 text-slate-400 hover:text-rose-600 rounded-xs">
          <LogOut className="size-4" />
        </Button>
      </div>
    </aside>
  );
}

function NavGroup({
  label,
  items,
  allowedIds,
  active,
  choose,
  socialPage,
  onSocialPageChange,
}: {
  label: string;
  items: NavItem[];
  allowedIds: Set<string>;
  active: string;
  choose: (id: string) => void;
  socialPage?: SocialPage;
  onSocialPageChange?: (p: SocialPage) => void;
}) {
  const visibleItems = items.filter((item) => allowedIds.has(item.id));
  if (visibleItems.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const href = getAdminUrl(item.id);
          const isCurrent = active === item.id;
          return (
            <div key={item.id} className="space-y-0.5">
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  choose(item.id);
                }}
                className={cn(
                  "admin-sidebar-item group flex w-full items-center gap-3 rounded-xs px-3 py-2 text-sm font-medium transition-all cursor-pointer",
                  isCurrent
                    ? "bg-[#f4f3ff] text-[#6941c6] font-semibold shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isCurrent ? "text-[#6941c6]" : "text-slate-400 group-hover:text-slate-600",
                  )}
                />
                <span>{item.label}</span>
                {item.id === "orders" ? (
                  <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white leading-none shadow-2xs">
                    {item.count || 12}
                  </span>
                ) : item.count ? (
                  <span className="ml-auto rounded-full bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-600 leading-none">
                    {item.count}
                  </span>
                ) : null}
              </a>
              {item.id === "social" && isCurrent && onSocialPageChange && (
                <div className="ml-7 border-l border-slate-200/80 pl-2 space-y-0.5 py-1">
                  {[
                    { id: "overview" as SocialPage, label: "Báo cáo hiệu quả", href: "/kenhbanhang" },
                    { id: "connect" as SocialPage, label: "Kết nối kênh", href: "/kenhbanhang/ketnoi" },
                    { id: "channel-manage" as SocialPage, label: "Quản lý kênh", href: "/kenhbanhang/quanly" },
                    { id: "ai-content" as SocialPage, label: "Content Studio", href: "/kenhbanhang/ai-content" },
                    { id: "posts" as SocialPage, label: "Bài viết & lịch đăng", href: "/kenhbanhang/baiviet" },
                    { id: "messages" as SocialPage, label: "Tin nhắn & bình luận", href: "/kenhbanhang/tinnhan" },
                  ].map((sub) => {
                    const isSubActive = (socialPage ?? "overview") === sub.id;
                    return (
                      <a
                        key={sub.id}
                        href={sub.href}
                        onClick={(e) => {
                          e.preventDefault();
                          onSocialPageChange(sub.id);
                        }}
                        className={cn(
                          "block rounded-xs px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                          isSubActive
                            ? "bg-[#f4f3ff] text-[#6941c6] font-semibold"
                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60",
                        )}
                      >
                        {sub.label}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModulePage({
  config,
  query,
  setQuery,
  onCreate,
  onDetail,
  activeTabId,
}: {
  config: ModuleConfig;
  query: string;
  setQuery: (s: string) => void;
  onCreate: () => void;
  onDetail: (r: string[]) => void;
  activeTabId?: string;
}) {
  const [tab, setTab] = useState(config.tabs[0] ?? "");
  const filtered = useMemo(
    () => config.rows.filter((r) => r.join(" ").toLowerCase().includes(query.toLowerCase())),
    [config.rows, query],
  );

  const createHref = activeTabId ? getAdminUrl(activeTabId, "create") : "#";

  return (
    <div className="space-y-5 font-sans pb-12">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground">{filtered.length} mục dữ liệu</span>
        <Button
          asChild
          className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer"
        >
          <a
            href={createHref}
            onClick={(e) => {
              e.preventDefault();
              onCreate();
            }}
          >
            <Plus className="size-3.5" />
            <span>{config.action}</span>
          </a>
        </Button>
      </div>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {config.metrics.map((m, i) => (
          <div
            key={m.label}
            className={cn("rounded-xs border p-5", i === 0 ? "border-accent bg-accent/25" : "border-border")}
          >
            <p className="section-label">{m.label}</p>
            <p className="mt-3 font-sans admin-metric">{m.value}</p>
            <p className={cn("mt-1 text-sm", i === 0 ? "text-primary" : "text-muted-foreground")}>{m.note}</p>
          </div>
        ))}
      </section>
      <section className="mt-6 overflow-hidden rounded-xs border border-border">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {config.tabs.map((t) => (
              <Button key={t} variant={tab === t ? "default" : "ghost"} size="sm" onClick={() => setTab(t)}>
                {t}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
                placeholder="Tìm kiếm…"
              />
            </div>
            <Button variant="outline" size="icon" aria-label="Bộ lọc">
              <Archive />
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-secondary/55">
              <tr>
                {config.columns.map((c) => (
                  <th key={c} className="px-4 py-3 text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
                    {c}
                  </th>
                ))}
                <th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={`${row[0]}-${i}`} className="border-t border-border transition-colors hover:bg-secondary/35">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={cn(
                        "px-4 py-3.5",
                        j === 0 ? "font-medium" : "text-muted-foreground",
                        j === row.length - 1 && "text-foreground",
                      )}
                    >
                      {j === row.length - 1 ? <Status text={cell} /> : cell}
                    </td>
                  ))}
                  <td className="px-2">
                    <Button variant="ghost" size="icon" onClick={() => onDetail(row)} aria-label={`Mở ${row[0]}`}>
                      <MoreHorizontal />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="grid h-48 place-items-center text-sm text-muted-foreground">
              Không tìm thấy kết quả phù hợp.
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>Hiển thị {filtered.length} mục</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Trước
            </Button>
            <Button variant="outline" size="sm">
              Sau
            </Button>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

function Status({ text }: { text: string }) {
  const urgent = /Chờ|Sắp hết|Nguy cấp|Đổi trả|Hết hàng/.test(text);
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium",
        urgent ? "bg-primary/10 text-primary" : "bg-secondary text-foreground",
      )}
    >
      {text}
    </span>
  );
}

function DetailSheet({
  open,
  setOpen,
  row,
  section,
  orderMeta,
  onMarkedPaid,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  row: string[] | null;
  section: string;
  orderMeta: Record<string, { id: string; payment_method: string; payment_status: string }>;
  onMarkedPaid: () => void;
}) {
  const [marking, setMarking] = useState(false);
  const meta = row?.[0] ? orderMeta[row[0]] : undefined;
  const canMarkPaid =
    section === "Đơn hàng" && meta?.payment_method === "bank" && meta.payment_status === "awaiting";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <p className="section-label text-primary">{section}</p>
          <SheetTitle className="font-sans admin-section-title">{row?.[0] ?? "Chi tiết"}</SheetTitle>
          <SheetDescription>Thông tin và lịch sử cập nhật của mục đã chọn.</SheetDescription>
        </SheetHeader>
        <div className="mt-7 space-y-1">
          {row?.map((v, i) => (
            <div key={i} className="flex items-start justify-between gap-6 border-b border-border py-3">
              <span className="text-sm uppercase tracking-[0.04em] text-muted-foreground">
                Trường {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-right text-sm font-medium">{v}</span>
            </div>
          ))}
        </div>
        {canMarkPaid && (
          <Button
            className="mt-6 w-full"
            disabled={marking}
            onClick={() => {
              if (!meta) return;
              setMarking(true);
              void adminApi
                .markOrderPaid(meta.id)
                .then(() => {
                  onMarkedPaid();
                  setOpen(false);
                })
                .catch(() => {})
                .finally(() => setMarking(false));
            }}
          >
            {marking ? "Đang cập nhật…" : "Đánh dấu đã nhận tiền"}
          </Button>
        )}
        <div className="mt-7 rounded-xs bg-secondary p-4">
          <p className="text-sm font-medium">Hoạt động gần nhất</p>
          <p className="mt-1 text-sm text-muted-foreground">Cập nhật bởi Linh Hà · 12 phút trước</p>
        </div>
        <div className="mt-6 flex gap-2">
          <Button className="flex-1" onClick={() => setOpen(false)}>
            Chỉnh sửa
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Đóng
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CreateSheet({
  open,
  setOpen,
  section,
}: {
  open: boolean;
  setOpen: (o: boolean) => void;
  section: string;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSaved(false);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <p className="section-label text-primary">Tạo mới</p>
          <SheetTitle className="font-sans admin-section-title">{section}</SheetTitle>
          <SheetDescription>Điền thông tin cơ bản để tạo bản nháp mới.</SheetDescription>
        </SheetHeader>
        {saved ? (
          <div className="mt-10 rounded-xs border border-border bg-secondary p-6 text-center">
            <div className="mx-auto grid size-10 place-items-center rounded-full bg-foreground text-background">✓</div>
            <h3 className="mt-4 font-sans admin-subsection-title">Đã lưu bản nháp</h3>
            <p className="mt-2 text-sm text-muted-foreground">Đây là thao tác minh họa giao diện, chưa lưu dữ liệu thật.</p>
            <Button className="mt-5" onClick={() => setOpen(false)}>
              Hoàn tất
            </Button>
          </div>
        ) : (
          <div className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-medium">Tên / tiêu đề</span>
              <Input className="mt-2" placeholder={`Nhập tên ${section.toLowerCase()}…`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Trạng thái</span>
              <button className="mt-2 flex h-9 w-full items-center justify-between rounded-xs border border-input px-3 text-sm">
                Bản nháp <ChevronDown className="size-4" />
              </button>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Ghi chú nội bộ</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-xs border border-input bg-transparent p-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                placeholder="Thêm ghi chú…"
              />
            </label>
            <div className="rounded-xs border border-dashed border-border p-6 text-center">
              <Upload className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Thả tệp vào đây hoặc chọn từ máy</p>
              <p className="mt-1 text-sm text-muted-foreground">JPG, PNG hoặc PDF · tối đa 10 MB</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={() => setSaved(true)}>
                Lưu bản nháp
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Hủy
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Footer() {
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-xs text-muted-foreground">
      <span>© 2026 ÉLANE · Modern Femininity</span>
      <span>Trung tâm quản trị · Tất cả hệ thống hoạt động ổn định</span>
    </footer>
  );
}
