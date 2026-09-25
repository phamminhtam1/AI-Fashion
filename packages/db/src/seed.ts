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
  ["product.read", "Xem sản phẩm"],
  ["product.write", "Sửa sản phẩm"],
  ["product.publish", "Xuất bản sản phẩm"],
  ["price.write", "Sửa giá"],
  ["cost.read", "Xem giá vốn"],
  ["inventory.receive", "Nhập kho"],
  ["inventory.adjust.request", "Yêu cầu điều chỉnh kho"],
  ["inventory.adjust.approve", "Duyệt điều chỉnh kho"],
  ["content.publish", "Xuất bản nội dung"],
  ["staff.manage", "Quản lý nhân viên"],
  ["role.manage", "Quản lý vai trò"],
  ["audit.read", "Xem audit"],
  ["customer.read", "Xem khách hàng"],
  ["customer.write", "Sửa khách hàng"],
] as const;

/** Spend → segment: <15M new · 15–50M loyal · >50M vip */
function segmentFromSpend(totalSpentVnd: number): "new" | "loyal" | "vip" {
  if (totalSpentVnd > 50_000_000) return "vip";
  if (totalSpentVnd >= 15_000_000) return "loyal";
  return "new";
}

const CUSTOMER_SAMPLES: Array<{
  fullName: string;
  phone: string | null;
  email: string | null;
  totalSpentVnd: number;
  status?: "active" | "blocked";
  note?: string;
  address?: { recipientName: string; phone: string; addressLine: string; city: string };
}> = [
  {
    fullName: "Trần Mai Anh",
    phone: "0901234567",
    email: "maianh@example.com",
    totalSpentVnd: 72_000_000,
    address: {
      recipientName: "Trần Mai Anh",
      phone: "0901234567",
      addressLine: "12 Nguyễn Huệ",
      city: "TP. Hồ Chí Minh",
    },
  },
  {
    fullName: "Ngọc Diễm",
    phone: "0912345678",
    email: null,
    totalSpentVnd: 28_500_000,
    address: {
      recipientName: "Ngọc Diễm",
      phone: "0912345678",
      addressLine: "45 Lê Lợi",
      city: "Hà Nội",
    },
  },
  { fullName: "Phạm Thu Hà", phone: "0923456789", email: "thuha@example.com", totalSpentVnd: 3_200_000 },
  { fullName: "Lê Khánh Linh", phone: "0934567890", email: null, totalSpentVnd: 8_900_000, note: "Gọi lại tuần sau" },
  {
    fullName: "Hoàng Minh Châu",
    phone: "0945678901",
    email: "chau@example.com",
    totalSpentVnd: 95_000_000,
    address: {
      recipientName: "Hoàng Minh Châu",
      phone: "0945678901",
      addressLine: "88 Pasteur",
      city: "TP. Hồ Chí Minh",
    },
  },
  { fullName: "Đỗ Bảo Trâm", phone: "0956789012", email: "tram@example.com", totalSpentVnd: 18_000_000 },
  { fullName: "Vũ Lan Anh", phone: "0967890123", email: null, totalSpentVnd: 0 },
  { fullName: "Bùi Thanh Tú", phone: "0978901234", email: "thanhtu@example.com", totalSpentVnd: 42_000_000 },
  {
    fullName: "Ngô Phương Thảo",
    phone: "0989012345",
    email: "thao@example.com",
    totalSpentVnd: 22_400_000,
    address: {
      recipientName: "Ngô Phương Thảo",
      phone: "0989012345",
      addressLine: "3 Trần Phú",
      city: "Đà Nẵng",
    },
  },
  { fullName: "Đặng Huyền My", phone: "0990123456", email: null, totalSpentVnd: 1_100_000, status: "blocked" },
];

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

  // Backfill spend + recompute segment for existing rows (incl. legacy "care").
  const byPhone = Object.fromEntries(CUSTOMER_SAMPLES.map((c) => [c.phone, c]));
  const existingCust = await db.select().from(s.customers);
  for (const row of existingCust) {
    const sample = row.phone ? byPhone[row.phone] : undefined;
    const spent = sample?.totalSpentVnd ?? row.totalSpentVnd ?? 0;
    const segment = segmentFromSpend(spent);
    if (row.totalSpentVnd !== spent || row.segment !== segment) {
      await db
        .update(s.customers)
        .set({ totalSpentVnd: spent, segment, updatedAt: new Date() })
        .where(eq(s.customers.id, row.id));
    }
  }

  const any = await db.select().from(s.customers).limit(1);
  if (any[0]) return;

  for (const sample of CUSTOMER_SAMPLES) {
    const segment = segmentFromSpend(sample.totalSpentVnd);
    const [row] = await db
      .insert(s.customers)
      .values({
        fullName: sample.fullName,
        phone: sample.phone,
        email: sample.email,
        segment,
        totalSpentVnd: sample.totalSpentVnd,
        status: sample.status ?? "active",
        internalNote: sample.note ?? "",
      })
      .returning();
    if (sample.address && row) {
      await db.insert(s.customerAddresses).values({
        customerId: row.id,
        recipientName: sample.address.recipientName,
        phone: sample.address.phone,
        addressLine: sample.address.addressLine,
        administrativeUnits: { city: sample.address.city },
        isDefault: true,
      });
    }
  }
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

async function main() {
  const existing = await db.select().from(s.accounts).where(eq(s.accounts.email, "admin@elane.local")).limit(1);
  if (existing.length) {
    await ensureDefaultSizeChart();
    await ensureCustomerModule();
    console.log("Seed already applied (admin exists). Ensured size chart + customers. Skipping full seed.");
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

  const hash = await bcrypt.hash("ElaneAdmin1!", 10);
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

  console.log("Seed complete. admin@elane.local / ElaneAdmin1!");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
