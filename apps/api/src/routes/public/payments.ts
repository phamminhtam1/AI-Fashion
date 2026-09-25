import { Hono } from "hono";
import { env } from "../../env.js";
import { ApiError } from "../../lib/errors.js";
import type { AppVars } from "../../middleware/auth.js";

export const publicPaymentRoutes = new Hono<AppVars>();

publicPaymentRoutes.get("/payments/bank-info", (c) => {
  if (!env.sepayBankAccount || !env.sepayBankBin) {
    throw new ApiError(503, "not_configured", "Chưa cấu hình tài khoản ngân hàng");
  }
  return c.json({
    account_number: env.sepayBankAccount,
    account_name: env.sepayAccountName,
    bank_name: env.sepayBankName,
    bank_bin: env.sepayBankBin,
  });
});
