FROM node:22-bookworm-slim

WORKDIR /app

ARG APP=storefront
ARG PORT=8080
ARG VITE_API_URL=http://localhost:3001

ENV APP=${APP}
ENV PORT=${PORT}
ENV VITE_API_URL=${VITE_API_URL}
ENV HOST=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/storefront/package.json apps/storefront/
COPY apps/admin/package.json apps/admin/

RUN npm ci

COPY apps/${APP} apps/${APP}
# Shared root tooling sometimes expected by vite plugins
COPY packages/db packages/db

EXPOSE ${PORT}

# Dev server in container: reliable with TanStack Start / Lovable vite config.
# Browser still talks to API via localhost:3001 (published port).
CMD ["sh", "-c", "npm run dev -w @elane/$APP -- --host 0.0.0.0 --port $PORT"]
