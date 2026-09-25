# Pantio sample import

Import all ~223 products from `pantio_products.json`.

- Categories from JSON tree (parent + leaf)
- Split `Chất liệu:` from description → material
- Colorways from image URL color token (`__w__`, `__x__`, …); master only
- Download images → Supabase upload
- Each colorway: random 2–4 sizes from XS–XL
- No inventory balances; status published; skip existing slug
