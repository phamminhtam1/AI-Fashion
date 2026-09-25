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
    status?: string;
    colorway_id?: string;
    size_id?: string;
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

export type CustomerOrderSummary = {
  id: string;
  order_number: string;
  status: string;
  grand_total_vnd: number;
  placed_at: string;
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
  addresses?: CustomerAddress[];
  orders?: CustomerOrderSummary[];
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
  customers: (params?: { segment?: string; status?: string; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.segment) q.set("segment", params.segment);
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    const qs = q.toString();
    return req<{ items: Customer[] }>(`/admin/customers${qs ? `?${qs}` : ""}`);
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
  orders: () =>
    req<{
      items: Array<{
        id: string;
        order_number: string;
        status: string;
        grand_total_vnd: number;
        payment_method: string;
        placed_at: string;
        customer_name: string;
      }>;
    }>("/admin/orders"),
  patchOrder: (id: string, body: { status: "pending" | "confirmed" | "cancelled" }) =>
    req<{ id: string; order_number: string; status: string }>(`/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  products: (params?: {
    status?: string;
    q?: string;
    category_id?: string;
    price_min?: number;
    price_max?: number;
    stock?: "in" | "out" | "none";
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.q) q.set("q", params.q);
    if (params?.category_id) q.set("category_id", params.category_id);
    if (params?.price_min != null) q.set("price_min", String(params.price_min));
    if (params?.price_max != null) q.set("price_max", String(params.price_max));
    if (params?.stock) q.set("stock", params.stock);
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
};

export { API_URL };
