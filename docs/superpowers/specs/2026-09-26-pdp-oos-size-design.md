# PDP out-of-stock sizes

## Goal

Trên trang chi tiết sản phẩm: size hết hàng theo màu đang chọn hiện dấu X, không chọn được, và không thêm vào giỏ / mua được.

## Locked decisions

| Topic | Choice |
|-------|--------|
| Scope | **1** — PDP only; map `available` từ API; không khóa colorway UI |
| Interaction | **B** — size OOS `disabled`, không chọn được |
| Stock source | `variant.available` (= on_hand − reserved), OOS khi `<= 0` hoặc thiếu variant |
| CTA copy | Màu đang chọn hết sạch size còn hàng → **"Sản phẩm tạm hết hàng"** (disabled) |
| Qty | Không cap qty theo tồn lần này |
| Listing / cart | Không đổi ProductCard, cart drawer, hay checkout stock UI |

## Data

- Public catalog đã trả `available` trên từng variant.
- Storefront: thêm `available: number` vào `ApiProduct.variants` và `Product.variants` (map trong `mapApiProduct`).
- PDP: với `colorwayId` hiện tại, size S còn hàng iff tồn tại variant cùng colorway + size với `available > 0`.

## UI / behavior

### Size buttons

- Còn hàng: giữ style hiện tại; click → `setSize`.
- Hết hàng: `disabled`, opacity thấp, `cursor-not-allowed`, hai nét chéo mỏng (X) qua ô; `aria-label` kiểu “Size M hết hàng”.
- Đổi màu mà size đang chọn trở thành OOS → `setSize(null)`.

### CTA

- Ít nhất một size còn hàng trên màu hiện tại:
  - Label **"Thêm vào giỏ hàng"**.
  - Chưa chọn size: giữ hành vi hiện tại (click → toast “Vui lòng chọn kích cỡ”).
  - Đã chọn size còn hàng: `addToCart` như cũ.
- Không còn size nào `available > 0` trên màu hiện tại:
  - Label **"Sản phẩm tạm hết hàng"**, `disabled`, không gọi `add`.

### Guard in `add()`

- Chặn nếu thiếu size, thiếu variant, hoặc `available <= 0` (toast ngắn). Defense in depth ngoài UI disabled.

## Out of scope

- Đánh dấu / disable colorway hết hàng toàn bộ
- Cap số lượng theo `available`
- Badge “hết hàng” trên listing / ProductCard
- Đổi API inventory
