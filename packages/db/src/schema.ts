import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const id = () => uuid("id").defaultRandom().primaryKey();
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

// --- Identity / staff ---
export const accounts = pgTable("accounts", {
  id: id(),
  authSubject: text("auth_subject").notNull().unique(),
  email: text("email").unique(),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  status: text("status").notNull().default("active"), // active|locked
  lastLoginAt: ts("last_login_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const accountSessions = pgTable("account_sessions", {
  id: id(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
  deviceLabel: text("device_label"),
  createdAt: createdAt(),
});

export const departments = pgTable("departments", {
  id: id(),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const employees = pgTable("employees", {
  id: id(),
  accountId: uuid("account_id")
    .references(() => accounts.id)
    .unique(),
  employeeCode: text("employee_code").notNull().unique(),
  fullName: text("full_name").notNull(),
  workEmail: text("work_email"),
  phone: text("phone"),
  departmentId: uuid("department_id").references(() => departments.id),
  jobTitle: text("job_title"),
  managerId: uuid("manager_id"),
  joinedOn: ts("joined_on").notNull().defaultNow(),
  leftOn: ts("left_on"),
  status: text("status").notNull().default("active"), // active|left|locked
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const roles = pgTable("roles", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const permissions = pgTable("permissions", {
  id: id(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  createdAt: createdAt(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const employeeRoleGrants = pgTable("employee_role_grants", {
  id: id(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  scopeType: text("scope_type").notNull().default("all"), // all|warehouse|store|assigned
  warehouseId: uuid("warehouse_id"),
  storeId: uuid("store_id"),
  expiresAt: ts("expires_at"),
  createdAt: createdAt(),
});

// --- Catalog ---
export const categories = pgTable("categories", {
  id: id(),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("active"),
  description: text("description"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const occasions = pgTable("occasions", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: createdAt(),
});

export const sizeCharts = pgTable("size_charts", {
  id: id(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("cm"),
  instructions: text("instructions"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const products = pgTable("products", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  material: text("material"),
  careInstructions: text("care_instructions"),
  primaryCategoryId: uuid("primary_category_id")
    .notNull()
    .references(() => categories.id),
  sizeChartId: uuid("size_chart_id").references(() => sizeCharts.id),
  status: text("status").notNull().default("draft"), // draft|published|archived
  publishedAt: ts("published_at"),
  newUntil: ts("new_until"),
  isBestSeller: boolean("is_best_seller").notNull().default(false),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const productCategories = pgTable(
  "product_categories",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] })],
);

export const productOccasions = pgTable(
  "product_occasions",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    occasionId: uuid("occasion_id")
      .notNull()
      .references(() => occasions.id),
  },
  (t) => [primaryKey({ columns: [t.productId, t.occasionId] })],
);

export const colors = pgTable("colors", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  hex: text("hex"),
  createdAt: createdAt(),
});

export const sizes = pgTable("sizes", {
  id: id(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const sizeChartMeasurements = pgTable(
  "size_chart_measurements",
  {
    id: id(),
    sizeChartId: uuid("size_chart_id")
      .notNull()
      .references(() => sizeCharts.id),
    sizeId: uuid("size_id")
      .notNull()
      .references(() => sizes.id),
    measurementCode: text("measurement_code").notNull(),
    minValue: numeric("min_value").notNull(),
    maxValue: numeric("max_value").notNull(),
  },
  (t) => [uniqueIndex("size_chart_meas_uq").on(t.sizeChartId, t.sizeId, t.measurementCode)],
);

export const productColorways = pgTable("product_colorways", {
  id: id(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    sku: text("sku").notNull().unique(),
    barcode: text("barcode").unique(),
    colorwayId: uuid("colorway_id")
      .notNull()
      .references(() => productColorways.id),
    sizeId: uuid("size_id")
      .notNull()
      .references(() => sizes.id),
    priceVnd: bigint("price_vnd", { mode: "number" }).notNull(),
    compareAtPriceVnd: bigint("compare_at_price_vnd", { mode: "number" }),
    costVnd: bigint("cost_vnd", { mode: "number" }),
    weightG: integer("weight_g"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("variant_pcs_uq").on(t.productId, t.colorwayId, t.sizeId)],
);

export const mediaAssets = pgTable("media_assets", {
  id: id(),
  objectKey: text("object_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  bytes: integer("bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  altText: text("alt_text"),
  uploadedBy: uuid("uploaded_by").references(() => accounts.id),
  createdAt: createdAt(),
});

export const productMedia = pgTable("product_media", {
  id: id(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => mediaAssets.id),
  colorwayId: uuid("colorway_id").references(() => productColorways.id),
  sortOrder: integer("sort_order").notNull().default(0),
  isCover: boolean("is_cover").notNull().default(false),
  createdAt: createdAt(),
});

export const collections = pgTable("collections", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  coverAssetId: uuid("cover_asset_id").references(() => mediaAssets.id),
  status: text("status").notNull().default("draft"),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const collectionProducts = pgTable(
  "collection_products",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.productId] })],
);

// --- Inventory ---
export const warehouses = pgTable("warehouses", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  address: jsonb("address"),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    reorderPoint: integer("reorder_point").notNull().default(5),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.warehouseId, t.variantId] })],
);

export const inventoryDocuments = pgTable("inventory_documents", {
  id: id(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(), // receipt|issue|adjustment
  status: text("status").notNull().default("draft"), // draft|approved|posted|void
  sourceWarehouseId: uuid("source_warehouse_id").references(() => warehouses.id),
  targetWarehouseId: uuid("target_warehouse_id").references(() => warehouses.id),
  reason: text("reason").notNull().default(""),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => accounts.id),
  approvedBy: uuid("approved_by").references(() => accounts.id),
  postedAt: ts("posted_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const inventoryDocumentLines = pgTable("inventory_document_lines", {
  id: id(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => inventoryDocuments.id),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariants.id),
  qty: integer("qty").notNull(),
  unitCostVnd: bigint("unit_cost_vnd", { mode: "number" }),
  direction: text("direction").notNull().default("in"), // in|out for adjustments
  createdAt: createdAt(),
});

export const stockMovements = pgTable("stock_movements", {
  id: id(),
  documentLineId: uuid("document_line_id").references(() => inventoryDocumentLines.id),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariants.id),
  deltaQty: integer("delta_qty").notNull(),
  unitCostVnd: bigint("unit_cost_vnd", { mode: "number" }),
  operationKey: text("operation_key").notNull().unique(),
  createdAt: createdAt(),
});

// --- Customers (Phase2-light) ---
export const customers = pgTable(
  "customers",
  {
    id: id(),
    accountId: uuid("account_id").references(() => accounts.id),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    segment: text("segment").notNull().default("new"), // new|loyal|vip — derived from total_spent_vnd
    status: text("status").notNull().default("active"), // active|blocked
    totalSpentVnd: bigint("total_spent_vnd", { mode: "number" }).notNull().default(0),
    internalNote: text("internal_note").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("customers_account_id_uidx").on(t.accountId)],
);

export const customerAddresses = pgTable("customer_addresses", {
  id: id(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  recipientName: text("recipient_name").notNull(),
  phone: text("phone").notNull(),
  addressLine: text("address_line").notNull(),
  administrativeUnits: jsonb("administrative_units").$type<Record<string, string>>().notNull().default({}),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
});

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.productId] })],
);

export const orders = pgTable("orders", {
  id: id(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  status: text("status").notNull().default("pending"), // pending|confirmed|cancelled
  currency: text("currency").notNull().default("VND"),
  subtotalVnd: integer("subtotal_vnd").notNull(),
  shippingVnd: integer("shipping_vnd").notNull().default(0),
  discountVnd: integer("discount_vnd").notNull().default(0),
  grandTotalVnd: integer("grand_total_vnd").notNull(),
  paymentMethod: text("payment_method").notNull(), // cod|bank|card|wallet
  recipientSnapshot: jsonb("recipient_snapshot").$type<Record<string, string>>().notNull(),
  shippingAddressSnapshot: jsonb("shipping_address_snapshot").$type<Record<string, string>>().notNull(),
  placedAt: ts("placed_at").notNull().defaultNow(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => productVariants.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  sku: text("sku").notNull(),
  productName: text("product_name").notNull(),
  sizeLabel: text("size_label").notNull(),
  colorLabel: text("color_label"),
  unitPriceVnd: integer("unit_price_vnd").notNull(),
  qty: integer("qty").notNull(),
  lineTotalVnd: integer("line_total_vnd").notNull(),
});

// --- CMS / system ---
export const contentPages = pgTable("content_pages", {
  id: id(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(), // home|about|policy|faq_landing|static
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  publishedRevisionId: uuid("published_revision_id"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: id(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => contentPages.id),
    versionNo: integer("version_no").notNull(),
    blocks: jsonb("blocks").notNull().default({}),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => accounts.id),
    approvedBy: uuid("approved_by").references(() => accounts.id),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("page_version_uq").on(t.pageId, t.versionNo)],
);

export const banners = pgTable("banners", {
  id: id(),
  placement: text("placement").notNull().default("home_hero"),
  desktopAssetId: uuid("desktop_asset_id").references(() => mediaAssets.id),
  mobileAssetId: uuid("mobile_asset_id").references(() => mediaAssets.id),
  title: text("title"),
  ctaLabel: text("cta_label"),
  targetUrl: text("target_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  status: text("status").notNull().default("draft"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const faqs = pgTable("faqs", {
  id: id(),
  groupName: text("group_name").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("published"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const settings = pgTable("settings", {
  id: id(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  visibility: text("visibility").notNull().default("internal"),
  updatedBy: uuid("updated_by").references(() => accounts.id),
  updatedAt: updatedAt(),
});

export const seoRedirects = pgTable("seo_redirects", {
  id: id(),
  oldPath: text("old_path").notNull().unique(),
  newPath: text("new_path").notNull(),
  statusCode: integer("status_code").notNull().default(301),
  createdAt: createdAt(),
});

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  actorAccountId: uuid("actor_account_id").references(() => accounts.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  beforeRedacted: jsonb("before_redacted"),
  afterRedacted: jsonb("after_redacted"),
  requestId: text("request_id").notNull(),
  occurredAt: ts("occurred_at").notNull().defaultNow(),
});

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: id(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    resourceId: text("resource_id"),
    responseStatus: integer("response_status"),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("idempotency_scope_key_uq").on(t.scope, t.key)],
);
