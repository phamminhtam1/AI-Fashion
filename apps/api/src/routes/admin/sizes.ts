import { Hono } from "hono";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import {
  sizes,
  sizeCharts,
  sizeChartMeasurements,
  productVariants,
  products,
  auditLogs,
} from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";

export const adminSizeRoutes = new Hono<AppVars>();
adminSizeRoutes.use("*", requireAuth);

function codeify(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

async function chartPayload(db: AppVars["Variables"]["db"], chartId: string) {
  const charts = await db.select().from(sizeCharts).where(eq(sizeCharts.id, chartId)).limit(1);
  if (!charts[0]) return null;
  const meas = await db
    .select({
      id: sizeChartMeasurements.id,
      size_id: sizeChartMeasurements.sizeId,
      size_code: sizes.code,
      size_label: sizes.label,
      measurement_code: sizeChartMeasurements.measurementCode,
      min_value: sizeChartMeasurements.minValue,
      max_value: sizeChartMeasurements.maxValue,
    })
    .from(sizeChartMeasurements)
    .innerJoin(sizes, eq(sizes.id, sizeChartMeasurements.sizeId))
    .where(eq(sizeChartMeasurements.sizeChartId, chartId))
    .orderBy(asc(sizes.sortOrder));

  const [used] = await db.select({ n: count() }).from(products).where(eq(products.sizeChartId, chartId));

  return {
    id: charts[0].id,
    name: charts[0].name,
    unit: charts[0].unit,
    instructions: charts[0].instructions,
    product_count: Number(used?.n ?? 0),
    measurements: meas.map((m) => ({
      id: m.id,
      size_id: m.size_id,
      size_code: m.size_code,
      size_label: m.size_label,
      measurement_code: m.measurement_code,
      min_value: Number(m.min_value),
      max_value: Number(m.max_value),
    })),
  };
}

// --- sizes ---
adminSizeRoutes.get("/sizes", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const rows = await db.select().from(sizes).orderBy(asc(sizes.sortOrder), asc(sizes.code));
  const items = [];
  for (const row of rows) {
    const [pc] = await db.select({ n: count() }).from(productVariants).where(eq(productVariants.sizeId, row.id));
    items.push({
      id: row.id,
      code: row.code,
      label: row.label,
      sort_order: row.sortOrder,
      variant_count: Number(pc?.n ?? 0),
    });
  }
  return c.json({ items });
});

adminSizeRoutes.post("/sizes", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const body = z
    .object({
      code: z.string().min(1).optional(),
      label: z.string().min(1),
      sort_order: z.number().int().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu size không hợp lệ");

  const db = c.get("db");
  const code = (body.data.code?.trim() || codeify(body.data.label)).toUpperCase();
  const clash = await db.select().from(sizes).where(eq(sizes.code, code)).limit(1);
  if (clash[0]) throw new ApiError(409, "code_taken", "Mã size đã tồn tại");

  const [row] = await db
    .insert(sizes)
    .values({
      code,
      label: body.data.label.trim(),
      sortOrder: body.data.sort_order ?? 50,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "size.create",
    resourceType: "size",
    resourceId: row!.id,
    afterRedacted: { code: row!.code, label: row!.label },
    requestId: requestId(c),
  });
  return c.json(
    { id: row!.id, code: row!.code, label: row!.label, sort_order: row!.sortOrder, variant_count: 0 },
    201,
  );
});

adminSizeRoutes.patch("/sizes/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const body = z
    .object({
      code: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      sort_order: z.number().int().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu size không hợp lệ");

  const db = c.get("db");
  const existing = await db.select().from(sizes).where(eq(sizes.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy size");

  let code = existing[0].code;
  if (body.data.code) {
    code = body.data.code.trim().toUpperCase();
    const clash = await db
      .select()
      .from(sizes)
      .where(and(eq(sizes.code, code), ne(sizes.id, existing[0].id)))
      .limit(1);
    if (clash[0]) throw new ApiError(409, "code_taken", "Mã size đã tồn tại");
  }

  const [row] = await db
    .update(sizes)
    .set({
      code,
      label: body.data.label?.trim() ?? existing[0].label,
      sortOrder: body.data.sort_order ?? existing[0].sortOrder,
    })
    .where(eq(sizes.id, existing[0].id))
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "size.update",
    resourceType: "size",
    resourceId: row!.id,
    requestId: requestId(c),
  });
  const [pc] = await db.select({ n: count() }).from(productVariants).where(eq(productVariants.sizeId, row!.id));
  return c.json({
    id: row!.id,
    code: row!.code,
    label: row!.label,
    sort_order: row!.sortOrder,
    variant_count: Number(pc?.n ?? 0),
  });
});

adminSizeRoutes.delete("/sizes/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const existing = await db.select().from(sizes).where(eq(sizes.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy size");

  const [pc] = await db.select({ n: count() }).from(productVariants).where(eq(productVariants.sizeId, existing[0].id));
  if (Number(pc?.n ?? 0) > 0) {
    throw new ApiError(409, "in_use", `Size đang dùng ở ${pc!.n} biến thể — không thể xóa`);
  }

  await db.delete(sizeChartMeasurements).where(eq(sizeChartMeasurements.sizeId, existing[0].id));
  await db.delete(sizes).where(eq(sizes.id, existing[0].id));
  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "size.delete",
    resourceType: "size",
    resourceId: existing[0].id,
    beforeRedacted: { code: existing[0].code, label: existing[0].label },
    requestId: requestId(c),
  });
  return c.json({ id: existing[0].id, deleted: true });
});

// --- size charts ---
adminSizeRoutes.get("/size-charts", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const charts = await db.select().from(sizeCharts).orderBy(asc(sizeCharts.name));
  const items = [];
  for (const ch of charts) {
    const payload = await chartPayload(db, ch.id);
    if (payload) items.push(payload);
  }
  return c.json({ items });
});

adminSizeRoutes.get("/size-charts/:id", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const payload = await chartPayload(c.get("db"), c.req.param("id"));
  if (!payload) throw new ApiError(404, "not_found", "Không tìm thấy bảng size");
  return c.json(payload);
});

adminSizeRoutes.post("/size-charts", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const body = z
    .object({
      name: z.string().min(1),
      unit: z.string().default("cm"),
      instructions: z.string().nullable().optional(),
      measurements: z
        .array(
          z.object({
            size_id: z.string().uuid(),
            measurement_code: z.string().min(1),
            min_value: z.number(),
            max_value: z.number(),
          }),
        )
        .default([]),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu bảng size không hợp lệ");

  for (const m of body.data.measurements) {
    if (m.min_value > m.max_value) throw new ApiError(400, "validation_error", "min_value phải ≤ max_value");
  }

  const db = c.get("db");
  const [chart] = await db
    .insert(sizeCharts)
    .values({
      name: body.data.name.trim(),
      unit: body.data.unit || "cm",
      instructions: body.data.instructions ?? null,
    })
    .returning();

  for (const m of body.data.measurements) {
    await db.insert(sizeChartMeasurements).values({
      sizeChartId: chart!.id,
      sizeId: m.size_id,
      measurementCode: m.measurement_code,
      minValue: String(m.min_value),
      maxValue: String(m.max_value),
    });
  }

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "size_chart.create",
    resourceType: "size_chart",
    resourceId: chart!.id,
    afterRedacted: { name: chart!.name },
    requestId: requestId(c),
  });

  return c.json(await chartPayload(db, chart!.id), 201);
});

adminSizeRoutes.patch("/size-charts/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const body = z
    .object({
      name: z.string().min(1).optional(),
      unit: z.string().optional(),
      instructions: z.string().nullable().optional(),
      measurements: z
        .array(
          z.object({
            size_id: z.string().uuid(),
            measurement_code: z.string().min(1),
            min_value: z.number(),
            max_value: z.number(),
          }),
        )
        .optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu bảng size không hợp lệ");

  const db = c.get("db");
  const existing = await db.select().from(sizeCharts).where(eq(sizeCharts.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy bảng size");

  await db
    .update(sizeCharts)
    .set({
      name: body.data.name?.trim() ?? existing[0].name,
      unit: body.data.unit ?? existing[0].unit,
      instructions: body.data.instructions !== undefined ? body.data.instructions : existing[0].instructions,
      updatedAt: new Date(),
    })
    .where(eq(sizeCharts.id, existing[0].id));

  if (body.data.measurements) {
    for (const m of body.data.measurements) {
      if (m.min_value > m.max_value) throw new ApiError(400, "validation_error", "min_value phải ≤ max_value");
    }
    await db.delete(sizeChartMeasurements).where(eq(sizeChartMeasurements.sizeChartId, existing[0].id));
    for (const m of body.data.measurements) {
      await db.insert(sizeChartMeasurements).values({
        sizeChartId: existing[0].id,
        sizeId: m.size_id,
        measurementCode: m.measurement_code,
        minValue: String(m.min_value),
        maxValue: String(m.max_value),
      });
    }
  }

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "size_chart.update",
    resourceType: "size_chart",
    resourceId: existing[0].id,
    requestId: requestId(c),
  });

  return c.json(await chartPayload(db, existing[0].id));
});

adminSizeRoutes.delete("/size-charts/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const existing = await db.select().from(sizeCharts).where(eq(sizeCharts.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy bảng size");

  const [used] = await db.select({ n: count() }).from(products).where(eq(products.sizeChartId, existing[0].id));
  if (Number(used?.n ?? 0) > 0) {
    throw new ApiError(409, "in_use", `Bảng size đang gắn ${used!.n} sản phẩm`);
  }

  await db.delete(sizeChartMeasurements).where(eq(sizeChartMeasurements.sizeChartId, existing[0].id));
  await db.delete(sizeCharts).where(eq(sizeCharts.id, existing[0].id));
  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "size_chart.delete",
    resourceType: "size_chart",
    resourceId: existing[0].id,
    beforeRedacted: { name: existing[0].name },
    requestId: requestId(c),
  });
  return c.json({ id: existing[0].id, deleted: true });
});
