export type AdminRouteConfig = {
  slug: string;
  aliases: string[];
  label: string;
};

export const ADMIN_ROUTES: Record<string, AdminRouteConfig> = {
  overview: {
    slug: "tongquan",
    aliases: ["overview", "tong-quan", ""],
    label: "Tổng quan",
  },
  products: {
    slug: "sanpham",
    aliases: ["san-pham", "products", "product"],
    label: "Sản phẩm",
  },
  orders: {
    slug: "donhang",
    aliases: ["don-hang", "orders", "order"],
    label: "Đơn hàng",
  },
  categories: {
    slug: "danhmuc",
    aliases: ["danh-muc", "categories", "category"],
    label: "Danh mục",
  },
  sizes: {
    slug: "bangsize",
    aliases: ["bang-size", "kichthuoc", "kich-thuoc", "sizes", "size"],
    label: "Bảng kích cỡ",
  },
  inventory: {
    slug: "khohang",
    aliases: ["kho-hang", "inventory", "kho"],
    label: "Kho hàng",
  },
  customers: {
    slug: "khachhang",
    aliases: ["khach-hang", "customers", "customer"],
    label: "Khách hàng",
  },
  promotions: {
    slug: "khuyenmai",
    aliases: ["khuyen-mai", "promotions", "promotion", "giam-gia"],
    label: "Khuyến mãi",
  },
  social: {
    slug: "kenhbanhang",
    aliases: ["kenh-ban-hang", "social", "instagram"],
    label: "Kênh bán hàng",
  },
  elanewoman: {
    slug: "elanewoman",
    aliases: ["elane-woman"],
    label: "ÉLANEwoman",
  },
  collections: {
    slug: "bosuutap",
    aliases: ["bo-suu-tap", "collections", "collection"],
    label: "Bộ sưu tập",
  },
  lookbook: {
    slug: "lookbook",
    aliases: ["lookbooks"],
    label: "Bộ ảnh",
  },
  journal: {
    slug: "tapchi",
    aliases: ["tap-chi", "journal"],
    label: "Tạp chí",
  },
  pages: {
    slug: "trang",
    aliases: ["pages", "page"],
    label: "Trang nội dung",
  },
  reviews: {
    slug: "danhgia",
    aliases: ["danh-gia", "reviews", "review"],
    label: "Đánh giá",
  },
  newsletter: {
    slug: "bantin",
    aliases: ["ban-tin", "newsletter"],
    label: "Bản tin",
  },
  ai_keys: {
    slug: "ai-keys",
    aliases: ["ai_keys", "ai", "keys"],
    label: "Quản lý khóa AI",
  },
  reports: {
    slug: "baocao",
    aliases: ["bao-cao", "reports", "report"],
    label: "Báo cáo",
  },
  settings: {
    slug: "caidat",
    aliases: ["cai-dat", "settings", "setting"],
    label: "Cài đặt",
  },
  roles: {
    slug: "phanquyen",
    aliases: ["phan-quyen", "roles", "role"],
    label: "Phân quyền",
  },
  audit: {
    slug: "nhatky",
    aliases: ["nhat-ky", "audit", "logs"],
    label: "Nhật ký",
  },
};

export function resolveAdminPath(path: string): {
  tabId: string;
  action?: "create" | "edit" | "detail" | null;
  subParam?: string | null;
} {
  const rawParts = path.replace(/^\/+|\/+$/g, "").split("/");
  const first = (rawParts[0] ?? "").toLowerCase();
  const second = rawParts[1];
  const third = rawParts[2];

  if (!first || first === "tongquan" || first === "tong-quan" || first === "overview") {
    return { tabId: "overview", action: null, subParam: null };
  }

  let tabId = "overview";
  for (const [id, config] of Object.entries(ADMIN_ROUTES)) {
    if (config.slug === first || config.aliases.includes(first) || id === first) {
      tabId = id;
      break;
    }
  }

  let action: "create" | "edit" | "detail" | null = null;
  let subParam: string | null = null;

  if (second) {
    const secondLower = second.toLowerCase();
    if (["themsanpham", "them-san-pham", "them", "new", "create", "tao", "tao-moi", "taophieu"].includes(secondLower)) {
      action = "create";
      subParam = third ?? null;
    } else if (["sua", "edit", "chinh-sua", "chinhsua"].includes(secondLower)) {
      action = "edit";
      subParam = third ?? null;
    } else if (["chitiet", "chi-tiet", "detail", "view"].includes(secondLower)) {
      action = "detail";
      subParam = third ?? null;
    } else {
      subParam = second;
    }
  }

  return { tabId, action, subParam };
}

export function getAdminUrl(
  tabId: string,
  actionOrSub?: "create" | "edit" | string | null,
  subId?: string | null,
): string {
  if (tabId === "overview") return "/";
  const conf = ADMIN_ROUTES[tabId];
  const slug = conf?.slug ?? tabId;

  if (!actionOrSub) return `/${slug}`;
  if (actionOrSub === "create") {
    if (tabId === "products") return `/${slug}/themsanpham`;
    if (tabId === "inventory") return `/${slug}/taophieu`;
    return `/${slug}/them`;
  }
  if (actionOrSub === "edit" && subId) {
    return `/${slug}/sua/${subId}`;
  }
  return `/${slug}/${actionOrSub}`;
}
