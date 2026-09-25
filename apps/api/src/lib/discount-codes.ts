/** Pure discount-code helpers. */

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

export function computeDiscountVnd(args: {
  type: "percent" | "fixed";
  value: number;
  subtotalVnd: number;
  maxDiscountVnd: number | null;
}): number {
  const { type, value, subtotalVnd, maxDiscountVnd } = args;
  let raw = type === "percent" ? Math.floor((subtotalVnd * value) / 100) : value;
  if (type === "percent" && maxDiscountVnd != null) raw = Math.min(raw, maxDiscountVnd);
  return Math.max(0, Math.min(raw, subtotalVnd));
}

export type CouponRow = {
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  minOrderVnd: number;
  usageLimit: number | null;
  usageCount: number;
  type: string;
  value: number;
  maxDiscountVnd: number | null;
};

export type CouponFailCode =
  | "coupon_not_found"
  | "coupon_inactive"
  | "coupon_not_started"
  | "coupon_expired"
  | "coupon_min_order"
  | "coupon_exhausted";

export class CouponError extends Error {
  code: CouponFailCode;
  constructor(code: CouponFailCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function assertCouponApplicable(row: CouponRow, subtotalVnd: number, now = new Date()): void {
  if (row.status !== "active") throw new CouponError("coupon_inactive", "Mã giảm giá không còn hiệu lực");
  if (row.startsAt && now < row.startsAt) throw new CouponError("coupon_not_started", "Mã giảm giá chưa bắt đầu");
  if (row.endsAt && now > row.endsAt) throw new CouponError("coupon_expired", "Mã giảm giá đã hết hạn");
  if (subtotalVnd < row.minOrderVnd) {
    throw new CouponError(
      "coupon_min_order",
      `Đơn tối thiểu ${row.minOrderVnd.toLocaleString("vi-VN")}₫`,
    );
  }
  if (row.usageLimit != null && row.usageCount >= row.usageLimit) {
    throw new CouponError("coupon_exhausted", "Mã giảm giá đã hết lượt dùng");
  }
}
