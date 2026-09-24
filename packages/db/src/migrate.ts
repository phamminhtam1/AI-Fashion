import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "postgres://elane:elane@localhost:5432/elane";
const dir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(dir, "..", "drizzle");

const client = postgres(url, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder });
await client.end();
console.log("Migrations applied.");
