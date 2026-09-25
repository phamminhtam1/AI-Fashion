# Admin product list pagination & filters

Server-side `GET /admin/products`:
- `page`, `limit` (20|50|100), `q`, `status`, `category_id` (+ descendants), `price_min`, `price_max`, `stock` (`in|out|none`)
- Response `{ items, total, page, limit }`

Admin UI: category / price range / stock filter + pagination footer.
