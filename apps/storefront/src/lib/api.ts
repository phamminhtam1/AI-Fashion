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
  colors: { name: string; hex: string | null; code: string }[];
  sizes: { code: string; label: string }[];
  variants: Array<{
    id: string;
    sku: string;
    price_vnd: number;
    compare_at_price_vnd: number | null;
    color: { code: string; name: string; hex: string | null };
    size: { code: string; label: string };
  }>;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}/api/v1${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function mediaUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  // Always public host so <img> in browser works
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
  return get<{ items: Array<{ slug: string; name: string; description: string | null }> }>("/categories");
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

export { PUBLIC_API_URL as API_URL };
