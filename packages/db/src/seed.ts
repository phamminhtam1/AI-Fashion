import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { createDb } from "./client.js";
import * as s from "./schema.js";

const db = createDb(process.env.DATABASE_URL ?? "postgres://elane:elane@localhost:5432/elane");

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

const PERMS = [
  ["dashboard.read", "Xem dashboard"],
  ["report.read", "Xem báo cáo tổng quan"],
  ["report.export", "Xuất báo cáo"],
  ["product.read", "Xem sản phẩm"],
  ["product.write", "Sửa sản phẩm"],
  ["product.publish", "Xuất bản sản phẩm"],
  ["product.delete", "Xóa sản phẩm"],
  ["price.write", "Sửa giá"],
  ["cost.read", "Xem giá vốn"],
  ["category.read", "Xem danh mục"],
  ["category.write", "Quản lý danh mục"],
  ["inventory.read", "Xem tồn kho"],
  ["inventory.receive", "Nhập kho"],
  ["inventory.issue", "Xuất kho"],
  ["inventory.adjust.request", "Yêu cầu điều chỉnh kho"],
  ["inventory.adjust.approve", "Duyệt điều chỉnh kho"],
  ["order.write", "Tạo đơn hàng"],
  ["order.customer.read", "Tìm và chọn khách hàng khi tạo đơn"],
  ["order.update", "Cập nhật trạng thái đơn hàng"],
  ["order.cancel", "Hủy đơn hàng"],
  ["order.export", "Xuất danh sách đơn hàng"],
  ["content.read", "Xem nội dung"],
  ["content.write", "Chỉnh sửa nội dung"],
  ["content.publish", "Xuất bản nội dung"],
  ["channel.read", "Xem kênh bán hàng"],
  ["channel.write", "Quản lý kênh bán hàng"],
  ["channel.publish", "Xuất bản lên kênh bán hàng"],
  ["staff.manage", "Quản lý nhân viên"],
  ["role.manage", "Quản lý vai trò"],
  ["audit.read", "Xem audit"],
  ["customer.read", "Xem khách hàng"],
  ["customer.write", "Sửa khách hàng"],
  ["order.read", "Xem đơn hàng"],
  ["promotion.read", "Xem mã giảm giá"],
  ["promotion.write", "Sửa mã giảm giá"],
  ["settings.read", "Xem cài đặt"],
  ["settings.write", "Chỉnh sửa cài đặt"],
] as const;

const STAFF_ROLE_SEEDS = [
  { code: "content_editor", name: "Nhân viên content", system: false },
  { code: "sales_staff", name: "Nhân viên bán hàng", system: false },
  { code: "warehouse_staff", name: "Nhân viên kho", system: false },
] as const;

const STAFF_SEEDS = [
  { code: "ELN002", name: "Sophia Carter", email: "sophia@elane.vn", title: "Quản trị viên", role: "system_owner", status: "active", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN003", name: "James Wilson", email: "james@elane.vn", title: "Quản lý vận hành", role: "ops_manager", status: "active", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN004", name: "Emily Nguyen", email: "emily@elane.vn", title: "Biên tập viên", role: "content_editor", status: "active", avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN005", name: "Mint Tran", email: "mint@elane.vn", title: "Biên tập viên", role: "content_editor", status: "active", avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN006", name: "Linh Phạm", email: "linh@elane.vn", title: "Nhân viên bán hàng", role: "sales_staff", status: "active", avatarUrl: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN007", name: "Quang Anh", email: "quang@elane.vn", title: "Nhân viên kho", role: "warehouse_staff", status: "locked", avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN008", name: "Hòa Trần", email: "hoa@elane.vn", title: "Nhân viên bán hàng", role: "sales_staff", status: "active", avatarUrl: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN009", name: "Tuấn Quân", email: "tuan@elane.vn", title: "Quản lý vận hành", role: "ops_manager", status: "left", avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN010", name: "Mai Phương", email: "mai.phuong@elane.vn", title: "Biên tập viên", role: "content_editor", status: "active", avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN011", name: "An Nhiên", email: "an.nhien@elane.vn", title: "Chăm sóc khách hàng", role: "ops_manager", status: "active", avatarUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN012", name: "Thu Vân", email: "thu.van@elane.vn", title: "Quản lý kho", role: "warehouse_staff", status: "active", avatarUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=160&h=160&fit=crop&crop=face&q=85" },
  { code: "ELN013", name: "Linh Hà", email: "linh.ha@elane.vn", title: "Quản lý cửa hàng", role: "ops_manager", status: "active", avatarUrl: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=160&h=160&fit=crop&crop=face&q=85" },
] as const;

const STAFF_ROLE_PERMISSIONS: Record<string, string[]> = {
  system_owner: PERMS.map(([code]) => code),
  ops_manager: [
    "dashboard.read", "report.read", "report.export", "product.read", "product.write", "product.publish", "price.write", "category.read", "category.write", "inventory.read", "inventory.receive", "inventory.issue", "inventory.adjust.request",
    "inventory.adjust.approve", "content.read", "content.write", "content.publish", "channel.read", "channel.write", "channel.publish", "audit.read", "customer.read", "customer.write", "order.read", "order.write", "order.update", "order.cancel", "order.export",
    "promotion.read", "promotion.write", "settings.read", "order.customer.read",
  ],
  content_editor: ["product.read", "product.write", "product.publish", "content.read", "content.write", "content.publish", "channel.read", "channel.publish"],
  sales_staff: ["product.read", "customer.read", "customer.write", "order.read", "order.write", "order.customer.read", "order.update", "promotion.read"],
  warehouse_staff: ["product.read", "inventory.read", "inventory.receive", "inventory.issue", "inventory.adjust.request"],
};

const CATEGORIES = [
  ["vay-dam", "Váy / Đầm", "Những thiết kế đầm tinh tế cho mọi khoảnh khắc."],
  ["ao", "Áo", "Áo sơ mi lụa, áo kiểu và áo len được cắt may chỉn chu."],
  ["quan", "Quần", "Quần ống rộng, quần âu thanh lịch."],
  ["chan-vay", "Chân váy", "Chân váy xếp ly, chân váy midi mềm mại."],
  ["set-bo", "Set bộ", "Set bộ phối sẵn."],
  ["ao-khoac", "Áo khoác", "Blazer và áo khoác dạ."],
  ["phu-kien", "Phụ kiện", "Túi xách, trang sức."],
] as const;

/** Child categories under roots (mega-menu style). */
const CATEGORY_CHILDREN: Record<string, [string, string][]> = {
  "vay-dam": [
    ["dam-cong-so", "Đầm công sở"],
    ["dam-du-tiec", "Đầm dự tiệc"],
    ["dam-maxi", "Đầm maxi"],
    ["dam-midi", "Đầm midi"],
    ["dam-mini", "Đầm mini"],
    ["dam-chu-a", "Đầm chữ A"],
    ["dam-om", "Đầm ôm"],
    ["dam-xoe", "Đầm xòe"],
    ["dam-suong", "Đầm suông"],
  ],
  ao: [
    ["ao-so-mi", "Áo sơ mi"],
    ["ao-kieu", "Áo kiểu"],
    ["ao-len", "Áo len"],
    ["ao-thun", "Áo thun"],
    ["ao-croptop", "Áo croptop"],
    ["ao-tank-top", "Áo tank top"],
    ["ao-vest", "Áo vest"],
  ],
  quan: [
    ["quan-ong-rong", "Quần ống rộng"],
    ["quan-au", "Quần âu"],
    ["quan-jeans", "Quần jeans"],
    ["quan-short", "Quần short"],
    ["quan-culottes", "Quần culottes"],
  ],
};

/** Map legacy root slug → default leaf for seeded products. */
const LEAF_FOR_ROOT: Record<string, string> = {
  "vay-dam": "dam-suong",
  ao: "ao-so-mi",
  quan: "quan-ong-rong",
  "chan-vay": "chan-vay",
  "set-bo": "set-bo",
  "ao-khoac": "ao-khoac",
  "phu-kien": "phu-kien",
};

const OCCASIONS = [
  ["cong-so", "Công sở", "cong-so"],
  ["du-tiec", "Dự tiệc", "du-tiec"],
  ["casual", "Casual", "casual"],
] as const;

const COLORS = [
  ["den", "Đen", "#111111"],
  ["kem", "Kem", "#EFE8DC"],
  ["be", "Be", "#CDBBA3"],
  ["trang", "Trắng", "#FFFFFF"],
  ["nau", "Nâu", "#7A5A43"],
] as const;

const SIZES = [
  ["XS", "XS", 1],
  ["S", "S", 2],
  ["M", "M", 3],
  ["L", "L", 4],
  ["XL", "XL", 5],
  ["ONE_SIZE", "Free size", 99],
] as const;

/** Hardcoded guide that used to live on storefront /lien-he */
const DEFAULT_CHART_MEAS: Array<[string, string, number, number]> = [
  // size_code, measurement_code, min, max
  ["XS", "bust", 78, 80],
  ["XS", "waist", 60, 62],
  ["XS", "hip", 84, 86],
  ["S", "bust", 82, 84],
  ["S", "waist", 64, 66],
  ["S", "hip", 88, 90],
  ["M", "bust", 86, 88],
  ["M", "waist", 68, 70],
  ["M", "hip", 92, 94],
  ["L", "bust", 90, 92],
  ["L", "waist", 72, 74],
  ["L", "hip", 96, 98],
  ["XL", "bust", 94, 96],
  ["XL", "waist", 76, 78],
  ["XL", "hip", 100, 102],
];

async function ensureDefaultSizeChart() {
  const existingCharts = await db.select().from(s.sizeCharts).limit(1);
  if (existingCharts[0]) {
    const products = await db.select({ id: s.products.id, sizeChartId: s.products.sizeChartId }).from(s.products);
    for (const p of products) {
      if (!p.sizeChartId) {
        await db.update(s.products).set({ sizeChartId: existingCharts[0].id }).where(eq(s.products.id, p.id));
      }
    }
    return existingCharts[0];
  }

  const sizeRows = await db.select().from(s.sizes);
  const sizeByCode = Object.fromEntries(sizeRows.map((x) => [x.code, x]));

  const [chart] = await db
    .insert(s.sizeCharts)
    .values({
      name: "Bảng size tiêu chuẩn nữ",
      unit: "cm",
      instructions:
        "Đo vòng ngực tại điểm rộng nhất, vòng eo tại điểm nhỏ nhất, vòng mông tại điểm rộng nhất. Đối chiếu với bảng dưới (đơn vị cm).",
    })
    .returning();

  for (const [sizeCode, measCode, min, max] of DEFAULT_CHART_MEAS) {
    const size = sizeByCode[sizeCode];
    if (!size) continue;
    await db.insert(s.sizeChartMeasurements).values({
      sizeChartId: chart!.id,
      sizeId: size.id,
      measurementCode: measCode,
      minValue: String(min),
      maxValue: String(max),
    });
  }

  const products = await db.select({ id: s.products.id, sizeChartId: s.products.sizeChartId }).from(s.products);
  for (const p of products) {
    if (!p.sizeChartId) {
      await db.update(s.products).set({ sizeChartId: chart!.id }).where(eq(s.products.id, p.id));
    }
  }

  return chart!;
}

async function ensureCustomerModule() {
  for (const [code, description] of [
    ["customer.read", "Xem khách hàng"],
    ["customer.write", "Sửa khách hàng"],
    ["order.read", "Xem đơn hàng"],
    ["promotion.read", "Xem mã giảm giá"],
    ["promotion.write", "Sửa mã giảm giá"],
  ] as const) {
    let perm = (await db.select().from(s.permissions).where(eq(s.permissions.code, code)).limit(1))[0];
    if (!perm) {
      [perm] = await db.insert(s.permissions).values({ code, description }).returning();
    }
    const allRoles = await db.select().from(s.roles);
    for (const r of allRoles) {
      const g = await db
        .select()
        .from(s.rolePermissions)
        .where(and(eq(s.rolePermissions.roleId, r.id), eq(s.rolePermissions.permissionId, perm!.id)))
        .limit(1);
      if (!g[0]) {
        await db.insert(s.rolePermissions).values({ roleId: r.id, permissionId: perm!.id });
      }
    }
  }
  // ponytail: no sample customers — CRM starts empty; real rows come from admin / future checkout
}

async function ensureStaffDirectory() {
  const permissionByCode = new Map<string, string>();
  for (const [code, description] of PERMS) {
    let permission = (await db.select().from(s.permissions).where(eq(s.permissions.code, code)).limit(1))[0];
    if (!permission) {
      [permission] = await db.insert(s.permissions).values({ code, description }).returning();
    }
    if (permission) permissionByCode.set(code, permission.id);
  }

  const roleByCode = new Map<string, string>();
  for (const roleSeed of STAFF_ROLE_SEEDS) {
    let role = (await db.select().from(s.roles).where(eq(s.roles.code, roleSeed.code)).limit(1))[0];
    if (!role) {
      [role] = await db.insert(s.roles).values({ code: roleSeed.code, name: roleSeed.name, isSystem: roleSeed.system }).returning();
    }
    if (role) roleByCode.set(roleSeed.code, role.id);
  }

  const existingRoles = await db.select().from(s.roles);
  for (const role of existingRoles) roleByCode.set(role.code, role.id);

  for (const [roleCode, permissionCodes] of Object.entries(STAFF_ROLE_PERMISSIONS)) {
    const roleId = roleByCode.get(roleCode);
    if (!roleId) continue;
    const desiredPermissionIds = new Set(
      permissionCodes
        .map((permissionCode) => permissionByCode.get(permissionCode))
        .filter((permissionId): permissionId is string => Boolean(permissionId)),
    );
    for (const permissionCode of permissionCodes) {
      const permissionId = permissionByCode.get(permissionCode);
      if (!permissionId) continue;
      const existingGrant = await db
        .select()
        .from(s.rolePermissions)
        .where(and(eq(s.rolePermissions.roleId, roleId), eq(s.rolePermissions.permissionId, permissionId)))
        .limit(1);
      if (!existingGrant[0]) await db.insert(s.rolePermissions).values({ roleId, permissionId });
    }

    // Keep seeded roles exact. This removes stale grants left by an older seed,
    // e.g. promotion.write accidentally remaining on sales_staff.
    const existingGrants = await db
      .select({ permissionId: s.rolePermissions.permissionId })
      .from(s.rolePermissions)
      .where(eq(s.rolePermissions.roleId, roleId));
    for (const grant of existingGrants) {
      if (!desiredPermissionIds.has(grant.permissionId)) {
        await db.delete(s.rolePermissions).where(
          and(eq(s.rolePermissions.roleId, roleId), eq(s.rolePermissions.permissionId, grant.permissionId)),
        );
      }
    }
  }

  const passwordHash = await bcrypt.hash("Trang1234@", 10);
  const adminEmployee = (await db.select().from(s.employees).where(eq(s.employees.employeeCode, "ELN001")).limit(1))[0];
  if (adminEmployee) {
    await db.update(s.accounts).set({ passwordHash, updatedAt: new Date() }).where(eq(s.accounts.id, adminEmployee.accountId));
    if (!adminEmployee.avatarUrl) {
      await db.update(s.employees).set({ avatarUrl: "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?w=160&h=160&fit=crop&crop=face&q=85", updatedAt: new Date() }).where(eq(s.employees.id, adminEmployee.id));
    }
  }
  for (const seed of STAFF_SEEDS) {
    let account = (await db.select().from(s.accounts).where(eq(s.accounts.email, seed.email)).limit(1))[0];
    if (!account) {
      [account] = await db.insert(s.accounts).values({
        authSubject: `local:${seed.email}`,
        email: seed.email,
        passwordHash,
        status: seed.status === "active" ? "active" : "locked",
      }).returning();
    } else {
      [account] = await db.update(s.accounts).set({
        passwordHash,
        status: seed.status === "active" ? "active" : "locked",
        updatedAt: new Date(),
      }).where(eq(s.accounts.id, account.id)).returning();
    }
    if (!account) continue;

    let employee = (await db.select().from(s.employees).where(eq(s.employees.employeeCode, seed.code)).limit(1))[0];
    if (!employee) {
      [employee] = await db.insert(s.employees).values({
        accountId: account.id,
        employeeCode: seed.code,
        fullName: seed.name,
        avatarUrl: seed.avatarUrl,
        workEmail: seed.email,
        jobTitle: seed.title,
        status: seed.status,
      }).returning();
    } else if (!employee.avatarUrl) {
      [employee] = await db.update(s.employees).set({ avatarUrl: seed.avatarUrl, updatedAt: new Date() }).where(eq(s.employees.id, employee.id)).returning();
    }
    if (!employee) continue;

    const roleId = roleByCode.get(seed.role);
    if (!roleId) continue;
    const existingGrant = await db
      .select()
      .from(s.employeeRoleGrants)
      .where(and(eq(s.employeeRoleGrants.employeeId, employee.id), eq(s.employeeRoleGrants.roleId, roleId)))
      .limit(1);
    if (!existingGrant[0]) {
      await db.insert(s.employeeRoleGrants).values({ employeeId: employee.id, roleId, scopeType: "all" });
    }
  }

  console.log(`Ensured ${STAFF_SEEDS.length} staff accounts, ${STAFF_ROLE_SEEDS.length + 2} roles and permission grants.`);
}

type Raw = [string, string, number, number | undefined, string[], string, string, boolean?, boolean?];

const RAW: Raw[] = [
  ["Đầm lụa hai dây Noir", "vay-dam", 1890000, undefined, ["den", "kem"], "Lụa satin", "du-tiec", true, true],
  ["Đầm midi cổ đổ Sienna", "vay-dam", 1650000, 1320000, ["den", "nau"], "Satin cao cấp", "du-tiec"],
  ["Đầm suông linen Aurora", "vay-dam", 1290000, undefined, ["kem", "be"], "Linen", "casual", true],
  ["Đầm công sở chữ A Clara", "vay-dam", 1450000, undefined, ["den", "be"], "Tweed pha", "cong-so", false, true],
  ["Áo sơ mi lụa Ivory", "ao", 990000, undefined, ["trang", "kem"], "Lụa tơ tằm", "cong-so", true, true],
  ["Áo kiểu cổ nơ Belle", "ao", 850000, 680000, ["kem", "den"], "Chiffon", "cong-so"],
  ["Áo len gân Cashmere Soft", "ao", 1190000, undefined, ["be", "kem"], "Len cashmere pha", "casual", true],
  ["Áo tank top Essential", "ao", 390000, undefined, ["trang", "den"], "Cotton gân", "casual", false, true],
  ["Quần linen ống rộng Dune", "quan", 1150000, undefined, ["be", "kem"], "Linen", "casual", true, true],
  ["Quần âu cạp cao Tailored", "quan", 1090000, 870000, ["den", "be"], "Wool pha", "cong-so"],
  ["Quần suông xếp ly Mira", "quan", 990000, undefined, ["kem", "den"], "Tuýt si", "cong-so"],
  ["Chân váy xếp ly Champagne", "chan-vay", 1050000, undefined, ["be", "den"], "Satin", "du-tiec", true, true],
  ["Chân váy midi bút chì Vera", "chan-vay", 890000, 710000, ["den", "nau"], "Tuýt si", "cong-so"],
  ["Set tweed Parisienne", "set-bo", 2490000, undefined, ["kem"], "Tweed", "du-tiec", true, true],
  ["Set blazer & quần Monochrome", "set-bo", 2690000, 2150000, ["den", "be"], "Wool pha", "cong-so"],
  ["Blazer oversize Noir", "ao-khoac", 1990000, undefined, ["den", "be"], "Wool pha", "cong-so", true, true],
  ["Áo khoác dạ dáng dài Camel", "ao-khoac", 3290000, undefined, ["be", "nau"], "Dạ lông cừu", "casual", true],
  ["Trench coat cổ điển", "ao-khoac", 2790000, 2230000, ["be"], "Cotton gabardine", "casual"],
  ["Túi xách tay Mini Lune", "phu-kien", 1490000, undefined, ["kem", "den"], "Da thật", "du-tiec", true, true],
  ["Khuyên tai ngọc trai Perle", "phu-kien", 490000, 390000, ["trang"], "Ngọc trai nhân tạo", "du-tiec"],
];

async function ensureElaneWomanPosts() {
  try {
    const existing = await db.select().from(s.elaneWomanPosts).limit(1);
    if (existing.length > 0) return;

    const prods = await db.select().from(s.products).where(eq(s.products.status, "published")).limit(10);
    const samplePosts = [
      {
        title: "ÉLANE lookbook · La Parisienne",
        imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
        sortOrder: 1,
        status: "published",
        productId: prods[0]?.id ?? null,
        linkUrl: prods[0] ? `/san-pham/${prods[0].slug}` : null,
        instagramUrl: "https://instagram.com/elane.official",
      },
      {
        title: "Autumn Elegance · Bộ sưu tập Thu Đông",
        imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop&q=80",
        sortOrder: 2,
        status: "published",
        productId: prods[1]?.id ?? null,
        linkUrl: prods[1] ? `/san-pham/${prods[1].slug}` : null,
        instagramUrl: "https://instagram.com/elane.official",
      },
      {
        title: "Urban Chic · Quý cô công sở",
        imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80",
        sortOrder: 3,
        status: "published",
        productId: prods[2]?.id ?? null,
        linkUrl: prods[2] ? `/san-pham/${prods[2].slug}` : null,
        instagramUrl: "https://instagram.com/elane.official",
      },
      {
        title: "Satin Mood · Đầm lụa dạ tiệc",
        imageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&auto=format&fit=crop&q=80",
        sortOrder: 4,
        status: "published",
        productId: prods[3]?.id ?? null,
        linkUrl: prods[3] ? `/san-pham/${prods[3].slug}` : null,
        instagramUrl: "https://instagram.com/elane.official",
      },
      {
        title: "Minimalist Modern · Tinh giản & Sang trọng",
        imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=80",
        sortOrder: 5,
        status: "published",
        productId: prods[4]?.id ?? null,
        linkUrl: prods[4] ? `/san-pham/${prods[4].slug}` : null,
        instagramUrl: "https://instagram.com/elane.official",
      },
      {
        title: "Cozy Cashmere · Ấm áp ngày se lạnh",
        imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=80",
        sortOrder: 6,
        status: "published",
        productId: prods[5]?.id ?? null,
        linkUrl: prods[5] ? `/san-pham/${prods[5].slug}` : null,
        instagramUrl: "https://instagram.com/elane.official",
      },
    ];

    await db.insert(s.elaneWomanPosts).values(samplePosts);
    console.log("Seeded 6 sample posts for elane_woman_posts.");
  } catch (err) {
    console.warn("ensureElaneWomanPosts failed:", err);
  }
}

async function ensureLookbooks() {
  try {
    const existing = await db.select().from(s.lookbooks).limit(1);
    if (existing.length > 0) return;

    const allProds = await db.select().from(s.products);
    const prodBySlug = new Map(allProds.map((p) => [p.slug, p]));

    const lookbookData = [
      {
        slug: "autumn-winter-2026",
        title: "Thu Đông 2026",
        subtitle: "Timeless femininity, redefined.",
        season: "AW26",
        description: "Gam màu camel, kem và đen — những lớp áo dạ mềm mại, len cashmere và phom dáng thanh lịch cho mùa lạnh.",
        coverImageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&auto=format&fit=crop&q=85",
        sortOrder: 1,
        status: "published",
        items: [
          {
            title: "Camel Hour",
            caption: "Áo len Cashmere Soft · Quần linen ống rộng Dune",
            imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
            productSlug: "ao-len-cashmere-soft",
            sortOrder: 1,
          },
          {
            title: "Cashmere Soft",
            caption: "Chất liệu cashmere tuyển chọn, mềm mại tựa đám mây",
            imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=80",
            productSlug: "ao-len-cashmere-soft",
            sortOrder: 2,
          },
          {
            title: "Minimal Dune",
            caption: "Quần linen cạp cao ống rộng Dune phối sơ mi tối giản",
            imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=80",
            productSlug: "quan-linen-ong-rong-dune",
            sortOrder: 3,
          },
          {
            title: "Autumn Silhouette",
            caption: "Phom dáng tự do, phóng khoáng nhưng đầy quyến rũ",
            imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop&q=80",
            productSlug: "ao-blazer-oversize-noir",
            sortOrder: 4,
          },
        ],
      },
      {
        slug: "la-parisienne",
        title: "La Parisienne",
        subtitle: "Chiều Paris, nắng nhẹ.",
        season: "Editorial",
        description: "Tweed, ngọc trai và những chi tiết vàng tinh xảo — cảm hứng từ phong cách quý cô Pháp cổ điển thanh lịch.",
        coverImageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1200&auto=format&fit=crop&q=85",
        sortOrder: 2,
        status: "published",
        items: [
          {
            title: "Parisienne Tweed",
            caption: "Set tweed Parisienne tinh tế với đường dệt thủ công sắc sảo",
            imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop&q=80",
            productSlug: "set-tweed-parisienne",
            sortOrder: 1,
          },
          {
            title: "Perle Earring",
            caption: "Khuyên tai ngọc trai Perle — điểm xuyết nét kiêu sa nhẹ nhàng",
            imageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&auto=format&fit=crop&q=80",
            productSlug: "khuyen-tai-ngoc-trai-perle",
            sortOrder: 2,
          },
          {
            title: "Café de Flore",
            caption: "Nét duyên dáng thanh lịch tại những góc phố thơ mộng",
            imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80",
            productSlug: "ao-so-mi-lua-ivory",
            sortOrder: 3,
          },
        ],
      },
      {
        slug: "the-office-edit",
        title: "The Office Edit",
        subtitle: "Quyền lực trong sự tinh tế.",
        season: "Essentials",
        description: "Blazer oversize, sơ mi lụa và quần âu — tủ đồ công sở hoàn hảo cho người phụ nữ đương đại tự tin.",
        coverImageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=85",
        sortOrder: 3,
        status: "published",
        items: [
          {
            title: "Power Blazer",
            caption: "Áo blazer oversize Noir tạo nét quyền lực mềm mại",
            imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80",
            productSlug: "ao-blazer-oversize-noir",
            sortOrder: 1,
          },
          {
            title: "Ivory Silk",
            caption: "Áo sơ mi lụa Ivory — chất liệu lụa tơ tự nhiên óng ả",
            imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&auto=format&fit=crop&q=80",
            productSlug: "ao-so-mi-lua-ivory",
            sortOrder: 2,
          },
          {
            title: "Modern Tailoring",
            caption: "Cắt may sắc sảo tôn lên vóc dáng thanh mảnh",
            imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=80",
            productSlug: "quan-linen-ong-rong-dune",
            sortOrder: 3,
          },
        ],
      },
      {
        slug: "evening-noir",
        title: "Evening Noir",
        subtitle: "Khi màn đêm buông xuống.",
        season: "Holiday",
        description: "Lụa satin và những đường cắt tối giản cho các buổi tiệc tối sang trọng và quyến rũ.",
        coverImageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1200&auto=format&fit=crop&q=85",
        sortOrder: 4,
        status: "published",
        items: [
          {
            title: "Silk Slip Dress",
            caption: "Đầm lụa hai dây Noir — gợi cảm trong sự tiết chế đỉnh cao",
            imageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&auto=format&fit=crop&q=80",
            productSlug: "dam-lua-hai-day-noir",
            sortOrder: 1,
          },
          {
            title: "Champagne Glow",
            caption: "Chân váy xếp ly Champagne bắt sáng lung linh dưới ánh đèn tiệc",
            imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
            productSlug: "chan-vay-xep-ly-champagne",
            sortOrder: 2,
          },
        ],
      },
    ];

    for (const lb of lookbookData) {
      const [inserted] = await db
        .insert(s.lookbooks)
        .values({
          slug: lb.slug,
          title: lb.title,
          subtitle: lb.subtitle,
          description: lb.description,
          season: lb.season,
          coverImageUrl: lb.coverImageUrl,
          sortOrder: lb.sortOrder,
          status: lb.status,
        })
        .returning();

      if (inserted && lb.items.length) {
        const itemValues = lb.items.map((it) => {
          const matchedProd = it.productSlug ? prodBySlug.get(it.productSlug) : null;
          return {
            lookbookId: inserted.id,
            title: it.title,
            caption: it.caption,
            imageUrl: it.imageUrl,
            productId: matchedProd?.id ?? null,
            linkUrl: matchedProd ? `/san-pham/${matchedProd.slug}` : null,
            sortOrder: it.sortOrder,
            status: "published",
          };
        });
        await db.insert(s.lookbookItems).values(itemValues);
      }
    }

    console.log("Seeded 4 editorial lookbooks with lookbook items.");
  } catch (err) {
    console.warn("ensureLookbooks failed:", err);
  }
}

async function main() {
  const existing = await db.select().from(s.accounts).where(eq(s.accounts.email, "admin@elane.local")).limit(1);
  if (existing.length) {
    await ensureDefaultSizeChart();
    await ensureCustomerModule();
    await ensureStaffDirectory();
    await ensureElaneWomanPosts();
    await ensureLookbooks();
    console.log("Seed already applied (admin exists). Ensured size chart + customer perms + staff directory + elane woman + lookbooks. Skipping full seed.");
    process.exit(0);
  }

  const permRows = await db
    .insert(s.permissions)
    .values(PERMS.map(([code, description]) => ({ code, description })))
    .returning();
  const permByCode = Object.fromEntries(permRows.map((p) => [p.code, p.id]));

  const [ownerRole] = await db
    .insert(s.roles)
    .values({ code: "system_owner", name: "Chủ hệ thống", isSystem: true })
    .returning();
  const [opsRole] = await db
    .insert(s.roles)
    .values({ code: "ops_manager", name: "Quản lý vận hành", isSystem: true })
    .returning();

  await db.insert(s.rolePermissions).values(
    PERMS.map(([code]) => ({ roleId: ownerRole!.id, permissionId: permByCode[code]! })),
  );
  const opsPerms = PERMS.filter(([c]) => !c.startsWith("role.") && c !== "staff.manage").map(([c]) => c);
  await db.insert(s.rolePermissions).values(
    opsPerms.map((code) => ({ roleId: opsRole!.id, permissionId: permByCode[code]! })),
  );

  const hash = await bcrypt.hash("Trang1234@", 10);
  const [adminAccount] = await db
    .insert(s.accounts)
    .values({
      authSubject: "local:admin@elane.local",
      email: "admin@elane.local",
      passwordHash: hash,
      status: "active",
    })
    .returning();

  const [adminEmp] = await db
    .insert(s.employees)
    .values({
      accountId: adminAccount!.id,
      employeeCode: "ELN001",
      fullName: "ÉLANE Admin",
      workEmail: "admin@elane.local",
      jobTitle: "Chủ hệ thống",
      status: "active",
    })
    .returning();

  await db.insert(s.employeeRoleGrants).values({
    employeeId: adminEmp!.id,
    roleId: ownerRole!.id,
    scopeType: "all",
  });

  await ensureStaffDirectory();

  const [wh] = await db
    .insert(s.warehouses)
    .values({ code: "MAIN", name: "Kho chính", status: "active", address: { city: "HCM" } })
    .returning();

  const catRows = await db
    .insert(s.categories)
    .values(CATEGORIES.map(([slug, name, description], i) => ({ slug, name, description, sortOrder: i, status: "active" })))
    .returning();
  const catBySlug = Object.fromEntries(catRows.map((c) => [c.slug, c]));

  for (const [parentSlug, kids] of Object.entries(CATEGORY_CHILDREN)) {
    const parent = catBySlug[parentSlug]!;
    const childRows = await db
      .insert(s.categories)
      .values(
        kids.map(([slug, name], i) => ({
          slug,
          name,
          parentId: parent.id,
          sortOrder: i,
          status: "active" as const,
          description: null,
        })),
      )
      .returning();
    for (const c of childRows) catBySlug[c.slug] = c;
  }

  const occRows = await db
    .insert(s.occasions)
    .values(OCCASIONS.map(([code, name, slug]) => ({ code, name, slug })))
    .returning();
  const occBySlug = Object.fromEntries(occRows.map((o) => [o.slug, o]));

  await db
    .insert(s.colors)
    .values(COLORS.map(([code, name, hex]) => ({ code, name, hex })));

  const sizeRows = await db
    .insert(s.sizes)
    .values(SIZES.map(([code, label, sortOrder]) => ({ code, label, sortOrder })))
    .returning();
  const sizeByCode = Object.fromEntries(sizeRows.map((x) => [x.code, x]));

  const [defaultChart] = await db
    .insert(s.sizeCharts)
    .values({
      name: "Bảng size tiêu chuẩn nữ",
      unit: "cm",
      instructions:
        "Đo vòng ngực tại điểm rộng nhất, vòng eo tại điểm nhỏ nhất, vòng mông tại điểm rộng nhất. Đối chiếu với bảng dưới (đơn vị cm).",
    })
    .returning();
  for (const [sizeCode, measCode, min, max] of DEFAULT_CHART_MEAS) {
    const size = sizeByCode[sizeCode];
    if (!size) continue;
    await db.insert(s.sizeChartMeasurements).values({
      sizeChartId: defaultChart!.id,
      sizeId: size.id,
      measurementCode: measCode,
      minValue: String(min),
      maxValue: String(max),
    });
  }

  await db.insert(s.settings).values({
    key: "brand",
    value: {
      name: "ÉLANE",
      tagline: "Modern Femininity",
      freeShippingFromVnd: 1000000,
    },
    visibility: "public",
    updatedBy: adminAccount!.id,
  });

  await db.insert(s.faqs).values([
    {
      groupName: "Đơn hàng",
      question: "Thời gian giao hàng bao lâu?",
      answer: "Nội thành 1–3 ngày; tỉnh thành 3–5 ngày làm việc.",
      sortOrder: 1,
      status: "published",
    },
    {
      groupName: "Đổi trả",
      question: "Chính sách đổi trả?",
      answer: "Đổi trả trong 30 ngày với sản phẩm còn tem mác.",
      sortOrder: 1,
      status: "published",
    },
  ]);

  const [homePage] = await db
    .insert(s.contentPages)
    .values({
      slug: "home",
      type: "home",
      title: "Trang chủ",
      status: "published",
      seoTitle: "ÉLANE — Modern Femininity",
    })
    .returning();

  const [homeRev] = await db
    .insert(s.contentRevisions)
    .values({
      pageId: homePage!.id,
      versionNo: 1,
      blocks: { heroTitle: "Autumn / Winter 2026", heroSubtitle: "Modern Femininity" },
      createdBy: adminAccount!.id,
      publishedAt: new Date(),
    })
    .returning();

  await db
    .update(s.contentPages)
    .set({ publishedRevisionId: homeRev!.id })
    .where(eq(s.contentPages.id, homePage!.id));

  for (const [name, catSlug, price, salePrice, colorCodes, material, occSlug, isNew, bestSeller] of RAW) {
    const slug = slugify(name);
    const leafSlug = LEAF_FOR_ROOT[catSlug] ?? catSlug;
    const cat = catBySlug[leafSlug]!;
    const occ = occBySlug[occSlug]!;
    const [product] = await db
      .insert(s.products)
      .values({
        name,
        slug,
        description: `${name} là thiết kế đặc trưng của ÉLANE — chất liệu ${material.toLowerCase()}.`,
        material,
        primaryCategoryId: cat.id,
        sizeChartId: catSlug === "phu-kien" ? null : defaultChart!.id,
        status: "published",
        publishedAt: new Date(),
        newUntil: isNew ? new Date(Date.now() + 90 * 86400000) : null,
        isBestSeller: !!bestSeller,
      })
      .returning();

    await db.insert(s.productCategories).values({ productId: product!.id, categoryId: cat.id });
    await db.insert(s.productOccasions).values({ productId: product!.id, occasionId: occ.id });

    const sizeCodes = catSlug === "phu-kien" ? ["ONE_SIZE"] : ["XS", "S", "M", "L", "XL"];
    const colorwayByCode = new Map<string, string>();
    for (let i = 0; i < colorCodes.length; i++) {
      const cc = colorCodes[i]!;
      const [cw] = await db
        .insert(s.productColorways)
        .values({ productId: product!.id, sortOrder: i })
        .returning();
      colorwayByCode.set(cc, cw!.id);
    }
    for (const cc of colorCodes) {
      for (const sc of sizeCodes) {
        const colorwayId = colorwayByCode.get(cc)!;
        const size = sizeByCode[sc]!;
        const sku = `${slug.toUpperCase().slice(0, 12)}-${cc.toUpperCase()}-${sc}`.replace(/[^A-Z0-9-]/g, "");
        const [variant] = await db
          .insert(s.productVariants)
          .values({
            productId: product!.id,
            sku,
            colorwayId,
            sizeId: size.id,
            priceVnd: salePrice ?? price,
            compareAtPriceVnd: salePrice ? price : null,
            costVnd: Math.round((salePrice ?? price) * 0.45),
            status: "active",
          })
          .returning();

        await db.insert(s.inventoryBalances).values({
          warehouseId: wh!.id,
          variantId: variant!.id,
          onHand: 10,
          reserved: 0,
          reorderPoint: 3,
        });
      }
    }
  }

  const [draft] = await db
    .insert(s.products)
    .values({
      name: "Đầm nháp (không public)",
      slug: "dam-nhap-khong-public",
      description: "Draft only",
      material: "Test",
      primaryCategoryId: catBySlug["dam-suong"]!.id,
      status: "draft",
    })
    .returning();
  await db.insert(s.productCategories).values({ productId: draft!.id, categoryId: catBySlug["dam-suong"]!.id });

  await ensureCustomerModule();
  await ensureElaneWomanPosts();

  console.log("Seed complete. All employee accounts use the default password Trang1234@.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
