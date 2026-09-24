/**
 * Phase 1 acceptance checks (API must be running on :3001, DB seeded).
 */
import { writeFileSync } from "node:fs";

const API = process.env.API_URL ?? "http://localhost:3001";
const cookieJar = new Map();

function parseSetCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const [k, v] = pair.split("=");
    cookieJar.set(k, v);
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (cookieJar.size) headers.cookie = cookieHeader();
  const res = await fetch(`${API}${path}`, { ...init, headers });
  parseSetCookie(res);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const health = await req("/health");
  assert(health.body.ok === true, "health");

  const pub = await req("/api/v1/products?limit=100");
  assert(pub.body.total === 20, `expected 20 published, got ${pub.body.total}`);
  assert(!pub.body.items.some((p) => p.slug === "dam-nhap-khong-public"), "draft leaked");

  const draft = await req("/api/v1/products/dam-nhap-khong-public");
  assert(draft.res.status === 404, "draft detail should 404");

  writeFileSync("body.json", JSON.stringify({ email: "admin@elane.local", password: "ElaneAdmin1!" }));
  const login = await req("/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@elane.local", password: "ElaneAdmin1!" }),
  });
  assert(login.body.ok === true, "login");

  const me = await req("/api/v1/admin/auth/me");
  assert(me.body.permissions.includes("product.read"), "me perms");

  const inv = await req("/api/v1/admin/inventory");
  const variantId = inv.body.items[0].variant_id;
  const before = inv.body.items[0].on_hand;

  const doc = await req("/api/v1/admin/inventory/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "receipt",
      reason: "acceptance",
      lines: [{ variant_id: variantId, qty: 2, direction: "in" }],
    }),
  });
  assert(doc.res.status === 201, "create doc");
  await req(`/api/v1/admin/inventory/documents/${doc.body.id}/approve`, { method: "POST" });
  const key = `accept-${doc.body.id}`;
  const post1 = await req(`/api/v1/admin/inventory/documents/${doc.body.id}/post`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
  });
  assert(post1.body.status === "posted", "post");
  const post2 = await req(`/api/v1/admin/inventory/documents/${doc.body.id}/post`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
  });
  assert(post2.body.idempotent_replay === true, "idempotent");

  const inv2 = await req("/api/v1/admin/inventory");
  const after = inv2.body.items.find((i) => i.variant_id === variantId).on_hand;
  assert(after === before + 2, `on_hand ${before} -> ${after}`);

  const postedAgain = await req(`/api/v1/admin/inventory/documents/${doc.body.id}/approve`, { method: "POST" });
  assert(postedAgain.res.status === 409, "posted immutable approve");

  console.log("Phase 1 acceptance: PASS");
}

main().catch((e) => {
  console.error("Phase 1 acceptance: FAIL", e.message);
  process.exit(1);
});
