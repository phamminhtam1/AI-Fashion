const PUBLIC_API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/** Browser → localhost; SSR trong Docker → http://api:3001 */
function apiBase() {
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_URL ?? PUBLIC_API_URL;
  }
  return PUBLIC_API_URL;
}

export type ApiProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  material: string | null;
  category: { slug: string; name: string } | null;
  occasion: string | null;
  is_new: boolean;
  best_seller: boolean;
  price_vnd: number;
  sale_compare_vnd: number | null;
  images: string[];
  colorways?: Array<{
    id: string;
    sort_order: number;
    thumbnail: string | null;
    images: string[];
  }>;
  colors: { name: string; hex: string | null; code: string }[];
  sizes: { code: string; label: string }[];
  variants: Array<{
    id: string;
    sku: string;
    price_vnd: number;
    compare_at_price_vnd: number | null;
    colorway_id?: string;
    color: { code: string; name: string; hex: string | null };
    size: { code: string; label: string };
    available: number;
  }>;
};

export type StoreMe = {
  customer_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export type StoreOrderSummary = {
  id: string;
  order_number: string;
  status: string;
  grand_total_vnd: number;
  payment_method: string;
  payment_status?: string;
  placed_at: string;
};

export type BankInfo = {
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_bin: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}/api/v1${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function storeReq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/api/v1${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data as { message?: string }).message ?? `API ${res.status}`,
      (data as { code?: string }).code,
    );
  }
  return data as T;
}

export function mediaUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${PUBLIC_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchProducts(params: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const qs = q.toString();
  return get<{ items: ApiProduct[]; total: number }>(`/products${qs ? `?${qs}` : ""}`);
}

export async function fetchProduct(slug: string) {
  return get<ApiProduct>(`/products/${slug}`);
}

export async function fetchCategories() {
  return get<{
    items: Array<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      parent_id: string | null;
    }>;
  }>("/categories");
}

export async function fetchFaqs() {
  return get<{ items: Array<{ id: string; group: string; question: string; answer: string }> }>("/faqs");
}

export async function fetchHomepage() {
  return get<{ brand: Record<string, unknown>; blocks: Record<string, unknown> }>("/homepage");
}

export type ApiSizeChart = {
  id: string;
  name: string;
  unit: string;
  instructions: string | null;
  columns: string[];
  rows: Array<Record<string, string>>;
  measurements: Array<{
    size_code: string;
    size_label: string;
    measurement_code: string;
    min_value: number;
    max_value: number;
  }>;
};

export async function fetchDefaultSizeChart() {
  return get<ApiSizeChart>("/size-charts/default");
}

export async function fetchSizeChart(id: string) {
  return get<ApiSizeChart>(`/size-charts/${id}`);
}

export const storeApi = {
  register: (body: { full_name: string; email: string; phone?: string; password: string }) =>
    storeReq<{ ok: boolean }>("/store/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    storeReq<{ ok: boolean }>("/store/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => storeReq<{ ok: boolean }>("/store/auth/logout", { method: "POST" }),
  me: async (): Promise<StoreMe | null> => {
    try {
      return await storeReq<StoreMe>("/store/auth/me");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  patchMe: (body: { full_name?: string; phone?: string | null }) =>
    storeReq<StoreMe>("/store/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  wishlist: () => storeReq<{ items: Array<{ product_id: string }> }>("/me/wishlist"),
  addWishlist: (productId: string) =>
    storeReq<{ ok: boolean }>(`/me/wishlist/${productId}`, { method: "PUT" }),
  removeWishlist: (productId: string) =>
    storeReq<{ ok: boolean }>(`/me/wishlist/${productId}`, { method: "DELETE" }),
  orders: () => storeReq<{ items: StoreOrderSummary[] }>("/me/orders"),
  previewCoupon: (body: { code: string; subtotal_vnd: number }) =>
    storeReq<{ code: string; type: string; value: number; discount_vnd: number }>(
      "/store/coupons/preview",
      { method: "POST", body: JSON.stringify(body) },
    ),
  placeOrder: (body: {
    items: Array<{ variant_id: string; qty: number }>;
    shipping: {
      full_name: string;
      phone: string;
      email: string;
      address_line: string;
      city: string;
      district: string;
      note?: string;
    };
    payment_method: "cod" | "bank";
    note?: string;
    coupon_code?: string;
  }) =>
    storeReq<{
      id: string;
      order_number: string;
      status: string;
      grand_total_vnd: number;
      payment_method: string;
      payment_status: string;
    }>("/me/orders", { method: "POST", body: JSON.stringify(body) }),
};

export function fetchBankInfo() {
  return get<BankInfo>("/payments/bank-info");
}

export { PUBLIC_API_URL as API_URL };
