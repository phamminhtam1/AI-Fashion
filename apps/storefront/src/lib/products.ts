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
  dam: dress,
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
let categoriesLoadedAt = 0;
/** TTL set to 5 minutes to prevent frequent full-catalog fetches during user navigation */
const CATALOG_TTL_MS = 5 * 60 * 1000;
let inFlightCatalogPromise: Promise<void> | null = null;
let inFlightCategoriesPromise: Promise<Category[]> | null = null;

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

/** Dynamically add products to in-memory cache without duplicate entries */
export function registerProducts(prods: Product[]) {
  if (!prods.length) return;
  const existingIds = new Set(cache.map((p) => p.id));
  let added = false;
  for (const p of prods) {
    if (!existingIds.has(p.id)) {
      cache.push(p);
      existingIds.add(p.id);
      added = true;
    }
  }
  if (added) {
    notifyCatalog();
  }
}

/** Slugs of this category and all descendants (for listing). */
export function categorySubtreeSlugs(slug: string): Set<string> {
  const norm = slug === "vay-dam" ? "dam" : slug;
  const root = categoriesCache.find((c) => c.slug === norm || c.slug === slug);
  if (!root) return new Set([slug, norm]);
  const out = new Set<string>([root.slug, slug, norm]);
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

export async function ensureCategories(force = false): Promise<Category[]> {
  if (!force && categoriesLoadedAt > 0 && categoriesCache.length > 0 && Date.now() - categoriesLoadedAt < CATALOG_TTL_MS) {
    return categoriesCache;
  }
  if (inFlightCategoriesPromise) {
    return inFlightCategoriesPromise;
  }
  inFlightCategoriesPromise = (async () => {
    try {
      const cats = await fetchCategories();
      categoriesCache = (cats?.items ?? []).map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description ?? "",
        parent_id: c.parent_id,
        image: catImage[c.slug] ?? dress,
      }));
      categoriesLoadedAt = Date.now();
      notifyCatalog();
      return categoriesCache;
    } catch (err) {
      console.warn("ensureCategories failed to load categories:", err);
      return categoriesCache;
    } finally {
      inFlightCategoriesPromise = null;
    }
  })();
  return inFlightCategoriesPromise;
}

export async function ensureCatalog(force = false): Promise<void> {
  if (!force && loadedAt > 0 && cache.length > 0 && Date.now() - loadedAt < CATALOG_TTL_MS) return;
  if (inFlightCatalogPromise) {
    return inFlightCatalogPromise;
  }
  inFlightCatalogPromise = (async () => {
    try {
      const [_, res] = await Promise.all([
        ensureCategories(force),
        fetchProducts({ limit: "50", page: "1" }),
      ]);
      cache = (res.items ?? []).map(mapApiProduct);
      loadedAt = Date.now();
      notifyCatalog();
    } catch (err) {
      console.warn("ensureCatalog failed to load products:", err);
    } finally {
      inFlightCatalogPromise = null;
    }
  })();
  return inFlightCatalogPromise;
}

export async function fetchListingPage(params: {
  slug: string;
  page?: number;
  limit?: number;
}): Promise<{
  title: string;
  description: string;
  items: Product[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const { slug, page = 1, limit = 50 } = params;
  await ensureCategories();

  let title = "";
  let description = "";
  const queryParams: Record<string, string> = {
    page: String(page),
    limit: String(limit),
  };

  if (slug === "hang-moi") {
    title = "Hàng mới";
    description = "Những thiết kế mới nhất từ bộ sưu tập Thu Đông 2026.";
    queryParams.listing = "hang-moi";
  } else if (slug === "sale") {
    title = "Sale";
    description = "Ưu đãi có hạn cho các thiết kế được yêu thích.";
    queryParams.listing = "sale";
  } else if (slug === "ban-chay") {
    title = "Bán chạy";
    description = "Những thiết kế được yêu thích nhất tại ÉLANE.";
    queryParams.listing = "ban-chay";
  } else if (slug === "cong-so" || slug === "du-tiec" || slug === "casual") {
    const names: Record<string, string> = {
      "cong-so": "Công sở",
      "du-tiec": "Dự tiệc",
      casual: "Casual",
    };
    title = names[slug] ?? slug;
    description = `Tuyển chọn trang phục ${title.toLowerCase()} thanh lịch.`;
    queryParams.occasion = slug;
  } else {
    const c = getCategory(slug);
    if (c) {
      title = c.name;
      description = c.description || `Bộ sưu tập thời trang ${c.name} cao cấp từ ÉLANE.`;
      queryParams.category = slug;
    } else {
      title = slug;
      description = "";
      queryParams.category = slug;
    }
  }

  const res = await fetchProducts(queryParams);
  let items = (res.items ?? []).map(mapApiProduct);
  if (slug === "hang-moi") {
    items = [...items].sort((a, b) => Number(isAccessory(a)) - Number(isAccessory(b)));
  }
  const total = res.total ?? items.length;
  const hasMore = page * limit < total;

  return {
    title,
    description,
    items,
    total,
    page,
    limit,
    hasMore,
  };
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

export const formatVND = (n?: number | null) =>
  typeof n === "number" && !isNaN(n) ? n.toLocaleString("vi-VN") + "₫" : "0₫";

export const getCategory = (slug: string) => {
  const norm = slug === "vay-dam" ? "dam" : slug;
  return categoriesCache.find((c) => c.slug === norm || c.slug === slug);
};
export const getProduct = (slugOrId: string) =>
  cache.find((p) => p.slug === slugOrId || p.id === slugOrId);

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

/** Fetches products by IDs (used by Wishlist), filling any cache misses from the API */
export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids || ids.length === 0) return [];
  await ensureCatalog();
  const found: Product[] = [];
  const missingIds: string[] = [];

  for (const id of ids) {
    const existing = cache.find((p) => p.id === id || p.slug === id);
    if (existing) {
      found.push(existing);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length > 0) {
    const fetched = await Promise.all(
      missingIds.map((id) =>
        fetchProduct(id)
          .then((apiP) => mapApiProduct(apiP))
          .catch(() => null),
      ),
    );
    for (const p of fetched) {
      if (p) {
        if (!cache.some((c) => c.id === p.id)) {
          cache.push(p);
        }
        found.push(p);
      }
    }
    if (fetched.some(Boolean)) {
      notifyCatalog();
    }
  }

  return found;
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
