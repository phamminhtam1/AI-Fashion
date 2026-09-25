import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { accounts, customers } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { requireCustomer } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
import {
  CUSTOMER_SESSION_COOKIE,
  cookieOptions,
  createSession,
  revokeSession,
} from "../../lib/session.js";

export const storeAuthRoutes = new Hono<AppVars>();

storeAuthRoutes.post("/register", async (c) => {
  const body = z
    .object({
      full_name: z.string().trim().min(1).max(200),
      email: z.string().email(),
      phone: z.string().trim().max(40).optional().nullable(),
      password: z.string().min(6).max(200),
    })
    .safeParse(await c.req.json());
  if (!body.success) {
    throw new ApiError(400, "validation_error", "Thông tin đăng ký không hợp lệ");
  }

  const db = c.get("db");
  const email = body.data.email.trim().toLowerCase();
  const existing = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, email)).limit(1);
  if (existing[0]) throw new ApiError(409, "conflict", "Email đã được sử dụng");

  const passwordHash = await bcrypt.hash(body.data.password, 10);
  const phone = body.data.phone?.trim() || null;

  const account = await db.transaction(async (tx) => {
    const [acc] = await tx
      .insert(accounts)
      .values({
        authSubject: `email:${email}`,
        email,
        phone,
        passwordHash,
        status: "active",
      })
      .returning();
    if (!acc) throw new ApiError(500, "internal_error", "Không tạo được tài khoản");
    await tx.insert(customers).values({
      accountId: acc.id,
      fullName: body.data.full_name.trim(),
      email,
      phone,
      segment: "new",
      status: "active",
    });
    return acc;
  });

  const { token, expiresAt } = await createSession(db, account.id);
  await db.update(accounts).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(accounts.id, account.id));
  setCookie(c, CUSTOMER_SESSION_COOKIE, token, cookieOptions(expiresAt));
  return c.json({ ok: true });
});

storeAuthRoutes.post("/login", async (c) => {
  const body = z
    .object({ email: z.string().email(), password: z.string().min(1) })
    .safeParse(await c.req.json());
  if (!body.success) {
    throw new ApiError(400, "validation_error", "Email/mật khẩu không hợp lệ");
  }
  const db = c.get("db");
  const email = body.data.email.trim().toLowerCase();
  const account = (await db.select().from(accounts).where(eq(accounts.email, email)).limit(1))[0];
  if (!account?.passwordHash) throw new ApiError(401, "invalid_credentials", "Sai email hoặc mật khẩu");
  if (account.status !== "active") throw new ApiError(403, "account_locked", "Tài khoản đã bị khóa");
  const ok = await bcrypt.compare(body.data.password, account.passwordHash);
  if (!ok) throw new ApiError(401, "invalid_credentials", "Sai email hoặc mật khẩu");

  const cust = (
    await db.select().from(customers).where(eq(customers.accountId, account.id)).limit(1)
  )[0];
  if (!cust) throw new ApiError(403, "forbidden", "Tài khoản không phải khách hàng cửa hàng");
  if (cust.status !== "active") throw new ApiError(403, "account_locked", "Tài khoản đã bị khóa");

  const { token, expiresAt } = await createSession(db, account.id);
  await db.update(accounts).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(accounts.id, account.id));
  setCookie(c, CUSTOMER_SESSION_COOKIE, token, cookieOptions(expiresAt));
  return c.json({ ok: true });
});

storeAuthRoutes.post("/logout", async (c) => {
  const token = getCookie(c, CUSTOMER_SESSION_COOKIE);
  if (token) await revokeSession(c.get("db"), token);
  deleteCookie(c, CUSTOMER_SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

storeAuthRoutes.get("/me", requireCustomer, async (c) => {
  const u = c.get("customer")!;
  return c.json({
    customer_id: u.customerId,
    full_name: u.fullName,
    email: u.email,
    phone: u.phone,
  });
});

storeAuthRoutes.patch("/me", requireCustomer, async (c) => {
  const body = z
    .object({
      full_name: z.string().trim().min(1).max(200).optional(),
      phone: z.string().trim().max(40).nullable().optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success) throw new ApiError(400, "validation_error", "Dữ liệu không hợp lệ");
  if (body.data.full_name === undefined && body.data.phone === undefined) {
    throw new ApiError(400, "validation_error", "Không có trường cập nhật");
  }

  const db = c.get("db");
  const u = c.get("customer")!;
  const [row] = await db
    .update(customers)
    .set({
      ...(body.data.full_name !== undefined ? { fullName: body.data.full_name } : {}),
      ...(body.data.phone !== undefined ? { phone: body.data.phone } : {}),
      updatedAt: new Date(),
    })
    .where(eq(customers.id, u.customerId))
    .returning();
  if (!row) throw new ApiError(404, "not_found", "Không tìm thấy khách hàng");
  return c.json({
    customer_id: row.id,
    full_name: row.fullName,
    email: row.email,
    phone: row.phone,
  });
});
