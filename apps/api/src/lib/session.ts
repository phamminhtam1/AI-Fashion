import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  accountSessions,
  accounts,
  customers,
  employees,
  employeeRoleGrants,
  rolePermissions,
  permissions,
} from "@elane/db";
import type { Db } from "@elane/db";
import { ApiError } from "./errors.js";

export const SESSION_COOKIE = "elane_session";
export const CUSTOMER_SESSION_COOKIE = "elane_customer_session";
const SESSION_DAYS = 7;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken() {
  return randomBytes(32).toString("hex");
}

export async function createSession(db: Db, accountId: string) {
  const token = newSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(accountSessions).values({ accountId, tokenHash, expiresAt });
  return { token, expiresAt };
}

export async function revokeSession(db: Db, token: string) {
  await db
    .update(accountSessions)
    .set({ revokedAt: new Date() })
    .where(eq(accountSessions.tokenHash, hashToken(token)));
}

export async function revokeAllSessions(db: Db, accountId: string) {
  await db
    .update(accountSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(accountSessions.accountId, accountId), isNull(accountSessions.revokedAt)));
}

export type AuthUser = {
  accountId: string;
  email: string | null;
  employeeId: string;
  fullName: string;
  status: string;
  permissions: string[];
};

export type CustomerUser = {
  accountId: string;
  customerId: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  status: string;
};

export async function resolveSession(db: Db, token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await db
    .select({
      sessionId: accountSessions.id,
      accountId: accounts.id,
      email: accounts.email,
      accountStatus: accounts.status,
      employeeId: employees.id,
      fullName: employees.fullName,
      empStatus: employees.status,
      expiresAt: accountSessions.expiresAt,
      revokedAt: accountSessions.revokedAt,
    })
    .from(accountSessions)
    .innerJoin(accounts, eq(accounts.id, accountSessions.accountId))
    .innerJoin(employees, eq(employees.accountId, accounts.id))
    .where(eq(accountSessions.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.accountStatus !== "active" || row.empStatus !== "active") return null;

  const grants = await db
    .select({ code: permissions.code })
    .from(employeeRoleGrants)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, employeeRoleGrants.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(employeeRoleGrants.employeeId, row.employeeId));

  return {
    accountId: row.accountId,
    email: row.email,
    employeeId: row.employeeId,
    fullName: row.fullName,
    status: row.accountStatus,
    permissions: [...new Set(grants.map((g) => g.code))],
  };
}

export async function resolveCustomerSession(
  db: Db,
  token: string | undefined,
): Promise<CustomerUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await db
    .select({
      accountId: accounts.id,
      email: accounts.email,
      accountStatus: accounts.status,
      customerId: customers.id,
      fullName: customers.fullName,
      phone: customers.phone,
      customerStatus: customers.status,
      expiresAt: accountSessions.expiresAt,
      revokedAt: accountSessions.revokedAt,
    })
    .from(accountSessions)
    .innerJoin(accounts, eq(accounts.id, accountSessions.accountId))
    .innerJoin(customers, eq(customers.accountId, accounts.id))
    .where(eq(accountSessions.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.accountStatus !== "active" || row.customerStatus !== "active") return null;

  return {
    accountId: row.accountId,
    customerId: row.customerId,
    email: row.email,
    fullName: row.fullName,
    phone: row.phone,
    status: row.accountStatus,
  };
}

export function requirePerm(user: AuthUser, code: string) {
  if (!user.permissions.includes(code)) {
    throw new ApiError(403, "forbidden", `Thiếu quyền ${code}`);
  }
}

export function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "Lax" as const,
    path: "/",
    expires: expiresAt,
    // ponytail: local docker uses http://localhost — set COOKIE_SECURE=true behind HTTPS
    secure: process.env.COOKIE_SECURE === "true",
  };
}
