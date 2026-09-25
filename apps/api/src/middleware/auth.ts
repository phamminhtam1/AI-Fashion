import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Db } from "@elane/db";
import { ApiError } from "../lib/errors.js";
import {
  resolveSession,
  resolveCustomerSession,
  SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  type AuthUser,
  type CustomerUser,
} from "../lib/session.js";

export type AppVars = {
  Variables: {
    requestId: string;
    db: Db;
    user: AuthUser | null;
    customer: CustomerUser | null;
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

export const attachCustomer = createMiddleware<AppVars>(async (c, next) => {
  const token = getCookie(c, CUSTOMER_SESSION_COOKIE);
  const customer = await resolveCustomerSession(c.get("db"), token);
  c.set("customer", customer);
  await next();
});

export const requireAuth = createMiddleware<AppVars>(async (c, next) => {
  const user = c.get("user");
  if (!user) throw new ApiError(401, "unauthorized", "Cần đăng nhập");
  await next();
});

export const requireCustomer = createMiddleware<AppVars>(async (c, next) => {
  const customer = c.get("customer");
  if (!customer) throw new ApiError(401, "unauthorized", "Cần đăng nhập");
  await next();
});
