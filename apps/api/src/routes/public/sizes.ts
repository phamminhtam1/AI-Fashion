import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { sizeCharts, sizeChartMeasurements, sizes } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";

export const publicSizeRoutes = new Hono<AppVars>();

async function loadChart(db: AppVars["Variables"]["db"], id: string) {
  const charts = await db.select().from(sizeCharts).where(eq(sizeCharts.id, id)).limit(1);
  if (!charts[0]) return null;
  const meas = await db
    .select({
      size_code: sizes.code,
      size_label: sizes.label,
      sort_order: sizes.sortOrder,
      measurement_code: sizeChartMeasurements.measurementCode,
      min_value: sizeChartMeasurements.minValue,
      max_value: sizeChartMeasurements.maxValue,
    })
    .from(sizeChartMeasurements)
    .innerJoin(sizes, eq(sizes.id, sizeChartMeasurements.sizeId))
    .where(eq(sizeChartMeasurements.sizeChartId, id))
    .orderBy(asc(sizes.sortOrder));

  // Pivot rows by size for storefront table
  const bySize = new Map<
    string,
    { code: string; label: string; sort_order: number; values: Record<string, string> }
  >();
  for (const m of meas) {
    const key = m.size_code;
    if (!bySize.has(key)) {
      bySize.set(key, { code: m.size_code, label: m.size_label, sort_order: m.sort_order, values: {} });
    }
    const min = Number(m.min_value);
    const max = Number(m.max_value);
    bySize.get(key)!.values[m.measurement_code] = min === max ? String(min) : `${min}–${max}`;
  }

  return {
    id: charts[0].id,
    name: charts[0].name,
    unit: charts[0].unit,
    instructions: charts[0].instructions,
    columns: [...new Set(meas.map((m) => m.measurement_code))],
    rows: [...bySize.values()]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({ size: r.label, code: r.code, ...r.values })),
    measurements: meas.map((m) => ({
      size_code: m.size_code,
      size_label: m.size_label,
      measurement_code: m.measurement_code,
      min_value: Number(m.min_value),
      max_value: Number(m.max_value),
    })),
  };
}

publicSizeRoutes.get("/size-charts", async (c) => {
  const db = c.get("db");
  const charts = await db.select().from(sizeCharts).orderBy(asc(sizeCharts.name));
  return c.json({
    items: charts.map((ch) => ({ id: ch.id, name: ch.name, unit: ch.unit })),
  });
});

publicSizeRoutes.get("/size-charts/default", async (c) => {
  const db = c.get("db");
  const charts = await db.select().from(sizeCharts).orderBy(asc(sizeCharts.name)).limit(1);
  if (!charts[0]) throw new ApiError(404, "not_found", "Chưa có bảng size");
  return c.json(await loadChart(db, charts[0].id));
});

publicSizeRoutes.get("/size-charts/:id", async (c) => {
  const payload = await loadChart(c.get("db"), c.req.param("id"));
  if (!payload) throw new ApiError(404, "not_found", "Không tìm thấy bảng size");
  return c.json(payload);
});
