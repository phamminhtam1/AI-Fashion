import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(root, ".env") });

function normalizeSupabaseUrl(raw?: string) {
  if (!raw) return undefined;
  // Accept pasted Data API URL ending in /rest/v1/
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://elane:elane@localhost:5432/elane",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-change-me-elane-phase1-secret",
  apiPort: Number(process.env.API_PORT ?? 3001),
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR ?? "uploads"),
  apiHost: process.env.API_HOST ?? "0.0.0.0",
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [],
  storefrontOrigin: process.env.STOREFRONT_ORIGIN ?? "http://localhost:8090",
  adminOrigin: process.env.ADMIN_ORIGIN ?? "http://localhost:8081",
  supabaseUrl: normalizeSupabaseUrl(process.env.SUPABASE_URL),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  supabaseMediaBucket: process.env.SUPABASE_MEDIA_BUCKET ?? "products",
  sepayWebhookSecret: process.env.SEPAY_WEBHOOK_SECRET ?? "",
  sepayBankAccount: process.env.SEPAY_BANK_ACCOUNT ?? "",
  sepayAccountName: process.env.SEPAY_ACCOUNT_NAME ?? "",
  sepayBankName: process.env.SEPAY_BANK_NAME ?? "",
  sepayBankBin: process.env.SEPAY_BANK_BIN ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  aiWorkerUrl: process.env.AI_WORKER_URL ?? "http://localhost:8000",
  aiTryonMaxDaily: Number(process.env.AI_TRYON_MAX_DAILY ?? 5),
  aiInputRetentionHours: Number(process.env.AI_INPUT_RETENTION_HOURS ?? 72),
  aiResultRetentionDays: Number(process.env.AI_RESULT_RETENTION_DAYS ?? 30),
};
