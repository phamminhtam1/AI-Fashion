# Product list filter toolbar (admin)

## Goal

Làm phần lọc danh sách sản phẩm gọn và hiện đại hơn: toolbar 1 hàng + popover “Bộ lọc”, không đổi API.

## Locked decisions

| Topic | Choice |
|-------|--------|
| Layout | **A** — toolbar gọn; lọc phụ trong popover |
| Apply | Đổi field → filter ngay (debounce search như hiện tại) |
| Page size | Giữ trên toolbar (20 / 50 / 100) |
| Active filters | Chip hàng phụ + × từng chip + “Xóa tất cả” |
| Scope | Chỉ `ProductsManager` list header; không đổi API / metrics / table |

## UI

### Hàng 1 (luôn hiện)

- Trái: segmented pills trạng thái (`all` / `published` / `draft` / `archived`) + count
- Giữa: search rộng (tên, slug, SKU)
- Phải: nút **Bộ lọc** (`SlidersHorizontal`) + badge số filter phụ đang bật; select page size nhỏ

### Popover Bộ lọc

- Danh mục (select)
- Giá từ – đến
- Tồn: `""` / `in` / `out` / `none` (segmented hoặc select nhỏ)
- Footer: **Xóa lọc** (clear category / price / stock)

### Chip hàng phụ

Chỉ hiện khi có ≥ 1 filter phụ. Mỗi chip có ×. Link **Xóa tất cả**.

## Out of scope

- Đổi query API, lưu filter vào URL, filter drawer
