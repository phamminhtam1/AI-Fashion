import { Hono } from "hono";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { colors, auditLogs } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireAuth } from "../../middleware/auth.js";
import { ApiError, requestId } from "../../lib/errors.js";
import { requirePerm } from "../../lib/session.js";

export const adminColorRoutes = new Hono<AppVars>();
adminColorRoutes.use("*", requireAuth);

function codeify(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeHex(raw?: string | null): string | null {
  if (raw == null || raw.trim() === "") return null;
  let h = raw.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(h) && !/^#[0-9A-Fa-f]{3}$/.test(h)) {
    throw new ApiError(400, "invalid_hex", "Mã màu hex không hợp lệ (vd #1A1A1A)");
  }
  if (h.length === 4) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h.toUpperCase();
}

adminColorRoutes.get("/", async (c) => {
  requirePerm(c.get("user")!, "product.read");
  const db = c.get("db");
  const rows = await db.select().from(colors).orderBy(asc(colors.name));
  return c.json({
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      hex: row.hex,
      variant_count: 0,
    })),
  });
});

adminColorRoutes.post("/", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const body = z
    .object({
      code: z.string().min(1).optional(),
      name: z.string().min(1),
      hex: z.string().nullable().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu màu không hợp lệ");

  const db = c.get("db");
  const code = (body.data.code?.trim() || codeify(body.data.name)).toLowerCase();
  const clash = await db.select().from(colors).where(eq(colors.code, code)).limit(1);
  if (clash[0]) throw new ApiError(409, "code_taken", "Mã màu đã tồn tại");
  const hex = normalizeHex(body.data.hex);

  const [row] = await db
    .insert(colors)
    .values({
      code,
      name: body.data.name.trim(),
      hex,
    })
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "color.create",
    resourceType: "color",
    resourceId: row!.id,
    afterRedacted: { code: row!.code, name: row!.name, hex: row!.hex },
    requestId: requestId(c),
  });
  return c.json(
    { id: row!.id, code: row!.code, name: row!.name, hex: row!.hex, variant_count: 0 },
    201,
  );
});

adminColorRoutes.patch("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const body = z
    .object({
      code: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      hex: z.string().nullable().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu màu không hợp lệ");

  const db = c.get("db");
  const existing = await db.select().from(colors).where(eq(colors.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy màu");

  let code = existing[0].code;
  if (body.data.code) {
    code = body.data.code.trim().toLowerCase();
    const clash = await db
      .select()
      .from(colors)
      .where(and(eq(colors.code, code), ne(colors.id, existing[0].id)))
      .limit(1);
    if (clash[0]) throw new ApiError(409, "code_taken", "Mã màu đã tồn tại");
  }

  let hex = existing[0].hex;
  if (body.data.hex !== undefined) {
    hex = normalizeHex(body.data.hex);
  }

  const [row] = await db
    .update(colors)
    .set({
      code,
      name: body.data.name?.trim() ?? existing[0].name,
      hex,
    })
    .where(eq(colors.id, existing[0].id))
    .returning();

  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "color.update",
    resourceType: "color",
    resourceId: row!.id,
    requestId: requestId(c),
  });
  return c.json({
    id: row!.id,
    code: row!.code,
    name: row!.name,
    hex: row!.hex,
    variant_count: 0,
  });
});

adminColorRoutes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  requirePerm(user, "product.write");
  const db = c.get("db");
  const existing = await db.select().from(colors).where(eq(colors.id, c.req.param("id"))).limit(1);
  if (!existing[0]) throw new ApiError(404, "not_found", "Không tìm thấy màu");

  await db.delete(colors).where(eq(colors.id, existing[0].id));
  await db.insert(auditLogs).values({
    actorAccountId: user.accountId,
    action: "color.delete",
    resourceType: "color",
    resourceId: existing[0].id,
    requestId: requestId(c),
  });
  return c.json({ id: existing[0].id, deleted: true });
});
