const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  status: string;
  parent_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
  product_count: number;
  depth?: number;
  child_count?: number;
  is_leaf?: boolean;
};

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  material: string | null;
  status: string;
  category: { slug: string; name: string } | null;
  occasion: string | null;
  size_chart: { id: string; name: string; unit: string } | null;
  is_new: boolean;
  best_seller: boolean;
  price_vnd: number;
  sale_compare_vnd: number | null;
  cost_vnd?: number | null;
  images: string[];
  media?: Array<{
    asset_id: string;
    url: string;
    alt: string | null;
    is_cover: boolean;
    colorway_id?: string | null;
  }>;
  colorways?: Array<{
    id: string;
    sort_order: number;
    thumbnail?: string | null;
    images?: string[];
  }>;
  variants: Array<{
    id: string;
    sku: string;
    price_vnd: number;
    cost_vnd?: number | null;
    status?: string;
    colorway_id?: string;
    size_id?: string;
    image_url?: string | null;
    color?: { code: string; name: string; hex?: string | null };
    size?: { code: string; label: string };
    color_name?: string;
    size_label?: string;
    on_hand?: number;
    reserved?: number;
    available?: number;
    reorder_point?: number;
  }>;
  sizes?: Array<{ code: string; label: string }>;
  colors?: Array<{ code: string; name: string; hex?: string | null }>;
  size_stocks?: Array<{ size_id: string; size_code: string; size_label: string; qty: number }>;
  stock_total?: number;
};

export type InventoryItem = {
  warehouse_id: string;
  variant_id: string;
  sku: string;
  barcode?: string | null;
  price_vnd?: number;
  cost_vnd?: number | null;
  image_url?: string | null;
  product_id: string;
  product_name: string;
  color_name: string;
  size_code: string;
  size_label: string;
  on_hand: number;
  reserved: number;
  available: number;
  reorder_point: number;
};

export type InventoryDocumentListItem = {
  id: string;
  code: string;
  type: string;
  status: string;
  reason: string;
  line_count: number;
  total_qty?: number;
  created_at: string;
  posted_at: string | null;
};

export type InventoryDocumentDetail = {
  id: string;
  code: string;
  type: string;
  status: string;
  reason: string;
  created_at: string;
  posted_at: string | null;
  requested_by: string;
  approved_by: string | null;
  lines: Array<{
    id: string;
    variant_id: string;
    product_id?: string;
    barcode?: string | null;
    image_url?: string | null;
    qty: number;
    direction: string;
    unit_cost_vnd: number | null;
    sku: string;
    product_name: string;
    color_name: string;
    size_label: string;
  }>;
};

export type ProductMeta = {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    parent_id?: string | null;
    is_leaf?: boolean;
  }>;
  colors: Array<{ id: string; code: string; name: string; hex: string | null }>;
  sizes: Array<{ id: string; code: string; label: string }>;
  size_charts: Array<{ id: string; name: string; unit: string }>;
  occasions: Array<{ id: string; code: string; name: string; slug: string }>;
};

export type SizeRow = {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  variant_count: number;
};

export type ColorRow = {
  id: string;
  code: string;
  name: string;
  hex: string | null;
  variant_count: number;
};

export type CustomerSegment = "new" | "loyal" | "vip";

export type CustomerAddress = {
  id: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  administrative_units: Record<string, string>;
  is_default: boolean;
  created_at: string;
};

export type CustomerOrderItem = {
  id: string;
  product_id?: string;
  variant_id?: string;
  sku: string;
  product_name: string;
  size_label: string | null;
  color_label?: string | null;
  image_url?: string | null;
  unit_price_vnd: number;
  qty: number;
  line_total_vnd: number;
};

export type CustomerOrderSummary = {
  id: string;
  order_number: string;
  status: string;
  grand_total_vnd: number;
  subtotal_vnd?: number;
  shipping_vnd?: number;
  discount_vnd?: number;
  discount_code?: string | null;
  payment_method: string;
  payment_status: string;
  paid_at?: string | null;
  payment_ref?: string | null;
  placed_at: string;
  fulfillment_status?: string;
  fulfilled_at?: string | null;
  inventory_doc_code?: string | null;
  items?: CustomerOrderItem[];
};

export type CustomerAnalytics = {
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  pending_orders?: number;
  total_spent_vnd: number;
  pending_spent_vnd?: number;
  cancelled_spent_vnd?: number;
  aov_vnd: number;
  first_order_at: string | null;
  last_order_at: string | null;
  days_since_last_order: number | null;
  top_sizes: Array<{ size: string; count: number }>;
  top_products: Array<{ name: string; count: number; total_vnd: number; image_url?: string | null }>;
};

export type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  segment: CustomerSegment;
  status: "active" | "blocked";
  total_spent_vnd: number;
  internal_note?: string;
  address_count?: number;
  default_address?: string | null;
  city?: string | null;
  addresses?: CustomerAddress[];
  orders?: CustomerOrderSummary[];
  analytics?: CustomerAnalytics;
  created_at: string;
  updated_at: string;
};

export type Overview = {
  published_products: number;
  draft_products: number;
  low_stock_skus: number;
  pending_inventory_docs: number;
  customer_total: number;
  customers_by_segment: Array<{ segment: string; count: number }>;
  products_by_status: Array<{ status: string; count: number }>;
  low_stock_by_category: Array<{ category_name: string; sku_count: number }>;
  inventory_docs_by_type: Array<{ type: string; count: number }>;
  recent_inventory_docs: Array<{
    id: string;
    code: string;
    type: string;
    status: string;
    created_at: string;
  }>;
};

export type SizeChart = {
  id: string;
  name: string;
  unit: string;
  instructions: string | null;
  product_count?: number;
  measurements: Array<{
    id?: string;
    size_id: string;
    size_code: string;
    size_label: string;
    measurement_code: string;
    min_value: number;
    max_value: number;
  }>;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { message?: string }).message ?? `API ${res.status}`);
  return data as T;
}

export const adminApi = {
  login: (email: string, password: string) =>
    req<{ ok: boolean }>("/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<{ ok: boolean }>("/admin/auth/logout", { method: "POST" }),
  me: () =>
    req<{
      account_id: string;
      email: string;
      full_name: string;
      permissions: string[];
    }>("/admin/auth/me"),
  overview: () => req<Overview>("/admin/overview"),
  customers: (params?: {
    segment?: string;
    status?: string;
    q?: string;
    spent_min?: number;
    spent_max?: number;
    date_from?: string;
    date_to?: string;
    city?: string;
    sort_by?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.segment) q.set("segment", params.segment);
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    if (params?.spent_min != null) q.set("spent_min", String(params.spent_min));
    if (params?.spent_max != null) q.set("spent_max", String(params.spent_max));
    if (params?.date_from) q.set("date_from", params.date_from);
    if (params?.date_to) q.set("date_to", params.date_to);
    if (params?.city) q.set("city", params.city);
    if (params?.sort_by) q.set("sort_by", params.sort_by);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return req<{ items: Customer[]; total: number; page: number; limit: number; segment_distribution: Record<string, number> }>(`/admin/customers${qs ? `?${qs}` : ""}`);
  },
  customer: (id: string) => req<Customer>(`/admin/customers/${id}`),
  createCustomer: (body: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    segment?: CustomerSegment;
    status?: "active" | "blocked";
    internal_note?: string;
  }) => req<Customer>("/admin/customers", { method: "POST", body: JSON.stringify(body) }),
  updateCustomer: (
    id: string,
    body: Partial<{
      full_name: string;
      email: string | null;
      phone: string | null;
      segment: CustomerSegment;
      status: "active" | "blocked";
      internal_note: string;
    }>,
  ) => req<Customer>(`/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  createAddress: (
    customerId: string,
    body: {
      recipient_name: string;
      phone: string;
      address_line: string;
      administrative_units?: Record<string, string>;
      is_default?: boolean;
    },
  ) =>
    req<CustomerAddress>(`/admin/customers/${customerId}/addresses`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAddress: (
    customerId: string,
    addressId: string,
    body: Partial<{
      recipient_name: string;
      phone: string;
      address_line: string;
      administrative_units: Record<string, string>;
      is_default: boolean;
    }>,
  ) =>
    req<CustomerAddress>(`/admin/customers/${customerId}/addresses/${addressId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteAddress: (customerId: string, addressId: string) =>
    req<{ ok: boolean }>(`/admin/customers/${customerId}/addresses/${addressId}`, { method: "DELETE" }),
  orders: (params?: { status?: string; q?: string; fulfillment_status?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    if (params?.fulfillment_status) q.set("fulfillment_status", params.fulfillment_status);
    const qs = q.toString();
    return req<{
      items: Array<{
        id: string;
        order_number: string;
        status: string;
        grand_total_vnd: number;
        payment_method: string;
        payment_status: string;
        paid_at: string | null;
        payment_ref: string | null;
        placed_at: string;
        customer_name: string;
        fulfillment_status: "unfulfilled" | "fulfilled" | "partial";
        fulfilled_at: string | null;
        inventory_doc_id: string | null;
        inventory_doc_code: string | null;
      }>;
    }>(`/admin/orders${qs ? `?${qs}` : ""}`);
  },
  orderDetail: (id: string) =>
    req<{
      id: string;
      order_number: string;
      status: string;
      customer: { id: string; full_name: string; email: string | null; phone: string | null } | null;
      subtotal_vnd: number;
      shipping_vnd: number;
      discount_vnd: number;
      discount_code: string | null;
      grand_total_vnd: number;
      payment_method: string;
      payment_status: string;
      paid_at: string | null;
      payment_ref: string | null;
      fulfillment_status: "unfulfilled" | "fulfilled" | "partial";
      fulfilled_at: string | null;
      inventory_doc_id: string | null;
      inventory_doc_code: string | null;
      recipient: Record<string, string> | null;
      shipping_address: Record<string, string> | null;
      placed_at: string;
      items: Array<{
        id?: string;
        product_id?: string;
        variant_id?: string;
        sku: string;
        barcode?: string | null;
        product_name: string;
        size_label: string | null;
        color_label?: string | null;
        image_url?: string | null;
        qty: number;
        unit_price_vnd: number;
        line_total_vnd: number;
      }>;
    }>(`/admin/orders/${id}`),
  patchOrder: (
    id: string,
    body: {
      status?: "pending" | "confirmed" | "cancelled";
      fulfillment_status?: "unfulfilled" | "fulfilled" | "partial";
      inventory_doc_id?: string | null;
      inventory_doc_code?: string | null;
    },
  ) =>
    req<{
      id: string;
      order_number: string;
      status: string;
      fulfillment_status: string;
      fulfilled_at: string | null;
      inventory_doc_id: string | null;
      inventory_doc_code: string | null;
    }>(`/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  fulfillOrder: (
    id: string,
    body?: {
      status?: "unfulfilled" | "fulfilled";
      inventory_doc_id?: string | null;
      inventory_doc_code?: string | null;
    },
  ) =>
    req<{
      id: string;
      order_number: string;
      status: string;
      fulfillment_status: "unfulfilled" | "fulfilled" | "partial";
      fulfilled_at: string | null;
      inventory_doc_id: string | null;
      inventory_doc_code: string | null;
    }>(`/admin/orders/${id}/fulfill`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  markOrderPaid: (id: string) =>
    req<{ id: string; order_number: string; status: string; payment_status: string }>(
      `/admin/orders/${id}/mark-paid`,
      { method: "POST" },
    ),
  products: (params?: {
    status?: string;
    q?: string;
    category_id?: string;
    occasion_slug?: string;
    price_min?: number;
    price_max?: number;
    stock?: "in" | "out" | "none";
    sort_by?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    if (params?.category_id) q.set("category_id", params.category_id);
    if (params?.occasion_slug) q.set("occasion_slug", params.occasion_slug);
    if (params?.price_min != null) q.set("price_min", String(params.price_min));
    if (params?.price_max != null) q.set("price_max", String(params.price_max));
    if (params?.stock) q.set("stock", params.stock);
    if (params?.sort_by) q.set("sort_by", params.sort_by);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return req<{
      items: AdminProduct[];
      total: number;
      page: number;
      limit: number;
      status_counts: { all: number; published: number; draft: number; archived: number };
    }>(`/admin/products${qs ? `?${qs}` : ""}`);
  },
  /** Walk pages when a caller needs the full catalog (inventory matrix, overview). */
  productsAll: async () => {
    const items: AdminProduct[] = [];
    let page = 1;
    for (;;) {
      const res = await adminApi.products({ page, limit: 100 });
      items.push(...res.items);
      if (items.length >= res.total || !res.items.length) break;
      page += 1;
    }
    return { items };
  },
  product: (id: string) => req<AdminProduct>(`/admin/products/${id}`),
  productMeta: () => req<ProductMeta>("/admin/products/meta"),
  createProduct: (body: Record<string, unknown>) =>
    req<AdminProduct>("/admin/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id: string, body: Record<string, unknown>) =>
    req<AdminProduct>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  publishProduct: (id: string) => req<AdminProduct>(`/admin/products/${id}/publish`, { method: "POST" }),
  deleteProduct: (id: string, hard = false) =>
    req<{ id: string; archived?: boolean; deleted?: boolean }>(
      `/admin/products/${id}${hard ? "?hard=1" : ""}`,
      { method: "DELETE" },
    ),
  uploadProductMedia: async (
    id: string,
    file: File,
    opts: { colorwayId: string; isCover?: boolean } | boolean = true,
  ) => {
    const colorwayId = typeof opts === "boolean" ? "" : opts.colorwayId;
    const isCover = typeof opts === "boolean" ? opts : (opts.isCover ?? true);
    if (!colorwayId) throw new Error("Thiếu colorway_id");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("colorway_id", colorwayId);
    if (isCover) fd.append("is_cover", "true");
    const res = await fetch(`${API_URL}/api/v1/admin/products/${id}/media`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { message?: string }).message ?? `API ${res.status}`);
    return data as AdminProduct;
  },
  createColorway: (productId: string, body?: { size_ids?: string[] }) =>
    req<AdminProduct>(`/admin/products/${productId}/colorways`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  deleteColorway: (productId: string, colorwayId: string) =>
    req<AdminProduct>(`/admin/products/${productId}/colorways/${colorwayId}`, { method: "DELETE" }),
  deleteProductMedia: (id: string, assetId: string) =>
    req<AdminProduct>(`/admin/products/${id}/media/${assetId}`, { method: "DELETE" }),
  categories: (status?: string) =>
    req<{ items: Category[] }>(`/admin/categories${status ? `?status=${status}` : ""}`),
  createCategory: (body: {
    name: string;
    slug?: string;
    description?: string | null;
    sort_order?: number;
    status?: "active" | "archived";
    parent_id?: string | null;
  }) => req<Category>("/admin/categories", { method: "POST", body: JSON.stringify(body) }),
  updateCategory: (
    id: string,
    body: Partial<{
      name: string;
      slug: string;
      description: string | null;
      sort_order: number;
      status: "active" | "archived";
      parent_id: string | null;
    }>,
  ) => req<Category>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCategory: (id: string, hard = false) =>
    req<{ id: string; deleted?: boolean; archived?: boolean; product_count?: number }>(
      `/admin/categories/${id}${hard ? "?hard=1" : ""}`,
      { method: "DELETE" },
    ),
  sizes: () => req<{ items: SizeRow[] }>("/admin/sizes"),
  createSize: (body: { code?: string; label: string; sort_order?: number }) =>
    req<SizeRow>("/admin/sizes", { method: "POST", body: JSON.stringify(body) }),
  updateSize: (id: string, body: Partial<{ code: string; label: string; sort_order: number }>) =>
    req<SizeRow>(`/admin/sizes/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSize: (id: string) => req<{ id: string; deleted: boolean }>(`/admin/sizes/${id}`, { method: "DELETE" }),
  colors: () => req<{ items: ColorRow[] }>("/admin/colors"),
  createColor: (body: { code?: string; name: string; hex?: string | null }) =>
    req<ColorRow>("/admin/colors", { method: "POST", body: JSON.stringify(body) }),
  updateColor: (id: string, body: Partial<{ code: string; name: string; hex: string | null }>) =>
    req<ColorRow>(`/admin/colors/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteColor: (id: string) =>
    req<{ id: string; deleted: boolean }>(`/admin/colors/${id}`, { method: "DELETE" }),
  sizeCharts: () => req<{ items: SizeChart[] }>("/admin/size-charts"),
  createSizeChart: (body: Record<string, unknown>) =>
    req<SizeChart>("/admin/size-charts", { method: "POST", body: JSON.stringify(body) }),
  updateSizeChart: (id: string, body: Record<string, unknown>) =>
    req<SizeChart>(`/admin/size-charts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSizeChart: (id: string) =>
    req<{ id: string; deleted: boolean }>(`/admin/size-charts/${id}`, { method: "DELETE" }),
  inventory: () =>
    req<{ warehouse: { id: string; code: string; name: string }; items: InventoryItem[] }>("/admin/inventory"),
  inventoryDocuments: (params?: { status?: string; type?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.type) q.set("type", params.type);
    const qs = q.toString();
    return req<{ items: InventoryDocumentListItem[] }>(
      `/admin/inventory/documents${qs ? `?${qs}` : ""}`,
    );
  },
  inventoryDocument: (id: string) =>
    req<InventoryDocumentDetail>(`/admin/inventory/documents/${id}`),
  createDoc: (body: {
    type: "receipt" | "issue" | "adjustment";
    reason?: string;
    order_id?: string;
    lines: Array<{ variant_id: string; qty: number; direction?: "in" | "out"; unit_cost_vnd?: number }>;
  }) =>
    req<{ id: string; code: string; status: string }>("/admin/inventory/documents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createInventoryDocument: (body: {
    type: "receipt" | "issue" | "adjustment";
    reason?: string;
    order_id?: string;
    lines: Array<{ variant_id: string; qty: number; direction?: "in" | "out"; unit_cost_vnd?: number }>;
  }) =>
    req<{ id: string; code: string; status: string }>("/admin/inventory/documents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  approveDoc: (id: string) =>
    req<{ id: string; status: string }>(`/admin/inventory/documents/${id}/approve`, { method: "POST" }),
  postDoc: (id: string, key: string) =>
    req<{ id: string; status: string }>(`/admin/inventory/documents/${id}/post`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
    }),
  deleteDoc: (id: string) =>
    req<{ id: string; deleted: boolean; reversed_stock: boolean }>(
      `/admin/inventory/documents/${id}`,
      { method: "DELETE" },
    ),
  staff: () => req<{ items: Array<Record<string, unknown>> }>("/admin/staff"),
  audit: () => req<{ items: Array<Record<string, unknown>> }>("/admin/audit-logs"),
  brand: () => req<{ value: Record<string, unknown> }>("/admin/settings/brand"),
  discountCodes: (params?: {
    status?: string;
    q?: string;
    type?: string;
    timing?: string;
    usage?: string;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    if (params?.type) q.set("type", params.type);
    if (params?.timing) q.set("timing", params.timing);
    if (params?.usage) q.set("usage", params.usage);
    if (params?.date_from) q.set("date_from", params.date_from);
    if (params?.date_to) q.set("date_to", params.date_to);
    if (params?.sort_by) q.set("sort_by", params.sort_by);
    const qs = q.toString();
    return req<{ items: DiscountCode[]; total: number; stats: Record<string, number> }>(`/admin/discount-codes${qs ? `?${qs}` : ""}`);
  },
  discountCode: (id: string) => req<DiscountCode>(`/admin/discount-codes/${id}`),
  createDiscountCode: (body: DiscountCodeInput) =>
    req<DiscountCode>("/admin/discount-codes", { method: "POST", body: JSON.stringify(body) }),
  patchDiscountCode: (id: string, body: Partial<DiscountCodeInput>) =>
    req<DiscountCode>(`/admin/discount-codes/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteDiscountCode: (id: string) =>
    req<DiscountCode>(`/admin/discount-codes/${id}`, { method: "DELETE" }),
  elaneWomanPosts: () => req<{ items: ElaneWomanPost[] }>("/admin/elane-woman"),
  createElaneWomanPost: (body: FormData | ElaneWomanInput) => {
    if (body instanceof FormData) {
      return fetch(`${API_URL}/api/v1/admin/elane-woman`, {
        method: "POST",
        credentials: "include",
        body,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Tạo bài đăng thất bại");
        }
        return res.json() as Promise<ElaneWomanPost>;
      });
    }
    return req<ElaneWomanPost>("/admin/elane-woman", { method: "POST", body: JSON.stringify(body) });
  },
  patchElaneWomanPost: (id: string, body: FormData | Partial<ElaneWomanInput>) => {
    if (body instanceof FormData) {
      return fetch(`${API_URL}/api/v1/admin/elane-woman/${id}`, {
        method: "PATCH",
        credentials: "include",
        body,
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Cập nhật bài đăng thất bại");
        }
        return res.json() as Promise<ElaneWomanPost>;
      });
    }
    return req<ElaneWomanPost>(`/admin/elane-woman/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  deleteElaneWomanPost: (id: string) =>
    req<{ id: string; success: boolean }>(`/admin/elane-woman/${id}`, { method: "DELETE" }),
  uploadElaneWomanImage: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/api/v1/admin/elane-woman/upload`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Upload ảnh thất bại");
    }
    return (await res.json()) as { url: string; object_key: string };
  },
  reorderElaneWomanPosts: (items: Array<{ id: string; sort_order: number }>) =>
    req<{ success: boolean; count: number }>("/admin/elane-woman/reorder", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  aiKeys: () => req<{ items: AiApiKey[] }>("/admin/ai-keys"),
  testAiKey: (rawKey: string) =>
    req<{ ok: boolean; credits?: number; error?: string; statusCode?: number }>("/admin/ai-keys/test", {
      method: "POST",
      body: JSON.stringify({ rawKey }),
    }),
  createAiKey: (body: CreateAiKeyInput) =>
    req<AiApiKey>("/admin/ai-keys", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAiKey: (id: string, body: Partial<{ label: string; priority: number; status: string; rawKey: string }>) =>
    req<AiApiKey>(`/admin/ai-keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  refreshAiKeyCredits: (id: string) =>
    req<AiApiKey>(`/admin/ai-keys/${id}/refresh`, {
      method: "POST",
    }),
  refreshAllAiKeyCredits: () =>
    req<{ items: AiApiKey[] }>("/admin/ai-keys/refresh-all", {
      method: "POST",
    }),
  deleteAiKey: (id: string) =>
    req<{ success: boolean; id: string }>(`/admin/ai-keys/${id}`, {
      method: "DELETE",
    }),
  lookbooks: () => req<{ items: AdminLookbook[] }>("/admin/lookbooks"),
  lookbook: (id: string) => req<AdminLookbook>(`/admin/lookbooks/${id}`),
  createLookbook: (body: Partial<AdminLookbook>) =>
    req<AdminLookbook>("/admin/lookbooks", { method: "POST", body: JSON.stringify(body) }),
  updateLookbook: (id: string, body: Partial<AdminLookbook>) =>
    req<AdminLookbook>(`/admin/lookbooks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteLookbook: (id: string) =>
    req<{ id: string; success: boolean }>(`/admin/lookbooks/${id}`, { method: "DELETE" }),
  reorderLookbooks: (items: Array<{ id: string; sort_order: number }>) =>
    req<{ success: boolean; count: number }>("/admin/lookbooks/reorder", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  addLookbookItem: (lookbookId: string, body: Partial<AdminLookbookItem>) =>
    req<AdminLookbookItem>(`/admin/lookbooks/${lookbookId}/items`, { method: "POST", body: JSON.stringify(body) }),
  updateLookbookItem: (itemId: string, body: Partial<AdminLookbookItem>) =>
    req<AdminLookbookItem>(`/admin/lookbooks/items/${itemId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteLookbookItem: (itemId: string) =>
    req<{ id: string; success: boolean }>(`/admin/lookbooks/items/${itemId}`, { method: "DELETE" }),
  reorderLookbookItems: (lookbookId: string, items: Array<{ id: string; sort_order: number }>) =>
    req<{ success: boolean; count: number }>(`/admin/lookbooks/${lookbookId}/items/reorder`, {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  uploadLookbookImage: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/api/v1/admin/lookbooks/upload`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Upload ảnh thất bại");
    }
    return (await res.json()) as { url: string; object_key: string };
  },
};

export type DiscountCode = {
  id: string;
  code: string;
  name: string;
  type: "percent" | "fixed" | string;
  value: number;
  min_order_vnd: number;
  max_discount_vnd: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  status: "active" | "disabled" | string;
  created_at: string;
  updated_at: string;
};

export type DiscountCodeInput = {
  code: string;
  name: string;
  type: "percent" | "fixed";
  value: number;
  min_order_vnd?: number;
  max_discount_vnd?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  usage_limit?: number | null;
  status?: "active" | "disabled";
};

export type ElaneWomanPost = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  product_id: string | null;
  instagram_url: string | null;
  sort_order: number;
  status: "published" | "draft" | string;
  created_at: string;
  updated_at: string;
  product_name?: string | null;
  product_slug?: string | null;
};

export type ElaneWomanInput = {
  title?: string | null;
  image_url?: string;
  link_url?: string | null;
  product_id?: string | null;
  instagram_url?: string | null;
  sort_order?: number;
  status?: "published" | "draft";
};

export type AiApiKey = {
  id: string;
  provider: string;
  label: string;
  maskedKey: string;
  status: "ACTIVE" | "RATE_LIMITED" | "EXHAUSTED" | "REVOKED" | "DISABLED" | string;
  creditsRemaining: number | null;
  cooldownUntil: string | null;
  priority: number;
  successCount: number;
  errorCount: number;
  lastErrorMessage: string | null;
  lastUsedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type CreateAiKeyInput = {
  provider?: string;
  label: string;
  rawKey: string;
  priority?: number;
};

export type AdminLookbookItem = {
  id: string;
  lookbook_id: string;
  title: string | null;
  caption: string | null;
  image_url: string;
  product_id: string | null;
  link_url: string | null;
  sort_order: number;
  status: "published" | "draft" | string;
  created_at: string;
  updated_at: string;
  product_name?: string | null;
  product_slug?: string | null;
  product_price?: number | null;
};

export type AdminLookbook = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  season: string | null;
  cover_image_url: string;
  sort_order: number;
  status: "published" | "draft" | "archived" | string;
  created_at: string;
  updated_at: string;
  item_count?: number;
  items?: AdminLookbookItem[];
};

export { API_URL };
