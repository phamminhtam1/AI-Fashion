import { Hono } from "hono";
import { eq, or } from "drizzle-orm";
import { orders } from "@elane/db";
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
    // short_name for SePay/VietQR — MSB bắt buộc QR gắn VA (acc = số VA)
    bank_code: env.sepayBankName || "MSB",
  });
});

publicPaymentRoutes.get("/payments/order-status/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const condition = isUuid ? eq(orders.id, id) : eq(orders.orderNumber, id.toUpperCase());

  const order = (
    await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        grandTotalVnd: orders.grandTotalVnd,
        paidAt: orders.paidAt,
      })
      .from(orders)
      .where(condition)
      .limit(1)
  )[0];

  if (!order) {
    throw new ApiError(404, "not_found", "Không tìm thấy đơn hàng");
  }

  const isPaid =
    order.paymentStatus === "paid" ||
    ["confirmed", "processing", "shipping", "completed"].includes(order.status);

  c.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");

  return c.json({
    id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    payment_status: order.paymentStatus,
    payment_method: order.paymentMethod,
    grand_total_vnd: order.grandTotalVnd,
    paid_at: order.paidAt,
    is_paid: isPaid,
  });
});

