import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(root, ".env") });

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgres://elane:elane@localhost:5432/elane",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-change-me-elane-phase1-secret",
  apiPort: Number(process.env.API_PORT ?? 3001),
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR ?? "uploads"),
  storefrontOrigin: process.env.STOREFRONT_ORIGIN ?? "http://localhost:8090",
  adminOrigin: process.env.ADMIN_ORIGIN ?? "http://localhost:8081",
};
