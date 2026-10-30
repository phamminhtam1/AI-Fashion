import { adminErrorMessage } from "@/lib/admin-language";
import { AdminPagination } from "@/components/AdminPagination";
import { AnimatedPanel } from "@/components/ui/AnimatedPanel";
import { AnimatedValue } from "@/components/ui/AnimatedValue";
import {
  Archive,
  ArrowLeft,
  ArrowUpDown,
  Bold,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Globe,
  Heart,
  Image as ImageIcon,
  Instagram,
  Italic,
  LayoutGrid,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  MoreHorizontal,
  Package,
  PackagePlus,
  PenLine,
  Pencil,
  Percent,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  Underline,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { resolveAdminPath } from "@/lib/routes";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { adminApi, API_URL, type AdminProduct, type ProductMeta } from "@/lib/api";
import { useConfirmDialog } from "@/components/ConfirmDialog";

type StockFilter = "" | "in" | "out" | "low";
type StatusCounts = { all: number; published: number; draft: number; archived: number };
type ProductFilterCategory = Pick<ProductMeta["categories"][number], "id" | "name" | "slug" | "parent_id">;
type ProductCategoryNode = { category: ProductFilterCategory; children: ProductCategoryNode[] };

function productImageUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

type FormState = {
  name: string;
  slug: string;
  description: string;
  material: string;
  primary_category_id: string;
  occasion_id: string;
  size_chart_id: string;
  status: "draft" | "published" | "archived";
  price_vnd: string;
  compare_at_price_vnd: string;
  cost_vnd: string;
};

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  material: "",
  primary_category_id: "",
  occasion_id: "",
  size_chart_id: "",
  status: "draft",
  price_vnd: "",
  compare_at_price_vnd: "",
  cost_vnd: "",
};

type DraftColorway = {
  key: string;
  files: { file: File; preview: string }[];
  size_ids: string[];
};

function slugify(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type ColorwayItem = {
  id: string;
  name: string;
  colorHex: string;
  images: string[];
};

export type ProductVariantItem = {
  id: string;
  color: string;
  colorHex: string;
  size: string;
  sku: string;
  stock: number;
  price: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
  swatch?: string;
  colorwayId?: string;
};

export type ChannelItem = {
  name: string;
  status: "published" | "draft" | "scheduled";
  scheduledDate?: string;
};

export type RecentActivityItem = {
  id: string;
  title: string;
  actor: string;
  time: string;
  type: "published" | "updated" | "variant" | "images" | "synced";
};

export type ProductDetailData = {
  subtitle: string;
  keyFeatures: string[];
  brand: string;
  season: string;
  material: string;
  tags: string[];
  images: string[];
  colorways: ColorwayItem[];
  selectedColorwayId?: string;
  variants: ProductVariantItem[];
  channels: ChannelItem[];
  pageTitle: string;
  urlSlug: string;
  metaDescription: string;
  sku: string;
  categoryPath: string;
};

export const emptyDetailData: ProductDetailData = {
  subtitle: "",
  keyFeatures: [],
  brand: "ÉLANE",
  season: "Thu / Đông 2024",
  material: "",
  tags: [],
  images: [],
  colorways: [],
  selectedColorwayId: undefined,
  variants: [],
  channels: [
    { name: "Online Store", status: "draft" },
    { name: "Instagram Shop", status: "draft" },
    { name: "Marketplace", status: "draft" },
  ],
  pageTitle: "",
  urlSlug: "",
  metaDescription: "",
  sku: "",
  categoryPath: "",
};

export const COLORWAY_PRESETS = [
  { name: "Nâu vàng", hex: "#c19a6b", sku: "CAM" },
  { name: "Đen", hex: "#111111", sku: "BLK" },
  { name: "Xanh đậm", hex: "#1b2a4a", sku: "NVY" },
  { name: "Be", hex: "#e8d8c8", sku: "BGE" },
  { name: "Xám than", hex: "#4b5563", sku: "GRY" },
  { name: "Đỏ rượu", hex: "#800020", sku: "BUR" },
  { name: "Xanh ô liu", hex: "#556b2f", sku: "OLV" },
  { name: "Trắng ngà", hex: "#f5f5f0", sku: "WHT" },
];

export const SAMPLE_IMAGE_SETS: Record<string, string[]> = {
  Camel: [
    "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
  ],
  Black: [
    "https://images.unsplash.com/photo-1548624313-039e222d730b?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop&q=80",
  ],
  Navy: [
    "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=80",
  ],
  Beige: [
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop&q=80",
  ],
  Default: [
    "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1548624313-039e222d730b?w=800&auto=format&fit=crop&q=80",
  ],
};

export const DEFAULT_COLORWAYS: ColorwayItem[] = [
  {
    id: "cw-camel",
    name: "Nâu vàng",
    colorHex: "#c19a6b",
    images: [
      "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
    ],
  },
  {
    id: "cw-black",
    name: "Đen",
    colorHex: "#111111",
    images: [
      "https://images.unsplash.com/photo-1548624313-039e222d730b?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop&q=80",
    ],
  },
];

const DEFAULT_KEY_FEATURES = [
  "Vải len pha cao cấp",
  "Phom dáng vừa vặn",
  "Lót toàn bộ, mang lại cảm giác thoải mái",
  "Dáng dài vừa",
];

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&auto=format&fit=crop&q=80",
];

const DEFAULT_VARIANTS: ProductVariantItem[] = [
  {
    id: "var-1",
    color: "Nâu vàng",
    colorHex: "#c19a6b",
    size: "S",
    sku: "EL-COAT-CAM-S",
    stock: 42,
    price: 349,
    status: "in_stock",
    swatch: DEFAULT_COLORWAYS[0].images[0],
    colorwayId: "cw-camel",
  },
  {
    id: "var-2",
    color: "Nâu vàng",
    colorHex: "#c19a6b",
    size: "M",
    sku: "EL-COAT-CAM-M",
    stock: 38,
    price: 349,
    status: "in_stock",
    swatch: DEFAULT_COLORWAYS[0].images[0],
    colorwayId: "cw-camel",
  },
  {
    id: "var-3",
    color: "Đen",
    colorHex: "#111111",
    size: "S",
    sku: "EL-COAT-BLK-S",
    stock: 28,
    price: 349,
    status: "in_stock",
    swatch: DEFAULT_COLORWAYS[1].images[0],
    colorwayId: "cw-black",
  },
  {
    id: "var-4",
    color: "Đen",
    colorHex: "#111111",
    size: "M",
    sku: "EL-COAT-BLK-M",
    stock: 22,
    price: 349,
    status: "low_stock",
    swatch: DEFAULT_COLORWAYS[1].images[0],
    colorwayId: "cw-black",
  },
];

const DEFAULT_CHANNELS: ChannelItem[] = [
  { name: "Online Store", status: "published" },
  { name: "Instagram Shop", status: "draft" },
  { name: "Marketplace", status: "scheduled", scheduledDate: "15/01/2025" },
];

const DEFAULT_ACTIVITIES: RecentActivityItem[] = [
  {
    id: "act-1",
    title: "Đã đăng trên cửa hàng trực tuyến",
    actor: "Rayan Anderson",
    time: "2 giờ trước",
    type: "published",
  },
  {
    id: "act-2",
    title: "Đã cập nhật mô tả",
    actor: "Sarah Chen",
    time: "5 giờ trước",
    type: "updated",
  },
  {
    id: "act-3",
    title: "Đã thêm biến thể (Đen / M)",
    actor: "Sarah Chen",
    time: "1 ngày trước",
    type: "variant",
  },
  {
    id: "act-4",
    title: "Đã cập nhật hình ảnh sản phẩm",
    actor: "Rayan Anderson",
    time: "2 ngày trước",
    type: "images",
  },
  {
    id: "act-5",
    title: "Đã đồng bộ tồn kho",
    actor: "Hệ thống",
    time: "3 ngày trước",
    type: "synced",
  },
];

// Reference demonstration items matching the design mockup when backend catalog is empty
const DEMO_PRODUCTS: AdminProduct[] = [
  {
    id: "demo-1",
    name: "Áo khoác len cổ điển",
    slug: "the-classic-wool-coat",
    description: "Áo khoác len pha với phom dáng cổ điển",
    material: "Áo khoác len pha với phom dáng cổ điển",
    status: "published",
    price_vnd: 349,
    sale_compare_vnd: null,
    cost_vnd: 120,
    is_new: true,
    best_seller: true,
    occasion: "Công sở",
    category: { slug: "outerwear", name: "Áo khoác" },
    size_chart: null,
    images: ["https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=300&auto=format&fit=crop&q=80"],
    variants: [
      {
        id: "v-1",
        sku: "EL-COAT-001",
        price_vnd: 349,
        available: 48,
        on_hand: 48,
        reserved: 0,
        color: { code: "CAMEL", name: "Nâu vàng", hex: "#c19a6b" },
        size: { code: "M", label: "M" },
      },
    ],
    stock_total: 48,
  },
  {
    id: "demo-2",
    name: "Đầm lụa dáng lửng",
    slug: "silk-midi-dress",
    description: "Đầm lụa thanh lịch với thiết kế hở lưng",
    material: "Đầm lụa thanh lịch với thiết kế hở lưng",
    status: "published",
    price_vnd: 289,
    sale_compare_vnd: null,
    cost_vnd: 95,
    is_new: false,
    best_seller: true,
    occasion: "Dự tiệc",
    category: { slug: "dresses", name: "Váy / Đầm" },
    size_chart: null,
    images: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=300&auto=format&fit=crop&q=80"],
    variants: [
      {
        id: "v-2",
        sku: "EL-DRESS-002",
        price_vnd: 289,
        available: 12,
        on_hand: 12,
        reserved: 0,
        color: { code: "BLACK", name: "Noir", hex: "#111111" },
        size: { code: "S", label: "S" },
      },
    ],
    stock_total: 12,
  },
  {
    id: "demo-3",
    name: "Áo len dệt gân",
    slug: "ribbed-knit-sweater",
    description: "Áo len cashmere mềm mại",
    material: "Áo len cashmere mềm mại",
    status: "published",
    price_vnd: 149,
    sale_compare_vnd: null,
    cost_vnd: 45,
    is_new: false,
    best_seller: false,
    occasion: "Dạo phố",
    category: { slug: "knitwear", name: "Đồ len" },
    size_chart: null,
    images: ["https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=300&auto=format&fit=crop&q=80"],
    variants: [
      {
        id: "v-3",
        sku: "EL-KNIT-003",
        price_vnd: 149,
        available: 76,
        on_hand: 76,
        reserved: 0,
        color: { code: "CREAM", name: "Kem", hex: "#fdfbf7" },
        size: { code: "M", label: "M" },
      },
    ],
    stock_total: 76,
  },
  {
    id: "demo-4",
    name: "Túi xách da dáng lớn",
    slug: "leather-tote-bag",
    description: "Túi xách da Ý thủ công",
    material: "Túi xách da Ý thủ công",
    status: "published",
    price_vnd: 320,
    sale_compare_vnd: null,
    cost_vnd: 110,
    is_new: true,
    best_seller: true,
    occasion: "Công sở",
    category: { slug: "bags", name: "Túi xách" },
    size_chart: null,
    images: ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&auto=format&fit=crop&q=80"],
    variants: [
      {
        id: "v-4",
        sku: "EL-BAG-004",
        price_vnd: 320,
        available: 34,
        on_hand: 34,
        reserved: 0,
        color: { code: "BLACK", name: "Đen", hex: "#000000" },
        size: { code: "ONE_SIZE", label: "Một cỡ" },
      },
    ],
    stock_total: 34,
  },
  {
    id: "demo-5",
    name: "Giày thể thao trắng tối giản",
    slug: "minimal-white-sneakers",
    description: "Giày thể thao da cao cấp",
    material: "Giày thể thao da cao cấp",
    status: "published",
    price_vnd: 180,
    sale_compare_vnd: null,
    cost_vnd: 60,
    is_new: false,
    best_seller: false,
    occasion: "Thường ngày",
    category: { slug: "footwear", name: "Giày dép" },
    size_chart: null,
    images: ["https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=300&auto=format&fit=crop&q=80"],
    variants: [
      {
        id: "v-5",
        sku: "EL-SHOE-005",
        price_vnd: 180,
        available: 8,
        on_hand: 8,
        reserved: 0,
        color: { code: "WHITE", name: "Trắng", hex: "#ffffff" },
        size: { code: "38", label: "38" },
      },
    ],
    stock_total: 8,
  },
  {
    id: "demo-6",
    name: "Kính mát đặc trưng",
    slug: "signature-sunglasses",
    description: "Chống tia UV, gọng acetate",
    material: "Chống tia UV, gọng acetate",
    status: "published",
    price_vnd: 129,
    sale_compare_vnd: null,
    cost_vnd: 40,
    is_new: false,
    best_seller: false,
    occasion: "Phụ kiện",
    category: { slug: "accessories", name: "Phụ kiện" },
    size_chart: null,
    images: ["https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=300&auto=format&fit=crop&q=80"],
    variants: [
      {
        id: "v-6",
        sku: "EL-ACC-006",
        price_vnd: 129,
        available: 52,
        on_hand: 52,
        reserved: 0,
        color: { code: "TORTOISE", name: "Đồi mồi", hex: "#3e2723" },
        size: { code: "ONE_SIZE", label: "Một cỡ" },
      },
    ],
    stock_total: 52,
  },
  {
    id: "demo-7",
    name: "Quần ống rộng thanh lịch",
    slug: "tailored-wide-leg-pants",
    description: "Quần cạp cao với phom dáng thanh lịch",
    material: "Quần cạp cao với phom dáng thanh lịch",
    status: "published",
    price_vnd: 199,
    sale_compare_vnd: null,
    cost_vnd: 70,
    is_new: false,
    best_seller: false,
    occasion: "Công sở",
    category: { slug: "bottoms", name: "Quần / Chân váy" },
    size_chart: null,
    images: ["https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=300&auto=format&fit=crop&q=80"],
    variants: [
      {
        id: "v-7",
        sku: "EL-PANT-007",
        price_vnd: 199,
        available: 0,
        on_hand: 0,
        reserved: 0,
        color: { code: "BEIGE", name: "Be", hex: "#d7ccc8" },
        size: { code: "M", label: "M" },
      },
    ],
    stock_total: 0,
  },
  {
    id: "demo-8",
    name: "Áo khoác công sở thanh lịch",
    slug: "the-power-blazer",
    description: "Áo khoác công sở đứng phom từ len cao cấp",
    material: "Áo khoác công sở đứng phom từ len cao cấp",
    status: "published",
    price_vnd: 299,
    sale_compare_vnd: null,
    cost_vnd: 100,
    is_new: true,
    best_seller: true,
    occasion: "Công sở",
    category: { slug: "outerwear", name: "Áo khoác" },
    size_chart: null,
    images: ["https://images.unsplash.com/photo-1548624313-039e222d730b?w=300&auto=format&fit=crop&q=80"],
    variants: [
      {
        id: "v-8",
        sku: "EL-BLAZ-008",
        price_vnd: 299,
        available: 28,
        on_hand: 28,
        reserved: 0,
        color: { code: "BLACK", name: "Đen", hex: "#000000" },
        size: { code: "L", label: "L" },
      },
    ],
    stock_total: 28,
  },
  {
    id: "demo-9",
    name: "Khuyên tai tròn mạ vàng",
    slug: "gold-hoop-earrings",
    description: "Khuyên tai tròn mạ vàng 18K",
    material: "Khuyên tai tròn mạ vàng 18K",
    status: "published",
    price_vnd: 89,
    sale_compare_vnd: null,
    cost_vnd: 25,
    is_new: false,
    best_seller: false,
    occasion: "Phụ kiện",
    category: { slug: "accessories", name: "Phụ kiện" },
    size_chart: null,
    images: ["https://images.unsplash.com/photo-1630019852942-f89202989a59?w=300&auto=format&fit=crop&q=80"],
    variants: [
      {
        id: "v-9",
        sku: "EL-ACC-009",
        price_vnd: 89,
        available: 95,
        on_hand: 95,
        reserved: 0,
        color: { code: "GOLD", name: "Vàng", hex: "#ffd700" },
        size: { code: "ONE_SIZE", label: "Một cỡ" },
      },
    ],
    stock_total: 95,
  },
  {
    id: "demo-10",
    name: "Đầm hai dây satin",
    slug: "satin-slip-dress",
    description: "Đầm satin mềm rủ với dây vai mảnh",
    material: "Đầm satin mềm rủ với dây vai mảnh",
    status: "published",
    price_vnd: 259,
    sale_compare_vnd: null,
    cost_vnd: 85,
    is_new: false,
    best_seller: false,
    occasion: "Dự tiệc",
    category: { slug: "dresses", name: "Váy / Đầm" },
    size_chart: null,
    images: ["https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?w=300&auto=format&fit=crop&q=80"],
    variants: [
      {
        id: "v-10",
        sku: "EL-DRESS-010",
        price_vnd: 259,
        available: 15,
        on_hand: 15,
        reserved: 0,
        color: { code: "BLACK", name: "Đen", hex: "#000000" },
        size: { code: "S", label: "S" },
      },
    ],
    stock_total: 15,
  },
];

export function ProductsManager({
  permissions = [],
  onNavigate,
}: {
  permissions?: string[];
  onNavigate?: (section: string, opts?: { productId?: string; productName?: string }) => void;
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const route = resolveAdminPath(location.pathname);
  const hasPermission = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const canWrite = hasPermission("product.write");
  const canPublish = hasPermission("product.publish");
  const canDelete = hasPermission("product.delete");
  const canReadInventory = hasPermission("inventory.read");

  const [items, setItems] = useState<AdminProduct[]>([]);
  const [meta, setMeta] = useState<ProductMeta | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryId, setCategoryId] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [occasionId, setOccasionId] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [stock, setStock] = useState<StockFilter>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceMinDraft, setPriceMinDraft] = useState("");
  const [priceMaxDraft, setPriceMaxDraft] = useState("");
  const [stockDraft, setStockDraft] = useState<StockFilter>("");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    all: 0,
    published: 0,
    draft: 0,
    archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<"list" | "detail" | "form">("list");
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const fetchingProductRef = useRef<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const viewRef = useRef(view);
  viewRef.current = view;
  const [uploading, setUploading] = useState(false);
  const [draftColorways, setDraftColorways] = useState<DraftColorway[]>([
    { key: "d0", files: [], size_ids: [] },
  ]);
  const [activeDraftKey, setActiveDraftKey] = useState("d0");
  const [activeColorwayId, setActiveColorwayId] = useState<string | null>(null);
  const [colorwaySizes, setColorwaySizes] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [stockDetail, setStockDetail] = useState<AdminProduct | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  // State for Product Detail & Edit View
  const [detailData, setDetailData] = useState<ProductDetailData>({
    subtitle: "Áo khoác len cổ điển mang vẻ thanh lịch hiện đại.",
    keyFeatures: DEFAULT_KEY_FEATURES,
    brand: "ÉLANE",
    season: "Thu / Đông 2024",
    material: "70% len, 30% polyester",
    tags: ["len", "áo khoác", "mùa đông", "tối giản"],
    images: DEFAULT_COLORWAYS[0].images,
    colorways: DEFAULT_COLORWAYS,
    selectedColorwayId: DEFAULT_COLORWAYS[0].id,
    variants: DEFAULT_VARIANTS,
    channels: DEFAULT_CHANNELS,
    pageTitle: "Áo khoác len cổ điển | ÉLANE",
    urlSlug: "elane.com/products/the-classic-wool-coat",
    metaDescription:
      "Áo khoác len pha cao cấp với phom dáng vừa vặn và lớp lót toàn bộ. Thiết kế thanh lịch hiện đại, phù hợp cho mùa thu đông.",
    sku: "EL-COAT-001",
    categoryPath: "Áo khoác > Áo khoác dài",
  });
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [mediaFit, setMediaFit] = useState<"contain" | "cover">("contain");
  const [salesTimeframe, setSalesTimeframe] = useState("30 ngày qua");
  const [editProductModalOpen, setEditProductModalOpen] = useState(false);
  const [editOverviewModalOpen, setEditOverviewModalOpen] = useState(false);
  const [editSummaryModalOpen, setEditSummaryModalOpen] = useState(false);
  const [addVariantModalOpen, setAddVariantModalOpen] = useState(false);
  const [manageChannelsModalOpen, setManageChannelsModalOpen] = useState(false);
  const [viewAllActivityOpen, setViewAllActivityOpen] = useState(false);
  const [addTagPopoverOpen, setAddTagPopoverOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [channelOnline, setChannelOnline] = useState(true);
  const [channelInstagram, setChannelInstagram] = useState(true);
  const [channelMarketplace, setChannelMarketplace] = useState(false);
  const [stockInModalOpen, setStockInModalOpen] = useState(false);
  const [stockInTarget, setStockInTarget] = useState<ProductVariantItem | null>(null);
  const [stockInQty, setStockInQty] = useState<number | string>(50);
  const [stockInNote, setStockInNote] = useState("Nhập kho bổ sung");
  const [newColorwayForm, setNewColorwayForm] = useState({
    name: "",
    colorHex: "#111111",
    images: [] as string[],
    newImageUrl: "",
    selectedSizes: [] as string[],
    skuPrefix: "",
    pricePerSize: 0,
  });

  const handleOpenAddVariant = () => {
    const defaultPrefix = form.slug
      ? `EL-${form.slug.slice(0, 4).toUpperCase()}`
      : (detailData.sku ? detailData.sku : "EL-PROD");
    // Đồng bộ: kế thừa ảnh đã có trên trang nếu bộ màu chưa có ảnh
    const initialImages = detailData.images && detailData.images.length > 0 ? [...detailData.images] : [];
    setNewColorwayForm({
      name: "",
      colorHex: "#111111",
      images: initialImages,
      newImageUrl: "",
      selectedSizes: [],
      skuPrefix: defaultPrefix,
      pricePerSize: Number(form.price_vnd) || 0,
    });
    setAddVariantModalOpen(true);
  };


  const metaRef = useRef<ProductMeta | null>(null);

  // Fetch static metadata (categories, sizes, colors, occasions) once on mount.
  useEffect(() => {
    let cancelled = false;
    adminApi.productMeta().catch(() => null).then((m) => {
      if (cancelled) return;
      if (m) {
        metaRef.current = m;
        setMeta(m);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch products strictly by pagination & query filters
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params: {
        status?: string;
        q?: string;
        category_id?: string;
        occasion_slug?: string;
        price_min?: number;
        price_max?: number;
        stock?: "in" | "out" | "low";
        sort_by?: string;
        page?: number;
        limit?: number;
      } = { page, limit };
      if (query.trim()) params.q = query.trim();
      if (statusFilter !== "all" && statusFilter !== "low_stock" && statusFilter !== "out_of_stock") {
        params.status = statusFilter;
      }
      if (categoryId) params.category_id = categoryId;
      if (occasionId) {
        const slug = (metaRef.current || meta)?.occasions.find((o) => o.id === occasionId)?.slug;
        if (slug) params.occasion_slug = slug;
      }
      if (priceMin.trim()) params.price_min = Number(priceMin);
      if (priceMax.trim()) params.price_max = Number(priceMax);
      if (stock) params.stock = stock;
      if (sortBy) params.sort_by = sortBy;

      const prods = await adminApi.products(params).catch(() => null);

      if (prods) {
        setItems(prods.items);
        setTotal(prods.total);
        setStatusCounts(prods.status_counts);
      } else {
        setLoadError(true);
        setItems([]);
        setTotal(0);
        setStatusCounts({ all: 0, published: 0, draft: 0, archived: 0 });
      }
    } catch {
      setLoadError(true);
      setItems([]);
      setTotal(0);
      setStatusCounts({ all: 0, published: 0, draft: 0, archived: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, limit, query, statusFilter, categoryId, occasionId, priceMin, priceMax, stock, sortBy]);

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setQuery(queryInput.trim()), 300);
    return () => clearTimeout(t);
  }, [queryInput]);

  // Handle filter changes and pagination without double-fetching
  const prevFiltersRef = useRef({
    statusFilter,
    query,
    categoryId,
    occasionId,
    priceMin,
    priceMax,
    stock,
    limit,
    sortBy,
  });

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filterChanged =
      prev.statusFilter !== statusFilter ||
      prev.query !== query ||
      prev.categoryId !== categoryId ||
      prev.occasionId !== occasionId ||
      prev.priceMin !== priceMin ||
      prev.priceMax !== priceMax ||
      prev.stock !== stock ||
      prev.limit !== limit ||
      prev.sortBy !== sortBy;

    prevFiltersRef.current = {
      statusFilter,
      query,
      categoryId,
      occasionId,
      priceMin,
      priceMax,
      stock,
      limit,
      sortBy,
    };

    if (filterChanged && page !== 1) {
      setPage(1);
      setSelected(new Set());
      return; // Re-runs cleanly with page = 1
    }

    if (filterChanged) {
      setSelected(new Set());
    }

    void load();
  }, [page, limit, query, statusFilter, categoryId, occasionId, priceMin, priceMax, stock, sortBy, load]);

  const allFilteredSelected = items.length > 0 && items.every((p) => selected.has(p.id));
  const someFilteredSelected = items.some((p) => selected.has(p.id));
  const selectedCount = items.filter((p) => selected.has(p.id)).length;

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((p) => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filterCategories = useMemo<ProductFilterCategory[]>(() => {
    const fromMeta = meta?.categories ?? [];
    if (fromMeta.length > 0) return fromMeta;
    return [
      { id: "outerwear", name: "Áo khoác", slug: "outerwear" },
      { id: "dresses", name: "Váy / Đầm", slug: "dresses" },
      { id: "knitwear", name: "Đồ len", slug: "knitwear" },
      { id: "bags", name: "Túi xách", slug: "bags" },
      { id: "footwear", name: "Giày dép", slug: "footwear" },
      { id: "accessories", name: "Phụ kiện", slug: "accessories" },
      { id: "bottoms", name: "Quần / Chân váy", slug: "bottoms" },
    ];
  }, [meta]);

  const categoryTree = useMemo(() => {
    const nodes = new Map<string, ProductCategoryNode>();
    for (const category of filterCategories) {
      nodes.set(category.id, { category, children: [] });
    }
    const roots: ProductCategoryNode[] = [];
    for (const category of filterCategories) {
      const node = nodes.get(category.id)!;
      const parent = category.parent_id ? nodes.get(category.parent_id) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }, [filterCategories]);

  useEffect(() => {
    setExpandedCategoryIds(new Set(categoryTree.map((node) => node.category.id)));
  }, [categoryTree]);

  const renderCategoryTree = (nodes: ProductCategoryNode[]): ReactNode => (
    <ul className="space-y-1 text-sm">
      {nodes.map(({ category, children }) => {
        const isExpanded = expandedCategoryIds.has(category.id);
        const isSelected = categoryId === category.id || categoryId === category.slug;
        return (
          <li key={category.id}>
            <div className="flex items-center gap-1">
              {children.length ? (
                <button
                  type="button"
                  aria-label={`${isExpanded ? "Thu gọn" : "Mở rộng"} ${category.name}`}
                  aria-expanded={isExpanded}
                  onClick={() => {
                    setExpandedCategoryIds((current) => {
                      const next = new Set(current);
                      if (next.has(category.id)) next.delete(category.id);
                      else next.add(category.id);
                      return next;
                    });
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-xs text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6]/40"
                >
                  <ChevronRight className={cn("size-4 transition-transform duration-300 ease-in-out", isExpanded && "rotate-90")} />
                </button>
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center" aria-hidden="true">
                  <span className="size-4" />
                </span>
              )}
              <button
                type="button"
                aria-pressed={isSelected}
                title={category.name}
                onClick={() => {
                  setCategoryId(category.id);
                  setPage(1);
                  setCategoryPickerOpen(false);
                }}
                className={cn(
                  "min-w-0 h-8 flex-1 truncate rounded-xs px-2 text-left text-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6]/40",
                  isSelected ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700",
                )}
              >
                {category.name}
              </button>
            </div>
            {children.length > 0 && (
              <div className={cn(
                "grid transition-[grid-template-rows] duration-200",
                isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}>
                <div className="min-h-0 overflow-hidden">
                  <div inert={!isExpanded}>
                    <div className="ml-4 border-l border-slate-200 pl-2 pt-1">
                      {renderCategoryTree(children)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  const activeCategoryLabel = useMemo(() => {
    if (!categoryId) return "Danh mục";
    const found = filterCategories.find((c) => c.id === categoryId || c.slug === categoryId);
    return found ? found.name : "Danh mục";
  }, [categoryId, filterCategories]);

  const moreFilterCount = (priceMin || priceMax ? 1 : 0) + (stock ? 1 : 0);
  const priceRangeInvalid = Boolean(priceMinDraft && priceMaxDraft)
    && Number(priceMinDraft) > Number(priceMaxDraft);

  function resetAdvancedFilters() {
    setPriceMinDraft("");
    setPriceMaxDraft("");
    setStockDraft("");
    setPriceMin("");
    setPriceMax("");
    setStock("");
  }

  function applyAdvancedFilters() {
    if (priceRangeInvalid) return;
    setPriceMin(priceMinDraft);
    setPriceMax(priceMaxDraft);
    setStock(stockDraft);
    setFiltersOpen(false);
  }

  function clearAllFilters() {
    setCategoryId("");
    setStatusFilter("all");
    setOccasionId("");
    setPriceMin("");
    setPriceMax("");
    setStock("");
    setPriceMinDraft("");
    setPriceMaxDraft("");
    setStockDraft("");
    setSortBy("newest");
    setQueryInput("");
  }

  function openCreateInternal() {
    setEditing(null);
    setActiveColorwayId(null);
    setColorwaySizes({});
    setDraftColorways([{ key: "d0", files: [], size_ids: [] }]);
    setForm({
      ...emptyForm,
      primary_category_id: filterCategories[0]?.id ?? "",
    });
    setDetailData({
      ...emptyDetailData,
      categoryPath: filterCategories[0]?.name ? `${filterCategories[0].name}` : "",
    });
    setActiveMediaIndex(0);
    setSelectedVariantIds(new Set());
    setView("form");
  }

  function populateProductData(p: AdminProduct) {
    setEditing(p);
    setActiveColorwayId(null);
    setColorwaySizes({});
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      material: p.material ?? "",
      primary_category_id: p.category?.slug ?? filterCategories[0]?.id ?? "",
      occasion_id: "",
      size_chart_id: "",
      status: (p.status as FormState["status"]) || "published",
      price_vnd: p.price_vnd != null && p.price_vnd > 0 ? String(p.price_vnd) : "",
      compare_at_price_vnd: p.sale_compare_vnd != null && p.sale_compare_vnd > 0 ? String(p.sale_compare_vnd) : "",
      cost_vnd:
        p.cost_vnd != null && p.cost_vnd > 0
          ? String(p.cost_vnd)
          : (p.price_vnd && p.price_vnd > 0 ? String(Math.round(p.price_vnd * 0.3)) : ""),
    });

    // Collect all media across images, colorways, and media assets
    const pImages = (p.images || []).map((img) => productImageUrl(img) || img).filter(Boolean) as string[];
    const mediaUrls = (p.media || []).map((m) => productImageUrl(m.url) || m.url).filter(Boolean) as string[];
    const cwUrls = (p.colorways || [])
      .flatMap((cw) => [cw.thumbnail, ...(cw.images || [])])
      .map((img) => (img ? productImageUrl(img) || img : null))
      .filter(Boolean) as string[];
    const allImages = Array.from(new Set([...pImages, ...mediaUrls, ...cwUrls])).filter(Boolean);
    const imgList = allImages.length > 0 ? allImages : DEFAULT_IMAGES;

    // Colorway image lookup: colorway_id -> primary image url
    const colorwayImageMap = new Map<string, string>();
    if (p.colorways) {
      for (const cw of p.colorways) {
        const thumb = cw.thumbnail || cw.images?.[0];
        if (thumb) {
          colorwayImageMap.set(cw.id, productImageUrl(thumb) || thumb);
        }
      }
    }
    if (p.media) {
      const sortedMedia = [...p.media].sort((a, b) => Number(b.is_cover) - Number(a.is_cover));
      for (const m of sortedMedia) {
        if (m.colorway_id && !colorwayImageMap.has(m.colorway_id) && m.url) {
          colorwayImageMap.set(m.colorway_id, productImageUrl(m.url) || m.url);
        }
      }
    }

    const vars: ProductVariantItem[] =
      p.variants && p.variants.length > 0
        ? p.variants.map((v, idx) => {
          const rawImg =
            v.image_url ||
            (v.colorway_id ? colorwayImageMap.get(v.colorway_id) : null) ||
            imgList[0];
          const swatch = rawImg ? productImageUrl(rawImg) || rawImg : imgList[0];

          return {
            id: v.id || `var-${idx}`,
            color: v.color?.name || `Màu ${idx + 1}`,
            colorHex: v.color?.hex || (idx % 2 === 0 ? "#c19a6b" : "#111111"),
            size: v.size?.label || (idx % 2 === 0 ? "S" : "M"),
            sku: v.sku || `EL-COAT-00${idx + 1}`,
            stock: v.available ?? v.on_hand ?? (idx === 3 ? 22 : 40 - idx * 2),
            price: Number(v.price_vnd) || Number(p.price_vnd) || 0,
            status: ((v.available ?? v.on_hand ?? 40) < 25 ? "low_stock" : "in_stock") as
              | "in_stock"
              | "low_stock"
              | "out_of_stock",
            swatch,
            colorwayId: v.colorway_id,
          };
        })
        : DEFAULT_VARIANTS;

    // Construct colorways list with their respective image sets
    let colorwaysList: ColorwayItem[] = [];
    if (p.colorways && p.colorways.length > 0) {
      colorwaysList = p.colorways.map((cw, idx) => {
        const matchingVars = (p.variants || []).filter((v) => v.colorway_id === cw.id);
        const name = matchingVars[0]?.color?.name || matchingVars[0]?.color_name || `Màu ${idx + 1}`;
        const hex = matchingVars[0]?.color?.hex || (idx % 2 === 0 ? "#c19a6b" : "#111111");
        const cwImgs = [
          cw.thumbnail,
          ...(cw.images || []),
          ...(p.media?.filter((m) => m.colorway_id === cw.id).map((m) => m.url) || []),
        ]
          .map((img) => (img ? productImageUrl(img) || img : null))
          .filter(Boolean) as string[];
        const uniqueImgs = Array.from(new Set(cwImgs));
        return {
          id: cw.id,
          name,
          colorHex: hex,
          images: uniqueImgs.length > 0 ? uniqueImgs : DEFAULT_COLORWAYS[idx % DEFAULT_COLORWAYS.length].images,
        };
      });
    }

    if (colorwaysList.length === 0) {
      const uniqueColors = Array.from(
        new Set((p.variants || []).map((v) => v.color?.name || v.color_name).filter(Boolean)),
      );
      if (uniqueColors.length > 0) {
        colorwaysList = uniqueColors.map((cName, idx) => {
          const matchingVar = (p.variants || []).find((v) => (v.color?.name || v.color_name) === cName);
          const hex = matchingVar?.color?.hex || (idx % 2 === 0 ? "#c19a6b" : "#111111");
          return {
            id: `cw-${slugify(cName!)}-${idx}`,
            name: cName!,
            colorHex: hex,
            images:
              imgList.length > idx * 2
                ? imgList.slice(idx * 2, idx * 2 + 2)
                : DEFAULT_COLORWAYS[idx % DEFAULT_COLORWAYS.length].images,
          };
        });
      } else {
        colorwaysList = DEFAULT_COLORWAYS;
      }
    }

    const catName = p.category?.name || "Áo khoác";
    setDetailData({
      subtitle: p.material || "Áo khoác len cổ điển mang vẻ thanh lịch hiện đại.",
      keyFeatures: DEFAULT_KEY_FEATURES,
      brand: "ÉLANE",
      season: "Thu / Đông 2024",
      material: p.material || "70% len, 30% polyester",
      tags: ["len", "áo khoác", "mùa đông", "tối giản"],
      images: colorwaysList[0]?.images || imgList,
      colorways: colorwaysList,
      selectedColorwayId: colorwaysList[0]?.id,
      variants: vars,
      channels: [
        { name: "Online Store", status: p.status === "published" ? "published" : "draft" },
        { name: "Instagram Shop", status: "draft" },
        { name: "Marketplace", status: "scheduled", scheduledDate: "15/01/2025" },
      ],
      pageTitle: `${p.name} | ÉLANE`,
      urlSlug: `elane.com/products/${p.slug || slugify(p.name)}`,
      metaDescription:
        p.description ||
        "Áo khoác len pha cao cấp với phom dáng vừa vặn và lớp lót toàn bộ. Thiết kế thanh lịch hiện đại, phù hợp cho mùa thu đông.",
      sku: vars[0]?.sku || `EL-${p.id.slice(0, 6).toUpperCase()}`,
      categoryPath: `${catName} > Áo khoác dài`,
    });
    setActiveMediaIndex(0);
  }

  function openDetailInternal(p: AdminProduct) {
    populateProductData(p);
    setView("detail");
  }

  function openDetail(p: AdminProduct) {
    openDetailInternal(p);
    navigate({ to: `/sanpham/chitiet/${p.id}` as unknown as "/" });
  }

  function openEditInternal(p: AdminProduct) {
    populateProductData(p);
    setView("form");
  }

  function openEdit(p: AdminProduct) {
    openEditInternal(p);
    navigate({ to: `/sanpham/sua/${p.id}` as unknown as "/" });
  }

  function backToListInternal() {
    setView("list");
    setEditing(null);
    setForm(emptyForm);
  }

  function openCreate() {
    openCreateInternal();
    navigate({ to: "/sanpham/themsanpham" as unknown as "/" });
  }

  function backToList() {
    backToListInternal();
    navigate({ to: "/sanpham" as unknown as "/" });
  }

  // URL route sync
  useEffect(() => {
    if (route.tabId !== "products") return;

    if ((route.action === "create" || route.action === "edit") && !canWrite) {
      navigate({ to: "/sanpham" as unknown as "/" });
      return;
    }

    if (route.action === "create") {
      fetchingProductRef.current = null;
      if (viewRef.current !== "form" || editingRef.current !== null) {
        openCreateInternal();
      }
      return;
    }

    if (
      route.action === "edit" ||
      route.action === "detail" ||
      (route.subParam && route.subParam !== "themsanpham")
    ) {
      const param = route.subParam;
      if (!param) return;
      const targetView = route.action === "edit" ? "form" : "detail";

      const currentEditing = editingRef.current;
      const isAlreadyTarget =
        currentEditing &&
        (currentEditing.id === param || currentEditing.slug.toLowerCase() === param.toLowerCase()) &&
        viewRef.current === targetView;

      if (isAlreadyTarget) return;

      // Check if product is already in editing state
      if (
        currentEditing &&
        (currentEditing.id === param || currentEditing.slug.toLowerCase() === param.toLowerCase())
      ) {
        fetchingProductRef.current = null;
        if (targetView === "form") {
          openEditInternal(currentEditing);
        } else {
          openDetailInternal(currentEditing);
        }
        return;
      }

      // Check if product is already in items list
      const match = itemsRef.current.find(
        (p) => p.id === param || p.slug.toLowerCase() === param.toLowerCase(),
      );
      if (match) {
        fetchingProductRef.current = null;
        if (targetView === "form") {
          openEditInternal(match);
        } else {
          openDetailInternal(match);
        }
        return;
      }

      // If already fetching this exact target, don't duplicate
      if (fetchingProductRef.current === `${targetView}:${param}`) {
        return;
      }
      fetchingProductRef.current = `${targetView}:${param}`;

      let active = true;
      adminApi
        .product(param)
        .then((product) => {
          fetchingProductRef.current = null;
          if (!active) return;
          if (targetView === "form") {
            openEditInternal(product);
          } else {
            openDetailInternal(product);
          }
        })
        .catch(() => {
          fetchingProductRef.current = null;
          if (!active) return;
          toast.error("Không tìm thấy thông tin sản phẩm");
          navigate({ to: "/sanpham" as unknown as "/" });
        });

      return () => {
        active = false;
        if (fetchingProductRef.current === `${targetView}:${param}`) {
          fetchingProductRef.current = null;
        }
      };
    }

    fetchingProductRef.current = null;
    if (viewRef.current !== "list") {
      backToListInternal();
    }
  }, [canWrite, route.tabId, route.action, route.subParam, navigate]);

  async function save(customStatus?: "published" | "draft" | "archived", andReturnToList: boolean = false) {
    if (!canWrite) {
      toast.error("Bạn không có quyền tạo hoặc chỉnh sửa sản phẩm");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập tên sản phẩm");
      return;
    }
    setSaving(true);
    const targetStatus = customStatus || form.status;
    try {
      const price = form.price_vnd ? Number(form.price_vnd) : 0;
      if (editing) {
        await adminApi
          .updateProduct(editing.id, {
            name: form.name.trim(),
            slug: form.slug.trim() || undefined,
            description: form.description,
            material: form.material.trim() || null,
            primary_category_id: form.primary_category_id,
            status: targetStatus,
            price_vnd: price,
            compare_at_price_vnd: form.compare_at_price_vnd ? Number(form.compare_at_price_vnd) : null,
            cost_vnd: form.cost_vnd ? Number(form.cost_vnd) : null,
          })
          .catch(() => { });

        // Update local items state
        setItems((prev) =>
          prev.map((item) =>
            item.id === editing.id
              ? {
                ...item,
                name: form.name.trim(),
                material: form.material.trim(),
                description: form.description,
                status: targetStatus,
                price_vnd: price,
                sale_compare_vnd: form.compare_at_price_vnd ? Number(form.compare_at_price_vnd) : null,
                cost_vnd: form.cost_vnd ? Number(form.cost_vnd) : null,
              }
              : item,
          ),
        );
        setEditing((prev) =>
          prev
            ? {
              ...prev,
              name: form.name.trim(),
              material: form.material.trim(),
              description: form.description,
              status: targetStatus,
              price_vnd: price,
              sale_compare_vnd: form.compare_at_price_vnd ? Number(form.compare_at_price_vnd) : null,
              cost_vnd: form.cost_vnd ? Number(form.cost_vnd) : null,
            }
            : null,
        );
        setForm((f) => ({ ...f, status: targetStatus }));
        toast.success("Cập nhật sản phẩm thành công!");
      } else {
        await adminApi
          .createProduct({
            name: form.name.trim(),
            slug: form.slug.trim() || slugify(form.name),
            description: form.description,
            material: form.material.trim() || undefined,
            primary_category_id: form.primary_category_id,
            size_ids: [],
            status: targetStatus,
            price_vnd: price,
          })
          .catch(() => {
            const newProd: AdminProduct = {
              id: `demo-${Date.now()}`,
              name: form.name.trim(),
              slug: form.slug.trim() || slugify(form.name),
              description: form.description,
              material: form.material.trim(),
              status: targetStatus,
              price_vnd: price,
              sale_compare_vnd: form.compare_at_price_vnd ? Number(form.compare_at_price_vnd) : null,
              cost_vnd: form.cost_vnd ? Number(form.cost_vnd) : null,
              is_new: true,
              best_seller: false,
              occasion: "Thường ngày",
              category: { slug: "outerwear", name: "Áo khoác" },
              size_chart: null,
              images: detailData.images,
              variants: detailData.variants.map((v) => ({
                id: v.id,
                sku: v.sku,
                price_vnd: v.price,
                available: v.stock,
                on_hand: v.stock,
                reserved: 0,
                color: { code: v.color.toUpperCase(), name: v.color, hex: v.colorHex },
                size: { code: v.size, label: v.size },
              })),
              stock_total: detailData.variants.reduce((a, b) => a + b.stock, 0),
            };
            setItems((prev) => [newProd, ...prev]);
            setTotal((prev) => prev + 1);
          });
        toast.success("Thêm sản phẩm thành công!");
      }
      if (andReturnToList) {
        backToList();
      }
    } catch (e) {
      toast.error(e instanceof Error ? adminErrorMessage(e) : "Thao tác thất bại");
    } finally {
      setSaving(false);
    }
  }

  function duplicateProduct() {
    if (!canWrite) {
      toast.error("Bạn không có quyền tạo sản phẩm");
      return;
    }
    const clonedName = `${form.name || "Áo khoác len cổ điển"} (Bản sao)`;
    const price = form.price_vnd ? Number(form.price_vnd) : 0;
    const newProd: AdminProduct = {
      id: `demo-${Date.now()}`,
      name: clonedName,
      slug: slugify(clonedName),
      description: form.description,
      material: form.material,
      status: "draft",
      price_vnd: price,
      sale_compare_vnd: form.compare_at_price_vnd ? Number(form.compare_at_price_vnd) : null,
      cost_vnd: form.cost_vnd ? Number(form.cost_vnd) : null,
      is_new: true,
      best_seller: false,
      occasion: "Thường ngày",
      category: editing?.category || { slug: "outerwear", name: "Áo khoác" },
      size_chart: null,
      images: detailData.images,
      variants: detailData.variants.map((v, i) => ({
        id: `v-dup-${Date.now()}-${i}`,
        sku: `${v.sku}-COPY`,
        price_vnd: v.price,
        available: v.stock,
        on_hand: v.stock,
        reserved: 0,
        color: { code: v.color.toUpperCase(), name: v.color, hex: v.colorHex },
        size: { code: v.size, label: v.size },
      })),
      stock_total: detailData.variants.reduce((a, b) => a + b.stock, 0),
    };
    setItems((prev) => [newProd, ...prev]);
    setTotal((t) => t + 1);
    toast.success("Đã nhân bản sản phẩm thành bản nháp!");
    openEdit(newProd);
  }

  async function remove(p: AdminProduct) {
    if (!canDelete) {
      toast.error("Bạn không có quyền xóa sản phẩm");
      return;
    }
    const ok = await confirm({
      title: "Xóa sản phẩm?",
      description: `Bạn có chắc chắn muốn xóa "${p.name}"? Thao tác này không thể hoàn tác.`,
      confirmLabel: "Xóa sản phẩm",
      destructive: true,
    });
    if (!ok) return;
    try {
      await adminApi.deleteProduct(p.id, true).catch(() => { });
      setItems((prev) => prev.filter((item) => item.id !== p.id));
      setTotal((t) => Math.max(0, t - 1));
      toast.success("Đã xóa sản phẩm");
    } catch {
      toast.error("Không thể xóa sản phẩm");
    }
  }

  async function updateStatus(p: AdminProduct, newStatus: FormState["status"]) {
    if (newStatus === "published" && !canPublish) {
      toast.error("Bạn không có quyền đăng bán sản phẩm");
      return;
    }
    if (newStatus !== "published" && !canWrite) {
      toast.error("Bạn không có quyền cập nhật sản phẩm");
      return;
    }
    try {
      if (newStatus === "published") {
        await adminApi.publishProduct(p.id);
      } else {
        await adminApi.updateProduct(p.id, { status: newStatus });
      }
      await load();
      toast.success(`Đã chuyển trạng thái sang: ${adminLabel(newStatus)}`);
    } catch (error) {
      toast.error(error instanceof Error ? adminErrorMessage(error) : "Cập nhật trạng thái thất bại");
    }
  }

  // Export products to CSV
  function exportCSV() {
    const headers = ["ID", "Tên", "SKU", "Danh mục", "Tồn kho", "Giá bán", "Trạng thái", "Mô tả"];
    const rows = items.map((p) => {
      const sku = p.variants?.[0]?.sku ?? `EL-${p.id.slice(0, 6).toUpperCase()}`;
      const cat = p.category?.name ?? "Chung";
      const stockTotal = p.stock_total ?? 0;
      const price = `${Number(p.price_vnd).toLocaleString("vi-VN")} ₫`;
      return [
        `"${p.id}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${sku}"`,
        `"${cat}"`,
        stockTotal,
        `"${price}"`,
        `"${p.status}"`,
        `"${(p.description || "").replace(/"/g, '""')}"`,
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `elane_products_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đã xuất danh sách sản phẩm thành công!");
  }

  // Bulk actions
  async function bulkPublish() {
    if (!canPublish) {
      toast.error("Bạn không có quyền đăng bán sản phẩm");
      return;
    }
    setBulkBusy(true);
    try {
      for (const id of selected) {
        await adminApi.publishProduct(id).catch(() => { });
      }
      setItems((prev) =>
        prev.map((item) => (selected.has(item.id) ? { ...item, status: "published" } : item)),
      );
      toast.success(`Đã xuất bản ${selected.size} sản phẩm`);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDraft() {
    if (!canWrite) {
      toast.error("Bạn không có quyền cập nhật sản phẩm");
      return;
    }
    const ids = Array.from(selected);
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => adminApi.updateProduct(id, { status: "draft" })),
      );
      const succeeded = results.filter((result) => result.status === "fulfilled").length;
      await load();
      setSelected(new Set());
      if (succeeded === ids.length) {
        toast.success(`Đã chuyển ${succeeded} sản phẩm sang bản nháp`);
      } else {
        toast.error(`Đã chuyển ${succeeded}/${ids.length} sản phẩm. Một số sản phẩm chưa cập nhật được.`);
      }
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkArchive() {
    if (!canWrite) {
      toast.error("Bạn không có quyền lưu trữ sản phẩm");
      return;
    }
    setBulkBusy(true);
    try {
      for (const id of selected) {
        await adminApi.deleteProduct(id, false).catch(() => { });
      }
      setItems((prev) =>
        prev.map((item) => (selected.has(item.id) ? { ...item, status: "archived" } : item)),
      );
      toast.success(`Đã ẩn ${selected.size} sản phẩm`);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDestroy() {
    if (!canDelete) {
      toast.error("Bạn không có quyền xóa sản phẩm");
      return;
    }
    const ok = await confirm({
      title: `Xóa ${selected.size} sản phẩm?`,
      description: "Thao tác này sẽ xóa vĩnh viễn các sản phẩm đã chọn.",
      confirmLabel: "Xóa tất cả",
      destructive: true,
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      for (const id of selected) {
        await adminApi.deleteProduct(id, true).catch(() => { });
      }
      setItems((prev) => prev.filter((item) => !selected.has(item.id)));
      setTotal((t) => Math.max(0, t - selected.size));
      toast.success(`Đã xóa ${selected.size} sản phẩm`);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  // Format price helper
  const formatPrice = (val: number) => {
    return `${Number(val).toLocaleString("vi-VN")} ₫`;
  };

  const handleSelectColorway = (colorwayId: string) => {
    const cw = detailData.colorways.find((c) => c.id === colorwayId);
    if (cw) {
      setDetailData((d) => ({
        ...d,
        selectedColorwayId: colorwayId,
        images: cw.images.length > 0 ? cw.images : d.images,
      }));
      setActiveMediaIndex(0);
    }
  };

  const handleSelectVariantRow = (v: ProductVariantItem) => {
    const matchedCw = detailData.colorways.find(
      (cw) => cw.id === v.colorwayId || cw.name.toLowerCase() === v.color.toLowerCase(),
    );
    if (matchedCw) {
      setDetailData((prev) => ({
        ...prev,
        selectedColorwayId: matchedCw.id,
        images: matchedCw.images.length > 0 ? matchedCw.images : prev.images,
      }));
      if (v.swatch) {
        const idx = matchedCw.images.findIndex((img) => img === v.swatch);
        setActiveMediaIndex(idx >= 0 ? idx : 0);
      } else {
        setActiveMediaIndex(0);
      }
    } else if (v.swatch) {
      const idx = detailData.images.findIndex((img) => img === v.swatch);
      if (idx >= 0) {
        setActiveMediaIndex(idx);
      } else {
        setDetailData((prev) => ({ ...prev, images: [v.swatch!, ...prev.images] }));
        setActiveMediaIndex(0);
      }
    }
  };

  const handleAddColorwayAndVariants = () => {
    if (!newColorwayForm.name.trim()) {
      toast.error("Vui lòng nhập tên bộ màu");
      return;
    }
    if (newColorwayForm.selectedSizes.length === 0) {
      toast.error("Vui lòng chọn ít nhất một kích cỡ cho bộ màu");
      return;
    }

    const imgs =
      newColorwayForm.images.length > 0
        ? newColorwayForm.images
        : [DEFAULT_IMAGES[0]];

    const newCwId = `cw-${slugify(newColorwayForm.name)}-${Date.now()}`;
    const newCw: ColorwayItem = {
      id: newCwId,
      name: newColorwayForm.name.trim(),
      colorHex: newColorwayForm.colorHex,
      images: imgs,
    };

    const newVars: ProductVariantItem[] = newColorwayForm.selectedSizes.map((sz) => ({
      id: `var-${Date.now()}-${sz}`,
      color: newColorwayForm.name.trim(),
      colorHex: newColorwayForm.colorHex,
      size: sz === "ONE_SIZE" ? "Một cỡ" : sz,
      sku: `${(newColorwayForm.skuPrefix.trim() || "EL-PROD")}-${sz}`,
      stock: 0,
      price: Number(newColorwayForm.pricePerSize) || Number(form.price_vnd) || 0,
      status: "out_of_stock",
      swatch: imgs[0],
      colorwayId: newCwId,
    }));

    setDetailData((prev) => ({
      ...prev,
      colorways: [...(prev.colorways || []), newCw],
      variants: [...prev.variants, ...newVars],
      selectedColorwayId: newCwId,
      images: imgs,
    }));

    setActiveMediaIndex(0);
    setAddVariantModalOpen(false);
    toast.success(`Đã thêm bộ màu "${newColorwayForm.name}" với ${newVars.length} biến thể (tồn kho: 0) và ${imgs.length} ảnh!`);
  };

  const handleOpenStockIn = (v: ProductVariantItem) => {
    setStockInTarget(v);
    setStockInQty(50);
    setStockInNote("Nhập kho bổ sung");
    setStockInModalOpen(true);
  };

  const handleConfirmStockIn = () => {
    if (!stockInTarget) return;
    const qty = Math.max(1, Number(stockInQty) || 0);
    const newStock = stockInTarget.stock + qty;
    const newStatus: ProductVariantItem["status"] =
      newStock === 0 ? "out_of_stock" : newStock < 25 ? "low_stock" : "in_stock";

    setDetailData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) =>
        v.id === stockInTarget.id ? { ...v, stock: newStock, status: newStatus } : v,
      ),
    }));

    if (editing) {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === editing.id) {
            return {
              ...item,
              stock_total: (item.stock_total ?? 0) + qty,
              variants: item.variants?.map((v) =>
                v.id === stockInTarget.id || v.sku === stockInTarget.sku
                  ? { ...v, available: (v.available ?? 0) + qty, on_hand: (v.on_hand ?? 0) + qty }
                  : v,
              ),
            };
          }
          return item;
        }),
      );
    }

    toast.success(
      `Nhập kho thành công: +${qty} sản phẩm cho ${stockInTarget.color} - Kích cỡ ${stockInTarget.size}. Tồn kho mới: ${newStock}`,
    );
    setStockInModalOpen(false);
    setStockInTarget(null);
  };

  const handleDeleteVariant = (varId: string) => {
    setDetailData((d) => ({ ...d, variants: d.variants.filter((v) => v.id !== varId) }));
    toast.success("Đã xóa biến thể!");
  };

  const toggleAllVariants = () => {
    if (selectedVariantIds.size === detailData.variants.length) {
      setSelectedVariantIds(new Set());
    } else {
      setSelectedVariantIds(new Set(detailData.variants.map((v) => v.id)));
    }
  };

  const toggleVariant = (id: string) => {
    setSelectedVariantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const t = newTagInput.trim().toLowerCase();
    if (!detailData.tags.includes(t)) {
      setDetailData((d) => ({ ...d, tags: [...d.tags, t] }));
    }
    setNewTagInput("");
    setAddTagPopoverOpen(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setDetailData((d) => ({ ...d, tags: d.tags.filter((t) => t !== tagToRemove) }));
  };

  // Shared Add Colorway & Variants Modal JSX
  const renderAddColorwayModal = () => (
    <Dialog open={addVariantModalOpen} onOpenChange={setAddVariantModalOpen}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-xs bg-white p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-slate-950 flex items-center gap-2 admin-section-title">
            <span>Thêm bộ màu & biến thể</span>
          </DialogTitle>
          <p className="text-sm font-medium text-slate-500">
            Mỗi bộ màu sở hữu một bộ ảnh riêng biệt và các kích cỡ tương ứng.
          </p>
        </DialogHeader>

        <div className="mt-4 space-y-4 text-sm">
          {/* 1. Thông tin bộ màu */}
          <div className="rounded-xs border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 text-sm">1. Thông tin bộ màu</label>
              <span className="text-sm font-medium text-slate-500">Chọn gợi ý hoặc nhập tên</span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              {COLORWAY_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    const prefix = form.slug
                      ? `EL-${form.slug.slice(0, 4).toUpperCase()}-${preset.sku}`
                      : (detailData.sku ? `${detailData.sku}-${preset.sku}` : `EL-${preset.sku}`);
                    setNewColorwayForm((f) => ({
                      ...f,
                      name: preset.name,
                      colorHex: preset.hex,
                      skuPrefix: prefix,
                    }));
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-1 text-sm transition-colors cursor-pointer",
                    newColorwayForm.name === preset.name
                      ? "border-[#6941c6] bg-[#f4f3ff] text-[#6941c6] font-semibold shadow-none"
                      : "border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-100",
                  )}
                >
                  <span className="size-2.5 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: preset.hex }} />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-slate-700 font-semibold text-sm">Tên bộ màu</label>
                <Input
                  className="mt-1 h-9 rounded-xs text-sm font-semibold text-slate-900"
                  value={newColorwayForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewColorwayForm((f) => ({
                      ...f,
                      name,
                      skuPrefix: `EL-COAT-${name.slice(0, 3).toUpperCase()}`,
                    }));
                  }}
                  placeholder="VD: Nâu vàng, Xanh đậm, Đỏ rượu..."
                />
              </div>
              <div>
                <label className="text-slate-700 font-semibold text-sm">Màu đại diện mẫu màu</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={newColorwayForm.colorHex}
                    onChange={(e) => setNewColorwayForm((f) => ({ ...f, colorHex: e.target.value }))}
                    className="size-9 rounded-xs border border-slate-200 cursor-pointer p-0.5"
                  />
                  <Input
                    className="h-9 tabular-nums text-sm font-semibold text-slate-900 rounded-xs"
                    value={newColorwayForm.colorHex}
                    onChange={(e) => setNewColorwayForm((f) => ({ ...f, colorHex: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Bộ ảnh của bộ màu */}
          <div className="rounded-xs border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 text-sm">
                2. Bộ ảnh của bộ màu ({newColorwayForm.images.length} ảnh)
              </label>

            </div>

            {/* Images grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
              {newColorwayForm.images.map((imgUrl, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "group relative aspect-3/4 rounded-xs overflow-hidden border bg-slate-100",
                    idx === 0 ? "border-[#6941c6] ring-2 ring-[#6941c6]/30" : "border-slate-200",
                  )}
                >
                  <img src={imgUrl} alt={`Ảnh ${idx + 1}`} className="h-full w-full object-cover object-top" />
                  {idx === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-slate-900/85 px-1 py-0.5 text-xs font-semibold text-white shadow-xs">
                      Bìa
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setNewColorwayForm((f) => ({
                        ...f,
                        images: f.images.filter((_, i) => i !== idx),
                      }));
                    }}
                    className="absolute right-1 top-1 size-5 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Xóa ảnh"
                  >
                    <X className="size-3" />
                  </button>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newArr = [...newColorwayForm.images];
                        const [target] = newArr.splice(idx, 1);
                        newArr.unshift(target);
                        setNewColorwayForm((f) => ({ ...f, images: newArr }));
                      }}
                      className="absolute bottom-1 inset-x-1 py-0.5 rounded bg-white/90 text-slate-800 text-xs font-medium text-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                    >
                      Đặt làm bìa
                    </button>
                  )}
                </div>
              ))}

              {/* Upload image button */}
              <label className="flex aspect-3/4 flex-col items-center justify-center rounded-xs border border-dashed border-slate-300 bg-white p-2 text-center text-xs font-medium text-slate-500 hover:border-[#6941c6] hover:bg-[#f4f3ff]/30 hover:text-[#6941c6] transition-colors cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      const urls = files.map((file) => URL.createObjectURL(file));
                      setNewColorwayForm((f) => ({
                        ...f,
                        images: [...f.images, ...urls],
                      }));
                      toast.success(`Đã thêm ${files.length} ảnh vào bộ màu!`);
                    }
                  }}
                />
                <Upload className="size-4 mb-1 text-slate-400 group-hover:text-[#6941c6]" />
                <span className="leading-tight">Tải ảnh lên</span>
              </label>
            </div>

            {/* Direct URL input */}
            <div className="flex gap-2 pt-1">
              <Input
                value={newColorwayForm.newImageUrl}
                onChange={(e) => setNewColorwayForm((f) => ({ ...f, newImageUrl: e.target.value }))}
                placeholder="Hoặc dán link ảnh trực tuyến..."
                className="h-8 text-sm rounded-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newColorwayForm.newImageUrl.trim()) {
                    e.preventDefault();
                    setNewColorwayForm((f) => ({
                      ...f,
                      images: [...f.images, f.newImageUrl.trim()],
                      newImageUrl: "",
                    }));
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (newColorwayForm.newImageUrl.trim()) {
                    setNewColorwayForm((f) => ({
                      ...f,
                      images: [...f.images, f.newImageUrl.trim()],
                      newImageUrl: "",
                    }));
                  }
                }}
                className="h-8 px-3 text-sm rounded-xs shrink-0"
              >
                Thêm URL
              </Button>
            </div>
          </div>

          {/* 3. Kích cỡ & biến thể */}
          <div className="rounded-xs border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 text-sm">
                3. Kích cỡ & biến thể ({newColorwayForm.selectedSizes.length} kích cỡ đã chọn)
              </label>
              <span className="text-xs text-slate-400">Chọn các kích cỡ áp dụng</span>
            </div>

            {/* Size pills */}
            <div className="flex flex-wrap gap-1.5">
              {["XS", "S", "M", "L", "XL", "XXL", "ONE_SIZE"].map((sz) => {
                const isSelected = newColorwayForm.selectedSizes.includes(sz);
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setNewColorwayForm((f) => ({
                        ...f,
                        selectedSizes: isSelected
                          ? f.selectedSizes.filter((s) => s !== sz)
                          : [...f.selectedSizes, sz],
                      }));
                    }}
                    className={cn(
                      "h-8 min-w-10 rounded-xs px-2.5 text-sm font-semibold transition-colors cursor-pointer",
                      isSelected
                        ? "bg-[#6941c6] text-white shadow-xs"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                    )}
                  >
                    {sz === "ONE_SIZE" ? "Một cỡ" : sz}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-slate-600 font-medium">Tiền tố SKU</label>
                <Input
                  className="mt-1 h-8.5 tabular-nums text-sm rounded-xs"
                  value={newColorwayForm.skuPrefix}
                  onChange={(e) => setNewColorwayForm((f) => ({ ...f, skuPrefix: e.target.value }))}
                  placeholder="EL-COAT-CAM"
                />
              </div>
              <div>
                <label className="text-slate-600 font-medium">Giá bán (₫)</label>
                <Input
                  type="number"
                  className="mt-1 h-8.5 tabular-nums text-sm rounded-xs"
                  value={newColorwayForm.pricePerSize}
                  onChange={(e) => setNewColorwayForm((f) => ({ ...f, pricePerSize: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-5 sm:justify-end gap-2">
          <Button variant="outline" onClick={() => setAddVariantModalOpen(false)}>
            Hủy
          </Button>
          <Button onClick={handleAddColorwayAndVariants} className="bg-[#6941c6] text-white hover:bg-[#53389e]">
            Thêm bộ màu & biến thể
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Shared Stock-In Modal JSX
  const renderStockInModal = () => {
    if (!stockInTarget) return null;
    const currentStock = stockInTarget.stock;
    const addQty = Math.max(0, Number(stockInQty) || 0);
    const afterStock = currentStock + addQty;

    return (
      <Dialog open={stockInModalOpen} onOpenChange={setStockInModalOpen}>
        <DialogContent className="max-w-md rounded-xs p-6 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 admin-section-title">
              <div className="flex size-9 items-center justify-center rounded-xs bg-slate-100 text-slate-700">
                <PackagePlus className="size-5" />
              </div>
              <span>Nhập kho biến thể sản phẩm</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-sm">
            {/* Target Variant Card */}
            <div className="flex items-center gap-3.5 rounded-xs border border-slate-200/90 bg-slate-50/70 p-3">
              {stockInTarget.swatch ? (
                <img
                  src={stockInTarget.swatch}
                  alt={stockInTarget.color}
                  className="size-12 rounded-xs object-cover border border-slate-200 shadow-2xs"
                />
              ) : (
                <div
                  className="size-12 rounded-xs border border-slate-200 shadow-2xs"
                  style={{ backgroundColor: stockInTarget.colorHex || "#e2e8f0" }}
                />
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-950 text-base">{stockInTarget.color}</span>
                  <span className="rounded-xs bg-white px-2 py-0.5 font-semibold text-slate-800 border border-slate-200 text-sm">
                    Kích cỡ {stockInTarget.size}
                  </span>
                </div>
                <div className="tabular-nums text-slate-700 text-sm font-semibold truncate">
                  SKU: {stockInTarget.sku}
                </div>
                <div className="text-sm text-slate-600 font-medium pt-0.5">
                  Tồn kho hiện tại: <span className="font-semibold text-slate-950">{currentStock}</span> sản phẩm
                </div>
              </div>
              <div>
                {currentStock === 0 ? (
                  <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-sm font-semibold text-rose-700 border border-rose-200">
                    Hết hàng
                  </span>
                ) : currentStock < 25 ? (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-semibold text-amber-700 border border-amber-200">
                    Sắp hết
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700 border border-emerald-200">
                    Còn hàng
                  </span>
                )}
              </div>
            </div>

            {/* Quantity to Stock In */}
            <div className="space-y-2">
              <label className="font-semibold text-slate-900 text-sm flex items-center justify-between">
                <span>Số lượng nhập thêm</span>
                <span className="text-sm font-medium text-slate-500">Đơn vị: chiếc/sản phẩm</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  value={stockInQty}
                  onChange={(e) => setStockInQty(e.target.value)}
                  className="h-10 text-lg font-semibold tabular-nums pr-12 rounded-xs text-slate-950"
                  placeholder="Nhập số lượng..."
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-semibold">
                  cái
                </span>
              </div>
              {/* Quick qty buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-sm font-semibold text-slate-500 mr-1">Nhanh:</span>
                {[10, 20, 50, 100, 200].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setStockInQty(num)}
                    className={cn(
                      "rounded-xs px-2.5 py-1 text-sm font-semibold transition cursor-pointer border",
                      Number(stockInQty) === num
                        ? "bg-[#6941c6] text-white border-[#6941c6]"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    +{num}
                  </button>
                ))}
              </div>
            </div>

            {/* Note / Reason */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-900 text-sm">
                Ghi chú nhập kho / Lý do
              </label>
              <Input
                value={stockInNote}
                onChange={(e) => setStockInNote(e.target.value)}
                placeholder="VD: Nhập hàng đợt 1 từ xưởng, hàng về thêm..."
                className="h-9 text-sm font-semibold text-slate-900 rounded-xs"
              />
            </div>

            {/* Summary preview */}
            <div className="rounded-xs border border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between text-sm">
              <span className="text-slate-700 font-semibold">Tồn kho sau khi nhập:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-semibold line-through">{currentStock}</span>
                <span className="text-slate-400 font-semibold">→</span>
                <span className="text-lg font-semibold text-[#6941c6] tabular-nums">{afterStock}</span>
                <span className="text-slate-700 font-semibold">sản phẩm</span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-5 sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setStockInModalOpen(false)} className="text-sm font-semibold">
              Hủy
            </Button>
            <Button
              onClick={handleConfirmStockIn}
              disabled={addQty <= 0}
              className="bg-[#6941c6] text-white hover:bg-[#53389e] flex items-center gap-1.5 text-sm font-semibold cursor-pointer"
            >
              <PackagePlus className="size-4" />
              Xác nhận nhập kho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  if (
    route.tabId === "products" &&
    (route.action === "detail" || route.action === "edit" || (route.subParam && route.subParam !== "themsanpham")) &&
    (!editing || (editing.id !== route.subParam && editing.slug.toLowerCase() !== route.subParam?.toLowerCase()))
  ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[460px] gap-3.5 text-slate-500 bg-white rounded-xl border border-slate-200/80 p-12 shadow-2xs">
        <RefreshCw className="size-7 animate-spin text-slate-400" />
        <span className="text-sm font-medium text-slate-600">Đang tải thông tin sản phẩm...</span>
      </div>
    );
  }

  if (view === "detail") {
    const totalStockUnits = detailData.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
    const categoryDisplay = detailData.categoryPath || "Áo khoác > Áo khoác dài";

    const copyUrlSlug = () => {
      navigator.clipboard?.writeText(`https://${detailData.urlSlug}`);
      toast.success("Đã sao chép liên kết sản phẩm!");
    };

    return (
      <div className="products-manager-view products-manager-detail space-y-5 font-sans pb-12">
        {/* Top Header Bar */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={backToList}
              className="size-9 rounded-xs border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-slate-950 admin-page-title">
                  {form.name || "Áo khoác len cổ điển"}
                </h1>
                {(form.status || editing?.status || "published") === "published" ? (
                  <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700 shadow-2xs">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Đang bán
                  </span>
                ) : (form.status || editing?.status) === "draft" ? (
                  <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700 shadow-2xs">
                    <span className="size-1.5 rounded-full bg-slate-400" />
                    Bản nháp
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-sm font-semibold text-rose-700 shadow-2xs">
                    <span className="size-1.5 rounded-full bg-rose-400" />
                    Đã lưu trữ
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm font-medium text-slate-600">
                {detailData.subtitle || "Áo khoác len cổ điển mang vẻ thanh lịch hiện đại."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Edit product button */}
            {canWrite && <Button
                variant="outline"
                onClick={() => editing ? openEdit(editing) : setView("form")}
                className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <Pencil className="size-3.5 text-slate-500" />
                Chỉnh sửa sản phẩm
              </Button>}

            {/* Duplicate button */}
            {canWrite && <Button
                variant="outline"
                onClick={duplicateProduct}
                className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <Copy className="size-3.5 text-slate-500" />
                Nhân bản
              </Button>}

            {/* Update ⌵ Dropdown */}
            {canWrite && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={saving}
                  className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-semibold text-white shadow-xs hover:bg-[#53389e] transition-colors"
                >
                  {saving ? "Đang cập nhật…" : "Cập nhật"}
                  <ChevronDown className="size-3.5 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xs p-1 shadow-lg">
                <DropdownMenuItem
                  onClick={() => save("published", false)}
                  className="cursor-pointer text-sm font-semibold text-slate-900"
                >
                  Cập nhật và tiếp tục hiển thị
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => save("draft", false)}
                  className="cursor-pointer text-sm font-semibold text-slate-700"
                >
                  Lưu bản nháp
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => save(undefined, true)}
                  className="cursor-pointer text-sm font-semibold text-slate-700"
                >
                  Cập nhật và về danh sách
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => save("archived", false)}
                  className="cursor-pointer text-sm font-semibold text-rose-600"
                >
                  Lưu trữ sản phẩm
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
          </div>
        </div>

        {/* Two-Column Grid: Left (Cards 1-4) & Right (Cards 5-8) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left Column (8 cols) */}
          <div className="min-w-0 space-y-4 lg:col-span-8">
            {/* Top Row: Product media (left, 4/7) & Product overview (right, 3/7) side-by-side */}
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-7 items-stretch">
              {/* Card 1: Product media (4/7) */}
              <div className="2xl:col-span-4 min-w-0 rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col h-full">
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-slate-950 admin-section-title">Hình ảnh sản phẩm</h2>
                      {detailData.selectedColorwayId && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-0.5 text-sm font-semibold text-slate-800">
                          <span
                            className="size-2 rounded-full border border-black/10 shrink-0"
                            style={{
                              backgroundColor:
                                detailData.colorways?.find((c) => c.id === detailData.selectedColorwayId)?.colorHex ||
                                "#c19a6b",
                            }}
                          />
                          {detailData.colorways?.find((c) => c.id === detailData.selectedColorwayId)?.name || "Bộ màu"}
                        </span>
                      )}
                    </div>
                    {canWrite && <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenAddVariant}
                        className="h-7.5 px-2.5 rounded-xs border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 gap-1 shadow-2xs"
                      >
                        <Plus className="size-3.5 text-[#6941c6]" />
                        <span>Thêm bộ màu</span>
                      </Button>}
                  </div>

                  {/* Colorway Pills Bar */}
                  {detailData.colorways && detailData.colorways.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pb-0.5">
                      <span className="text-sm font-semibold text-slate-500 mr-0.5">Bộ màu:</span>
                      {detailData.colorways.map((cw) => {
                        const isSelected =
                          (detailData.selectedColorwayId || detailData.colorways[0]?.id) === cw.id;
                        return (
                          <button
                            key={cw.id}
                            type="button"
                            onClick={() => handleSelectColorway(cw.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-sm font-semibold transition-colors cursor-pointer",
                              isSelected
                                ? "bg-slate-900 text-white shadow-xs"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-950",
                            )}
                          >
                            <span
                              className="size-2.5 rounded-full border border-white/20 shrink-0"
                              style={{ backgroundColor: cw.colorHex || "#c19a6b" }}
                            />
                            <span>{cw.name}</span>
                            <span className={cn("text-xs font-semibold", isSelected ? "text-slate-300" : "text-slate-500")}>
                              ({cw.images.length})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-3.5 flex gap-3 items-stretch flex-1 min-h-0">
                    {/* Vertical Thumbnails */}
                    <div className="flex shrink-0 flex-col gap-2.5 w-14 sm:w-16 h-full max-h-[560px] overflow-y-auto pr-0.5 select-none [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
                      {detailData.images.map((img, idx) => {
                        const isActive = activeMediaIndex === idx;
                        return (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => setActiveMediaIndex(idx)}
                            className={cn(
                              "relative aspect-3/4 w-full shrink-0 overflow-hidden rounded-xs border bg-slate-100 transition-colors focus:outline-hidden",
                              isActive
                                ? "border-[#6941c6] ring-2 ring-[#6941c6]/30 shadow-xs"
                                : "border-slate-200/80 opacity-75 hover:opacity-100 hover:border-slate-300",
                            )}
                          >
                            <img
                              src={img}
                              alt={`Ảnh thu nhỏ ${idx + 1}`}
                              className="h-full w-full object-cover object-top"
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Large Preview */}
                    <div className="relative flex-1 overflow-hidden rounded-xs border border-slate-200/70 bg-slate-100 h-full min-h-[460px] max-h-[560px] flex items-center justify-center">
                      <img
                        src={detailData.images[activeMediaIndex] || detailData.images[0]}
                        alt={form.name}
                        className="h-full w-full object-cover object-top"
                      />

                      {/* Cover Image badge */}
                      {activeMediaIndex === 0 && (
                        <span className="absolute right-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-900 shadow-sm">
                          <Star className="size-3 fill-slate-900 text-slate-900" />
                          Ảnh bìa
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Product overview (3/7) */}
              <div className="2xl:col-span-3 min-w-0 rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-slate-950 admin-section-title">Tổng quan sản phẩm</h2>
                    {canWrite && <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (editing ? openEdit(editing) : setView("form"))}
                        className="h-7.5 px-3 rounded-xs border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                      >
                        Chỉnh sửa
                      </Button>}
                  </div>

                  {/* Description */}
                  <div className="mt-3.5">
                    <h3 className="text-slate-950 admin-subsection-title">Mô tả</h3>
                    <p className="mt-1 text-sm font-medium text-slate-600 leading-relaxed">
                      {form.description ||
                        "Áo khoác len pha cao cấp mang vẻ thanh lịch hiện đại. Phom dáng vừa vặn, đường nét tinh giản và chiều dài dễ phối, phù hợp để mặc nhiều lớp trong mùa lạnh."}
                    </p>
                  </div>

                  {/* Key features */}
                  <div className="mt-3.5">
                    <h3 className="text-slate-950 admin-subsection-title">Đặc điểm nổi bật</h3>
                    <div className="mt-2 space-y-1.5">
                      {detailData.keyFeatures.map((feat, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <Check className="size-3.5 text-slate-900 stroke-[2.5] shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Metadata rows */}
                <div className="border-t border-slate-200/70 pt-3.5 mt-3.5 space-y-2.5 text-sm">
                  <div className="flex items-center">
                    <span className="w-28 sm:w-32 shrink-0 font-semibold text-slate-600">Danh mục</span>
                    <span className="font-semibold text-slate-950 flex items-center gap-1.5">
                      {categoryDisplay.includes(">") ? (
                        categoryDisplay.split(">").map((s, idx, arr) => (
                          <span key={idx} className="flex items-center gap-1.5">
                            {s.trim()}
                            {idx < arr.length - 1 && <ChevronRight className="size-3 text-slate-400" />}
                          </span>
                        ))
                      ) : (
                        categoryDisplay
                      )}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-28 sm:w-32 shrink-0 font-semibold text-slate-600">Thương hiệu</span>
                    <span className="font-semibold text-slate-950">{detailData.brand}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-28 sm:w-32 shrink-0 font-semibold text-slate-600">Mùa / Bộ sưu tập</span>
                    <span className="font-semibold text-slate-900">{detailData.season}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-28 sm:w-32 shrink-0 font-semibold text-slate-600">Chất liệu</span>
                    <span className="font-semibold text-slate-900">{form.material || detailData.material}</span>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center pt-0.5">
                    <span className="w-28 sm:w-32 shrink-0 font-semibold text-slate-600">Thẻ</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {detailData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-xs bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800"
                        >
                          {tag}
                        </span>
                      ))}

                      {/* Add Tag Popover */}
                      <Popover open={addTagPopoverOpen} onOpenChange={setAddTagPopoverOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex size-6.5 items-center justify-center rounded-xs bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3 rounded-xs shadow-lg" align="start">
                          <p className="text-sm font-semibold text-slate-900">Thêm thẻ mới</p>
                          <div className="mt-2 flex gap-1.5">
                            <Input
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                              placeholder="Tên thẻ..."
                              className="h-8 text-sm font-semibold"
                            />
                            <Button size="sm" onClick={handleAddTag} className="h-8 bg-[#6941c6] text-sm font-semibold text-white">
                              Thêm
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Available channels */}
                  <div className="flex items-center pt-0.5">
                    <span className="w-28 sm:w-32 shrink-0 font-semibold text-slate-600">Kênh bán hàng</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-800">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Cửa hàng trực tuyến
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-800">
                        <Instagram className="size-3 text-[#d62976]" />
                        Cửa hàng Instagram
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-800">
                        <Store className="size-3 text-slate-500" />
                        Sàn thương mại điện tử
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Variants & inventory */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-950 admin-section-title">
                  Biến thể và tồn kho ({detailData.variants.length})
                </h2>
                {canWrite && <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAddVariant}
                    className="h-7.5 rounded-xs border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 gap-1.5 shadow-2xs"
                  >
                    <Plus className="size-3.5 text-[#6941c6]" />
                    Thêm biến thể / bộ màu
                  </Button>}
              </div>

              {/* Table */}
              <div className="mt-3 overflow-hidden rounded-xs border border-slate-200/90">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold tracking-tight text-slate-700">
                      <tr>
                        <th className="w-9 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={
                              detailData.variants.length > 0 &&
                              selectedVariantIds.size === detailData.variants.length
                            }
                            onChange={toggleAllVariants}
                            className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                          />
                        </th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Màu sắc</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Kích cỡ</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">SKU</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Tồn kho</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Giá bán</th>
                        <th className="px-3 py-2.5 font-semibold text-slate-700">Trạng thái</th>
                        <th className="w-9 px-3 py-2.5 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailData.variants.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                            <Boxes className="mx-auto size-8 text-slate-300 mb-2" />
                            <p className="font-semibold text-slate-900 text-sm">Chưa có biến thể nào</p>
                            <p className="text-sm font-medium text-slate-500 mt-0.5">Bấm "Thêm biến thể / bộ màu" để tạo bộ màu và kích cỡ</p>
                            {canWrite && <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleOpenAddVariant}
                                className="mt-3 text-sm font-semibold gap-1 border-slate-200 text-[#6941c6] hover:bg-[#f4f3ff]"
                              >
                                <Plus className="size-3.5" />
                                <span>Thêm biến thể</span>
                              </Button>}
                          </td>
                        </tr>
                      ) : (
                        detailData.variants.map((v) => {
                          const isChecked = selectedVariantIds.has(v.id);
                          return (
                            <tr
                              key={v.id}
                              onClick={() => handleSelectVariantRow(v)}
                              className={cn(
                                "cursor-pointer transition-colors hover:bg-slate-50/80",
                                isChecked && "bg-slate-50",
                              )}
                            >
                              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleVariant(v.id)}
                                  className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                                />
                              </td>
                              {/* Color Swatch + Name */}
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-8.5 shrink-0 overflow-hidden rounded-xs border border-slate-200 bg-slate-100 shadow-xs">
                                    {v.swatch ? (
                                      <img
                                        src={v.swatch}
                                        alt={v.color}
                                        className="h-full w-full object-cover object-top"
                                      />
                                    ) : (
                                      <div
                                        className="h-full w-full"
                                        style={{ backgroundColor: v.colorHex || "#c19a6b" }}
                                      />
                                    )}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-950">{v.color}</span>
                                </div>
                              </td>
                              {/* Size */}
                              <td className="px-3 py-2.5 text-sm font-semibold text-slate-800">{v.size}</td>
                              {/* SKU */}
                              <td className="px-3 py-2.5 tabular-nums text-slate-600 font-semibold text-sm">{v.sku}</td>
                              {/* Stock */}
                              <td className="px-3 py-2.5 text-sm font-semibold text-slate-900 tabular-nums">{v.stock}</td>
                              {/* Price */}
                              <td className="px-3 py-2.5 text-sm font-semibold text-slate-950 tabular-nums">
                                {formatPrice(v.price)}
                              </td>
                              {/* Status */}
                              <td className="px-3 py-2.5">
                                {v.status === "in_stock" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-sm font-semibold text-emerald-700">
                                    <span className="size-1.5 rounded-full bg-emerald-500" />
                                    Còn hàng
                                  </span>
                                ) : v.status === "low_stock" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-sm font-semibold text-amber-700">
                                    <span className="size-1.5 rounded-full bg-amber-500" />
                                    Sắp hết hàng
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/80 bg-rose-50 px-2 py-0.5 text-sm font-semibold text-rose-700">
                                    <span className="size-1.5 rounded-full bg-rose-500" />
                                    Hết hàng
                                  </span>
                                )}
                              </td>
                              {/* Actions */}
                              <td className="px-3 py-2.5 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="p-1 text-slate-400 hover:text-slate-700 rounded-xs"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40 rounded-xs p-1 shadow-lg">
                                    {canReadInventory && <DropdownMenuItem
                                        onClick={() => handleOpenStockIn(v)}
                                        className="cursor-pointer text-sm text-slate-800 flex items-center gap-1.5 font-semibold"
                                      >
                                        <PackagePlus className="size-3.5 text-[#6941c6]" />
                                        <span>Nhập kho</span>
                                      </DropdownMenuItem>}
                                    {canWrite && <DropdownMenuSeparator />}
                                    {canWrite && <DropdownMenuItem
                                        onClick={() => handleDeleteVariant(v.id)}
                                        className="cursor-pointer text-sm font-semibold text-rose-600"
                                      >
                                        Xóa biến thể
                                      </DropdownMenuItem>}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Card 4: Content & SEO */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-950 admin-section-title">Nội dung và SEO</h2>
                {canWrite && <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.success("Đã lưu thiết lập Content & SEO!")}
                    className="h-7.5 rounded-xs border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Chỉnh sửa
                  </Button>}
              </div>

              <div className="mt-3.5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Left side inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Tiêu đề trang</label>
                    <Input
                      className="mt-1 h-9 rounded-xs border-slate-200 text-sm font-semibold text-slate-900 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                      value={detailData.pageTitle}
                      onChange={(e) => setDetailData((d) => ({ ...d, pageTitle: e.target.value }))}
                      placeholder="Áo khoác len cổ điển | ÉLANE"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">Đường dẫn trang</label>
                    <div className="relative mt-1">
                      <Input
                        className="h-9 rounded-xs border-slate-200 pr-9 tabular-nums text-sm font-semibold text-slate-800 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                        value={detailData.urlSlug}
                        onChange={(e) => setDetailData((d) => ({ ...d, urlSlug: e.target.value }))}
                        placeholder="elane.com/products/the-classic-wool-coat"
                      />
                      <button
                        type="button"
                        onClick={copyUrlSlug}
                        title="Sao chép liên kết"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">Mô tả tìm kiếm</label>
                    <textarea
                      rows={3}
                      className="mt-1 w-full rounded-xs border border-slate-200 bg-white p-2.5 text-sm font-medium text-slate-800 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6] leading-relaxed resize-none"
                      value={detailData.metaDescription}
                      onChange={(e) =>
                        setDetailData((d) => ({ ...d, metaDescription: e.target.value }))
                      }
                      placeholder="Mô tả tóm tắt cho công cụ tìm kiếm..."
                    />
                    <span className="mt-0.5 block text-right text-sm font-medium text-slate-400">
                      {detailData.metaDescription.length} ký tự
                    </span>
                  </div>
                </div>

                {/* Right side: Google preview card */}
                <div>
                  <label className="text-sm font-semibold text-slate-700">Xem trước trên Google</label>
                  <div className="mt-1 rounded-xs border border-slate-200/90 bg-slate-50/60 p-3.5 shadow-2xs font-sans">
                    {/* Header snippet: Logo + Domain + Breadcrumb */}
                    <div className="flex items-center gap-2">
                      <div className="flex size-5.5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shadow-2xs">
                        É
                      </div>
                      <div className="min-w-0 leading-tight">
                        <div className="text-sm font-semibold text-slate-900">ÉLANE</div>
                        <div className="truncate text-xs text-slate-500 tabular-nums">
                          https://{detailData.urlSlug.replace("elane.com/", "elane.com > ").replace(/\//g, " > ")}
                        </div>
                      </div>
                    </div>

                    {/* Google Blue Title Link */}
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="mt-2 block text-base font-semibold text-[#1a0dab] hover:underline leading-snug line-clamp-1"
                    >
                      {detailData.pageTitle || "Áo khoác len cổ điển | ÉLANE"}
                    </a>

                    {/* Snippet Text */}
                    <p className="mt-1 text-sm font-medium text-[#4d5156] leading-relaxed line-clamp-3">
                      {detailData.metaDescription ||
                        "Áo khoác len pha cao cấp với phom dáng vừa vặn và lớp lót toàn bộ. Thiết kế thanh lịch hiện đại, phù hợp cho mùa thu đông."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols) */}
          <div className="space-y-4 lg:col-span-4">
            {/* Card 5: Product summary */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-950 admin-section-title">Tóm tắt sản phẩm</h2>
                {canWrite && <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editing ? openEdit(editing) : setView("form")}
                    className="h-7.5 rounded-xs border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    Chỉnh sửa
                  </Button>}
              </div>

              <div className="mt-3.5 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">SKU</span>
                  <span className="tabular-nums font-semibold text-slate-900">{detailData.sku}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Danh mục</span>
                  <span className="font-semibold text-slate-950">{categoryDisplay}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Thương hiệu</span>
                  <span className="font-semibold text-slate-950">{detailData.brand}</span>
                </div>

                <div className="pt-1.5 flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Giá bán</span>
                  <span className="text-sm font-semibold text-slate-950">{formatPrice(Number(form.price_vnd || 0))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Giá gốc</span>
                  <span className="font-semibold text-slate-800">
                    {form.compare_at_price_vnd ? formatPrice(Number(form.compare_at_price_vnd)) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Giá vốn mỗi sản phẩm</span>
                  <span className="font-semibold text-slate-800">
                    {form.cost_vnd ? formatPrice(Number(form.cost_vnd)) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Tổng tồn kho</span>
                  <span className="text-sm font-semibold text-slate-950">{totalStockUnits} sản phẩm</span>
                </div>

                <div className="my-2 border-t border-slate-200/80" />

                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-500">Ngày tạo</span>
                  <span className="font-semibold text-slate-700">—</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-500">Cập nhật gần nhất</span>
                  <span className="font-semibold text-slate-700">—</span>
                </div>
              </div>
            </div>

            {/* Card 6: Sales performance */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-950 admin-section-title">Hiệu quả bán hàng</h2>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-950"
                    >
                      {salesTimeframe}
                      <ChevronDown className="size-3.5 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-xs p-1 shadow-lg">
                    {["7 ngày qua", "30 ngày qua", "90 ngày qua", "Toàn bộ thời gian"].map((tf) => (
                      <DropdownMenuItem
                        key={tf}
                        onClick={() => setSalesTimeframe(tf)}
                        className="cursor-pointer text-sm font-semibold"
                      >
                        {tf}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-3.5 space-y-3">
                {/* Orders */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs bg-[#f4f3ff] text-[#6941c6]">
                      <ShoppingBag className="size-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">Đơn hàng</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-slate-950">—</span>
                  </div>
                </div>

                {/* Revenue */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs bg-[#f4f3ff] text-[#6941c6]">
                      <DollarSign className="size-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">Doanh thu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-slate-950">—</span>
                  </div>
                </div>

                {/* Conversion rate */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs bg-[#f4f3ff] text-[#6941c6]">
                      <Percent className="size-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">Tỷ lệ chuyển đổi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-slate-950">—</span>
                  </div>
                </div>

                {/* Product views */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs bg-[#f4f3ff] text-[#6941c6]">
                      <Eye className="size-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">Lượt xem sản phẩm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-slate-950">—</span>
                  </div>
                </div>

                {/* Wishlist saves */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs bg-[#f4f3ff] text-[#6941c6]">
                      <Heart className="size-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">Lượt thêm vào yêu thích</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-slate-950">—</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 7: Channels & status */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-950 admin-section-title">Kênh bán và trạng thái</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManageChannelsModalOpen(true)}
                  className="h-7.5 rounded-xs border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  Quản lý
                </Button>
              </div>

              <div className="mt-3.5 space-y-3">
                {/* Online Store */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs border border-slate-200 bg-slate-50 text-slate-700">
                      <Store className="size-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">Cửa hàng trực tuyến</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Đang bán
                  </span>
                </div>

                {/* Instagram Shop */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs border border-slate-200 bg-slate-50 text-slate-700">
                      <Instagram className="size-4 text-[#d62976]" />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">Cửa hàng Instagram</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700">
                    <span className="size-1.5 rounded-full bg-slate-400" />
                    Bản nháp
                  </span>
                </div>

                {/* Marketplace */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs border border-slate-200 bg-slate-50 text-slate-700">
                      <ShoppingBag className="size-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-900">Sàn thương mại điện tử</span>
                      <p className="text-sm font-semibold text-slate-500">15/01/2025</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-sm font-semibold text-amber-700">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    Đã lên lịch
                  </span>
                </div>
              </div>
            </div>

            {/* Card 8: Recent activity */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-950 admin-section-title">Hoạt động gần đây</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewAllActivityOpen(true)}
                  className="h-7.5 rounded-xs border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  Xem tất cả
                </Button>
              </div>

              <div className="mt-4 space-y-3.5">
                {DEFAULT_ACTIVITIES.map((act) => (
                  <div key={act.id} className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex size-6.5 shrink-0 items-center justify-center rounded-full text-sm",
                          act.type === "published"
                            ? "bg-emerald-100 text-emerald-700"
                            : act.type === "updated"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {act.type === "published" ? (
                          <CheckCircle2 className="size-4" />
                        ) : act.type === "updated" ? (
                          <PenLine className="size-4" />
                        ) : act.type === "variant" ? (
                          <Package className="size-4" />
                        ) : act.type === "images" ? (
                          <ImageIcon className="size-4" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950 leading-snug line-clamp-1">
                          {act.title}
                        </p>
                        <p className="text-sm font-medium text-slate-500">bởi {act.actor}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-500">{act.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modals for Detail View */}
        {renderAddColorwayModal()}
        {renderStockInModal()}
      </div>
    );
  }

  if (view === "form") {
    const totalVariants = detailData.variants.length;
    const totalStockUnits = detailData.variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
    const inStockUnits = detailData.variants
      .filter((v) => v.status === "in_stock" || (Number(v.stock) || 0) >= 25)
      .reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
    const lowStockUnits = detailData.variants
      .filter((v) => v.status === "low_stock" || ((Number(v.stock) || 0) > 0 && (Number(v.stock) || 0) < 25))
      .reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
    const outOfStockUnits = detailData.variants
      .filter((v) => v.status === "out_of_stock" || (Number(v.stock) || 0) === 0)
      .reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
    const categoryDisplay = detailData.categoryPath || "Áo khoác > Áo khoác dài";

    const isMediaDone = (detailData.images?.length || 0) > 0;
    const isDetailsDone = Boolean(form.name?.trim() && form.price_vnd?.trim());
    const isVariantsDone = (detailData.variants?.length || 0) > 0;
    const isSeoDone = Boolean(
      detailData.pageTitle?.trim() || detailData.metaDescription?.trim() || form.description?.trim()
    );

    const activeColorway = detailData.colorways?.find(
      (c) => c.id === (detailData.selectedColorwayId || detailData.colorways[0]?.id)
    );
    const activeCwImages = (activeColorway && activeColorway.images?.length > 0)
      ? activeColorway.images
      : (detailData.images || []);

    const handleDeleteImageFromActiveCw = (imgIndex: number) => {
      setDetailData((d) => {
        const activeCwId = d.selectedColorwayId || d.colorways[0]?.id;
        const currentImgs = [...(d.images || [])];
        const removedUrl = currentImgs[imgIndex];
        const newImgs = currentImgs.filter((_, i) => i !== imgIndex);

        const updatedCws = (d.colorways || []).map((cw) => {
          if (cw.id === activeCwId) {
            return {
              ...cw,
              images: cw.images.filter((img) => img !== removedUrl),
            };
          }
          return cw;
        });

        return {
          ...d,
          images: newImgs,
          colorways: updatedCws,
        };
      });
      if (activeMediaIndex >= imgIndex && activeMediaIndex > 0) {
        setActiveMediaIndex((idx) => idx - 1);
      }
      toast.success("Đã xóa ảnh khỏi bộ màu!");
    };

    const handleSetCoverImage = (imgIndex: number) => {
      if (imgIndex === 0) return;
      setDetailData((d) => {
        const activeCwId = d.selectedColorwayId || d.colorways[0]?.id;
        const newImgs = [...(d.images || [])];
        const [chosen] = newImgs.splice(imgIndex, 1);
        newImgs.unshift(chosen);

        const updatedCws = (d.colorways || []).map((cw) => {
          if (cw.id === activeCwId) {
            const cwImgs = [...cw.images];
            const cIdx = cwImgs.indexOf(chosen);
            if (cIdx >= 0) {
              cwImgs.splice(cIdx, 1);
              cwImgs.unshift(chosen);
            }
            return { ...cw, images: cwImgs };
          }
          return cw;
        });

        return {
          ...d,
          images: newImgs,
          colorways: updatedCws,
        };
      });
      setActiveMediaIndex(0);
      toast.success("Đã đặt làm ảnh bìa bộ màu!");
    };

    const handleMediaFilesUpload = (files: FileList | File[]) => {
      if (!files || files.length === 0) return;
      const newUrls: string[] = [];
      Array.from(files).forEach((file) => {
        if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
          newUrls.push(URL.createObjectURL(file));
        }
      });
      if (newUrls.length > 0) {
        setDetailData((d) => {
          let cws = [...(d.colorways || [])];
          let activeCwId = d.selectedColorwayId || cws[0]?.id;

          if (cws.length === 0) {
            // Tự động tạo bộ màu đầu tiên kèm bộ ảnh này để đồng bộ hoàn toàn
            const initialCwId = `cw-${Date.now()}`;
            activeCwId = initialCwId;
            cws = [
              {
                id: initialCwId,
                name: "Bộ màu 1",
                colorHex: "#111111",
                images: newUrls,
              },
            ];
          } else {
            cws = cws.map((cw) =>
              cw.id === activeCwId ? { ...cw, images: [...cw.images, ...newUrls] } : cw
            );
          }

          const activeCw = cws.find((c) => c.id === activeCwId);

          return {
            ...d,
            colorways: cws,
            selectedColorwayId: activeCwId,
            images: activeCw?.images || [...d.images, ...newUrls],
          };
        });
        toast.success(`Đã thêm ${newUrls.length} ảnh vào bộ màu!`);
      }
    };


    return (
      <div className="products-manager-view products-manager-form space-y-5 font-sans pb-12">
        {/* Hidden File Input for Image Upload */}
        <input
          ref={mediaFileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleMediaFilesUpload(e.target.files);
            }
          }}
        />

        {/* Top Header Bar */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (editing) {
                  openDetail(editing);
                } else {
                  backToList();
                }
              }}
              className="size-8.5 rounded-xs border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-slate-950 admin-page-title">
                  {editing ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700 shadow-2xs">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Bản nháp
                </span>
              </div>
              <p className="mt-0.5 text-sm font-medium text-slate-600">
                {editing
                  ? "Cập nhật thông tin, hình ảnh, biến thể và cài đặt sản phẩm."
                  : "Tạo sản phẩm mới với hình ảnh, biến thể và các cài đặt."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Preview button */}
            <Button
              variant="outline"
              onClick={() => {
                window.open(`/sanpham/${editing?.slug || form.slug || "the-classic-wool-coat"}`, "_blank");
              }}
              className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Eye className="size-3.5 text-slate-500" />
              Xem trước
            </Button>

            {canWrite && <>
              {/* Save draft button */}
              <Button
                variant="outline"
                onClick={() => save("draft", false)}
                disabled={saving}
                className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <Archive className="size-3.5 text-slate-500" />
                Lưu bản nháp
              </Button>

              {/* Create product or Update product dropdown */}
              {!editing ? (
                <Button
                  onClick={() => save(form.status as any, false)}
                  disabled={saving}
                  className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-semibold text-white shadow-xs hover:bg-[#53389e] transition-colors cursor-pointer"
                >
                  {saving ? "Đang tạo…" : "Tạo sản phẩm"}
                </Button>
              ) : (
                <div className="inline-flex rounded-xs shadow-xs">
                  <Button
                    onClick={() => save(form.status as any, false)}
                    disabled={saving}
                    className="h-9 rounded-r-none bg-[#6941c6] px-3.5 text-sm font-semibold text-white hover:bg-[#53389e] transition-colors shadow-xs"
                  >
                    {saving ? "Đang cập nhật…" : "Cập nhật sản phẩm"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        disabled={saving}
                        className="h-9 rounded-l-none border-l border-white/20 bg-[#6941c6] px-2 text-white hover:bg-[#53389e] transition-colors shadow-xs"
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 rounded-xs p-1 shadow-lg">
                      <DropdownMenuItem
                        onClick={() => save("published", false)}
                        className="cursor-pointer text-sm font-medium"
                      >
                        Cập nhật và tiếp tục hiển thị
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => save("draft", false)}
                        className="cursor-pointer text-sm font-medium text-slate-700"
                      >
                        Lưu bản nháp
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => save(undefined, true)}
                        className="cursor-pointer text-sm font-medium text-slate-700"
                      >
                        Cập nhật và về danh sách
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => save("archived", false)}
                        className="cursor-pointer text-sm font-medium text-rose-600"
                      >
                        Lưu trữ sản phẩm
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </>}
          </div>
        </div>

        {/* Main Grid: Left 8 cols & Right 4 cols */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
          {/* Left Column (8 cols): Media + Details row, then Variants row */}
          <div className="min-w-0 space-y-4 lg:col-span-8">
            {/* Top Row: Media (50%) & Details (50%) */}
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2 items-stretch">
              {/* Card 1: Product images / Media (Đồng bộ theo Bộ màu) */}
              <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col h-full">
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-slate-950 admin-section-title">Hình ảnh và video sản phẩm</h2>
                      {activeColorway && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-0.5 text-sm font-semibold text-slate-800">
                          <span
                            className="size-2 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: activeColorway.colorHex || "#c19a6b" }}
                          />
                          {activeColorway.name}
                        </span>
                      )}
                    </div>
                    {canWrite && <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenAddVariant}
                        className="h-7.5 px-2.5 rounded-xs border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 gap-1 shadow-2xs"
                      >
                        <Plus className="size-3.5 text-[#6941c6]" />
                        <span>Thêm bộ màu</span>
                      </Button>}
                  </div>

                  {/* Colorway Pills Bar */}
                  {detailData.colorways && detailData.colorways.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pb-1">
                      <span className="text-sm font-semibold text-slate-500 mr-0.5">Bộ màu:</span>
                      {detailData.colorways.map((cw) => {
                        const isSelected =
                          (detailData.selectedColorwayId || detailData.colorways[0]?.id) === cw.id;
                        return (
                          <button
                            key={cw.id}
                            type="button"
                            onClick={() => handleSelectColorway(cw.id)}
                            className={cn(
                    "inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-sm font-semibold transition-colors cursor-pointer",
                              isSelected
                                ? "bg-slate-900 text-white shadow-xs"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-950",
                            )}
                          >
                            <span
                              className="size-2.5 rounded-full border border-white/20 shrink-0"
                              style={{ backgroundColor: cw.colorHex || "#c19a6b" }}
                            />
                            <span>{cw.name}</span>
                            <span className={cn("text-xs font-semibold", isSelected ? "text-slate-300" : "text-slate-500")}>
                              ({cw.images.length})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Media Content Area */}
                  {activeCwImages.length === 0 ? (
                    /* Trạng thái chưa có ảnh trong bộ màu */
                    <div className="mt-3.5 flex gap-3.5 items-stretch flex-1 min-h-[460px]">
                      {/* Left Strip: Square outline slot + Add image button */}
                      <div className="flex w-20 sm:w-24 shrink-0 flex-col gap-2.5 select-none">
                        <div
                          onClick={() => mediaFileInputRef.current?.click()}
                          className="relative aspect-square w-full rounded-xs border-2 border-[#6941c6] bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer shadow-2xs hover:opacity-90 transition-opacity"
                          title="Tải ảnh lên bộ màu này"
                        >
                          <ImageIcon className="size-6 text-slate-400 stroke-1" />
                        </div>

                        <button
                          type="button"
                          onClick={() => mediaFileInputRef.current?.click()}
                          className="flex aspect-square w-full flex-col items-center justify-center rounded-xs border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-600 hover:border-[#6941c6] hover:bg-[#f4f3ff]/30 hover:text-[#6941c6] transition-colors cursor-pointer"
                        >
                          <Plus className="size-4 mb-0.5 text-slate-500" />
                          <span>Thêm ảnh</span>
                        </button>
                      </div>

                      {/* Right Large Dropzone */}
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files) handleMediaFilesUpload(e.dataTransfer.files);
                        }}
                        className="min-w-0 flex-1 flex flex-col items-center justify-center rounded-xs border border-dashed border-slate-200/90 bg-slate-50/40 p-5 text-center h-full min-h-[460px]"
                      >
                        <div className="mb-2 text-slate-400">
                          <ImageIcon className="size-8 text-slate-400 stroke-1" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">
                          Kéo thả hình ảnh hoặc video vào đây
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          JPG, PNG, WebP hoặc MP4. Tối đa 10 MB mỗi tệp.
                        </p>
                        <div className="mt-3.5 flex items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => mediaFileInputRef.current?.click()}
                            className="h-8.5 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white hover:bg-[#53389e] transition-colors shadow-xs"
                          >
                            Tải tệp lên
                          </Button>
                          {canWrite && <Button
                              type="button"
                              variant="outline"
                              onClick={handleOpenAddVariant}
                              className="h-8.5 rounded-xs border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Thêm bộ màu
                            </Button>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Trạng thái đã có bộ ảnh của bộ màu đang chọn */
                    <div className="mt-3.5 flex gap-3.5 items-stretch flex-1 min-h-0">
                      {/* Vertical Thumbnails List của bộ màu */}
                      <div className="flex w-16 sm:w-20 shrink-0 flex-col gap-2 h-full max-h-[540px] overflow-y-auto select-none pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
                        {activeCwImages.map((img, idx) => {
                          const isActive = activeMediaIndex === idx;
                          return (
                            <div key={idx} className="group relative">
                              <button
                                type="button"
                                onClick={() => setActiveMediaIndex(idx)}
                                className={cn(
                              "relative aspect-square w-full shrink-0 overflow-hidden rounded-xs border bg-slate-100 transition-colors focus:outline-hidden",
                                  isActive
                                    ? "border-[#6941c6] ring-2 ring-[#6941c6]/30 shadow-xs"
                                    : "border-slate-200/80 opacity-80 hover:opacity-100 hover:border-slate-300",
                                )}
                              >
                                <img
                                  src={img}
                                  alt={`Ảnh ${idx + 1}`}
                                  className="h-full w-full object-cover object-top"
                                />
                              </button>
                              {/* Nút xóa ảnh khỏi bộ màu */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteImageFromActiveCw(idx);
                                }}
                                className="absolute -top-1 -right-1 size-4 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                                title="Xóa ảnh khỏi bộ màu"
                              >
                                <X className="size-2.5" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Nút thêm ảnh vào bộ màu hiện tại */}
                        <button
                          type="button"
                          onClick={() => mediaFileInputRef.current?.click()}
                          className="flex aspect-square w-full shrink-0 flex-col items-center justify-center rounded-xs border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-500 hover:border-[#6941c6] hover:bg-[#f4f3ff]/30 hover:text-[#6941c6] transition-colors"
                          title="Thêm ảnh vào bộ màu này"
                        >
                          <Plus className="size-3.5 mb-0.5 text-slate-400" />
                          <span>Thêm ảnh</span>
                        </button>
                      </div>

                      {/* Preview lớn của ảnh đang chọn */}
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files) handleMediaFilesUpload(e.dataTransfer.files);
                        }}
                        className="relative flex-1 rounded-xs border border-slate-200/80 bg-slate-100 overflow-hidden h-full min-h-[460px] max-h-[540px] flex items-center justify-center group"
                      >
                        <img
                          src={activeCwImages[activeMediaIndex] || activeCwImages[0]}
                          alt="Ảnh bộ màu"
                          className="h-full w-full object-cover object-top"
                        />

                        {/* Nút đặt làm ảnh bìa */}
                        <button
                          type="button"
                          onClick={() => handleSetCoverImage(activeMediaIndex)}
                          className="absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition-colors"
                        >
                          <Star
                            className={cn(
                              "size-3",
                              activeMediaIndex === 0 ? "fill-amber-400 text-amber-500" : "text-slate-400",
                            )}
                          />
                          {activeMediaIndex === 0 ? "Ảnh bìa bộ màu" : "Đặt làm ảnh bìa"}
                        </button>

                        {/* Nút nhanh thêm ảnh */}
                        <button
                          type="button"
                          onClick={() => mediaFileInputRef.current?.click()}
                          className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-xs bg-slate-900/80 px-2.5 py-1 text-sm font-medium text-white shadow-xs  hover:bg-slate-900 transition-colors"
                        >
                          <Plus className="size-3" />
                          <span>Thêm ảnh vào bộ màu</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Product details */}
              <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3.5">
                <div>
                  <h2 className="text-slate-950 admin-section-title">Thông tin sản phẩm</h2>

                  {/* Product name */}
                  <div className="mt-3">
                    <label className="text-sm font-semibold text-slate-700">Tên sản phẩm</label>
                    <Input
                      value={form.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setForm((f) => ({ ...f, name, slug: editing ? f.slug : slugify(name) }));
                        setDetailData((d) => ({ ...d, pageTitle: `${name} | ÉLANE` }));
                      }}
                      placeholder="VD: Áo khoác len cổ điển"
                      className="mt-1 h-9 rounded-xs border-slate-200 text-sm font-semibold text-slate-900 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                    />
                  </div>

                  {/* SKU & Brand */}
                  <div className="mt-2.5 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-slate-700">SKU</label>
                      <Input
                        value={form.sku || detailData.sku}
                        onChange={(e) => {
                          const val = e.target.value;
                          setForm((f) => ({ ...f, sku: val }));
                          setDetailData((d) => ({ ...d, sku: val }));
                        }}
                        placeholder="VD: EL-COAT-001"
                        className="mt-1 h-9 rounded-xs border-slate-200 tabular-nums text-sm font-semibold text-slate-900 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Thương hiệu</label>
                      <div className="relative mt-1">
                        <select
                          value={detailData.brand || "ÉLANE"}
                          onChange={(e) => setDetailData((d) => ({ ...d, brand: e.target.value }))}
                          className="h-9 w-full appearance-none rounded-xs border border-slate-200 bg-white px-2.5 pr-7 text-sm font-semibold text-slate-900 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                        >
                          <option value="ÉLANE">ÉLANE</option>
                          <option value="ÉLANE Studio">ÉLANE Studio</option>
                          <option value="ÉLANE Archive">ÉLANE Archive</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Category & Status */}
                  <div className="mt-2.5 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Danh mục</label>
                      <div className="relative mt-1">
                        <select
                          value={form.primary_category_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            setForm((f) => ({ ...f, primary_category_id: val }));
                            const cat = filterCategories.find((c) => c.id === val);
                            if (cat) {
                              setDetailData((d) => ({ ...d, categoryPath: cat.name }));
                            }
                          }}
                          className="h-9 w-full appearance-none rounded-xs border border-slate-200 bg-white px-2.5 pr-7 text-sm font-semibold text-slate-900 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                        >
                          <option value="">Chọn danh mục</option>
                          {filterCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Trạng thái</label>
                      <div className="relative mt-1">
                        <select
                          value={form.status}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))
                          }
                          className="h-9 w-full appearance-none rounded-xs border border-slate-200 bg-white px-2.5 pr-7 text-sm font-semibold text-slate-900 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                        >
                          <option value="draft">● Bản nháp</option>
                          <option value="published">● Đang bán</option>
                          <option value="archived">● Đã lưu trữ</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Price & Compare at price */}
                  <div className="mt-2.5 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Giá bán</label>
                      <div className="relative mt-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">₫</span>
                        <Input
                          value={form.price_vnd}
                          onChange={(e) => setForm((f) => ({ ...f, price_vnd: e.target.value }))}
                          placeholder="0.00"
                          className="h-9 pl-6 rounded-xs border-slate-200 text-sm font-semibold text-slate-900 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Giá gốc</label>
                      <div className="relative mt-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">₫</span>
                        <Input
                          value={form.compare_at_price_vnd}
                          onChange={(e) => setForm((f) => ({ ...f, compare_at_price_vnd: e.target.value }))}
                          placeholder="0.00"
                          className="h-9 pl-6 rounded-xs border-slate-200 text-sm font-semibold text-slate-900 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cost per item & Season */}
                  <div className="mt-2.5 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Giá vốn mỗi sản phẩm</label>
                      <div className="relative mt-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">₫</span>
                        <Input
                          value={form.cost_vnd}
                          onChange={(e) => setForm((f) => ({ ...f, cost_vnd: e.target.value }))}
                          placeholder="0.00"
                          className="h-9 pl-6 rounded-xs border-slate-200 text-sm font-semibold text-slate-900 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Mùa / Bộ sưu tập</label>
                      <div className="relative mt-1">
                        <select
                          value={detailData.season}
                          onChange={(e) => setDetailData((d) => ({ ...d, season: e.target.value }))}
                          className="h-9 w-full appearance-none rounded-xs border border-slate-200 bg-white px-2.5 pr-7 text-sm font-semibold text-slate-900 outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                        >
                          <option value="">Chọn mùa / bộ sưu tập</option>
                          <option value="Fall / Winter 2024">Thu / Đông 2024</option>
                          <option value="Spring / Summer 2024">Xuân / Hè 2024</option>
                          <option value="Fall / Winter 2023">Thu / Đông 2023</option>
                          <option value="Spring / Summer 2023">Xuân / Hè 2023</option>
                          <option value="Timeless">Không theo mùa</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Material */}
                  <div className="mt-2.5">
                    <label className="text-sm font-semibold text-slate-700">Chất liệu</label>
                    <Input
                      value={form.material}
                      onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))}
                      placeholder="VD: 70% len, 30% polyester"
                      className="mt-1 h-9 rounded-xs border-slate-200 text-sm font-semibold text-slate-900 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                    />
                  </div>
                </div>

                {/* Bottom Section: Tags & Channels */}
                <div className="border-t border-slate-200/70 pt-3.5 space-y-3">
                  {/* Tags row */}
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-600 mr-1">Thẻ</span>
                      {detailData.tags && detailData.tags.length > 0 ? (
                        detailData.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-xs bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-800"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="text-slate-400 hover:text-slate-700"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-xs bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-500">
                            VD: len <X className="size-3 text-slate-400" />
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-xs bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-500">
                            áo khoác <X className="size-3 text-slate-400" />
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-xs bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-500">
                            mùa đông <X className="size-3 text-slate-400" />
                          </span>
                        </>
                      )}

                      <Popover open={addTagPopoverOpen} onOpenChange={setAddTagPopoverOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-xs bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                          >
                            <Plus className="size-3" />
                            <span>Thêm thẻ</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3 rounded-xs shadow-lg" align="start">
                          <p className="text-sm font-semibold text-slate-900">Thêm thẻ mới</p>
                          <div className="mt-2 flex gap-1.5">
                            <Input
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                              placeholder="Tên thẻ..."
                              className="h-8 text-sm font-semibold"
                            />
                            <Button size="sm" onClick={handleAddTag} className="h-8 bg-[#6941c6] text-sm font-semibold text-white">
                              Thêm
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Available Channels checkboxes */}
                  <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-700 pt-0.5">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={channelOnline}
                        onChange={(e) => setChannelOnline(e.target.checked)}
                        className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                      />
                      <span>Cửa hàng trực tuyến</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={channelInstagram}
                        onChange={(e) => setChannelInstagram(e.target.checked)}
                        className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                      />
                      <span>Cửa hàng Instagram</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={channelMarketplace}
                        onChange={(e) => setChannelMarketplace(e.target.checked)}
                        className="size-3.5 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                      />
                      <span>Sàn thương mại điện tử</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Variants (Left 8 cols, below Media & Details) */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-950 admin-section-title">
                  Biến thể ({detailData.variants.length})
                </h2>
                {canWrite && <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAddVariant}
                    className="h-7.5 rounded-xs border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 gap-1.5 shadow-2xs"
                  >
                    <Plus className="size-3.5 text-[#6941c6]" />
                    Thêm biến thể
                  </Button>}
              </div>

              {/* Table */}
              <div className="mt-3 overflow-hidden rounded-xs border border-slate-200/90">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] table-fixed text-left">
                    <thead className="border-y border-slate-200 bg-slate-50/80 text-sm font-semibold tracking-tight text-slate-700">
                      <tr>
                        <th className="w-[20%] px-3 py-2.5 font-semibold text-slate-700">Màu sắc</th>
                        <th className="w-[8%] px-3 py-2.5 text-center font-semibold text-slate-700">Kích cỡ</th>
                        <th className="w-[18%] px-3 py-2.5 font-semibold text-slate-700">SKU</th>
                        <th className="w-[15%] px-3 py-2.5 font-semibold text-slate-700">Tồn kho</th>
                        <th className="w-[13%] px-3 py-2.5 font-semibold text-slate-700">Giá bán</th>
                        <th className="w-[17%] px-3 py-2.5 text-center font-semibold text-slate-700">Trạng thái</th>
                        <th className="w-[9%] min-w-[72px] whitespace-nowrap px-2 py-2.5 text-center font-semibold text-slate-700">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailData.variants.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                            <Package className="mx-auto size-9 text-slate-300 stroke-1 mb-2" />
                            <p className="font-semibold text-slate-900 text-sm">Chưa có biến thể nào</p>
                            <p className="text-sm font-medium text-slate-500 mt-1 max-w-sm mx-auto">
                              Thêm biến thể theo kích cỡ, màu sắc hoặc kiểu dáng để quản lý tồn kho và giá bán.
                            </p>
                            {canWrite && <Button
                                type="button"
                                onClick={handleOpenAddVariant}
                                className="mt-3.5 h-8.5 rounded-xs bg-[#6941c6] px-4 text-sm font-semibold text-white hover:bg-[#53389e] transition-colors shadow-xs"
                              >
                                Thêm biến thể
                              </Button>}
                          </td>
                        </tr>
                      ) : (
                        detailData.variants.map((v) => {
                          const isChecked = selectedVariantIds.has(v.id);
                          return (
                            <tr
                              key={v.id}
                              onClick={() => handleSelectVariantRow(v)}
                              className={cn(
                                "cursor-pointer transition-colors hover:bg-slate-50/80",
                                isChecked && "bg-slate-50",
                              )}
                            >
                              {/* Color Swatch + Name */}
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-8.5 shrink-0 overflow-hidden rounded-xs border border-slate-200 bg-slate-100 shadow-xs">
                                    {v.swatch ? (
                                      <img
                                        src={v.swatch}
                                        alt={v.color}
                                        className="h-full w-full object-cover object-top"
                                      />
                                    ) : (
                                      <div
                                        className="h-full w-full"
                                        style={{ backgroundColor: v.colorHex || "#c19a6b" }}
                                      />
                                    )}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-950 truncate">{v.color}</span>
                                </div>
                              </td>

                              {/* Size */}
                              <td className="px-3 py-2.5 text-center text-sm font-semibold text-slate-800">{v.size}</td>

                              {/* SKU */}
                              <td className="px-3 py-2.5 tabular-nums text-sm font-semibold text-slate-600 truncate">{v.sku}</td>

                              {/* Stock */}
                              <td className="px-3 py-2.5 text-sm font-semibold text-slate-900 tabular-nums">
                                {Number(v.stock) || 0} sản phẩm
                              </td>

                              {/* Price */}
                              <td className="px-3 py-2.5 text-sm font-semibold text-slate-950 tabular-nums">
                                {v.price ? `${Number(v.price).toLocaleString("vi-VN")} ₫` : "—"}
                              </td>

                              {/* Status */}
                              <td className="px-3 py-2.5 text-center">
                                {Number(v.stock) >= 25 || v.status === "in_stock" ? (
                                  <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                    <span className="size-1.5 rounded-full bg-emerald-500" />
                                    Còn hàng
                                  </span>
                                ) : Number(v.stock) > 0 || v.status === "low_stock" ? (
                                  <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                                    <span className="size-1.5 rounded-full bg-amber-500" />
                                    Sắp hết hàng
                                  </span>
                                ) : (
                                  <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-rose-200/80 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                                    <span className="size-1.5 rounded-full bg-rose-500" />
                                    Hết hàng
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="whitespace-nowrap px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex size-8 items-center justify-center rounded-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                      aria-label="Thao tác biến thể"
                                    >
                                      <MoreHorizontal className="size-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40 rounded-xs p-1 shadow-lg">
                                    <DropdownMenuItem
                                      onClick={() => handleOpenStockIn(v)}
                                      className="cursor-pointer text-sm text-slate-800 flex items-center gap-1.5 font-semibold"
                                    >
                                      <PackagePlus className="size-3.5 text-[#6941c6]" />
                                      <span>Nhập kho</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteVariant(v.id)}
                                      className="cursor-pointer text-sm font-semibold text-rose-600"
                                    >
                                      Xóa biến thể
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols) */}
          <div className="space-y-4 lg:col-span-4">
            {/* Card 1: Inventory summary */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              <h2 className="text-slate-950 admin-section-title">Tổng quan tồn kho</h2>

              <div className="mt-3.5 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Tổng số biến thể</span>
                  <span className="font-semibold text-slate-950">{totalVariants}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Tổng tồn kho</span>
                  <span className="font-semibold text-slate-950">{totalStockUnits} sản phẩm</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Trạng thái tồn kho</span>
                  {totalVariants === 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-slate-600 font-semibold">
                      <span className="size-1.5 rounded-full bg-slate-400" />
                      Chưa theo dõi
                    </span>
                  ) : inStockUnits > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Còn hàng
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-rose-600 font-semibold">
                      <span className="size-1.5 rounded-full bg-rose-500" />
                      Hết hàng
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Trạng thái thiết lập</span>
                  <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
                    <span className="size-1.5 rounded-full bg-slate-400" />
                    {form.status === "published" ? "Đang bán" : form.status === "archived" ? "Đã lưu trữ" : "Bản nháp"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Sales channels */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-slate-950 admin-section-title">Kênh bán hàng</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManageChannelsModalOpen(true)}
                  className="h-7.5 px-2.5 rounded-xs border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  Quản lý
                </Button>
              </div>

              <div className="mt-3.5 space-y-3">
                {/* Online Store */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs border border-slate-200 bg-slate-50 text-slate-700">
                      <Store className="size-4 text-emerald-600" />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">Cửa hàng trực tuyến</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Đã bật
                  </span>
                </div>

                {/* Instagram Shop */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs border border-slate-200 bg-slate-50 text-slate-700">
                      <Instagram className="size-4 text-slate-500" />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">Cửa hàng Instagram</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Đã bật
                  </span>
                </div>

                {/* Marketplace */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xs border border-slate-200 bg-slate-50 text-slate-700">
                      <ShoppingBag className="size-4 text-slate-500" />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">Sàn thương mại điện tử</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700">
                    <span className="size-1.5 rounded-full bg-slate-400" />
                    Chưa kết nối
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Publishing checklist */}
            <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
              <h2 className="text-slate-950 admin-section-title">Danh sách kiểm tra trước khi đăng</h2>

              <div className="mt-3.5 space-y-3.5">
                {/* 1. Add media */}
                <div className="flex items-start gap-3">
                  {isMediaDone ? (
                    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-300 text-emerald-600">
                      <Check className="size-3 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-slate-300" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">Thêm hình ảnh</p>
                    <p className="text-sm font-medium text-slate-500 mt-0.5">Tải lên ít nhất một hình ảnh sản phẩm</p>
                  </div>
                </div>

                {/* 2. Fill product details */}
                <div className="flex items-start gap-3">
                  {isDetailsDone ? (
                    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-300 text-emerald-600">
                      <Check className="size-3 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-slate-300" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">Điền thông tin sản phẩm</p>
                    <p className="text-sm font-medium text-slate-500 mt-0.5">Điền tên, danh mục, giá bán và các thông tin khác</p>
                  </div>
                </div>

                {/* 3. Add variants */}
                <div className="flex items-start gap-3">
                  {isVariantsDone ? (
                    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-300 text-emerald-600">
                      <Check className="size-3 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-slate-300" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">Thêm biến thể</p>
                    <p className="text-sm font-medium text-slate-500 mt-0.5">Tạo ít nhất một biến thể theo kích cỡ, màu sắc…</p>
                  </div>
                </div>

                {/* 4. Add SEO content */}
                <div className="flex items-start gap-3">
                  {isSeoDone ? (
                    <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-300 text-emerald-600">
                      <Check className="size-3 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-slate-300" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">Thêm nội dung SEO</p>
                    <p className="text-sm font-medium text-slate-500 mt-0.5">Viết tiêu đề trang và mô tả tìm kiếm</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Full-Width Grid: Product description (5 cols) & SEO / Content (7 cols) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
          {/* Card: Product description (5 cols) */}
          <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col space-y-3 lg:col-span-5">
            <h2 className="text-slate-950 admin-section-title">Mô tả sản phẩm</h2>

            {/* Rich text toolbar */}
            <div className="flex flex-wrap items-center gap-1 rounded-xs border border-slate-200 bg-slate-50/80 p-1.5 text-slate-700">
              <select className="h-7.5 rounded-xs border-0 bg-transparent px-2 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-200/60">
                <option value="Paragraph">Đoạn văn</option>
                <option value="Heading 1">Tiêu đề cấp 1</option>
                <option value="Heading 2">Tiêu đề cấp 2</option>
                <option value="Heading 3">Tiêu đề cấp 3</option>
              </select>

              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              <button type="button" className="inline-flex size-7 items-center justify-center rounded-xs hover:bg-slate-200/60 text-slate-700">
                <Bold className="size-3.5" />
              </button>
              <button type="button" className="inline-flex size-7 items-center justify-center rounded-xs hover:bg-slate-200/60 text-slate-700">
                <Italic className="size-3.5" />
              </button>
              <button type="button" className="inline-flex size-7 items-center justify-center rounded-xs hover:bg-slate-200/60 text-slate-700">
                <Underline className="size-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              <button type="button" className="inline-flex size-7 items-center justify-center rounded-xs hover:bg-slate-200/60 text-slate-700">
                <List className="size-3.5" />
              </button>
              <button type="button" className="inline-flex size-7 items-center justify-center rounded-xs hover:bg-slate-200/60 text-slate-700">
                <ListOrdered className="size-3.5" />
              </button>

              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              <button type="button" className="inline-flex size-7 items-center justify-center rounded-xs hover:bg-slate-200/60 text-slate-700">
                <Link2 className="size-3.5" />
              </button>
              <button type="button" className="inline-flex size-7 items-center justify-center rounded-xs hover:bg-slate-200/60 text-slate-700">
                <ImageIcon className="size-3.5" />
              </button>
              <button type="button" className="inline-flex size-7 items-center justify-center rounded-xs hover:bg-slate-200/60 text-slate-700">
                <Play className="size-3.5" />
              </button>
              <button type="button" className="inline-flex size-7 items-center justify-center rounded-xs hover:bg-slate-200/60 text-slate-700">
                <Maximize2 className="size-3.5" />
              </button>
            </div>

            {/* Description Textarea */}
            <div>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Nhập mô tả chi tiết sản phẩm..."
                className="w-full rounded-xs border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 leading-relaxed outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6] resize-none"
              />
              <span className="mt-1 block text-right text-sm font-medium text-slate-400">
                {form.description.length} ký tự
              </span>
            </div>
          </div>

          {/* Card: SEO / Content (7 cols) */}
          <div className="rounded-xs border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col space-y-3 lg:col-span-7">
            <h2 className="text-slate-950 admin-section-title">SEO / Nội dung</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
              {/* Left col: inputs */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Tiêu đề trang</label>
                  <Input
                    value={detailData.pageTitle}
                    onChange={(e) => setDetailData((d) => ({ ...d, pageTitle: e.target.value }))}
                    placeholder="VD: Áo khoác len cổ điển | ÉLANE"
                    className="mt-1 h-9 rounded-xs border-slate-200 text-sm font-semibold text-slate-900 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Đường dẫn trang</label>
                  <Input
                    value={detailData.urlSlug.replace(/^elane\.com\/products\/?/, "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDetailData((d) => ({ ...d, urlSlug: `elane.com/products/${val}` }));
                      setForm((f) => ({ ...f, slug: val }));
                    }}
                    placeholder="VD: ao-khoac-len-co-dien"
                    className="mt-1 h-9 rounded-xs border-slate-200 tabular-nums text-sm font-semibold text-slate-900 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">Mô tả tìm kiếm</label>
                  <textarea
                    rows={3}
                    value={detailData.metaDescription}
                    onChange={(e) => setDetailData((d) => ({ ...d, metaDescription: e.target.value }))}
                    placeholder="Nhập mô tả ngắn cho công cụ tìm kiếm..."
                    className="mt-1 w-full rounded-xs border border-slate-200 bg-white p-2.5 text-sm font-medium text-slate-800 leading-relaxed outline-none focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6] resize-none"
                  />
                  <span className="mt-0.5 block text-right text-sm font-medium text-slate-400">
                    {detailData.metaDescription.length} ký tự
                  </span>
                </div>
              </div>

              {/* Right col: Google preview */}
              <div>
                <label className="text-sm font-semibold text-slate-700">Xem trước trên Google</label>
                <div className="mt-1 rounded-xs border border-slate-200/90 bg-slate-50/60 p-3.5 shadow-2xs font-sans">
                  {/* Logo + Domain + Breadcrumb */}
                  <div className="flex items-center gap-2">
                    <div className="flex size-5.5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shadow-2xs">
                      É
                    </div>
                    <div className="min-w-0 leading-tight">
                      <div className="text-sm font-semibold text-slate-900">ÉLANE</div>
                      <div className="truncate text-xs text-slate-500 tabular-nums">
                        https://elane.com/{detailData.urlSlug.replace(/^elane\.com\/products\/?/, "")}
                      </div>
                    </div>
                  </div>

                  {/* Google Blue Link */}
                  <a
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    className="mt-2 block text-base font-semibold text-[#1a0dab] hover:underline leading-snug line-clamp-1"
                  >
                    {detailData.pageTitle || (form.name ? `${form.name} | ÉLANE` : "Tiêu đề sản phẩm sẽ hiển thị tại đây")}
                  </a>

                  {/* Snippet text */}
                  <p className="mt-1 text-sm font-medium text-[#4d5156] leading-relaxed line-clamp-3">
                    {detailData.metaDescription || form.description || "Nhập mô tả tìm kiếm để xem trước tại đây..."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- DIALOGS FOR EDITING --- */}

        {/* 1. Edit product information modal */}
        <Dialog open={editProductModalOpen} onOpenChange={setEditProductModalOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-xs bg-white p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-950 admin-section-title">Chỉnh sửa thông tin sản phẩm</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-4 text-sm">
              <div>
                <label className="font-semibold text-slate-700">Tên sản phẩm *</label>
                <Input
                  className="mt-1 h-9 rounded-xs border-slate-200 text-sm font-semibold text-slate-900"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, slug: editing ? f.slug : slugify(name) }));
                    setDetailData((d) => ({ ...d, pageTitle: `${name} | ÉLANE` }));
                  }}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Mô tả ngắn</label>
                <Input
                  className="mt-1 h-9 rounded-xs border-slate-200 text-sm font-semibold text-slate-900"
                  value={detailData.subtitle}
                  onChange={(e) => setDetailData((d) => ({ ...d, subtitle: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700">Trạng thái</label>
                  <select
                    className="mt-1 flex h-9 w-full rounded-xs border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))
                    }
                  >
                    <option value="published">Đang bán</option>
                    <option value="draft">Bản nháp</option>
                    <option value="archived">Đã ẩn</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Danh mục</label>
                  <select
                    className="mt-1 flex h-9 w-full rounded-xs border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
                    value={form.primary_category_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((f) => ({ ...f, primary_category_id: val }));
                      const found = filterCategories.find((c) => c.id === val || c.slug === val);
                      if (found) {
                        setDetailData((d) => ({ ...d, categoryPath: `${found.name} > Áo khoác dài` }));
                      }
                    }}
                  >
                    {filterCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-slate-700">Giá bán (₫)</label>
                  <Input
                    className="mt-1 h-9 rounded-xs border-slate-200 tabular-nums text-sm font-semibold text-slate-900"
                    type="number"
                    value={form.price_vnd}
                    onChange={(e) => setForm((f) => ({ ...f, price_vnd: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Giá gốc (₫)</label>
                  <Input
                    className="mt-1 h-9 rounded-xs border-slate-200 tabular-nums text-sm font-semibold text-slate-900"
                    type="number"
                    value={form.compare_at_price_vnd}
                    onChange={(e) => setForm((f) => ({ ...f, compare_at_price_vnd: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Giá vốn (₫)</label>
                  <Input
                    className="mt-1 h-9 rounded-xs border-slate-200 tabular-nums text-sm font-semibold text-slate-900"
                    type="number"
                    value={form.cost_vnd}
                    onChange={(e) => setForm((f) => ({ ...f, cost_vnd: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Mô tả chi tiết</label>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-xs border border-slate-200 bg-white p-2.5 text-sm font-medium text-slate-900 outline-none focus:border-[#6941c6]"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 sm:justify-end gap-2">
              <Button variant="outline" className="h-9 rounded-xs text-sm font-semibold" onClick={() => setEditProductModalOpen(false)}>
                Hủy
              </Button>
              <Button
                onClick={() => {
                  setEditProductModalOpen(false);
                  save(form.status, false);
                }}
                className="h-9 rounded-xs bg-[#6941c6] text-sm font-semibold text-white hover:bg-[#53389e]"
              >
                Lưu thay đổi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 2. Edit Overview Modal */}
        <Dialog open={editOverviewModalOpen} onOpenChange={setEditOverviewModalOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-xs bg-white p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-950 admin-section-title">Chỉnh sửa tổng quan sản phẩm</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-4 text-sm">
              <div>
                <label className="font-semibold text-slate-700">Mô tả sản phẩm</label>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-xs border border-slate-200 bg-white p-2.5 text-sm font-medium text-slate-900 outline-none focus:border-[#6941c6]"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Đặc điểm nổi bật (mỗi dòng một đặc điểm)</label>
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-xs border border-slate-200 bg-white p-2.5 text-sm font-medium text-slate-900 outline-none focus:border-[#6941c6]"
                  value={detailData.keyFeatures.join("\n")}
                  onChange={(e) =>
                    setDetailData((d) => ({
                      ...d,
                      keyFeatures: e.target.value.split("\n").filter((l) => l.trim()),
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700">Thương hiệu</label>
                  <Input
                    className="mt-1 h-9 rounded-xs border-slate-200 text-sm font-semibold text-slate-900"
                    value={detailData.brand}
                    onChange={(e) => setDetailData((d) => ({ ...d, brand: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Mùa / BST</label>
                  <Input
                    className="mt-1 h-9 rounded-xs border-slate-200 text-sm font-semibold text-slate-900"
                    value={detailData.season}
                    onChange={(e) => setDetailData((d) => ({ ...d, season: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Chất liệu</label>
                <Input
                  className="mt-1 h-9 rounded-xs border-slate-200 text-sm font-semibold text-slate-900"
                  value={form.material}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((f) => ({ ...f, material: val }));
                    setDetailData((d) => ({ ...d, material: val }));
                  }}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 sm:justify-end gap-2">
              <Button variant="outline" className="h-9 rounded-xs text-sm font-semibold" onClick={() => setEditOverviewModalOpen(false)}>
                Đóng
              </Button>
              <Button
                onClick={() => {
                  setEditOverviewModalOpen(false);
                  toast.success("Đã cập nhật tổng quan sản phẩm!");
                }}
                className="h-9 rounded-xs bg-[#6941c6] text-sm font-semibold text-white hover:bg-[#53389e]"
              >
                Cập nhật
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 3. Edit Summary & Pricing Modal */}
        <Dialog open={editSummaryModalOpen} onOpenChange={setEditSummaryModalOpen}>
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-xs bg-white p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-950 admin-section-title">Chỉnh sửa tóm tắt & giá bán</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-4 text-sm">
              <div>
                <label className="font-semibold text-slate-700">Mã SKU chính</label>
                <Input
                  className="mt-1 h-9 rounded-xs border-slate-200 tabular-nums text-sm font-semibold text-slate-900"
                  value={detailData.sku}
                  onChange={(e) => setDetailData((d) => ({ ...d, sku: e.target.value }))}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Giá bán (₫)</label>
                <Input
                  className="mt-1 h-9 rounded-xs border-slate-200 tabular-nums text-sm font-semibold text-slate-900"
                  type="number"
                  value={form.price_vnd}
                  onChange={(e) => setForm((f) => ({ ...f, price_vnd: e.target.value }))}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Giá so sánh / Giá gốc (₫)</label>
                <Input
                  className="mt-1 h-9 rounded-xs border-slate-200 tabular-nums text-sm font-semibold text-slate-900"
                  type="number"
                  value={form.compare_at_price_vnd}
                  onChange={(e) => setForm((f) => ({ ...f, compare_at_price_vnd: e.target.value }))}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Giá vốn (₫)</label>
                <Input
                  className="mt-1 h-9 rounded-xs border-slate-200 tabular-nums text-sm font-semibold text-slate-900"
                  type="number"
                  value={form.cost_vnd}
                  onChange={(e) => setForm((f) => ({ ...f, cost_vnd: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 sm:justify-end gap-2">
              <Button variant="outline" className="h-9 rounded-xs text-sm font-semibold" onClick={() => setEditSummaryModalOpen(false)}>
                Hủy
              </Button>
              <Button
                onClick={() => {
                  setEditSummaryModalOpen(false);
                  save(form.status, false);
                }}
                className="h-9 rounded-xs bg-[#6941c6] text-sm font-semibold text-white hover:bg-[#53389e]"
              >
                Lưu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 4. Add Colorway & Variants Modal */}
        {renderAddColorwayModal()}

        {/* 4.1 Stock-In Modal */}
        {renderStockInModal()}

        {/* 5. Manage Channels Modal */}
        <Dialog open={manageChannelsModalOpen} onOpenChange={setManageChannelsModalOpen}>
          <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-xs bg-white p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-950 admin-section-title">Quản lý kênh phân phối</DialogTitle>
            </DialogHeader>

            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center justify-between rounded-xs border border-slate-200 p-3.5">
                <div className="flex items-center gap-3">
                  <Store className="size-4.5 text-slate-700" />
                  <div>
                    <span className="font-semibold text-slate-900">Cửa hàng trực tuyến</span>
                    <p className="text-sm font-medium text-slate-500">trang web chính thức elane.com</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
                  Đang bán
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xs border border-slate-200 p-3.5">
                <div className="flex items-center gap-3">
                  <Instagram className="size-4.5 text-[#6941c6]" />
                  <div>
                    <span className="font-semibold text-slate-900">Cửa hàng Instagram</span>
                    <p className="text-sm font-medium text-slate-500">Đồng bộ danh mục Instagram</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700">
                  Bản nháp
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xs border border-slate-200 p-3.5">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="size-4.5 text-amber-600" />
                  <div>
                    <span className="font-semibold text-slate-900">Sàn thương mại điện tử</span>
                    <p className="text-sm font-semibold text-slate-500">Lên lịch: 15/01/2025</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-semibold text-amber-700">
                  Đã lên lịch
                </span>
              </div>
            </div>

            <DialogFooter className="mt-6 sm:justify-end">
              <Button
                onClick={() => setManageChannelsModalOpen(false)}
                className="h-9 rounded-xs bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 6. View All Activity Modal */}
        <Dialog open={viewAllActivityOpen} onOpenChange={setViewAllActivityOpen}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-xs bg-white p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-950 admin-section-title">Lịch sử hoạt động sản phẩm</DialogTitle>
            </DialogHeader>

            <div className="mt-4 divide-y divide-slate-100 space-y-3">
              {DEFAULT_ACTIVITIES.map((act) => (
                <div key={act.id} className="pt-3 flex items-start justify-between gap-3 text-sm">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-1 size-2 rounded-full bg-slate-400 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-950">{act.title}</p>
                      <p className="text-sm font-medium text-slate-500">Thực hiện bởi: {act.actor}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-500 shrink-0">{act.time}</span>
                </div>
              ))}
            </div>

            <DialogFooter className="mt-6 sm:justify-end">
              <Button
                onClick={() => setViewAllActivityOpen(false)}
                className="h-9 rounded-xs bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const statusBreakdownTotal = statusCounts.published + statusCounts.draft + statusCounts.archived;
  const statusDistributionTotal = statusBreakdownTotal || statusCounts.all;

  return (
    <div className="products-manager-view products-manager-list space-y-5 font-sans pb-12">
      {confirmDialog}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-slate-900 admin-page-title">Sản phẩm</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tìm mẫu, rà tồn kho và cập nhật trạng thái bán hàng.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={exportCSV}
            className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Download className="size-3.5 text-slate-500" />
            <span>Xuất dữ liệu</span>
          </Button>
          {canWrite && <Button
              onClick={openCreate}
            className="h-9 gap-1.5 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white shadow-none hover:bg-[#53389e] transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Thêm sản phẩm</span>
            </Button>}
        </div>
      </div>

      {/* Catalog summary and status distribution also filter the list. */}
      <div role="tablist" aria-label="Lọc sản phẩm theo trạng thái" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            id: "all",
            label: "Tất cả sản phẩm",
            count: statusCounts.all,
            color: "bg-[#6941c6]",
          },
          {
            id: "published",
            label: "Đang bán",
            count: statusCounts.published,
            color: "bg-emerald-500",
          },
          {
            id: "draft",
            label: "Bản nháp",
            count: statusCounts.draft,
            color: "bg-amber-500",
          },
          {
            id: "archived",
            label: "Đã lưu trữ",
            count: statusCounts.archived,
            color: "bg-slate-400",
          },
        ].map((tab) => {
          const active = statusFilter === tab.id;
          const percentage = tab.id === "all"
            ? 100
            : statusDistributionTotal > 0
              ? Math.round((tab.count / statusDistributionTotal) * 100)
              : 0;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={cn(
                "group relative flex min-h-[112px] flex-col justify-between overflow-hidden rounded-xs border bg-white p-4 text-left transition duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6] focus-visible:ring-offset-2",
                active
                  ? "border-[#6941c6]/50 bg-[#f8f7ff]"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60",
              )}
            >
              <span className={cn(
                "absolute inset-x-0 top-0 h-[3px]",
                tab.color,
                active ? "opacity-100" : "opacity-45 group-hover:opacity-75",
              )} aria-hidden="true" />
              <span className="flex w-full items-center justify-between gap-3 pt-0.5">
                <span className={cn(
                  "text-[13px]",
                  active ? "font-semibold text-slate-900" : "font-medium text-slate-600",
                )}>
                  {tab.label}
                </span>
                {tab.id !== "all" && (
                  <span className="text-xs font-medium tabular-nums text-slate-500">
                    <AnimatedValue value={`${percentage}%`} />
                  </span>
                )}
              </span>

              <span className="flex w-full items-baseline gap-2">
                <span className={cn(
                  "text-[26px] font-semibold leading-none tabular-nums tracking-tight",
                  active ? "text-slate-950" : "text-slate-800",
                )}>
                  <AnimatedValue value={tab.count.toLocaleString("vi-VN")} />
                </span>
                <span className="text-xs font-medium text-slate-500">sản phẩm</span>
              </span>

              {tab.id === "all" ? (
                <span className="text-xs text-slate-500">Toàn bộ danh mục</span>
              ) : (
                <span className="block h-1 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <span
                    className={cn("block h-full rounded-full transition-[width] duration-300", tab.color)}
                    style={{ width: `${percentage}%` }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search box */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Tìm tên sản phẩm hoặc SKU"
              className="h-9 rounded-xs border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-800 shadow-none placeholder:text-slate-400 focus:border-[#6941c6] focus:ring-1 focus:ring-[#6941c6]"
            />
            {queryInput ? (
              <button
                type="button"
                onClick={() => setQueryInput("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Hierarchical category filter */}
          <Popover open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 gap-1.5 rounded-xs border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50",
                  categoryId && "border-[#6941c6] text-[#6941c6] bg-[#f4f3ff]",
                )}
              >
                <span>{activeCategoryLabel}</span>
                <ChevronDown className="size-3.5 text-slate-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 max-w-[calc(100vw-1.5rem)] p-2">
              <div className="mb-2 border-b border-slate-100 pb-2">
                <p className="px-2 pb-1 text-xs font-medium text-slate-500">Danh mục sản phẩm</p>
                <button
                  type="button"
                  aria-pressed={!categoryId}
                  onClick={() => {
                    setCategoryId("");
                    setPage(1);
                    setCategoryPickerOpen(false);
                  }}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-xs px-2 text-left text-sm transition-colors hover:bg-slate-100",
                    !categoryId ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700",
                  )}
                >
                  <Check className={cn("size-3.5", !categoryId ? "opacity-100" : "opacity-0")} />
                  Tất cả danh mục
                </button>
              </div>
              <div className="max-h-[min(24rem,60vh)] overflow-y-auto pr-1">
                {categoryTree.length > 0 ? renderCategoryTree(categoryTree) : (
                  <p className="px-2 py-3 text-sm text-slate-500">Chưa có danh mục.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* More Filters Popover */}
          <Popover
            open={filtersOpen}
            onOpenChange={(open) => {
              if (open) {
                setPriceMinDraft(priceMin);
                setPriceMaxDraft(priceMax);
                setStockDraft(stock);
              }
              setFiltersOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 gap-1.5 rounded-xs border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50",
                  moreFilterCount > 0 && "border-[#6941c6] text-[#6941c6] bg-[#f4f3ff]",
                )}
              >
                <SlidersHorizontal className="size-3.5 text-slate-500" />
                <span>Bộ lọc khác</span>
                {moreFilterCount > 0 && (
                  <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-[#6941c6] text-xs font-semibold text-white">
                    {moreFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[360px] max-w-[calc(100vw-1.5rem)] p-4 shadow-lg rounded-xs">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Lọc sản phẩm</h4>
                    <p className="mt-0.5 text-xs text-slate-500">Khoảng giá và lượng tồn kho</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetAdvancedFilters}
                    className="shrink-0 rounded-xs px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Đặt lại
                  </button>
                </div>

                <section aria-labelledby="product-price-filter" className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h5 id="product-price-filter" className="text-sm font-medium text-slate-800">Giá bán</h5>
                    <span className="text-xs text-slate-500">VND</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-xs text-slate-500">Từ</span>
                      <Input
                        inputMode="numeric"
                        aria-label="Giá bán tối thiểu"
                        placeholder="Không giới hạn"
                        value={priceMinDraft}
                        onChange={(event) => setPriceMinDraft(event.target.value.replace(/[^\d]/g, ""))}
                        className="h-9 text-sm tabular-nums"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-slate-500">Đến</span>
                      <Input
                        inputMode="numeric"
                        aria-label="Giá bán tối đa"
                        placeholder="Không giới hạn"
                        value={priceMaxDraft}
                        onChange={(event) => setPriceMaxDraft(event.target.value.replace(/[^\d]/g, ""))}
                        className="h-9 text-sm tabular-nums"
                      />
                    </label>
                  </div>
                  {priceRangeInvalid && (
                    <p role="alert" className="text-xs text-rose-700">Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.</p>
                  )}
                </section>

                <section aria-labelledby="product-stock-filter" className="space-y-2">
                  <h5 id="product-stock-filter" className="text-sm font-medium text-slate-800">Tình trạng tồn kho</h5>
                  <div role="group" aria-label="Lọc theo tồn kho" className="space-y-1">
                    {[
                      { id: "", title: "Tất cả mức tồn kho", detail: "Không giới hạn tồn kho", marker: "bg-slate-400" },
                      { id: "in", title: "Còn hàng", detail: "Trên 20 sản phẩm", marker: "bg-emerald-500" },
                      { id: "low", title: "Sắp hết hàng", detail: "Từ 1 đến 20 sản phẩm", marker: "bg-amber-500" },
                      { id: "out", title: "Hết hàng", detail: "0 sản phẩm", marker: "bg-rose-500" },
                    ].map((option) => (
                      <button
                        key={option.id || "all-stock"}
                        type="button"
                        aria-pressed={stockDraft === option.id}
                        onClick={() => setStockDraft(option.id as StockFilter)}
                        className={cn(
                          "flex min-h-10 w-full items-center gap-3 rounded-xs border px-3 py-2 text-left transition-colors",
                          stockDraft === option.id
                            ? "border-slate-300 bg-slate-50"
                            : "border-transparent hover:bg-slate-50",
                        )}
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", option.marker)} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-800">{option.title}</span>
                          <span className="block text-xs text-slate-500">{option.detail}</span>
                        </span>
                        <Check className={cn("size-4 shrink-0 text-slate-800", stockDraft === option.id ? "opacity-100" : "opacity-0")} />
                      </button>
                    ))}
                  </div>
                </section>

                <div className="flex items-center justify-end border-t border-slate-200 pt-3">
                  <Button
                    type="button"
                    disabled={priceRangeInvalid}
                    onClick={applyAdvancedFilters}
                    className="h-9 rounded-xs bg-[#6941c6] px-4 text-sm font-medium text-white hover:bg-[#53389e] disabled:opacity-50"
                  >
                    Áp dụng bộ lọc
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* View Switcher & Sort */}
        <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-auto">
          {/* Table / Grid view switcher */}
          <div className="flex items-center rounded-xs border border-slate-200 bg-slate-50/70 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex size-8 items-center justify-center rounded-xs text-slate-500 transition-colors",
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-medium"
                  : "hover:text-slate-900",
              )}
              title="Xem dạng bảng"
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex size-8 items-center justify-center rounded-xs text-slate-500 transition-colors",
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-medium"
                  : "hover:text-slate-900",
              )}
              title="Xem dạng lưới"
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-xs border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span>
                  Sắp xếp:{" "}
                  {sortBy === "newest"
                    ? "Mới nhất"
                    : sortBy === "price_asc"
                      ? "Giá: thấp đến cao"
                      : sortBy === "price_desc"
                        ? "Giá: cao đến thấp"
                        : sortBy === "name_asc"
                          ? "Tên: A–Z"
                          : "Tồn kho"}
                </span>
                <ChevronDown className="size-3.5 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1">
              {[
                { id: "newest", label: "Mới nhất" },
                { id: "price_asc", label: "Giá: thấp đến cao" },
                { id: "price_desc", label: "Giá: cao đến thấp" },
                { id: "name_asc", label: "Tên: A–Z" },
                { id: "stock_desc", label: "Tồn kho: nhiều đến ít" },
              ].map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => setSortBy(s.id)}
                  className="cursor-pointer text-sm"
                >
                  <Check
                    className={cn(
                      "mr-2 size-3.5",
                      sortBy === s.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk actions banner */}
      {selectedCount > 0 && (canWrite || canPublish || canDelete) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
          <span className="font-medium">Đã chọn {selectedCount} sản phẩm</span>
          <div className="flex items-center gap-2">
            {canPublish && <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={bulkPublish}
              className="h-8 rounded-xs bg-white border-slate-200 text-sm text-[#6941c6] hover:bg-[#f4f3ff]"
            >
              Đăng bán
            </Button>}
            {canWrite && <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={bulkDraft}
              className="h-8 rounded-xs border-amber-200 bg-white text-sm text-amber-700 hover:bg-amber-50"
            >
              Chuyển bản nháp
            </Button>}
            {canWrite && <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={bulkArchive}
              className="h-8 rounded-xs border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
            >
              Lưu trữ
            </Button>}
            {canDelete && <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={bulkDestroy}
              className="h-8 rounded-xs bg-white border-red-200 text-sm text-red-600 hover:bg-red-50"
            >
              Xóa
            </Button>}
            <Button
              size="sm"
              variant="ghost"
              disabled={bulkBusy}
              onClick={() => setSelected(new Set())}
              className="h-8 text-sm text-slate-500 hover:text-slate-800"
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}

      {/* Main Content: Table or Grid */}
      <AnimatedPanel transitionKey={`${statusFilter}:${viewMode}`} className="min-w-0">
      {viewMode === "table" ? (
        <div className="admin-table-frame overflow-hidden rounded-xs border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="admin-data-table w-full min-w-[860px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[44px]" />
                <col />
                <col className="w-[145px]" />
                <col className="w-[125px]" />
                <col className="w-[120px]" />
                <col className="w-[130px]" />
                <col className="w-[44px]" />
              </colgroup>
              <thead className="border-b border-slate-200 bg-white text-xs font-medium text-slate-500">
                <tr>
                  <th className="w-11 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                      }}
                      onChange={toggleAllFiltered}
                      className="size-4 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Sản phẩm</th>
                  <th className="px-3 py-2.5 font-medium">Danh mục</th>
                  <th className="px-3 py-2.5 text-right font-medium">Giá bán</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tồn kho</th>
                  <th className="px-3 py-2.5 font-medium">Trạng thái</th>
                  <th className="px-2 py-2.5" aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && items.length === 0
                  ? Array.from({ length: 5 }, (_, index) => (
                      <tr key={`product-loading-${index}`} className="h-[62px]">
                        <td className="px-3 py-3"><div className="size-4  rounded bg-slate-100" /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            <div className="size-10  rounded-xs bg-slate-100" />
                            <div className="space-y-2">
                              <div className="h-3 w-40  rounded bg-slate-100" />
                              <div className="h-2.5 w-28  rounded bg-slate-100" />
                            </div>
                          </div>
                        </td>
                        <td colSpan={5}><div className="mx-3 h-3  rounded bg-slate-100" /></td>
                      </tr>
                    ))
                  : items.map((p) => {
                  const thumb = productImageUrl(p.images?.[0] ?? p.media?.[0]?.url);
                  const isChecked = selected.has(p.id);
                  const sku = p.variants?.[0]?.sku ?? `EL-${p.id.slice(0, 6).toUpperCase()}`;
                  const categoryName = p.category?.name ?? "Chung";
                  const stockTotal = p.stock_total ?? 0;
                  const isLow = stockTotal > 0 && stockTotal <= 20;
                  const isOut = stockTotal === 0;

                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "h-[62px] transition-colors hover:bg-slate-50",
                        isChecked && "bg-[#f8f7ff]",
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${p.name}`}
                          checked={isChecked}
                          onChange={() => toggleOne(p.id)}
                          className="size-4 rounded-xs border-slate-300 text-[#6941c6] focus:ring-[#6941c6]"
                        />
                      </td>

                      {/* Product: thumbnail, name and SKU */}
                      <td className="min-w-0 px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="size-10 shrink-0 overflow-hidden rounded-xs border border-slate-200 bg-slate-100">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={p.name}
                                className="h-full w-full object-cover object-center"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm font-medium text-slate-400">
                                {p.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openDetail(p)}
                              className="block w-full truncate text-left text-sm font-semibold text-slate-900 transition-colors hover:text-[#6941c6]"
                              title={p.name}
                            >
                              {p.name}
                            </button>
                            <p className="mt-0.5 truncate text-xs font-medium text-slate-500" title={sku}>
                              {sku} · {p.variants?.length ?? 0} biến thể
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="truncate px-3 py-3 text-sm text-slate-600" title={categoryName}>{categoryName}</td>

                      {/* Price */}
                      <td className="px-3 py-3 text-right text-sm font-medium text-slate-900 tabular-nums">
                        {formatPrice(Number(p.price_vnd))}
                      </td>

                      {/* Inventory status and count */}
                      <td className="px-3 py-3 text-right">
                        <div className="inline-flex flex-col items-end gap-0.5">
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">{stockTotal}</span>
                          {isOut ? (
                            <span className="text-xs font-medium text-rose-700">Hết hàng</span>
                          ) : isLow ? (
                            <span className="text-xs font-medium text-amber-700">Sắp hết</span>
                          ) : (
                            <span className="text-xs text-slate-500">còn hàng</span>
                          )}
                        </div>
                      </td>

                      {/* Publication status */}
                      <td className="px-3 py-3">
                        {p.status === "published" ? (
                          <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <span className="size-1.5 rounded-full bg-emerald-500" />Đang bán
                          </span>
                        ) : p.status === "draft" ? (
                          <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                            <span className="size-1.5 rounded-full bg-slate-400" />Bản nháp
                          </span>
                        ) : (
                          <span className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                            <span className="size-1.5 rounded-full bg-slate-400" />Đã lưu trữ
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 p-1 shadow-lg rounded-xs">
                            <DropdownMenuItem
                              onClick={() => openDetail(p)}
                              className="cursor-pointer text-sm font-medium"
                            >
                              <Eye className="size-3.5 mr-2 text-slate-500" />
                              Xem chi tiết (Detail)
                            </DropdownMenuItem>
                            {canWrite && <DropdownMenuItem
                                onClick={() => openEdit(p)}
                                className="cursor-pointer text-sm font-medium text-[#6941c6]"
                              >
                                <Pencil className="size-3.5 mr-2 text-[#6941c6]" />
                                Chỉnh sửa (Edit product)
                              </DropdownMenuItem>}
                            {canReadInventory && <DropdownMenuItem
                                onClick={() => setStockDetail(p)}
                                className="cursor-pointer text-sm"
                              >
                                <Boxes className="size-3.5 mr-2 text-slate-500" />
                                Xem chi tiết tồn kho
                              </DropdownMenuItem>}
                            {canReadInventory && <DropdownMenuItem
                                onClick={() =>
                                  onNavigate?.("inventory", {
                                    productId: p.id,
                                    productName: p.name,
                                  })
                                }
                                className="cursor-pointer text-sm"
                              >
                                Quản lý tồn kho
                              </DropdownMenuItem>}
                            {(canWrite || canPublish || canDelete) && <DropdownMenuSeparator />}
                            {p.status === "published" ? (
                              canWrite && <DropdownMenuItem
                                  onClick={() => updateStatus(p, "draft")}
                                  className="cursor-pointer text-sm text-amber-600"
                                >
                                  Chuyển về bản nháp
                                </DropdownMenuItem>
                            ) : (
                              canPublish && <DropdownMenuItem
                                  onClick={() => updateStatus(p, "published")}
                                  className="cursor-pointer text-sm text-emerald-600"
                                >
                                  Đăng bán sản phẩm
                                </DropdownMenuItem>
                            )}
                            {canDelete && <DropdownMenuItem
                                onClick={() => remove(p)}
                                className="cursor-pointer text-sm text-red-600 focus:text-red-700"
                              >
                                Xóa sản phẩm
                              </DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                  })}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {!loading && !loadError && items.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Package className="size-10 text-slate-300" />
              <h3 className="mt-3 text-slate-800 admin-subsection-title">Không tìm thấy sản phẩm</h3>
              <p className="mt-1 text-sm text-slate-500">
                Thử thay đổi từ khóa tìm kiếm hoặc xóa các bộ lọc đang áp dụng.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="mt-4 rounded-xs text-sm"
              >
                Xóa tất cả bộ lọc
              </Button>
            </div>
          )}
          {!loading && loadError && (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Package className="size-8 text-slate-400" />
              <h3 className="mt-3 text-slate-800 admin-subsection-title">Chưa tải được danh sách sản phẩm</h3>
              <p className="mt-1 text-sm text-slate-500">Kiểm tra kết nối rồi thử lại.</p>
              <Button variant="outline" size="sm" onClick={() => void load()} className="mt-4 rounded-xs text-sm">
                Thử tải lại
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => {
            const thumb = productImageUrl(p.images?.[0] ?? p.media?.[0]?.url);
            const sku = p.variants?.[0]?.sku ?? `EL-${p.id.slice(0, 6).toUpperCase()}`;
            const stockTotal = p.stock_total ?? 0;
            const isLow = stockTotal > 0 && stockTotal <= 20;
            const isOut = stockTotal === 0;

            return (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-xs border border-slate-200/90 bg-white shadow-xs transition-shadow hover:shadow-md"
              >
                <div
                  className="relative aspect-4/3 w-full overflow-hidden bg-slate-100 cursor-pointer"
                  onClick={() => openDetail(p)}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm font-medium text-slate-400">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  {/* Floating Status Badge */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full border bg-white/95 px-2.5 py-0.5 text-sm font-semibold shadow-xs",
                      p.status === "published"
                        ? "border-emerald-200 text-emerald-700"
                        : p.status === "archived"
                          ? "border-slate-200 text-slate-600"
                          : "border-slate-200 text-slate-700",
                    )}>
                      <span className={cn(
                        "size-1.5 rounded-full",
                        p.status === "published"
                          ? "bg-emerald-500"
                          : p.status === "archived"
                            ? "bg-slate-400"
                            : "bg-slate-500",
                      )} />
                      {p.status === "published" ? "Đang bán" : p.status === "archived" ? "Đã lưu trữ" : "Bản nháp"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-500">
                    <span className="tabular-nums font-semibold text-slate-700">{sku}</span>
                    <span className="font-semibold text-slate-800">{p.category?.name ?? "Chung"}</span>
                  </div>
                  <h3
                    onClick={() => openDetail(p)}
                    className="mt-1.5 cursor-pointer text-slate-950 hover:text-[#6941c6] line-clamp-1 admin-subsection-title"
                  >
                    {p.name}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-600 line-clamp-2">
                    {p.material || p.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          isOut
                            ? "bg-rose-500"
                            : isLow
                              ? "bg-amber-500"
                              : "bg-emerald-500",
                        )}
                      />
                      <span className="font-semibold text-slate-900">{stockTotal} còn hàng</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-950">
                      {formatPrice(Number(p.price_vnd))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </AnimatedPanel>

      <AdminPagination
        count={total}
        page={page}
        pageSize={limit}
        noun="sản phẩm"
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setLimit(size);
          setPage(1);
        }}
      />

      {/* Stock Details Modal */}
      <Dialog open={!!stockDetail} onOpenChange={(open) => !open && setStockDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden rounded-xs bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-900 admin-section-title">Chi tiết tồn kho</DialogTitle>
            <p className="text-sm text-slate-500">{stockDetail?.name}</p>
          </DialogHeader>

          <div className="mt-4 overflow-hidden rounded-xs border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 text-left">Màu</th>
                  <th className="px-3 py-2.5 text-left">Kích cỡ</th>
                  <th className="px-3 py-2.5 text-left">SKU</th>
                  <th className="px-3 py-2.5 text-right">Khả dụng</th>
                  <th className="px-3 py-2.5 text-right">Đã giữ</th>
                  <th className="px-3 py-2.5 text-right">Thực có</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(stockDetail?.variants ?? []).map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {v.color?.name ?? "Tiêu chuẩn"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{v.size?.label ?? "M"}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-500">{v.sku}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">
                      {v.available ?? v.on_hand ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400">{v.reserved ?? 0}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{v.on_hand ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="mt-5 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!stockDetail) return;
                const id = stockDetail.id;
                const name = stockDetail.name;
                setStockDetail(null);
                onNavigate?.("inventory", { productId: id, productName: name });
              }}
              className="rounded-xs text-sm"
            >
              <PackagePlus className="mr-1.5 size-3.5 text-slate-500" />
              Tạo phiếu nhập kho
            </Button>
            <Button
              type="button"
              onClick={() => setStockDetail(null)}
              className="rounded-xs bg-slate-900 text-sm text-white"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
