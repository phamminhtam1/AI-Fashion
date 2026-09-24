import dress from "@/assets/p-dress.jpg";
import top from "@/assets/p-top.jpg";
import set from "@/assets/p-set.jpg";
import pants from "@/assets/p-pants.jpg";
import skirt from "@/assets/p-skirt.jpg";
import coat from "@/assets/p-coat.jpg";
import acc from "@/assets/p-acc.jpg";
import { fetchCategories, fetchProduct, fetchProducts, mediaUrl, type ApiProduct } from "./api";

export type Category = { slug: string; name: string; image: string; description: string };

const catImage: Record<string, string> = {
  "vay-dam": dress,
  ao: top,
  quan: pants,
  "chan-vay": skirt,
  "set-bo": set,
  "ao-khoac": coat,
  "phu-kien": acc,
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  salePrice?: number | undefined;
  images: string[];
  colors: { name: string; hex: string }[];
  sizes: string[];
  isNew?: boolean | undefined;
  bestSeller?: boolean | undefined;
  rating: number;
  reviews: number;
  material: string;
  description: string;
  occasion: string;
};

let cache: Product[] = [];
let categoriesCache: Category[] = [];
let loaded = false;

export function mapApiProduct(p: ApiProduct): Product {
  const compare = p.sale_compare_vnd;
  const price = compare && compare > p.price_vnd ? compare : p.price_vnd;
  const salePrice = compare && compare > p.price_vnd ? p.price_vnd : undefined;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category?.slug ?? "",
    price,
    salePrice,
    images: (() => {
      const fallback = catImage[p.category?.slug ?? ""] ?? dress;
      if (!p.images.length) return [fallback];
      return p.images.map((img) => (img.startsWith("/media") ? mediaUrl(img) : img));
    })(),
    colors: p.colors.map((c) => ({ name: c.name, hex: c.hex ?? "#ccc" })),
    sizes: p.sizes.map((s) => s.label),
    isNew: p.is_new,
    bestSeller: p.best_seller,
    rating: 4.8,
    reviews: 24,
    material: p.material ?? "",
    description: p.description,
    occasion: p.occasion ?? "",
  };
}

export async function ensureCatalog() {
  if (loaded) return;
  const [prods, cats] = await Promise.all([fetchProducts({ limit: "100" }), fetchCategories()]);
  cache = prods.items.map(mapApiProduct);
  categoriesCache = cats.items.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    image: catImage[c.slug] ?? dress,
  }));
  loaded = true;
}

export function invalidateCatalog() {
  loaded = false;
  cache = [];
}

/** Sync accessors — call ensureCatalog() in route loaders first. */
export const products: Product[] = new Proxy([] as Product[], {
  get(_t, prop) {
    if (prop === "length") return cache.length;
    if (prop === Symbol.iterator) return cache[Symbol.iterator].bind(cache);
    if (typeof prop === "string" && /^\d+$/.test(prop)) return cache[Number(prop)];
    const v = (cache as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as Function).bind(cache) : v;
  },
});

export const categories: Category[] = new Proxy([] as Category[], {
  get(_t, prop) {
    if (prop === "length") return categoriesCache.length;
    if (prop === Symbol.iterator) return categoriesCache[Symbol.iterator].bind(categoriesCache);
    if (typeof prop === "string" && /^\d+$/.test(prop)) return categoriesCache[Number(prop)];
    const v = (categoriesCache as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as Function).bind(categoriesCache) : v;
  },
});

export const formatVND = (n: number) => n.toLocaleString("vi-VN") + "₫";

export const getCategory = (slug: string) => categoriesCache.find((c) => c.slug === slug);
export const getProduct = (slug: string) => cache.find((p) => p.slug === slug);

export async function loadProduct(slug: string) {
  await ensureCatalog();
  const hit = getProduct(slug);
  if (hit) return hit;
  try {
    const p = mapApiProduct(await fetchProduct(slug));
    cache.push(p);
    return p;
  } catch {
    return undefined;
  }
}

export function productsForListing(slug: string): { title: string; description: string; items: Product[] } | null {
  if (slug === "hang-moi") return { title: "Hàng mới", description: "Những thiết kế mới nhất từ bộ sưu tập Thu Đông 2026.", items: cache.filter((p) => p.isNew) };
  if (slug === "sale") return { title: "Sale", description: "Ưu đãi có hạn cho các thiết kế được yêu thích.", items: cache.filter((p) => p.salePrice) };
  if (slug === "ban-chay") return { title: "Bán chạy", description: "Những thiết kế được yêu thích nhất tại ÉLANE.", items: cache.filter((p) => p.bestSeller) };
  if (slug === "cong-so" || slug === "du-tiec" || slug === "casual") {
    const names: Record<string, string> = { "cong-so": "Công sở", "du-tiec": "Dự tiệc", casual: "Casual" };
    const n = names[slug]!;
    return { title: n, description: `Tuyển chọn trang phục ${n.toLowerCase()} thanh lịch.`, items: cache.filter((p) => p.occasion === slug) };
  }
  const c = getCategory(slug);
  if (!c) return null;
  return { title: c.name, description: c.description, items: cache.filter((p) => p.category === slug) };
}

export const navItems = [
  { label: "Hàng mới", slug: "hang-moi" },
  { label: "Váy / Đầm", slug: "vay-dam" },
  { label: "Áo", slug: "ao" },
  { label: "Quần", slug: "quan" },
  { label: "Chân váy", slug: "chan-vay" },
  { label: "Set bộ", slug: "set-bo" },
  { label: "Áo khoác", slug: "ao-khoac" },
  { label: "Công sở", slug: "cong-so" },
  { label: "Dự tiệc", slug: "du-tiec" },
  { label: "Phụ kiện", slug: "phu-kien" },
  { label: "Sale", slug: "sale" },
];
