import {
  createDb,
  orders,
  orderItems,
  inventoryBalances,
  warehouses,
  discountCodes,
} from "@elane/db";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { env } from "../env.js";

const db = createDb(env.databaseUrl);

// Thời gian chờ thanh toán trước khi tự động hủy (15 phút)
export const ORDER_EXPIRATION_MINUTES = 15;
// Chu kỳ quét kiểm tra (mỗi 60 giây)
export const SCAN_INTERVAL_MS = 60 * 1000;

export async function checkAndExpirePendingBankOrders(): Promise<number> {
  const expiryCutoff = new Date(Date.now() - ORDER_EXPIRATION_MINUTES * 60 * 1000);

  // Tìm các đơn thanh toán chuyển khoản ngân hàng ("bank")
  // đang ở trạng thái pending/awaiting và đã tạo quá 15 phút trước
  const expiredCandidates = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      discountCodeId: orders.discountCodeId,
      placedAt: orders.placedAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        eq(orders.paymentMethod, "bank"),
        inArray(orders.paymentStatus, ["awaiting", "unpaid"]),
        lt(orders.placedAt, expiryCutoff),
      ),
    )
    .limit(50);

  if (expiredCandidates.length === 0) {
    return 0;
  }

  const wh = (await db.select().from(warehouses).where(eq(warehouses.code, "MAIN")).limit(1))[0];
  const warehouseId = wh?.id;

  let cancelledCount = 0;

  for (const candidate of expiredCandidates) {
    try {
      await db.transaction(async (tx) => {
        // 1. Chuyển trạng thái đơn sang 'cancelled' và 'failed'
        const [cancelled] = await tx
          .update(orders)
          .set({
            status: "cancelled",
            paymentStatus: "failed",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(orders.id, candidate.id),
              eq(orders.status, "pending"),
              inArray(orders.paymentStatus, ["awaiting", "unpaid"]),
            ),
          )
          .returning({ id: orders.id, orderNumber: orders.orderNumber });

        // Nếu đơn đã được cập nhật trước đó (ví dụ webhook SePay vừa đánh dấu paid)
        if (!cancelled) {
          return;
        }

        // 2. Nhả kho: trừ lượng giữ chỗ reserved trong inventoryBalances
        const items = await tx
          .select({
            variantId: orderItems.variantId,
            qty: orderItems.qty,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, candidate.id));

        for (const it of items) {
          if (warehouseId) {
            await tx
              .update(inventoryBalances)
              .set({
                reserved: sql`GREATEST(0, ${inventoryBalances.reserved} - ${it.qty})`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(inventoryBalances.warehouseId, warehouseId),
                  eq(inventoryBalances.variantId, it.variantId),
                ),
              );
          } else {
            await tx
              .update(inventoryBalances)
              .set({
                reserved: sql`GREATEST(0, ${inventoryBalances.reserved} - ${it.qty})`,
                updatedAt: new Date(),
              })
              .where(eq(inventoryBalances.variantId, it.variantId));
          }
        }

        // 3. Hoàn lại lượt dùng mã giảm giá nếu có
        if (candidate.discountCodeId) {
          await tx
            .update(discountCodes)
            .set({
              usageCount: sql`GREATEST(0, ${discountCodes.usageCount} - 1)`,
              updatedAt: new Date(),
            })
            .where(eq(discountCodes.id, candidate.discountCodeId));
        }

        cancelledCount++;
        console.log(
          `[order-expiry-worker] Đã tự động hủy đơn #${candidate.orderNumber} do quá hạn ${ORDER_EXPIRATION_MINUTES} phút chưa thanh toán. Đã nhả tồn kho cho ${items.length} mặt hàng.`,
        );
      });
    } catch (err) {
      console.error(
        `[order-expiry-worker] Lỗi khi xử lý hủy đơn #${candidate.orderNumber}:`,
        err,
      );
    }
  }

  return cancelledCount;
}

let scanIntervalTimer: NodeJS.Timeout | null = null;

export function startOrderExpiryWorker() {
  console.log(
    `[order-expiry-worker] Tiến trình tự động hủy đơn quá hạn đã kích hoạt (chu kỳ: ${SCAN_INTERVAL_MS / 1000}s, hạn giữ đơn: ${ORDER_EXPIRATION_MINUTES} phút)`,
  );

  // Chạy lần quét đầu tiên sau 5 giây khi server khởi động
  setTimeout(() => {
    void checkAndExpirePendingBankOrders();
  }, 5000);

  scanIntervalTimer = setInterval(() => {
    void checkAndExpirePendingBankOrders();
  }, SCAN_INTERVAL_MS);
}

// Tự động khởi chạy worker khi import
startOrderExpiryWorker();
