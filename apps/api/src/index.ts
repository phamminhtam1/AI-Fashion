import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb } from "@elane/db";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env.js";
import { ApiError, ensureRequestId, errorBody } from "./lib/errors.js";
import { attachDb, attachUser, attachCustomer, type AppVars } from "./middleware/auth.js";
import { adminAuthRoutes } from "./routes/admin/auth.js";
import { adminProductRoutes } from "./routes/admin/products.js";
import { adminInventoryRoutes } from "./routes/admin/inventory.js";
import { adminOpsRoutes } from "./routes/admin/ops.js";
import { adminCategoryRoutes } from "./routes/admin/categories.js";
import { adminSizeRoutes } from "./routes/admin/sizes.js";
import { adminColorRoutes } from "./routes/admin/colors.js";
import { adminMediaRoutes } from "./routes/admin/media.js";
import { adminCustomerRoutes } from "./routes/admin/customers.js";
import { adminOrderRoutes } from "./routes/admin/orders.js";
import { adminDiscountCodeRoutes } from "./routes/admin/discount-codes.js";
import { adminElaneWomanRoutes } from "./routes/admin/elane-woman.js";
import { storeAuthRoutes } from "./routes/store/auth.js";
import { storeCouponRoutes } from "./routes/store/coupons.js";
import { meRoutes } from "./routes/me/index.js";
import { publicCatalogRoutes } from "./routes/public/catalog.js";
import { publicContentRoutes } from "./routes/public/content.js";
import { publicSizeRoutes } from "./routes/public/sizes.js";
import { publicPaymentRoutes } from "./routes/public/payments.js";
import { sepayWebhookRoutes } from "./routes/webhooks/sepay.js";

fs.mkdirSync(env.uploadDir, { recursive: true });

const db = createDb(env.databaseUrl);
const app = new Hono<AppVars>();

app.use("*", async (c, next) => {
  ensureRequestId(c);
  await next();
});

const staticAllowedOrigins = [
  env.storefrontOrigin,
  env.adminOrigin,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8090",
  "http://127.0.0.1:8090",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  ...env.corsOrigins,
];

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (
        staticAllowedOrigins.includes(origin) ||
        origin.startsWith("http://192.168.56.") ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return origin;
      }
      return staticAllowedOrigins[0] ?? "*";
    },
    credentials: true,
  }),
);

app.use("*", attachDb(db));
app.use("*", attachUser);
app.use("*", attachCustomer);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/api/v1", publicCatalogRoutes);
app.route("/api/v1", publicContentRoutes);
app.route("/api/v1", publicSizeRoutes);
app.route("/api/v1", publicPaymentRoutes);
app.route("/api/v1", sepayWebhookRoutes);
app.route("/api/v1/store/auth", storeAuthRoutes);
app.route("/api/v1/store/coupons", storeCouponRoutes);
app.route("/api/v1/me", meRoutes);
app.route("/api/v1/admin/auth", adminAuthRoutes);
app.route("/api/v1/admin/products", adminProductRoutes);
app.route("/api/v1/admin/categories", adminCategoryRoutes);
app.route("/api/v1/admin", adminSizeRoutes);
app.route("/api/v1/admin/colors", adminColorRoutes);
app.route("/api/v1/admin", adminMediaRoutes);
app.route("/api/v1/admin/inventory", adminInventoryRoutes);
app.route("/api/v1/admin/customers", adminCustomerRoutes);
app.route("/api/v1/admin/orders", adminOrderRoutes);
app.route("/api/v1/admin/discount-codes", adminDiscountCodeRoutes);
app.route("/api/v1/admin/elane-woman", adminElaneWomanRoutes);
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

console.log(`ÉLANE API listening on ${env.apiHost}:${env.apiPort}`);
serve({ fetch: app.fetch, port: env.apiPort, hostname: env.apiHost });
