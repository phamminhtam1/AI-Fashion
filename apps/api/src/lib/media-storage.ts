import fs from "node:fs";
import path from "node:path";
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
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
let _r2Client: S3Client | undefined;

function useR2(): boolean {
  return env.mediaStorageProvider.toLowerCase() === "r2";
}

function requireR2() {
  if (!env.r2Endpoint || !env.r2AccessKeyId || !env.r2SecretAccessKey) {
    throw new ApiError(
      503,
      "storage_misconfigured",
      "Thiếu R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY",
    );
  }
  if (!_r2Client) {
    _r2Client = new S3Client({
      endpoint: env.r2Endpoint,
      region: env.r2Region,
      credentials: {
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey,
      },
    });
  }
  return { client: _r2Client, bucket: env.r2MediaBucket };
}

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
  if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
    return objectKey;
  }
  if (useR2()) {
    if (!env.r2PublicBaseUrl) {
      throw new ApiError(503, "storage_misconfigured", "Thiếu R2_PUBLIC_BASE_URL");
    }
    return `${env.r2PublicBaseUrl}/${objectKey}`;
  }
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
  if (useR2()) {
    const { client, bucket } = requireR2();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: body,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      return;
    } catch (error) {
      throw new ApiError(
        502,
        "storage_upload_failed",
        error instanceof Error ? error.message : "Upload ảnh lên R2 thất bại",
      );
    }
  }
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    const filePath = path.resolve(env.uploadDir, objectKey);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, body);
    return;
  }
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
  if (useR2()) {
    const { client, bucket } = requireR2();
    for (let offset = 0; offset < objectKeys.length; offset += 1000) {
      const chunk = objectKeys.slice(offset, offset + 1000);
      try {
        const result = await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
          }),
        );
        if (result.Errors?.length) {
          console.warn("[media] R2 delete errors:", result.Errors);
        }
      } catch (error) {
        console.warn(
          "[media] R2 batch delete failed:",
          chunk.length,
          error instanceof Error ? error.message : error,
        );
      }
    }
    return;
  }
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    for (const key of objectKeys) {
      try {
        const filePath = path.resolve(env.uploadDir, key);
        await fs.promises.unlink(filePath);
      } catch {}
    }
    return;
  }
  const { client, bucket } = requireStorage();
  const { error } = await client.storage.from(bucket).remove(objectKeys);
  if (error) {
    // ponytail: ignore missing remote objects; DB rows already removed
    console.warn("[media] batch delete failed:", objectKeys.length, error.message);
  }
}
