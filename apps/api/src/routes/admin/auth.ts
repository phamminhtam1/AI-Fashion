import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { accounts } from "@elane/db";
import type { AppVars } from "../../middleware/auth.js";
import { ApiError } from "../../lib/errors.js";
import {
  SESSION_COOKIE,
  cookieOptions,
  createSession,
  revokeSession,
} from "../../lib/session.js";

export const adminAuthRoutes = new Hono<AppVars>();

adminAuthRoutes.post("/login", async (c) => {
  const body = z
    .object({ email: z.string().email(), password: z.string().min(1) })
    .safeParse(await c.req.json());
  if (!body.success) {
    throw new ApiError(400, "validation_error", "Email/mật khẩu không hợp lệ", {
      email: "required",
    });
  }
  const db = c.get("db");
  const email = body.data.email.trim().toLowerCase();
  const rows = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  const account = rows[0];
  if (!account?.passwordHash) throw new ApiError(401, "invalid_credentials", "Sai email hoặc mật khẩu");
  if (account.status !== "active") throw new ApiError(403, "account_locked", "Tài khoản đã bị khóa");
  const ok = await bcrypt.compare(body.data.password, account.passwordHash);
  if (!ok) throw new ApiError(401, "invalid_credentials", "Sai email hoặc mật khẩu");

  const { token, expiresAt } = await createSession(db, account.id);
  await db.update(accounts).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(accounts.id, account.id));
  setCookie(c, SESSION_COOKIE, token, cookieOptions(expiresAt));
  return c.json({ ok: true });
});

adminAuthRoutes.post("/logout", async (c) => {
  const { getCookie } = await import("hono/cookie");
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await revokeSession(c.get("db"), token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

adminAuthRoutes.get("/me", async (c) => {
  const user = c.get("user");
  if (!user) throw new ApiError(401, "unauthorized", "Cần đăng nhập");
  return c.json({
    account_id: user.accountId,
    email: user.email,
    employee_id: user.employeeId,
    full_name: user.fullName,
    permissions: user.permissions,
  });
});
