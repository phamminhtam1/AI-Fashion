import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileText,
  GalleryVerticalEnd,
  Home,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Package,
  Plus,
  Ruler,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import winterEdit from "@/assets/elane-winter-edit.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { adminApi } from "@/lib/api";
import { CategoriesManager } from "@/components/CategoriesManager";
import { ProductsManager } from "@/components/ProductsManager";
import { SizesManager } from "@/components/SizesManager";
import { ColorsManager } from "@/components/ColorsManager";
import { InventoryManager } from "@/components/InventoryManager";
import { CustomersManager } from "@/components/CustomersManager";
import type { Overview } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tổng quan — ÉLANE Admin" },
      { name: "description", content: "Giao diện quản trị vận hành thương mại điện tử ÉLANE." },
      { property: "og:title", content: "ÉLANE Admin — Trung tâm vận hành" },
      { property: "og:description", content: "Quản lý sản phẩm, đơn hàng, nội dung và chiến dịch của ÉLANE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthGate,
});

type Me = { account_id: string; email: string; full_name: string; permissions: string[] };

function AuthGate() {
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState("admin@elane.local");
  const [password, setPassword] = useState("ElaneAdmin1!");

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
        Đang tải Atelier Console…
      </div>
    );
  }

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <form
          className="w-full max-w-md rounded-md border border-border bg-background p-8"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await adminApi.login(email, password);
              setMe(await adminApi.me());
              toast.success("Đăng nhập thành công");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Đăng nhập thất bại");
            }
          }}
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-primary">ÉLANE · ADMIN</p>
          <h1 className="mt-3 font-serif text-3xl">Đăng nhập</h1>
          <p className="mt-2 text-sm text-muted-foreground">Atelier Console — giữ nguyên giao diện hello-hub.</p>
          <label className="mt-8 block text-xs font-medium">Email</label>
          <Input className="mt-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="mt-4 block text-xs font-medium">Mật khẩu</label>
          <Input className="mt-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" className="mt-8 w-full">
            Vào console
          </Button>
        </form>
      </div>
    );
  }

  return (
    <AdminApp
      me={me}
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
  { id: "sizes", label: "Bảng size", icon: Ruler },
  { id: "colors", label: "Mảng màu", icon: Palette },
  { id: "inventory", label: "Kho hàng", icon: Boxes, count: 5 },
  { id: "customers", label: "Khách hàng", icon: Users },
  { id: "promotions", label: "Khuyến mãi", icon: Tag },
];
const content: NavItem[] = [
  { id: "collections", label: "Bộ sưu tập", icon: Sparkles },
  { id: "lookbook", label: "Lookbook", icon: GalleryVerticalEnd },
  { id: "journal", label: "Tạp chí", icon: BookOpen, count: 3 },
  { id: "pages", label: "Trang nội dung", icon: FileText },
  { id: "reviews", label: "Đánh giá", icon: MessageSquareText, count: 8 },
  { id: "newsletter", label: "Bản tin", icon: Mail },
];
const system: NavItem[] = [
  { id: "reports", label: "Báo cáo", icon: BarChart3 },
  { id: "settings", label: "Cài đặt", icon: Settings },
  { id: "roles", label: "Phân quyền", icon: ShieldCheck },
  { id: "audit", label: "Nhật ký", icon: ClipboardList },
];
const allItems = [...operations, ...content, ...system];

const configs: Record<string, ModuleConfig> = {
  orders: { eyebrow: "Vận hành bán hàng", title: "Đơn hàng", description: "Theo dõi thanh toán, đóng gói, giao nhận và đổi trả.", action: "Tạo đơn hàng", tabs: ["Tất cả", "Chờ xác nhận", "Đang xử lý", "Đang giao", "Hoàn tất", "Đổi trả"], metrics: [{label:"Đơn hôm nay",value:"128",note:"+8,2% so với hôm qua"},{label:"Chờ xử lý",value:"12",note:"3 đơn ưu tiên"},{label:"Đang giao",value:"47",note:"96% đúng hẹn"}], columns:["Mã đơn","Khách hàng","Sản phẩm","Tổng tiền","Thanh toán","Trạng thái"], rows:[["#EL-20481","Trần Mai Anh","2 sản phẩm","3.450.000₫","Đã thanh toán","Đang giao"],["#EL-20480","Ngọc Diễm","1 sản phẩm","1.980.000₫","COD","Đóng gói"],["#EL-20479","Hương Thảo","3 sản phẩm","5.120.000₫","Chờ thanh toán","Chờ xác nhận"],["#EL-20478","Kim Chi","2 sản phẩm","2.740.000₫","Đã thanh toán","Đã duyệt"],["#EL-20477","Thu Trang","1 sản phẩm","1.290.000₫","Đã hoàn tiền","Đổi trả"]]},
  products: { eyebrow:"Danh mục thương mại",title:"Sản phẩm",description:"Quản lý thông tin, biến thể, hình ảnh, giá bán và trạng thái hiển thị.",action:"Thêm sản phẩm",tabs:["Tất cả","Đang bán","Bản nháp","Hết hàng","Đã ẩn"],metrics:[{label:"Tổng sản phẩm",value:"248",note:"226 đang bán"},{label:"Biến thể",value:"1.482",note:"Màu × kích thước"},{label:"Giá trị tồn",value:"3,84 tỷ",note:"Theo giá vốn"}],columns:["Sản phẩm","SKU","Danh mục","Giá bán","Tồn kho","Trạng thái"],rows:[["Đầm lụa hai dây Noir","EL-DR-041","Váy / Đầm","1.890.000₫","42","Đang bán"],["Đầm suông linen Aurora","EL-DR-040","Váy / Đầm","1.290.000₫","67","Đang bán"],["Áo sơ mi lụa Ivory","EL-TP-038","Áo","990.000₫","114","Đang bán"],["Áo len Cashmere Soft","EL-TP-036","Áo","1.190.000₫","18","Sắp hết"],["Set tweed Parisienne","EL-ST-032","Set bộ","2.490.000₫","0","Hết hàng"]]},
  inventory: { eyebrow:"Kho vận",title:"Kho hàng",description:"Theo dõi tồn theo màu, kích thước và lịch sử điều chỉnh.",action:"Tạo phiếu nhập",tabs:["Tổng quan","Sắp hết","Hết hàng","Phiếu nhập","Điều chỉnh"],metrics:[{label:"Tổng tồn",value:"4.862",note:"1.482 biến thể"},{label:"Sắp hết",value:"18",note:"Cần xử lý trong tuần"},{label:"Đang nhập",value:"326",note:"2 phiếu dự kiến"}],columns:["Sản phẩm","Biến thể","SKU","Khả dụng","Đã giữ","Mức tồn"],rows:[["Áo len Cashmere Soft","Nâu / S","EL-TP-036-BR-S","2","4","Nguy cấp"],["Chân váy Champagne","Kem / M","EL-SK-029-CR-M","3","1","Sắp hết"],["Đầm lụa Noir","Đen / XS","EL-DR-041-BK-XS","5","2","Sắp hết"],["Blazer oversize Noir","Đen / L","EL-OW-026-BK-L","12","3","Ổn định"],["Quần linen Dune","Be / M","EL-PT-031-BE-M","38","6","Ổn định"]]},
  customers: { eyebrow:"Quan hệ khách hàng",title:"Khách hàng",description:"Hồ sơ, hành vi mua sắm và phân khúc thành viên ÉLANE.",action:"Thêm khách hàng",tabs:["Tất cả","Mới","Thân thiết","VIP","Cần chăm sóc"],metrics:[{label:"Tổng khách hàng",value:"18.420",note:"+312 tháng này"},{label:"Khách quay lại",value:"38,6%",note:"+4,1 điểm"},{label:"Giá trị vòng đời",value:"6,42 triệu",note:"Trung bình mỗi khách"}],columns:["Khách hàng","Phân khúc","Số đơn","Tổng chi tiêu","Đơn gần nhất","Trạng thái"],rows:[["Trần Mai Anh","ÉLANE Privé","18","42.680.000₫","Hôm nay","Hoạt động"],["Ngọc Diễm","Thân thiết","9","16.250.000₫","Hôm qua","Hoạt động"],["Hương Thảo","Mới","1","5.120.000₫","18/03/2026","Mới"],["Kim Chi","Thân thiết","7","12.740.000₫","16/03/2026","Hoạt động"],["Thu Trang","Cần chăm sóc","4","7.390.000₫","02/01/2026","Không hoạt động"]]},
  promotions: { eyebrow:"Tăng trưởng",title:"Khuyến mãi",description:"Thiết lập mã ưu đãi, lịch sale và điều kiện áp dụng.",action:"Tạo khuyến mãi",tabs:["Đang chạy","Sắp diễn ra","Đã kết thúc","Mã giảm giá"],metrics:[{label:"Doanh thu hỗ trợ",value:"684 triệu",note:"24,1% tổng doanh thu"},{label:"Mã đã dùng",value:"1.284",note:"Trong 30 ngày"},{label:"Chi phí ưu đãi",value:"92 triệu",note:"3,2% doanh thu"}],columns:["Chiến dịch","Loại","Ưu đãi","Thời gian","Lượt dùng","Trạng thái"],rows:[["Mid-season Sale","Giảm theo sản phẩm","Đến 30%","15–30/09","842","Đang chạy"],["WELCOME10","Mã đơn đầu","10%","Không giới hạn","312","Đang chạy"],["ÉLANE Privé","Theo phân khúc","15%","20–24/09","—","Sắp diễn ra"],["Freeship 1 triệu","Vận chuyển","100% phí ship","Không giới hạn","1.924","Đang chạy"]]},
  collections: { eyebrow:"Biên tập thương hiệu",title:"Bộ sưu tập",description:"Sắp xếp câu chuyện mùa, sản phẩm và trải nghiệm ra mắt.",action:"Tạo bộ sưu tập",tabs:["Đã xuất bản","Bản nháp","Đã lên lịch","Lưu trữ"],metrics:[{label:"Đang hiển thị",value:"8",note:"3 bộ sưu tập mùa"},{label:"Sản phẩm gắn",value:"164",note:"66% danh mục"},{label:"Lượt xem",value:"84,2K",note:"30 ngày gần nhất"}],columns:["Bộ sưu tập","Mùa","Sản phẩm","Cập nhật","Hiệu quả","Trạng thái"],rows:[["Autumn / Winter 2026","AW26","50","Hôm nay","32,4K lượt xem","Đã xuất bản"],["La Parisienne","Editorial","18","18/09/2026","18,7K lượt xem","Đã xuất bản"],["Office Refined","Essentials","26","14/09/2026","14,2K lượt xem","Đã xuất bản"],["Holiday Soirée","FW26","32","12/09/2026","—","Bản nháp"]]},
  lookbook: { eyebrow:"Thư viện hình ảnh",title:"Lookbook",description:"Quản lý bộ ảnh, thứ tự khung hình và trạng thái xuất bản.",action:"Tải bộ ảnh",tabs:["Tất cả","Đã xuất bản","Đang duyệt","Bản nháp"],metrics:[{label:"Bộ ảnh",value:"24",note:"8 bộ trong AW26"},{label:"Khung hình",value:"486",note:"42 ảnh chưa dùng"},{label:"Lượt tương tác",value:"12,8%",note:"+2,4 điểm"}],columns:["Lookbook","Bộ sưu tập","Khung hình","Người phụ trách","Cập nhật","Trạng thái"],rows:[["The Winter Edit","AW26","18","Linh Hà","Hôm nay","Sẵn sàng"],["La Parisienne","Editorial","24","Mai Phương","18/09/2026","Đã xuất bản"],["Soft Structure","Office Refined","16","An Nhiên","14/09/2026","Đang duyệt"],["Noir After Dark","Holiday Soirée","21","Mai Phương","12/09/2026","Bản nháp"]]},
  journal: { eyebrow:"Tòa soạn ÉLANE",title:"Tạp chí",description:"Lên lịch bài viết về phong cách, xu hướng và chăm sóc sản phẩm.",action:"Viết bài mới",tabs:["Tất cả","Đã xuất bản","Chờ duyệt","Đã lên lịch","Bản nháp"],metrics:[{label:"Bài đã đăng",value:"126",note:"8 bài tháng này"},{label:"Đang chờ duyệt",value:"3",note:"Cần xử lý hôm nay"},{label:"Thời gian đọc",value:"4:32",note:"Trung bình mỗi phiên"}],columns:["Tiêu đề","Chuyên mục","Tác giả","Lịch đăng","Lượt đọc","Trạng thái"],rows:[["5 cách phối blazer mùa thu","Phong cách","Mai Phương","22/09 · 09:00","—","Đã lên lịch"],["Chất liệu cashmere và cách bảo quản","Chăm sóc","An Nhiên","20/09 · 08:00","8.420","Đã xuất bản"],["Bảng màu của La Parisienne","Xu hướng","Linh Hà","19/09 · 10:30","6.218","Đã xuất bản"],["Tủ đồ công sở tinh giản","Hướng dẫn","Mai Phương","—","—","Chờ duyệt"]]},
  pages: { eyebrow:"Nội dung website",title:"Trang nội dung",description:"Quản lý thông tin thương hiệu, hỗ trợ, chính sách và cửa hàng.",action:"Tạo trang",tabs:["Tất cả","Thương hiệu","Hỗ trợ","Chính sách","Cửa hàng"],metrics:[{label:"Trang công khai",value:"14",note:"Tất cả hoạt động"},{label:"Cập nhật gần đây",value:"4",note:"Trong 7 ngày"},{label:"Điểm SEO",value:"94",note:"Tối ưu tốt"}],columns:["Trang","Nhóm","Đường dẫn","Cập nhật","SEO","Trạng thái"],rows:[["Về chúng tôi","Thương hiệu","/gioi-thieu","18/09/2026","96/100","Đã xuất bản"],["Hướng dẫn chọn size","Hỗ trợ","/huong-dan-chon-size","17/09/2026","92/100","Đã xuất bản"],["Chính sách đổi trả","Chính sách","/chinh-sach/doi-tra","15/09/2026","95/100","Đã xuất bản"],["Hệ thống cửa hàng","Cửa hàng","/cua-hang","12/09/2026","90/100","Đã xuất bản"]]},
  reviews: { eyebrow:"Chất lượng cộng đồng",title:"Đánh giá",description:"Duyệt nhận xét, phản hồi khách hàng và theo dõi chất lượng sản phẩm.",action:"Xuất đánh giá",tabs:["Chờ duyệt","Đã duyệt","Có phản hồi","Đã ẩn"],metrics:[{label:"Điểm trung bình",value:"4,8/5",note:"Từ 2.842 đánh giá"},{label:"Chờ duyệt",value:"8",note:"2 đánh giá cần chú ý"},{label:"Tỷ lệ phản hồi",value:"92%",note:"Trong vòng 24 giờ"}],columns:["Khách hàng","Sản phẩm","Điểm","Nhận xét","Ngày gửi","Trạng thái"],rows:[["Mai Anh","Đầm lụa Noir","5 sao","Chất lụa đẹp, dáng rất tôn người","Hôm nay","Chờ duyệt"],["Thu Hương","Blazer Noir","4 sao","Form đẹp, tay hơi dài","Hôm nay","Chờ duyệt"],["Ngọc Diễm","Set tweed Parisienne","5 sao","Đóng gói rất chỉn chu","Hôm qua","Đã phản hồi"],["Minh Thư","Áo lụa Ivory","5 sao","Màu sắc giống ảnh","18/09/2026","Đã duyệt"]]},
  newsletter: { eyebrow:"Kênh trực tiếp",title:"Bản tin",description:"Quản lý người đăng ký, mẫu email và hiệu quả gửi.",action:"Tạo chiến dịch",tabs:["Chiến dịch","Người đăng ký","Mẫu email","Phân khúc"],metrics:[{label:"Người đăng ký",value:"12.480",note:"+386 tháng này"},{label:"Tỷ lệ mở",value:"42,8%",note:"Cao hơn 6,2% ngành"},{label:"Tỷ lệ nhấp",value:"8,4%",note:"+1,1 điểm"}],columns:["Chiến dịch","Đối tượng","Đã gửi","Tỷ lệ mở","Tỷ lệ nhấp","Trạng thái"],rows:[["The Winter Edit","Toàn bộ thành viên","12.120","46,2%","9,8%","Đã gửi"],["Privé Early Access","ÉLANE Privé","842","58,4%","14,2%","Đã gửi"],["Mid-season Sale","Khách hoạt động","9.420","—","—","Đã lên lịch"],["Welcome series · 01","Khách mới","Tự động","52,1%","12,6%","Đang chạy"]]},
  reports: { eyebrow:"Phân tích kinh doanh",title:"Báo cáo",description:"Đo lường doanh thu, sản phẩm, khách hàng và hiệu suất kênh bán.",action:"Xuất báo cáo",tabs:["Doanh thu","Sản phẩm","Khách hàng","Kênh bán","Đổi trả"],metrics:[{label:"Doanh thu ròng",value:"2,84 tỷ",note:"+18,4% tháng này"},{label:"Lợi nhuận gộp",value:"64,2%",note:"+1,8 điểm"},{label:"Tỷ lệ đổi trả",value:"4,1%",note:"Trong ngưỡng mục tiêu"}],columns:["Chỉ số","Tháng này","Tháng trước","Thay đổi","Mục tiêu","Đánh giá"],rows:[["Doanh thu thuần","2.840.000.000₫","2.398.000.000₫","+18,4%","2,7 tỷ","Vượt mục tiêu"],["Số đơn","1.284","1.196","+7,4%","1.250","Vượt mục tiêu"],["Giá trị đơn TB","2.212.000₫","2.005.000₫","+10,3%","2,1 triệu","Tốt"],["Tỷ lệ chuyển đổi","4,7%","4,4%","+0,3 điểm","5,0%","Cần cải thiện"]]},
  settings: { eyebrow:"Cấu hình cửa hàng",title:"Cài đặt",description:"Thông tin thương hiệu, thanh toán, vận chuyển và quy tắc bán hàng.",action:"Lưu thay đổi",tabs:["Thông tin chung","Thanh toán","Vận chuyển","Đổi trả","Thông báo"],metrics:[{label:"Phương thức thanh toán",value:"4",note:"COD, thẻ và ví điện tử"},{label:"Đơn vị vận chuyển",value:"3",note:"Tất cả đang hoạt động"},{label:"Ngưỡng miễn phí ship",value:"1 triệu",note:"Áp dụng toàn quốc"}],columns:["Thiết lập","Giá trị hiện tại","Phạm vi","Cập nhật bởi","Lần cuối","Trạng thái"],rows:[["Tên thương hiệu","ÉLANE","Toàn hệ thống","Linh Hà","18/09/2026","Hoạt động"],["Miễn phí vận chuyển","Từ 1.000.000₫","Việt Nam","Thu Vân","17/09/2026","Hoạt động"],["Thời hạn đổi trả","30 ngày","Mọi đơn hàng","Thu Vân","15/09/2026","Hoạt động"],["Hotline","1900 0000","Website","Linh Hà","12/09/2026","Hoạt động"]]},
  roles: { eyebrow:"Quản trị hệ thống",title:"Phân quyền",description:"Quản lý thành viên nội bộ và phạm vi truy cập theo vai trò.",action:"Mời thành viên",tabs:["Thành viên","Vai trò","Quyền truy cập","Lời mời"],metrics:[{label:"Thành viên",value:"12",note:"10 đang hoạt động"},{label:"Vai trò",value:"4",note:"Phân tách theo nghiệp vụ"},{label:"Lời mời chờ",value:"2",note:"Hết hạn sau 5 ngày"}],columns:["Thành viên","Vai trò","Phạm vi","Đăng nhập gần nhất","Bảo mật","Trạng thái"],rows:[["Linh Hà","Quản trị viên","Toàn hệ thống","2 phút trước","2FA","Hoạt động"],["Thu Vân","Vận hành","Đơn hàng & Kho","18 phút trước","2FA","Hoạt động"],["Mai Phương","Biên tập viên","Nội dung","1 giờ trước","2FA","Hoạt động"],["An Nhiên","CSKH","Khách hàng & Đánh giá","Hôm qua","Mật khẩu","Hoạt động"]]},
  audit: { eyebrow:"Kiểm soát nội bộ",title:"Nhật ký hoạt động",description:"Theo dõi thay đổi quan trọng và lịch sử thao tác của đội ngũ.",action:"Tải nhật ký",tabs:["Tất cả","Bán hàng","Nội dung","Hệ thống","Bảo mật"],metrics:[{label:"Hoạt động hôm nay",value:"284",note:"Từ 8 thành viên"},{label:"Thay đổi quan trọng",value:"6",note:"Đã được ghi nhận"},{label:"Cảnh báo bảo mật",value:"0",note:"Hệ thống an toàn"}],columns:["Thời gian","Thành viên","Hành động","Đối tượng","Chi tiết","Kết quả"],rows:[["09:42","Thu Vân","Cập nhật trạng thái","Đơn #EL-20481","Đóng gói → Đang giao","Thành công"],["09:31","Mai Phương","Xuất bản","Bài tạp chí","Chăm sóc cashmere","Thành công"],["09:18","Linh Hà","Thay đổi giá","EL-DR-041","1.790.000₫ → 1.890.000₫","Thành công"],["08:54","An Nhiên","Phản hồi đánh giá","Đánh giá #RV-842","Phản hồi công khai","Thành công"]]},
};
const productConfig = configs["products"];
if (productConfig) {
  configs["categories"] = { ...productConfig, eyebrow:"Cấu trúc cửa hàng", title:"Danh mục", description:"Sắp xếp nhóm sản phẩm, thứ tự hiển thị và bộ lọc.", action:"Thêm danh mục", tabs:["Sản phẩm","Theo dịp","Bộ lọc","Đã ẩn"], metrics:[{label:"Danh mục",value:"13",note:"7 danh mục chính"},{label:"Theo dịp",value:"3",note:"Công sở, Dự tiệc, Casual"},{label:"Chưa phân loại",value:"2",note:"Cần xử lý"}], columns:["Danh mục","Đường dẫn","Sản phẩm","Thứ tự","Hiển thị","Trạng thái"], rows:[["Váy / Đầm","/danh-muc/vay-dam","68","01","Menu & trang chủ","Đang hiển thị"],["Áo","/danh-muc/ao","46","02","Menu & trang chủ","Đang hiển thị"],["Quần","/danh-muc/quan","32","03","Menu & trang chủ","Đang hiển thị"],["Chân váy","/danh-muc/chan-vay","28","04","Menu & trang chủ","Đang hiển thị"],["Phụ kiện","/danh-muc/phu-kien","18","07","Menu","Đang hiển thị"]] };
}

function AdminApp({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<string[] | null>(null);
  const [liveConfigs, setLiveConfigs] = useState(configs);
  const [inventorySeed, setInventorySeed] = useState<{
    productId: string;
    productName?: string;
  } | null>(null);
  const title = allItems.find((item) => item.id === active)?.label ?? "Tổng quan";
  const currentConfig = liveConfigs[active] ?? productConfig;

  useEffect(() => {
    // Hydrate Phase 1 modules with API data; keep layout/mock for the rest
    Promise.all([adminApi.overview(), adminApi.products(), adminApi.inventory(), adminApi.staff(), adminApi.audit()])
      .then(([overview, products, inventory, staff, audit]) => {
        setLiveConfigs((prev) => {
          const next = { ...prev };
          if (next.products) {
            next.products = {
              ...next.products,
              metrics: [
                { label: "Tổng sản phẩm", value: String(overview.published_products + overview.draft_products), note: `${overview.published_products} đang bán` },
                { label: "Bản nháp", value: String(overview.draft_products), note: "Chưa public" },
                { label: "SKU sắp hết", value: String(overview.low_stock_skus), note: "Theo reorder point" },
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
          if (next.inventory) {
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
          if (next.roles) {
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
                "Session",
                String(s.status) === "active" ? "Hoạt động" : String(s.status),
              ]),
            };
          }
          if (next.audit) {
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
      .catch((e) => toast.error(e instanceof Error ? e.message : "Không tải được dữ liệu API"));
  }, [me.full_name]);

  const choose = (id: string) => {
    setActive(id);
    setMobileOpen(false);
    setQuery("");
  };

  const goInventoryForProduct = (opts?: { productId?: string; productName?: string }) => {
    if (opts?.productId) {
      setInventorySeed({ productId: opts.productId, productName: opts.productName });
    }
    choose("inventory");
  };

  const openDetail = (row: string[]) => {
    setSelectedRow(row);
    setDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[248px_1fr]">
      <Sidebar active={active} onChoose={choose} me={me} onLogout={onLogout} className="hidden lg:flex" />
      {mobileOpen && <div className="fixed inset-0 z-40 bg-foreground/35 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <Sidebar
        active={active}
        onChoose={choose}
        me={me}
        onLogout={onLogout}
        className={cn("fixed inset-y-0 left-0 z-50 flex w-[272px] shadow-xl transition-transform lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}
        close={() => setMobileOpen(false)}
      />
      <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-10 lg:py-8 xl:px-12">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Mở menu">
              <Menu />
            </Button>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-primary">ÉLANE · ADMIN</p>
              <h1 className="mt-1 truncate font-serif text-2xl sm:text-3xl">{active === "overview" ? "Trung tâm điều hành" : title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-muted-foreground md:flex">
              <span className="size-1.5 rounded-full bg-primary" /> Trực tuyến · API
            </div>
            <Button variant="outline" size="icon" aria-label="Thông báo" className="relative">
              <Bell />
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
            </Button>
            <Button className="hidden sm:inline-flex" onClick={() => setCreateOpen(true)}>
              <Plus /> Tạo mới
            </Button>
          </div>
        </header>

        {active === "overview" ? (
          <Dashboard onNavigate={choose} onCreate={() => setCreateOpen(true)} onDetail={openDetail} />
        ) : active === "categories" ? (
          <CategoriesManager />
        ) : active === "products" ? (
          <ProductsManager
            onNavigate={(section, opts) => {
              if (section === "inventory") goInventoryForProduct(opts);
              else choose(section);
            }}
          />
        ) : active === "inventory" ? (
          <InventoryManager
            seedProduct={inventorySeed}
            onSeedConsumed={() => setInventorySeed(null)}
          />
        ) : active === "sizes" ? (
          <SizesManager />
        ) : active === "colors" ? (
          <ColorsManager />
        ) : active === "customers" ? (
          <CustomersManager />
        ) : currentConfig ? (
          <ModulePage config={currentConfig} query={query} setQuery={setQuery} onCreate={() => setCreateOpen(true)} onDetail={openDetail} />
        ) : null}
      </main>

      <DetailSheet open={detailOpen} setOpen={setDetailOpen} row={selectedRow} section={title} />
      <CreateSheet open={createOpen} setOpen={setCreateOpen} section={title} />
    </div>
  );
}

function Sidebar({
  active,
  onChoose,
  className,
  close,
  me,
  onLogout,
}: {
  active: string;
  onChoose: (id: string) => void;
  className?: string;
  close?: () => void;
  me: Me;
  onLogout: () => void;
}) {
  const initials = me.full_name
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <aside className={cn("flex min-h-screen flex-col border-r border-border bg-background p-5", className)}>
      <div className="flex items-start justify-between px-1">
        <div>
          <p className="font-serif text-2xl">ÉLANE</p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Atelier Console</p>
        </div>
        {close && (
          <Button variant="ghost" size="icon" onClick={close}>
            <X />
          </Button>
        )}
      </div>
      <div className="mt-5 h-px bg-border" />
      <nav className="mt-5 flex-1 overflow-y-auto pr-1">
        <NavGroup label="Vận hành" items={operations} active={active} choose={onChoose} />
        <NavGroup label="Thư viện" items={content} active={active} choose={onChoose} />
        <NavGroup label="Hệ thống" items={system} active={active} choose={onChoose} />
      </nav>
      <div className="mt-4 rounded-md border border-border p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">AW / 2026</p>
          <span className="text-xs font-medium">72%</span>
        </div>
        <Progress value={72} className="mt-3 h-1.5" />
        <p className="mt-2 text-xs text-muted-foreground">36/50 sản phẩm đã lên kệ</p>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-md p-2">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left hover:bg-secondary" onClick={() => onChoose("roles")}>
          <div className="grid size-9 place-items-center rounded-full bg-foreground font-serif text-xs text-background">{initials || "EL"}</div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{me.full_name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{me.email}</p>
          </div>
        </button>
        <Button variant="ghost" size="icon" aria-label="Đăng xuất" onClick={onLogout}>
          <LogOut className="size-3.5" />
        </Button>
      </div>
    </aside>
  );
}
function NavGroup({label,items,active,choose}:{label:string;items:NavItem[];active:string;choose:(id:string)=>void}) {
  return <div className="mb-5"><p className="mb-2 px-3 text-[9px] font-medium uppercase tracking-[0.24em] text-muted-foreground">{label}</p><div className="space-y-0.5">{items.map(item=>{const Icon=item.icon;return <button key={item.id} onClick={()=>choose(item.id)} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",active===item.id?"bg-foreground text-background":"text-muted-foreground hover:bg-secondary hover:text-foreground")}><Icon className="size-4"/><span>{item.label}</span>{item.count&&<span className={cn("ml-auto rounded-full px-1.5 text-[10px]",active===item.id?"bg-primary text-primary-foreground":"bg-primary/10 text-primary")}>{item.count}</span>}</button>})}</div></div>
}

const DOC_TYPE_VI: Record<string, string> = {
  receipt: "Nhập kho",
  issue: "Xuất kho",
  adjustment: "Điều chỉnh",
};
const DOC_STATUS_VI: Record<string, string> = {
  draft: "Nháp",
  approved: "Đã duyệt",
  posted: "Đã ghi sổ",
  void: "Hủy",
};
const PRODUCT_STATUS_VI: Record<string, string> = {
  draft: "Bản nháp",
  published: "Đang bán",
  archived: "Lưu trữ",
};

function Dashboard({ onNavigate }: { onNavigate: (id: string) => void; onCreate: () => void; onDetail: (row: string[]) => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  useEffect(() => {
    adminApi
      .overview()
      .then(setOv)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Không tải được tổng quan"));
  }, []);

  const statusSeries = ov?.products_by_status ?? [];
  const maxStatus = Math.max(1, ...statusSeries.map((s) => s.count));
  const lowCats = ov?.low_stock_by_category ?? [];
  const maxLow = Math.max(1, ...lowCats.map((c) => c.sku_count));
  const recent = ov?.recent_inventory_docs ?? [];

  return (
    <>
      <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Tổng quan vận hành từ catalog, kho và khách hàng</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onNavigate("inventory")}>
            <Plus /> Tạo phiếu kho
          </Button>
        </div>
      </div>
      <section className="mt-6 grid grid-cols-2 border-y border-border lg:grid-cols-4">
        {(
          [
            ["SP đang bán", ov ? String(ov.published_products) : "…", ov ? `${ov.draft_products} bản nháp` : ""],
            ["SKU sắp hết", ov ? String(ov.low_stock_skus) : "…", "Theo reorder point"],
            ["Phiếu kho chờ", ov ? String(ov.pending_inventory_docs) : "…", "Trạng thái nháp"],
            ["Tổng khách", ov ? String(ov.customer_total) : "…", "Hồ sơ trong hệ thống"],
          ] as Array<[string, string, string]>
        ).map((k, i) => (
          <div
            key={k[0]}
            className={cn(
              "py-5 lg:py-6",
              i % 2 === 0 ? "pr-4" : "pl-4",
              i < 3 && "lg:border-r lg:px-5",
              i < 2 && "max-lg:border-b",
              i === 0 && "lg:pl-0",
              i === 3 && "lg:pr-0",
            )}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{k[0]}</p>
            <p className="mt-2 font-serif text-2xl lg:text-3xl">{k[1]}</p>
            <p className={cn("mt-1 text-xs", i === 0 || i === 2 ? "text-primary" : "text-muted-foreground")}>
              {k[2]}
            </p>
          </div>
        ))}
      </section>
      <section className="mt-6 grid grid-cols-12 gap-4">
        <article className="col-span-12 rounded-md border border-border p-5 lg:col-span-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Catalog</p>
              <h2 className="mt-2 font-serif text-xl">Sản phẩm theo trạng thái</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("products")}>
              Xem sản phẩm <BarChart3 />
            </Button>
          </div>
          <div className="mt-5 flex h-40 items-end gap-3 border-b border-border pb-px">
            {statusSeries.map((s, i) => (
              <div key={s.status} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={cn("chart-bar w-full rounded-t-sm", i === 1 ? "bg-primary" : "bg-accent")}
                  style={{ height: `${(s.count / maxStatus) * 100}%`, minHeight: s.count ? 8 : 2 }}
                  title={`${PRODUCT_STATUS_VI[s.status] ?? s.status}: ${s.count}`}
                />
                <span className="text-[10px] text-muted-foreground">
                  {PRODUCT_STATUS_VI[s.status] ?? s.status}
                </span>
                <span className="text-xs font-medium">{s.count}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="col-span-12 rounded-md border border-border p-5 sm:col-span-6 lg:col-span-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Kho hàng</p>
              <h2 className="mt-2 font-serif text-xl">Sắp hết theo danh mục</h2>
            </div>
            <span className="rounded-full bg-primary px-2 py-1 text-[10px] text-primary-foreground">
              {ov?.low_stock_skus ?? 0} SKU
            </span>
          </div>
          <div className="mt-5 space-y-4">
            {lowCats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có SKU dưới reorder point.</p>
            ) : (
              lowCats.map((c) => (
                <div key={c.category_name}>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{c.category_name}</span>
                    <span className="text-primary">{c.sku_count} SKU</span>
                  </div>
                  <Progress value={(c.sku_count / maxLow) * 100} className="mt-2 h-1.5" />
                </div>
              ))
            )}
          </div>
        </article>
        <article className="col-span-12 rounded-md border border-border p-5 lg:col-span-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Mới nhất</p>
              <h2 className="mt-2 font-serif text-xl">Phiếu kho gần đây</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("inventory")}>
              Xem kho
            </Button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="pb-2 font-medium">Mã</th>
                  <th className="pb-2 font-medium">Loại</th>
                  <th className="pb-2 font-medium">Trạng thái</th>
                  <th className="pb-2 font-medium">Ngày</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-muted-foreground">
                      Chưa có phiếu kho.
                    </td>
                  </tr>
                ) : (
                  recent.map((row) => (
                    <tr key={row.id} className="border-b border-border/70 last:border-0">
                      <td className="py-3 font-medium">{row.code}</td>
                      <td className="py-3 text-muted-foreground">{DOC_TYPE_VI[row.type] ?? row.type}</td>
                      <td className="py-3">
                        <Status text={DOC_STATUS_VI[row.status] ?? row.status} />
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString("vi-VN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
        <article className="col-span-12 flex flex-col rounded-md bg-foreground p-5 text-background sm:col-span-6 lg:col-span-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-background/55">Chiến dịch đang chạy</p>
          <h2 className="mt-3 font-serif text-xl">
            Modern Femininity
            <br />
            Autumn / Winter 2026
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-background/55">Lượt tiếp cận</p>
              <p className="mt-1 font-serif text-xl">2,4M</p>
            </div>
            <div>
              <p className="text-xs text-background/55">Chuyển đổi</p>
              <p className="mt-1 font-serif text-xl">4,2%</p>
            </div>
          </div>
          <Progress value={86} className="mt-6 bg-background/15 [&>div]:bg-primary" />
          <p className="mt-2 text-xs text-background/55">86% mục tiêu · còn 12 ngày</p>
          <Button variant="secondary" className="mt-5 w-full" onClick={() => onNavigate("promotions")}>
            Quản lý chiến dịch
          </Button>
        </article>
        <article className="col-span-12 rounded-md border border-border p-5 sm:col-span-6 lg:col-span-4">
          <p className="section-label">Lookbook</p>
          <h2 className="mt-2 font-serif text-xl">The Winter Edit</h2>
          <img
            src={winterEdit}
            alt="Lookbook The Winter Edit"
            loading="lazy"
            width={1200}
            height={900}
            className="mt-4 aspect-[4/3] w-full rounded object-cover"
          />
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">18 looks · Sẵn sàng xuất bản</p>
            <Button size="sm" onClick={() => onNavigate("lookbook")}>
              Xem
            </Button>
          </div>
        </article>
        <article className="col-span-12 rounded-md border border-border p-5 lg:col-span-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Công việc</p>
              <h2 className="mt-2 font-serif text-xl">Tác vụ cần xử lý</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["Xem khách hàng VIP / cần chăm sóc", "customers"],
                ["Duyệt bài tạp chí", "journal"],
                ["Xử lý SKU sắp hết", "inventory"],
                ["Cập nhật sản phẩm nháp", "products"],
              ] as Array<[string, string]>
            ).map(([label, id]) => (
              <button
                key={label}
                onClick={() => onNavigate(id)}
                className="flex items-center gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="size-4 rounded-sm border border-border" />
                <span className="text-sm font-medium">{label}</span>
                <span className="ml-auto text-muted-foreground">→</span>
              </button>
            ))}
          </div>
        </article>
      </section>
      <Footer />
    </>
  );
}

function ModulePage({config,query,setQuery,onCreate,onDetail}:{config:ModuleConfig;query:string;setQuery:(s:string)=>void;onCreate:()=>void;onDetail:(r:string[])=>void}) {
 const [tab,setTab]=useState(config.tabs[0] ?? "");
 const filtered=useMemo(()=>config.rows.filter(r=>r.join(" ").toLowerCase().includes(query.toLowerCase())),[config.rows,query]);
 return <>
  <div className="mt-7 flex flex-wrap items-end justify-between gap-4"><div><p className="section-label text-primary">{config.eyebrow}</p><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{config.description}</p></div><Button onClick={onCreate}><Plus/>{config.action}</Button></div>
  <section className="mt-6 grid gap-4 sm:grid-cols-3">{config.metrics.map((m,i)=><div key={m.label} className={cn("rounded-md border p-5",i===0?"border-accent bg-accent/25":"border-border")}><p className="section-label">{m.label}</p><p className="mt-3 font-serif text-3xl">{m.value}</p><p className={cn("mt-1 text-xs",i===0?"text-primary":"text-muted-foreground")}>{m.note}</p></div>)}</section>
  <section className="mt-6 overflow-hidden rounded-md border border-border">
   <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">{config.tabs.map(t=><Button key={t} variant={tab===t?"default":"ghost"} size="sm" onClick={()=>setTab(t)}>{t}</Button>)}</div><div className="flex gap-2"><div className="relative flex-1 lg:w-64"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input value={query} onChange={e=>setQuery(e.target.value)} className="pl-9" placeholder="Tìm kiếm…"/></div><Button variant="outline" size="icon" aria-label="Bộ lọc"><Archive/></Button></div></div>
   <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-secondary/55"><tr>{config.columns.map(c=><th key={c} className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{c}</th>)}<th className="w-14"/></tr></thead><tbody>{filtered.map((row,i)=><tr key={`${row[0]}-${i}`} className="border-t border-border transition-colors hover:bg-secondary/35">{row.map((cell,j)=><td key={j} className={cn("px-4 py-3.5",j===0?"font-medium":"text-muted-foreground",j===row.length-1&&"text-foreground")} >{j===row.length-1?<Status text={cell}/>:cell}</td>)}<td className="px-2"><Button variant="ghost" size="icon" onClick={()=>onDetail(row)} aria-label={`Mở ${row[0]}`}><MoreHorizontal/></Button></td></tr>)}</tbody></table>{filtered.length===0&&<div className="grid h-48 place-items-center text-sm text-muted-foreground">Không tìm thấy kết quả phù hợp.</div>}</div>
   <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground"><span>Hiển thị {filtered.length} mục</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled>Trước</Button><Button variant="outline" size="sm">Sau</Button></div></div>
  </section><Footer/>
 </>
}
function Status({text}:{text:string}) { const urgent=/Chờ|Sắp hết|Nguy cấp|Đổi trả|Hết hàng/.test(text); return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium",urgent?"bg-primary/10 text-primary":"bg-secondary text-foreground")}>{text}</span> }
function DetailSheet({open,setOpen,row,section}:{open:boolean;setOpen:(o:boolean)=>void;row:string[]|null;section:string}) {return <Sheet open={open} onOpenChange={setOpen}><SheetContent className="w-full overflow-y-auto sm:max-w-lg"><SheetHeader><p className="section-label text-primary">{section}</p><SheetTitle className="font-serif text-2xl">{row?.[0] ?? "Chi tiết"}</SheetTitle><SheetDescription>Thông tin và lịch sử cập nhật của mục đã chọn.</SheetDescription></SheetHeader><div className="mt-7 space-y-1">{row?.map((v,i)=><div key={i} className="flex items-start justify-between gap-6 border-b border-border py-3"><span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Trường {String(i+1).padStart(2,"0")}</span><span className="text-right text-sm font-medium">{v}</span></div>)}</div><div className="mt-7 rounded-md bg-secondary p-4"><p className="text-xs font-medium">Hoạt động gần nhất</p><p className="mt-1 text-xs text-muted-foreground">Cập nhật bởi Linh Hà · 12 phút trước</p></div><div className="mt-6 flex gap-2"><Button className="flex-1" onClick={()=>setOpen(false)}>Chỉnh sửa</Button><Button variant="outline" className="flex-1" onClick={()=>setOpen(false)}>Đóng</Button></div></SheetContent></Sheet>}
function CreateSheet({open,setOpen,section}:{open:boolean;setOpen:(o:boolean)=>void;section:string}) { const [saved,setSaved]=useState(false); return <Sheet open={open} onOpenChange={o=>{setOpen(o);if(!o)setSaved(false)}}><SheetContent className="w-full overflow-y-auto sm:max-w-lg"><SheetHeader><p className="section-label text-primary">Tạo mới</p><SheetTitle className="font-serif text-2xl">{section}</SheetTitle><SheetDescription>Điền thông tin cơ bản để tạo bản nháp mới.</SheetDescription></SheetHeader>{saved?<div className="mt-10 rounded-md border border-border bg-secondary p-6 text-center"><div className="mx-auto grid size-10 place-items-center rounded-full bg-foreground text-background">✓</div><h3 className="mt-4 font-serif text-xl">Đã lưu bản nháp</h3><p className="mt-2 text-sm text-muted-foreground">Đây là thao tác minh họa giao diện, chưa lưu dữ liệu thật.</p><Button className="mt-5" onClick={()=>setOpen(false)}>Hoàn tất</Button></div>:<div className="mt-7 space-y-5"><label className="block"><span className="text-xs font-medium">Tên / tiêu đề</span><Input className="mt-2" placeholder={`Nhập tên ${section.toLowerCase()}…`}/></label><label className="block"><span className="text-xs font-medium">Trạng thái</span><button className="mt-2 flex h-9 w-full items-center justify-between rounded-md border border-input px-3 text-sm">Bản nháp <ChevronDown className="size-4"/></button></label><label className="block"><span className="text-xs font-medium">Ghi chú nội bộ</span><textarea className="mt-2 min-h-28 w-full rounded-md border border-input bg-transparent p-3 text-sm outline-none focus:ring-1 focus:ring-ring" placeholder="Thêm ghi chú…"/></label><div className="rounded-md border border-dashed border-border p-6 text-center"><Upload className="mx-auto size-5 text-muted-foreground"/><p className="mt-2 text-sm font-medium">Thả tệp vào đây hoặc chọn từ máy</p><p className="mt-1 text-xs text-muted-foreground">JPG, PNG hoặc PDF · tối đa 10 MB</p></div><div className="flex gap-2 pt-2"><Button className="flex-1" onClick={()=>setSaved(true)}>Lưu bản nháp</Button><Button variant="outline" onClick={()=>setOpen(false)}>Hủy</Button></div></div>}</SheetContent></Sheet> }
function Footer(){return <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-[11px] text-muted-foreground"><span>© 2026 ÉLANE · Modern Femininity</span><span>Atelier Console · Tất cả hệ thống hoạt động ổn định</span></footer>}
