import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "@elane/db";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env.js";
import { ApiError, ensureRequestId, errorBody } from "./lib/errors.js";
import { attachDb, attachUser, type AppVars } from "./middleware/auth.js";
import { adminAuthRoutes } from "./routes/admin/auth.js";
import { adminProductRoutes } from "./routes/admin/products.js";
import { adminInventoryRoutes } from "./routes/admin/inventory.js";
import { adminOpsRoutes } from "./routes/admin/ops.js";
import { adminCategoryRoutes } from "./routes/admin/categories.js";
import { adminSizeRoutes } from "./routes/admin/sizes.js";
import { adminColorRoutes } from "./routes/admin/colors.js";
import { adminMediaRoutes } from "./routes/admin/media.js";
import { adminCustomerRoutes } from "./routes/admin/customers.js";
import { publicCatalogRoutes } from "./routes/public/catalog.js";
import { publicContentRoutes } from "./routes/public/content.js";
import { publicSizeRoutes } from "./routes/public/sizes.js";

fs.mkdirSync(env.uploadDir, { recursive: true });

const db = createDb(env.databaseUrl);
const app = new Hono<AppVars>();

app.use("*", async (c, next) => {
  ensureRequestId(c);
  await next();
});

app.use(
  "*",
  cors({
    origin: [env.storefrontOrigin, env.adminOrigin, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  }),
);

app.use("*", attachDb(db));
app.use("*", attachUser);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/api/v1", publicCatalogRoutes);
app.route("/api/v1", publicContentRoutes);
app.route("/api/v1", publicSizeRoutes);
app.route("/api/v1/admin/auth", adminAuthRoutes);
app.route("/api/v1/admin/products", adminProductRoutes);
app.route("/api/v1/admin/categories", adminCategoryRoutes);
app.route("/api/v1/admin", adminSizeRoutes);
app.route("/api/v1/admin/colors", adminColorRoutes);
app.route("/api/v1/admin", adminMediaRoutes);
app.route("/api/v1/admin/inventory", adminInventoryRoutes);
app.route("/api/v1/admin/customers", adminCustomerRoutes);
app.route("/api/v1/admin", adminOpsRoutes);

app.use(
  "/media/*",
  serveStatic({
    root: env.uploadDir,
    rewriteRequestPath: (p) => p.replace(/^\/media\//, ""),
  }),
);

app.onError((err, c) => {
  const rid = c.get("requestId") ?? "unknown";
  if (err instanceof ApiError) {
    return c.json(errorBody(err, rid), err.status as 400);
  }
  console.error(err);
  return c.json({ code: "internal_error", message: "Lỗi máy chủ", request_id: rid }, 500);
});

console.log(`ÉLANE API listening on :${env.apiPort}`);
serve({ fetch: app.fetch, port: env.apiPort });
