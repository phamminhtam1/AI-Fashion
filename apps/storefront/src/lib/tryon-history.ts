import { storeApi } from "./api";

export type LocalTryOnRecord = {
  id: string; // jobId
  createdAt: string;
  completedAt?: string | null;
  status: string;
  productId: string;
  productName: string;
  productSlug: string;
  productPrice: number;
  productSalePrice?: number | null;
  productImage: string;
  variantId?: string | null;
  sku?: string | null;
  size?: string | null;
  colorwayId?: string | null;
  resultUrl: string;
  userImageUrl?: string | null;
};

const STORAGE_KEY = "elane_ai_tryon_history_v1";
const DELETED_KEY = "elane_ai_tryon_deleted_ids_v1";

type HistoryListener = () => void;
const listeners = new Set<HistoryListener>();

export function subscribeTryOnHistory(fn: HistoryListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  }
}

export function getDeletedTryOnIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function addDeletedTryOnId(id: string) {
  if (typeof window === "undefined" || !id) return;
  try {
    const set = getDeletedTryOnIds();
    set.add(id);
    const arr = Array.from(set).slice(-100); // keep last 100 deleted ids
    localStorage.setItem(DELETED_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error("Failed to add deleted try-on id:", e);
  }
}

export function getLocalTryOnHistory(): LocalTryOnRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const deleted = getDeletedTryOnIds();
    const list = JSON.parse(raw) as LocalTryOnRecord[];
    return list.filter((x) => !deleted.has(x.id));
  } catch {
    return [];
  }
}

export function saveTryOnRecord(record: LocalTryOnRecord) {
  if (typeof window === "undefined") return;
  try {
    const deleted = getDeletedTryOnIds();
    if (deleted.has(record.id)) {
      deleted.delete(record.id);
      localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(deleted)));
    }
    const list = getLocalTryOnHistory().filter((x) => x.id !== record.id);
    list.unshift(record);
    // Keep max 50 recent records
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
    notifyListeners();
  } catch (e) {
    console.error("Failed to save try-on history:", e);
  }
}

/**
 * Deletes a try-on record from both local storage and the server database
 */
export async function deleteTryOnRecord(id: string, resultUrl?: string): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. Mark as deleted in tombstone and remove from local storage
  addDeletedTryOnId(id);
  try {
    const list = getLocalTryOnHistory().filter((x) => x.id !== id && (!resultUrl || x.resultUrl !== resultUrl));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to remove try-on record from local storage:", e);
  }

  // 2. Notify all UI listeners immediately
  notifyListeners();

  // 3. Delete from backend database (if jobId is valid UUID)
  try {
    if (id && id.length > 10) {
      await storeApi.deleteTryOn(id);
    }
  } catch (e) {
    console.warn("[tryon-history] Server deleteTryOn failed (may be guest or already deleted):", e);
  }
}

export function clearTryOnHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    notifyListeners();
  } catch (e) {
    console.error("Failed to clear try-on history:", e);
  }
}

/**
 * Fetches merged history from both Server (PostgreSQL) and LocalStorage,
 * ensuring consistency between Profile page and Try-On Dialog.
 */
export async function fetchUnifiedTryOnHistory(isLoggedIn: boolean): Promise<LocalTryOnRecord[]> {
  const local = getLocalTryOnHistory();
  const deletedIds = getDeletedTryOnIds();

  if (!isLoggedIn) {
    return local.filter((x) => !deletedIds.has(x.id));
  }

  let serverItems: any[] = [];
  try {
    const res = await storeApi.listTryOns();
    serverItems = res.items || [];
  } catch (err) {
    console.warn("Failed to fetch server try-on items:", err);
  }

  const map = new Map<string, LocalTryOnRecord>();

  // 1. Add server items
  for (const item of serverItems) {
    if (deletedIds.has(item.id)) continue;
    const resImg = item.result_url || item.resultUrl || item.resultImageUrl;
    if (!resImg) continue;
    const userImg = item.user_image_url || item.userImageUrl || item.userPhotoUrl || null;

    map.set(item.id, {
      id: item.id,
      createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      completedAt: item.completed_at || item.completedAt,
      status: item.status || "COMPLETED",
      productId: item.product?.id || "",
      productName: item.product?.name || "",
      productSlug: item.product?.slug || "",
      productPrice: item.product?.price_vnd || item.product?.price || 0,
      productSalePrice: item.product?.salePrice || item.product?.compare_at_price_vnd || null,
      productImage: item.product?.image_url || item.product?.imageUrl || "",
      variantId: item.variant?.id,
      sku: item.variant?.sku,
      size: item.variant?.size,
      resultUrl: resImg,
      userImageUrl: userImg,
    });
  }

  // 2. Add local items (if not already in map)
  for (const item of local) {
    if (deletedIds.has(item.id)) continue;
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Sync back to local storage cache (max 50)
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged.slice(0, 50)));
    } catch {
      // ignore
    }
  }

  return merged;
}
