import { adminErrorMessage } from "@/lib/admin-language";

const API_URL = import.meta.env["VITE_API_URL"] ?? "http://localhost:3001";

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  status: string;
  parent_id: string | null;
  image_url?: string | null;
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
  total_amount_vnd?: number;
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

export type CustomerOverviewMetrics = {
  total_customers: number;
  active_customers: number;
  avg_orders_per_customer: number;
  avg_order_value_vnd: number;
  repeat_customer_rate: number;
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
  order_count?: number;
  last_order_at?: string | null;
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
  total_revenue_vnd?: number;
  total_orders?: number;
  pending_orders?: number;
  confirmed_orders?: number;
  cancelled_orders?: number;
  today_revenue_vnd?: number;
  today_orders?: number;
  orders_by_status?: Array<{ status: string; count: number }>;
  revenue_by_day?: Array<{ date: string; revenue: number; orders: number }>;
  recent_orders?: Array<{
    fulfillment_status?: string;
    id: string;
    order_number: string;
    status: string;
    grand_total_vnd: number;
    payment_method: string;
    payment_status: string;
    placed_at: string;
    customer_name: string;
  }>;
  top_selling_products?: Array<{
    product_name: string;
    total_qty: number;
    total_amount: number;
  }>;
  total_items_sold?: number;
  new_customers?: number;
  trends?: Partial<Record<"revenue" | "orders" | "customers" | "items", number>>;
  revenue_by_category?: Array<{ name: string; percent: number }>;
  top_products?: Array<{
    id: string;
    name: string;
    sku: string;
    category: string;
    sold: number;
    revenue_vnd: number;
    image_url?: string | null;
  }>;
  sales_channels?: Array<{ key: string; name: string; percent: number; orders: number }>;
  active_promotions?: Array<{
    id: string;
    name: string;
    description?: string | null;
    discount_label: string;
    start_at: string;
    end_at: string;
    status: string;
    image_url?: string | null;
  }>;
  recent_posts?: Array<{ id: string; title: string; image_url?: string | null; views: number; status: string }>;
  recent_lookbooks?: Array<{
    id: string;
    title: string;
    season?: string | null;
    views: number;
    status: string;
    cover_image_url?: string | null;
  }>;
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

export type SocialConnection = {
  id: string; instagramUserId: string; username: string; pageId?: string; status: string;
  autoReplyEnabled: boolean; tokenExpiresAt: string | null; createdAt: string;
  accountName?: string; followers?: number; following?: number; mediaCount?: number; avatarUrl?: string | null;
};
export type SocialContentItem = {
  id: string; connectionId: string | null; title: string; caption: string;
  mediaType: "IMAGE" | "CAROUSEL" | "REELS"; mediaUrls: string[]; source: string; status: string;
  scheduledAt: string | null; externalPostId: string | null; permalink: string | null;
  publishedAt: string | null; lastError: string | null; createdAt: string;
  updatedAt?: string | null;
  approvedAt?: string | null; approvedById?: string | null; approvedByName?: string | null;
  createdById?: string | null; creatorName?: string | null;
  views?: number; likes?: number; comments?: number; saves?: number; shares?: number;
  reach?: number; impressions?: number; lastSyncedAt?: string | null;
  metadata?: {
    cta?: { label: string; url: string };
    products?: Array<{ id: string; name: string; code: string; img: string }>;
    hashtags?: string[];
  } | null;
};
export type SocialInteraction = {
  id: string; authorUsername: string | null; message: string; kind: string; status: string;
  aiReply: string | null; escalationReason: string | null; createdAt: string;
};
export type SocialOverview = {
  connections: SocialConnection[]; content: SocialContentItem[]; interactions: SocialInteraction[];
  metrics: Array<{ id: string; contentId: string; impressions: number; reach: number; likes: number; comments: number; saves: number; shares: number; linkClicks: number; attributedOrders: number; attributedRevenueVnd: number; capturedAt: string }>;
};
export type SocialPlatformSettings = {
  appId: string; graphVersion: string; redirectUri: string; webhookUrl: string;
  hasAppSecret: boolean; hasWebhookVerifyToken: boolean; source: "database" | "environment";
};

const ADMIN_GET_CACHE_TTL_MS = 2 * 60 * 1000;
const adminGetCache = new Map<
  string,
  { expiresAt: number; promise: Promise<unknown> }
>();

/** Clear cached admin reads after a write or an authentication change. */
export function clearAdminApiCache() {
  adminGetCache.clear();
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const isCacheableRead = method === "GET" && path.startsWith("/admin/");

  if (isCacheableRead) {
    const cached = adminGetCache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise as Promise<T>;
    }
    if (cached) adminGetCache.delete(path);
  }

  const request = (async () => {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      credentials: "include",
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(adminErrorMessage((data as { message?: string }).message, res.status));
    if (method !== "GET") clearAdminApiCache();
    return data as T;
  })();

  if (isCacheableRead) {
    adminGetCache.set(path, {
      expiresAt: Date.now() + ADMIN_GET_CACHE_TTL_MS,
      promise: request,
    });
    request.catch(() => {
      if (adminGetCache.get(path)?.promise === request) adminGetCache.delete(path);
    });
  }

  return request;
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
      employee_code: string | null;
      avatar_url: string | null;
      job_title: string | null;
      role_name: string | null;
      permissions: string[];
    }>("/admin/auth/me"),
  overview: (params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return req<Overview>(`/admin/overview${qs ? `?${qs}` : ""}`);
  },
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
    return req<{
      items: Customer[];
      total: number;
      page: number;
      limit: number;
      segment_distribution: Record<string, number>;
      overview_metrics?: CustomerOverviewMetrics;
    }>(`/admin/customers${qs ? `?${qs}` : ""}`);
  },
  customer: (id: string) => req<Customer>(`/admin/customers/${id}`),
  createCustomer: (body: {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    segment?: CustomerSegment;
    status?: "active" | "blocked";
    internal_note?: string;
    address?: {
      recipient_name?: string;
      phone?: string;
      address_line: string;
      city?: string;
      province?: string;
      postal_code?: string;
      country?: string;
      is_default?: boolean;
    };
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
        customer_location?: string;
        items_count?: number;
        item_images?: string[];
        extra_items?: number;
        fulfillment_status: "unfulfilled" | "fulfilled" | "partial" | string;
        fulfilled_at: string | null;
        inventory_doc_id: string | null;
        inventory_doc_code: string | null;
      }>;
      stats: {
        total: number;
        revenue_vnd: number;
        pending_payment: number;
        processing: number;
        shipping: number;
        delivered: number;
        cancelled: number;
        returned: number;
        today_orders: number;
        today_revenue_vnd: number;
      };
    }>(`/admin/orders${qs ? `?${qs}` : ""}`);
  },
  createOrder: (body: {
    customer_id?: string | null | undefined;
    customer_name: string;
    customer_email?: string | null | undefined;
    customer_phone?: string | null | undefined;
    shipping: {
      full_name: string;
      phone?: string | null | undefined;
      address_line: string;
      city: string;
      state?: string | null | undefined;
      postal_code?: string | null | undefined;
      country?: string | null | undefined;
      note?: string | null | undefined;
    };
    billing?: {
      full_name?: string | null | undefined;
      address_line?: string | null | undefined;
      city?: string | null | undefined;
      country?: string | null | undefined;
    } | undefined;
    items: Array<{
      variant_id?: string | undefined;
      product_id?: string | undefined;
      sku: string;
      product_name: string;
      size_label?: string | null | undefined;
      color_label?: string | null | undefined;
      unit_price_vnd: number;
      qty: number;
      image_url?: string | null | undefined;
    }>;
    payment_method?: string | undefined;
    payment_status?: string | undefined;
    fulfillment_status?: string | undefined;
    fulfillment_location?: string | null | undefined;
    shipping_method?: string | null | undefined;
    shipping_vnd?: number | undefined;
    discount_vnd?: number | undefined;
    discount_code?: string | null | undefined;
    status?: string | undefined;
    notes?: string | null | undefined;
  }) =>
    req<{
      id: string;
      order_number: string;
      status: string;
      grand_total_vnd: number;
      payment_method: string;
      payment_status: string;
      customer_name: string;
      customer_location: string;
      items_count: number;
      fulfillment_status: string;
      placed_at: string;
    }>("/admin/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  orderCustomerOptions: (params?: { q?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.q) q.set("q", params.q);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return req<{
      items: Array<{
        id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        created_at: string;
      }>;
    }>(`/admin/orders/customer-options${qs ? `?${qs}` : ""}`);
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
      created_at?: string | null;
      updated_at?: string | null;
      sepay_transaction?: { id: string; sepayId: number; payload: Record<string, unknown>; createdAt: string } | null;
      inventory_doc?: { id: string; code: string; status: string; postedAt: string | null; createdAt: string } | null;
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
      status?: "unfulfilled" | "fulfilled" | "shipping" | "delivered";
      inventory_doc_id?: string | null;
      inventory_doc_code?: string | null;
    },
  ) =>
    req<{
      id: string;
      order_number: string;
      status: string;
      fulfillment_status: "unfulfilled" | "fulfilled" | "partial" | "shipping" | "delivered";
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
    }>(`/admin/products${qs ? `?${qs}` : ""}`).catch(async () => {
      const pubQs = new URLSearchParams();
      if (params?.q) pubQs.set("q", params.q);
      if (params?.category_id) pubQs.set("category", params.category_id);
      if (params?.page) pubQs.set("page", String(params.page));
      if (params?.limit) pubQs.set("limit", String(params.limit));
      const pQs = pubQs.toString();
      const pubRes = await req<{ items: AdminProduct[]; total: number; page: number; limit: number }>(`/products${pQs ? `?${pQs}` : ""}`);
      return {
        items: pubRes.items,
        total: pubRes.total,
        page: pubRes.page,
        limit: pubRes.limit,
        status_counts: { all: pubRes.total, published: pubRes.total, draft: 0, archived: 0 },
      };
    });
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
    if (!colorwayId) throw new Error("Thiếu mã bộ màu");
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
    clearAdminApiCache();
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
  uploadCategoryMedia: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/api/v1/admin/categories/upload`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { message?: string }).message ?? `API ${res.status}`);
    return data as { url: string; object_key: string };
  },
  categories: (status?: string) =>
    req<{ items: Category[] }>(`/admin/categories${status ? `?status=${status}` : ""}`),
  categoryOptions: (status?: string) =>
    req<{ items: Category[] }>(`/admin/categories/options${status ? `?status=${status}` : ""}`),
  createCategory: (body: {
    name: string;
    slug?: string;
    description?: string | null;
    sort_order?: number;
    status?: "active" | "archived";
    parent_id?: string | null;
    image_url?: string | null;
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
      image_url: string | null;
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
  submitDoc: (id: string) =>
    req<{ id: string; status: string }>(`/admin/inventory/documents/${id}/submit`, { method: "POST" }),
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
  staff: () => req<{ items: Array<{
    id: string;
    employee_code: string;
    full_name: string;
    avatar_url: string | null;
    work_email: string | null;
    phone: string | null;
    joined_on: string;
    status: string;
    account_status: string | null;
    last_login_at: string | null;
    role: { role_id: string; role_code: string; role_name: string; scope_type: string } | null;
    roles: Array<{ role_id: string; role_code: string; role_name: string; scope_type: string }>;
  }> }>("/admin/staff"),
  createStaff: (body: { full_name: string; work_email: string; phone?: string; role_code: string; password?: string }) => req<{ id: string; employee_code: string }>("/admin/staff", { method: "POST", body: JSON.stringify(body) }),
  updateStaff: (id: string, status: "active" | "locked" | "left") => req<{ ok: boolean }>(`/admin/staff/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  permissions: () => req<{ items: Array<{ id: string; code: string; description: string }> }>("/admin/permissions"),
  roles: () => req<{ items: Array<{ id: string; code: string; name: string; description: string; is_system: boolean; members: number; permission_count: number; created_at: string; updated_at: string }> }>("/admin/roles"),
  role: (id: string) => req<{ role: { id: string; code: string; name: string; description: string; is_system: boolean; created_at: string; updated_at: string }; permissions: Array<{ id: string; code: string; description: string }>; members: Array<Record<string, unknown>> }>(`/admin/roles/${id}`),
  createRole: (body: { code: string; name: string; permission_codes?: string[] }) => req<{ id: string; code: string; name: string }>("/admin/roles", { method: "POST", body: JSON.stringify(body) }),
  updateRolePermissions: (id: string, permission_codes: string[]) => req<{ ok: boolean; role_id: string; permission_codes: string[] }>(`/admin/roles/${id}/permissions`, { method: "PATCH", body: JSON.stringify({ permission_codes }) }),
  updateStaffRoles: (id: string, role_codes: string[], scope_type = "all") => req<{ ok: boolean; employee_id: string; role_codes: string[]; scope_type: string }>(`/admin/staff/${id}/roles`, { method: "PATCH", body: JSON.stringify({ role_codes, scope_type }) }),
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
  deleteDiscountCode: (id: string, hard = true) =>
    req<{ id: string; success?: boolean; deleted?: boolean }>(
      `/admin/discount-codes/${id}${hard ? "?hard=1" : ""}`,
      { method: "DELETE" },
    ),
  uploadDiscountCodeImage: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/api/v1/admin/discount-codes/upload`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Tải ảnh khuyến mãi thất bại");
    }
    return (await res.json()) as { url: string; object_key: string };
  },
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
        clearAdminApiCache();
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
        clearAdminApiCache();
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
      throw new Error(err.message || "Tải ảnh lên thất bại");
    }
    return (await res.json()) as { url: string; object_key: string };
  },
  reorderElaneWomanPosts: (items: Array<{ id: string; sort_order: number }>) =>
    req<{ success: boolean; count: number }>("/admin/elane-woman/reorder", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  aiKeys: () => req<{ items: AiApiKey[] }>("/admin/ai-keys"),
  testAiKey: (rawKey: string, provider: string = "kie") =>
    req<{ ok: boolean; credits?: number; error?: string; statusCode?: number }>("/admin/ai-keys/test", {
      method: "POST",
      body: JSON.stringify({ rawKey, provider }),
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
  deleteLookbooks: (ids: string[]) =>
    req<{ success: boolean; count: number }>("/admin/lookbooks/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
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
      throw new Error(err.message || "Tải ảnh lên thất bại");
    }
    return (await res.json()) as { url: string; object_key: string };
  },
  socialOverview: (fresh = false) =>
    req<SocialOverview>(`/admin/social/overview${fresh ? `?refresh=${Date.now()}` : ""}`),
  socialSettings: () => req<SocialPlatformSettings>("/admin/social/settings"),
  updateSocialSettings: (body: { appId: string; appSecret?: string; webhookVerifyToken?: string; graphVersion: string; redirectUri?: string | null }) =>
    req<{ ok: boolean }>("/admin/social/settings", { method: "PUT", body: JSON.stringify(body) }),
  instagramConnectUrl: () => req<{ url: string }>("/admin/social/instagram/connect-url"),
  createSocialContent: (body: {
    connectionId?: string | null;
    title: string;
    caption: string;
    mediaType: "IMAGE" | "CAROUSEL" | "REELS";
    mediaUrls: string[];
    source: "user" | "ai" | "ai_assisted" | "manual";
    campaignCode?: string | null;
    status?: "draft" | "pending" | "approved" | "scheduled";
    scheduledAt?: string | null;
    metadata?: {
      cta?: { label: string; url: string };
      products?: Array<{ id: string; name: string; code: string; img: string }>;
      hashtags?: string[];
    } | null;
  }) => req<SocialContentItem>("/admin/social/content", { method: "POST", body: JSON.stringify(body) }),
  updateSocialContent: (id: string, body: Partial<{
    connectionId: string | null; title: string; caption: string; mediaType: "IMAGE" | "CAROUSEL" | "REELS";
    mediaUrls: string[]; source: "user" | "ai" | "ai_assisted" | "manual"; campaignCode: string | null;
    status: string; scheduledAt: string | null;
    metadata: {
      cta?: { label: string; url: string };
      products?: Array<{ id: string; name: string; code: string; img: string }>;
      hashtags?: string[];
    } | null;
  }>) => req<SocialContentItem>(`/admin/social/content/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  socialAiKeyStatus: () =>
    req<{
      active: boolean;
      message?: string;
      key?: {
        id: string;
        label: string;
        provider: string;
        creditsRemaining: number | null;
      };
    }>("/admin/social/ai-key-status"),
  generateSocialContent: (body: {
    brief: string;
    productContext?: string;
    tone?: string;
    count?: number;
    channels?: string[];
    objective?: string;
    audience?: string;
    products?: Array<{
      id: string;
      name: string;
      description?: string;
      imageUrls?: string[];
      sku?: string;
      price?: number;
      category?: string;
    }>;
  }) =>
    req<{
      title?: string;
      caption?: string;
      hashtags?: string[];
      cta?: string;
      variants?: Array<{ title: string; caption: string; hashtags: string[]; cta?: string; channel?: string; visualBrief?: string }>;
      keyUsed?: {
        id: string;
        label: string;
        provider: string;
        creditsRemaining: number | null;
      };
    }>("/admin/social/content/generate", { method: "POST", body: JSON.stringify(body) }),
  approveSocialContent: (id: string, body: { publishNow?: boolean; scheduledAt?: string | null }) =>
    req<SocialContentItem>(`/admin/social/content/${id}/approve`, { method: "POST", body: JSON.stringify(body) }),
  unapproveSocialContent: (id: string) =>
    req<SocialContentItem>(`/admin/social/content/${id}/unapprove`, { method: "POST" }),
  deleteSocialContent: (id: string, force = false) =>
    req<{
      ok: boolean;
      id: string;
      deletedOnInstagram?: boolean;
      instagramError?: string | null;
      externalPostId?: string | null;
    }>(`/admin/social/content/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
  duplicateSocialContent: (id: string) =>
    req<SocialContentItem>(`/admin/social/content/${id}/duplicate`, { method: "POST" }),
  sendSocialContentForReview: (id: string) =>
    req<SocialContentItem>(`/admin/social/content/${id}/send-review`, { method: "POST" }),
  rejectSocialContent: (id: string, note?: string) =>
    req<SocialContentItem>(`/admin/social/content/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
  requestChangesSocialContent: (id: string, note: string) =>
    req<SocialContentItem>(`/admin/social/content/${id}/request-changes`, { method: "POST", body: JSON.stringify({ note }) }),
  rescheduleSocialContent: (id: string, scheduledAt: string) =>
    req<SocialContentItem>(`/admin/social/content/${id}/reschedule`, { method: "POST", body: JSON.stringify({ scheduledAt }) }),
  cancelScheduleSocialContent: (id: string) =>
    req<SocialContentItem>(`/admin/social/content/${id}/cancel-schedule`, { method: "POST" }),
  retrySocialPublish: (id: string) =>
    req<SocialContentItem>(`/admin/social/content/${id}/retry`, { method: "POST" }),
  retrySocialAiReply: (id: string) => req<{ ok: boolean }>(`/admin/social/interactions/${id}/retry-ai`, { method: "POST" }),
  syncSocialMetrics: () => req<{ synced: number }>("/admin/social/metrics/sync", { method: "POST" }),
  syncPostMetrics: (id: string) =>
    req<{
      success: boolean;
      data: {
        views: number;
        reach: number;
        impressions: number;
        likes: number;
        comments: number;
        saves: number;
        shares: number;
        lastSyncedAt: string;
      };
    }>(`/admin/social/content/${id}/sync-metrics`, { method: "POST" }),
};

export type DiscountCodeAppliedProduct = {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  image_url?: string | null;
};

export type DiscountCode = {
  id: string;
  code: string;
  name: string;
  type: "percent" | "fixed" | "free_shipping" | "bxgy" | string;
  value: number;
  min_order_vnd: number;
  max_discount_vnd: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  status: "active" | "disabled" | "draft" | "paused" | string;
  description?: string | null;
  image_url?: string | null;
  banner_url?: string | null;
  apply_scope?: "all" | "category" | "products";
  products?: DiscountCodeAppliedProduct[];
  applied_category_ids?: string[];
  customer_group?: "all" | "member" | "new" | "selected";
  per_customer_limit?: number | null;
  apply_on_sale?: boolean;
  show_on_homepage?: boolean;
  stackable?: boolean;
  created_by_id?: string | null;
  updated_by_id?: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscountCodeInput = {
  code: string;
  name: string;
  type: "percent" | "fixed" | "free_shipping" | "bxgy";
  value: number;
  min_order_vnd?: number;
  max_discount_vnd?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  usage_limit?: number | null;
  status?: "active" | "disabled" | "draft" | "paused";
  description?: string | null;
  image_url?: string | null;
  banner_url?: string | null;
  apply_scope?: "all" | "category" | "products";
  products?: DiscountCodeAppliedProduct[];
  applied_category_ids?: string[];
  customer_group?: "all" | "member" | "new" | "selected";
  per_customer_limit?: number | null;
  apply_on_sale?: boolean;
  show_on_homepage?: boolean;
  stackable?: boolean;
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
  year?: number | null;
  cover_image_url: string;
  sort_order: number;
  status: "published" | "draft" | "scheduled" | "archived" | string;
  intro_content?: string | null;
  published_at?: string | null;
  unpublish_at?: string | null;
  unpublish_enabled?: boolean;
  show_on_home?: boolean;
  allow_products?: boolean;
  view_count?: number;
  product_count?: number;
  attached_products?: Array<{
    id: string;
    name: string;
    slug?: string | null;
    sku?: string | null;
    image_url?: string | null;
  }>;
  attached_product_ids?: string[];
  created_at: string;
  updated_at: string;
  item_count?: number;
  items?: AdminLookbookItem[];
};

export { API_URL };


