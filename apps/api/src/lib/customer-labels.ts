export type CustomerSegment = "new" | "loyal" | "vip";

/** Spend tiers (VND): <15M new · 15–50M loyal · >50M vip */
export const SPEND_LOYAL_MIN = 15_000_000;
export const SPEND_VIP_MIN = 50_000_000;

const SEGMENT_VI: Record<CustomerSegment, string> = {
  new: "Mới",
  loyal: "Thân thiết",
  vip: "VIP",
};

export function segmentFromSpend(totalSpentVnd: number): CustomerSegment {
  const n = Number(totalSpentVnd) || 0;
  if (n > SPEND_VIP_MIN) return "vip";
  if (n >= SPEND_LOYAL_MIN) return "loyal";
  return "new";
}

export function segmentLabelVi(seg: string): string {
  return SEGMENT_VI[seg as CustomerSegment] ?? seg;
}

export function statusLabelVi(status: string): string {
  if (status === "active") return "Đang hoạt động";
  if (status === "blocked") return "Đã khóa";
  return status;
}

export function normalizeCountSeries(
  rows: Array<{ key: string; count: number }>,
  keys: string[],
): Array<{ key: string; count: number }> {
  const map = new Map(rows.map((r) => [r.key, r.count]));
  return keys.map((key) => ({ key, count: map.get(key) ?? 0 }));
}
