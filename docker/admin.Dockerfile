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
COPY apps/admin apps/admin

ENV PORT=8081
ENV HOST=0.0.0.0
ENV VITE_API_URL=http://localhost:3001

EXPOSE 8081

CMD ["sh", "-c", "npm run dev -w @elane/admin -- --host 0.0.0.0 --port $PORT"]
