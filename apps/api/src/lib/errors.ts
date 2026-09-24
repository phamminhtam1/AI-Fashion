import type { Context } from "hono";
import { randomUUID } from "node:crypto";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export function requestId(c: Context) {
  return c.get("requestId") as string;
}

export function ensureRequestId(c: Context) {
  const id = c.req.header("x-request-id") ?? randomUUID();
  c.set("requestId", id);
  return id;
}

export function errorBody(err: ApiError, rid: string) {
  return {
    code: err.code,
    message: err.message,
    field_errors: err.fieldErrors,
    request_id: rid,
  };
}
