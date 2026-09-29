#!/bin/sh
set -e

echo "[api-entrypoint] Waiting for PostgreSQL to be ready..."
node --input-type=module <<'NODE'
import postgres from "postgres";

const rawUrl = process.env.DATABASE_URL || "postgres://elane:elane@postgres:5432/elane";
const maskedUrl = rawUrl.replace(/:([^:@]+)@/, ":****@");

for (let i = 1; i <= 60; i++) {
  try {
    const sql = postgres(rawUrl, { max: 1, connect_timeout: 3 });
    await sql`select 1`;
    await sql.end({ timeout: 1 });
    console.log(`[api-entrypoint] Successfully connected to PostgreSQL (${maskedUrl})`);
    process.exit(0);
  } catch (err) {
    if (i % 5 === 0 || i === 1) {
      console.log(`[api-entrypoint] Waiting for DB (${maskedUrl})... (${i}/60) - ${err.message || 'connecting'}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
console.error("[api-entrypoint] ERROR: PostgreSQL was not reachable within 60 seconds.");
process.exit(1);
NODE

echo "[api-entrypoint] Running database migrations..."
npm run db:migrate

echo "[api-entrypoint] Checking/applying database seeds..."
npm run db:seed

echo "[api-entrypoint] Starting API server on ${API_HOST:-0.0.0.0}:${API_PORT:-3001} (NODE_ENV=${NODE_ENV:-production})..."
exec npm run start -w @elane/api
