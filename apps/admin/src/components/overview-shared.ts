import type { Overview } from "@/lib/api";

/** Các field design cần cho Overview. */
export type OverviewExt = Overview & {
  total_items_sold?: number;
  new_customers?: number;
  /** % thay đổi so với kỳ trước */
  trends?: Partial<Record<"revenue" | "orders" | "customers" | "items", number>>;
  revenue_by_category?: { name: string; percent: number }[];
  top_products?: {
    id: string;
    name: string;
    sku: string;
    category: string;
    sold: number;
    revenue_vnd: number;
    image_url?: string | null;
  }[];
  sales_channels?: { key: string; name: string; percent: number; orders: number }[];
  active_promotions?: {
    id: string;
    name: string;
    description?: string | null;
    discount_label: string;
    start_at: string;
    end_at: string;
    status: string;
    image_url?: string | null;
  }[];
  recent_posts?: { id: string; title: string; image_url?: string | null; views: number; status: string }[];
  recent_lookbooks?: {
    id: string;
    title: string;
    season?: string | null;
    views: number;
    status: string;
    cover_image_url?: string | null;
  }[];
};
