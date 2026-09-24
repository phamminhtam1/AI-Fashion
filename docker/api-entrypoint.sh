#!/bin/sh
set -e

echo "Waiting for Postgres..."
node --input-type=module <<'NODE'
import postgres from "postgres";

const url = process.env.DATABASE_URL || "postgres://elane:elane@postgres:5432/elane";

for (let i = 0; i < 60; i++) {
  try {
    const sql = postgres(url, { max: 1, connect_timeout: 3 });
    await sql`select 1`;
    await sql.end({ timeout: 1 });
    process.exit(0);
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
console.error("Postgres not ready");
process.exit(1);
NODE

echo "Running migrations..."
npm run db:migrate

echo "Seeding (skip if already seeded)..."
npm run db:seed

echo "Starting API on :${API_PORT:-3001}"
exec npm run start -w @elane/api
