# ÉLANE — Phase 1 monorepo

Storefront + Admin + API + Postgres theo `docs/superpowers/specs/2026-09-24-elane-phase1-design.md`.

## Cấu trúc

```
apps/storefront  — website ÉLANE (TanStack Start)
apps/admin       — quản trị nhân viên
apps/api         — Hono `/api/v1`
packages/db      — Drizzle schema / migrate / seed
uploads/         — ảnh local
```

## Chạy bằng Docker (khuyến nghị)

Một lệnh — Postgres + API + storefront + admin:

```bash
docker compose up --build -d
```

| Service     | URL                      |
|-------------|--------------------------|
| Storefront  | http://localhost:8090    |
| Admin       | http://localhost:8081    |
| API         | http://localhost:3001    |
| Postgres    | localhost:5432           |

Dừng: `docker compose down`  
Xem log: `docker compose logs -f api`

## Chạy local (không Docker app)

```bash
docker compose up -d postgres
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev:api          # :3001
npm run dev:storefront   # :8090 (đổi port trong vite nếu cần)
npm run dev:admin        # :8081
```

### Tài khoản seed

- Email: `admin@elane.local`
- Password: `ElaneAdmin1!`

### Kiểm tra

```bash
npm run acceptance
```

## Ghi chú Phase 1

- Storefront đọc catalog/CMS từ API; giỏ/checkout vẫn localStorage (GĐ2).
- Admin: đăng nhập, tổng quan, sản phẩm (publish), kho (phiếu + idempotency), nhân sự, brand, audit.
- Không có checkout/thanh toán/đổi trả trong giai đoạn này.
