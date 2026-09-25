# Product colorways (per-color image sets)

## Goal

Mỗi sản phẩm có N **colorway** (nhóm ảnh theo màu), không lấy từ danh mục màu toàn cục (Be / Xanh / Đen). Storefront chọn màu bằng **thumbnail ảnh** (kiểu Pantio); đổi màu → đổi gallery. Đơn hàng hiện tên sản phẩm; vận hành theo **SKU**.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Gallery khi chọn màu | Chỉ ảnh của colorway đó |
| Color identity | Free-form per product (không gắn `colors` catalog) |
| Inventory | Mỗi colorway × size = 1 SKU |
| Color label | Không bắt buộc; đơn = tên SP; admin đơn = SKU |
| Admin layout | Tabs theo màu (Màu 1, Màu 2… + Thêm màu) |
| Empty colorway | Giữ trong admin; **không** trả về public |

## Data model

### `product_colorways` (new)

| Column | Notes |
|--------|--------|
| `id` | uuid PK |
| `product_id` | FK → products |
| `sort_order` | int, default 0 |
| `created_at` | |

Không bắt buộc `name`.

### `product_media`

- Đổi `color_id` → `colorway_id` (FK → `product_colorways`, NOT NULL cho upload mới).
- Mỗi ảnh thuộc đúng một colorway.
- Ảnh đầu (sort thấp nhất / cover trong colorway) = thumbnail chọn màu trên storefront.

### `product_variants`

- Đổi `color_id` → `colorway_id`.
- Unique: `(product_id, colorway_id, size_id)`.
- `sku` vẫn unique toàn hệ thống.

### `colors` (global catalog)

- Giữ bảng + dữ liệu cũ.
- **Không** dùng trên form thêm/sửa sản phẩm mới.
- UI quản lý màu toàn cục có thể giữ cho dữ liệu legacy / sau này; không chặn ship colorways.

## Admin UX

1. Form sản phẩm: bỏ multi-select màu từ catalog.
2. Thay bằng tabs **Màu 1 / Màu 2 / …** và **+ Thêm màu**.
3. Trong tab đang chọn: gallery riêng, upload, xóa, reorder; ảnh đầu = thumbnail PDP + (nếu colorway đầu) cover list.
4. Size vẫn chọn chung → sync matrix colorway × size → SKU (tồn 0 khi tạo).
5. Xóa colorway → xóa media của colorway + deactivate variants liên quan.
6. Colorway 0 ảnh: hiện trong admin; ẩn khỏi catalog public.

## Storefront UX

1. PDP: hàng thumbnail màu (ảnh đầu mỗi colorway có ≥1 ảnh); selected = viền đậm + check góc (kiểu Pantio).
2. Chọn màu → gallery chính + strip thumbnails đổi theo colorway.
3. Size options / stock theo variants của colorway đang chọn.
4. Add to cart / checkout: lưu `variant_id` hoặc `sku` (+ qty); UI hiện tên sản phẩm (và SKU nơi cần cho ops).
5. Product card / list: cover = ảnh đầu của colorway `sort_order` nhỏ nhất có ảnh.

## API

### Admin

- Colorway CRUD scoped to product: create / delete / reorder.
- `POST /admin/products/:id/media` — bắt buộc `colorway_id`; reject 400 nếu thiếu hoặc không thuộc product.
- Create/update product: `size_ids` + colorways (không còn `color_ids` catalog trên path mới).
- Variant sync = mọi colorway × mọi size đã chọn.

### Public catalog

- Response gồm `colorways: [{ id, sort_order, thumbnail, images[] }]`.
- `variants` gắn `colorway_id` + `sku` (+ size, stock).
- PDP mới không phụ thuộc `colors[].hex` để chọn màu.

### Cart / orders

- Line identity: `sku` hoặc `variant_id`.
- Display: product name; ops screens: SKU.

## Migration

1. Với mỗi cặp `(product_id, color_id)` đang dùng trên variants → tạo 1 `product_colorways` row (giữ thứ tự ổn định).
2. Remap `product_variants.color_id` → `colorway_id`.
3. Remap `product_media.color_id` → `colorway_id` khi match; media `color_id` null: gán vào colorway đầu của product (hoặc colorway duy nhất nếu chỉ có một).
4. Drop / stop writing FK tới `colors` từ variants & media sau remap (column rename hoặc cột mới + drop cũ trong cùng migration).
5. Bảng `colors` giữ nguyên.

## Errors & edge cases

| Case | Behavior |
|------|----------|
| Upload thiếu / sai `colorway_id` | 400 |
| Colorway không thuộc product | 400 |
| Colorway 0 ảnh | Ẩn khỏi public `colorways[]` |
| Xóa colorway đang có tồn | Deactivate variants; không hard-delete nếu ràng buộc đơn — theo pattern hiện có của product/variant |
| Product 0 colorway có ảnh | Public không có ô màu / gallery rỗng — admin nên tạo trước khi publish (không hard-block publish trong v1 trừ khi đã có rule publish sẵn) |

## Out of scope (YAGNI)

- Tên màu bắt buộc trên colorway.
- Lọc catalog theo màu hex / catalog `colors`.
- Ảnh “chung” (`colorway_id` null) làm fallback.
- Đổi UI quản lý bảng `colors` toàn cục.
- Import Pantio JSON tự động (có thể làm sau trên cùng model).

## Self-check (implementation)

Một script/assert nhỏ: tạo product → 2 colorways → upload ảnh vào từng cái → public payload có 2 colorways với `images` tách đúng; variant count = colorways × sizes.
