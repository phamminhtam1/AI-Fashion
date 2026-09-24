FROM node:22-bookworm-slim

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
COPY apps/api apps/api
COPY docker/api-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

RUN mkdir -p /app/uploads

ENV NODE_ENV=production
ENV API_PORT=3001
ENV UPLOAD_DIR=/app/uploads
ENV DATABASE_URL=postgres://elane:elane@postgres:5432/elane
ENV STOREFRONT_ORIGIN=http://localhost:8090
ENV ADMIN_ORIGIN=http://localhost:8081
ENV COOKIE_SECURE=false

EXPOSE 3001
VOLUME ["/app/uploads"]

ENTRYPOINT ["/entrypoint.sh"]
