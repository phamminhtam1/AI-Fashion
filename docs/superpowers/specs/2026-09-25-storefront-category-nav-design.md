# Storefront category nav (fixed + API tree)

## Goal

Nav storefront: giữ virtual `Hàng mới`, `Công sở`, `Dự tiệc`, `Sale`; danh mục thật lấy từ backend. Gốc trên bar; hover mega-menu hiện con.

## Locked

| Topic | Choice |
|-------|--------|
| Fixed | `hang-moi`, `cong-so`, `du-tiec`, `sale` (không từ bảng categories) |
| Order | Hàng mới → [gốc API] → Công sở → Dự tiệc → Sale |
| API cats | Gốc trên nav; children trong mega-menu |
| Listing | Click gốc/lá → `/danh-muc/$slug`; include **subtree** products |

## API

`GET /categories` returns active rows with `parent_id` (null = root), ordered by `sort_order`.

## Storefront

- Build `navItems` after `ensureCatalog`
- Drop hardcode product category list + static `mega` map
- Homepage category grid uses roots from API

## Out of scope

Admin category UI, casual in nav, URL-persisted filters
