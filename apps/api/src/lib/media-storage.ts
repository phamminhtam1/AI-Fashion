import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env.js";
import { ApiError } from "./errors.js";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

let _client: SupabaseClient | undefined;

function requireStorage() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new ApiError(
      503,
      "storage_misconfigured",
      "Thiếu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — chưa cấu hình lưu ảnh",
    );
  }
  if (!_client) {
    _client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      global: { fetch: createSupabaseFetch(env.supabaseServiceRoleKey) },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return { client: _client, bucket: env.supabaseMediaBucket };
}

/** Public URL for an object_key. Falls back to local /media when Supabase unset. */
export function mediaPublicUrl(objectKey: string): string {
  if (env.supabaseUrl) {
    const base = env.supabaseUrl.replace(/\/$/, "");
    return `${base}/storage/v1/object/public/${env.supabaseMediaBucket}/${objectKey}`;
  }
  return `/media/${objectKey}`;
}

export async function uploadMediaObject(
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { client, bucket } = requireStorage();
  const { error } = await client.storage.from(bucket).upload(objectKey, body, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    throw new ApiError(502, "storage_upload_failed", error.message || "Upload ảnh thất bại");
  }
}

export async function deleteMediaObject(objectKey: string): Promise<void> {
  await deleteMediaObjects([objectKey]);
}

/** Batch remove — one round-trip instead of N sequential deletes. */
export async function deleteMediaObjects(objectKeys: string[]): Promise<void> {
  if (!objectKeys.length) return;
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return;
  const { client, bucket } = requireStorage();
  const { error } = await client.storage.from(bucket).remove(objectKeys);
  if (error) {
    // ponytail: ignore missing remote objects; DB rows already removed
    console.warn("[media] batch delete failed:", objectKeys.length, error.message);
  }
}
