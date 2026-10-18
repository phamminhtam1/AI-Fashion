import type { AdminLookbook } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Các field mở rộng cho Lookbook theo thiết kế mới.
 */
export type LookbookExt = AdminLookbook & {
  year?: number | null;
  created_at?: string | null;
  published_at?: string | null;
  unpublish_at?: string | null;
  unpublish_enabled?: boolean;
  view_count?: number | null;
  product_count?: number | null;
  intro_content?: string | null;
  show_on_home?: boolean | null;
  allow_products?: boolean | null;
  attached_products?: Array<{
    id: string;
    name: string;
    slug?: string | null;
    sku?: string | null;
    image_url?: string | null;
  }> | null;
};

export const SEASONS = ["Xuân", "Hè", "Thu", "Đông"] as const;

export function seasonYears() {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y, y + 1, y + 2].map(String);
}

/**
 * Tách mùa & năm từ Lookbook.
 * Nếu đã có field `year` thì ưu tiên dùng, nếu chưa có thì bóc tách từ chuỗi `season` (VD: "Xuân 2026").
 */
export function parseSeason(lb?: LookbookExt | null): { season: string; year: string } {
  const fallbackYear = String(lb?.year ?? new Date().getFullYear());
  const m = lb?.season?.match(/(Xuân|Hè|Thu|Đông)\s*(\d{4})?/i);
  return {
    season: m ? SEASONS.find((s) => s.toLowerCase() === m[1].toLowerCase()) ?? "Xuân" : (lb?.season || "Xuân"),
    year: lb?.year ? String(lb.year) : (m?.[2] ?? fallbackYear),
  };
}

export const buildSeason = (season: string, year: string) => `${season} ${year}`.trim();

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatDateParts(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

/** ISO -> giá trị cho <input type="date"> và <input type="time"> */
export function toDateInputs(iso?: string | null) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const STATUS_MAP = {
  published: {
    label: "Đã xuất bản",
    cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  scheduled: {
    label: "Sắp ra mắt",
    cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  draft: {
    label: "Bản nháp",
    cls: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  archived: {
    label: "Đã lưu trữ",
    cls: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400",
  },
} as const;

export function StatusPill({ status, className }: { status?: string | null; className?: string }) {
  const s = STATUS_MAP[(status as keyof typeof STATUS_MAP) ?? "draft"] ?? STATUS_MAP.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        s.cls,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
