import { createDb } from "./client.js";
import { discountCodes, accounts, categories, products } from "./schema.js";
import { eq } from "drizzle-orm";

const db = createDb(process.env.DATABASE_URL ?? "postgres://elane:elane@localhost:5432/elane");

async function seedPromotions() {
  console.log("Seeding discount codes...");

  // Find admin account
  const admin = await db.query.accounts?.findFirst({
    where: eq(accounts.role, "admin"),
  }).catch(() => null);

  const adminId = admin?.id ?? null;

  // Query some real category IDs
  const allCategories = await db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories);
  const quanCat = allCategories.find(c => c.slug.includes("quan") && !c.slug.includes("quan-lot"));
  const phuKienCat = allCategories.find(c => c.slug.includes("phu-kien"));
  const nuocHoaCat = allCategories.find(c => c.slug.includes("nuoc-hoa"));

  // Query a real product
  const sampleProducts = await db.select({ id: products.id, name: products.name, slug: products.slug }).from(products).limit(2);

  const now = new Date("2026-10-17T20:30:00.000Z");

  const promoData = [
    {
      code: "ELANEWELCOME10",
      name: "Chào mừng bạn mới - Giảm 10%",
      type: "percent",
      value: 10,
      minOrderVnd: 350000,
      maxDiscountVnd: 150000,
      startsAt: new Date("2026-10-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T23:59:59.000Z"),
      usageLimit: 1000,
      usageCount: 142,
      status: "active",
      description: "Ưu đãi độc quyền dành riêng cho khách hàng đăng ký thành viên mới của ÉLANE. Giảm ngay 10% cho đơn hàng thời trang đầu tiên.",
      applyScope: "all",
      appliedProducts: [],
      appliedCategoryIds: [],
      customerGroup: "new",
      perCustomerLimit: 1,
      applyOnSale: false,
      showOnHomepage: true,
      stackable: false,
      createdById: adminId,
      updatedById: adminId,
    },
    {
      code: "VIPDIAMOND20",
      name: "Đặc quyền VIP Diamond - Giảm 20%",
      type: "percent",
      value: 20,
      minOrderVnd: 1500000,
      maxDiscountVnd: 500000,
      startsAt: new Date("2026-10-01T00:00:00.000Z"),
      endsAt: new Date("2026-11-30T23:59:59.000Z"),
      usageLimit: 500,
      usageCount: 87,
      status: "active",
      description: "Mã giảm giá 20% áp dụng cho toàn bộ thành viên hạng Kim Cương, áp dụng đồng thời với các sản phẩm đang giảm giá.",
      applyScope: "all",
      appliedProducts: [],
      appliedCategoryIds: [],
      customerGroup: "member",
      perCustomerLimit: 3,
      applyOnSale: true,
      showOnHomepage: false,
      stackable: true,
      createdById: adminId,
      updatedById: adminId,
    },
    {
      code: "FREESHIPMAX",
      name: "Miễn phí vận chuyển toàn quốc",
      type: "free_shipping",
      value: 0,
      minOrderVnd: 499000,
      maxDiscountVnd: 40000,
      startsAt: new Date("2026-10-10T00:00:00.000Z"),
      endsAt: new Date("2026-11-15T23:59:59.000Z"),
      usageLimit: 2000,
      usageCount: 418,
      status: "active",
      description: "Freeship toàn quốc tối đa 40.000đ cho mọi đơn hàng thời trang từ 499.000đ.",
      applyScope: "all",
      appliedProducts: [],
      appliedCategoryIds: [],
      customerGroup: "all",
      perCustomerLimit: 5,
      applyOnSale: true,
      showOnHomepage: true,
      stackable: true,
      createdById: adminId,
      updatedById: adminId,
    },
    {
      code: "TRIAN50K",
      name: "Tri ân khách hàng thân thiết - Giảm 50K",
      type: "fixed",
      value: 50000,
      minOrderVnd: 399000,
      maxDiscountVnd: 50000,
      startsAt: new Date("2026-10-05T00:00:00.000Z"),
      endsAt: new Date("2026-10-28T23:59:59.000Z"),
      usageLimit: 300,
      usageCount: 198,
      status: "active",
      description: "Voucher tri ân 50.000đ trực tiếp vào đơn hàng thời trang công sở và dạo phố ÉLANE.",
      applyScope: "all",
      appliedProducts: [],
      appliedCategoryIds: [],
      customerGroup: "all",
      perCustomerLimit: 1,
      applyOnSale: false,
      showOnHomepage: true,
      stackable: false,
      createdById: adminId,
      updatedById: adminId,
    },
    {
      code: "OFFICECHIC100K",
      name: "BST Quần & Quần Âu Cao Cấp - Giảm 100K",
      type: "fixed",
      value: 100000,
      minOrderVnd: 800000,
      maxDiscountVnd: 100000,
      startsAt: new Date("2026-10-12T00:00:00.000Z"),
      endsAt: new Date("2026-10-31T23:59:59.000Z"),
      usageLimit: 150,
      usageCount: 35,
      status: "active",
      description: "Ưu đãi trực tiếp 100K cho đơn hàng có sản phẩm danh mục Quần tây & Quần thiết kế cao cấp.",
      applyScope: "category",
      appliedProducts: [],
      appliedCategoryIds: quanCat ? [quanCat.id] : [],
      customerGroup: "all",
      perCustomerLimit: 2,
      applyOnSale: false,
      showOnHomepage: true,
      stackable: false,
      createdById: adminId,
      updatedById: adminId,
    },
    {
      code: "BUY1GET1PARTY",
      name: "Mua 1 Tặng 1 - Phụ Kiện & Nước Hoa ÉLANE",
      type: "bxgy",
      value: 1,
      minOrderVnd: 500000,
      maxDiscountVnd: 300000,
      startsAt: new Date("2026-10-15T00:00:00.000Z"),
      endsAt: new Date("2026-10-25T23:59:59.000Z"),
      usageLimit: 100,
      usageCount: 22,
      status: "active",
      description: "Chương trình Mua 1 Tặng 1 dành cho các dòng nước hoa quyến rũ và phụ kiện tinh tế ÉLANE.",
      applyScope: "category",
      appliedProducts: [],
      appliedCategoryIds: [phuKienCat?.id, nuocHoaCat?.id].filter(Boolean) as string[],
      customerGroup: "all",
      perCustomerLimit: 1,
      applyOnSale: false,
      showOnHomepage: true,
      stackable: false,
      createdById: adminId,
      updatedById: adminId,
    },
    {
      code: "BLACKFRIDAY2026",
      name: "Siêu Sale Black Friday 2026 - Giảm 35%",
      type: "percent",
      value: 35,
      minOrderVnd: 1000000,
      maxDiscountVnd: 1000000,
      startsAt: new Date("2026-11-20T00:00:00.000Z"),
      endsAt: new Date("2026-11-30T23:59:59.000Z"),
      usageLimit: 5000,
      usageCount: 0,
      status: "active",
      description: "Chương trình siêu sale lớn nhất năm Black Friday 2026, giảm đến 35% cho tất cả các thiết kế thời trang ÉLANE.",
      applyScope: "all",
      appliedProducts: [],
      appliedCategoryIds: [],
      customerGroup: "all",
      perCustomerLimit: 1,
      applyOnSale: true,
      showOnHomepage: false,
      stackable: false,
      createdById: adminId,
      updatedById: adminId,
    },
    {
      code: "WINTERPREVIEW",
      name: "BST Mùa Đông 2026 - Bản Nháp Ra Mắt",
      type: "fixed",
      value: 150000,
      minOrderVnd: 1200000,
      maxDiscountVnd: 150000,
      startsAt: new Date("2026-11-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-15T23:59:59.000Z"),
      usageLimit: 200,
      usageCount: 0,
      status: "draft",
      description: "Bản nháp khuyến mãi chuẩn bị cho đợt ra mắt bộ sưu tập Đông 2026 dành riêng cho hội viên ÉLANE Club.",
      applyScope: "all",
      appliedProducts: [],
      appliedCategoryIds: [],
      customerGroup: "member",
      perCustomerLimit: 1,
      applyOnSale: false,
      showOnHomepage: false,
      stackable: false,
      createdById: adminId,
      updatedById: adminId,
    },
    {
      code: "SUMMEREND2026",
      name: "Thanh Lý Cuối Hè - Giảm 25%",
      type: "percent",
      value: 25,
      minOrderVnd: 600000,
      maxDiscountVnd: 300000,
      startsAt: new Date("2026-08-15T00:00:00.000Z"),
      endsAt: new Date("2026-09-30T23:59:59.000Z"),
      usageLimit: 500,
      usageCount: 492,
      status: "active",
      description: "Đợt xả kho cuối mùa hè 2026 với ưu đãi 25% cho toàn bộ sản phẩm ngắn tay và đầm dạo phố.",
      applyScope: "all",
      appliedProducts: [],
      appliedCategoryIds: [],
      customerGroup: "all",
      perCustomerLimit: 2,
      applyOnSale: true,
      showOnHomepage: false,
      stackable: false,
      createdById: adminId,
      updatedById: adminId,
    },
    {
      code: "FLASHMIDNIGHT",
      name: "Flash Sale Nửa Đêm Áo Sơ Mi (Tạm Dừng)",
      type: "fixed",
      value: 200000,
      minOrderVnd: 1500000,
      maxDiscountVnd: 200000,
      startsAt: new Date("2026-10-16T00:00:00.000Z"),
      endsAt: new Date("2026-10-20T23:59:59.000Z"),
      usageLimit: 50,
      usageCount: 14,
      status: "paused",
      description: "Chương trình Flash Sale đặc biệt tạm dừng để điều chỉnh số lượng tồn kho sản phẩm áo sơ mi cao cấp.",
      applyScope: sampleProducts.length > 0 ? "products" : "all",
      appliedProducts: sampleProducts.length > 0 ? [
        {
          id: sampleProducts[0].id,
          name: sampleProducts[0].name,
          sku: "SM-ELANE-01",
          category: "Áo sơ mi",
        }
      ] : [],
      appliedCategoryIds: [],
      customerGroup: "all",
      perCustomerLimit: 1,
      applyOnSale: false,
      showOnHomepage: false,
      stackable: false,
      createdById: adminId,
      updatedById: adminId,
    },
  ];

  for (const promo of promoData) {
    await db
      .insert(discountCodes)
      .values(promo)
      .onConflictDoUpdate({
        target: discountCodes.code,
        set: promo,
      });
    console.log(`✓ Inserted/Updated: ${promo.code} - ${promo.name}`);
  }

  console.log("Successfully seeded 10 discount codes!");
  process.exit(0);
}

seedPromotions().catch((err) => {
  console.error("Failed to seed promotions:", err);
  process.exit(1);
});
