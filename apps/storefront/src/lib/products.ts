import { useEffect, useState } from "react";
import dress from "@/assets/p-dress.jpg";
import top from "@/assets/p-top.jpg";
import set from "@/assets/p-set.jpg";
import pants from "@/assets/p-pants.jpg";
import skirt from "@/assets/p-skirt.jpg";
import coat from "@/assets/p-coat.jpg";
import acc from "@/assets/p-acc.jpg";
import { fetchCategories, fetchProduct, fetchProducts, mediaUrl, type ApiProduct } from "./api";

export type Category = {
  id: string;
  slug: string;
  name: string;
  image: string;
  description: string;
  parent_id: string | null;
};

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
  colorways: Array<{ id: string; thumbnail: string; images: string[] }>;
  colors: { name: string; hex: string }[];
  sizes: string[];
  variants: Array<{ id: string; sku: string; colorwayId: string; size: string; available: number }>;
  isNew?: boolean | undefined;
  bestSeller?: boolean | undefined;
  rating: number;
  reviews: number;
  material: string;
  description: string;
  occasion: string;
};

export type NavItem = {
  label: string;
  slug: string;
  children?: { label: string; slug: string }[];
};

let cache: Product[] = [];
let categoriesCache: Category[] = [];
let loadedAt = 0;
/** ponytail: process-wide cache; TTL so admin publish shows without restart. Ceiling: stale ≤ TTL. */
const CATALOG_TTL_MS = 15_000;

export function mapApiProduct(p: ApiProduct): Product {
  const compare = p.sale_compare_vnd;
  const price = compare && compare > p.price_vnd ? compare : p.price_vnd;
  const salePrice = compare && compare > p.price_vnd ? p.price_vnd : undefined;
  const fallback = catImage[p.category?.slug ?? ""] ?? dress;
  const colorways = (p.colorways ?? [])
    .filter((c) => c.images?.length)
    .map((c) => ({
      id: c.id,
      thumbnail: mediaUrl(c.thumbnail ?? c.images[0]!),
      images: c.images.map((img) => (img.startsWith("http") ? img : mediaUrl(img))),
    }));
  const images = colorways[0]?.images?.length
    ? colorways[0].images
    : p.images.length
      ? p.images.map((img) =>
          img.startsWith("/media") || img.startsWith("http")
            ? img.startsWith("http")
              ? img
              : mediaUrl(img)
            : img,
        )
      : [fallback];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category?.slug ?? "",
    price,
    salePrice,
    images,
    colorways,
    colors: p.colors.map((c) => ({ name: c.name, hex: c.hex ?? "#ccc" })),
    sizes: p.sizes.map((s) => s.label),
    variants: (p.variants ?? []).map((v) => ({
      id: v.id,
      sku: v.sku,
      colorwayId: v.colorway_id ?? v.color?.code ?? "",
      size: v.size.label,
      available: v.available ?? 0,
    })),
    isNew: p.is_new,
    bestSeller: p.best_seller,
    rating: 4.8,
    reviews: 24,
    material: p.material ?? "",
    description: p.description,
    occasion: p.occasion ?? "",
  };
}

async function fetchAllPublishedProducts() {
  const items: ApiProduct[] = [];
  let page = 1;
  let total = Infinity;
  while (items.length < total) {
    const res = await fetchProducts({ limit: "50", page: String(page) });
    items.push(...res.items);
    total = res.total;
    if (!res.items.length) break;
    page += 1;
  }
  return items;
}

export function rootCategoriesList() {
  return categoriesCache.filter((c) => !c.parent_id);
}

export function allCategoriesList() {
  return categoriesCache;
}

export function allProductsList() {
  return cache;
}

type CatalogListener = () => void;
const listeners = new Set<CatalogListener>();

export function subscribeCatalog(listener: CatalogListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyCatalog() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }
}

export function hydrateCatalog(p?: Product[], c?: Category[]) {
  let updated = false;
  if (p && p.length > 0 && cache.length === 0) {
    cache = [...p];
    updated = true;
  }
  if (c && c.length > 0 && categoriesCache.length === 0) {
    categoriesCache = [...c];
    updated = true;
  }
  if (updated) {
    loadedAt = Date.now();
    notifyCatalog();
  }
}

/** Slugs of this category and all descendants (for listing). */
export function categorySubtreeSlugs(slug: string): Set<string> {
  const root = categoriesCache.find((c) => c.slug === slug);
  if (!root) return new Set([slug]);
  const out = new Set<string>([root.slug]);
  const queue = [root.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of categoriesCache) {
      if (child.parent_id === id) {
        out.add(child.slug);
        queue.push(child.id);
      }
    }
  }
  return out;
}

/** Walk up to root category slug (for ranking new-arrivals). */
export function rootCategorySlug(slug: string): string {
  let cur = categoriesCache.find((c) => c.slug === slug);
  if (!cur) return slug;
  while (cur.parent_id) {
    const parent = categoriesCache.find((c) => c.id === cur!.parent_id);
    if (!parent) break;
    cur = parent;
  }
  return cur.slug;
}

/** Check if a product belongs to the accessories category (phụ kiện). */
export function isAccessory(p: Product): boolean {
  const root = rootCategorySlug(p.category);
  return root === "phu-kien" || p.category === "phu-kien";
}

/** 0 = áo/quần first, 1 = other apparel, 2 = phụ kiện last. */
export function newArrivalRank(p: Product): number {
  const root = rootCategorySlug(p.category);
  if (root === "ao" || root === "quan") return 0;
  if (root === "phu-kien") return 2;
  return 1;
}

/** Prefer áo/quần over phụ kiện; stable within each band. */
export function prioritizeApparel(items: Product[]) {
  const buckets: [Product[], Product[], Product[]] = [[], [], []];
  for (const p of items) buckets[newArrivalRank(p)].push(p);
  return buckets[0].concat(buckets[1], buckets[2]);
}

/**
 * Lấy danh sách hàng mới về:
 * - Nếu có sản phẩm được đánh dấu isNew -> lấy các sản phẩm đó.
 * - Nếu không có -> lấy ngẫu nhiên 10-20 sản phẩm trang phục (loại trừ phụ kiện).
 */
export function getNewArrivalProducts(prods: Product[] = cache): Product[] {
  const marked = prods.filter((p) => p.isNew);
  if (marked.length > 0) {
    return prioritizeApparel(marked);
  }
  const apparel = prods.filter((p) => !isAccessory(p));
  const pool = apparel.length > 0 ? apparel : prods;
  return prioritizeApparel(pool).slice(0, 20);
}

/**
 * Lấy danh sách sản phẩm bán chạy nhất:
 * - Nếu có sản phẩm bán chạy thực tế -> lấy các sản phẩm đó.
 * - Nếu chưa có -> lấy ngẫu nhiên 8-16 sản phẩm trang phục (loại trừ phụ kiện, tránh trùng lặp với hàng mới về).
 */
export function getBestSellerProducts(prods: Product[] = cache): Product[] {
  const marked = prods.filter((p) => p.bestSeller);
  if (marked.length > 0) {
    return prioritizeApparel(marked);
  }
  const apparel = prods.filter((p) => !isAccessory(p) && !p.isNew);
  const pool = apparel.length >= 8 ? apparel : prods.filter((p) => !isAccessory(p));
  return prioritizeApparel(pool.length > 0 ? pool : prods).slice(0, 16);
}

export async function ensureCatalog(force = false) {
  if (!force && loadedAt > 0 && Date.now() - loadedAt < CATALOG_TTL_MS) return;
  try {
    const [prods, cats] = await Promise.all([fetchAllPublishedProducts(), fetchCategories()]);
    categoriesCache = (cats?.items ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description ?? "",
      parent_id: c.parent_id,
      image: catImage[c.slug] ?? dress,
    }));

    let mappedProds = prods.map(mapApiProduct);

    // 1. Hàng mới về: Nếu không có sản phẩm nào được đánh dấu là mới (isNew)
    // -> random 10-20 sản phẩm (loại trừ phụ kiện) làm hàng mới về
    const hasExplicitNew = mappedProds.some((p) => p.isNew);
    const newArrivalIds = new Set<string>();
    if (!hasExplicitNew && mappedProds.length > 0) {
      const eligible = mappedProds.filter((p) => !isAccessory(p));
      const pool = eligible.length > 0 ? eligible : mappedProds;
      const targetCount = Math.min(pool.length, Math.floor(Math.random() * 11) + 10);
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, targetCount);
      for (const item of shuffled) newArrivalIds.add(item.id);
      mappedProds = mappedProds.map((p) => (newArrivalIds.has(p.id) ? { ...p, isNew: true } : p));
    } else {
      for (const item of mappedProds) if (item.isNew) newArrivalIds.add(item.id);
    }

    // 2. Bán chạy nhất: Nếu chưa có sản phẩm bán chạy từ đơn hàng thực tế
    // -> random 8-16 sản phẩm trang phục (loại trừ phụ kiện, tránh trùng với Hàng mới về)
    const hasExplicitBestSeller = mappedProds.some((p) => p.bestSeller);
    if (!hasExplicitBestSeller && mappedProds.length > 0) {
      const apparelOnly = mappedProds.filter((p) => !isAccessory(p));
      const nonNewApparel = apparelOnly.filter((p) => !newArrivalIds.has(p.id));
      const candidatePool = nonNewApparel.length >= 8 ? nonNewApparel : apparelOnly;
      const targetCount = Math.min(candidatePool.length, Math.floor(Math.random() * 9) + 8);
      const shuffled = [...candidatePool].sort(() => Math.random() - 0.5).slice(0, targetCount);
      const bestSellerIds = new Set(shuffled.map((p) => p.id));
      mappedProds = mappedProds.map((p) => (bestSellerIds.has(p.id) ? { ...p, bestSeller: true } : p));
    }

    cache = mappedProds;
    loadedAt = Date.now();
    notifyCatalog();
  } catch (err) {
    console.warn("ensureCatalog failed to load products/categories:", err);
  }
}

export function invalidateCatalog() {
  loadedAt = 0;
  cache = [];
  categoriesCache = [];
  notifyCatalog();
}

/** React hook for components to reactively re-render when catalog data arrives */
export function useCatalog() {
  const [data, setData] = useState(() => ({
    products: [...products],
    categories: [...categories],
    ready: categories.length > 0,
  }));

  useEffect(() => {
    const unsub = subscribeCatalog(() => {
      setData({
        products: [...products],
        categories: [...categories],
        ready: categories.length > 0,
      });
    });
    if (categories.length === 0 || products.length === 0) {
      ensureCatalog().then(() => {
        setData({
          products: [...products],
          categories: [...categories],
          ready: categories.length > 0,
        });
      });
    }
    return unsub;
  }, []);

  return data;
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

/** Root categories only (homepage / search chips). */
export const categories: Category[] = new Proxy([] as Category[], {
  get(_t, prop) {
    const roots = rootCategoriesList();
    if (prop === "length") return roots.length;
    if (prop === Symbol.iterator) return roots[Symbol.iterator].bind(roots);
    if (typeof prop === "string" && /^\d+$/.test(prop)) return roots[Number(prop)];
    const v = (roots as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as Function).bind(roots) : v;
  },
});

export const formatVND = (n: number) => n.toLocaleString("vi-VN") + "₫";

export const getCategory = (slug: string) => categoriesCache.find((c) => c.slug === slug);
export const getProduct = (slug: string) => cache.find((p) => p.slug === slug);

/** Ancestor chain root → … → leaf for breadcrumbs. Empty if slug is not a DB category. */
export function categoryBreadcrumb(slug: string): Array<{ slug: string; name: string }> {
  const leaf = getCategory(slug);
  if (!leaf) return [];
  const chain: Array<{ slug: string; name: string }> = [];
  let cur: Category | undefined = leaf;
  while (cur) {
    chain.unshift({ slug: cur.slug, name: cur.name });
    cur = cur.parent_id ? categoriesCache.find((c) => c.id === cur!.parent_id) : undefined;
  }
  return chain;
}

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
  if (slug === "hang-moi") {
    return {
      title: "Hàng mới",
      description: "Những thiết kế mới nhất từ bộ sưu tập Thu Đông 2026.",
      items: getNewArrivalProducts(cache),
    };
  }
  if (slug === "sale") {
    return {
      title: "Sale",
      description: "Ưu đãi có hạn cho các thiết kế được yêu thích.",
      items: cache.filter((p) => p.salePrice),
    };
  }
  if (slug === "ban-chay") {
    return {
      title: "Bán chạy",
      description: "Những thiết kế được yêu thích nhất tại ÉLANE.",
      items: getBestSellerProducts(cache),
    };
  }
  if (slug === "cong-so" || slug === "du-tiec" || slug === "casual") {
    const names: Record<string, string> = { "cong-so": "Công sở", "du-tiec": "Dự tiệc", casual: "Casual" };
    const n = names[slug]!;
    return {
      title: n,
      description: `Tuyển chọn trang phục ${n.toLowerCase()} thanh lịch.`,
      items: cache.filter((p) => p.occasion === slug),
    };
  }
  const c = getCategory(slug);
  if (!c) return null;
  const slugs = categorySubtreeSlugs(slug);
  return {
    title: c.name,
    description: c.description,
    items: cache.filter((p) => slugs.has(p.category)),
  };
}

/** Hàng mới → [API roots] → Công sở → Dự tiệc → Sale */
export function getNavItems(): NavItem[] {
  const mid = rootCategoriesList().map((r) => ({
    label: r.name,
    slug: r.slug,
    children: categoriesCache
      .filter((c) => c.parent_id === r.id)
      .map((c) => ({ label: c.name, slug: c.slug })),
  }));
  return [
    { label: "Hàng mới", slug: "hang-moi" },
    ...mid,
    { label: "Công sở", slug: "cong-so" },
    { label: "Dự tiệc", slug: "du-tiec" },
    { label: "Sale", slug: "sale" },
  ];
}

/** @deprecated use getNavItems() — kept for sync Proxy access after ensureCatalog */
export const navItems: NavItem[] = new Proxy([] as NavItem[], {
  get(_t, prop) {
    const items = getNavItems();
    if (prop === "length") return items.length;
    if (prop === Symbol.iterator) return items[Symbol.iterator].bind(items);
    if (typeof prop === "string" && /^\d+$/.test(prop)) return items[Number(prop)];
    const v = (items as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as Function).bind(items) : v;
  },
});
