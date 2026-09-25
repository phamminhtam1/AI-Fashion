# Supabase Storage for product media

## Goal
Store product images in Supabase Storage bucket `products` instead of local `uploads/`.

## Design
- API uploads/deletes via `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` (server only).
- DB unchanged: `media_assets.object_key` = path inside bucket (`{productId}/{uuid}.ext`).
- Public URL: `{SUPABASE_URL}/storage/v1/object/public/products/{object_key}`.
- Keep `/media/*` local static for any legacy local files; new uploads always go to Supabase when env is set.
- Bucket must be public; MIME/size limits stay in API (5MB, jpeg/png/webp/gif).

## Env
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (secret / legacy service_role)
- `SUPABASE_MEDIA_BUCKET` (default `products`)
