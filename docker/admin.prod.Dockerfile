# Multi-stage production build for Admin Dashboard (SSR TanStack Start + Nitro)
# Stage 1: Build
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/storefront/package.json apps/storefront/
COPY apps/admin/package.json apps/admin/

RUN npm ci

COPY packages/db packages/db
COPY apps/admin apps/admin

ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production

RUN npm run build -w @elane/admin

# Stage 2: Minimal runtime image
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8081
ENV HOST=0.0.0.0

COPY --from=builder /app/apps/admin/.output /app/.output

EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8081/').then(r=>process.exit(r.ok||r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
