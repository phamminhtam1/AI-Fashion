import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { discountCodes } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireCustomer } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
import {
  assertCouponApplicable,
  computeDiscountVnd,
  CouponError,
  normalizeCouponCode,
} from "../../lib/discount-codes.js";
import { shippingFeeVnd } from "../../lib/order-pricing.js";

export const storeCouponRoutes = new Hono<AppVars>();
storeCouponRoutes.use("*", requireCustomer);

storeCouponRoutes.post("/preview", async (c) => {
  const body = z
    .object({
      code: z.string().trim().min(1),
      subtotal_vnd: z.number().int().min(0),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Yêu cầu không hợp lệ");

  const code = normalizeCouponCode(body.data.code);
  const db = c.get("db");
  const row = (await db.select().from(discountCodes).where(eq(discountCodes.code, code)).limit(1))[0];
  if (!row) throw new ApiError(400, "coupon_not_found", "Không tìm thấy mã giảm giá");

  const subtotal = body.data.subtotal_vnd;
  try {
    assertCouponApplicable(row, subtotal);
  } catch (e) {
    if (e instanceof CouponError) throw new ApiError(400, e.code, e.message);
    throw e;
  }

  if (row.type !== "percent" && row.type !== "fixed") {
    throw new ApiError(400, "coupon_inactive", "Mã giảm giá không hợp lệ");
  }

  const baseVnd = subtotal + shippingFeeVnd(subtotal);
  const discount_vnd = computeDiscountVnd({
    type: row.type,
    value: row.value,
    baseVnd,
    maxDiscountVnd: row.maxDiscountVnd,
  });

  return c.json({
    code: row.code,
    type: row.type,
    value: row.value,
    discount_vnd,
  });
});
