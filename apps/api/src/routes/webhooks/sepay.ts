import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { orders, sepayWebhookEvents } from "@elane/db";
import { env } from "../../env.js";
import { markOrderPaid } from "../../lib/mark-order-paid.js";
import {
  extractOrderNumber,
  shouldConfirmBankPayment,
  verifySepayHmac,
} from "../../lib/sepay.js";
import type { AppVars } from "../../middleware/auth.js";

export const sepayWebhookRoutes = new Hono<AppVars>();

sepayWebhookRoutes.post("/webhooks/sepay", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("x-sepay-signature") ?? "";
  const timestamp = c.req.header("x-sepay-timestamp") ?? "";
  if (!verifySepayHmac(rawBody, signature, timestamp, env.sepayWebhookSecret)) {
    return c.json({ success: false, message: "Invalid signature" }, 401);
  }

  let data: {
    id?: number;
    transferType?: string;
    transferAmount?: number;
    code?: string | null;
    content?: string;
  };
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    return c.json({ success: false, message: "Invalid JSON" }, 400);
  }
  if (typeof data.id !== "number") {
    return c.json({ success: false, message: "Invalid payload" }, 400);
  }

  const db = c.get("db");
  const inserted = await db
    .insert(sepayWebhookEvents)
    .values({
      sepayId: data.id,
      payload: data as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: sepayWebhookEvents.sepayId })
    .returning({ id: sepayWebhookEvents.id });

  if (!inserted[0]) {
    return c.json({ success: true });
  }

  const content = data.content ?? "";
  const code = data.code ?? null;
  const orderNumber = extractOrderNumber(code, content);
  if (data.transferType === "in" && orderNumber && typeof data.transferAmount === "number") {
    const order = (
      await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1)
    )[0];
    if (
      order &&
      order.paymentMethod === "bank" &&
      order.paymentStatus === "awaiting" &&
      shouldConfirmBankPayment({
        transferType: data.transferType,
        transferAmount: data.transferAmount,
        orderGrandTotal: order.grandTotalVnd,
        orderNumber: order.orderNumber,
        code,
        content,
      })
    ) {
      const ok = await markOrderPaid(db, order.id, String(data.id));
      if (ok) {
        await db
          .update(sepayWebhookEvents)
          .set({ matchedOrderId: order.id })
          .where(eq(sepayWebhookEvents.id, inserted[0].id));
      }
    }
  }

  return c.json({ success: true });
});
