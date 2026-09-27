import { Hono } from "hono";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  inventoryBalances,
  inventoryDocuments,
  inventoryDocumentLines,
  stockMovements,
  warehouses,
  productVariants,
  productColorways,
  products,
  sizes,
  productMedia,
  mediaAssets,
  orders,
  idempotencyRecords,
  auditLogs,
} from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";
import { defaultDirection, type DocType } from "../../lib/inventory-doc.js";
import { mediaPublicUrl } from "../../lib/media-storage.js";
import { createHash } from "node:crypto";

export const adminInventoryRoutes = new Hono<AppVars>();
adminInventoryRoutes.use("*", requireAuth);

adminInventoryRoutes.get("/", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const wh = await db.select().from(warehouses).where(eq(warehouses.code, "MAIN")).limit(1);
  if (!wh[0]) throw new ApiError(500, "config_error", "Chưa có kho MAIN");
  const rows = await db
    .select({
      warehouse_id: inventoryBalances.warehouseId,
      variant_id: inventoryBalances.variantId,
      sku: productVariants.sku,
      barcode: productVariants.barcode,
      price_vnd: productVariants.priceVnd,
      cost_vnd: productVariants.costVnd,
      product_id: products.id,
      colorway_id: productVariants.colorwayId,
      product_name: products.name,
      color_name: sql<string>`'Màu ' || (${productColorways.sortOrder} + 1)`,
      size_code: sizes.code,
      size_label: sizes.label,
      on_hand: inventoryBalances.onHand,
      reserved: inventoryBalances.reserved,
      available: sql<number>`${inventoryBalances.onHand} - ${inventoryBalances.reserved}`,
      reorder_point: inventoryBalances.reorderPoint,
    })
    .from(inventoryBalances)
    .innerJoin(productVariants, eq(productVariants.id, inventoryBalances.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(productColorways, eq(productColorways.id, productVariants.colorwayId))
    .innerJoin(sizes, eq(sizes.id, productVariants.sizeId))
    .where(
      and(
        eq(inventoryBalances.warehouseId, wh[0].id),
        eq(productVariants.status, "active"),
      ),
    )
    .orderBy(products.name, productVariants.sku)
    .limit(500);

  // Fetch product and colorway images
  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  const covers =
    productIds.length > 0
      ? await db
          .select({
            productId: productMedia.productId,
            colorwayId: productMedia.colorwayId,
            objectKey: mediaAssets.objectKey,
          })
          .from(productMedia)
          .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.assetId))
          .where(inArray(productMedia.productId, productIds))
          .orderBy(desc(productMedia.isCover), productMedia.sortOrder)
      : [];

  const colorwayMap = new Map<string, string>();
  const coverMap = new Map<string, string>();
  for (const cov of covers) {
    const url = mediaPublicUrl(cov.objectKey);
    if (cov.colorwayId && !colorwayMap.has(cov.colorwayId)) {
      colorwayMap.set(cov.colorwayId, url);
    }
    if (!coverMap.has(cov.productId)) {
      coverMap.set(cov.productId, url);
    }
  }

  return c.json({
    warehouse: wh[0],
    items: rows.map((r) => ({
      ...r,
      image_url: (r.colorway_id ? colorwayMap.get(r.colorway_id) : null) ?? coverMap.get(r.product_id) ?? null,
    })),
  });
});

adminInventoryRoutes.get("/documents", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const status = c.req.query("status");
  const type = c.req.query("type");
  const conds = [];
  if (status) conds.push(eq(inventoryDocuments.status, status));
  if (type) conds.push(eq(inventoryDocuments.type, type));
  const rows = await db
    .select({
      id: inventoryDocuments.id,
      code: inventoryDocuments.code,
      type: inventoryDocuments.type,
      status: inventoryDocuments.status,
      reason: inventoryDocuments.reason,
      created_at: inventoryDocuments.createdAt,
      posted_at: inventoryDocuments.postedAt,
      line_count: sql<number>`(
        select count(*)::int from inventory_document_lines l
        where l.document_id = inventory_documents.id
      )`,
      total_qty: sql<number>`(
        select coalesce(sum(l.qty), 0)::int from inventory_document_lines l
        where l.document_id = inventory_documents.id
      )`,
    })
    .from(inventoryDocuments)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(inventoryDocuments.createdAt))
    .limit(200);
  return c.json({ items: rows });
});

adminInventoryRoutes.get("/documents/:id", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const docs = await db
    .select()
    .from(inventoryDocuments)
    .where(eq(inventoryDocuments.id, c.req.param("id")))
    .limit(1);
  if (!docs[0]) throw new ApiError(404, "not_found", "Không tìm thấy phiếu");
  const lines = await db
    .select({
      id: inventoryDocumentLines.id,
      variant_id: inventoryDocumentLines.variantId,
      product_id: products.id,
      colorway_id: productVariants.colorwayId,
      barcode: productVariants.barcode,
      qty: inventoryDocumentLines.qty,
      direction: inventoryDocumentLines.direction,
      unit_cost_vnd: inventoryDocumentLines.unitCostVnd,
      sku: productVariants.sku,
      product_name: products.name,
      color_name: sql<string>`'Màu ' || (${productColorways.sortOrder} + 1)`,
      size_label: sizes.label,
    })
    .from(inventoryDocumentLines)
    .innerJoin(productVariants, eq(productVariants.id, inventoryDocumentLines.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(productColorways, eq(productColorways.id, productVariants.colorwayId))
    .innerJoin(sizes, eq(sizes.id, productVariants.sizeId))
    .where(eq(inventoryDocumentLines.documentId, docs[0].id));

  const pIds = Array.from(new Set(lines.map((l) => l.product_id)));
  const covers =
    pIds.length > 0
      ? await db
          .select({
            productId: productMedia.productId,
            colorwayId: productMedia.colorwayId,
            objectKey: mediaAssets.objectKey,
          })
          .from(productMedia)
          .innerJoin(mediaAssets, eq(mediaAssets.id, productMedia.assetId))
          .where(inArray(productMedia.productId, pIds))
          .orderBy(desc(productMedia.isCover), productMedia.sortOrder)
      : [];

  const colorwayMap = new Map<string, string>();
  const coverMap = new Map<string, string>();
  for (const cov of covers) {
    const url = mediaPublicUrl(cov.objectKey);
    if (cov.colorwayId && !colorwayMap.has(cov.colorwayId)) {
      colorwayMap.set(cov.colorwayId, url);
    }
    if (!coverMap.has(cov.productId)) {
      coverMap.set(cov.productId, url);
    }
  }

  const d = docs[0];
  return c.json({
    id: d.id,
    code: d.code,
    type: d.type,
    status: d.status,
    reason: d.reason,
    created_at: d.createdAt,
    posted_at: d.postedAt,
    requested_by: d.requestedBy,
    approved_by: d.approvedBy,
    lines: lines.map((l) => ({
      ...l,
      image_url: (l.colorway_id ? colorwayMap.get(l.colorway_id) : null) ?? coverMap.get(l.product_id) ?? null,
    })),
  });
});

adminInventoryRoutes.post("/documents", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "inventory.receive");
  const body = z
    .object({
      type: z.enum(["receipt", "issue", "adjustment"]),
      reason: z.string().default(""),
      order_id: z.string().uuid().optional(),
      lines: z
        .array(
          z.object({
            variant_id: z.string().uuid(),
            qty: z.number().int().positive(),
            direction: z.enum(["in", "out"]).default("in"),
            unit_cost_vnd: z.number().int().nonnegative().optional(),
          }),
        )
        .min(1),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu phiếu không hợp lệ");

  const db = c.get("db");

  if (body.data.order_id && body.data.type === "issue") {
    const [linkedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, body.data.order_id))
      .limit(1);
    if (linkedOrder) {
      if (linkedOrder.status === "cancelled") {
        throw new ApiError(400, "invalid_state", "Không thể tạo phiếu xuất kho cho đơn hàng đã bị hủy");
      }
      const isPaidOrCod = linkedOrder.paymentStatus === "paid" || linkedOrder.paymentMethod === "cod";
      if (!isPaidOrCod) {
        throw new ApiError(400, "unpaid_order", "Chỉ những đơn hàng thanh toán thành công hoặc COD mới được xuất kho");
      }
    }
  }

  const wh = await db.select().from(warehouses).where(eq(warehouses.code, "MAIN")).limit(1);
  const code = `INV-${Date.now()}`;
  const [doc] = await db
    .insert(inventoryDocuments)
    .values({
      code,
      type: body.data.type,
      status: "draft",
      reason: body.data.reason,
      requestedBy: user.accountId,
      targetWarehouseId: body.data.type === "receipt" ? wh[0]!.id : null,
      sourceWarehouseId: body.data.type === "issue" ? wh[0]!.id : wh[0]!.id,
    })
    .returning();

  for (const line of body.data.lines) {
    await db.insert(inventoryDocumentLines).values({
      documentId: doc!.id,
      variantId: line.variant_id,
      qty: line.qty,
      direction: defaultDirection(body.data.type as DocType, line.direction),
      unitCostVnd: line.unit_cost_vnd,
    });
  }

  if (body.data.order_id) {
    await db
      .update(orders)
      .set({
        inventoryDocId: doc!.id,
        inventoryDocCode: doc!.code,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, body.data.order_id));
  }

  return c.json({ id: doc!.id, code: doc!.code, status: doc!.status }, 201);
});

adminInventoryRoutes.post("/documents/:id/approve", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "inventory.adjust.approve");
  const db = c.get("db");
  const docs = await db.select().from(inventoryDocuments).where(eq(inventoryDocuments.id, c.req.param("id"))).limit(1);
  if (!docs[0]) throw new ApiError(404, "not_found", "Không tìm thấy phiếu");
  if (docs[0].status !== "draft") throw new ApiError(409, "invalid_state", "Chỉ duyệt phiếu nháp");
  const [doc] = await db
    .update(inventoryDocuments)
    .set({ status: "approved", approvedBy: user.accountId, updatedAt: new Date() })
    .where(eq(inventoryDocuments.id, docs[0].id))
    .returning();
  return c.json({ id: doc!.id, status: doc!.status });
});

adminInventoryRoutes.post("/documents/:id/post", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "inventory.adjust.approve");
  const idemKey = c.req.header("idempotency-key");
  if (!idemKey) throw new ApiError(400, "idempotency_required", "Cần header Idempotency-Key");

  const db = c.get("db");
  const scope = `inventory_post:${c.req.param("id")}`;
  const requestHash = createHash("sha256").update(idemKey).digest("hex");

  const existingIdem = await db
    .select()
    .from(idempotencyRecords)
    .where(and(eq(idempotencyRecords.scope, scope), eq(idempotencyRecords.key, idemKey)))
    .limit(1);
  if (existingIdem[0]) {
    if (existingIdem[0].requestHash !== requestHash) {
      throw new ApiError(409, "idempotency_conflict", "Idempotency key đã dùng với payload khác");
    }
    return c.json({ id: existingIdem[0].resourceId, status: "posted", idempotent_replay: true });
  }

  const docs = await db.select().from(inventoryDocuments).where(eq(inventoryDocuments.id, c.req.param("id"))).limit(1);
  if (!docs[0]) throw new ApiError(404, "not_found", "Không tìm thấy phiếu");
  if (docs[0].status === "posted") throw new ApiError(409, "already_posted", "Phiếu đã ghi sổ");
  if (docs[0].status !== "approved" && docs[0].status !== "draft") {
    throw new ApiError(409, "invalid_state", "Trạng thái phiếu không hợp lệ để ghi sổ");
  }

  const wh = await db.select().from(warehouses).where(eq(warehouses.code, "MAIN")).limit(1);
  const warehouseId = wh[0]!.id;
  const lines = await db
    .select()
    .from(inventoryDocumentLines)
    .where(eq(inventoryDocumentLines.documentId, docs[0].id));

  await db.transaction(async (tx) => {
    for (const line of lines) {
      const isIssue = docs[0]!.type === "issue" || line.direction === "out";
      const delta = isIssue ? -line.qty : line.qty;
      const bal = await tx
        .select()
        .from(inventoryBalances)
        .where(and(eq(inventoryBalances.warehouseId, warehouseId), eq(inventoryBalances.variantId, line.variantId)))
        .limit(1)
        .for("update");

      if (!bal[0]) {
        if (delta < 0) throw new ApiError(409, "insufficient_stock", "Không đủ tồn");
        await tx.insert(inventoryBalances).values({
          warehouseId,
          variantId: line.variantId,
          onHand: delta,
          reserved: 0,
          reorderPoint: 5,
        });
      } else {
        const next = bal[0].onHand + delta;
        if (next < 0) throw new ApiError(409, "insufficient_stock", "Không đủ tồn kho");
        // When issuing/exporting goods for an order, release the corresponding reserved stock
        const nextReserved = isIssue ? Math.max(0, bal[0].reserved - line.qty) : bal[0].reserved;
        if (nextReserved > next) throw new ApiError(409, "insufficient_stock", "Không đủ tồn kho");

        await tx
          .update(inventoryBalances)
          .set({ onHand: next, reserved: nextReserved, updatedAt: new Date() })
          .where(and(eq(inventoryBalances.warehouseId, warehouseId), eq(inventoryBalances.variantId, line.variantId)));
      }

      await tx.insert(stockMovements).values({
        documentLineId: line.id,
        warehouseId,
        variantId: line.variantId,
        deltaQty: delta,
        unitCostVnd: line.unitCostVnd,
        operationKey: `doc:${docs[0]!.id}:line:${line.id}`,
      });
    }

    await tx
      .update(inventoryDocuments)
      .set({
        status: "posted",
        postedAt: new Date(),
        approvedBy: docs[0]!.approvedBy ?? user.accountId,
        updatedAt: new Date(),
      })
      .where(eq(inventoryDocuments.id, docs[0]!.id));

    if (docs[0]!.type === "issue") {
      await tx
        .update(orders)
        .set({
          fulfillmentStatus: "fulfilled",
          fulfilledAt: new Date(),
          inventoryDocId: docs[0]!.id,
          inventoryDocCode: docs[0]!.code,
          updatedAt: new Date(),
        })
        .where(
          or(
            eq(orders.inventoryDocId, docs[0]!.id),
            sql`POSITION(${orders.orderNumber} IN ${docs[0]!.reason}) > 0`,
          ),
        );
    }

    await tx.insert(idempotencyRecords).values({
      scope,
      key: idemKey,
      requestHash,
      resourceId: docs[0]!.id,
      responseStatus: 200,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    await tx.insert(auditLogs).values({
      actorAccountId: user.accountId,
      action: "inventory.post",
      resourceType: "inventory_document",
      resourceId: docs[0]!.id,
      requestId: requestId(c),
    });
  });

  return c.json({ id: docs[0].id, status: "posted" });
});

adminInventoryRoutes.delete("/documents/:id", async (c) => {
  const user = c.get("user")!;
  const db = c.get("db");
  const docs = await db
    .select()
    .from(inventoryDocuments)
    .where(eq(inventoryDocuments.id, c.req.param("id")))
    .limit(1);
  if (!docs[0]) throw new ApiError(404, "not_found", "Không tìm thấy phiếu");
  if (docs[0].status === "void") throw new ApiError(404, "not_found", "Phiếu đã hủy");

  const posted = docs[0].status === "posted";
  if (posted) requirePerm(user, "inventory.adjust.approve");
  else requirePerm(user, "inventory.receive");

  const lines = await db
    .select()
    .from(inventoryDocumentLines)
    .where(eq(inventoryDocumentLines.documentId, docs[0].id));
  const lineIds = lines.map((l) => l.id);

  await db.transaction(async (tx) => {
    if (posted && lineIds.length) {
      const movements = await tx
        .select()
        .from(stockMovements)
        .where(inArray(stockMovements.documentLineId, lineIds));

      for (const m of movements) {
        const reverse = -m.deltaQty;
        const bal = await tx
          .select()
          .from(inventoryBalances)
          .where(
            and(eq(inventoryBalances.warehouseId, m.warehouseId), eq(inventoryBalances.variantId, m.variantId)),
          )
          .limit(1)
          .for("update");

        if (!bal[0]) {
          if (reverse < 0) throw new ApiError(409, "insufficient_stock", "Không đảo được tồn — thiếu dòng cân đối");
          if (reverse > 0) {
            await tx.insert(inventoryBalances).values({
              warehouseId: m.warehouseId,
              variantId: m.variantId,
              onHand: reverse,
              reserved: 0,
              reorderPoint: 5,
            });
          }
        } else {
          const next = bal[0].onHand + reverse;
          if (next < 0 || bal[0].reserved > next) {
            throw new ApiError(409, "insufficient_stock", "Không đảo được tồn — sẽ âm hoặc không đủ sau khi xóa phiếu");
          }
          if (next === 0 && bal[0].reserved === 0) {
            await tx
              .delete(inventoryBalances)
              .where(
                and(
                  eq(inventoryBalances.warehouseId, m.warehouseId),
                  eq(inventoryBalances.variantId, m.variantId),
                ),
              );
          } else {
            await tx
              .update(inventoryBalances)
              .set({ onHand: next, updatedAt: new Date() })
              .where(
                and(
                  eq(inventoryBalances.warehouseId, m.warehouseId),
                  eq(inventoryBalances.variantId, m.variantId),
                ),
              );
          }
        }

        await tx.delete(stockMovements).where(eq(stockMovements.id, m.id));
      }
    }

    if (lineIds.length) {
      await tx.delete(inventoryDocumentLines).where(inArray(inventoryDocumentLines.id, lineIds));
    }
    await tx.delete(inventoryDocuments).where(eq(inventoryDocuments.id, docs[0]!.id));

    await tx.insert(auditLogs).values({
      actorAccountId: user.accountId,
      action: posted ? "inventory.delete_posted" : "inventory.delete",
      resourceType: "inventory_document",
      resourceId: docs[0]!.id,
      beforeRedacted: { code: docs[0]!.code, status: docs[0]!.status, type: docs[0]!.type },
      requestId: requestId(c),
    });
  });

  return c.json({ id: docs[0].id, deleted: true, reversed_stock: posted });
});
