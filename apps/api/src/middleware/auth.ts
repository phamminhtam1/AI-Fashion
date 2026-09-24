import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Db } from "@elane/db";
import { ApiError } from "../lib/errors.js";
import { resolveSession, SESSION_COOKIE, type AuthUser } from "../lib/session.js";
export type AppVars = {
  Variables: {
    requestId: string;
    db: Db;
    user: AuthUser | null;
  };
};

export const attachDb = (db: Db) =>
  createMiddleware<AppVars>(async (c, next) => {
    c.set("db", db);
    await next();
  });

export const attachUser = createMiddleware<AppVars>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  const user = await resolveSession(c.get("db"), token);
  c.set("user", user);
  await next();
});

export const requireAuth = createMiddleware<AppVars>(async (c, next) => {
  const user = c.get("user");
  if (!user) throw new ApiError(401, "unauthorized", "Cần đăng nhập");
  await next();
});
